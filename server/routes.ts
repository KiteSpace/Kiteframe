import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // AI Chat endpoint - proxy requests to OpenAI with server-side API key
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: 'OpenAI API key not configured' });
      }

      const { model = 'gpt-5', messages, temperature = 0.7, maxTokens = 1024 } = req.body;

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
        return res.status(response.status).json({ error: `OpenAI API error: ${response.status}` });
      }

      const json = await response.json();
      res.json({ text: json.choices?.[0]?.message?.content ?? '' });
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
