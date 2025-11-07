import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { db } from "./db";
import { 
  workflowSnapshots, 
  collaborationRooms, 
  roomParticipants, 
  chatMessages, 
  workflowComments 
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { handleBugReport } from "./bug-report";
import { requireUSOnly } from "./middleware/regionLock";
import { requireCredits } from "./middleware/creditCheck";
import { creditService } from "./creditService";

// Workflow validation utility
function validateWorkflowStructure(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic structure
  if (!data || typeof data !== 'object') {
    errors.push('Root data must be an object');
    return { isValid: false, errors, warnings };
  }

  // Helper function to extract nodes/edges/canvasObjects/viewport from various formats
  const extractWorkflowData = (data: any) => {
    const paths = [
      // Comprehensive format variations
      { 
        nodes: data.canvas?.nodes, 
        edges: data.canvas?.edges, 
        canvasObjects: data.canvas?.canvasObjects,
        viewport: data.canvas?.viewport, 
        type: 'comprehensive' 
      },
      { 
        nodes: data.workflow?.canvas?.nodes, 
        edges: data.workflow?.canvas?.edges, 
        canvasObjects: data.workflow?.canvas?.canvasObjects,
        viewport: data.workflow?.canvas?.viewport, 
        type: 'workflow.canvas' 
      },
      { 
        nodes: data.flow?.nodes, 
        edges: data.flow?.edges, 
        canvasObjects: data.flow?.canvasObjects,
        viewport: data.flow?.viewport, 
        type: 'flow' 
      },
      // Legacy format
      { 
        nodes: data.nodes, 
        edges: data.edges, 
        canvasObjects: data.canvasObjects,
        viewport: data.viewport, 
        type: 'legacy' 
      }
    ];
    
    for (const path of paths) {
      if (Array.isArray(path.nodes) || Array.isArray(path.edges) || Array.isArray(path.canvasObjects)) {
        return {
          nodes: path.nodes || [],
          edges: path.edges || [],
          canvasObjects: path.canvasObjects || [],
          viewport: path.viewport,
          format: path.type
        };
      }
    }
    
    // Fallback to empty arrays
    return {
      nodes: [],
      edges: [],
      canvasObjects: [],
      viewport: null,
      format: 'unknown'
    };
  };

  const extracted = extractWorkflowData(data);
  const { nodes, edges, canvasObjects, viewport, format } = extracted;
  
  // Format-specific metadata validation
  if (format === 'comprehensive' || format === 'workflow.canvas') {
    if (!data.workflow || typeof data.workflow !== 'object') {
      warnings.push('Missing or invalid workflow metadata, will use defaults');
    }
  } else if (format === 'legacy') {
    if (!data.version) {
      warnings.push('Missing version field, will default to 1.0.0');
    }
    if (!data.metadata || typeof data.metadata !== 'object') {
      warnings.push('Missing or invalid metadata, will use defaults');
    }
  } else if (format === 'unknown') {
    warnings.push('Unknown workflow format, attempting to validate anyway');
  }

  // Check nodes array
  if (!Array.isArray(nodes)) {
    errors.push('Nodes must be an array');
  } else {
    const nodeIds = new Set<string>();
    nodes.forEach((node: any, index: number) => {
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
  if (!Array.isArray(edges)) {
    errors.push('Edges must be an array');
  } else {
    const nodeIds = new Set(nodes.map((n: any) => n.id) || []);
    edges.forEach((edge: any, index: number) => {
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

  // Check canvasObjects array
  if (!Array.isArray(canvasObjects)) {
    // CanvasObjects is optional, so we don't error if it's missing
    if (canvasObjects !== undefined) {
      errors.push('Canvas objects must be an array');
    }
  } else {
    const objectIds = new Set<string>();
    canvasObjects.forEach((obj: any, index: number) => {
      if (!obj.id) {
        errors.push(`Canvas object at index ${index} is missing required 'id' field`);
      } else if (objectIds.has(obj.id)) {
        errors.push(`Duplicate canvas object ID found: ${obj.id}`);
      } else {
        objectIds.add(obj.id);
      }

      if (!obj.type) {
        errors.push(`Canvas object ${obj.id || index} is missing required 'type' field`);
      } else if (!['text', 'shape', 'sticky', 'group'].includes(obj.type)) {
        errors.push(`Canvas object ${obj.id || index} has invalid type: ${obj.type}`);
      }

      if (!obj.position || typeof obj.position !== 'object' || 
          typeof obj.position.x !== 'number' || typeof obj.position.y !== 'number') {
        errors.push(`Canvas object ${obj.id || index} has invalid position data`);
      }

      if (!obj.data || typeof obj.data !== 'object') {
        warnings.push(`Canvas object ${obj.id || index} missing data object, will use defaults`);
      }
    });
  }

  // Check viewport
  if (!viewport || typeof viewport !== 'object') {
    warnings.push('Missing viewport data, will use defaults');
  } else {
    if (typeof viewport.x !== 'number' || typeof viewport.y !== 'number' || 
        typeof viewport.zoom !== 'number') {
      warnings.push('Invalid viewport data, will use defaults');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Chat endpoint - proxy for AI models with dynamic provider routing
  app.post('/api/ai/chat', requireUSOnly, requireCredits, async (req, res) => {
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
      
      // Set API keys from environment for server-side requests (not for Ollama or Kiteframe which don't need them)
      if (activeProvider === 'openai') {
        activeApiKey = process.env.OPENAI_API_KEY; // Always use environment key for OpenAI
      } else if (activeProvider === 'anthropic') {
        activeApiKey = activeApiKey || process.env.ANTHROPIC_API_KEY; // Use client key or fallback to environment
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
        keyPrefix: activeApiKey ? activeApiKey.substring(0, 7) + '...' : 'none'
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
        // KitelineAI managed Ollama service
        endpoint = 'https://kiteline-ai.replit.app/v1/chat/completions';
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
        // Auto-detect if this is an Ollama endpoint or OpenAI endpoint
        const isCustomOllama = customEndpoint.includes('ollama') || !activeApiKey;
        const isCustomOpenAI = customEndpoint.includes('api.openai.com');
        const isGpt5Model = model && (model.includes('gpt-5') || model.startsWith('gpt-5'));
        
        endpoint = `${customEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          ...(isCustomOllama ? {} : { 'Authorization': `Bearer ${activeApiKey}` })
        };
        
        if (isCustomOpenAI && isGpt5Model) {
          // Use GPT-5 compatible parameters for custom OpenAI endpoints
          requestBody = {
            model,
            messages,
            max_completion_tokens: maxTokens
          };
        } else {
          requestBody = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(isCustomOllama ? { stream: false } : {})
          };
        }
      } else {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeApiKey}`
        };
        
        // GPT-5 models require different parameters
        const isGpt5Model = model && (model.includes('gpt-5') || model.startsWith('gpt-5'));
        requestBody = {
          model,
          messages,
          ...(isGpt5Model ? {
            max_completion_tokens: maxTokens
            // GPT-5 doesn't support temperature parameter
          } : {
            temperature,
            max_tokens: maxTokens
          })
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
      const { provider, apiKey, customEndpoint } = req.body;
      
      // Set default models for each provider
      let model = req.body.model;
      console.log('Test model received:', { model, type: typeof model, provider });
      
      if (!model || model === 'undefined' || model === 'null' || (typeof model === 'string' && model.trim() === '')) {
        console.log('Setting default model for provider:', provider);
        switch (provider) {
          case 'openai':
            model = 'gpt-5-nano';
            break;
          case 'kiteframe':
            model = 'llama3.2:3b';
            break;
          case 'anthropic':
            model = 'claude-3-5-sonnet-20241022';
            break;
          case 'ollama':
            model = 'llama3.2:3b'; // Default Ollama model
            break;
          default:
            model = 'gpt-5-nano';
        }
        console.log('Default model set to:', model);
      }
      
      // For OpenAI, always use environment key. For others, require API key unless it's ollama/kiteframe
      let finalApiKey = apiKey;
      if (provider === 'openai') {
        finalApiKey = process.env.OPENAI_API_KEY;
        if (!finalApiKey) {
          return res.status(500).json({ error: 'OpenAI API key not configured on server' });
        }
      } else if (!finalApiKey && provider !== 'ollama' && provider !== 'kiteframe') {
        return res.status(400).json({ error: 'API key is required for testing' });
      }

      // Clean and validate API key format - must be ASCII only (no emojis or special Unicode characters)
      // Skip validation for Ollama and Kiteframe which don't need API keys
      let cleanApiKey = '';
      if (provider !== 'ollama' && provider !== 'kiteframe' && finalApiKey) {
        cleanApiKey = finalApiKey.trim();
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
      if (provider === 'openai' && cleanApiKey && !cleanApiKey.startsWith('sk-')) {
        return res.status(400).json({ 
          error: 'OpenAI API keys should start with "sk-"' 
        });
      }

      if (provider === 'anthropic' && cleanApiKey && !cleanApiKey.startsWith('sk-ant-')) {
        return res.status(400).json({ 
          error: 'Anthropic API keys should start with "sk-ant-"' 
        });
      }

      // Use cleaned API key for requests (or already set environment key for OpenAI)
      const testApiKey = cleanApiKey || finalApiKey;

      let testUrl: string;
      let headers: Record<string, string>;

      // Configure endpoints and headers based on provider
      switch (provider) {
        case 'openai':
          testUrl = 'https://api.openai.com/v1/chat/completions';
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testApiKey}`
          };
          break;
        case 'anthropic':
          testUrl = 'https://api.anthropic.com/v1/messages';
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': testApiKey,
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
          testUrl = 'https://kiteline-ai.replit.app/v1/chat/completions';
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
        // For KitelineAI, first check if model is available and load if needed
        console.log('KitelineAI model check for:', model);
        try {
          const tagsResponse = await fetch('https://kiteline-ai.replit.app/api/tags');
          const tagsData = await tagsResponse.json();
          const availableModels = tagsData.models?.map((m: any) => m.name) || [];
          console.log('Available KitelineAI models:', availableModels);
          
          if (!availableModels.includes(model)) {
            return res.status(404).json({ 
              error: `Model ${model} not available on KitelineAI. Available models: ${availableModels.join(', ')}` 
            });
          }
        } catch (tagsError) {
          console.warn('Could not check KitelineAI model availability:', tagsError);
        }
        
        requestBody = {
          model,
          messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }],
          max_tokens: 10,
          temperature: 0.1,
          stream: false
        };
      } else {
        // Handle GPT-5 models with different parameters
        const isGpt5Model = model && (model.includes('gpt-5') || model.startsWith('gpt-5'));
        const isCustomOpenAI = provider === 'custom' && customEndpoint && customEndpoint.includes('api.openai.com');
        const needsGpt5Params = (provider === 'openai' || isCustomOpenAI) && isGpt5Model;
        
        if (needsGpt5Params) {
          requestBody = {
            model,
            messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }],
            max_completion_tokens: 10
            // GPT-5 doesn't support temperature parameter
          };
        } else {
          requestBody = {
            model,
            messages: [{ role: 'user', content: 'Reply with just "Hello!" to test.' }],
            max_tokens: 10,
            temperature: 0.1
          };
        }
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
          model: 'gpt-5-nano',
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

  // Pro Plugin API Routes

  // Workflow Snapshots API (Version Control Pro)
  app.post('/api/snapshots', async (req, res) => {
    try {
      const { workflowId, name, description, nodes, edges, metadata, isAutoSave } = req.body;
      
      const snapshot = await db.insert(workflowSnapshots).values({
        workflowId,
        name,
        description,
        nodes,
        edges,
        metadata,
        isAutoSave: isAutoSave || false
      }).returning();

      res.json(snapshot[0]);
    } catch (error) {
      console.error('Snapshot creation error:', error);
      res.status(500).json({ error: 'Failed to create snapshot' });
    }
  });

  app.get('/api/snapshots/:workflowId', async (req, res) => {
    try {
      const { workflowId } = req.params;
      
      const snapshots = await db
        .select()
        .from(workflowSnapshots)
        .where(eq(workflowSnapshots.workflowId, workflowId))
        .orderBy(desc(workflowSnapshots.createdAt));

      res.json(snapshots);
    } catch (error) {
      console.error('Snapshot fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
  });

  app.post('/api/snapshots/:id/restore', async (req, res) => {
    try {
      const { id } = req.params;
      
      const snapshot = await db
        .select()
        .from(workflowSnapshots)
        .where(eq(workflowSnapshots.id, id));

      if (snapshot.length === 0) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }

      res.json(snapshot[0]);
    } catch (error) {
      console.error('Snapshot restore error:', error);
      res.status(500).json({ error: 'Failed to restore snapshot' });
    }
  });

  // Collaboration Rooms API (Collaboration Pro)
  app.post('/api/rooms', async (req, res) => {
    try {
      const { workflowId, name, description, isPrivate } = req.body;
      
      const room = await db.insert(collaborationRooms).values({
        workflowId,
        name,
        description,
        isPrivate: isPrivate || false
      }).returning();

      res.json(room[0]);
    } catch (error) {
      console.error('Room creation error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  app.post('/api/rooms/:id/join', async (req, res) => {
    try {
      const { id } = req.params;
      
      const room = await db
        .select()
        .from(collaborationRooms)
        .where(eq(collaborationRooms.id, id));

      if (room.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Add participant (in real implementation, get userId from authentication)
      // For now, we'll just return the room
      res.json(room[0]);
    } catch (error) {
      console.error('Room join error:', error);
      res.status(500).json({ error: 'Failed to join room' });
    }
  });

  // Chat Messages API (Collaboration Pro)
  app.post('/api/chat/messages', async (req, res) => {
    try {
      const { roomId, message, messageType, metadata } = req.body;
      
      const chatMessage = await db.insert(chatMessages).values({
        roomId,
        message,
        messageType: messageType || 'text',
        metadata
      }).returning();

      // In real implementation, broadcast via WebSocket
      res.json(chatMessage[0]);
    } catch (error) {
      console.error('Chat message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  app.get('/api/chat/messages/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.roomId, roomId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(50);

      res.json(messages);
    } catch (error) {
      console.error('Chat messages fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Workflow Comments API (Collaboration Pro)
  app.post('/api/comments', async (req, res) => {
    try {
      const { workflowId, roomId, nodeId, positionX, positionY, content } = req.body;
      
      const comment = await db.insert(workflowComments).values({
        workflowId,
        roomId,
        nodeId,
        positionX,
        positionY,
        content
      }).returning();

      // In real implementation, broadcast via WebSocket
      res.json(comment[0]);
    } catch (error) {
      console.error('Comment creation error:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  app.get('/api/comments/:workflowId', async (req, res) => {
    try {
      const { workflowId } = req.params;
      
      const comments = await db
        .select()
        .from(workflowComments)
        .where(eq(workflowComments.workflowId, workflowId))
        .orderBy(desc(workflowComments.createdAt));

      res.json(comments);
    } catch (error) {
      console.error('Comments fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // Configure multer for image upload
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
      }
      cb(null, true);
    },
  });

  // Bug Report endpoint
  app.post('/api/bug-report', handleBugReport);

  // SMTP Configuration info (GET)
  app.get('/api/smtp-config', (req, res) => {
    res.json({
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        hasPassword: !!process.env.SMTP_PASS
      }
    });
  });

  // SMTP Test endpoint to verify email credentials
  app.post('/api/test-smtp', async (req, res) => {
    try {
      const nodemailer = await import('nodemailer');
      
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // false for STARTTLS (port 587)
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Test the connection
      await transporter.verify();
      
      console.log('✅ SMTP connection test successful');
      res.json({
        success: true,
        message: 'SMTP credentials verified successfully',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER
        }
      });

    } catch (error: any) {
      console.error('❌ SMTP connection test failed:', error);
      res.status(500).json({
        success: false,
        error: 'SMTP authentication failed',
        details: error.message
      });
    }
  });

  // AI Image-to-Workflow Analysis endpoint
  app.post("/api/ai/analyze-workflow-image", requireUSOnly, requireCredits, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: "AI service is not available. Please check OpenAI API key configuration." 
        });
      }

      console.log('[Image Analysis] Processing workflow image:', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Convert image buffer to base64
      const base64Image = req.file.buffer.toString('base64');
      const imageDataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

      // Analyze image with GPT-4o Vision (GPT-5-nano doesn't support vision)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o", // GPT-5-nano doesn't support vision - using GPT-4o for image analysis
          messages: [
            {
              role: "system",
              content: `You are a workflow diagram analysis expert. Analyze hand-drawn or digital workflow diagrams and extract workflow elements in KiteFrame format.

IMPORTANT: Return ONLY valid JSON in this exact format:
{
  "confidence": 85,
  "analysis": "Description of what you see",
  "nodes": [
    {
      "id": "node-1",
      "type": "input",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Short Title",
        "description": "Detailed explanation of what this step does",
        "icon": "ArrowRight",
        "iconColor": "text-blue-500"
      },
      "width": 200,
      "height": 100
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "bezier",
      "animated": true,
      "style": {"strokeColor": "hsl(221.2, 83.2%, 53.3%)", "strokeWidth": 2},
      "markers": {"type": "arrow", "position": "end"}
    }
  ],
  "recommendations": ["suggestions for workflow improvement"]
}

Node types: "input", "process", "condition", "output", "ai", "image"
Icons by type: input=ArrowRight, process=Cog, condition=HelpCircle, output=ArrowLeft, ai=Bot, image=Image
Colors by type: input=text-blue-500, process=text-green-500, condition=text-yellow-500, output=text-red-500, ai=text-purple-500, image=text-green-500

!!!!! CRITICAL FIELD ASSIGNMENTS - DO NOT SWAP THESE !!!!!

"label" FIELD = SHORT TITLE (2-4 words maximum)
"description" FIELD = DETAILED EXPLANATION (full sentence)

MANDATORY EXAMPLES TO FOLLOW:
✓ CORRECT: "label": "Send Code", "description": "System sends verification code to user's phone"
✓ CORRECT: "label": "Enter Code", "description": "User types the received verification code"
✓ CORRECT: "label": "Validate", "description": "System checks if the entered code is correct"

✗ WRONG: "label": "System sends verification code to user's phone", "description": "Send Code"
✗ WRONG: "label": "User types the received verification code", "description": "Enter Code"

DO NOT PUT LONG SENTENCES IN THE "label" FIELD!
DO NOT PUT SHORT TITLES IN THE "description" FIELD!

Position nodes 250px apart. Use confidence 70+ only if you can clearly identify 3+ workflow elements.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this workflow diagram and extract the workflow structure. Focus on identifying nodes, connections, and text labels."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`OpenAI API Error ${response.status}:`, error);
        return res.status(500).json({ 
          error: "Failed to analyze image", 
          details: `OpenAI API error: ${response.status}` 
        });
      }

      const aiResult = await response.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || '{}';
      
      console.log('[Image Analysis] Raw AI response length:', rawContent.length);

      let analysisResult;
      try {
        analysisResult = JSON.parse(rawContent);
      } catch (parseError) {
        console.error('[Image Analysis] Failed to parse AI response:', parseError);
        return res.status(500).json({ 
          error: "Failed to analyze image", 
          details: "Invalid AI response format" 
        });
      }

      // Validate and normalize the response
      const confidence = Math.max(0, Math.min(100, analysisResult.confidence || 0));
      
      // Ensure nodes follow KiteFrame format
      if (analysisResult.nodes && Array.isArray(analysisResult.nodes)) {
        analysisResult.nodes = analysisResult.nodes.map((node: any, index: number) => ({
          id: node.id || `analyzed-node-${index + 1}`,
          type: node.type || 'process',
          position: node.position || { x: 100 + (index * 250), y: 100 },
          data: {
            label: node.data?.label || node.label || `Step ${index + 1}`,
            description: node.data?.description || node.description || '',
            icon: node.data?.icon || 'Cog',
            iconColor: node.data?.iconColor || 'text-green-500'
          },
          width: node.width || 200,
          height: node.height || 100,
          draggable: true,
          selectable: true
        }));
      }

      // Ensure edges follow KiteFrame format
      if (analysisResult.edges && Array.isArray(analysisResult.edges)) {
        analysisResult.edges = analysisResult.edges.map((edge: any, index: number) => ({
          id: edge.id || `analyzed-edge-${index + 1}`,
          source: edge.source,
          target: edge.target,
          type: edge.type || 'bezier',
          animated: edge.animated !== false,
          style: edge.style || {
            strokeColor: 'hsl(221.2, 83.2%, 53.3%)',
            strokeWidth: 2
          },
          markers: edge.markers || {
            type: 'arrow',
            position: 'end'
          }
        }));
      }

      console.log('[Image Analysis] Analysis completed:', {
        confidence: confidence,
        nodeCount: analysisResult.nodes?.length || 0,
        edgeCount: analysisResult.edges?.length || 0
      });

      res.json({
        success: true,
        confidence,
        canGenerate: confidence >= 70,
        analysis: analysisResult.analysis || '',
        nodes: analysisResult.nodes || [],
        edges: analysisResult.edges || [],
        recommendations: analysisResult.recommendations || [],
        metadata: {
          originalFileName: req.file.originalname,
          fileSize: req.file.size,
          analysisTimestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('[Image Analysis] Error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze workflow image', 
        details: error.message 
      });
    }
  });

  // Get remaining AI credits
  app.get('/api/credits', async (req, res) => {
    try {
      const userIdentifier = creditService.getUserIdentifier(req);
      const credits = await creditService.getRemainingCredits(userIdentifier);
      
      res.json({
        success: true,
        credits,
        userIdentifier,
      });
    } catch (error: any) {
      console.error('Get credits error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve credits',
        details: error.message 
      });
    }
  });

  // Redeem unlock code to get more AI credits
  app.post('/api/credits/redeem', async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ 
          error: 'Unlock code is required' 
        });
      }

      const userIdentifier = creditService.getUserIdentifier(req);
      const result = await creditService.redeemUnlockCode(code.trim(), userIdentifier);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          credits: result.credits,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
        });
      }
    } catch (error: any) {
      console.error('Redeem code error:', error);
      res.status(500).json({ 
        error: 'Failed to redeem unlock code',
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for real-time collaboration
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket, request) => {
    console.log('🔗 New WebSocket connection established');
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 WebSocket message received:', message);
        
        // Handle different message types
        switch (message.type) {
          case 'join_room':
            // Handle room join
            ws.send(JSON.stringify({
              type: 'room_joined',
              roomId: message.roomId
            }));
            break;
          case 'chat_message':
            // Broadcast chat message to all clients in room
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'chat_message',
                  message: message
                }));
              }
            });
            break;
          case 'cursor_update':
            // Broadcast cursor position to all clients in room
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'cursor_update',
                  cursor: message.cursor
                }));
              }
            });
            break;
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('🔗 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      message: 'Connected to collaboration server'
    }));
  });

  return httpServer;
}
