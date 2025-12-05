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
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { handleBugReport } from "./bug-report";
import { requireUSOnly } from "./middleware/regionLock";
import { requireCredits } from "./middleware/creditCheck";
import { creditService } from "./creditService";
import { requireAdminAuth } from "./middleware/adminAuth";
import { unlockCodes } from "@shared/schema";
import { analyticsService } from "./analyticsService";
import { geolocationService } from "./geolocation";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { aiRateLimiter, authRateLimiter, projectRateLimiter, uploadRateLimiter, sensitiveRateLimiter } from "./middleware/rateLimiter";
import { sanitizeAiPrompt, sanitizeAiResponse, sanitizeWorkflowContent, sanitizeText, sanitizeNodeLabel } from "./utils/sanitize";

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
  // Setup Replit Auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
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
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.json({ subscription: null, tier: 'free' });
      }

      let subscription = null;
      if (user.stripeSubscriptionId) {
        subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
      }

      res.json({ 
        subscription,
        tier: user.subscriptionTier || 'free',
        status: user.subscriptionStatus || 'active',
        billingPeriodEnd: user.billingPeriodEnd,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  });

  // Create checkout session
  app.post('/api/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { priceId } = req.body;

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
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

      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${req.protocol}://${req.get('host')}/checkout/success`,
        `${req.protocol}://${req.get('host')}/pricing`
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

      // Delete all user data
      await storage.deleteUser(userId);

      // Logout the user
      req.logout(() => {
        res.json({ success: true, message: 'Account deleted successfully' });
      });
    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  // Saved Projects API (Pro tier only)
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || user.subscriptionTier !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for cloud-saved projects' });
      }

      const projects = await storage.getSavedProjects(userId);
      res.json({ projects });
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', projectRateLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user || user.subscriptionTier !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for cloud-saved projects' });
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { name, description, workflowData, thumbnail, folderId, tags, isPublic } = req.body;

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
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ project });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const folders = await storage.getProjectFolders(userId);
      res.json({ folders });
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ error: 'Failed to fetch folders' });
    }
  });

  app.post('/api/folders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const { id } = req.params;

      await storage.deleteProjectFolder(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({ error: 'Failed to delete folder' });
    }
  });

  // AI Chat endpoint - proxy for AI models with dynamic provider routing
  app.post('/api/ai/chat', aiRateLimiter, requireUSOnly, requireCredits, async (req, res) => {
    try {
      const { model, temperature, maxTokens, provider, apiKey: clientApiKey } = req.body;
      
      // Sanitize all messages to prevent prompt injection
      const messages = (req.body.messages || []).map((msg: any) => ({
        ...msg,
        content: typeof msg.content === 'string' ? sanitizeAiPrompt(msg.content) : msg.content
      }));
      
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

  // Wireframe Generation endpoint - generate SVG wireframes for workflow nodes
  app.post('/api/generate-wireframe', aiRateLimiter, requireUSOnly, requireCredits, async (req, res) => {
    try {
      const { label, description, nodeType } = req.body;
      
      if (!label || !nodeType) {
        return res.status(400).json({ error: 'Node label and type are required' });
      }

      // Create prompt for wireframe generation
      const prompt = `Create a simple, clean SVG wireframe mockup for a UI component representing "${label}".

Node Type: ${nodeType}
Description: ${description || 'No description provided'}

Requirements:
- Generate ONLY the SVG code, no explanations
- Use a 400x300 viewBox
- Use simple shapes (rectangles, circles, lines, text)
- Use grayscale colors (#333, #666, #999, #ddd, #f5f5f5)
- Include placeholder text and UI elements appropriate for this type of component
- Make it look like a professional wireframe mockup
- Keep it simple and clean

Return ONLY the SVG code starting with <svg> and ending with </svg>.`;

      // Use OpenAI to generate the wireframe
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        return res.status(401).json({ error: 'OpenAI API key not configured' });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a UI/UX designer that creates clean, simple SVG wireframes. Always return ONLY SVG code, nothing else.'
            },
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
        console.error('OpenAI wireframe generation error:', error);
        return res.status(response.status).json({ 
          error: 'Failed to generate wireframe',
          details: error
        });
      }

      const json = await response.json();
      const svgContent = json.choices?.[0]?.message?.content || '';
      
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
      analyticsService.trackAIRequest(userIdentifier, country, 'openai').catch(console.error);
      
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
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: correctionPrompt }],
          temperature: 0.1,
          max_completion_tokens: 4000
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
  app.post('/internal/ops-codes/generate', requireAdminAuth, async (req, res) => {
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
  app.get('/internal/ops-codes/list', requireAdminAuth, async (req, res) => {
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
  app.post('/internal/ops-codes/revoke/:codeId', requireAdminAuth, async (req, res) => {
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
  app.get('/internal/analytics/overview', requireAdminAuth, async (req, res) => {
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
  app.get('/internal/analytics/geographic', requireAdminAuth, async (req, res) => {
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
  app.get('/internal/analytics/code-usage', requireAdminAuth, async (req, res) => {
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
  app.get('/internal/analytics/alerts', requireAdminAuth, async (req, res) => {
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
