import type { NodeStatus } from '../types';

export function cycleStatus(current?: NodeStatus): NodeStatus {
  if (!current || current === 'todo') return 'inprogress';
  if (current === 'inprogress') return 'done';
  return 'todo';
}
