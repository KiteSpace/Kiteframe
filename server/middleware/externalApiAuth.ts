import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import type { ExternalApiKey } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      apiKey?: ExternalApiKey;
    }
  }
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
}

// Bearer-token auth for the external API surface (e.g. Claude Code skill).
// Separate from normal session auth — looks up a sha256 hash of the
// presented key against externalApiKeys, rejects missing/unknown/revoked
// keys, and marks lastUsedAt on success.
export async function requireExternalApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return res.status(401).json({ error: "Missing or malformed Authorization header. Expected 'Bearer <api-key>'." });
    }
    const rawKey = match[1].trim();
    if (!rawKey) {
      return res.status(401).json({ error: "Empty API key." });
    }

    const keyHash = hashKey(rawKey);
    const apiKey = await storage.getExternalApiKeyByHash(keyHash);

    if (!apiKey || apiKey.revokedAt) {
      return res.status(401).json({ error: "Invalid or revoked API key." });
    }

    req.apiKey = apiKey;
    // Fire-and-forget: don't block the request on this bookkeeping write.
    storage.touchExternalApiKeyLastUsed(apiKey.id).catch((err) => {
      console.error("[externalApiAuth] Failed to update lastUsedAt:", err);
    });

    next();
  } catch (err) {
    console.error("[externalApiAuth] Unexpected error:", err);
    res.status(500).json({ error: "Internal authentication error." });
  }
}
