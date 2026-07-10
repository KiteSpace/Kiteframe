import type { Express } from "express";
import crypto from "crypto";
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
      res.json({
        id: workflow.id,
        title: workflow.title,
        nodes: workflow.nodes,
        edges: workflow.edges,
        created_at: workflow.createdAt,
        diagram_url: `${getPublicAppUrl()}/workflows/${workflow.id}`,
      });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to fetch workflow:", err);
      res.status(500).json({ error: "Failed to fetch workflow." });
    }
  });

  // One-off admin bootstrap route to issue a new external API key against
  // whichever database this running instance is connected to (dev or prod).
  // Needed because dev/prod use separate databases and the agent has no
  // direct write access to the production database — this lets a key be
  // minted in prod via an authenticated HTTP call instead. Guarded by
  // ADMIN_BOOTSTRAP_SECRET (not the session/API-key auth used elsewhere).
  // The raw key is returned once and never retrievable again.
  app.post("/api/internal/create-external-api-key", async (req, res) => {
    try {
      const providedSecret = req.headers["x-admin-secret"];
      const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
      console.log(`[bootstrap] ADMIN_BOOTSTRAP_SECRET present=${!!expectedSecret} len=${expectedSecret ? expectedSecret.length : 0} NODE_ENV=${process.env.NODE_ENV}`);
      if (!expectedSecret) {
        return res.status(503).json({ error: "ADMIN_BOOTSTRAP_SECRET is not configured on this instance." });
      }
      if (!providedSecret || providedSecret !== expectedSecret) {
        return res.status(401).json({ error: "Invalid admin secret." });
      }

      const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : "claude-code-skill";
      const rawKey = `kf_ext_${crypto.randomBytes(32).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
      const created = await storage.createExternalApiKey({ name, keyHash });

      res.status(201).json({ id: created.id, name: created.name, raw_key: rawKey });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to bootstrap API key:", err);
      res.status(500).json({ error: "Failed to create API key." });
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
      res.json({
        id: workflow.id,
        title: workflow.title,
        nodes: workflow.nodes,
        edges: workflow.edges,
      });
    } catch (err) {
      console.error("[externalWorkflowRoutes] Failed to fetch public workflow:", err);
      res.status(500).json({ error: "Failed to fetch workflow." });
    }
  });
}
