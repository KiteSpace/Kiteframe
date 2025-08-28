import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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

  const httpServer = createServer(app);

  return httpServer;
}
