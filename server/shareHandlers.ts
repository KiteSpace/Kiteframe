/**
 * Share / view-only route handlers extracted from routes.ts so they can
 * be exercised end-to-end against the real Express request/response
 * cycle without standing up the entire app (Stripe, websockets, OpenAI,
 * Firebase, etc).
 *
 * Behavior is intentionally identical to the original inline handlers
 * (see routes.ts: registerRoutes). They use the shared storage interface
 * so the production code path and the integration test exercise the
 * exact same logic.
 *
 *   - POST   /api/projects/:id/share   enable sharing → { shareUuid, shareUrl, project }
 *   - DELETE /api/projects/:id/share   disable sharing
 *   - GET    /api/view/:shareUuid      view-only fetch (no auth required;
 *                                      owner gets a redirect payload)
 */
import type { Request, Response } from 'express';
import { storage } from './storage';

type AuthUser = { claims?: { sub?: string }; id?: string };
type AuthedRequest = Request & { user?: AuthUser };

// Mirror of the helper in routes.ts. Local copy keeps this module
// importable by tests without pulling in the entire routes graph.
function getUserIdFromRequest(user: AuthUser | undefined): string {
  if (user?.claims?.sub) return user.claims.sub;
  if (user?.id) return user.id;
  throw new Error(
    'Unable to extract user ID from request - invalid user object',
  );
}

/**
 * POST /api/projects/:id/share — enable sharing for a project.
 * Idempotent: a re-share on an already-shared project returns the
 * existing shareUuid so previously-distributed /view URLs keep working.
 */
export async function enableProjectShareHandler(
  req: AuthedRequest,
  res: Response,
) {
  try {
    const userId = getUserIdFromRequest(req.user);
    const { id } = req.params;

    const project = await storage.getSavedProject(id, userId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.isShareEnabled && project.shareUuid) {
      return res.json({
        shareUuid: project.shareUuid,
        shareUrl: `/view/${project.shareUuid}`,
        project,
      });
    }

    const updated = await storage.enableProjectSharing(id, userId);
    if (!updated) {
      return res.status(500).json({ error: 'Failed to enable sharing' });
    }

    res.json({
      shareUuid: updated.shareUuid,
      shareUrl: `/view/${updated.shareUuid}`,
      project: updated,
    });
  } catch (error) {
    console.error('Error enabling project sharing:', error);
    res.status(500).json({ error: 'Failed to enable sharing' });
  }
}

/**
 * DELETE /api/projects/:id/share — disable sharing for a project.
 */
export async function disableProjectShareHandler(
  req: AuthedRequest,
  res: Response,
) {
  try {
    const userId = getUserIdFromRequest(req.user);
    const { id } = req.params;

    const updated = await storage.disableProjectSharing(id, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Immediately drop any live viewers of the (now disabled) share link.
    if (updated.shareUuid) {
      (req.app as any).purgeShareSubscriptions?.(updated.shareUuid);
    }

    res.json({ success: true, project: updated });
  } catch (error) {
    console.error('Error disabling project sharing:', error);
    res.status(500).json({ error: 'Failed to disable sharing' });
  }
}

/**
 * POST /api/projects/:id/share/lock — set/clear the "locked down" flag on a
 * shared project. Locking keeps the share link valid (isShareEnabled stays
 * true) but makes the read-only view inaccessible until the owner unlocks.
 * Owner-only. Body: { locked: boolean }.
 */
export async function setProjectShareLockHandler(
  req: AuthedRequest,
  res: Response,
) {
  try {
    const userId = getUserIdFromRequest(req.user);
    const { id } = req.params;
    const locked = req.body?.locked === true;

    const updated = await storage.setProjectShareLock(id, userId, locked);
    if (!updated) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // When locking down, immediately drop any live viewers so they're excluded
    // from the viewer count and stop receiving updates right away.
    if (locked && updated.shareUuid) {
      (req.app as any).purgeShareSubscriptions?.(updated.shareUuid);
    }

    res.json({ success: true, isShareLocked: updated.isShareLocked, project: updated });
  } catch (error) {
    console.error('Error setting project share lock:', error);
    res.status(500).json({ error: 'Failed to update share lock' });
  }
}

/**
 * GET /api/view/:shareUuid — view-only access via shareUuid (or legacy
 * shareId). No auth required; if the caller IS the owner we return a
 * redirect payload so the editor opens instead of the read-only viewer.
 *
 * ISOLATION GUARANTEE:
 *   Project data is resolved exclusively by `shareUuid` via
 *   `storage.getProjectByShareUuid(shareUuid)`, which queries the
 *   database with `WHERE shareUuid = ? AND isShareEnabled = true`.
 *   The response is therefore completely independent of:
 *     - Which project the author currently has open in their editor tab
 *     - Whether the author is logged in or has an active session
 *     - Any other server-side session state
 *   The only session-aware check is `req.user?.claims?.sub` used to
 *   detect if the *caller* is the owner (to redirect them to the editor
 *   instead of the read-only view). Non-owner viewers always receive
 *   the shared project's last-saved snapshot regardless of auth state.
 *
 * Documentation fields are stored in two possible shapes depending on
 * how the project was saved:
 *   1. Flat (prdData / notesData / detailsData) — written by
 *      SavedProjectsDrawer when the user explicitly saves to the cloud;
 *      these are the canonical share-link fields.
 *   2. Nested (workflowData.documentation.projectPRD) — written when a
 *      .kiteframe v2.1.0 file is imported and its workflowData is
 *      persisted directly (e.g. server-side import tools).
 * We surface whichever is present so every share-link code path works.
 *
 * Project Overview details (categories / createdAt / updatedAt) ride
 * along inside the `detailsData` JSON string — SavedProjectsDrawer
 * copies it verbatim from localStorage('kiteframe-details-<projectId>').
 */
export async function viewSharedProjectHandler(
  req: AuthedRequest,
  res: Response,
) {
  try {
    const { shareUuid } = req.params;

    const project = await storage.getProjectByShareUuid(shareUuid);

    if (project) {
      const userId = req.user?.claims?.sub;
      if (userId && project.userId === userId) {
        return res.json({
          redirect: `/project/${project.projectUuid}`,
          projectUuid: project.projectUuid,
          isOwner: true,
        });
      }

      // Locked down by the author: keep the link valid but deny access.
      // Returned as a normal success payload (with locked: true) so the
      // viewer can render the access-denied screen instead of the generic
      // "not found" error path.
      if (project.isShareLocked) {
        return res.json({
          locked: true,
          projectName: project.name,
          isOwner: false,
        });
      }

      const workflowData = project.workflowData as any;
      const doc = workflowData?.documentation;
      return res.json({
        shareUuid: project.shareUuid,
        projectName: project.name,
        projectDescription: project.description,
        nodes: workflowData?.nodes || [],
        edges: workflowData?.edges || [],
        canvasObjects: workflowData?.canvasObjects,
        viewport: workflowData?.viewport,
        flowSettings: workflowData?.flowSettings,
        prdData: workflowData?.prdData ?? doc?.projectPRD ?? null,
        workflowPRDs:
          workflowData?.workflowPRDs ?? doc?.workflowPRDs ?? null,
        notesData: workflowData?.notesData ?? null,
        detailsData: workflowData?.detailsData ?? null,
        isOwner: false,
      });
    }

    // Fallback: legacy snapshot share links
    const shareLink = await storage.getShareLink(shareUuid);
    if (shareLink) {
      const metadata = shareLink.projectMetadata as
        | { name?: string; description?: string }
        | null;
      return res.json({
        shareUuid: shareLink.shareId,
        projectName: metadata?.name || 'Shared Workflow',
        projectDescription: metadata?.description,
        nodes: shareLink.nodes || [],
        edges: shareLink.edges || [],
        canvasObjects: shareLink.canvasObjects,
        viewport: shareLink.viewport,
        flowSettings: shareLink.flowSettings,
        isOwner: false,
      });
    }

    return res
      .status(404)
      .json({ error: 'Shared project not found or sharing is disabled' });
  } catch (error) {
    console.error('Error fetching view-only project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}
