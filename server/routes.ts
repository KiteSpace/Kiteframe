import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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
  // AI Chat endpoint - proxy requests to OpenAI with server-side API key
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('OPENAI_API_KEY environment variable not found');
        return res.status(401).json({ error: 'OpenAI API key not configured' });
      }
      
      // Log key info for debugging (don't log the actual key)
      console.log('API Key status:', {
        exists: !!apiKey,
        length: apiKey?.length,
        prefix: apiKey?.substring(0, 7) + '...'
      });

      const { model = 'gpt-4o', messages, temperature = 0.7, maxTokens = 1024 } = req.body;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`OpenAI API Error ${response.status}:`, error);
        return res.status(response.status).json({ 
          error: `OpenAI API error: ${response.status}`,
          details: error
        });
      }

      const json = await response.json();
      res.json({ text: json.choices?.[0]?.message?.content ?? '' });
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // AI Test endpoint - validate API key and model compatibility
  app.post('/api/ai/test', async (req, res) => {
    try {
      const { provider, model, apiKey, customEndpoint } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required for testing' });
      }

      let testUrl: string;
      let headers: Record<string, string>;

      // Configure endpoints and headers based on provider
      switch (provider) {
        case 'openai':
          testUrl = 'https://api.openai.com/v1/chat/completions';
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          };
          break;
        case 'anthropic':
          testUrl = 'https://api.anthropic.com/v1/messages';
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          };
          break;
        case 'custom':
          if (!customEndpoint) {
            return res.status(400).json({ error: 'Custom endpoint is required for custom provider' });
          }
          testUrl = `${customEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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
        if (response.status === 401) {
          errorMessage = 'Invalid API key for ' + provider;
        } else if (response.status === 403) {
          errorMessage = `API key doesn't have access to ${model} on ${provider}`;
        } else if (response.status === 404) {
          errorMessage = `Model ${model} not found on ${provider}`;
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded';
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

    } catch (error) {
      console.error('AI test error:', error);
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

  const httpServer = createServer(app);

  return httpServer;
}
