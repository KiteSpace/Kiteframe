import type { Express } from "express";
import { storage } from "./storage";
import { requireExternalApiKey } from "./middleware/externalApiAuth";
import { externalApiRateLimiter } from "./middleware/rateLimiter";
import { validateExternalWorkflow, externalWorkflowJsonSchema } from "./lib/externalWorkflowSchema";
import { EXTERNAL_WORKFLOW_SYSTEM_PROMPT, EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES } from "./lib/externalWorkflowPrompt";
import { getPublicAppUrl } from "./lib/publicAppUrl";

// External API surface for the Claude Code skill (and similar tooling):
// scoped API-key auth, no session/cookie auth, no LLM calls on this server —
// this is prompt-serving + CRUD for workflow diagrams only.
export function registerExternalWorkflowRoutes(app: Express) {
  const router = "/api/external/workflows";

  app.get(`${router}/prompt-template`, requireExternalApiKey, externalApiRateLimiter, (_req, res) => {
    res.json({
      system_prompt: EXTERNAL_WORKFLOW_SYSTEM_PROMPT,
      output_schema: externalWorkflowJsonSchema,
      few_shot_examples: EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES,
    });
  });

  app.post(`${router}`, requireExternalApiKey, externalApiRateLimiter, async (req, res) => {
    try {
      const { valid, errors } = validateExternalWorkflow(req.body);
      if (!valid) {
        return res.status(400).json({ error: "Workflow failed schema validation.", details: errors });
      }

      const { nodes, edges, title } = req.body as { nodes: unknown; edges: unknown; title?: string };

      const created = await storage.createExternalWorkflow({
        apiKeyId: req.apiKey!.id,
        title: title || null,
        nodes: nodes as any,
        edges: edges as any,
      });

      const diagramUrl = `${getPublicAppUrl()}/workflows/${created.id}`;
      res.status(201).json({ id: created.id, diagram_url: diagramUrl });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to create workflow:", err);
      res.status(500).json({ error: "Failed to store workflow." });
    }
  });

  app.get(`${router}/:id`, requireExternalApiKey, externalApiRateLimiter, async (req, res) => {
    try {
      const workflow = await storage.getExternalWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found." });
      }
      if (workflow.apiKeyId !== req.apiKey!.id) {
        return res.status(403).json({ error: "You do not have permission to access this workflow." });
      }
      res.json({
        id: workflow.id,
        title: workflow.title,
        nodes: workflow.nodes,
        edges: workflow.edges,
        created_at: workflow.createdAt,
        expires_at: workflow.expiresAt,
        diagram_url: `${getPublicAppUrl()}/workflows/${workflow.id}`,
      });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to fetch workflow:", err);
      res.status(500).json({ error: "Failed to fetch workflow." });
    }
  });

  app.patch(`${router}/:id`, requireExternalApiKey, externalApiRateLimiter, async (req, res) => {
    try {
      const workflow = await storage.getExternalWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found." });
      }
      if (workflow.apiKeyId !== req.apiKey!.id) {
        return res.status(403).json({ error: "You do not have permission to modify this workflow." });
      }

      // Accept either the full body or a nested { workflow: { nodes, edges, title } }
      const body = req.body?.workflow ?? req.body;
      const { valid, errors } = validateExternalWorkflow(body);
      if (!valid) {
        return res.status(422).json({ error: "Workflow failed schema validation.", details: errors });
      }

      const { nodes, edges, title } = body as { nodes: unknown; edges: unknown; title?: string };
      const updated = await storage.updateExternalWorkflow(req.params.id, {
        nodes,
        edges,
        title: title ?? workflow.title,
      });

      if (!updated) {
        return res.status(404).json({ error: "Workflow not found after update." });
      }

      const diagramUrl = `${getPublicAppUrl()}/workflows/${updated.id}`;
      res.json({
        id: updated.id,
        diagram_url: diagramUrl,
        expires_at: updated.expiresAt,
      });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to patch workflow:", err);
      res.status(500).json({ error: "Failed to update workflow." });
    }
  });

  // Public, unauthenticated read used by the /workflows/:id render page —
  // returns only the fields needed to render the diagram (no apiKeyId).
  app.get("/api/public/workflows/:id", async (req, res) => {
    try {
      const workflow = await storage.getExternalWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found." });
      }
      // Treat expired workflows as not found — the cleanup job may not have run yet
      if (workflow.expiresAt && workflow.expiresAt < new Date()) {
        return res.status(404).json({ error: "Workflow has expired." });
      }
      res.json({
        id: workflow.id,
        title: workflow.title,
        nodes: workflow.nodes,
        edges: workflow.edges,
        expires_at: workflow.expiresAt,
      });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to fetch public workflow:", err);
      res.status(500).json({ error: "Failed to fetch workflow." });
    }
  });
}
