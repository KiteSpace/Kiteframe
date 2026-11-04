import type { Request, Response } from 'express';
import { z } from 'zod';
import { interfacePlanSchema, planningWorkflowSchema, type PlanningWorkflow } from '@shared/interfacePlan';
import { buildPlanPreviews, interpretWorkflow, InterfacePlanningTimeoutError, type PlannerModel } from './lib/interfacePlanner';
import { createStageTimer } from './lib/stageTiming';

// A complete plan (including its one permitted repair) can exceed 90 seconds.
// Keep a bounded deadline, and stop provider work when its reader disconnects.
export const INTERFACE_PLANNING_TIMEOUT_MS = 180_000;

function planningFailure(res: Response, error: unknown, fallback: string) {
  if (res.destroyed) return;
  const timedOut = error instanceof InterfacePlanningTimeoutError ||
    (error instanceof Error && error.name === 'TimeoutError');
  console.warn('[interface-planning] request failed', {
    code: timedOut ? 'INTERFACE_PLANNING_TIMEOUT' : 'INTERFACE_PLANNING_FAILED',
  });
  if (timedOut) {
    return res.status(504).json({
      code: 'INTERFACE_PLANNING_TIMEOUT',
      error: new InterfacePlanningTimeoutError().message,
    });
  }
  return res.status(422).json({ error: error instanceof Error ? error.message : fallback });
}

export function createInterfacePlanningHandlers(
  callModel?: PlannerModel,
  loadOwnedContext?: (projectId: string, req: Request) => Promise<string>,
  timeoutMs = INTERFACE_PLANNING_TIMEOUT_MS,
  /** Per-request planner model (feature flags, stage timing). Ignored when `callModel` is set. */
  modelForRequest?: (req: Request, timer: ReturnType<typeof createStageTimer>) => Promise<PlannerModel>,
) {
  async function planForReader(
    req: Request,
    res: Response,
    workflow: PlanningWorkflow,
    stageTimer: ReturnType<typeof createStageTimer>,
    options: { previousPlan?: z.infer<typeof interfacePlanSchema>; userMessage?: string } = {},
  ) {
    const model = callModel || (modelForRequest ? await modelForRequest(req, stageTimer) : undefined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Planning deadline exceeded', 'TimeoutError')), timeoutMs);
    timer.unref?.();
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once('close', onClose);
    try {
      const result = await interpretWorkflow(workflow, { ...options, callModel: model, signal: controller.signal });
      stageTimer.mark('interpret', { screens: result.plan.screens.length });
      return result;
    } catch (error) {
      if (controller.signal.reason?.name === 'TimeoutError') throw new InterfacePlanningTimeoutError();
      throw error;
    } finally {
      clearTimeout(timer);
      res.off('close', onClose);
    }
  }
  const proposal = async (req: Request, res: Response) => {
    const parsed = z.object({
      workflow: planningWorkflowSchema, sourceProjectId: z.string().min(1).max(200).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow context. Include all steps, descriptions, and labeled connections within the supported limits.' });
    const timer = createStageTimer('interface_planning');
    try {
      if (!parsed.data.workflow.context && parsed.data.sourceProjectId && loadOwnedContext) {
        parsed.data.workflow.context = await loadOwnedContext(parsed.data.sourceProjectId, req);
      }
      timer.mark('context', { nodes: parsed.data.workflow.nodes.length, contextChars: parsed.data.workflow.context?.length ?? 0 });
      const result = await planForReader(req, res, parsed.data.workflow, timer);
      if (res.destroyed) return;
      const previews = buildPlanPreviews(result.plan);
      timer.mark('previews');
      return res.json({ ...result, previews });
    } catch (error) {
      return planningFailure(res, error, 'Could not interpret the workflow. Please retry.');
    }
  };
  const refine = async (req: Request, res: Response) => {
    const parsed = z.object({
      plan: interfacePlanSchema, userMessage: z.string().min(1).max(4000),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid refinement request. Keep your message under 4,000 characters.' });
    const timer = createStageTimer('interface_planning_refine');
    try {
      const result = await planForReader(req, res, parsed.data.plan.workflow, timer, {
        previousPlan: parsed.data.plan, userMessage: parsed.data.userMessage,
      });
      if (res.destroyed) return;
      return res.json({
        ...result, previews: buildPlanPreviews(result.plan),
        aiMessage: 'Updated the interface plan. Review the requirements and assumptions before generating.',
      });
    } catch (error) {
      return planningFailure(res, error, 'Could not refine the plan. Please retry.');
    }
  };
  return { proposal, refine };
}

