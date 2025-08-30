import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

// Workflow validation utility
function validateWorkflowStructure(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic structure
  if (!data || typeof data !== 'object') {
    errors.push('Root data must be an object');
    return { isValid: false, errors, warnings };
  }

  // Check version
  if (!data.version) {
    warnings.push('Missing version field, will default to 1.0.0');
  }

  // Check metadata
  if (!data.metadata || typeof data.metadata !== 'object') {
    warnings.push('Missing or invalid metadata, will use defaults');
  }

  // Check nodes array
  if (!Array.isArray(data.nodes)) {
    errors.push('Nodes must be an array');
  } else {
    const nodeIds = new Set<string>();
    data.nodes.forEach((node: any, index: number) => {
      if (!node.id) {
        errors.push(`Node at index ${index} is missing required 'id' field`);
      } else if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID found: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      if (!node.type) {
        errors.push(`Node ${node.id || index} is missing required 'type' field`);
      }

      if (!node.position || typeof node.position !== 'object' || 
          typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        errors.push(`Node ${node.id || index} has invalid position data`);
      }

      if (!node.data || typeof node.data !== 'object') {
        warnings.push(`Node ${node.id || index} missing data object, will use defaults`);
      }

      if (typeof node.width !== 'number' || typeof node.height !== 'number') {
        warnings.push(`Node ${node.id || index} missing dimensions, will use defaults`);
      }
    });
  }

  // Check edges array
  if (!Array.isArray(data.edges)) {
    errors.push('Edges must be an array');
  } else {
    const nodeIds = new Set(data.nodes?.map((n: any) => n.id) || []);
    data.edges.forEach((edge: any, index: number) => {
      if (!edge.id) {
        warnings.push(`Edge at index ${index} missing ID, will auto-generate`);
      }

      if (!edge.source) {
        errors.push(`Edge at index ${index} missing required 'source' field`);
      } else if (!nodeIds.has(edge.source)) {
        errors.push(`Edge ${edge.id || index} references non-existent source node: ${edge.source}`);
      }

      if (!edge.target) {
        errors.push(`Edge at index ${index} missing required 'target' field`);
      } else if (!nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id || index} references non-existent target node: ${edge.target}`);
      }

      if (!edge.type) {
        warnings.push(`Edge ${edge.id || index} missing type, will default to 'bezier'`);
      }
    });
  }

  // Check viewport
  if (!data.viewport || typeof data.viewport !== 'object') {
    warnings.push('Missing viewport data, will use defaults');
  } else {
    if (typeof data.viewport.x !== 'number' || typeof data.viewport.y !== 'number' || 
        typeof data.viewport.zoom !== 'number') {
      warnings.push('Invalid viewport data, will use defaults');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Chat endpoint - proxy for AI models with dynamic provider routing
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { model, messages, temperature, maxTokens, provider, apiKey: clientApiKey } = req.body;
      
      // Determine provider and API key
      let activeProvider = provider;
      let activeApiKey = clientApiKey;
      
      // If no explicit provider, try to infer from model name
      if (!activeProvider) {
        if (model && model.includes('claude')) {
          activeProvider = 'anthropic';
          activeApiKey = process.env.ANTHROPIC_API_KEY;
        } else {
          activeProvider = 'openai';
          activeApiKey = process.env.OPENAI_API_KEY;
        }
      }
      
      // Set API keys from environment if not provided (but not for Ollama or Kiteframe which don't need them)
      if (!activeApiKey && activeProvider !== 'ollama' && activeProvider !== 'kiteframe') {
        if (activeProvider === 'anthropic') {
          activeApiKey = process.env.ANTHROPIC_API_KEY;
        } else if (activeProvider === 'openai') {
          activeApiKey = process.env.OPENAI_API_KEY;
        }
      }

      if (!activeApiKey && activeProvider !== 'ollama' && activeProvider !== 'kiteframe') {
        return res.status(401).json({ 
          error: `${activeProvider} API key not configured. Please set it in AI settings.` 
        });
      }

      console.log('AI Chat Request:', { 
        provider: activeProvider,
        model,
        hasApiKey: !!activeApiKey, 
        keyPrefix: activeApiKey.substring(0, 7) + '...' 
      });

      let endpoint: string;
      let headers: Record<string, string>;
      let requestBody: any;

      // Configure request based on provider
      if (activeProvider === 'anthropic') {
        endpoint = 'https://api.anthropic.com/v1/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': activeApiKey,
          'anthropic-version': '2023-06-01'
        };
        requestBody = {
          model,
          max_tokens: maxTokens || 1024,
          messages
        };
      } else if (activeProvider === 'ollama') {
        // Ollama uses OpenAI-compatible API
        const { customEndpoint } = req.body;
        endpoint = `${customEndpoint || 'http://localhost:11434'}/v1/chat/completions`;
        headers = {
          'Content-Type': 'application/json'
          // Ollama doesn't require Authorization header for local usage
        };
        requestBody = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        };
      } else if (activeProvider === 'kiteframe') {
        // Kiteframe managed Ollama service
        endpoint = 'https://driftline.replit.app/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json'
          // Kiteframe managed service - no auth required
        };
        requestBody = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        };
      } else if (activeProvider === 'custom') {
        const { customEndpoint } = req.body;
        if (!customEndpoint) {
          return res.status(400).json({ error: 'Custom endpoint is required for custom provider' });
        }
        // Auto-detect if this is an Ollama endpoint
        const isCustomOllama = customEndpoint.includes('ollama') || !activeApiKey;
        endpoint = `${customEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          ...(isCustomOllama ? {} : { 'Authorization': `Bearer ${activeApiKey}` })
        };
        requestBody = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(isCustomOllama ? { stream: false } : {})
        };
      } else {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeApiKey}`
        };
        requestBody = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`${activeProvider} API Error ${response.status}:`, error);
        
        // Parse error for better user feedback
        try {
          const errorData = JSON.parse(error);
          if (response.status === 400 && activeProvider === 'anthropic' && 
              errorData.error?.message?.includes('credit balance is too low')) {
            return res.status(400).json({ 
              error: 'Insufficient credits in your Anthropic account. Please add credits in your Anthropic console.' 
            });
          }
        } catch (parseError) {
          // Use original error if parsing fails
        }
        
        return res.status(response.status).json({ 
          error: `${activeProvider} API error: ${response.status}`,
          details: error
        });
      }

      const json = await response.json();
      
      // Parse response based on provider
      let responseText = '';
      if (activeProvider === 'anthropic') {
        responseText = json.content?.[0]?.text || '';
      } else {
        responseText = json.choices?.[0]?.message?.content || '';
      }
      
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('AI chat error:', error);
      
      // Handle Ollama and Kiteframe-specific connection errors
      if (req.body.provider === 'ollama' || req.body.provider === 'kiteframe') {
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
          const serviceName = req.body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
          return res.status(400).json({ 
            error: `${serviceName} service not available. ${req.body.provider === 'ollama' ? 'Please start Ollama locally with: ollama serve' : 'Please try again later or contact support.'}` 
          });
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const serviceName = req.body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
          return res.status(400).json({ 
            error: `Cannot connect to ${serviceName}. Make sure the service is running and accessible.` 
          });
        }
        const serviceName = req.body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
        return res.status(400).json({ 
          error: `${serviceName} connection failed. Ensure the service is running and accessible.` 
        });
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // AI Test endpoint - validate API key and model compatibility
  app.post('/api/ai/test', async (req, res) => {
    try {
      const { provider, model, apiKey, customEndpoint } = req.body;
      
      if (!apiKey && provider !== 'ollama') {
        return res.status(400).json({ error: 'API key is required for testing' });
      }

      // Clean and validate API key format - must be ASCII only (no emojis or special Unicode characters)
      // Skip validation for Ollama which doesn't need API keys
      let cleanApiKey = '';
      if (provider !== 'ollama' && apiKey) {
        cleanApiKey = apiKey.trim();
        console.log('API Key validation:', { 
          length: cleanApiKey.length, 
          firstChar: cleanApiKey.charCodeAt(0),
          lastChar: cleanApiKey.charCodeAt(cleanApiKey.length - 1),
          hasNonASCII: !/^[\x20-\x7E]*$/.test(cleanApiKey)
        });
        
        if (!/^[\x20-\x7E]*$/.test(cleanApiKey)) {
          return res.status(400).json({ 
            error: 'Invalid API key format. API keys should only contain standard ASCII characters (no emojis or special symbols). Please re-copy your API key.' 
          });
        }
      }

      // Additional provider-specific validation using cleaned key
      if (provider === 'openai' && !cleanApiKey.startsWith('sk-')) {
        return res.status(400).json({ 
          error: 'OpenAI API keys should start with "sk-"' 
        });
      }

      if (provider === 'anthropic' && !cleanApiKey.startsWith('sk-ant-')) {
        return res.status(400).json({ 
          error: 'Anthropic API keys should start with "sk-ant-"' 
        });
      }

      // Use cleaned API key for requests
      const finalApiKey = cleanApiKey;

      let testUrl: string;
      let headers: Record<string, string>;

      // Configure endpoints and headers based on provider
      switch (provider) {
        case 'openai':
          testUrl = 'https://api.openai.com/v1/chat/completions';
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalApiKey}`
          };
          break;
        case 'anthropic':
          testUrl = 'https://api.anthropic.com/v1/messages';
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': finalApiKey,
            'anthropic-version': '2023-06-01'
          };
          break;
        case 'ollama':
          const ollamaEndpoint = customEndpoint || 'http://localhost:11434';
          testUrl = `${ollamaEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
          headers = {
            'Content-Type': 'application/json'
            // Ollama doesn't require Authorization for local usage
          };
          break;
        case 'kiteframe':
          testUrl = 'https://driftline.replit.app/v1/chat/completions';
          headers = {
            'Content-Type': 'application/json'
            // Kiteframe managed service - no auth required
          };
          break;
        case 'custom':
          if (!customEndpoint) {
            return res.status(400).json({ error: 'Custom endpoint is required for custom provider' });
          }
          // Auto-detect if this is an Ollama endpoint by checking if it needs auth
          const isOllamaEndpoint = customEndpoint.includes('ollama') || !finalApiKey;
          testUrl = `${customEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
          headers = {
            'Content-Type': 'application/json',
            ...(isOllamaEndpoint ? {} : { 'Authorization': `Bearer ${finalApiKey}` })
          };
          break;
        default:
          return res.status(400).json({ error: 'Unsupported provider' });
      }

      // Make test request with provider-specific format
      let requestBody: any;
      if (provider === 'anthropic') {
        requestBody = {
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }]
        };
      } else if (provider === 'ollama') {
        requestBody = {
          model,
          messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }],
          max_tokens: 10,
          temperature: 0.1,
          stream: false
        };
      } else if (provider === 'kiteframe') {
        requestBody = {
          model,
          messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }],
          max_tokens: 10,
          temperature: 0.1,
          stream: false
        };
      } else {
        requestBody = {
          model,
          messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }],
          max_tokens: 10,
          temperature: 0.1
        };
      }

      const response = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`AI Test Error ${response.status} for ${provider}:`, error);
        
        let errorMessage = `API test failed (${response.status})`;
        
        // Try to parse the error response for more details
        try {
          const errorData = JSON.parse(error);
          
          if (response.status === 400) {
            // Handle specific 400 errors from providers
            if (provider === 'anthropic' && errorData.error?.message) {
              if (errorData.error.message.includes('credit balance is too low')) {
                errorMessage = 'Insufficient credits in your Anthropic account. Please add credits in your Anthropic console.';
              } else if (errorData.error.message.includes('invalid_request_error')) {
                errorMessage = `Anthropic API error: ${errorData.error.message}`;
              } else {
                errorMessage = `Bad request: ${errorData.error.message}`;
              }
            } else if (errorData.error?.message) {
              errorMessage = `Bad request: ${errorData.error.message}`;
            } else if (errorData.message) {
              errorMessage = `Bad request: ${errorData.message}`;
            }
          } else if (response.status === 401) {
            errorMessage = 'Invalid API key for ' + provider;
          } else if (response.status === 403) {
            errorMessage = `API key doesn't have access to ${model} on ${provider}`;
          } else if (response.status === 404) {
            errorMessage = `Model ${model} not found on ${provider}`;
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded - too many requests';
          } else if (errorData.error?.message) {
            errorMessage = `${provider} API error: ${errorData.error.message}`;
          } else if (errorData.message) {
            errorMessage = `${provider} API error: ${errorData.message}`;
          }
        } catch (parseError) {
          // If we can't parse the error, use status-based messages
          if (response.status === 401) {
            errorMessage = 'Invalid API key for ' + provider;
          } else if (response.status === 403) {
            errorMessage = `API key doesn't have access to ${model} on ${provider}`;
          } else if (response.status === 404) {
            errorMessage = `Model ${model} not found on ${provider}`;
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded';
          }
        }
        
        return res.status(response.status).json({ error: errorMessage });
      }

      const json = await response.json();
      let responseText = '';
      
      if (provider === 'anthropic') {
        responseText = json.content?.[0]?.text || '';
      } else {
        responseText = json.choices?.[0]?.message?.content || '';
      }

      res.json({ 
        success: true, 
        response: responseText,
        model,
        provider 
      });

    } catch (error: any) {
      console.error('AI test error:', error);
      
      // Handle Ollama and Kiteframe-specific connection errors
      if (req.body.provider === 'ollama' || req.body.provider === 'kiteframe') {
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
          const serviceName = req.body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
          return res.status(400).json({ 
            error: `${serviceName} service not available. ${req.body.provider === 'ollama' ? 'Please start Ollama with: ollama serve' : 'Please try again later or contact support.'}` 
          });
        }
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const serviceName = req.body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
          return res.status(400).json({ 
            error: `Cannot connect to ${serviceName}. Make sure it is running on the configured endpoint.` 
          });
        }
        const serviceName = req.body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
        return res.status(400).json({ 
          error: `${serviceName} connection failed. Ensure the service is running and accessible.` 
        });
      }
      
      // Handle specific Unicode/ByteString encoding errors
      if (error instanceof TypeError && error.message.includes('ByteString')) {
        return res.status(400).json({ 
          error: 'Invalid API key format. Please ensure your API key contains only standard ASCII characters. Try copying the key again or typing it manually.' 
        });
      }
      
      // Handle other fetch errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return res.status(400).json({ 
          error: 'Network error or invalid endpoint. Please check your API key and try again.' 
        });
      }
      
      res.status(500).json({ error: 'Internal server error during AI test' });
    }
  });

  // Workflow validation endpoint
  app.post('/api/workflow/validate', async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: 'No data provided for validation' });
      }

      let parsedData;
      try {
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (parseError) {
        return res.json({
          isValid: false,
          errors: ['Invalid JSON format. Please check syntax and structure.'],
          warnings: []
        });
      }

      const validationResult = validateWorkflowStructure(parsedData);
      res.json(validationResult);
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({ error: 'Internal server error during validation' });
    }
  });

  // AI-powered workflow correction endpoint
  app.post('/api/workflow/ai-correct', async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: 'OpenAI API key not configured' });
      }

      const { data, errors, warnings } = req.body;
      
      if (!data || !errors || !Array.isArray(errors)) {
        return res.status(400).json({ error: 'Invalid request data' });
      }

      // Prepare AI correction prompt
      const correctionPrompt = `You are a workflow data correction specialist. I have a KiteFrame workflow JSON that has validation errors. Please analyze and fix the issues while preserving the original intent.

Original Data:
${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}

Validation Errors:
${errors.map((err, i) => `${i + 1}. ${err}`).join('\n')}

Requirements:
1. Fix all structural issues (missing fields, invalid types, etc.)
2. Ensure nodes have valid IDs, types, positions, and data
3. Ensure edges have valid source/target references that exist in nodes
4. Add any missing required fields with sensible defaults
5. Preserve original node content and positioning where possible
6. Return only the corrected JSON structure, no explanation

Expected structure:
{
  "version": "1.0.0",
  "metadata": { "name": "string", "description": "string", "created": "ISO date", "nodeCount": number, "edgeCount": number },
  "nodes": [{ "id": "string", "type": "string", "position": {"x": number, "y": number}, "data": {"label": "string", "description": "string", "icon": "string", "iconColor": "string"}, "width": number, "height": number }],
  "edges": [{ "id": "string", "source": "string", "target": "string", "type": "string", "data": {"color": "string", "strokeWidth": number} }],
  "viewport": {"x": number, "y": number, "zoom": number}
}

Respond with only the corrected JSON data:`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: correctionPrompt }],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`OpenAI API Error ${response.status}:`, error);
        return res.status(response.status).json({ 
          error: `AI correction failed: ${response.status}`,
          details: error
        });
      }

      const aiResult = await response.json();
      const correctedDataText = aiResult.choices?.[0]?.message?.content || '';

      if (!correctedDataText) {
        return res.status(500).json({ error: 'No corrected data received from AI' });
      }

      // Parse the AI-corrected data
      let correctedData;
      try {
        // Extract JSON from AI response (in case there's extra text)
        const jsonMatch = correctedDataText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : correctedDataText;
        correctedData = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse AI corrected data:', parseError);
        return res.status(500).json({ error: 'AI returned invalid JSON data' });
      }

      // Validate the corrected data
      const finalValidation = validateWorkflowStructure(correctedData);
      
      if (finalValidation.isValid) {
        res.json({
          success: true,
          correctedData,
          warnings: finalValidation.warnings || []
        });
      } else {
        res.status(500).json({ 
          error: 'AI correction was unsuccessful',
          remainingErrors: finalValidation.errors
        });
      }

    } catch (error) {
      console.error('AI correction error:', error);
      res.status(500).json({ error: 'Internal server error during AI correction' });
    }
  });

  // Object storage routes for image uploads
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/images", async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.imageURL,
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
