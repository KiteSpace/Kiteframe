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
  workflowComments,
  savedProjects,
  projectFolders,
  userGroups,
  userGroupMemberships,
  users,
  oauthProviders,
  groupAccessControlsSchema,
  userCredits,
  pageViews,
  docAccessGrants,
} from "@shared/schema";
import crypto from 'crypto';
import { eq, desc, and, or, isNotNull, isNull, sql, ilike, gte, lte } from "drizzle-orm";
import { handleBugReport } from "./bug-report";
import { requireUSOnly } from "./middleware/regionLock";
import { requireCredits, requireAdvancedOrPro, getUserGroupAccessControls } from "./middleware/creditCheck";
import { creditService } from "./creditService";
import { requireAdminAuth, adminLogin, adminLogout, refreshAdminSession } from "./middleware/adminAuth";
import { logBetaAction, logCodeAction } from "./middleware/auditLog";
import { requireHttps } from "./middleware/httpsEnforce";
import { adminLoginRateLimiter } from "./middleware/rateLimiter";
import { unlockCodes } from "@shared/schema";
import { analyticsService } from "./analyticsService";
import { geolocationService } from "./geolocation";
import { setupAuth, isAuthenticated, getBetaSlots } from "./replitAuth";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { aiRateLimiter, authRateLimiter, projectRateLimiter, uploadRateLimiter, sensitiveRateLimiter, waitlistRateLimiter, creditUnlockRateLimiter, chatRateLimiter } from "./middleware/rateLimiter";
import { csrfProtection } from "./middleware/csrf";
import { logAiUsage, getUserUsageSummary, getUserUsageTimeSeries, getUserUsageEvents, type UsageLogParams } from "./aiUsageService";
import { sendBetaApprovalEmail, sendContactEmail, sendDocsAccessEmail } from "./emailService";
import { sanitizeAiPrompt, sanitizeAiResponse, sanitizeWorkflowContent, sanitizeText, sanitizeNodeLabel } from "./utils/sanitize";
import { z } from "zod";
import { registerFigmaRoutes } from "./figmaRoutes";
import { registerFeatureFlagRoutes } from "./featureFlagRoutes";
import { verifyFirebaseIdToken, initializeFirebaseAdmin, isAdminSdkAvailable, getInitializationError } from "./firebaseAdmin";

// Initialize Firebase Admin on module load
initializeFirebaseAdmin();

// Admin email check helper - checks if user email is in ADMIN_EMAILS list
function isAdminUser(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(email.toLowerCase());
}

// Helper to get user ID from either OIDC (claims.sub) or OAuth (id) users
// Should only be called behind isAuthenticated middleware
function getUserIdFromRequest(user: any): string {
  // OIDC users (Replit) have claims.sub
  if (user?.claims?.sub) return user.claims.sub;
  // OAuth users (Google, GitHub) have id directly
  if (user?.id) return user.id;
  throw new Error('Unable to extract user ID from request - invalid user object');
}

// Sanitize user data for API responses - removes sensitive internal fields
function sanitizeUserForResponse(user: any, options?: { isAdmin?: boolean }) {
  if (!user) return null;
  
  // Fields safe to expose to the client
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    authProvider: user.authProvider,
    subscriptionTier: options?.isAdmin ? 'pro' : user.subscriptionTier,
    subscriptionStatus: options?.isAdmin ? 'active' : user.subscriptionStatus,
    billingPeriodEnd: user.billingPeriodEnd,
    isBeta: options?.isAdmin ? true : user.isBeta,
    betaGrantedAt: user.betaGrantedAt,
    waitlistRequestedAt: user.waitlistRequestedAt,
    waitlistRole: user.waitlistRole,
    createdAt: user.createdAt,
    ...(options?.isAdmin && { isAdmin: true, isUnlimited: true }),
  };
}

// Project limits per tier
const PROJECT_LIMITS = {
  free: 10,
  advanced: 50,
  pro: 100,
} as const;

// Check if user has cloud project access (all authenticated users can save projects)
async function hasCloudProjectAccess(user: { id?: string; subscriptionTier?: string | null; email?: string | null } | undefined): Promise<boolean> {
  if (!user) return false;
  return true;
}

function getProjectLimit(subscriptionTier: string | null | undefined): number {
  const tier = (subscriptionTier as keyof typeof PROJECT_LIMITS) || 'free';
  return PROJECT_LIMITS[tier] || PROJECT_LIMITS.free;
}

async function checkProjectLimit(userId: string, subscriptionTier: string | null | undefined): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  const projects = await storage.getSavedProjects(userId);
  const currentCount = projects.length;
  const limit = getProjectLimit(subscriptionTier);
  return {
    allowed: currentCount < limit,
    currentCount,
    limit,
  };
}

// Workflow validation utility
function validateWorkflowStructure(data: any): { isValid: boolean; errors: string[]; warnings: string[]; cleanedData?: any } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const orphanEdgeIds: Set<number> = new Set();

  // Check basic structure
  if (!data || typeof data !== 'object') {
    errors.push('Root data must be an object');
    return { isValid: false, errors, warnings };
  }

  // Helper function to extract nodes/edges/canvasObjects/viewport from various formats
  const extractWorkflowData = (data: any) => {
    // Check if this is an AssembledProjectPRD format (Kiteframe PRD JSON export)
    if (data.version && data.workflows && Array.isArray(data.workflows)) {
      const allNodes: any[] = [];
      const allEdges: any[] = [];
      const allCanvasObjects: any[] = [];
      
      for (const workflow of data.workflows) {
        if (workflow.canvas) {
          if (Array.isArray(workflow.canvas.nodes)) {
            allNodes.push(...workflow.canvas.nodes);
          }
          if (Array.isArray(workflow.canvas.edges)) {
            allEdges.push(...workflow.canvas.edges);
          }
          if (Array.isArray(workflow.canvas.canvasObjects)) {
            allCanvasObjects.push(...workflow.canvas.canvasObjects);
          }
        }
      }
      
      if (allNodes.length > 0 || allEdges.length > 0) {
        return {
          nodes: allNodes,
          edges: allEdges,
          canvasObjects: allCanvasObjects,
          viewport: null,
          format: 'assembled-project-prd'
        };
      }
    }
    
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
        nodes: data.workflow?.nodes, 
        edges: data.workflow?.edges, 
        canvasObjects: data.workflow?.canvasObjects,
        viewport: data.workflow?.viewport, 
        type: 'workflow' 
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
  if (format === 'assembled-project-prd') {
    // This is a Kiteframe PRD JSON export with embedded canvas data
    if (!data.project || typeof data.project !== 'object') {
      warnings.push('Missing project metadata, will use defaults');
    }
  } else if (format === 'comprehensive' || format === 'workflow.canvas' || format === 'workflow') {
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

      let isOrphan = false;
      
      if (!edge.source) {
        errors.push(`Edge at index ${index} missing required 'source' field`);
      } else if (!nodeIds.has(edge.source)) {
        // Orphan edge - source node doesn't exist
        warnings.push(`Edge ${edge.id || index} references non-existent source node: ${edge.source} (will be removed)`);
        isOrphan = true;
      }

      if (!edge.target) {
        errors.push(`Edge at index ${index} missing required 'target' field`);
      } else if (!nodeIds.has(edge.target)) {
        // Orphan edge - target node doesn't exist
        warnings.push(`Edge ${edge.id || index} references non-existent target node: ${edge.target} (will be removed)`);
        isOrphan = true;
      }

      if (isOrphan) {
        orphanEdgeIds.add(index);
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

  // Filter out orphan edges and include cleaned data in result
  const cleanedEdges = Array.isArray(edges) 
    ? edges.filter((_: any, index: number) => !orphanEdgeIds.has(index))
    : [];
  
  // Build cleaned data object that matches the original structure
  let cleanedData: any = undefined;
  if (orphanEdgeIds.size > 0) {
    // Deep clone the original data and replace edges with cleaned version
    cleanedData = JSON.parse(JSON.stringify(data));
    
    // Update edges in the appropriate location based on format
    if (format === 'assembled-project-prd' && cleanedData.workflows) {
      // Filter orphan edges from all workflows
      for (const workflow of cleanedData.workflows) {
        if (workflow.canvas?.edges) {
          const workflowNodeIds = new Set(workflow.canvas.nodes?.map((n: any) => n.id) || []);
          workflow.canvas.edges = workflow.canvas.edges.filter((edge: any) => 
            workflowNodeIds.has(edge.source) && workflowNodeIds.has(edge.target)
          );
        }
      }
    } else if (cleanedData.canvas?.edges) {
      cleanedData.canvas.edges = cleanedEdges;
    } else if (cleanedData.workflow?.canvas?.edges) {
      cleanedData.workflow.canvas.edges = cleanedEdges;
    } else if (cleanedData.workflow?.edges) {
      cleanedData.workflow.edges = cleanedEdges;
    } else if (cleanedData.flow?.edges) {
      cleanedData.flow.edges = cleanedEdges;
    } else if (cleanedData.edges) {
      cleanedData.edges = cleanedEdges;
    }
    
    warnings.push(`Automatically removed ${orphanEdgeIds.size} orphan edge(s) referencing non-existent nodes`);
  }

  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings,
    cleanedData
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  
  // Setup Figma API proxy routes
  registerFigmaRoutes(app);

  // Setup Feature Flag routes
  registerFeatureFlagRoutes(app);

  // Firebase auth sync endpoint - syncs Firebase auth to backend session
  app.post('/api/auth/firebase-sync', authRateLimiter, async (req: any, res) => {
    try {
      // Check if Firebase Admin SDK is properly configured
      if (!isAdminSdkAvailable()) {
        const error = getInitializationError() || 'Firebase Admin SDK not configured';
        console.warn('Firebase sync failed: Admin SDK not available');
        return res.status(503).json({ 
          error: 'Cloud project sync unavailable', 
          message: error,
          code: 'FIREBASE_ADMIN_NOT_CONFIGURED'
        });
      }
      
      const { idToken } = req.body;
      
      if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({ error: 'Firebase ID token is required' });
      }

      const decodedToken = await verifyFirebaseIdToken(idToken);
      
      if (!decodedToken) {
        return res.status(401).json({ error: 'Invalid or expired Firebase token' });
      }

      const { uid, email, name, picture } = decodedToken;
      
      // Find or create user in database
      let user = await storage.getUserByEmail(email || '');
      
      if (!user && email) {
        // Create new user from Firebase auth
        user = await storage.upsertUser({
          id: uid,
          email: email,
          firstName: name?.split(' ')[0] || null,
          lastName: name?.split(' ').slice(1).join(' ') || null,
          profileImageUrl: picture || null,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
        });
      } else if (user) {
        // Update existing user if needed
        user = await storage.upsertUser({
          id: user.id,
          email: user.email || email,
          firstName: user.firstName || name?.split(' ')[0] || null,
          lastName: user.lastName || name?.split(' ').slice(1).join(' ') || null,
          profileImageUrl: user.profileImageUrl || picture || null,
        });
      }

      if (!user) {
        return res.status(500).json({ error: 'Failed to create or find user' });
      }

      // Establish session by setting req.user with the same structure as Passport
      const sessionUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        claims: {
          sub: user.id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      // Use passport's login to establish session
      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error('Failed to establish session:', err);
          return res.status(500).json({ error: 'Failed to establish session' });
        }

        const isAdmin = isAdminUser(user!.email);
        
        res.json({
          success: true,
          user: {
            ...user,
            isAdmin,
            subscriptionTier: isAdmin ? 'pro' : user!.subscriptionTier,
            isUnlimited: isAdmin ? true : undefined,
          },
        });
      });
    } catch (error) {
      console.error('Firebase sync error:', error);
      res.status(500).json({ error: 'Failed to sync Firebase authentication' });
    }
  });

  // Firebase logout - clear backend session
  app.post('/api/auth/firebase-logout', async (req: any, res) => {
    try {
      req.logout((err: any) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ error: 'Failed to logout' });
        }
        req.session?.destroy((err: any) => {
          if (err) {
            console.error('Session destroy error:', err);
          }
          res.clearCookie('connect.sid');
          res.json({ success: true });
        });
      });
    } catch (error) {
      console.error('Firebase logout error:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  // General logout - clear backend session (used by AuthButton)
  app.post('/api/logout', async (req: any, res) => {
    try {
      req.logout((err: any) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ error: 'Failed to logout' });
        }
        req.session?.destroy((err: any) => {
          if (err) {
            console.error('Session destroy error:', err);
          }
          res.clearCookie('connect.sid');
          res.json({ success: true });
        });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.json(null);
      }
      
      // If user has no authProvider set, look it up from oauthProviders table
      let authProvider = user.authProvider;
      if (!authProvider) {
        const oauthProvider = await db.query.oauthProviders.findFirst({
          where: eq(oauthProviders.userId, user.id),
          orderBy: (oauthProviders, { desc }) => [desc(oauthProviders.lastUsedAt)],
        });
        if (oauthProvider) {
          authProvider = oauthProvider.provider;
        }
      }
      
      // Check if user is admin and sanitize response
      const isAdmin = isAdminUser(user.email);
      const responseUser = sanitizeUserForResponse({ ...user, authProvider }, { isAdmin });
      
      res.json(responseUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get Stripe publishable key
  app.get('/api/stripe/config', async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error('Error getting Stripe config:', error);
      res.status(500).json({ error: 'Stripe not configured' });
    }
  });

  // Get subscription status
  app.get('/api/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.json({ subscription: null, tier: 'free', isAdmin: false, trialEnd: null });
      }

      // Check if user is admin
      const isAdmin = isAdminUser(user.email);

      let subscription = null;
      if (user.stripeSubscriptionId) {
        subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
      }

      let trialEnd: string | null = null;
      if (subscription && subscription.status === 'trialing' && subscription.trial_end) {
        const trialEndTs = typeof subscription.trial_end === 'string'
          ? parseFloat(subscription.trial_end)
          : Number(subscription.trial_end);
        if (!isNaN(trialEndTs) && trialEndTs > 0) {
          trialEnd = new Date(trialEndTs * 1000).toISOString();
        }
      }

      res.json({ 
        subscription,
        tier: isAdmin ? 'pro' : (user.subscriptionTier || 'free'),
        status: isAdmin ? 'active' : (user.subscriptionStatus || 'active'),
        billingPeriodEnd: user.billingPeriodEnd,
        isAdmin,
        isUnlimited: isAdmin,
        trialEnd,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  // Create checkout session
  app.post('/api/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);
      const { priceId, trial } = req.body;

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (trial === true) {
        const price = await stripeService.getPrice(priceId);
        const priceMetadata = price?.metadata as Record<string, string> | null;
        if (priceMetadata?.tier !== 'advanced') {
          return res.status(400).json({ error: 'Trials are only available for the Advanced plan.' });
        }
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user.email || '',
          user.id,
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined
        );
        await storage.updateUserSubscription(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Trial duration is controlled via the Stripe Dashboard on the Price object.
      // Do not pass trial_period_days here — Stripe will apply whatever is configured
      // on the Price, which can be changed at any time without a code deploy.
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${req.protocol}://${req.get('host')}/checkout/success`,
        `${req.protocol}://${req.get('host')}/pricing`,
        'subscription'
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  // Customer portal for managing subscription
  app.post('/api/billing/portal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: 'No billing account found' });
      }

      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${req.protocol}://${req.get('host')}/account`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Portal error:', error);
      res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  // Verify a Google reCAPTCHA v3 token. Minimum score 0.5 (0=bot, 1=human).
  async function verifyRecaptchaToken(token: string, action?: string, ip?: string): Promise<boolean> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.warn('RECAPTCHA_SECRET_KEY not configured, skipping verification');
      return true;
    }

    try {
      const body = new URLSearchParams();
      body.append('secret', secretKey);
      body.append('response', token);
      if (ip) body.append('remoteip', ip);

      const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body,
      });

      const result = await res.json() as {
        success: boolean;
        score?: number;
        action?: string;
        'error-codes'?: string[];
      };

      if (!result.success) {
        console.warn('reCAPTCHA verification failed:', result['error-codes']);
        return false;
      }

      const score = result.score ?? 0;
      if (score < 0.5) {
        console.warn(`reCAPTCHA score too low: ${score}`);
        return false;
      }

      if (action && result.action && result.action !== action) {
        console.warn(`reCAPTCHA action mismatch: expected ${action}, got ${result.action}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      return false;
    }
  }

  // Waitlist endpoint - public, allows both authenticated and unauthenticated users
  app.post('/api/waitlist', csrfProtection, waitlistRateLimiter, async (req: any, res) => {
    try {
      const { email, role, useCase, recaptchaToken, hp } = req.body;

      // Honeypot check - if filled, delay and reject (bots fill hidden fields)
      if (hp) {
        console.log('Honeypot triggered, rejecting submission');
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Email length and character sanitization
      if (email.length > 254) {
        return res.status(400).json({ error: 'Email too long' });
      }

      // Verify reCAPTCHA token (strict enforcement when key is configured)
      if (process.env.RECAPTCHA_SECRET_KEY) {
        if (!recaptchaToken) {
          console.warn('reCAPTCHA token missing - possible bypass attempt');
          return res.status(400).json({ error: 'Security verification required. Please refresh the page and try again.' });
        }
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
        const isValid = await verifyRecaptchaToken(recaptchaToken, 'waitlist', clientIp);
        if (!isValid) {
          return res.status(400).json({ error: 'Security check failed. Please try again.' });
        }
      }

      // Validate role if provided
      const validRoles = ['pm', 'design', 'engineering', 'founder'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Sanitize useCase using proper sanitization utility
      const sanitizedUseCase = useCase ? sanitizeText(useCase).substring(0, 1000) : null;

      // Check if user already exists
      let user = await storage.getUserByEmail(email);
      
      if (user) {
        // Update existing user's waitlist fields
        await db.update(users).set({
          waitlistRequestedAt: new Date(),
          waitlistRole: role || user.waitlistRole,
          waitlistUseCase: sanitizedUseCase || user.waitlistUseCase,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
      } else {
        // Create new user with waitlist info
        const newUserId = crypto.randomUUID();
        await db.insert(users).values({
          id: newUserId,
          email,
          waitlistRequestedAt: new Date(),
          waitlistRole: role || null,
          waitlistUseCase: sanitizedUseCase || null,
          isBeta: false,
        });
      }

      console.log(`Waitlist signup: ${email}${role ? ` (${role})` : ''}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Waitlist error:', error);
      res.status(500).json({ error: 'Failed to join waitlist' });
    }
  });

  // Authenticated waitlist update - for users who are logged in but want to update their waitlist info
  app.post('/api/waitlist/update', csrfProtection, isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { role, useCase } = req.body;

      // Validate role if provided
      const validRoles = ['pm', 'design', 'engineering', 'founder'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      // Sanitize useCase using proper sanitization utility
      const sanitizedUseCase = useCase ? sanitizeText(useCase).substring(0, 1000) : null;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await db.update(users).set({
        waitlistRequestedAt: user.waitlistRequestedAt || new Date(),
        waitlistRole: role || user.waitlistRole,
        waitlistUseCase: sanitizedUseCase || user.waitlistUseCase,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      console.log(`Waitlist update for user ${userId}${role ? ` (${role})` : ''}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Waitlist update error:', error);
      res.status(500).json({ error: 'Failed to update waitlist info' });
    }
  });

  // Get products with prices for pricing page
  app.get('/api/products', async (req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices();
      
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
            metadata: row.price_metadata,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error('Products error:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Account deletion endpoint
  app.delete('/api/account', sensitiveRateLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Cancel Stripe subscription if exists
      if (user.stripeSubscriptionId) {
        try {
          await stripeService.cancelSubscription(user.stripeSubscriptionId);
        } catch (error) {
          console.error('Error canceling subscription:', error);
        }
      }

      // Invalidate ALL active sessions for this user across every browser/device
      // before deleting the user row, so they cannot continue using the app.
      await db.execute(
        sql`DELETE FROM sessions WHERE sess::jsonb -> 'passport' -> 'user' ->> 'id' = ${userId}`
      );

      // Delete all user data (projects, folders, credits, insight history, and user row)
      await storage.deleteUser(userId);

      // Destroy the current server-side session and clear the cookie
      req.logout(() => {
        res.json({ success: true, message: 'Account deleted successfully' });
      });
    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  // Saved Projects API (all authenticated users)
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);

      if (!(await hasCloudProjectAccess(user))) {
        return res.status(403).json({ error: 'Sign in required for cloud-saved projects' });
      }

      const projects = await storage.getSavedProjects(userId);
      const limit = getProjectLimit(user?.subscriptionTier);
      res.json({ projects, projectLimit: limit, projectCount: projects.length });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', projectRateLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);

      if (!(await hasCloudProjectAccess(user))) {
        return res.status(403).json({ error: 'Sign in required for cloud-saved projects' });
      }

      const projectLimit = await checkProjectLimit(userId, user?.subscriptionTier);
      if (!projectLimit.allowed) {
        return res.status(403).json({ 
          error: `Project limit reached (${projectLimit.currentCount}/${projectLimit.limit}). Upgrade your plan for more projects.`,
          currentCount: projectLimit.currentCount,
          limit: projectLimit.limit,
          limitReached: true,
        });
      }

      const { name, description, workflowData, thumbnail, folderId, tags, isPublic } = req.body;

      // Sanitize all input data
      const sanitizedName = sanitizeNodeLabel(name) || 'Untitled Project';
      const sanitizedDescription = sanitizeText(description);
      const sanitizedWorkflowData = workflowData ? sanitizeWorkflowContent(workflowData) : null;

      const project = await storage.createSavedProject({
        userId,
        name: sanitizedName,
        description: sanitizedDescription,
        workflowData: sanitizedWorkflowData,
        thumbnail,
        folderId,
        tags: (tags || []).map((t: string) => sanitizeText(t)).filter(Boolean),
        isPublic: isPublic || false,
      });

      res.json({ project });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { id } = req.params;

      const project = await storage.getSavedProject(id, userId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ project });
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  app.put('/api/projects/:id', projectRateLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);

      if (!(await hasCloudProjectAccess(user))) {
        return res.status(403).json({ error: 'Sign in required for cloud-saved projects' });
      }

      const { id } = req.params;
      const { name, description, workflowData, thumbnail, folderId, tags, isPublic } = req.body;

      console.log(`📝 [PROJECT UPDATE BY ID] Updating project ID: ${id}`);

      // Sanitize all input data
      const sanitizedName = name ? sanitizeNodeLabel(name) : undefined;
      const sanitizedDescription = description ? sanitizeText(description) : undefined;
      const sanitizedWorkflowData = workflowData ? sanitizeWorkflowContent(workflowData) : undefined;
      const sanitizedTags = tags ? (tags as string[]).map((t: string) => sanitizeText(t)).filter(Boolean) : undefined;

      const project = await storage.updateSavedProject(id, userId, {
        name: sanitizedName,
        description: sanitizedDescription,
        workflowData: sanitizedWorkflowData,
        thumbnail,
        folderId,
        tags: sanitizedTags,
        isPublic,
      });

      if (!project) {
        console.log(`📝 [PROJECT UPDATE BY ID] Project not found: ${id}`);
        return res.status(404).json({ error: 'Project not found' });
      }

      console.log(`📝 [PROJECT UPDATE BY ID] Project ${id} saved to database. shareUuid: ${project.shareUuid}, isShareEnabled: ${project.isShareEnabled}`);

      // If sharing is enabled, broadcast update to viewers
      if (project.isShareEnabled && project.shareUuid) {
        console.log(`📡 [BROADCAST BY ID] Sharing enabled, broadcasting to shareUuid: ${project.shareUuid}`);
        const broadcastFn = (req.app as any).broadcastShareUpdate;
        if (broadcastFn && sanitizedWorkflowData) {
          const { nodes, edges, canvasObjects, viewport, flowSettings } = sanitizedWorkflowData as any;
          const nodeCount = nodes?.length || 0;
          const edgeCount = edges?.length || 0;
          console.log(`📡 [BROADCAST BY ID] Broadcasting ${nodeCount} nodes, ${edgeCount} edges to viewers`);
          broadcastFn(project.shareUuid, { nodes, edges, canvasObjects, viewport, flowSettings });
        } else {
          console.log(`📡 [BROADCAST BY ID] No broadcast function or workflowData - broadcastFn: ${!!broadcastFn}, workflowData: ${!!sanitizedWorkflowData}`);
        }
      } else {
        console.log(`📡 [BROADCAST BY ID] Not broadcasting - isShareEnabled: ${project.isShareEnabled}, shareUuid: ${project.shareUuid}`);
      }

      res.json({ project });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const user = await storage.getUser(userId);

      if (!(await hasCloudProjectAccess(user))) {
        return res.status(403).json({ error: 'Sign in required for cloud-saved projects' });
      }

      const { id } = req.params;

      await storage.deleteSavedProject(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // Project Folders API
  app.get('/api/folders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const folders = await storage.getProjectFolders(userId);
      res.json({ folders });
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ error: 'Failed to fetch folders' });
    }
  });

  app.post('/api/folders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { name, parentFolderId, color } = req.body;

      const folder = await storage.createProjectFolder({
        userId,
        name,
        parentFolderId,
        color,
      });

      res.json({ folder });
    } catch (error) {
      console.error('Error creating folder:', error);
      res.status(500).json({ error: 'Failed to create folder' });
    }
  });

  app.put('/api/folders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { id } = req.params;
      const { name, parentFolderId, color } = req.body;

      const folder = await storage.updateProjectFolder(id, userId, {
        name,
        parentFolderId,
        color,
      });

      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      res.json({ folder });
    } catch (error) {
      console.error('Error updating folder:', error);
      res.status(500).json({ error: 'Failed to update folder' });
    }
  });

  app.delete('/api/folders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { id } = req.params;

      await storage.deleteProjectFolder(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({ error: 'Failed to delete folder' });
    }
  });

  // Insight history endpoints
  const insightHistorySchema = z.object({
    originalInsightId: z.string(),
    projectId: z.string().optional(),
    workflowId: z.string().optional(),
    title: z.string(),
    description: z.string(),
    category: z.enum(['observation', 'suggestion', 'note']),
    status: z.enum(['new', 'viewed', 'explored', 'dismissed', 'deferred', 'promoted']),
    relatedNodeIds: z.array(z.string()).optional(),
    relatedEdgeIds: z.array(z.string()).optional(),
    explorationContext: z.object({
      suggestedMode: z.enum(['whatif', 'enhancement', 'open_exploration']).optional(),
      prefilledPrompt: z.string().optional(),
      anchorNodeId: z.string().optional(),
    }).optional(),
    actedAt: z.string().optional(),
    viewedAt: z.string().optional(),
    exploredAt: z.string().optional(),
    dismissedAt: z.string().optional(),
    deferredAt: z.string().optional(),
    promotedAt: z.string().optional(),
  });

  app.get('/api/insights/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const projectId = req.query.projectId as string | undefined;
      const history = await storage.getInsightHistory(userId, projectId);
      res.json({ history });
    } catch (error) {
      console.error('Error fetching insight history:', error);
      res.status(500).json({ error: 'Failed to fetch insight history' });
    }
  });

  app.post('/api/insights/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const parseResult = insightHistorySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request data', details: parseResult.error.errors });
      }

      const data = parseResult.data;
      const entry = await storage.createInsightHistory({
        userId,
        projectId: data.projectId,
        workflowId: data.workflowId,
        originalInsightId: data.originalInsightId,
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        relatedNodeIds: data.relatedNodeIds || [],
        relatedEdgeIds: data.relatedEdgeIds || [],
        explorationContext: data.explorationContext,
        actedAt: data.actedAt ? new Date(data.actedAt) : new Date(),
        viewedAt: data.viewedAt ? new Date(data.viewedAt) : undefined,
        exploredAt: data.exploredAt ? new Date(data.exploredAt) : undefined,
        dismissedAt: data.dismissedAt ? new Date(data.dismissedAt) : undefined,
        deferredAt: data.deferredAt ? new Date(data.deferredAt) : undefined,
        promotedAt: data.promotedAt ? new Date(data.promotedAt) : undefined,
      });
      res.json({ entry });
    } catch (error) {
      console.error('Error creating insight history:', error);
      res.status(500).json({ error: 'Failed to create insight history' });
    }
  });

  // Share project endpoint - create a view-only share link (requires authentication)
  const shareProjectSchema = z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.record(z.any()).optional(),
    }).passthrough()),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
    }).passthrough()),
    canvasObjects: z.array(z.any()).optional(),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
    projectMetadata: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
    flowSettings: z.record(z.object({
      enableStatusTracking: z.boolean().optional(),
      workflowName: z.string().optional(),
    })).optional(),
  });

  app.post('/api/share-project', isAuthenticated, async (req: any, res) => {
    try {
      const parseResult = shareProjectSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request data', details: parseResult.error.errors });
      }
      
      const { nodes, edges, canvasObjects, viewport, projectMetadata, flowSettings } = parseResult.data;
      const shareId = crypto.randomUUID();
      const shareLink = await storage.createShareLink({
        shareId,
        nodes,
        edges,
        canvasObjects,
        viewport,
        projectMetadata,
        flowSettings,
      });
      res.json({ shareId: shareLink.shareId });
    } catch (error) {
      console.error('Error creating share link:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  });

  // Get shared project by shareId
  app.get('/api/shared-project/:shareId', async (req, res) => {
    try {
      const { shareId } = req.params;
      const shareLink = await storage.getShareLink(shareId);
      if (!shareLink) {
        return res.status(404).json({ error: 'Share link not found' });
      }
      res.json(shareLink);
    } catch (error) {
      console.error('Error fetching shared project:', error);
      res.status(500).json({ error: 'Failed to fetch shared project' });
    }
  });

  // Update shared project - for live updates
  app.put('/api/share-project/:shareId', isAuthenticated, async (req: any, res) => {
    try {
      const { shareId } = req.params;
      const parseResult = shareProjectSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request data', details: parseResult.error.errors });
      }
      
      const { nodes, edges, canvasObjects, viewport, projectMetadata, flowSettings } = parseResult.data;
      
      // Update the share link in the database
      const updated = await storage.updateShareLink(shareId, {
        nodes,
        edges,
        canvasObjects,
        viewport,
        projectMetadata,
        flowSettings,
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'Share link not found' });
      }
      
      // Broadcast update to all connected viewers via WebSocket
      const broadcastFn = (req.app as any).broadcastShareUpdate;
      if (broadcastFn) {
        broadcastFn(shareId, { nodes, edges, canvasObjects, viewport, flowSettings });
      }
      
      res.json({ success: true, shareId });
    } catch (error) {
      console.error('Error updating share link:', error);
      res.status(500).json({ error: 'Failed to update share link' });
    }
  });

  // ============================================================================
  // PROJECT UUID-BASED ACCESS CONTROL ENDPOINTS
  // ============================================================================

  // Get project by projectUuid (for editing - requires ownership)
  app.get('/api/project/:projectUuid', isAuthenticated, async (req: any, res) => {
    try {
      const { projectUuid } = req.params;
      const project = await storage.getProjectByProjectUuid(projectUuid);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check if user is the owner
      const userId = getUserIdFromRequest(req.user);
      if (project.userId !== userId) {
        // Not the owner - do not leak shareUuid, just reject
        return res.status(403).json({ error: 'Not authorized to access this project' });
      }

      // Owner - return full project data
      res.json({ 
        project,
        isOwner: true,
        shareUuid: project.shareUuid,
        isShareEnabled: project.isShareEnabled
      });
    } catch (error) {
      console.error('Error fetching project by UUID:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  // Update project by projectUuid (requires ownership)
  app.put('/api/project/:projectUuid', projectRateLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const { projectUuid } = req.params;
      const userId = getUserIdFromRequest(req.user);
      
      console.log(`📝 [PROJECT UPDATE] Received update for projectUuid: ${projectUuid}`);
      
      const project = await storage.getProjectByProjectUuid(projectUuid);
      if (!project) {
        console.log(`📝 [PROJECT UPDATE] Project not found: ${projectUuid}`);
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log(`📝 [PROJECT UPDATE] Found project ID: ${project.id}, shareUuid: ${project.shareUuid}, isShareEnabled: ${project.isShareEnabled}`);
      
      if (project.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this project' });
      }

      const { name, description, workflowData, thumbnail, folderId, tags, isPublic } = req.body;
      
      // Sanitize all input data
      const sanitizedName = name ? sanitizeNodeLabel(name) : undefined;
      const sanitizedDescription = description ? sanitizeText(description) : undefined;
      const sanitizedWorkflowData = workflowData ? sanitizeWorkflowContent(workflowData) : undefined;
      const sanitizedTags = tags ? (tags as string[]).map((t: string) => sanitizeText(t)).filter(Boolean) : undefined;

      const updated = await storage.updateSavedProject(project.id, userId, {
        name: sanitizedName,
        description: sanitizedDescription,
        workflowData: sanitizedWorkflowData,
        thumbnail,
        folderId,
        tags: sanitizedTags,
        isPublic,
      });

      if (!updated) {
        console.log(`📝 [PROJECT UPDATE] Update failed for project: ${project.id}`);
        return res.status(404).json({ error: 'Project not found' });
      }
      
      console.log(`📝 [PROJECT UPDATE] Project ${project.id} saved to database successfully`);

      // If sharing is enabled, broadcast update to viewers
      if (updated.isShareEnabled && updated.shareUuid) {
        console.log(`📡 [BROADCAST] Sharing enabled, broadcasting to shareUuid: ${updated.shareUuid}`);
        const broadcastFn = (req.app as any).broadcastShareUpdate;
        if (broadcastFn && sanitizedWorkflowData) {
          const { nodes, edges, canvasObjects, viewport, flowSettings } = sanitizedWorkflowData as any;
          const nodeCount = nodes?.length || 0;
          const edgeCount = edges?.length || 0;
          console.log(`📡 [BROADCAST] Broadcasting ${nodeCount} nodes, ${edgeCount} edges to viewers`);
          broadcastFn(updated.shareUuid, { nodes, edges, canvasObjects, viewport, flowSettings });
        } else {
          console.log(`📡 [BROADCAST] No broadcast function or no workflowData - broadcastFn: ${!!broadcastFn}, workflowData: ${!!sanitizedWorkflowData}`);
        }
      } else {
        console.log(`📡 [BROADCAST] Not broadcasting - isShareEnabled: ${updated.isShareEnabled}, shareUuid: ${updated.shareUuid}`);
      }

      res.json({ project: updated });
    } catch (error) {
      console.error('Error updating project by UUID:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  // Enable sharing for a project (generates shareUuid if not exists)
  app.post('/api/projects/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { id } = req.params;

      const project = await storage.getSavedProject(id, userId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // If already has a shareUuid and is enabled, just return it
      if (project.isShareEnabled && project.shareUuid) {
        return res.json({ 
          shareUuid: project.shareUuid,
          shareUrl: `/view/${project.shareUuid}`,
          project 
        });
      }

      // Enable sharing (generates new shareUuid if needed)
      const updated = await storage.enableProjectSharing(id, userId);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to enable sharing' });
      }

      res.json({ 
        shareUuid: updated.shareUuid,
        shareUrl: `/view/${updated.shareUuid}`,
        project: updated 
      });
    } catch (error) {
      console.error('Error enabling project sharing:', error);
      res.status(500).json({ error: 'Failed to enable sharing' });
    }
  });

  // Disable sharing for a project
  app.delete('/api/projects/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserIdFromRequest(req.user);
      const { id } = req.params;

      const updated = await storage.disableProjectSharing(id, userId);
      if (!updated) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ success: true, project: updated });
    } catch (error) {
      console.error('Error disabling project sharing:', error);
      res.status(500).json({ error: 'Failed to disable sharing' });
    }
  });

  // View-only access via shareUuid or legacy shareId (no auth required)
  // Handles both new saved project shares AND legacy snapshot shares
  app.get('/api/view/:shareUuid', async (req: any, res) => {
    try {
      const { shareUuid } = req.params;
      
      // First, try to find a saved project by shareUuid
      const project = await storage.getProjectByShareUuid(shareUuid);
      
      if (project) {
        // Check if viewer is actually the owner
        const userId = req.user?.claims?.sub;
        if (userId && project.userId === userId) {
          // Owner viewing their own share link - redirect to edit
          return res.json({
            redirect: `/project/${project.projectUuid}`,
            projectUuid: project.projectUuid,
            isOwner: true
          });
        }

        // Return view-only data from saved project
        const workflowData = project.workflowData as any;
        return res.json({
          shareUuid: project.shareUuid,
          projectName: project.name,
          projectDescription: project.description,
          nodes: workflowData?.nodes || [],
          edges: workflowData?.edges || [],
          canvasObjects: workflowData?.canvasObjects,
          viewport: workflowData?.viewport,
          flowSettings: workflowData?.flowSettings,
          isOwner: false
        });
      }
      
      // Fallback: try legacy share links
      const shareLink = await storage.getShareLink(shareUuid);
      if (shareLink) {
        const metadata = shareLink.projectMetadata as { name?: string; description?: string } | null;
        return res.json({
          shareUuid: shareLink.shareId,
          projectName: metadata?.name || 'Shared Workflow',
          projectDescription: metadata?.description,
          nodes: shareLink.nodes || [],
          edges: shareLink.edges || [],
          canvasObjects: shareLink.canvasObjects,
          viewport: shareLink.viewport,
          flowSettings: shareLink.flowSettings,
          isOwner: false
        });
      }
      
      return res.status(404).json({ error: 'Shared project not found or sharing is disabled' });
    } catch (error) {
      console.error('Error fetching view-only project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  // AI Health Check endpoint - test connectivity to Anthropic Claude models
  app.get('/api/ai/health', async (req, res) => {
    const models = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'];
    const results: Record<string, { success: boolean; error?: string; responseTime?: number }> = {};
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Anthropic API key not configured',
        models: {}
      });
    }
    
    for (const model of models) {
      const startTime = Date.now();
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }]
          })
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          results[model] = { 
            success: true, 
            responseTime,
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          results[model] = { 
            success: false, 
            error: `${response.status}: ${errorData.error?.message || 'Unknown error'}`,
            responseTime
          };
        }
      } catch (error) {
        results[model] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Connection failed',
          responseTime: Date.now() - startTime
        };
      }
    }
    
    const allSuccessful = Object.values(results).every(r => r.success);
    res.status(allSuccessful ? 200 : 207).json({
      status: allSuccessful ? 'healthy' : 'partial',
      models: results,
      timestamp: new Date().toISOString()
    });
  });

  // AI Chat endpoint - proxy for AI models with dynamic provider routing
  app.post('/api/ai/chat', aiRateLimiter, requireUSOnly, requireCredits, async (req, res) => {
    try {
      const { model, temperature, maxTokens, provider, apiKey: clientApiKey, taskType, sessionLocked } = req.body;
      
      // Task-type based model routing policy (Anthropic Claude)
      const TASK_TYPE_MODELS: Record<string, { model: string; provider: string; allowUserOverride: boolean }> = {
        workflow_reasoning: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
        workflow_experiments: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
        workflow_edit: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
        workflow_generate: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
        workflow_advise: { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', allowUserOverride: true },
        prd_generation: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
        vision_ingestion: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
        general_chat: { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', allowUserOverride: true },
      };
      
      // Complexity heuristic for workflow_generate: route simple prompts to Haiku
      const COMPLEXITY_KEYWORDS = /\b(if|when|unless|condition|loop|retry|branch|parallel|decision|fallback|alternative|exception|error handling|multiple|either|otherwise|in case|depends on|based on|check whether|validate|approval|escalat)\b/i;
      function isSimpleWorkflowPrompt(msgs: any[]): boolean {
        const lastUser = [...msgs].reverse().find((m: any) => m.role === 'user');
        if (!lastUser) return false;
        const text = typeof lastUser.content === 'string' ? lastUser.content
          : Array.isArray(lastUser.content) ? lastUser.content.map((c: any) => c.text || '').join(' ')
          : '';
        const wordCount = text.trim().split(/\s+/).length;
        return wordCount <= 20 && !COMPLEXITY_KEYWORDS.test(text);
      }

      // Resolve model based on taskType routing policy
      let resolvedModel = model;
      let resolvedProvider = provider;
      
      if (taskType && TASK_TYPE_MODELS[taskType]) {
        const policy = TASK_TYPE_MODELS[taskType];
        if (!policy.allowUserOverride || !model) {
          resolvedModel = policy.model;
          resolvedProvider = policy.provider;
        }
        // Downgrade workflow_generate to Haiku for short, simple prompts
        if (taskType === 'workflow_generate' && isSimpleWorkflowPrompt(req.body.messages || [])) {
          resolvedModel = 'claude-haiku-4-5-20251001';
          resolvedProvider = 'anthropic';
        }
      }
      
      // Sanitize all messages to prevent prompt injection
      const messages = (req.body.messages || []).map((msg: any) => ({
        ...msg,
        content: typeof msg.content === 'string' ? sanitizeAiPrompt(msg.content) : msg.content
      }));
      
      // Determine provider and API key
      let activeProvider = resolvedProvider || provider;
      let activeApiKey = clientApiKey;
      
      // If no explicit provider, infer from model name or default to Anthropic
      const activeModel = resolvedModel || model;
      if (!activeProvider) {
        if (activeModel && activeModel.includes('claude')) {
          activeProvider = 'anthropic';
        } else if (activeModel && (activeModel.includes('gpt') || activeModel.includes('o1'))) {
          activeProvider = 'openai';
        } else {
          activeProvider = 'anthropic';
        }
      }
      
      // Set API keys from environment for server-side requests (not for Ollama or Kiteframe which don't need them)
      if (activeProvider === 'anthropic') {
        activeApiKey = activeApiKey || process.env.ANTHROPIC_API_KEY;
      } else if (activeProvider === 'openai') {
        activeApiKey = process.env.OPENAI_API_KEY;
      }

      if (!activeApiKey && activeProvider !== 'ollama' && activeProvider !== 'kiteframe') {
        return res.status(401).json({ 
          error: `${activeProvider} API key not configured. Please set it in AI settings.` 
        });
      }

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

        // Anthropic requires system prompts as a top-level `system` string,
        // not as messages with role "system".
        const systemParts: string[] = [];
        const anthropicMessages = messages.filter((msg: any) => {
          if (msg.role === 'system') {
            const content = typeof msg.content === 'string'
              ? msg.content
              : Array.isArray(msg.content)
                ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
                : '';
            if (content) systemParts.push(content);
            return false;
          }
          return true;
        });
        const systemPrompt = systemParts.join('\n\n');

        requestBody = {
          model: activeModel,
          max_tokens: maxTokens || 1024,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: anthropicMessages
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
          model: activeModel,
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
          model: activeModel,
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
        const isGpt5Model = activeModel && (activeModel.includes('gpt-5') || activeModel.startsWith('gpt-5'));
        
        endpoint = `${customEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
        headers = {
          'Content-Type': 'application/json',
          ...(isCustomOllama ? {} : { 'Authorization': `Bearer ${activeApiKey}` })
        };
        
        if (isCustomOpenAI && isGpt5Model) {
          // Use GPT-5 compatible parameters for custom OpenAI endpoints
          requestBody = {
            model: activeModel,
            messages,
            max_completion_tokens: maxTokens
          };
        } else {
          requestBody = {
            model: activeModel,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(isCustomOllama ? { stream: false } : {})
          };
        }
      } else {
        // Fallback: route to Anthropic
        endpoint = 'https://api.anthropic.com/v1/messages';
        const fallbackKey = activeApiKey || process.env.ANTHROPIC_API_KEY;
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': fallbackKey || '',
          'anthropic-version': '2023-06-01'
        };
        requestBody = {
          model: activeModel || 'claude-haiku-4-5-20251001',
          messages,
          max_tokens: maxTokens || 1024
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
      
      // Track AI request analytics
      const userIdentifier = creditService.getUserIdentifier(req);
      let country: string | undefined;
      try {
        const geoResult = await geolocationService.getCountryCode(req);
        country = geoResult.country;
      } catch (error) {
        country = undefined;
      }
      analyticsService.trackAIRequest(userIdentifier, country, activeProvider).catch(console.error);
      
      // Log AI usage metrics (for responses with token counts)
      const usage = json.usage;
      if (usage) {
        const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
        logAiUsage({
          userId: userId || undefined,
          feature: 'chat',
          model: model || 'claude-haiku-4-5-20251001',
          promptTokens: usage.prompt_tokens || usage.input_tokens || 0,
          completionTokens: usage.completion_tokens || usage.output_tokens || 0,
        }).catch(console.error);
      }
      
      const creditInfo = req.creditDeducted;
      res.json({ 
        text: responseText,
        credits: creditInfo ? {
          remaining: creditInfo.remainingCredits,
          cost: creditInfo.creditCost,
        } : undefined,
      });
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

  // Wireframe Generation endpoint - generate SVG wireframes for workflow nodes
  app.post('/api/generate-wireframe', aiRateLimiter, requireUSOnly, requireAdvancedOrPro, requireCredits, async (req, res) => {
    try {
      const { label, description, nodeType } = req.body;
      
      if (!label || !nodeType) {
        return res.status(400).json({ error: 'Node label and type are required' });
      }

      const sanitize = (value: string, maxLength: number) =>
        String(value).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLength);

      const safeLabel = sanitize(label, 100);
      const safeNodeType = sanitize(nodeType, 50);
      const safeDescription = description ? sanitize(description, 300) : 'No description provided';

      // Create prompt for wireframe generation
      const prompt = `Create a simple, clean SVG wireframe mockup for a UI component representing "${safeLabel}".

Node Type: ${safeNodeType}
Description: ${safeDescription}

Requirements:
- Generate ONLY the SVG code, no explanations
- Use a 400x300 viewBox
- Use simple shapes (rectangles, circles, lines, text)
- Use grayscale colors (#333, #666, #999, #ddd, #f5f5f5)
- Include placeholder text and UI elements appropriate for this type of component
- Make it look like a professional wireframe mockup
- Keep it simple and clean

Return ONLY the SVG code starting with <svg> and ending with </svg>.`;

      // Use Anthropic Claude to generate the wireframe
      const endpoint = 'https://api.anthropic.com/v1/messages';
      const apiKey = process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        return res.status(401).json({ error: 'AI API key not configured' });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          system: 'You are a UI/UX designer that creates clean, simple SVG wireframes. Always return ONLY SVG code, nothing else.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Anthropic wireframe generation error:', error);
        return res.status(response.status).json({ 
          error: 'Failed to generate wireframe',
          details: error
        });
      }

      const json = await response.json();
      const svgContent = json.content?.[0]?.text || '';
      
      // Extract SVG from response (in case there's extra text)
      const svgMatch = svgContent.match(/<svg[\s\S]*<\/svg>/i);
      const svg = svgMatch ? svgMatch[0] : svgContent;
      
      // Track analytics
      const userIdentifier = creditService.getUserIdentifier(req);
      let country: string | undefined;
      try {
        const geoResult = await geolocationService.getCountryCode(req);
        country = geoResult.country;
      } catch (error) {
        country = undefined;
      }
      analyticsService.trackAIRequest(userIdentifier, country, 'anthropic').catch(console.error);
      
      res.json({ svg });
    } catch (error: any) {
      console.error('Wireframe generation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // AI Test endpoint - validate API key and model compatibility
  app.post('/api/ai/test', aiRateLimiter, async (req, res) => {
    try {
      const { provider, apiKey, customEndpoint } = req.body;
      
      // Set default models for each provider
      let model = req.body.model;
      console.log('Test model received:', { model, type: typeof model, provider });
      
      if (!model || model === 'undefined' || model === 'null' || (typeof model === 'string' && model.trim() === '')) {
        console.log('Setting default model for provider:', provider);
        switch (provider) {
          case 'anthropic':
            model = 'claude-haiku-4-5-20251001';
            break;
          case 'kiteframe':
            model = 'llama3.2:3b';
            break;
          case 'ollama':
            model = 'llama3.2:3b';
            break;
          default:
            model = 'claude-haiku-4-5-20251001';
        }
        console.log('Default model set to:', model);
      }
      
      // For Anthropic, always use environment key. For others, require API key unless it's ollama/kiteframe
      let finalApiKey = apiKey;
      if (provider === 'anthropic' && !finalApiKey) {
        finalApiKey = process.env.ANTHROPIC_API_KEY;
        if (!finalApiKey) {
          return res.status(500).json({ error: 'Anthropic API key not configured on server' });
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
        // Custom or unknown provider - use OpenAI-compatible format
        {
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
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: 'AI API key not configured' });
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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          system: 'You are a workflow data correction specialist. Return only valid JSON, no explanations.',
          messages: [{ role: 'user', content: correctionPrompt }],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Anthropic API Error ${response.status}:`, error);
        return res.status(response.status).json({ 
          error: `AI correction failed: ${response.status}`,
          details: error
        });
      }

      const aiResult = await response.json();
      const correctedDataText = aiResult.content?.[0]?.text || '';

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
  app.post('/api/chat/messages', csrfProtection, chatRateLimiter, async (req, res) => {
    try {
      const { roomId, message, messageType, metadata } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      const sanitizedMessage = sanitizeText(message).substring(0, 5000);
      if (!sanitizedMessage) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }
      
      const chatMessage = await db.insert(chatMessages).values({
        roomId,
        message: sanitizedMessage,
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
  app.post('/api/comments', csrfProtection, chatRateLimiter, async (req, res) => {
    try {
      const { workflowId, roomId, nodeId, positionX, positionY, content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Comment content is required' });
      }
      
      const sanitizedContent = sanitizeText(content).substring(0, 2000);
      if (!sanitizedContent) {
        return res.status(400).json({ error: 'Comment cannot be empty' });
      }
      
      const comment = await db.insert(workflowComments).values({
        workflowId,
        roomId,
        nodeId,
        positionX,
        positionY,
        content: sanitizedContent
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

  // Page View tracking endpoint (privacy-friendly, no cookies)
  app.post('/api/analytics/pageview', async (req, res) => {
    try {
      const { route, referrer } = req.body;
      
      if (!route || typeof route !== 'string') {
        return res.status(400).json({ error: 'Route is required' });
      }
      
      // Get IP and user agent for anonymization
      const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';
      
      // Create anonymized visitor hash (no personal data stored)
      // Hash IP + UA + daily salt so we can count unique visitors without tracking individuals
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const visitorHash = crypto.createHash('sha256')
        .update(ip + userAgent + today + (process.env.SESSION_SECRET || 'salt'))
        .digest('hex')
        .slice(0, 16); // Short hash is sufficient
      
      // Extract referrer domain
      let referrerDomain = null;
      if (referrer && typeof referrer === 'string' && referrer.length > 0) {
        try {
          const url = new URL(referrer);
          referrerDomain = url.hostname;
        } catch {
          // Invalid URL, ignore
        }
      }
      
      // Detect device type from user agent
      let deviceType = 'desktop';
      if (/mobile/i.test(userAgent)) {
        deviceType = 'mobile';
      } else if (/tablet|ipad/i.test(userAgent)) {
        deviceType = 'tablet';
      }
      
      // Get country from geolocation service
      let country = null;
      try {
        const geoData = await geolocationService.getLocation(ip);
        country = geoData.country || null;
      } catch {
        // Geolocation failed, continue without country
      }
      
      // Check if user is authenticated
      const isAuthenticated = !!(req as any).user;
      
      // Insert page view
      await db.insert(pageViews).values({
        route: route.slice(0, 500), // Limit length
        visitorHash,
        referrer: referrer?.slice(0, 2000) || null,
        referrerDomain,
        country,
        userAgent: userAgent.slice(0, 500),
        deviceType,
        isAuthenticated,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Page view tracking error:', error);
      // Silently fail - don't block user experience for analytics
      res.json({ success: true });
    }
  });

  // Contact Form endpoint with honeypot spam protection
  app.post('/api/contact', waitlistRateLimiter, async (req, res) => {
    try {
      const { name, email, message, website, recaptchaToken } = req.body;
      
      // Honeypot check - if website field is filled, it's a bot
      if (website) {
        // Silently accept but don't send email (fool the bot)
        return res.json({ success: true });
      }
      
      // Validate required fields
      if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      // Verify reCAPTCHA token when configured — skip gracefully if token missing
      // (honeypot already handles most bots; hard-blocking missing tokens locks out
      // legitimate users with ad blockers that prevent the reCAPTCHA script from loading)
      if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
        const isValid = await verifyRecaptchaToken(recaptchaToken, 'contact', clientIp);
        if (!isValid) {
          return res.status(400).json({ error: 'Security check failed. Please try again.' });
        }
      }
      
      // Sanitize inputs
      const sanitizedName = sanitizeText(name.substring(0, 100));
      const sanitizedEmail = email.substring(0, 255).toLowerCase().trim();
      const sanitizedMessage = sanitizeText(message.substring(0, 5000));
      
      const success = await sendContactEmail(sanitizedEmail, sanitizedName, sanitizedMessage);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to send message. Please try again later.' });
      }
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ error: 'An error occurred. Please try again later.' });
    }
  });

  // Open Graph metadata fetching for link previews
  app.post('/api/og-metadata', async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported' });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      // SSRF protection: Block private/local network addresses
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,  // Link-local
        /^::1$/,
        /^fc00:/i,      // IPv6 private
        /^fe80:/i,      // IPv6 link-local
        /\.local$/i,
        /\.internal$/i,
        /\.localhost$/i,
      ];

      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return res.status(400).json({ error: 'URL not allowed' });
      }

      // Fetch the URL with a timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KiteframeBot/1.0; +https://kiteframe.app)',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status}` });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return res.status(400).json({ error: 'URL does not return HTML content' });
      }

      const html = await response.text();

      // Extract Open Graph and meta tags
      const metadata: {
        title?: string;
        description?: string;
        favicon?: string;
        image?: string;
        siteName?: string;
      } = {};

      // Helper to extract meta content
      const extractMeta = (name: string): string | undefined => {
        const patterns = [
          new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
          new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
        ];
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) return match[1];
        }
        return undefined;
      };

      // Extract OG tags
      metadata.title = extractMeta('og:title') || extractMeta('twitter:title');
      metadata.description = extractMeta('og:description') || extractMeta('twitter:description') || extractMeta('description');
      metadata.image = extractMeta('og:image') || extractMeta('twitter:image');
      metadata.siteName = extractMeta('og:site_name');

      // Fallback title from <title> tag
      if (!metadata.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          metadata.title = titleMatch[1].trim();
        }
      }

      // Extract favicon
      const faviconPatterns = [
        /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
        /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
      ];

      for (const pattern of faviconPatterns) {
        const match = html.match(pattern);
        if (match) {
          let faviconUrl = match[1];
          // Resolve relative URLs
          if (faviconUrl.startsWith('//')) {
            faviconUrl = parsedUrl.protocol + faviconUrl;
          } else if (faviconUrl.startsWith('/')) {
            faviconUrl = parsedUrl.origin + faviconUrl;
          } else if (!faviconUrl.startsWith('http')) {
            faviconUrl = new URL(faviconUrl, url).href;
          }
          metadata.favicon = faviconUrl;
          break;
        }
      }

      // Default favicon fallback
      if (!metadata.favicon) {
        metadata.favicon = `${parsedUrl.origin}/favicon.ico`;
      }

      // Resolve relative image URLs
      if (metadata.image && !metadata.image.startsWith('http')) {
        if (metadata.image.startsWith('//')) {
          metadata.image = parsedUrl.protocol + metadata.image;
        } else if (metadata.image.startsWith('/')) {
          metadata.image = parsedUrl.origin + metadata.image;
        } else {
          metadata.image = new URL(metadata.image, url).href;
        }
      }

      res.json({ success: true, metadata });

    } catch (error: any) {
      console.error('OG metadata fetch error:', error);
      if (error.name === 'AbortError') {
        return res.status(408).json({ error: 'Request timeout' });
      }
      res.status(500).json({ error: 'Failed to fetch metadata' });
    }
  });

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
  app.post("/api/ai/analyze-workflow-image", requireUSOnly, requireAdvancedOrPro, requireCredits, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: "AI service is not available. Please check API key configuration." 
        });
      }

      console.log('[Image Analysis] Processing workflow image:', {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Convert image buffer to base64
      const base64Image = req.file.buffer.toString('base64');
      const mediaType = (req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/jpeg';

      // Analyze image with Claude Sonnet Vision
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          system: `You are a workflow diagram analysis expert. Analyze hand-drawn or digital workflow diagrams and extract workflow elements in KiteFrame format.

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

Position nodes 250px apart. Use confidence 70+ only if you can clearly identify 3+ workflow elements.`,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Image
                  }
                },
                {
                  type: "text",
                  text: "Analyze this workflow diagram and extract the workflow structure. Focus on identifying nodes, connections, and text labels. Return only valid JSON."
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Anthropic API Error ${response.status}:`, error);
        return res.status(500).json({ 
          error: "Failed to analyze image", 
          details: `AI API error: ${response.status}` 
        });
      }

      const aiResult = await response.json();
      const rawContent = aiResult.content?.[0]?.text || '{}';
      
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

      // Log AI usage metrics for vision analysis
      const visionUsage = aiResult.usage;
      if (visionUsage) {
        const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
        logAiUsage({
          userId: userId || undefined,
          feature: 'vision_analysis',
          model: 'claude-sonnet-4-5-20250929',
          promptTokens: visionUsage.input_tokens || 0,
          completionTokens: visionUsage.output_tokens || 0,
          isVision: true,
        }).catch(console.error);
      }

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
      const user = req.user as any;
      const isAuthenticated = creditService.isAuthenticatedUser(req);
      
      const userEmail = user?.email || user?.claims?.email;
      const isAdmin = isAdminUser(userEmail);
      
      if (isAdmin) {
        return res.json({
          success: true,
          credits: 999999,
          userIdentifier,
          isUnlimited: true,
          isAdmin: true,
          resetsDaily: false,
          creditCosts: { general_chat: 1, vision_ingestion: 5, workflow_reasoning: 3, workflow_experiments: 3, prd_generation: 3 },
        });
      }
      
      const creditRecord = await creditService.getOrCreateUserCredits(userIdentifier, isAuthenticated);
      
      res.json({
        success: true,
        credits: creditRecord.credits,
        isUnlimited: creditRecord.isUnlimited || false,
        userIdentifier,
        resetsDaily: true,
        dailyAllowance: creditService.getCreditsForTier(
          isAuthenticated 
            ? ((user?.subscriptionTier as 'free' | 'advanced' | 'pro') || 'free')
            : 'free'
        ),
        lastResetAt: creditRecord.lastResetAt,
        creditCosts: { general_chat: 1, vision_ingestion: 5, workflow_reasoning: 3, workflow_experiments: 3, prd_generation: 3 },
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
  app.post('/api/credits/redeem', csrfProtection, creditUnlockRateLimiter, async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ 
          error: 'Unlock code is required' 
        });
      }

      const userIdentifier = creditService.getUserIdentifier(req);
      let country: string | undefined;
      
      try {
        const geoResult = await geolocationService.getCountryCode(req);
        country = geoResult.country;
      } catch (error) {
        country = undefined;
      }
      
      const result = await creditService.redeemUnlockCode(code.trim(), userIdentifier, country);
      
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

  // Admin: Generate unlock code
  app.post('/internal/ops-codes/generate', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { grantsUnlimited, creditsToAdd, allowedCountries, notes } = req.body;
      
      // Validate input
      if (!grantsUnlimited) {
        const credits = creditsToAdd ?? 25;
        if (typeof credits !== 'number' || isNaN(credits) || credits < 1) {
          return res.status(400).json({
            error: 'Credits must be at least 1',
          });
        }
      }

      if (!Array.isArray(allowedCountries) || allowedCountries.length === 0) {
        return res.status(400).json({
          error: 'At least one country must be selected',
        });
      }
      
      const credits = grantsUnlimited ? 999999 : (creditsToAdd || 25);
      const countries = allowedCountries;
      
      const code = 'KITE-' + Math.random().toString(36).substring(2, 15).toUpperCase();
      
      const [newCode] = await db.insert(unlockCodes).values({
        code,
        creditsToAdd: credits,
        grantsUnlimited: grantsUnlimited || false,
        allowedCountries: countries,
        notes: notes || null,
      }).returning();
      
      await logCodeAction(req, 'code_generate', newCode.id, { 
        credits, 
        grantsUnlimited: grantsUnlimited || false,
        countries 
      });
      
      res.json({
        success: true,
        code: newCode,
      });
    } catch (error: any) {
      console.error('Generate code error:', error);
      res.status(500).json({ 
        error: 'Failed to generate unlock code',
        details: error.message 
      });
    }
  });

  // Admin: List all unlock codes
  app.get('/internal/ops-codes/list', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const codes = await db.query.unlockCodes.findMany({
        orderBy: desc(unlockCodes.createdAt),
      });
      
      res.json({
        success: true,
        codes,
      });
    } catch (error: any) {
      console.error('List codes error:', error);
      res.status(500).json({ 
        error: 'Failed to list unlock codes',
        details: error.message 
      });
    }
  });

  // Admin: Revoke or unrevoke an unlock code
  app.post('/internal/ops-codes/revoke/:codeId', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { codeId } = req.params;
      const { revoke } = req.body;
      
      const [updatedCode] = await db.update(unlockCodes)
        .set({ isRevoked: revoke })
        .where(eq(unlockCodes.id, codeId))
        .returning();
      
      if (!updatedCode) {
        return res.status(404).json({
          error: 'Code not found',
        });
      }
      
      await logCodeAction(req, 'code_revoke', codeId, { revoke });
      
      res.json({
        success: true,
        code: updatedCode,
        message: revoke ? 'Code revoked successfully' : 'Code restored successfully',
      });
    } catch (error: any) {
      console.error('Revoke code error:', error);
      res.status(500).json({ 
        error: 'Failed to update code status',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Overview stats
  app.get('/internal/x9k7m2p4/analytics/overview', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { analyticsEvents } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const [totalAIRequests] = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventType, 'ai_request'));
      
      const [totalCreditAlerts] = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventType, 'credit_limit_hit'));
      
      const uniqueCountries = await db.selectDistinct({ country: analyticsEvents.country })
        .from(analyticsEvents)
        .where(sql`${analyticsEvents.country} IS NOT NULL`);
      
      res.json({
        success: true,
        data: {
          totalAIRequests: totalAIRequests?.count || 0,
          totalCreditAlerts: totalCreditAlerts?.count || 0,
          totalCountries: uniqueCountries.length,
        },
      });
    } catch (error: any) {
      console.error('Analytics overview error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch analytics overview',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Geographic activity
  app.get('/internal/x9k7m2p4/analytics/geographic', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { analyticsEvents } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const geoActivity = await db.select({
        country: analyticsEvents.country,
        totalRequests: sql<number>`COUNT(*)::int`,
        aiRequests: sql<number>`COUNT(CASE WHEN ${analyticsEvents.eventType} = 'ai_request' THEN 1 END)::int`,
        uniqueUsers: sql<number>`COUNT(DISTINCT ${analyticsEvents.userIdentifier})::int`,
        lastActivity: sql<string>`MAX(${analyticsEvents.createdAt})::text`,
      })
        .from(analyticsEvents)
        .where(sql`${analyticsEvents.country} IS NOT NULL`)
        .groupBy(analyticsEvents.country);
      
      res.json({
        success: true,
        data: geoActivity,
      });
    } catch (error: any) {
      console.error('Geographic analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch geographic analytics',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Code usage stats
  app.get('/internal/x9k7m2p4/analytics/code-usage', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { analyticsEvents } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const codeUsage = await db.select({
        code: sql<string>`${analyticsEvents.metadata}->>'code'`,
        totalRedemptions: sql<number>`COUNT(*)::int`,
        countries: sql<string[]>`ARRAY_AGG(DISTINCT ${analyticsEvents.country})`,
        lastUsed: sql<string>`MAX(${analyticsEvents.createdAt})::text`,
      })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.eventType, 'code_redeemed'))
        .groupBy(sql`${analyticsEvents.metadata}->>'code'`);
      
      res.json({
        success: true,
        data: codeUsage,
      });
    } catch (error: any) {
      console.error('Code usage analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch code usage analytics',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Recent credit alerts
  app.get('/internal/x9k7m2p4/analytics/alerts', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { analyticsEvents } = await import('@shared/schema');
      
      const alerts = await db.query.analyticsEvents.findMany({
        where: eq(analyticsEvents.eventType, 'credit_limit_hit'),
        orderBy: desc(analyticsEvents.createdAt),
        limit: 50,
      });
      
      res.json({
        success: true,
        data: alerts,
      });
    } catch (error: any) {
      console.error('Alerts analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch alerts',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Activity Log (all AI usage events with search and pagination)
  app.get('/internal/x9k7m2p4/analytics/activity-log', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { aiUsageEvents, users } = await import('@shared/schema');
      const { count } = await import('drizzle-orm');
      
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const search = (req.query.search as string)?.trim().toLowerCase();
      
      // Build search condition if provided (using ilike for case-insensitive search, coalesce for nulls)
      let whereCondition;
      if (search) {
        const searchTerm = `%${search}%`;
        whereCondition = or(
          ilike(sql`COALESCE(${aiUsageEvents.userId}, '')`, searchTerm),
          ilike(sql`COALESCE(${aiUsageEvents.feature}, '')`, searchTerm),
          ilike(sql`COALESCE(${aiUsageEvents.model}, '')`, searchTerm),
          ilike(sql`COALESCE(${users.email}, '')`, searchTerm)
        );
      }
      
      // Base query with left join
      const baseQuery = db.select({
        id: aiUsageEvents.id,
        userId: aiUsageEvents.userId,
        feature: aiUsageEvents.feature,
        model: aiUsageEvents.model,
        units: aiUsageEvents.units,
        createdAt: aiUsageEvents.createdAt,
        userEmail: users.email,
      })
        .from(aiUsageEvents)
        .leftJoin(users, eq(aiUsageEvents.userId, users.id));
      
      // Get total count with same join and filter
      const countQuery = db.select({ count: count() })
        .from(aiUsageEvents)
        .leftJoin(users, eq(aiUsageEvents.userId, users.id));
      
      let totalResult;
      let events;
      
      if (whereCondition) {
        totalResult = await countQuery.where(whereCondition);
        events = await baseQuery
          .where(whereCondition)
          .orderBy(desc(aiUsageEvents.createdAt))
          .limit(limit)
          .offset(offset);
      } else {
        totalResult = await countQuery;
        events = await baseQuery
          .orderBy(desc(aiUsageEvents.createdAt))
          .limit(limit)
          .offset(offset);
      }
      
      const total = totalResult[0]?.count || 0;
      
      res.json({
        success: true,
        events,
        total,
        page,
        limit,
      });
    } catch (error: any) {
      console.error('Activity log error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch activity log',
        details: error.message 
      });
    }
  });

  // Admin Analytics: AI Usage Summary (all users)
  app.get('/internal/x9k7m2p4/analytics/ai-usage/summary', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { getSystemUsageSummary } = await import('./aiUsageService');
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : undefined;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : undefined;

      const summary = await getSystemUsageSummary(periodStart, periodEnd);
      
      res.json({
        success: true,
        summary,
      });
    } catch (error: any) {
      console.error('AI usage summary analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch AI usage summary',
        details: error.message 
      });
    }
  });

  // Admin Analytics: AI Usage Time Series (all users)
  app.get('/internal/x9k7m2p4/analytics/ai-usage/timeseries', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { getSystemUsageTimeSeries } = await import('./aiUsageService');
      
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : defaultStart;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : now;
      
      // Determine bucket size based on date range
      const rangeMs = periodEnd.getTime() - periodStart.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      let bucket: 'hour' | 'day' | 'week' = 'day';
      if (rangeMs < 2 * dayMs) {
        bucket = 'hour';
      } else if (rangeMs > 60 * dayMs) {
        bucket = 'week';
      }
      
      const visionOnly = req.query.visionOnly === 'true';

      const timeSeries = await getSystemUsageTimeSeries(
        periodStart,
        periodEnd,
        bucket,
        visionOnly
      );
      
      res.json({
        success: true,
        bucket,
        timeSeries
      });
    } catch (error: any) {
      console.error('AI usage timeseries analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch AI usage time series',
        details: error.message 
      });
    }
  });

  // Admin Analytics: AI Usage Events (all users)
  app.get('/internal/x9k7m2p4/analytics/ai-usage/events', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { getSystemUsageEvents } = await import('./aiUsageService');
      
      const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : undefined;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : undefined;

      const result = await getSystemUsageEvents(limit, offset, periodStart, periodEnd);
      
      res.json({
        success: true,
        events: result.events,
        total: result.total,
        limit,
        offset
      });
    } catch (error: any) {
      console.error('AI usage events analytics error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch AI usage events',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Page View Summary
  app.get('/internal/x9k7m2p4/analytics/pageviews/summary', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : defaultStart;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : now;
      
      // Get total page views in period
      const totalViewsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd)
        ));
      
      // Get unique visitors in period
      const uniqueVisitorsResult = await db
        .select({ count: sql<number>`count(distinct ${pageViews.visitorHash})::int` })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd)
        ));
      
      // Get top pages
      const topPages = await db
        .select({
          route: pageViews.route,
          views: sql<number>`count(*)::int`,
          uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorHash})::int`,
        })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd)
        ))
        .groupBy(pageViews.route)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      // Get top referrers
      const topReferrers = await db
        .select({
          domain: pageViews.referrerDomain,
          views: sql<number>`count(*)::int`,
        })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd),
          isNotNull(pageViews.referrerDomain)
        ))
        .groupBy(pageViews.referrerDomain)
        .orderBy(desc(sql`count(*)`))
        .limit(10);
      
      // Get device breakdown
      const deviceBreakdown = await db
        .select({
          deviceType: pageViews.deviceType,
          views: sql<number>`count(*)::int`,
        })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd)
        ))
        .groupBy(pageViews.deviceType)
        .orderBy(desc(sql`count(*)`));
      
      // Get country breakdown
      const countryBreakdown = await db
        .select({
          country: pageViews.country,
          views: sql<number>`count(*)::int`,
        })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd),
          isNotNull(pageViews.country)
        ))
        .groupBy(pageViews.country)
        .orderBy(desc(sql`count(*)`))
        .limit(15);
      
      res.json({
        success: true,
        summary: {
          totalViews: totalViewsResult[0]?.count || 0,
          uniqueVisitors: uniqueVisitorsResult[0]?.count || 0,
          topPages,
          topReferrers,
          deviceBreakdown,
          countryBreakdown,
        },
      });
    } catch (error: any) {
      console.error('Page views summary error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch page views summary',
        details: error.message 
      });
    }
  });

  // Admin Analytics: Page View Time Series
  app.get('/internal/x9k7m2p4/analytics/pageviews/timeseries', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : defaultStart;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : now;
      
      // Determine bucket size based on date range
      const rangeMs = periodEnd.getTime() - periodStart.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      let bucket: 'hour' | 'day' | 'week' = 'day';
      let dateTrunc = 'day';
      if (rangeMs < 2 * dayMs) {
        bucket = 'hour';
        dateTrunc = 'hour';
      } else if (rangeMs > 60 * dayMs) {
        bucket = 'week';
        dateTrunc = 'week';
      }
      
      const timeSeries = await db
        .select({
          timestamp: sql<string>`date_trunc(${dateTrunc}, ${pageViews.createdAt})::text`,
          views: sql<number>`count(*)::int`,
          uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorHash})::int`,
        })
        .from(pageViews)
        .where(and(
          gte(pageViews.createdAt, periodStart),
          lte(pageViews.createdAt, periodEnd)
        ))
        .groupBy(sql`date_trunc(${dateTrunc}, ${pageViews.createdAt})`)
        .orderBy(sql`date_trunc(${dateTrunc}, ${pageViews.createdAt})`);
      
      res.json({
        success: true,
        bucket,
        timeSeries,
      });
    } catch (error: any) {
      console.error('Page views timeseries error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch page views time series',
        details: error.message 
      });
    }
  });

  // ============= DOCS ACCESS MANAGEMENT (Admin) =============
  
  // Admin: List all docs access grants
  app.get('/internal/x9k7m2p4/docs-access', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const grants = await db
        .select()
        .from(docAccessGrants)
        .orderBy(desc(docAccessGrants.grantedAt));
      
      res.json({
        success: true,
        grants: grants.map(g => ({
          ...g,
          isActive: !g.revokedAt,
        })),
      });
    } catch (error: any) {
      console.error('Docs access list error:', error);
      res.status(500).json({ error: 'Failed to fetch docs access grants' });
    }
  });
  
  // Admin: Grant docs access to an email
  app.post('/internal/x9k7m2p4/docs-access', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if grant already exists
      const existing = await db
        .select()
        .from(docAccessGrants)
        .where(eq(docAccessGrants.email, normalizedEmail))
        .limit(1);
      
      if (existing.length > 0) {
        // If revoked, reactivate it
        if (existing[0].revokedAt) {
          await db
            .update(docAccessGrants)
            .set({ revokedAt: null, grantedAt: new Date() })
            .where(eq(docAccessGrants.id, existing[0].id));
          
          return res.json({ success: true, message: 'Access reactivated', grantId: existing[0].id });
        }
        return res.status(400).json({ error: 'Email already has docs access' });
      }
      
      // Create new grant
      const [newGrant] = await db
        .insert(docAccessGrants)
        .values({
          email: normalizedEmail,
          grantedByAdminId: (req as any).adminUsername || 'admin',
        })
        .returning();
      
      res.json({ success: true, grant: newGrant });
    } catch (error: any) {
      console.error('Docs access grant error:', error);
      res.status(500).json({ error: 'Failed to grant docs access' });
    }
  });
  
  // Admin: Revoke docs access
  app.post('/internal/x9k7m2p4/docs-access/:grantId/revoke', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { grantId } = req.params;
      
      const [updated] = await db
        .update(docAccessGrants)
        .set({ revokedAt: new Date() })
        .where(eq(docAccessGrants.id, grantId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Grant not found' });
      }
      
      res.json({ success: true, message: 'Access revoked' });
    } catch (error: any) {
      console.error('Docs access revoke error:', error);
      res.status(500).json({ error: 'Failed to revoke docs access' });
    }
  });
  
  // Admin: Send/resend login link
  app.post('/internal/x9k7m2p4/docs-access/:grantId/send-link', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { grantId } = req.params;
      
      const [grant] = await db
        .select()
        .from(docAccessGrants)
        .where(eq(docAccessGrants.id, grantId))
        .limit(1);
      
      if (!grant) {
        return res.status(404).json({ error: 'Grant not found' });
      }
      
      if (grant.revokedAt) {
        return res.status(400).json({ error: 'Cannot send link to revoked grant' });
      }
      
      // Generate magic link token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await db
        .update(docAccessGrants)
        .set({
          loginToken: hashedToken,
          tokenExpiresAt: expiresAt,
        })
        .where(eq(docAccessGrants.id, grantId));
      
      // Build the login link
      const baseUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
        : 'https://kiteframe.space';
      const loginLink = `${baseUrl}/internal/docs?token=${rawToken}`;
      
      // Send email with the link
      const emailSent = await sendDocsAccessEmail(grant.email, loginLink);
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send login link email' });
      }

      res.json({ success: true, message: 'Login link sent' });
    } catch (error: any) {
      console.error('Docs access send link error:', error);
      res.status(500).json({ error: 'Failed to send login link' });
    }
  });

  // ============= DOCS ACCESS AUTHENTICATION =============
  
  // Check docs session
  app.get('/internal/docs/session', async (req, res) => {
    const session = req.session as any;
    if (session?.docsAccess && session?.docsEmail) {
      // Verify the grant is still active
      const [grant] = await db
        .select()
        .from(docAccessGrants)
        .where(and(
          eq(docAccessGrants.email, session.docsEmail),
          isNull(docAccessGrants.revokedAt)
        ))
        .limit(1);
      
      if (grant) {
        return res.json({ 
          authenticated: true, 
          email: session.docsEmail 
        });
      }
      // Grant was revoked, clear session
      session.docsAccess = false;
      session.docsEmail = null;
    }
    res.json({ authenticated: false });
  });
  
  // Verify magic link token
  app.get('/internal/docs/verify', async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Token required' });
      }
      
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      const [grant] = await db
        .select()
        .from(docAccessGrants)
        .where(and(
          eq(docAccessGrants.loginToken, hashedToken),
          isNull(docAccessGrants.revokedAt)
        ))
        .limit(1);
      
      if (!grant) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      if (grant.tokenExpiresAt && new Date() > grant.tokenExpiresAt) {
        return res.status(401).json({ error: 'Token expired' });
      }
      
      // Clear the token (single use) and update last login
      await db
        .update(docAccessGrants)
        .set({
          loginToken: null,
          tokenExpiresAt: null,
          lastLoginAt: new Date(),
        })
        .where(eq(docAccessGrants.id, grant.id));
      
      // Set session
      const session = req.session as any;
      session.docsAccess = true;
      session.docsEmail = grant.email;
      
      res.json({ success: true, email: grant.email });
    } catch (error: any) {
      console.error('Docs verify error:', error);
      res.status(500).json({ error: 'Failed to verify token' });
    }
  });
  
  // Docs logout
  app.post('/internal/docs/logout', (req, res) => {
    const session = req.session as any;
    session.docsAccess = false;
    session.docsEmail = null;
    res.json({ success: true });
  });

  // ============= ADMIN AUTH ENDPOINTS =============
  
  // Admin login - returns JWT token
  app.post('/internal/x9k7m2p4/login', requireHttps, adminLoginRateLimiter, adminLogin);
  
  // Admin logout
  app.post('/internal/x9k7m2p4/logout', requireHttps, adminLoginRateLimiter, adminLogout);
  
  // Refresh admin session
  app.post('/internal/x9k7m2p4/refresh', requireHttps, adminLoginRateLimiter, requireAdminAuth, refreshAdminSession);

  // ============= BETA ACCESS ADMIN ENDPOINTS =============
  
  // Admin: Get waitlist users
  app.get('/internal/x9k7m2p4/waitlist', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string; // 'pending' | 'beta' | 'all'
      const search = (req.query.search as string)?.toLowerCase()?.trim();

      // Build conditions for filtered query
      const conditions: any[] = [];
      
      if (status === 'pending') {
        conditions.push(isNotNull(users.waitlistRequestedAt));
        conditions.push(or(eq(users.isBeta, false), isNull(users.isBeta)));
        conditions.push(isNull(users.waitlistRejectedAt));
      } else if (status === 'beta') {
        conditions.push(eq(users.isBeta, true));
        conditions.push(isNotNull(users.waitlistRequestedAt));
      } else if (status === 'rejected') {
        conditions.push(isNotNull(users.waitlistRequestedAt));
        conditions.push(isNotNull(users.waitlistRejectedAt));
      } else {
        conditions.push(isNotNull(users.waitlistRequestedAt));
      }

      if (search) {
        conditions.push(ilike(users.email, `%${search}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const waitlistUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        isBeta: users.isBeta,
        betaGrantedAt: users.betaGrantedAt,
        waitlistRequestedAt: users.waitlistRequestedAt,
        waitlistRejectedAt: users.waitlistRejectedAt,
        waitlistRole: users.waitlistRole,
        waitlistUseCase: users.waitlistUseCase,
        createdAt: users.createdAt,
      }).from(users)
        .where(whereClause)
        .orderBy(desc(users.waitlistRequestedAt))
        .limit(limit)
        .offset(offset);

      // Count for current filter (for pagination)
      const filteredCountQuery = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause);

      // Global stats (always show real totals regardless of filter)
      const totalCountQuery = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(isNotNull(users.waitlistRequestedAt));

      const pendingCountQuery = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(
          isNotNull(users.waitlistRequestedAt),
          or(eq(users.isBeta, false), isNull(users.isBeta)),
          isNull(users.waitlistRejectedAt)
        ));

      const approvedCountQuery = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(
          isNotNull(users.waitlistRequestedAt),
          eq(users.isBeta, true)
        ));

      const rejectedCountQuery = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(
          isNotNull(users.waitlistRequestedAt),
          isNotNull(users.waitlistRejectedAt)
        ));
      
      res.json({
        success: true,
        users: waitlistUsers,
        total: filteredCountQuery[0]?.count || 0,
        stats: {
          total: totalCountQuery[0]?.count || 0,
          pending: pendingCountQuery[0]?.count || 0,
          approved: approvedCountQuery[0]?.count || 0,
          rejected: rejectedCountQuery[0]?.count || 0,
        },
        limit,
        offset
      });
    } catch (error: any) {
      console.error('Waitlist fetch error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch waitlist',
        details: error.message 
      });
    }
  });

  // Admin: Beta slot status (count vs cap)
  app.get('/internal/beta-slots', requireHttps, requireAdminAuth, async (_req, res) => {
    try {
      const slots = await getBetaSlots();
      res.json(slots);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch beta slots' });
    }
  });

  // Admin: List waitlisted users (isBeta=false with waitlistRequestedAt set)
  app.get('/internal/beta/waitlist', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { isNull, isNotNull, desc } = await import('drizzle-orm');
      const waitlisted = await db.query.users.findMany({
        where: and(
          eq(users.isBeta, false),
          isNotNull(users.waitlistRequestedAt)
        ),
        orderBy: [desc(users.waitlistRequestedAt)],
        columns: {
          id: true, email: true, firstName: true, lastName: true,
          profileImageUrl: true, waitlistRequestedAt: true, authProvider: true,
        },
      });
      res.json({ users: waitlisted });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch waitlist', details: error.message });
    }
  });

  // Admin: Accept a waitlisted user (set isBeta=true, clear waitlistRequestedAt)
  app.post('/internal/beta/accept', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { userId, sendEmail: shouldSendEmail = true } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId is required' });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      await db.update(users).set({
        isBeta: true,
        betaGrantedAt: new Date(),
        waitlistRequestedAt: null,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      await logBetaAction(req, 'beta_grant', userId, user.email || undefined);

      let emailSent = false;
      if (shouldSendEmail && user.email) {
        emailSent = await sendBetaApprovalEmail(user.email, user.firstName);
      }

      res.json({ success: true, userId, emailSent });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to accept user', details: error.message });
    }
  });

  // Admin: Revoke beta access from an organic user (puts them back on waitlist)
  app.post('/internal/beta/revoke', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId is required' });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      await db.update(users).set({
        isBeta: false,
        waitlistRequestedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      await logBetaAction(req, 'beta_revoke', userId, user.email || undefined);

      res.json({ success: true, userId });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to revoke user', details: error.message });
    }
  });

  // Admin: List organically approved beta users (isBeta=true, NOT in Beta group)
  app.get('/internal/beta/approved', requireHttps, requireAdminAuth, async (_req, res) => {
    try {
      const { isNull, isNotNull, desc, not: notOp, inArray: inArrayOp } = await import('drizzle-orm');
      const { userGroups: ug, userGroupMemberships: ugm } = await import('@shared/schema');
      const betaGroupMemberIds = db
        .select({ userId: ugm.userId })
        .from(ugm)
        .innerJoin(ug, eq(ugm.groupId, ug.id))
        .where(eq(ug.name, 'Beta'));

      const approved = await db
        .select({
          id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
          betaGrantedAt: users.betaGrantedAt, authProvider: users.authProvider,
        })
        .from(users)
        .where(and(
          eq(users.isBeta, true),
          notOp(inArrayOp(users.id, betaGroupMemberIds))
        ))
        .orderBy(desc(users.betaGrantedAt));

      res.json({ users: approved });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch approved users', details: error.message });
    }
  });

  // Admin: Grant beta access to a user
  app.post('/internal/x9k7m2p4/beta/grant', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { userId, email, sendEmail: shouldSendEmail = true } = req.body;

      if (!userId && !email) {
        return res.status(400).json({ error: 'userId or email is required' });
      }

      let user;
      if (userId) {
        user = await storage.getUser(userId);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await db.update(users).set({
        isBeta: true,
        betaGrantedAt: new Date(),
        waitlistRejectedAt: null,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      await logBetaAction(req, 'beta_grant', user.id, user.email || undefined);
      console.log(`Beta access granted to user ${user.id} (${user.email})`);
      
      // Send approval email if requested and user has email
      let emailSent = false;
      if (shouldSendEmail && user.email) {
        emailSent = await sendBetaApprovalEmail(user.email, user.firstName);
        if (emailSent) {
          console.log(`Beta approval email sent to ${user.email}`);
        }
      }
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          isBeta: true,
          betaGrantedAt: new Date()
        },
        emailSent,
      });
    } catch (error: any) {
      console.error('Beta grant error:', error);
      res.status(500).json({ 
        error: 'Failed to grant beta access',
        details: error.message 
      });
    }
  });

  // Admin: Revoke beta access from a user
  app.post('/internal/x9k7m2p4/beta/revoke', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { userId, email } = req.body;

      if (!userId && !email) {
        return res.status(400).json({ error: 'userId or email is required' });
      }

      let user;
      if (userId) {
        user = await storage.getUser(userId);
      } else if (email) {
        user = await storage.getUserByEmail(email);
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await db.update(users).set({
        isBeta: false,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      await logBetaAction(req, 'beta_revoke', user.id, user.email || undefined);
      console.log(`Beta access revoked from user ${user.id} (${user.email})`);
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          isBeta: false
        }
      });
    } catch (error: any) {
      console.error('Beta revoke error:', error);
      res.status(500).json({ 
        error: 'Failed to revoke beta access',
        details: error.message 
      });
    }
  });

  // Admin: Reject a waitlist request
  app.post('/internal/x9k7m2p4/waitlist/reject', requireHttps, requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.waitlistRequestedAt) {
        return res.status(400).json({ error: 'User is not on the waitlist' });
      }

      if (user.isBeta) {
        return res.status(400).json({ error: 'Cannot reject a user who already has beta access' });
      }

      await db.update(users).set({
        waitlistRejectedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      await logBetaAction(req, 'waitlist_reject', user.id, user.email || undefined);
      console.log(`Waitlist request rejected for user ${user.id} (${user.email})`);
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          waitlistRejectedAt: new Date()
        }
      });
    } catch (error: any) {
      console.error('Waitlist reject error:', error);
      res.status(500).json({ 
        error: 'Failed to reject waitlist request',
        details: error.message 
      });
    }
  });

  // ============= SAMPLE API FOR TABLE TESTING =============
  // Returns sample product data for testing table API integration
  app.get("/api/sample/products", (req, res) => {
    const products = [
      { id: 1, name: "Laptop Pro", category: "Electronics", price: 1299.99, stock: 45, rating: 4.5 },
      { id: 2, name: "Wireless Mouse", category: "Electronics", price: 29.99, stock: 150, rating: 4.2 },
      { id: 3, name: "USB-C Hub", category: "Accessories", price: 49.99, stock: 80, rating: 4.7 },
      { id: 4, name: "Mechanical Keyboard", category: "Electronics", price: 149.99, stock: 60, rating: 4.8 },
      { id: 5, name: "Monitor 27\"", category: "Electronics", price: 399.99, stock: 25, rating: 4.4 },
      { id: 6, name: "Webcam HD", category: "Electronics", price: 79.99, stock: 90, rating: 4.1 },
      { id: 7, name: "Desk Lamp", category: "Office", price: 34.99, stock: 120, rating: 4.3 },
      { id: 8, name: "Notebook Set", category: "Office", price: 12.99, stock: 200, rating: 4.0 },
    ];
    res.json({ products, total: products.length, lastUpdated: new Date().toISOString() });
  });

  // Returns sample user data for testing
  app.get("/api/sample/users", (req, res) => {
    const users = [
      { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "Active", joined: "2024-01-15" },
      { id: 2, name: "Bob Smith", email: "bob@example.com", role: "Editor", status: "Active", joined: "2024-02-20" },
      { id: 3, name: "Carol White", email: "carol@example.com", role: "Viewer", status: "Active", joined: "2024-03-10" },
      { id: 4, name: "David Brown", email: "david@example.com", role: "Editor", status: "Inactive", joined: "2024-01-25" },
      { id: 5, name: "Emma Davis", email: "emma@example.com", role: "Admin", status: "Active", joined: "2024-04-05" },
    ];
    res.json({ users, total: users.length });
  });

  // ============= TABLE API PROXY =============
  // Proxy endpoint for table API data fetching (avoids CORS issues)
  app.post("/api/table/fetch", async (req, res) => {
    try {
      const { 
        url, 
        method = 'GET', 
        headers = [], 
        responseDataPath, 
        timeout = 30000,
        authType,
        apiKey,
        apiKeyHeaderName,
      } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      // Security: validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      
      // Block private network addresses (SSRF protection)
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^0\.0\.0\.0$/,
        /^::1$/,
        /^fe80:/i,
        /\.local$/i,
        /\.internal$/i,
      ];
      
      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return res.status(400).json({ error: 'Private network addresses are not allowed' });
      }
      
      // Validate method
      const allowedMethods = ['GET', 'POST'];
      const normalizedMethod = (method || 'GET').toUpperCase();
      if (!allowedMethods.includes(normalizedMethod)) {
        return res.status(400).json({ error: 'Only GET and POST methods are allowed' });
      }
      
      // Build request headers
      const requestHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'Kiteframe-Table-API/1.0',
      };
      
      if (Array.isArray(headers)) {
        for (const header of headers) {
          if (header.key && header.value && typeof header.key === 'string' && typeof header.value === 'string') {
            // Skip sensitive headers (except authorization which we handle separately)
            const lowerKey = header.key.toLowerCase();
            if (!['host', 'cookie', 'authorization'].includes(lowerKey)) {
              requestHeaders[header.key] = header.value;
            }
          }
        }
      }
      
      // Add authentication header based on auth type
      // Validate auth type to only allow known values
      const validAuthTypes = ['none', 'apiKey', 'bearer'];
      const normalizedAuthType = (authType && typeof authType === 'string' && validAuthTypes.includes(authType)) 
        ? authType 
        : 'none';
      
      if (normalizedAuthType !== 'none' && apiKey && typeof apiKey === 'string' && apiKey.trim()) {
        switch (normalizedAuthType) {
          case 'apiKey':
            const headerName = (apiKeyHeaderName && typeof apiKeyHeaderName === 'string' && apiKeyHeaderName.trim()) 
              ? apiKeyHeaderName.trim()
              : 'X-API-Key';
            requestHeaders[headerName] = apiKey.trim();
            break;
          case 'bearer':
            requestHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;
            break;
        }
      }
      
      // Perform the fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Math.min(timeout, 30000));
      
      let response;
      try {
        response = await fetch(url, {
          method: normalizedMethod,
          headers: requestHeaders,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `API returned status ${response.status}: ${response.statusText}` 
        });
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return res.status(400).json({ error: 'API must return JSON content' });
      }
      
      let jsonData = await response.json();
      
      // Navigate to the specified data path if provided
      if (responseDataPath && typeof responseDataPath === 'string') {
        const pathParts = responseDataPath.split('.').filter(Boolean);
        for (const part of pathParts) {
          if (jsonData && typeof jsonData === 'object' && part in jsonData) {
            jsonData = jsonData[part];
          } else {
            return res.status(400).json({ 
              error: `Data path "${responseDataPath}" not found in response` 
            });
          }
        }
      }
      
      // Table limits
      const MAX_ROWS = 500;
      const MAX_COLUMNS = 40;
      const MAX_CELLS = 10000;
      
      // Convert JSON to table format
      let rows: any[] = [];
      let columns: { id: string; name: string }[] = [];
      let wasTruncated = false;
      let truncationMessage = '';
      
      if (Array.isArray(jsonData)) {
        // Array of objects - most common API response format
        rows = jsonData;
        
        // Extract columns from first row
        if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
          const allKeys = new Set<string>();
          // Sample first 100 rows for column discovery
          rows.slice(0, 100).forEach(row => {
            if (typeof row === 'object' && row !== null) {
              Object.keys(row).forEach(key => allKeys.add(key));
            }
          });
          columns = Array.from(allKeys).map(key => ({ id: key, name: key }));
        }
      } else if (typeof jsonData === 'object' && jsonData !== null) {
        // Single object - convert to single row
        rows = [jsonData];
        columns = Object.keys(jsonData).map(key => ({ id: key, name: key }));
      } else {
        return res.status(400).json({ 
          error: 'API response must be an array or object' 
        });
      }
      
      // Apply column limit
      if (columns.length > MAX_COLUMNS) {
        columns = columns.slice(0, MAX_COLUMNS);
        wasTruncated = true;
        truncationMessage = `Columns truncated from ${columns.length} to ${MAX_COLUMNS}. `;
      }
      
      // Apply row limit
      const originalRowCount = rows.length;
      if (rows.length > MAX_ROWS) {
        rows = rows.slice(0, MAX_ROWS);
        wasTruncated = true;
        truncationMessage += `Rows truncated from ${originalRowCount} to ${MAX_ROWS}. `;
      }
      
      // Check total cells
      const totalCells = rows.length * columns.length;
      if (totalCells > MAX_CELLS) {
        const maxRows = Math.floor(MAX_CELLS / columns.length);
        rows = rows.slice(0, maxRows);
        wasTruncated = true;
        truncationMessage += `Total cells exceeded ${MAX_CELLS}, rows limited to ${maxRows}.`;
      }
      
      // Format rows with proper structure
      const formattedRows = rows.map((row, index) => {
        const values: Record<string, string | number | boolean | null> = {};
        for (const col of columns) {
          const value = row[col.id];
          if (value === null || value === undefined) {
            values[col.id] = null;
          } else if (typeof value === 'object') {
            values[col.id] = JSON.stringify(value);
          } else {
            values[col.id] = value;
          }
        }
        return {
          id: `row-${index}`,
          values,
        };
      });
      
      res.json({
        success: true,
        data: {
          columns,
          rows: formattedRows,
          meta: {
            totalRowCount: originalRowCount,
            wasTruncated,
            truncationMessage: truncationMessage.trim() || undefined,
            lastRefreshedAt: new Date().toISOString(),
          }
        }
      });
      
    } catch (error: any) {
      console.error('Table API fetch error:', error);
      
      if (error.name === 'AbortError') {
        return res.status(408).json({ error: 'Request timeout - API took too long to respond' });
      }
      
      res.status(500).json({ 
        error: 'Failed to fetch API data',
        details: error.message 
      });
    }
  });

  // ===== ADMIN: USER GROUPS MANAGEMENT =====

  // Admin: Create a new user group
  app.post('/internal/groups', requireAdminAuth, async (req, res) => {
    try {
      const { name, description, accessControls } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      
      // Validate access controls if provided
      if (accessControls) {
        const validation = groupAccessControlsSchema.safeParse(accessControls);
        if (!validation.success) {
          return res.status(400).json({ 
            error: 'Invalid access controls format',
            details: validation.error.errors 
          });
        }
      }
      
      const [newGroup] = await db.insert(userGroups).values({
        name: name.trim(),
        description: description?.trim() || null,
        accessControls: accessControls || {},
      }).returning();
      
      res.json({
        success: true,
        group: newGroup,
      });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'A group with this name already exists' });
      }
      console.error('Create group error:', error);
      res.status(500).json({ 
        error: 'Failed to create group',
        details: error.message 
      });
    }
  });

  // Admin: List all user groups
  app.get('/internal/groups', requireAdminAuth, async (req, res) => {
    try {
      const groups = await db.query.userGroups.findMany({
        orderBy: desc(userGroups.createdAt),
      });
      
      // Get member counts for each group
      const groupsWithCounts = await Promise.all(groups.map(async (group) => {
        const members = await db.select()
          .from(userGroupMemberships)
          .where(eq(userGroupMemberships.groupId, group.id));
        return {
          ...group,
          memberCount: members.length,
        };
      }));
      
      res.json({
        success: true,
        groups: groupsWithCounts,
      });
    } catch (error: any) {
      console.error('List groups error:', error);
      res.status(500).json({ 
        error: 'Failed to list groups',
        details: error.message 
      });
    }
  });

  // Admin: Get a specific group with its members
  app.get('/internal/groups/:groupId', requireAdminAuth, async (req, res) => {
    try {
      const { groupId } = req.params;
      
      const group = await db.query.userGroups.findFirst({
        where: eq(userGroups.id, groupId),
      });
      
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      
      // Get members of this group with user details
      const memberships = await db.select({
        membershipId: userGroupMemberships.id,
        userId: userGroupMemberships.userId,
        addedAt: userGroupMemberships.addedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionTier: users.subscriptionTier,
      })
        .from(userGroupMemberships)
        .leftJoin(users, eq(userGroupMemberships.userId, users.id))
        .where(eq(userGroupMemberships.groupId, groupId));
      
      res.json({
        success: true,
        group,
        members: memberships,
      });
    } catch (error: any) {
      console.error('Get group error:', error);
      res.status(500).json({ 
        error: 'Failed to get group',
        details: error.message 
      });
    }
  });

  // Admin: Update a user group
  app.put('/internal/groups/:groupId', requireAdminAuth, async (req, res) => {
    try {
      const { groupId } = req.params;
      const { name, description, accessControls } = req.body;
      
      // Validate access controls if provided
      if (accessControls) {
        const validation = groupAccessControlsSchema.safeParse(accessControls);
        if (!validation.success) {
          return res.status(400).json({ 
            error: 'Invalid access controls format',
            details: validation.error.errors 
          });
        }
      }
      
      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (accessControls !== undefined) updateData.accessControls = accessControls;
      
      const [updatedGroup] = await db.update(userGroups)
        .set(updateData)
        .where(eq(userGroups.id, groupId))
        .returning();
      
      if (!updatedGroup) {
        return res.status(404).json({ error: 'Group not found' });
      }
      
      res.json({
        success: true,
        group: updatedGroup,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A group with this name already exists' });
      }
      console.error('Update group error:', error);
      res.status(500).json({ 
        error: 'Failed to update group',
        details: error.message 
      });
    }
  });

  // Admin: Delete a user group
  app.delete('/internal/groups/:groupId', requireAdminAuth, async (req, res) => {
    try {
      const { groupId } = req.params;
      
      const [deletedGroup] = await db.delete(userGroups)
        .where(eq(userGroups.id, groupId))
        .returning();
      
      if (!deletedGroup) {
        return res.status(404).json({ error: 'Group not found' });
      }
      
      res.json({
        success: true,
        message: 'Group deleted successfully',
        group: deletedGroup,
      });
    } catch (error: any) {
      console.error('Delete group error:', error);
      res.status(500).json({ 
        error: 'Failed to delete group',
        details: error.message 
      });
    }
  });

  // Admin: Add user to group
  app.post('/internal/groups/:groupId/members', requireAdminAuth, async (req, res) => {
    try {
      const { groupId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      // Verify group exists
      const group = await db.query.userGroups.findFirst({
        where: eq(userGroups.id, groupId),
      });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      
      // Verify user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if already a member
      const existingMembership = await db.query.userGroupMemberships.findFirst({
        where: eq(userGroupMemberships.userId, userId),
      });
      if (existingMembership && existingMembership.groupId === groupId) {
        return res.status(400).json({ error: 'User is already a member of this group' });
      }
      
      const [membership] = await db.insert(userGroupMemberships).values({
        userId,
        groupId,
      }).returning();
      
      res.json({
        success: true,
        membership,
      });
    } catch (error: any) {
      console.error('Add member error:', error);
      res.status(500).json({ 
        error: 'Failed to add member to group',
        details: error.message 
      });
    }
  });

  // Admin: Remove user from group
  app.delete('/internal/groups/:groupId/members/:userId', requireAdminAuth, async (req, res) => {
    try {
      const { groupId, userId } = req.params;
      
      const [deletedMembership] = await db.delete(userGroupMemberships)
        .where(eq(userGroupMemberships.userId, userId))
        .returning();
      
      if (!deletedMembership || deletedMembership.groupId !== groupId) {
        return res.status(404).json({ error: 'Membership not found' });
      }
      
      res.json({
        success: true,
        message: 'User removed from group successfully',
      });
    } catch (error: any) {
      console.error('Remove member error:', error);
      res.status(500).json({ 
        error: 'Failed to remove member from group',
        details: error.message 
      });
    }
  });

  // ===== ADMIN: USER MANAGEMENT =====

  // Admin: List all users with pagination and search
  app.get('/internal/users', requireAdminAuth, async (req, res) => {
    try {
      const { search, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offset = (pageNum - 1) * limitNum;
      
      const { sql: sqlFn } = await import('drizzle-orm');
      
      // Get users with optional search
      let usersQuery = db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionTier: users.subscriptionTier,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
        profileImageUrl: users.profileImageUrl,
      }).from(users);
      
      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        usersQuery = usersQuery.where(
          sqlFn`LOWER(${users.email}) LIKE ${searchTerm} OR LOWER(${users.firstName}) LIKE ${searchTerm} OR LOWER(${users.lastName}) LIKE ${searchTerm}`
        ) as any;
      }
      
      const allUsers = await usersQuery
        .orderBy(desc(users.createdAt))
        .limit(limitNum)
        .offset(offset);
      
      // Get group memberships and credits for each user
      const usersWithGroupsAndCredits = await Promise.all(allUsers.map(async (user) => {
        const memberships = await db.select({
          id: userGroupMemberships.groupId,
          name: userGroups.name,
        })
          .from(userGroupMemberships)
          .leftJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
          .where(eq(userGroupMemberships.userId, user.id));
        
        // Get user credits
        const credits = await db.query.userCredits.findFirst({
          where: eq(userCredits.userIdentifier, user.id),
        });
        
        return {
          ...user,
          groups: memberships,
          credits: credits ? { credits: credits.credits, isUnlimited: credits.isUnlimited } : null,
        };
      }));
      
      // Get total count
      const [{ count }] = await db.select({ count: sqlFn<number>`COUNT(*)::int` }).from(users);
      
      res.json({
        success: true,
        users: usersWithGroupsAndCredits,
        total: count,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
        },
      });
    } catch (error: any) {
      console.error('List users error:', error);
      res.status(500).json({ 
        error: 'Failed to list users',
        details: error.message 
      });
    }
  });

  // Admin: Get a specific user with their groups
  app.get('/internal/users/:userId', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get user's group memberships
      const memberships = await db.select({
        groupId: userGroupMemberships.groupId,
        groupName: userGroups.name,
        description: userGroups.description,
        accessControls: userGroups.accessControls,
        addedAt: userGroupMemberships.addedAt,
      })
        .from(userGroupMemberships)
        .leftJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
        .where(eq(userGroupMemberships.userId, userId));
      
      // Get user credits
      const { userCredits } = await import('@shared/schema');
      const credits = await db.query.userCredits.findFirst({
        where: eq(userCredits.userIdentifier, userId),
      });
      
      res.json({
        success: true,
        user: {
          ...user,
          groups: memberships,
          credits: credits || null,
        },
      });
    } catch (error: any) {
      console.error('Get user error:', error);
      res.status(500).json({ 
        error: 'Failed to get user',
        details: error.message 
      });
    }
  });

  // Admin: Get user activity (sessions, AI usage) for user details page
  app.get('/internal/users/:userId/activity', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { periodStart, periodEnd } = req.query;
      
      const start = periodStart ? new Date(periodStart as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = periodEnd ? new Date(periodEnd as string) : new Date();
      
      // Get AI usage summary for this user
      const { aiUsageEvents } = await import('@shared/schema');
      
      const usageEvents = await db.select()
        .from(aiUsageEvents)
        .where(
          and(
            eq(aiUsageEvents.userId, userId),
            gte(aiUsageEvents.createdAt, start),
            lte(aiUsageEvents.createdAt, end)
          )
        )
        .orderBy(desc(aiUsageEvents.createdAt))
        .limit(100);
      
      // Calculate totals
      const totalTokens = usageEvents.reduce((sum, e) => sum + (e.totalTokens || 0), 0);
      const totalUnits = usageEvents.reduce((sum, e) => sum + (e.finalUnits || 0), 0);
      
      // Feature breakdown
      const featureBreakdown: Record<string, number> = {};
      for (const event of usageEvents) {
        featureBreakdown[event.feature] = (featureBreakdown[event.feature] || 0) + (event.finalUnits || 0);
      }
      
      // Model breakdown
      const modelBreakdown: Record<string, number> = {};
      for (const event of usageEvents) {
        modelBreakdown[event.model] = (modelBreakdown[event.model] || 0) + (event.finalUnits || 0);
      }
      
      // Daily usage for chart
      const dailyUsage: Record<string, number> = {};
      for (const event of usageEvents) {
        const day = new Date(event.createdAt!).toISOString().split('T')[0];
        dailyUsage[day] = (dailyUsage[day] || 0) + (event.finalUnits || 0);
      }
      
      // Session activity (login count from oauthProviders)
      const { oauthProviders } = await import('@shared/schema');
      const oauthLogins = await db.select()
        .from(oauthProviders)
        .where(eq(oauthProviders.userId, userId));
      
      const lastLogin = oauthLogins.reduce((latest, p) => {
        if (!p.lastUsedAt) return latest;
        return !latest || new Date(p.lastUsedAt) > new Date(latest) ? p.lastUsedAt : latest;
      }, null as Date | null);
      
      res.json({
        success: true,
        activity: {
          totalTokens,
          totalUnits,
          eventCount: usageEvents.length,
          featureBreakdown,
          modelBreakdown,
          dailyUsage: Object.entries(dailyUsage).map(([date, units]) => ({ date, units })).sort((a, b) => a.date.localeCompare(b.date)),
          recentEvents: usageEvents.slice(0, 20).map(e => ({
            id: e.id,
            feature: e.feature,
            model: e.model,
            tokens: e.totalTokens,
            units: e.finalUnits,
            createdAt: e.createdAt,
          })),
          providers: oauthLogins.map(p => ({ provider: p.provider, lastUsedAt: p.lastUsedAt })),
          lastLogin,
        },
      });
    } catch (error: any) {
      console.error('Get user activity error:', error);
      res.status(500).json({ 
        error: 'Failed to get user activity',
        details: error.message 
      });
    }
  });

  // Admin: Delete user
  app.delete('/internal/users/:userId', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Check if user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { userCredits, oauthProviders, aiUsageEvents } = await import('@shared/schema');

      // 1. Invalidate all active sessions for this user so they are immediately logged out
      await db.execute(
        sql`DELETE FROM sessions WHERE sess::jsonb -> 'passport' -> 'user' ->> 'id' = ${userId}`
      );

      // 2. Delete saved projects and project folders (FK to users — must delete before user row)
      await db.delete(savedProjects).where(eq(savedProjects.userId, userId));
      await db.delete(projectFolders).where(eq(projectFolders.userId, userId));

      // 3. Delete group memberships
      await db.delete(userGroupMemberships).where(eq(userGroupMemberships.userId, userId));
      
      // 4. Delete credits
      await db.delete(userCredits).where(eq(userCredits.userIdentifier, userId));
      
      // 5. Delete oauth providers (FK to users with no onDelete — must delete before user row)
      await db.delete(oauthProviders).where(eq(oauthProviders.userId, userId));
      
      // 6. Delete AI usage events
      await db.delete(aiUsageEvents).where(eq(aiUsageEvents.userId, userId));
      
      // 7. Delete the user record
      await db.delete(users).where(eq(users.id, userId));
      
      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete user error:', error);
      res.status(500).json({ 
        error: 'Failed to delete user',
        details: error.message 
      });
    }
  });

  // Admin: Get activity log (searchable, for analytics tab)
  app.get('/internal/activity-log', requireAdminAuth, async (req, res) => {
    try {
      const { search, feature, model, page = '1', limit = '50', periodStart, periodEnd } = req.query;
      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offset = (pageNum - 1) * limitNum;
      
      const start = periodStart ? new Date(periodStart as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = periodEnd ? new Date(periodEnd as string) : new Date();
      
      const { aiUsageEvents } = await import('@shared/schema');
      
      // Build conditions
      const conditions = [
        gte(aiUsageEvents.createdAt, start),
        lte(aiUsageEvents.createdAt, end),
      ];
      
      if (feature && typeof feature === 'string' && feature !== 'all') {
        conditions.push(eq(aiUsageEvents.feature, feature));
      }
      
      if (model && typeof model === 'string' && model !== 'all') {
        conditions.push(eq(aiUsageEvents.model, model));
      }
      
      // Get events with user info
      const events = await db.select({
        id: aiUsageEvents.id,
        userId: aiUsageEvents.userId,
        feature: aiUsageEvents.feature,
        model: aiUsageEvents.model,
        totalTokens: aiUsageEvents.totalTokens,
        finalUnits: aiUsageEvents.finalUnits,
        isVision: aiUsageEvents.isVision,
        createdAt: aiUsageEvents.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
        .from(aiUsageEvents)
        .leftJoin(users, eq(aiUsageEvents.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(aiUsageEvents.createdAt))
        .limit(limitNum)
        .offset(offset);
      
      // Filter by search (email) if provided
      let filteredEvents = events;
      if (search && typeof search === 'string' && search.trim()) {
        const searchLower = search.trim().toLowerCase();
        filteredEvents = events.filter(e => 
          e.userEmail?.toLowerCase().includes(searchLower) ||
          e.userFirstName?.toLowerCase().includes(searchLower) ||
          e.userLastName?.toLowerCase().includes(searchLower)
        );
      }
      
      // Get total count
      const { sql: sqlFn } = await import('drizzle-orm');
      const [{ count }] = await db.select({ count: sqlFn<number>`COUNT(*)::int` })
        .from(aiUsageEvents)
        .where(and(...conditions));
      
      res.json({
        success: true,
        events: filteredEvents,
        total: count,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
        },
      });
    } catch (error: any) {
      console.error('Get activity log error:', error);
      res.status(500).json({ 
        error: 'Failed to get activity log',
        details: error.message 
      });
    }
  });

  // Admin: Get group details with members
  app.get('/internal/groups/:groupId/details', requireAdminAuth, async (req, res) => {
    try {
      const { groupId } = req.params;
      
      const group = await db.query.userGroups.findFirst({
        where: eq(userGroups.id, groupId),
      });
      
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      
      // Get members with their details
      const members = await db.select({
        userId: userGroupMemberships.userId,
        addedAt: userGroupMemberships.addedAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionTier: users.subscriptionTier,
        profileImageUrl: users.profileImageUrl,
      })
        .from(userGroupMemberships)
        .leftJoin(users, eq(userGroupMemberships.userId, users.id))
        .where(eq(userGroupMemberships.groupId, groupId));
      
      res.json({
        success: true,
        group: {
          ...group,
          members,
          memberCount: members.length,
        },
      });
    } catch (error: any) {
      console.error('Get group details error:', error);
      res.status(500).json({ 
        error: 'Failed to get group details',
        details: error.message 
      });
    }
  });

  // Admin: Update user subscription tier directly
  app.put('/internal/users/:userId', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { subscriptionTier, subscriptionStatus } = req.body;
      
      const updateData: any = { updatedAt: new Date() };
      
      if (subscriptionTier !== undefined) {
        if (!['free', 'advanced', 'pro'].includes(subscriptionTier)) {
          return res.status(400).json({ error: 'Invalid subscription tier' });
        }
        updateData.subscriptionTier = subscriptionTier;
      }
      
      if (subscriptionStatus !== undefined) {
        if (!['active', 'canceled', 'past_due', 'paused', 'trialing'].includes(subscriptionStatus)) {
          return res.status(400).json({ error: 'Invalid subscription status' });
        }
        updateData.subscriptionStatus = subscriptionStatus;
      }
      
      const [updatedUser] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({ 
        error: 'Failed to update user',
        details: error.message 
      });
    }
  });

  // Admin: Update user credits
  app.put('/internal/users/:userId/credits', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { credits, isUnlimited } = req.body;
      
      const { userCredits } = await import('@shared/schema');
      
      // Check if user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Upsert credits
      const existingCredits = await db.query.userCredits.findFirst({
        where: eq(userCredits.userIdentifier, userId),
      });
      
      let result;
      if (existingCredits) {
        const updateData: any = { updatedAt: new Date() };
        if (credits !== undefined) updateData.credits = credits;
        if (isUnlimited !== undefined) updateData.isUnlimited = isUnlimited;
        
        [result] = await db.update(userCredits)
          .set(updateData)
          .where(eq(userCredits.userIdentifier, userId))
          .returning();
      } else {
        [result] = await db.insert(userCredits).values({
          userIdentifier: userId,
          credits: credits ?? 10,
          isUnlimited: isUnlimited ?? false,
        }).returning();
      }
      
      res.json({
        success: true,
        credits: result,
      });
    } catch (error: any) {
      console.error('Update credits error:', error);
      res.status(500).json({ 
        error: 'Failed to update credits',
        details: error.message 
      });
    }
  });

  // Admin: Set user group memberships (replace all)
  app.put('/internal/users/:userId/groups', requireAdminAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { groupIds } = req.body;
      
      console.log('[Admin Groups] Setting groups for user:', userId);
      console.log('[Admin Groups] Group IDs to set:', groupIds);
      
      if (!Array.isArray(groupIds)) {
        console.log('[Admin Groups] Error: groupIds is not an array:', typeof groupIds);
        return res.status(400).json({ error: 'groupIds must be an array' });
      }
      
      // Check if user exists
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user) {
        console.log('[Admin Groups] Error: User not found:', userId);
        return res.status(404).json({ error: 'User not found' });
      }
      console.log('[Admin Groups] User found:', user.email);
      
      // Verify all groups exist
      for (const groupId of groupIds) {
        const group = await db.query.userGroups.findFirst({
          where: eq(userGroups.id, groupId),
        });
        if (!group) {
          console.log('[Admin Groups] Error: Group not found:', groupId);
          return res.status(400).json({ error: `Group ${groupId} not found` });
        }
        console.log('[Admin Groups] Group verified:', group.name);
      }
      
      // Remove all existing memberships for this user
      const deleteResult = await db.delete(userGroupMemberships)
        .where(eq(userGroupMemberships.userId, userId))
        .returning();
      console.log('[Admin Groups] Deleted existing memberships:', deleteResult.length);
      
      // Add new memberships
      if (groupIds.length > 0) {
        const insertResult = await db.insert(userGroupMemberships).values(
          groupIds.map((groupId: string) => ({
            userId,
            groupId,
          }))
        ).returning();
        console.log('[Admin Groups] Inserted new memberships:', insertResult);
      }
      
      // Get updated memberships
      const memberships = await db.select({
        groupId: userGroupMemberships.groupId,
        groupName: userGroups.name,
        accessControls: userGroups.accessControls,
      })
        .from(userGroupMemberships)
        .leftJoin(userGroups, eq(userGroupMemberships.groupId, userGroups.id))
        .where(eq(userGroupMemberships.userId, userId));
      
      console.log('[Admin Groups] Final memberships for user:', memberships);
      
      res.json({
        success: true,
        groups: memberships,
      });
    } catch (error: any) {
      console.error('[Admin Groups] Set user groups error:', error);
      res.status(500).json({ 
        error: 'Failed to update user groups',
        details: error.message 
      });
    }
  });

  // ===== ADMIN: CSV IMPORT =====

  // Admin: Import users from CSV
  // CSV format: email,firstName,lastName,subscriptionTier,groups
  // Example: john@example.com,John,Doe,pro,"GroupA,GroupB"
  app.post('/internal/users/import-csv', requireAdminAuth, async (req, res) => {
    try {
      const { csvData, createMissingGroups = false, updateExisting = false } = req.body;
      
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({ error: 'CSV data is required' });
      }
      
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV must have at least a header row and one data row' });
      }
      
      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const emailIndex = header.indexOf('email');
      const firstNameIndex = header.indexOf('firstname');
      const lastNameIndex = header.indexOf('lastname');
      const tierIndex = header.indexOf('subscriptiontier');
      const groupsIndex = header.indexOf('groups');
      
      if (emailIndex === -1) {
        return res.status(400).json({ error: 'CSV must have an email column' });
      }
      
      const results = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as { line: number; email: string; error: string }[],
        groupsCreated: 0,
      };
      
      // Process each data row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV line (handle quoted values for groups)
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        
        const email = values[emailIndex]?.trim().toLowerCase();
        if (!email || !email.includes('@')) {
          results.errors.push({ line: i + 1, email: email || 'N/A', error: 'Invalid email' });
          results.skipped++;
          continue;
        }
        
        const firstName = firstNameIndex !== -1 ? values[firstNameIndex]?.trim() || null : null;
        const lastName = lastNameIndex !== -1 ? values[lastNameIndex]?.trim() || null : null;
        const subscriptionTier = tierIndex !== -1 ? values[tierIndex]?.trim().toLowerCase() || 'free' : 'free';
        const groupNames = groupsIndex !== -1 ? values[groupsIndex]?.split(',').map(g => g.trim()).filter(g => g) || [] : [];
        
        // Validate subscription tier
        if (!['free', 'advanced', 'pro'].includes(subscriptionTier)) {
          results.errors.push({ line: i + 1, email, error: `Invalid subscription tier: ${subscriptionTier}` });
          results.skipped++;
          continue;
        }
        
        try {
          // Check if user exists
          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
          });
          
          let userId: string;
          
          if (existingUser) {
            if (updateExisting) {
              // Update existing user
              const [updatedUser] = await db.update(users)
                .set({
                  firstName: firstName || existingUser.firstName,
                  lastName: lastName || existingUser.lastName,
                  subscriptionTier,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, existingUser.id))
                .returning();
              userId = updatedUser.id;
              results.updated++;
            } else {
              userId = existingUser.id;
              results.skipped++;
            }
          } else {
            // Create new user
            const [newUser] = await db.insert(users).values({
              email,
              firstName,
              lastName,
              subscriptionTier,
            }).returning();
            userId = newUser.id;
            results.created++;
          }
          
          // Handle group assignments
          if (groupNames.length > 0) {
            const groupIds: string[] = [];
            
            for (const groupName of groupNames) {
              let group = await db.query.userGroups.findFirst({
                where: eq(userGroups.name, groupName),
              });
              
              if (!group) {
                if (createMissingGroups) {
                  // Create the missing group
                  const [newGroup] = await db.insert(userGroups).values({
                    name: groupName,
                    description: `Created via CSV import`,
                    accessControls: {},
                  }).returning();
                  group = newGroup;
                  results.groupsCreated++;
                } else {
                  results.errors.push({ line: i + 1, email, error: `Group not found: ${groupName}` });
                  continue;
                }
              }
              
              groupIds.push(group.id);
            }
            
            // Remove existing group memberships for this user
            await db.delete(userGroupMemberships)
              .where(eq(userGroupMemberships.userId, userId));
            
            // Add new memberships
            if (groupIds.length > 0) {
              await db.insert(userGroupMemberships).values(
                groupIds.map((groupId: string) => ({
                  userId,
                  groupId,
                }))
              );
            }
          }
        } catch (error: any) {
          results.errors.push({ line: i + 1, email, error: error.message });
        }
      }
      
      res.json({
        success: true,
        results,
        summary: `Created ${results.created}, updated ${results.updated}, skipped ${results.skipped} users. ${results.groupsCreated} groups created. ${results.errors.length} errors.`,
      });
    } catch (error: any) {
      console.error('CSV import error:', error);
      res.status(500).json({ 
        error: 'Failed to import CSV',
        details: error.message 
      });
    }
  });

  // Admin: Download CSV template
  app.get('/internal/users/csv-template', requireAdminAuth, async (req, res) => {
    try {
      // Get available groups for reference
      const groups = await db.query.userGroups.findMany();
      const groupNames = groups.map(g => g.name).join(', ');
      
      const template = `email,firstName,lastName,subscriptionTier,groups
john@example.com,John,Doe,free,"GroupA,GroupB"
jane@example.com,Jane,Smith,pro,GroupC
# Available tiers: free, advanced, pro
# Available groups: ${groupNames || 'No groups created yet'}
# Note: Group names in the groups column should be comma-separated within quotes`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="user_import_template.csv"');
      res.send(template);
    } catch (error: any) {
      console.error('CSV template error:', error);
      res.status(500).json({ 
        error: 'Failed to generate CSV template',
        details: error.message 
      });
    }
  });

  // =====================================
  // AI Usage Metrics Endpoints
  // =====================================

  // Get usage summary for current user
  app.get('/api/usage/summary', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Parse optional date range from query params
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : undefined;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : undefined;

      const summary = await getUserUsageSummary(userId, periodStart, periodEnd);
      
      res.json({
        success: true,
        summary,
        isBeta: true,
        isUnlimited: true,
        message: 'Unlimited during Beta'
      });
    } catch (error: any) {
      console.error('Usage summary error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch usage summary',
        details: error.message 
      });
    }
  });

  // Get usage time series data for charts
  app.get('/api/usage/timeseries', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : defaultStart;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : now;
      
      // Determine bucket size based on date range
      const rangeMs = periodEnd.getTime() - periodStart.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      let bucket: 'hour' | 'day' | 'week' = 'day';
      if (rangeMs < 2 * dayMs) {
        bucket = 'hour';
      } else if (rangeMs > 60 * dayMs) {
        bucket = 'week';
      }
      
      // Parse filter parameters
      const features = req.query.features 
        ? (req.query.features as string).split(',').filter(f => f) 
        : undefined;
      const models = req.query.models 
        ? (req.query.models as string).split(',').filter(m => m) 
        : undefined;
      const visionOnly = req.query.visionOnly === 'true';

      const timeSeries = await getUserUsageTimeSeries(
        userId,
        periodStart,
        periodEnd,
        bucket,
        features,
        models,
        visionOnly
      );
      
      res.json({
        success: true,
        bucket,
        timeSeries
      });
    } catch (error: any) {
      console.error('Usage timeseries error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch usage time series',
        details: error.message 
      });
    }
  });

  // Get detailed usage events (paginated)
  app.get('/api/usage/events', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const periodStart = req.query.periodStart 
        ? new Date(req.query.periodStart as string) 
        : undefined;
      const periodEnd = req.query.periodEnd 
        ? new Date(req.query.periodEnd as string) 
        : undefined;

      const result = await getUserUsageEvents(userId, limit, offset, periodStart, periodEnd);
      
      res.json({
        success: true,
        events: result.events,
        total: result.total,
        limit,
        offset
      });
    } catch (error: any) {
      console.error('Usage events error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch usage events',
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for real-time collaboration
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track share subscriptions: shareId -> Set of WebSocket clients
  const shareSubscriptions = new Map<string, Set<WebSocket>>();
  // Track which shares each client is subscribed to for cleanup
  const clientSubscriptions = new Map<WebSocket, Set<string>>();
  
  // Function to broadcast share updates to all subscribed viewers
  const broadcastShareUpdate = (shareId: string, data: {
    nodes?: any[];
    edges?: any[];
    canvasObjects?: any[];
    viewport?: { x: number; y: number; zoom: number };
    flowSettings?: Record<string, any>;
  }) => {
    const subscribers = shareSubscriptions.get(shareId);
    console.log(`📡 [WS BROADCAST] shareId: ${shareId}, subscribers: ${subscribers?.size || 0}`);
    if (!subscribers || subscribers.size === 0) {
      console.log(`📡 [WS BROADCAST] No subscribers for shareId: ${shareId}`);
      return;
    }
    
    const message = JSON.stringify({
      type: 'share_update',
      shareId,
      ...data
    });
    
    let sentCount = 0;
    subscribers.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });
    console.log(`📡 [WS BROADCAST] Sent update to ${sentCount} clients for shareId: ${shareId}`);
  };
  
  // Expose broadcastShareUpdate on app for use in routes
  (app as any).broadcastShareUpdate = broadcastShareUpdate;
  
  wss.on('connection', (ws: WebSocket, request) => {
    console.log('🔗 New WebSocket connection established');
    
    // Initialize client subscription tracking
    clientSubscriptions.set(ws, new Set());
    
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
          case 'subscribe_share':
            // Subscribe to a share for live updates
            if (message.shareId && typeof message.shareId === 'string') {
              const shareId = message.shareId;
              
              // Add to share subscriptions
              if (!shareSubscriptions.has(shareId)) {
                shareSubscriptions.set(shareId, new Set());
              }
              shareSubscriptions.get(shareId)!.add(ws);
              
              // Track for this client
              clientSubscriptions.get(ws)?.add(shareId);
              
              console.log(`📡 Client subscribed to share: ${shareId}`);
              
              ws.send(JSON.stringify({
                type: 'share_subscribed',
                shareId
              }));
            }
            break;
          case 'unsubscribe_share':
            // Unsubscribe from a share
            if (message.shareId && typeof message.shareId === 'string') {
              const shareId = message.shareId;
              
              shareSubscriptions.get(shareId)?.delete(ws);
              clientSubscriptions.get(ws)?.delete(shareId);
              
              // Clean up empty subscription sets
              if (shareSubscriptions.get(shareId)?.size === 0) {
                shareSubscriptions.delete(shareId);
              }
              
              console.log(`📡 Client unsubscribed from share: ${shareId}`);
              
              ws.send(JSON.stringify({
                type: 'share_unsubscribed',
                shareId
              }));
            }
            break;
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('🔗 WebSocket connection closed');
      
      // Clean up all subscriptions for this client
      const subscriptions = clientSubscriptions.get(ws);
      if (subscriptions) {
        subscriptions.forEach((shareId) => {
          shareSubscriptions.get(shareId)?.delete(ws);
          if (shareSubscriptions.get(shareId)?.size === 0) {
            shareSubscriptions.delete(shareId);
          }
        });
        clientSubscriptions.delete(ws);
      }
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
