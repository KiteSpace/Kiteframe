/**
 * Addressable project documents (PRDs) and panel documentation (notes / overview).
 *
 * These endpoints give a document a stable server-side address —
 * `/api/project/:projectUuid/documents/:docId` — so a reader pane or a chat
 * artifact card can open one document without loading, parsing and
 * understanding the whole project blob.
 *
 * Storage note: documents are *not* a separate table. They live inside
 * `savedProjects.workflowData` under the existing `prdData` / `workflowPRDs`
 * keys, which the `.kiteframe` export, the share payload and the view-only
 * viewer all already read. See `shared/documents.ts` for why a second store was
 * deliberately avoided. These routes are a read/write *address* over that
 * single source of truth, not a copy of it.
 *
 * Panel docs (notes + overview details) use
 * `PUT /api/project/:projectUuid/panel-docs` so author-side typing can persist
 * independently of a full canvas save, while still merging into the same blob.
 */

import type { Express, Response } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import {
  buildDocId,
  buildDocumentPayload,
  listDocuments,
  parseDocId,
  readDocumentContent,
  resolveDocumentUpdatedAt,
  stampUpdatedAt,
  writeDocumentContent,
  type DocKind,
} from '@shared/documents';
import { shareUpdateDocsFromWorkflowData } from '@shared/panelDocs';

function getUserIdFromRequest(user: any): string {
  if (user?.claims?.sub) return user.claims.sub;
  if (user?.id) return user.id;
  throw new Error('Unable to extract user ID from request');
}

/**
 * A document body is the `ProjectPRD` / `WorkflowPRD` object the client already
 * holds. It is validated structurally rather than exhaustively: the section
 * shape is what the reader pane depends on, while the rest of the object
 * (hashes, version counters, flags) varies by document kind and generation and
 * must be allowed through untouched.
 *
 * Content is deliberately **not** HTML-sanitised here. It is markdown authored
 * by the owner or their AI and rendered as markdown, and the existing project
 * save path (`sanitizeWorkflowContent`) already passes these same keys through
 * unmodified — sanitising only on this newer path would silently mangle
 * documents depending on which endpoint happened to save them.
 */
const documentContentSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string(),
            content: z.string(),
          })
          .passthrough(),
      )
      .max(200),
    manualEditedAt: z.record(z.number()).optional(),
    version: z.number().optional(),
    generatedAt: z.number().optional(),
    workflowId: z.string().optional(),
    workflowName: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
  })
  .passthrough();

const saveDocumentSchema = z.object({
  content: documentContentSchema,
});

/**
 * Notes + overview/details (+ optional project name/description columns).
 * Each field is optional so a notes-only edit does not have to re-send
 * overview, and vice versa. Explicit `null` clears that field.
 */
const savePanelDocsSchema = z
  .object({
    notesData: z.string().nullable().optional(),
    detailsData: z.string().nullable().optional(),
    name: z.string().max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
  })
  .refine(
    (body) =>
      body.notesData !== undefined ||
      body.detailsData !== undefined ||
      body.name !== undefined ||
      body.description !== undefined,
    { message: 'At least one panel-docs field is required' },
  );

interface ResolvedDoc {
  docKind: DocKind;
  workflowId?: string;
}

function resolveDocId(docId: string, res: Response): ResolvedDoc | null {
  const parsed = parseDocId(docId);
  if (!parsed) {
    res.status(400).json({
      error: 'Unknown document id',
      hint: "Expected 'project-prd' or 'workflow-prd:<workflowId>'",
    });
    return null;
  }
  return parsed;
}

/**
 * Load a project the caller owns, or send the right error and return null.
 * Mirrors the ownership rule of `GET /api/project/:projectUuid`: a non-owner
 * gets 403 without learning anything about the project (including its
 * shareUuid). Shared read-only viewers receive documents through the existing
 * share payload instead, so nothing here needs to serve them.
 */
async function loadOwnedProject(req: any, res: Response) {
  const { projectUuid } = req.params;
  const project = await storage.getProjectByProjectUuid(projectUuid);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  const userId = getUserIdFromRequest(req.user);
  if (project.userId !== userId) {
    res.status(403).json({ error: 'Not authorized to access this project' });
    return null;
  }
  return project;
}

export function registerDocumentRoutes(app: Express) {
  // List every document a project holds — metadata only, no content. Lets the
  // rail render a document index without downloading every PRD.
  app.get('/api/project/:projectUuid/documents', isAuthenticated, async (req: any, res) => {
    try {
      const project = await loadOwnedProject(req, res);
      if (!project) return;

      const documents = listDocuments(project.workflowData, {
        projectName: project.name,
        projectUpdatedAt: project.updatedAt,
      });
      res.json({ documents });
    } catch (error) {
      console.error('Error listing project documents:', error);
      res.status(500).json({ error: 'Failed to list documents' });
    }
  });

  // Fetch one document by its stable address.
  app.get('/api/project/:projectUuid/documents/:docId', isAuthenticated, async (req: any, res) => {
    try {
      const resolved = resolveDocId(req.params.docId, res);
      if (!resolved) return;

      const project = await loadOwnedProject(req, res);
      if (!project) return;

      const document = buildDocumentPayload(
        project.workflowData,
        resolved.docKind,
        resolved.workflowId,
        { projectName: project.name, projectUpdatedAt: project.updatedAt },
      );

      if (!document) {
        // The project exists but has never had this document generated. This is
        // an ordinary state, not an error the client should surface — it just
        // means "nothing to show yet".
        return res.status(404).json({
          error: 'Document not found',
          docId: buildDocId(resolved.docKind, resolved.workflowId),
        });
      }

      res.json({ document });
    } catch (error) {
      console.error('Error fetching project document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  // Create or replace one document. Merges into the project blob so the rest of
  // workflowData (canvas, notes, the other PRDs) is preserved.
  app.put('/api/project/:projectUuid/documents/:docId', isAuthenticated, async (req: any, res) => {
    try {
      const resolved = resolveDocId(req.params.docId, res);
      if (!resolved) return;

      const parseResult = saveDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid document data',
          details: parseResult.error.errors,
        });
      }

      const userId = getUserIdFromRequest(req.user);
      const { docKind, workflowId } = resolved;

      // A workflow document carries its own id; trust the address, not the body,
      // so a mismatched payload can't write itself to a different document.
      const content = stampUpdatedAt(
        docKind === 'workflow-prd'
          ? { ...parseResult.data.content, workflowId }
          : parseResult.data.content,
      );

      // Read, merge and write under a row lock. Merging outside one would let a
      // concurrent full-project save slip between the read and the write, and
      // this handler would then write that save's canvas back to its old value.
      // The lock also covers the ownership check, so it cannot go stale.
      const result = await storage.mutateProjectWorkflowData(
        req.params.projectUuid,
        userId,
        (workflowData) => writeDocumentContent(workflowData, docKind, workflowId, content),
      );

      if (result.status === 'notFound') return res.status(404).json({ error: 'Project not found' });
      if (result.status === 'forbidden') {
        return res.status(403).json({ error: 'Not authorized to access this project' });
      }
      const saved = result.project;

      // Keep any live share viewers current, exactly as a full project save does.
      if (saved.isShareEnabled && saved.shareUuid) {
        const broadcastFn = (req.app as any).broadcastShareUpdate;
        if (broadcastFn) {
          const wf = saved.workflowData as any;
          const docs = shareUpdateDocsFromWorkflowData(wf);
          broadcastFn(saved.shareUuid, {
            nodes: wf?.nodes,
            edges: wf?.edges,
            canvasObjects: wf?.canvasObjects,
            viewport: wf?.viewport,
            flowSettings: wf?.flowSettings,
            ...docs,
          });
        }
      }

      const storedContent = readDocumentContent(saved.workflowData, docKind, workflowId);
      res.json({
        document: {
          docId: buildDocId(docKind, workflowId),
          docKind,
          workflowId,
          updatedAt: resolveDocumentUpdatedAt(storedContent ?? content, saved.updatedAt),
        },
      });
    } catch (error) {
      console.error('Error saving project document:', error);
      res.status(500).json({ error: 'Failed to save document' });
    }
  });

  // Persist Project panel notes / overview without a canvas save. Merges into
  // workflowData under the same row lock as document PUT so a concurrent full
  // project save cannot lose the canvas (or the other docs).
  app.put('/api/project/:projectUuid/panel-docs', isAuthenticated, async (req: any, res) => {
    try {
      const parseResult = savePanelDocsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid panel documentation',
          details: parseResult.error.errors,
        });
      }

      const userId = getUserIdFromRequest(req.user);
      const { notesData, detailsData, name, description } = parseResult.data;

      const result = await storage.mutateProjectWorkflowData(
        req.params.projectUuid,
        userId,
        (workflowData) => {
          const base =
            workflowData && typeof workflowData === 'object' ? { ...workflowData } : {};
          if (notesData !== undefined) base.notesData = notesData;
          if (detailsData !== undefined) base.detailsData = detailsData;
          return base;
        },
      );

      if (result.status === 'notFound') return res.status(404).json({ error: 'Project not found' });
      if (result.status === 'forbidden') {
        return res.status(403).json({ error: 'Not authorized to access this project' });
      }

      let saved = result.project;

      // Project name/description live on the row, not inside workflowData.
      if (name !== undefined || description !== undefined) {
        const patched = await storage.updateSavedProject(saved.id, userId, {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        });
        if (patched) saved = patched;
      }

      if (saved.isShareEnabled && saved.shareUuid) {
        const broadcastFn = (req.app as any).broadcastShareUpdate;
        if (broadcastFn) {
          const wf = saved.workflowData as any;
          const docs = shareUpdateDocsFromWorkflowData(wf);
          broadcastFn(saved.shareUuid, {
            nodes: wf?.nodes,
            edges: wf?.edges,
            canvasObjects: wf?.canvasObjects,
            viewport: wf?.viewport,
            flowSettings: wf?.flowSettings,
            ...docs,
          });
        }
      }

      const docs = shareUpdateDocsFromWorkflowData(saved.workflowData);
      res.json({
        projectUuid: saved.projectUuid,
        name: saved.name,
        description: saved.description,
        notesData: docs.notesData,
        detailsData: docs.detailsData,
        updatedAt: saved.updatedAt,
      });
    } catch (error) {
      console.error('Error saving panel documentation:', error);
      res.status(500).json({ error: 'Failed to save panel documentation' });
    }
  });
}
