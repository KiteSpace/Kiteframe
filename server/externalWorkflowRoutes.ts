import type { Express } from "express";
import { storage } from "./storage";
import { requireExternalApiKey } from "./middleware/externalApiAuth";
import { externalApiRateLimiter } from "./middleware/rateLimiter";
import {
  getValidatorForType,
  getPromptTemplateForType,
  URL_TO_DB_TYPE,
  DB_TO_URL_TYPE,
  type UrlEntityType,
  type DbEntityType,
} from "./lib/entitySchemas";
import { validateCraftState, repairCraftState } from "./lib/designSchema";
import { getPublicAppUrl } from "./lib/publicAppUrl";

function resolveType(urlType: string): DbEntityType | null {
  return URL_TO_DB_TYPE[urlType as UrlEntityType] ?? null;
}

export function registerExternalEntityRoutes(app: Express) {
  const prefix = "/api/external";

  // GET /api/external/:entityType/prompt-template
  app.get(
    `${prefix}/:entityType/prompt-template`,
    requireExternalApiKey,
    externalApiRateLimiter,
    (req, res) => {
      const dbType = resolveType(req.params.entityType);
      if (!dbType) {
        return res.status(404).json({ error: "Unknown entity type." });
      }
      try {
        const template = getPromptTemplateForType(dbType);
        res.json(template);
      } catch (err: any) {
        res.status(err.status || 500).json({ error: err.message || "Failed to get prompt template." });
      }
    }
  );

  // POST /api/external/:entityType
  app.post(
    `${prefix}/:entityType`,
    requireExternalApiKey,
    externalApiRateLimiter,
    async (req, res) => {
      const dbType = resolveType(req.params.entityType);
      if (!dbType) {
        return res.status(404).json({ error: "Unknown entity type." });
      }
      try {
        const { data } = req.body || {};
        if (!data || typeof data !== "object") {
          return res.status(400).json({ error: "Request body must contain a 'data' field." });
        }
        let validate: ReturnType<typeof getValidatorForType>;
        try {
          validate = getValidatorForType(dbType);
        } catch (err: any) {
          return res.status(err.status || 500).json({ error: err.message });
        }
        // For 'design' entity type, write to the new designs table (craft.js state) instead of external_entities
        if (dbType === "design") {
          // Repair before validating so minor AI ref issues (dangling refs, missing
          // parent, absent ROOT) don't cause a hard 422. Crucially, we persist the
          // REPAIRED state — not the original — so the stored design is structurally sound.
          const repairedData = repairCraftState(data);
          const { valid: craftValid, errors: craftErrors } = validateCraftState(repairedData);
          if (!craftValid) {
            return res.status(422).json({ error: "Entity failed schema validation.", details: craftErrors });
          }
          const design = await storage.createDesign({
            source: "skill",
            apiKeyId: req.apiKey!.id,
            craftState: repairedData as any,
            title: typeof req.body.title === "string" ? req.body.title : null,
          });
          const entityUrl = `${getPublicAppUrl()}/designs/${design.id}`;
          return res.status(201).json({ id: design.id, url: entityUrl });
        }

        const { valid, errors } = validate(data);
        if (!valid) {
          return res.status(422).json({ error: "Entity failed schema validation.", details: errors });
        }
        const created = await storage.createExternalEntity({
          entityType: dbType,
          apiKeyId: req.apiKey!.id,
          data: data as any,
          sourceEntityId: (req.body.sourceEntityId as string) ?? null,
        });
        const urlType = DB_TO_URL_TYPE[dbType];
        const entityUrl = `${getPublicAppUrl()}/${urlType}/${created.id}`;
        res.status(201).json({ id: created.id, url: entityUrl, expires_at: created.expiresAt });
      } catch (err) {
        console.error("[externalEntityRoutes] Failed to create entity:", err);
        res.status(500).json({ error: "Failed to store entity." });
      }
    }
  );

  // GET /api/external/:entityType/:id  (ownership-gated)
  app.get(
    `${prefix}/:entityType/:id`,
    requireExternalApiKey,
    externalApiRateLimiter,
    async (req, res) => {
      const dbType = resolveType(req.params.entityType);
      if (!dbType) {
        return res.status(404).json({ error: "Unknown entity type." });
      }
      try {
        const entity = await storage.getExternalEntity(req.params.id, dbType);
        if (!entity) {
          return res.status(404).json({ error: "Entity not found." });
        }
        if (entity.apiKeyId !== req.apiKey!.id) {
          return res.status(403).json({ error: "You do not have permission to access this entity." });
        }
        const urlType = DB_TO_URL_TYPE[dbType];
        res.json({
          id: entity.id,
          entity_type: entity.entityType,
          data: entity.data,
          created_at: entity.createdAt,
          expires_at: entity.expiresAt,
          url: `${getPublicAppUrl()}/${urlType}/${entity.id}`,
        });
      } catch (err) {
        console.error("[externalEntityRoutes] Failed to fetch entity:", err);
        res.status(500).json({ error: "Failed to fetch entity." });
      }
    }
  );

  // PATCH /api/external/:entityType/:id  (ownership-gated, in-session refinement)
  app.patch(
    `${prefix}/:entityType/:id`,
    requireExternalApiKey,
    externalApiRateLimiter,
    async (req, res) => {
      const dbType = resolveType(req.params.entityType);
      if (!dbType) {
        return res.status(404).json({ error: "Unknown entity type." });
      }
      try {
        const entity = await storage.getExternalEntity(req.params.id, dbType);
        if (!entity) {
          return res.status(404).json({ error: "Entity not found." });
        }
        if (entity.apiKeyId !== req.apiKey!.id) {
          return res.status(403).json({ error: "You do not have permission to modify this entity." });
        }
        const { data } = req.body || {};
        if (!data || typeof data !== "object") {
          return res.status(400).json({ error: "Request body must contain a 'data' field." });
        }
        let validate: ReturnType<typeof getValidatorForType>;
        try {
          validate = getValidatorForType(dbType);
        } catch (err: any) {
          return res.status(err.status || 500).json({ error: err.message });
        }
        const { valid, errors } = validate(data);
        if (!valid) {
          return res.status(422).json({ error: "Entity failed schema validation.", details: errors });
        }
        const updated = await storage.updateExternalEntity(req.params.id, dbType, { data });
        if (!updated) {
          return res.status(404).json({ error: "Entity not found after update." });
        }
        const urlType = DB_TO_URL_TYPE[dbType];
        res.json({
          id: updated.id,
          url: `${getPublicAppUrl()}/${urlType}/${updated.id}`,
          expires_at: updated.expiresAt,
        });
      } catch (err) {
        console.error("[externalEntityRoutes] Failed to patch entity:", err);
        res.status(500).json({ error: "Failed to update entity." });
      }
    }
  );

  // Public unauthenticated read — used by viewer pages (/workflows/:id, /designs/:id)
  app.get("/api/public/entities/:entityType/:id", async (req, res) => {
    const dbType = resolveType(req.params.entityType);
    if (!dbType) {
      return res.status(404).json({ error: "Unknown entity type." });
    }
    try {
      const entity = await storage.getExternalEntity(req.params.id, dbType);
      if (!entity) {
        return res.status(404).json({ error: "Entity not found." });
      }
      if (entity.expiresAt && entity.expiresAt < new Date()) {
        return res.status(404).json({ error: "Entity has expired." });
      }
      res.json({
        id: entity.id,
        entity_type: entity.entityType,
        data: entity.data,
        expires_at: entity.expiresAt,
      });
    } catch (err) {
      console.error("[externalEntityRoutes] Failed to fetch public entity:", err);
      res.status(500).json({ error: "Failed to fetch entity." });
    }
  });
}

export { registerExternalEntityRoutes as registerExternalWorkflowRoutes };
