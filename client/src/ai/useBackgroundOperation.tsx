import { useCallback, useMemo, useSyncExternalStore, type SetStateAction, type DependencyList } from 'react';
import {
  retainedCell, runBackgroundOperation, subscribeOperations, getOperations,
  cancelOperation, dismissOperation, failOperation, getOperationEpoch,
} from './backgroundOperations';

export function useRetainedAiState<T>(
  scope: string, field: string, initial: T | (() => T), onWrite?: (value: T) => T | void,
): [T, (value: SetStateAction<T>) => void] {
  const epoch = useSyncExternalStore(subscribeOperations, getOperationEpoch, getOperationEpoch);
  const cell = useMemo(() => retainedCell<T>(`${scope}::${field}`, initial), [scope, field, epoch]);
  const value = useSyncExternalStore(cell.subscribe, cell.read, cell.read);
  // Capture persistence callbacks too: late writes must not use a new project's ref.
  const set = useCallback((next: SetStateAction<T>) => cell.write(next, onWrite), [cell, onWrite]);
  return [value, set];
}
export function useRetainedAiRef<T>(scope: string, field: string, initial: T): { current: T } {
  const epoch = useSyncExternalStore(subscribeOperations, getOperationEpoch, getOperationEpoch);
  return useMemo(() => {
    const cell = retainedCell<T>(`${scope}::${field}`, initial);
    return { get current() { return cell.read(); }, set current(value: T) { cell.write(value); } };
  }, [scope, field, epoch]);
}

export function useBackgroundCallback<A extends unknown[], T>(
  scope: string, label: string, callback: (signal: AbortSignal, ...args: A) => Promise<T>, deps: DependencyList,
) {
  const epoch = useSyncExternalStore(subscribeOperations, getOperationEpoch, getOperationEpoch);
  return useCallback((...args: A) => {
    const projectId = scope.split(':')[1];
    const origin = scope.startsWith('design:') && projectId !== 'local' ? `/designs/${projectId}` :
      /^[0-9a-f-]{36}$/i.test(projectId ?? '') ? `/project/${projectId}` : window.location.pathname;
    return runBackgroundOperation(scope, label, signal => callback(signal, ...args), origin);
  }, [scope, label, epoch, ...deps]);
}

export function BackgroundOperationStatus({ scope }: { scope: string }) {
  const ops = useSyncExternalStore(subscribeOperations, getOperations, getOperations);
  const op = ops.find(item => item.key === scope);
  if (!op || op.status === 'completed') return null;
  return (
    <div className="mb-2 flex items-center gap-2 text-xs" data-testid="background-operation-status">
      <span role="status">{op.status === 'running' ? op.committing ? 'Saving result…' : `${op.label} — continues while you navigate.` :
        op.status === 'cancelled' ? 'AI operation cancelled.' : op.error || 'AI operation failed.'}</span>
      {op.status === 'running'
        ? <button type="button" className="underline" disabled={op.committing} onClick={() => cancelOperation(scope)}>Stop</button>
        : <><button type="button" className="underline" disabled={!op.settled} onClick={() => void op.retry()}>Retry</button>
          <button type="button" aria-label="Dismiss operation" onClick={() => dismissOperation(scope)}>Dismiss</button></>}
    </div>
  );
}
export { failOperation };
