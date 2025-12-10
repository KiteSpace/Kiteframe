import type { Express, Request, Response } from "express";
import { z } from "zod";

const figmaProxySchema = z.object({
  path: z.string().min(1),
  usePat: z.boolean().optional(),
  patToken: z.string().optional().nullable(),
});

declare module 'express-session' {
  interface SessionData {
    figmaAccessToken?: string;
    figmaRefreshToken?: string;
    figmaTokenExpiresAt?: number;
    figmaOAuthState?: string;
    figmaUserId?: string;
  }
}

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID?.trim();
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET?.trim();
const FIGMA_SCOPES = 'file_read file_images';

function getRedirectUri(req: Request): string {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}/api/figma/callback`;
}

async function refreshAccessToken(session: Express.Request['session']): Promise<boolean> {
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET || !session?.figmaRefreshToken) {
    return false;
  }

  try {
    console.log('[Figma OAuth] Attempting token refresh...');
    const response = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: session.figmaRefreshToken,
      }),
    });

    if (!response.ok) {
      console.error('[Figma OAuth] Token refresh failed:', await response.text());
      return false;
    }

    const tokenData = await response.json();
    session.figmaAccessToken = tokenData.access_token;
    if (tokenData.refresh_token) {
      session.figmaRefreshToken = tokenData.refresh_token;
    }
    session.figmaTokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);
    
    console.log('[Figma OAuth] Token refreshed successfully');
    return true;
  } catch (err) {
    console.error('[Figma OAuth] Token refresh error:', err);
    return false;
  }
}

export function registerFigmaRoutes(app: Express) {
  app.post('/api/figma/proxy', async (req, res) => {
    try {
      const parsed = figmaProxySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
      }

      const { path, usePat, patToken } = parsed.data;

      let accessToken: string | undefined;

      if (usePat && patToken) {
        accessToken = patToken;
      } else if (req.session?.figmaAccessToken) {
        if (req.session.figmaTokenExpiresAt && Date.now() > req.session.figmaTokenExpiresAt) {
          const refreshed = await refreshAccessToken(req.session);
          if (!refreshed) {
            delete req.session.figmaAccessToken;
            delete req.session.figmaRefreshToken;
            delete req.session.figmaTokenExpiresAt;
            return res.status(401).json({ error: 'OAuth token expired and refresh failed. Please reconnect.' });
          }
        }
        accessToken = req.session.figmaAccessToken;
      }

      if (!accessToken) {
        return res.status(401).json({ 
          error: 'No authentication available. Please provide a Personal Access Token or connect via OAuth.' 
        });
      }

      const figmaUrl = `https://api.figma.com/v1/${path}`;
      
      console.log(`[Figma Proxy] Fetching: ${figmaUrl}`);

      const response = await fetch(figmaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
    
    console.log(`[Figma OAuth] Starting auth flow with client_id: ${FIGMA_CLIENT_ID?.substring(0, 8)}...`);
    console.log(`[Figma OAuth] Redirect URI: ${redirectUri}`);
    console.log(`[Figma OAuth] Scopes: ${FIGMA_SCOPES}`);
    
    const authUrl = new URL('https://www.figma.com/oauth');
    authUrl.searchParams.set('client_id', FIGMA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', FIGMA_SCOPES);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    console.log(`[Figma OAuth] Auth URL: ${authUrl.toString()}`);
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
      console.log('[Figma OAuth] Exchanging code for tokens...');
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
      req.session.figmaRefreshToken = tokenData.refresh_token;
      req.session.figmaTokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);
      req.session.figmaUserId = tokenData.user_id;

      delete req.session.figmaOAuthState;

      console.log('[Figma OAuth] Successfully connected');
      res.redirect('/?figma_connected=true');
    } catch (err) {
      console.error('[Figma OAuth] Callback error:', err);
      res.redirect('/?figma_error=callback_failed');
    }
  });

  app.post('/api/figma/refresh', async (req: Request, res: Response) => {
    if (!req.session?.figmaRefreshToken) {
      return res.status(400).json({ error: 'No refresh token available' });
    }

    const success = await refreshAccessToken(req.session);
    if (success) {
      res.json({ 
        success: true, 
        expiresAt: req.session.figmaTokenExpiresAt 
      });
    } else {
      res.status(401).json({ error: 'Token refresh failed. Please reconnect.' });
    }
  });

  app.get('/api/figma/status', async (req: Request, res: Response) => {
    const hasOAuthToken = !!req.session?.figmaAccessToken;
    const hasRefreshToken = !!req.session?.figmaRefreshToken;
    const tokenExpired = req.session?.figmaTokenExpiresAt 
      ? Date.now() > req.session.figmaTokenExpiresAt 
      : false;
    const oauthAvailable = !!FIGMA_CLIENT_ID && !!FIGMA_CLIENT_SECRET;

    if (hasOAuthToken && tokenExpired && hasRefreshToken) {
      const refreshed = await refreshAccessToken(req.session);
      if (refreshed) {
        return res.json({
          connected: true,
          oauthAvailable,
          expiresAt: req.session.figmaTokenExpiresAt,
          message: 'Connected via OAuth (token refreshed)'
        });
      }
    }

    res.json({ 
      connected: hasOAuthToken && !tokenExpired,
      oauthAvailable,
      expiresAt: req.session?.figmaTokenExpiresAt || null,
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
      delete req.session.figmaRefreshToken;
      delete req.session.figmaTokenExpiresAt;
      delete req.session.figmaOAuthState;
      delete req.session.figmaUserId;
    }
    res.json({ success: true, message: 'Disconnected from Figma' });
  });
}
