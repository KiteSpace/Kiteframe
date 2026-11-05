import { EventEmitter } from 'node:events';
import type { Express, Request, RequestHandler, Response } from 'express';
import {
  createJob, attachJobAbortController, getActiveJobCount, MAX_CONCURRENT_JOBS_PER_USER,
  setJobRunning, tryFinalizeSuccess, tryFinalizeFailure, cancelJob,
  getActiveJobCountShared,
} from './aiJobStore';
import { creditService } from './creditService';
import { oldestInFlight } from './aiBillingContext';
import { refundDeductedCredit } from './middleware/creditCheck';

/**
 * Opt-in background execution for the existing structured-response handlers.
 * Validation, ownership, model selection and route-specific billing still run
 * unchanged. No loopback HTTP calls or duplicated provider/billing paths.
 */
export function postBackgroundAi(app: Express, path: string, ...handlers: RequestHandler[]) {
  const handler = handlers.pop()!;
  const gate: RequestHandler = async (req, res, next) => {
    try {
      if (req.get('X-AI-Background') === '1' &&
          (await getActiveJobCountShared(creditService.getUserIdentifier(req))) >= MAX_CONCURRENT_JOBS_PER_USER) {
        res.status(429).json({ error: 'Too many concurrent AI operations. Wait for one to finish.' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
  app.post(path, gate, ...handlers, (req: Request, res: Response, next) => {
    if (req.get('X-AI-Background') !== '1') return handler(req, res, next);
    const job = createJob({
      userIdentifier: creditService.getUserIdentifier(req), taskType: path,
      label: 'Agent AI', creditCost: 0, reservedAmount: 0,
    });
    const controller = new AbortController();
    attachJobAbortController(job.id, controller);
    const workerReq = Object.create(req);
    workerReq.body = structuredClone(req.body);
    workerReq.aiOperationSignal = controller.signal;
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number; writableEnded: boolean; destroyed: boolean; headersSent: boolean;
      status: (status: number) => unknown; json: (body: unknown) => unknown;
    };
    Object.assign(response, { statusCode: 200, writableEnded: false, destroyed: false, headersSent: false });
    response.status = status => { response.statusCode = status; return response; };
    let deadline: ReturnType<typeof setTimeout>;
    response.json = body => {
      if (response.writableEnded || response.destroyed) return response;
      response.writableEnded = true;
      response.headersSent = true;
      clearTimeout(deadline);
      if (response.statusCode >= 400) {
        const error = body as { error?: string; message?: string };
        tryFinalizeFailure(job.id, error?.error || error?.message || 'AI action failed', response.statusCode);
        void refundDeductedCredit(req);
      } else {
        tryFinalizeSuccess(job.id, { text: '', payload: body });
      }
      response.emit('finish');
      response.emit('close');
      return response;
    };
    let cancel: { cancelled: true; cancelledAt: number; inFlightSince?: number } | null = null;
    controller.signal.addEventListener('abort', () => {
      if (!response.writableEnded) cancel = { cancelled: true, cancelledAt: Date.now(), inFlightSince: oldestInFlight(req.aiBilling) };
      response.destroyed = true;
      clearTimeout(deadline);
      response.emit('close');
    }, { once: true });
    deadline = setTimeout(() => {
      tryFinalizeFailure(job.id, 'AI operation timed out. Please retry.', 504);
      controller.abort();
    }, 5 * 60_000);
    res.once('close', () => {
      if (!res.writableEnded) cancelJob(job.id);
    });
    res.status(202).json({ jobId: job.id });
    setJobRunning(job.id);
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) return handler(workerReq, response as unknown as Response, next);
    }).catch(error => {
      response.status(500);
      response.json({ error: error instanceof Error ? error.message : 'AI action failed' });
    }).finally(() => {
      // Decided after the handler settles, so a reply that arrived as Stop was pressed stays charged.
      if (cancel) void refundDeductedCredit(req, cancel);
    });
  });
}
