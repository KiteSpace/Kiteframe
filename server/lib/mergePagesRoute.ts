import type { Request, Response } from 'express';
import { z } from 'zod';
import { interfacePlanSchema, inspectGeneratedInterface, MAX_INTERFACE_PAGES } from '../../shared/interfacePlan';
import { mergePageStates } from './mergePageStates';
import { layoutArtboards, sanitizeRootType, type CraftState } from './designPatchMerge';

const mergePagesBody = z.object({
  interfacePlan: interfacePlanSchema,
  pages: z.array(z.object({ screenId: z.string().max(200), craftState: z.string().max(200000) })).min(1).max(MAX_INTERFACE_PAGES),
});

/** Merges per-page Generate UI results. No AI call; 404 unless `mock_workflow_batch` is on. */
export function createMergePagesHandler(isBatchOn: (req: Request) => Promise<boolean>) {
  return async (req: Request, res: Response) => {
    if (!(await isBatchOn(req))) return res.status(404).json({ error: 'Not found.' });
    const parsed = mergePagesBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid page results.' });
    try {
      const states = parsed.data.pages.map((p) => JSON.parse(p.craftState) as CraftState);
      const finalState = layoutArtboards(sanitizeRootType(mergePageStates(states)));
      const coverage = inspectGeneratedInterface(parsed.data.interfacePlan, finalState);
      if (coverage.errors.length) {
        return res.status(422).json({ error: `Some selected screens were not generated correctly. ${coverage.errors.join(' ')}`, warnings: coverage.warnings });
      }
      return res.json({ type: 'state', craftState: JSON.stringify(finalState), warnings: coverage.warnings });
    } catch {
      return res.status(400).json({ error: 'Invalid page results.' });
    }
  };
}
