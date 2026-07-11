import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { requireUSOnly } from "./middleware/regionLock";
import { seedFeatureFlags } from "./seedFeatureFlags";
import { storage } from "./storage";
import { creditService } from "./creditService";

const app = express();

app.set('trust proxy', 1);

const isDev = app.get("env") === "development";

// Security headers via Helmet — CSP is production-only (Vite dev server requires unsafe-inline)
app.use(helmet({
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://js.stripe.com",          // Stripe.js
        "https://*.replit.com",            // Replit CDN (auth widgets, assets)
        "'sha256-O+WhTQr0Wi4S217qJDCCjsXpTYoLh5WuHV/jsnKLSrE='", // Vite modulepreload polyfill (inline)
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",                 // Required for React style={} props
        "https://fonts.googleapis.com",   // Google Fonts stylesheet
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],  // Google Fonts files
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://lh3.googleusercontent.com",     // Google profile pictures
        "https://*.googleusercontent.com",        // Google avatar variants
        "https://avatars.githubusercontent.com",  // GitHub profile pictures
        "https://*.githubusercontent.com",         // GitHub raw assets
        "https://*.replit.com",                   // Replit avatars / CDN assets
        "https://figma-alpha-api.s3.us-west-2.amazonaws.com", // Figma exported frame images
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",         // Stripe API (Stripe.js calls)
        "https://js.stripe.com",          // Stripe.js internal requests
        "https://accounts.google.com",   // Google OAuth token endpoint
        "https://github.com",             // GitHub OAuth
        "https://api.github.com",         // GitHub user API (post-auth)
        "https://replit.com",             // Replit OIDC / auth
        "https://*.replit.com",           // Replit CDN / auth subdomains
      ],
      frameSrc: [
        "https://js.stripe.com",          // Stripe payment element iframes
        "https://hooks.stripe.com",       // Stripe 3DS iframes
        "https://accounts.google.com",   // Google OAuth popup
      ],
      frameAncestors: ["'none'"],         // Prevent clickjacking
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,         // 1 year
    includeSubDomains: true,
    preload: false,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,          // Allow Stripe iframes & third-party resources
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }, // Allow OAuth popups
}));

// Permissions-Policy — not part of Helmet defaults, set explicitly
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'Managed webhook for KiteAI Stripe sync',
      }
    );
    console.log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    console.log('Syncing Stripe data in background...');
    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: Error) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

// One-off correction list: users confirmed to have paid but whose tier was recorded as 'free'
// due to the empty-price-metadata bug. Applied eagerly on startup (before Stripe backfill).
const KNOWN_TIER_CORRECTIONS: { userId: string; correctTier: 'free' | 'advanced' | 'pro' }[] = [
  { userId: '98b5c1cb-a7cc-4abe-b0c1-ea1f8e3dd2a5', correctTier: 'pro' },
];

async function applyKnownTierCorrections() {
  for (const { userId, correctTier } of KNOWN_TIER_CORRECTIONS) {
    try {
      const user = await storage.getUser(userId);
      if (!user) continue;
      if (user.subscriptionTier === correctTier) {
        console.log(`[KnownFix] User ${userId} already at ${correctTier} — skipping`);
        continue;
      }
      await storage.updateUserSubscription(userId, {
        subscriptionTier: correctTier,
        subscriptionStatus: 'active',
      });
      await creditService.syncUserCreditsWithTier(userId, correctTier);
      console.log(`[KnownFix] Corrected user ${userId}: ${user.subscriptionTier} → ${correctTier}`);
    } catch (err) {
      console.error(`[KnownFix] Failed for user ${userId}:`, err);
    }
  }
}

// Kick off Stripe init in the background — do NOT await here so the server
// opens port 5000 immediately even if the DB is slow or temporarily unavailable.
applyKnownTierCorrections().catch((err) => console.error('[KnownFix] Startup correction failed:', err));
initStripe()
  .then(() => WebhookHandlers.fixMismatchedTiers())
  .catch((err) => console.error('Background Stripe init failed:', err));

// Hourly job: delete external_workflows rows whose expires_at is in the past.
// Run once eagerly on startup (to clear any rows that expired while the server
// was down), then repeat every hour.
async function runExternalWorkflowExpiry() {
  try {
    const deleted = await storage.deleteExpiredExternalWorkflows();
    if (deleted > 0) {
      log(`[expiry] Deleted ${deleted} expired external workflow(s)`);
    }
  } catch (err) {
    console.error('[expiry] Failed to delete expired external workflows:', err);
  }
}
runExternalWorkflowExpiry();
setInterval(runExternalWorkflowExpiry, 60 * 60 * 1000);

app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

// Apply geo-blocking after Stripe webhook (which needs raw body) but before other routes
// Blocks non-US IPs with 404 response. Set BYPASS_GEO_BLOCK=true in dev to disable.
app.use(requireUSOnly);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Seed feature flags in the background — non-blocking so port opens immediately
  seedFeatureFlags().catch((error) => console.error('Failed to seed feature flags:', error));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // Cache-control: hashed assets live forever; HTML must never be cached
    // so browsers always fetch fresh chunk references after a new deployment.
    app.use((req, res, next) => {
      if (req.path.startsWith('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      next();
    });
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
