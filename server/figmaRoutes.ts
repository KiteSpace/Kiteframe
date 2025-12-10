import type { Express } from "express";
import { z } from "zod";

const figmaProxySchema = z.object({
  path: z.string().min(1),
  patToken: z.string().optional(),
});

export function registerFigmaRoutes(app: Express) {
  app.post('/api/figma/proxy', async (req, res) => {
    try {
      const parsed = figmaProxySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }

      const { path, patToken } = parsed.data;

      if (!patToken) {
        return res.status(401).json({ error: 'Figma access token required. Please provide a Personal Access Token.' });
      }

      const figmaUrl = `https://api.figma.com/v1/${path}`;
      
      console.log(`[Figma Proxy] Fetching: ${figmaUrl}`);

      const response = await fetch(figmaUrl, {
        method: 'GET',
        headers: {
          'X-Figma-Token': patToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Figma Proxy] Error ${response.status}: ${errorText}`);
        
        if (response.status === 403) {
          return res.status(403).json({ 
            error: 'Invalid or expired Figma token. Please verify your Personal Access Token.',
            status: response.status 
          });
        }
        if (response.status === 404) {
          return res.status(404).json({ 
            error: 'Figma file not found. Check the URL or file permissions.',
            status: response.status 
          });
        }
        
        return res.status(response.status).json({ 
          error: 'Failed to fetch from Figma API', 
          status: response.status,
          details: errorText
        });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('[Figma Proxy] Error:', error);
      res.status(500).json({ error: 'Internal server error while fetching from Figma' });
    }
  });

  app.get('/api/figma/status', (req, res) => {
    res.json({ connected: false, message: 'OAuth not implemented. Please use a Personal Access Token.' });
  });
}
