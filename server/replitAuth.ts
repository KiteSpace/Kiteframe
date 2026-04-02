import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { db } from "./db";
import { users, oauthProviders } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import { authRateLimiter } from "./middleware/rateLimiter";
import crypto from "crypto";

const handoffTokens = new Map<string, { user: any; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of handoffTokens.entries()) {
    if (data.expiresAt < now) handoffTokens.delete(token);
  }
}, 60_000);

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

export async function getBetaSlots(): Promise<{ count: number; cap: number | null; shouldAutoApprove: boolean }> {
  const capEnv = process.env.BETA_SIGNUP_CAP;
  const cap = capEnv ? parseInt(capEnv, 10) : null;

  const [{ value: betaCount }] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.isBeta, true));

  const shouldAutoApprove = cap !== null && !isNaN(cap) && betaCount < cap;
  return { count: betaCount, cap: cap && !isNaN(cap) ? cap : null, shouldAutoApprove };
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  // Always use secure cookies on Replit (HTTPS) or in production
  const isSecure = !!process.env.REPL_ID || process.env.NODE_ENV === 'production';
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  console.log('[SESSION] Cookie config:', { 
    secure: isSecure, 
    sameSite: 'lax', 
    NODE_ENV: process.env.NODE_ENV,
    REPL_ID: !!process.env.REPL_ID,
    REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  const replitProviderId = claims["sub"];
  const email = claims["email"];
  
  // First, check if this Replit provider ID is already linked to a user
  const existingProvider = await db.query.oauthProviders.findFirst({
    where: and(
      eq(oauthProviders.provider, 'replit'),
      eq(oauthProviders.providerId, replitProviderId)
    ),
  });

  let dbUser;

  if (existingProvider) {
    // Update last used and return the existing user
    await db.update(oauthProviders)
      .set({ lastUsedAt: new Date() })
      .where(eq(oauthProviders.id, existingProvider.id));

    dbUser = await db.query.users.findFirst({
      where: eq(users.id, existingProvider.userId),
    });
  } else {
    // Check if a user with this email already exists (e.g., CSV-imported)
    if (email) {
      dbUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }

    if (!dbUser) {
      // No existing user found — check beta cap before creating
      const betaSlots = await getBetaSlots();
      const autoApprove = betaSlots.shouldAutoApprove || isAdminEmail(email);
      const [newUser] = await db.insert(users).values({
        id: replitProviderId,
        email: email,
        firstName: claims["first_name"],
        lastName: claims["last_name"],
        profileImageUrl: claims["profile_image_url"],
        authProvider: 'replit',
        authProviderId: replitProviderId,
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        isBeta: autoApprove,
        waitlistRequestedAt: autoApprove ? null : new Date(),
      }).returning();
      if (autoApprove) {
        console.log(`[BETA] Auto-approved new user ${email} (${betaSlots.count + 1}/${betaSlots.cap ?? '∞'})`);
      }
      dbUser = newUser;
    } else {
      // Existing user found by email, update their profile info
      const updateData: any = {
        firstName: claims["first_name"] || dbUser.firstName,
        lastName: claims["last_name"] || dbUser.lastName,
        profileImageUrl: claims["profile_image_url"] || dbUser.profileImageUrl,
        authProvider: 'replit',
        authProviderId: replitProviderId,
        updatedAt: new Date(),
      };
      // Also add to waitlist if not already on waitlist and not beta
      if (!dbUser.waitlistRequestedAt && !dbUser.isBeta) {
        updateData.waitlistRequestedAt = new Date();
      }
      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, dbUser.id))
        .returning();
      dbUser = updatedUser;
    }

    // Link the Replit OAuth provider to the user
    await linkOAuthProvider(dbUser!.id, {
      provider: 'replit',
      providerId: replitProviderId,
      email: email,
      displayName: `${claims["first_name"] || ''} ${claims["last_name"] || ''}`.trim() || email,
      profileImageUrl: claims["profile_image_url"],
    });
  }
  
  return dbUser!;
}

type OAuthProfile = {
  provider: 'google' | 'github' | 'replit';
  providerId: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
};

async function linkOAuthProvider(userId: string, profile: OAuthProfile) {
  const existing = await db.query.oauthProviders.findFirst({
    where: and(
      eq(oauthProviders.userId, userId),
      eq(oauthProviders.provider, profile.provider)
    ),
  });

  if (!existing) {
    await db.insert(oauthProviders).values({
      userId,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      displayName: profile.displayName,
      profileImageUrl: profile.profileImageUrl,
    });
  } else {
    await db.update(oauthProviders)
      .set({ lastUsedAt: new Date() })
      .where(eq(oauthProviders.id, existing.id));
  }
}

async function findOrCreateUser(profile: OAuthProfile) {
  const existingProvider = await db.query.oauthProviders.findFirst({
    where: and(
      eq(oauthProviders.provider, profile.provider),
      eq(oauthProviders.providerId, profile.providerId)
    ),
  });

  if (existingProvider) {
    await db.update(oauthProviders)
      .set({ lastUsedAt: new Date() })
      .where(eq(oauthProviders.id, existingProvider.id));

    const user = await db.query.users.findFirst({
      where: eq(users.id, existingProvider.userId),
    });
    return user;
  }

  let user = null;
  if (profile.email) {
    user = await db.query.users.findFirst({
      where: eq(users.email, profile.email),
    });
  }

  if (!user) {
    // Check beta cap before creating
    const betaSlots = await getBetaSlots();
    const autoApprove = betaSlots.shouldAutoApprove || isAdminEmail(profile.email);
    const [newUser] = await db.insert(users).values({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImageUrl: profile.profileImageUrl,
      authProvider: profile.provider,
      authProviderId: profile.providerId,
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      isBeta: autoApprove,
      waitlistRequestedAt: autoApprove ? null : new Date(),
    }).returning();
    if (autoApprove) {
      console.log(`[BETA] Auto-approved new user ${profile.email} (${betaSlots.count + 1}/${betaSlots.cap ?? '∞'})`);
    }
    user = newUser;
  } else if (!user.waitlistRequestedAt && !user.isBeta) {
    await db.update(users)
      .set({ waitlistRequestedAt: new Date() })
      .where(eq(users.id, user.id));
    user = { ...user, waitlistRequestedAt: new Date() };
  }

  await linkOAuthProvider(user!.id, profile);
  return user;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    const dbUser = await upsertUser(claims);
    const isAdmin = isAdminEmail(dbUser.email);
    const user: any = { 
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
      subscriptionTier: dbUser.subscriptionTier,
      subscriptionStatus: dbUser.subscriptionStatus,
      isBeta: dbUser.isBeta,
      isAdmin,
    };
    updateUserSession(user, tokens);
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  // Get the Replit-controlled domain for OAuth callback
  // REPLIT_DEV_DOMAIN is available in development, REPLIT_DOMAINS in production
  const getReplitCallbackDomain = () => {
    // In production deployments, REPLIT_DOMAINS contains the replit.app domain
    // Format: "custom.domain.com,xxx.replit.app" or just "xxx.replit.app"
    const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
    const replitDomain = domains.find(d => d.includes('replit.app') || d.includes('replit.dev'));
    if (replitDomain) return replitDomain.trim();
    
    // Fallback to REPLIT_DEV_DOMAIN for development
    if (process.env.REPLIT_DEV_DOMAIN) {
      return process.env.REPLIT_DEV_DOMAIN;
    }
    
    return null;
  };

  const ensureStrategy = (domain: string) => {
    // Always use the Replit-controlled domain for callback URL
    // This is required because Replit's OIDC only accepts callbacks from registered domains
    const callbackDomain = getReplitCallbackDomain() || domain;
    const strategyName = `replitauth:${callbackDomain}`;
    
    console.log('[AUTH] ensureStrategy:', { 
      requestDomain: domain, 
      callbackDomain, 
      strategyName,
      REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
      REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
    });
    
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${callbackDomain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
    
    return strategyName;
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const oauthProfile: OAuthProfile = {
          provider: 'google',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          profileImageUrl: profile.photos?.[0]?.value,
        };
        const user = await findOrCreateUser(oauthProfile);
        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }));

    app.get('/api/auth/google',
      authRateLimiter,
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get('/api/auth/google/callback',
      authRateLimiter,
      passport.authenticate('google', { failureRedirect: '/?error=google_auth_failed' }),
      async (req, res) => {
        const user = req.user as any;
        const isAdmin = isAdminEmail(user?.email);
        const finalDestination = (user?.isBeta || isAdmin) ? '/app' : '/waitlist';
        const redirectTarget = `/auth-complete?redirect=${encodeURIComponent(finalDestination)}`;
        
        console.log('[AUTH] Google callback:', {
          userExists: !!user,
          userId: user?.id,
          email: user?.email,
          isBeta: user?.isBeta,
          isAdmin,
          sessionId: req.sessionID,
          isAuthenticated: req.isAuthenticated?.(),
          finalDestination,
          redirectTarget,
        });

        req.session.save((err) => {
          if (err) {
            console.error('[AUTH] Session save error:', err);
          }
          console.log('[AUTH] Google Set-Cookie:', res.getHeader('Set-Cookie'));
          const safeRedirect = JSON.stringify(redirectTarget);
          res.status(200).send(`
<!DOCTYPE html>
<html>
<head><title>Completing sign in...</title></head>
<body>
  <p>Completing sign in...</p>
  <script>
    setTimeout(function() {
      window.location.replace(${safeRedirect});
    }, 100);
  </script>
</body>
</html>
          `);
        });
      }
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: '/api/auth/github/callback',
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        // Try to get email from profile first
        let email = profile.emails?.[0]?.value;
        
        // If no email in profile, fetch from GitHub API
        if (!email && accessToken) {
          try {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Kiteframe-App'
              }
            });
            if (emailResponse.ok) {
              const emails = await emailResponse.json();
              // Find primary email, or first verified email, or any email
              const primaryEmail = emails.find((e: any) => e.primary && e.verified);
              const verifiedEmail = emails.find((e: any) => e.verified);
              const anyEmail = emails[0];
              email = primaryEmail?.email || verifiedEmail?.email || anyEmail?.email;
              console.log('[AUTH] GitHub fetched email from API:', email);
            }
          } catch (emailError) {
            console.error('[AUTH] Failed to fetch GitHub emails:', emailError);
          }
        }

        const oauthProfile: OAuthProfile = {
          provider: 'github',
          providerId: profile.id,
          email,
          displayName: profile.displayName || profile.username,
          profileImageUrl: profile.photos?.[0]?.value,
        };
        const user = await findOrCreateUser(oauthProfile);
        done(null, user);
      } catch (error) {
        done(error as Error);
      }
    }));

    app.get('/api/auth/github',
      authRateLimiter,
      passport.authenticate('github', { scope: ['user:email'] })
    );

    app.get('/api/auth/github/callback',
      authRateLimiter,
      passport.authenticate('github', { failureRedirect: '/?error=github_auth_failed' }),
      async (req, res) => {
        const user = req.user as any;
        const isAdmin = isAdminEmail(user?.email);
        const finalDestination = (user?.isBeta || isAdmin) ? '/app' : '/waitlist';
        const redirectTarget = `/auth-complete?redirect=${encodeURIComponent(finalDestination)}`;
        
        console.log('[AUTH] GitHub callback:', {
          userExists: !!user,
          userId: user?.id,
          email: user?.email,
          isBeta: user?.isBeta,
          isAdmin,
          sessionId: req.sessionID,
          isAuthenticated: req.isAuthenticated?.(),
          finalDestination,
          redirectTarget,
        });

        req.session.save((err) => {
          if (err) {
            console.error('[AUTH] Session save error:', err);
          }
          console.log('[AUTH] GitHub Set-Cookie:', res.getHeader('Set-Cookie'));
          const safeRedirect = JSON.stringify(redirectTarget);
          res.status(200).send(`
<!DOCTYPE html>
<html>
<head><title>Completing sign in...</title></head>
<body>
  <p>Completing sign in...</p>
  <script>
    setTimeout(function() {
      window.location.replace(${safeRedirect});
    }, 100);
  </script>
</body>
</html>
          `);
        });
      }
    );
  }

  app.get('/api/auth/providers', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = (req.user as any).id || (req.user as any).claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' });
    }

    const providers = await db.query.oauthProviders.findMany({
      where: eq(oauthProviders.userId, userId),
    });

    res.json({
      providers: providers.map(p => ({
        provider: p.provider,
        email: p.email,
        displayName: p.displayName,
        linkedAt: p.linkedAt,
      })),
    });
  });

  const isGoogleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const isGitHubEnabled = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

  console.log('[AUTH] Providers enabled:', {
    google: isGoogleEnabled,
    github: isGitHubEnabled,
    replit: true
  });

  app.get('/api/auth/available-providers', (req, res) => {
    const providers = ['replit'];
    if (isGoogleEnabled) {
      providers.push('google');
    }
    if (isGitHubEnabled) {
      providers.push('github');
    }
    res.json({ providers });
  });

  if (!isGoogleEnabled) {
    app.get('/api/auth/google', (req, res) => {
      res.status(404).json({ error: 'Google authentication is not configured' });
    });
    app.get('/api/auth/google/callback', (req, res) => {
      res.status(404).json({ error: 'Google authentication is not configured' });
    });
  }

  if (!isGitHubEnabled) {
    app.get('/api/auth/github', (req, res) => {
      res.status(404).json({ error: 'GitHub authentication is not configured' });
    });
    app.get('/api/auth/github/callback', (req, res) => {
      res.status(404).json({ error: 'GitHub authentication is not configured' });
    });
  }

  app.get("/api/login", authRateLimiter, (req, res, next) => {
    const strategyName = ensureStrategy(req.hostname);
    
    // Encode the origin domain in state so we can redirect back after OAuth
    // This is needed because Replit OAuth callback uses replit.app domain
    // but we want to redirect users back to their original domain (e.g., kiteframe.space)
    const originDomain = req.hostname;
    const stateData = Buffer.from(JSON.stringify({ originDomain })).toString('base64url');
    
    passport.authenticate(strategyName, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      state: stateData,
    })(req, res, next);
  });

  app.get("/api/callback", authRateLimiter, (req, res, next) => {
    const hostname = req.hostname;
    const strategyName = ensureStrategy(hostname);
    
    // Decode the origin domain from state parameter
    let originDomain = hostname; // fallback to callback domain
    try {
      const stateParam = req.query.state as string;
      if (stateParam) {
        const stateData = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
        if (stateData.originDomain) {
          originDomain = stateData.originDomain;
        }
      }
    } catch (e) {
      console.warn('[AUTH] Failed to parse state parameter:', e);
    }
    
    console.log('[AUTH] Replit callback started:', {
      hostname,
      originDomain,
      strategyName,
      protocol: req.protocol,
      originalUrl: req.originalUrl,
      query: req.query,
      sessionID: req.sessionID,
      REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
    });
    
    passport.authenticate(strategyName, {
      failureRedirect: "/api/login",
    }, (err: any, user: any, info: any) => {
      console.log('[AUTH] Replit authenticate result:', {
        hasError: !!err,
        error: err?.message || err,
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        info: info,
      });
      
      if (err) {
        console.error('[AUTH] Replit auth error:', err);
        return res.redirect(`https://${originDomain}/?error=replit_auth_error`);
      }
      if (!user) {
        console.error('[AUTH] Replit auth no user returned, info:', info);
        return res.redirect(`https://${originDomain}/?error=replit_auth_no_user`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[AUTH] Replit logIn error:', loginErr);
          return res.redirect(`https://${originDomain}/?error=replit_login_error`);
        }
        
        const isAdmin = isAdminEmail(user?.email);
        const finalDestination = (user?.isBeta || isAdmin) ? '/app' : '/waitlist';
        
        // Generate a single-use handoff token so the custom domain (kiteframe.space)
        // can establish its own session cookie via /api/auth/handoff.
        // This is required because the .replit.app session cookie is not sent to kiteframe.space.
        const handoffToken = crypto.randomBytes(32).toString('hex');
        handoffTokens.set(handoffToken, { user: req.user, expiresAt: Date.now() + 60_000 });
        
        const redirectTarget = `https://${originDomain}/auth-complete?token=${handoffToken}&redirect=${encodeURIComponent(finalDestination)}`;
        
        console.log('[AUTH] Replit callback success:', {
          userId: user?.id,
          email: user?.email,
          isBeta: user?.isBeta,
          isAdmin,
          originDomain,
          sessionId: req.sessionID,
          isAuthenticated: req.isAuthenticated?.(),
          finalDestination,
          redirectTarget,
        });
        
        // Save session explicitly and use HTML redirect like Google/GitHub
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[AUTH] Replit session save error:', saveErr);
          }
          console.log('[AUTH] Replit Set-Cookie:', res.getHeader('Set-Cookie'));
          const safeRedirect = JSON.stringify(redirectTarget);
          res.status(200).send(`
<!DOCTYPE html>
<html>
<head><title>Completing sign in...</title></head>
<body>
  <p>Completing sign in...</p>
  <script>
    setTimeout(function() {
      window.location.replace(${safeRedirect});
    }, 100);
  </script>
</body>
</html>
          `);
        });
      });
    })(req, res, next);
  });

  app.get("/api/auth/handoff", (req, res, next) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const entry = handoffTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      handoffTokens.delete(token);
      console.warn('[AUTH] Handoff token invalid or expired:', token?.slice(0, 8));
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    handoffTokens.delete(token);

    req.logIn(entry.user, (err) => {
      if (err) {
        console.error('[AUTH] Handoff logIn error:', err);
        return next(err);
      }
      req.session.save((saveErr) => {
        if (saveErr) console.error('[AUTH] Handoff session save error:', saveErr);
        console.log('[AUTH] Handoff success for user:', entry.user?.id, 'domain:', req.hostname);
        res.json({ success: true });
      });
    });
  });

  app.get("/api/logout", authRateLimiter, (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  console.log('[AUTH DEBUG] isAuthenticated check:', {
    url: req.url,
    hasCookie: Boolean(req.headers.cookie),
    sessionID: req.sessionID,
    hasSession: Boolean(req.session),
    hasUser: Boolean(user),
    isAuthenticatedFn: req.isAuthenticated?.(),
    userHasExpiresAt: Boolean(user?.expires_at),
    userHasId: Boolean(user?.id),
  });

  if (!req.isAuthenticated() || !user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // For Google/GitHub OAuth users, they don't have expires_at (no OIDC refresh)
  // Just check they have a valid user ID and allow through
  if (!user.expires_at) {
    if (user.id) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  // For Replit OIDC users, check token expiration
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
