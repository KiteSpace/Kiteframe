import type { Express, Request, Response } from "express";
import { z } from "zod";

const figmaProxySchema = z.object({
  path: z.string().min(1),
  patToken: z.string().optional(),
});

declare module 'express-session' {
  interface SessionData {
    figmaAccessToken?: string;
    figmaTokenExpiresAt?: number;
    figmaOAuthState?: string;
  }
}

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;

function getRedirectUri(req: Request): string {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}/api/figma/callback`;
}

export function registerFigmaRoutes(app: Express) {
  app.post('/api/figma/proxy', async (req, res) => {
    try {
      const parsed = figmaProxySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }

      const { path, patToken } = parsed.data;

      const accessToken = patToken || req.session?.figmaAccessToken;

      if (!accessToken) {
        return res.status(401).json({ 
          error: 'Figma access token required. Please provide a Personal Access Token or connect via OAuth.' 
        });
      }

      if (req.session?.figmaTokenExpiresAt && Date.now() > req.session.figmaTokenExpiresAt) {
        delete req.session.figmaAccessToken;
        delete req.session.figmaTokenExpiresAt;
        return res.status(401).json({ error: 'OAuth token expired. Please reconnect.' });
      }

      const figmaUrl = `https://api.figma.com/v1/${path}`;
      
      console.log(`[Figma Proxy] Fetching: ${figmaUrl}`);

      const response = await fetch(figmaUrl, {
        method: 'GET',
        headers: {
          'X-Figma-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Figma Proxy] Error ${response.status}: ${errorText}`);
        
        if (response.status === 403) {
          return res.status(403).json({ 
            error: 'Invalid or expired Figma token. Please verify your Personal Access Token or reconnect via OAuth.',
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

  app.get('/api/figma/auth', (req: Request, res: Response) => {
    if (!FIGMA_CLIENT_ID) {
      return res.status(503).json({ 
        error: 'Figma OAuth not configured. Please use a Personal Access Token instead.',
        oauthAvailable: false
      });
    }

    const redirectUri = getRedirectUri(req);
    const state = Math.random().toString(36).substring(7);
    
    req.session.figmaOAuthState = state;
    
    const authUrl = new URL('https://www.figma.com/oauth');
    authUrl.searchParams.set('client_id', FIGMA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'file_read');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    res.redirect(authUrl.toString());
  });

  app.get('/api/figma/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      console.error('[Figma OAuth] Error from Figma:', error);
      return res.redirect('/?figma_error=' + encodeURIComponent(String(error)));
    }

    if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) {
      return res.redirect('/?figma_error=oauth_not_configured');
    }

    if (state !== req.session.figmaOAuthState) {
      console.error('[Figma OAuth] State mismatch');
      return res.redirect('/?figma_error=state_mismatch');
    }

    const redirectUri = getRedirectUri(req);

    try {
      const tokenResponse = await fetch('https://www.figma.com/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: FIGMA_CLIENT_ID,
          client_secret: FIGMA_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code: String(code),
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[Figma OAuth] Token exchange failed:', errorText);
        return res.redirect('/?figma_error=token_exchange_failed');
      }

      const tokenData = await tokenResponse.json();
      
      req.session.figmaAccessToken = tokenData.access_token;
      req.session.figmaTokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);

      delete req.session.figmaOAuthState;

      console.log('[Figma OAuth] Successfully connected');
      res.redirect('/?figma_connected=true');
    } catch (err) {
      console.error('[Figma OAuth] Callback error:', err);
      res.redirect('/?figma_error=callback_failed');
    }
  });

  app.get('/api/figma/status', (req: Request, res: Response) => {
    const hasOAuthToken = !!req.session?.figmaAccessToken;
    const tokenExpired = req.session?.figmaTokenExpiresAt 
      ? Date.now() > req.session.figmaTokenExpiresAt 
      : false;
    const oauthAvailable = !!FIGMA_CLIENT_ID && !!FIGMA_CLIENT_SECRET;

    res.json({ 
      connected: hasOAuthToken && !tokenExpired,
      oauthAvailable,
      message: hasOAuthToken 
        ? (tokenExpired ? 'OAuth token expired. Please reconnect.' : 'Connected via OAuth')
        : (oauthAvailable 
            ? 'Not connected. Use OAuth or provide a Personal Access Token.'
            : 'OAuth not configured. Please use a Personal Access Token.')
    });
  });

  app.post('/api/figma/disconnect', (req: Request, res: Response) => {
    if (req.session) {
      delete req.session.figmaAccessToken;
      delete req.session.figmaTokenExpiresAt;
      delete req.session.figmaOAuthState;
    }
    res.json({ success: true, message: 'Disconnected from Figma' });
  });
}
