import type { Request, Response } from 'express';
import { z } from 'zod';
import { interfacePlanSchema, planningWorkflowSchema } from '@shared/interfacePlan';
import { buildPlanPreviews, interpretWorkflow, type PlannerModel } from './lib/interfacePlanner';

export function createInterfacePlanningHandlers(
  callModel?: PlannerModel,
  loadOwnedContext?: (projectId: string, req: Request) => Promise<string>,
) {
  const proposal = async (req: Request, res: Response) => {
    const parsed = z.object({
      workflow: planningWorkflowSchema, sourceProjectId: z.string().min(1).max(200).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow context. Include all steps, descriptions, and labeled connections within the supported limits.' });
    try {
      if (!parsed.data.workflow.context && parsed.data.sourceProjectId && loadOwnedContext) {
        parsed.data.workflow.context = await loadOwnedContext(parsed.data.sourceProjectId, req);
      }
      const result = await interpretWorkflow(parsed.data.workflow, { callModel, signal: AbortSignal.timeout(90000) });
      return res.json({ ...result, previews: buildPlanPreviews(result.plan) });
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : 'Could not interpret the workflow. Please retry.' });
    }
  };
  const refine = async (req: Request, res: Response) => {
    const parsed = z.object({
      plan: interfacePlanSchema, userMessage: z.string().min(1).max(4000),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid refinement request. Keep your message under 4,000 characters.' });
    try {
      const result = await interpretWorkflow(parsed.data.plan.workflow, {
        previousPlan: parsed.data.plan, userMessage: parsed.data.userMessage,
        callModel, signal: AbortSignal.timeout(90000),
      });
      return res.json({
        ...result, previews: buildPlanPreviews(result.plan),
        aiMessage: 'Updated the interface plan. Review the requirements and assumptions before generating.',
      });
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : 'Could not refine the plan. Please retry.' });
    }
  };
  return { proposal, refine };
}

