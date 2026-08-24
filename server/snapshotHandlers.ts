/**
 * Snapshot route handlers extracted from routes.ts so they can be unit-
 * tested against the real Express request/response cycle without standing
 * up the entire app (Stripe sync, websockets, OpenAI, etc).
 *
 * Each handler stays a thin function. They use the shared db connection
 * and the shared storage interface — both are mocked in the integration
 * test via vi.mock.
 *
 * Behavior is intentionally identical to the original inline handlers:
 *   - All three require isAuthenticated (mounted in routes.ts).
 *   - userId is taken from req.user.claims.sub via getUserIdFromRequest.
 *   - POST /api/snapshots writes a snapshot, trims autosaves past 50 per
 *     (user, workflow), and mirrors current nodes/edges into a saved
 *     project (auto-create or merge), returning the resolved
 *     cloudProjectId for the client to adopt.
 *   - GET /api/snapshots/:workflowId returns 404 (not []) when there are
 *     no rows the user can see — opaque to cross-user probing.
 *   - POST /api/snapshots/:id/restore returns 404 if the snapshot is not
 *     owned by the requesting user.
 */
import type { Express, Request, Response } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  mergeWorkflowDataPreservingPanelDocs,
  pickPresentPanelDocs,
  shareUpdateDocsFromWorkflowData,
} from '@shared/panelDocs';
import { db } from './db';
import { storage } from './storage';
import { workflowSnapshots } from '../shared/schema';

// Minimal shape of the authenticated user the handler needs. OIDC users
// (Replit) carry `claims.sub`; OAuth users (Google, GitHub) carry `id`.
type AuthUser = { claims?: { sub?: string }; id?: string };
type AuthedRequest = Request & { user?: AuthUser };

// Mirror of the helper in routes.ts. Kept local so this module can be
// imported by tests without pulling in the entire routes graph.
function getUserIdFromRequest(user: AuthUser | undefined): string {
  if (user?.claims?.sub) return user.claims.sub;
  if (user?.id) return user.id;
  throw new Error(
    'Unable to extract user ID from request - invalid user object',
  );
}

// Per-user retention cap for autosaves to prevent unbounded growth.
export const AUTOSAVE_RETENTION_PER_WORKFLOW = 50;

// Shape of saved_projects.workflowData. The column is jsonb (typed as
// unknown by Drizzle), so we narrow it through this type rather than
// casting through `any`. Extra keys are preserved on merge.
export type WorkflowDocument = {
  nodes?: unknown;
  edges?: unknown;
  canvasObjects?: unknown;
  viewport?: unknown;
  flowSettings?: unknown;
  workflowId?: string;
  prdData?: unknown;
  workflowPRDs?: unknown;
  notesData?: unknown;
  detailsData?: unknown;
  [k: string]: unknown;
};

/** Notify live share viewers after a canvas mirror that may carry docs. */
function broadcastMirroredProject(
  req: Request,
  project: {
    isShareEnabled?: boolean | null;
    shareUuid?: string | null;
    workflowData?: unknown;
  },
) {
  if (!project.isShareEnabled || !project.shareUuid) return;
  const appWithBroadcast = req.app as Express & {
    broadcastShareUpdate?: (
      shareId: string,
      data: Record<string, unknown>,
    ) => void;
  };
  const broadcastFn = appWithBroadcast.broadcastShareUpdate;
  if (!broadcastFn) return;
  const wf = (project.workflowData ?? {}) as WorkflowDocument;
  const docs = shareUpdateDocsFromWorkflowData(wf);
  broadcastFn(project.shareUuid, {
    nodes: wf.nodes,
    edges: wf.edges,
    canvasObjects: wf.canvasObjects,
    viewport: wf.viewport,
    flowSettings: wf.flowSettings,
    ...docs,
  });
}

export async function createSnapshotHandler(req: Request, res: Response) {
  try {
    const userId = getUserIdFromRequest((req as AuthedRequest).user);
    const {
      workflowId,
      name,
      description,
      nodes,
      edges,
      metadata,
      isAutoSave,
      cloudProjectId,
      // Optional panel docs — used when auto-creating a cloud row so the first
      // canvas snapshot does not leave shared viewers without documentation.
      prdData,
      workflowPRDs,
      notesData,
      detailsData,
    } = req.body;

    const optionalPanelDocs = pickPresentPanelDocs({
      prdData,
      workflowPRDs,
      notesData,
      detailsData,
    });

    if (!workflowId || !name) {
      return res
        .status(400)
        .json({ error: 'workflowId and name are required' });
    }

    const [snapshot] = await db
      .insert(workflowSnapshots)
      .values({
        workflowId,
        userId,
        name,
        description,
        nodes,
        edges,
        metadata,
        isAutoSave: isAutoSave || false,
      })
      .returning();

    // Trim autosaves beyond the per-(user, workflow) retention cap.
    // Manual snapshots are never trimmed.
    if (isAutoSave) {
      try {
        const oldAutosaves = await db
          .select({ id: workflowSnapshots.id })
          .from(workflowSnapshots)
          .where(
            and(
              eq(workflowSnapshots.userId, userId),
              eq(workflowSnapshots.workflowId, workflowId),
              eq(workflowSnapshots.isAutoSave, true),
            ),
          )
          .orderBy(desc(workflowSnapshots.createdAt))
          .offset(AUTOSAVE_RETENTION_PER_WORKFLOW);

        if (oldAutosaves.length > 0) {
          await db
            .delete(workflowSnapshots)
            .where(
              inArray(
                workflowSnapshots.id,
                oldAutosaves.map((s) => s.id),
              ),
            );
        }
      } catch (trimErr) {
        // Trim failure must never break the save itself.
        console.warn('Snapshot retention trim failed:', trimErr);
      }
    }

    // Persistence unification: every authed snapshot also lands in
    // saved_projects so the Saved Projects drawer reflects current work.
    //   - If the editor sent a cloudProjectId the user owns → MERGE the
    //     latest nodes/edges into that project's workflowData (preserving
    //     canvasObjects, viewport, flowSettings, etc).
    //   - Otherwise, if the workflow has actual content (nodes present),
    //     auto-create an "Untitled — <date>" saved_projects row stamped
    //     with workflowId so future autosaves for this workflow can find
    //     and update it. Empty workflows do not auto-create projects to
    //     avoid cluttering the drawer.
    // Either way, the resolved cloudProjectId is returned in the response
    // so the client can patch it onto the active tab.
    let resolvedCloudProjectId: string | undefined =
      typeof cloudProjectId === 'string' ? cloudProjectId : undefined;

    try {
      const parsedNodes =
        typeof nodes === 'string' ? JSON.parse(nodes) : nodes;
      const parsedEdges =
        typeof edges === 'string' ? JSON.parse(edges) : edges;
      const nodeCount = Array.isArray(parsedNodes) ? parsedNodes.length : 0;

      // Phase 1: try to merge into the cloudProjectId the client supplied,
      // if any. If that id is stale/foreign/deleted we fall through to
      // Phase 2 below — never echo a foreign id back to the client.
      if (resolvedCloudProjectId) {
        const project = await storage.getSavedProject(
          resolvedCloudProjectId,
          userId,
        );
        if (project) {
          const existing: WorkflowDocument =
            project.workflowData && typeof project.workflowData === 'object'
              ? (project.workflowData as WorkflowDocument)
              : {};
          // Canvas-only merge: never replace documentation the author already
          // persisted. Optional docs from the client are applied only when
          // present so an empty localStorage cannot wipe the cloud copy.
          const merged: WorkflowDocument = mergeWorkflowDataPreservingPanelDocs(
            existing,
            {
              workflowId,
              nodes: parsedNodes,
              edges: parsedEdges,
              ...optionalPanelDocs,
            },
          );
          const updated = await storage.updateSavedProject(
            resolvedCloudProjectId,
            userId,
            { workflowData: merged },
          );
          if (updated) broadcastMirroredProject(req, updated);
        } else {
          resolvedCloudProjectId = undefined;
        }
      }

      // Phase 2: if we still don't have a resolved project AND the workflow
      // has actual content, look up an auto-created project for this
      // workflow_id (handles reloads where the tab lost its cloudProjectId
      // but the project still exists), or create a new "Untitled — <date>"
      // row stamped with workflowId. Empty workflows are skipped to avoid
      // cluttering the drawer with empty Untitleds.
      if (!resolvedCloudProjectId && nodeCount > 0) {
        const userProjects = await storage.getSavedProjects(userId);
        const existing = userProjects.find((p) => {
          const wd = p.workflowData;
          return (
            wd &&
            typeof wd === 'object' &&
            (wd as WorkflowDocument).workflowId === workflowId
          );
        });

        if (existing) {
          resolvedCloudProjectId = existing.id;
          const existingDoc: WorkflowDocument =
            existing.workflowData && typeof existing.workflowData === 'object'
              ? (existing.workflowData as WorkflowDocument)
              : {};
          const merged = mergeWorkflowDataPreservingPanelDocs(existingDoc, {
            workflowId,
            nodes: parsedNodes,
            edges: parsedEdges,
            ...optionalPanelDocs,
          });
          const updated = await storage.updateSavedProject(existing.id, userId, {
            workflowData: merged,
          });
          if (updated) broadcastMirroredProject(req, updated);
        } else {
          // Prefer the real workflow name the client sent so the auto-created
          // row matches the user's project. Only fall back to a dated
          // placeholder when the client supplied no usable name.
          const stamp = new Date().toISOString().slice(0, 10);
          const cleanName =
            typeof name === 'string' && name.trim() ? name.trim() : '';
          const created = await storage.createSavedProject({
            userId,
            name: cleanName || `Untitled — ${stamp}`,
            description: 'Auto-created from autosave',
            workflowData: {
              workflowId,
              nodes: parsedNodes,
              edges: parsedEdges,
              ...optionalPanelDocs,
            },
          });
          resolvedCloudProjectId = created.id;
        }
      }
    } catch (mirrorErr) {
      // Mirror failure must never break the snapshot write — the snapshot
      // row is the durable record; the project mirror is a convenience.
      console.warn('saved_projects mirror update failed:', mirrorErr);
    }

    res.json({
      ...snapshot,
      cloudProjectId: resolvedCloudProjectId ?? null,
    });
  } catch (error) {
    console.error('Snapshot creation error:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
}

export async function listSnapshotsHandler(req: Request, res: Response) {
  try {
    const userId = getUserIdFromRequest((req as AuthedRequest).user);
    const { workflowId } = req.params;

    const snapshots = await db
      .select()
      .from(workflowSnapshots)
      .where(
        and(
          eq(workflowSnapshots.workflowId, workflowId),
          eq(workflowSnapshots.userId, userId),
        ),
      )
      .orderBy(desc(workflowSnapshots.createdAt));

    // Per task spec: cross-user reads (or unknown workflowIds) return 404
    // rather than leaking existence via empty arrays. Since workflowId is
    // an opaque client-generated tab id with no separate ownership entity,
    // we treat "no snapshots accessible to caller" as "not found".
    if (snapshots.length === 0) {
      return res
        .status(404)
        .json({ error: 'No snapshots found for this workflow' });
    }

    res.json(snapshots);
  } catch (error) {
    console.error('Snapshot fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
}

export async function restoreSnapshotHandler(req: Request, res: Response) {
  try {
    const userId = getUserIdFromRequest((req as AuthedRequest).user);
    const { id } = req.params;

    const snapshot = await db
      .select()
      .from(workflowSnapshots)
      .where(
        and(
          eq(workflowSnapshots.id, id),
          eq(workflowSnapshots.userId, userId),
        ),
      );

    if (snapshot.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json(snapshot[0]);
  } catch (error) {
    console.error('Snapshot restore error:', error);
    res.status(500).json({ error: 'Failed to restore snapshot' });
  }
}
