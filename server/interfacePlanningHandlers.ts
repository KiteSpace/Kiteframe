import type { Request, Response } from 'express';
import { z } from 'zod';
import { interfacePlanSchema, planningWorkflowSchema, type PlanningWorkflow } from '@shared/interfacePlan';
import { buildPlanPreviews, interpretWorkflow, InterfacePlanningTimeoutError, type PlannerModel } from './lib/interfacePlanner';

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
) {
  async function planForReader(
    res: Response,
    workflow: PlanningWorkflow,
    options: { previousPlan?: z.infer<typeof interfacePlanSchema>; userMessage?: string } = {},
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Planning deadline exceeded', 'TimeoutError')), timeoutMs);
    timer.unref?.();
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.once('close', onClose);
    try {
      return await interpretWorkflow(workflow, { ...options, callModel, signal: controller.signal });
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
    try {
      if (!parsed.data.workflow.context && parsed.data.sourceProjectId && loadOwnedContext) {
        parsed.data.workflow.context = await loadOwnedContext(parsed.data.sourceProjectId, req);
      }
      const result = await planForReader(res, parsed.data.workflow);
      if (res.destroyed) return;
      return res.json({ ...result, previews: buildPlanPreviews(result.plan) });
    } catch (error) {
      return planningFailure(res, error, 'Could not interpret the workflow. Please retry.');
    }
  };
  const refine = async (req: Request, res: Response) => {
    const parsed = z.object({
      plan: interfacePlanSchema, userMessage: z.string().min(1).max(4000),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid refinement request. Keep your message under 4,000 characters.' });
    try {
      const result = await planForReader(res, parsed.data.plan.workflow, {
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

