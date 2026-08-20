import { describe, expect, it, vi } from 'vitest';
import type { AiClient, AiRequest, AiResponse } from '../types';
import {
  generateProjectPRD,
  generateWorkflowPRD,
  type WorkflowPRD,
} from '../prdEngine';
import { createAiRouter } from '../router/aiRouter';

const workflowModel = {
  workflowId: 'workflow-1',
  name: 'Reservation workflow',
  nodeCount: 2,
  nodes: [
    { id: 'start', type: 'start', label: 'Start' },
    { id: 'finish', type: 'end', label: 'Finish' },
  ],
  edges: [{ id: 'edge-1', source: 'start', target: 'finish' }],
  entryPoints: ['Start'],
  exitPoints: ['Finish'],
  primaryActions: ['Reserve asset'],
  errorPaths: [],
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clientFrom(handler: (request: AiRequest) => Promise<AiResponse>): AiClient {
  return { chat: handler };
}

describe('PRD generation reliability', () => {
  it('caps section work across simultaneous workflow and project generation', async () => {
    let active = 0;
    let peak = 0;
    const client = clientFrom(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(5);
      active -= 1;
      return { text: 'Generated content' };
    });

    const [workflowPrd, projectPrd] = await Promise.all([
      generateWorkflowPRD(client, workflowModel),
      generateProjectPRD(client, 'project-1', 'Asset reservations', [workflowModel]),
    ]);

    expect(peak).toBeLessThanOrEqual(2);
    expect(workflowPrd.sections).toHaveLength(8);
    expect(projectPrd.sections).toHaveLength(5);
    expect(workflowPrd.sections.every(section => section.content)).toBe(true);
    expect(projectPrd.sections.every(section => section.content)).toBe(true);
  });

  it('retries a capacity response within the queue and returns a complete document', async () => {
    let calls = 0;
    const client = clientFrom(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('AI error: 429 - Too many concurrent AI operations (3/3)');
      }
      return { text: 'Generated after capacity cleared' };
    });

    const prd = await generateProjectPRD(client, 'project-1', 'Asset reservations', [workflowModel]);

    expect(calls).toBe(6);
    expect(prd.sections.every(section => section.content)).toBe(true);
  });

  it('reports capacity waits and resumes while retrying', async () => {
    let calls = 0;
    const statuses: string[] = [];
    const client = clientFrom(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('AI error: 429 - Too many concurrent AI operations (3/3)');
      }
      return { text: 'Generated after capacity cleared' };
    });

    await generateProjectPRD(
      client,
      'project-1',
      'Asset reservations',
      [workflowModel],
      undefined,
      undefined,
      status => statuses.push(status)
    );

    expect(statuses).toEqual(['waiting-for-capacity', 'running']);
  });

  it('preserves manual sections while regenerating every remaining section', async () => {
    const existing: WorkflowPRD = {
      workflowId: workflowModel.workflowId,
      workflowName: workflowModel.name,
      sections: [{ id: 'overview', title: 'Overview', content: 'Human-authored overview' }],
      manualEditedAt: { overview: Date.now() },
      version: 4,
      generatedAt: Date.now(),
    };
    const chat = vi.fn(async () => ({ text: 'Generated content' }));
    const prd = await generateWorkflowPRD(clientFrom(chat), workflowModel, existing);

    expect(chat).toHaveBeenCalledTimes(7);
    expect(prd.sections[0]).toEqual({
      id: 'overview',
      title: 'Overview',
      content: 'Human-authored overview',
    });
  });

  it('cancels queued section work without returning a partial document', async () => {
    const controller = new AbortController();
    const chat = vi.fn((request: AiRequest) => new Promise<AiResponse>((_resolve, reject) => {
      request.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true }
      );
    }));
    const generation = generateWorkflowPRD(clientFrom(chat), workflowModel, undefined, controller.signal);

    await delay(10);
    expect(chat).toHaveBeenCalledTimes(2);

    controller.abort();

    await expect(generation).rejects.toMatchObject({ name: 'AbortError' });
    await delay(0);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('rejects a failed batch instead of returning blank generated sections', async () => {
    const client = clientFrom(async () => {
      throw new Error('AI provider unavailable');
    });

    await expect(
      generateProjectPRD(client, 'project-1', 'Asset reservations', [workflowModel])
    ).rejects.toThrow('AI provider unavailable');
  });

  it('lets the PRD queue own capacity retries instead of invoking router retry or fallback', async () => {
    const chat = vi.fn(async () => {
      throw new Error('AI error: 429 - Too many concurrent AI operations (3/3)');
    });
    const router = createAiRouter(clientFrom(chat));

    await expect(router.chat({
      taskType: 'prd_generation',
      messages: [{ role: 'user', content: 'Write a spec section' }],
    })).rejects.toThrow('429');

    expect(chat).toHaveBeenCalledTimes(1);
  });
});