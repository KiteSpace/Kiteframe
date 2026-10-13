/**
 * Browser-session operation ownership. Views subscribe; they never own the
 * lifetime of the work. Inputs, setters and retry callbacks retain their origin.
 * This deliberately does not promise recovery across a reload/server restart.
 */
export interface BackgroundOperation {
  key: string;
  label: string;
  originPath: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  controller: AbortController;
  retry: () => Promise<unknown>;
  settled?: boolean;
  committing?: boolean;
}

const operations = new Map<string, BackgroundOperation>();
const listeners = new Set<() => void>();
let snapshot: BackgroundOperation[] = [];
let epoch = 0;
const inFlight = new Set<string>();
let owner: string | null | undefined;
const cells = new Map<string, { value: unknown; listeners: Set<() => void> }>();
const signalOwners = new WeakMap<AbortSignal, string>();

function publish() {
  snapshot = Array.from(operations.values());
  listeners.forEach(fn => fn());
}
export const subscribeOperations = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const getOperations = () => snapshot;
export const getOperationEpoch = () => epoch;
export const operationForSignal = (signal?: AbortSignal) => signal && signalOwners.get(signal);
export const signalForOperation = (key: string) => operations.get(key)?.controller.signal;
export function withOperationSignal<T extends { chat: (...args: any[]) => any }>(client: T, scope: string): T {
  const clientEpoch = epoch;
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'chat') return (request: Record<string, unknown>) => {
        if (clientEpoch !== epoch) return Promise.reject(new DOMException('Account changed', 'AbortError'));
        const signal = (request.signal as AbortSignal | undefined) ?? signalForOperation(scope);
        return Promise.resolve(target.chat({ ...request, signal })).then(result => {
          if (signal) assertOperationActive(signal);
          return result;
        });
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
export function inheritOperationSignal(parent: AbortSignal | undefined, child: AbortSignal) {
  const key = operationForSignal(parent);
  if (key) signalOwners.set(child, key);
}
export function setOperationOwner(next: string | null, force = false) {
  if (force || (owner !== undefined && owner !== next)) {
    operations.forEach(op => op.controller.abort());
    operations.clear();
    inFlight.clear();
    epoch++;
    cells.clear();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai-operation-owner-changed'));
    publish();
  }
  owner = next;
}
export function cancelOperation(key: string, force = false) {
  const op = operations.get(key);
  if (op?.status === 'running' && (force || !op.committing)) {
    op.controller.abort();
    operations.set(key, { ...op, status: 'cancelled' });
    publish();
  }
}
export function dismissOperation(key: string) {
  if (operations.get(key)?.status !== 'running' && operations.get(key)?.settled) {
    operations.delete(key);
    publish();
  }
}
export function cancelOperationsForTarget(id: string) {
  operations.forEach(op => { if (op.key.split(':').includes(id)) cancelOperation(op.key, true); });
}
export function failOperation(key: string, error: unknown) {
  const op = operations.get(key);
  if (op && !op.controller.signal.aborted) {
    operations.set(key, { ...op, error: error instanceof Error ? error.message : String(error) });
    publish();
  }
}
export function assertOperationActive(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Operation cancelled', 'AbortError');
}
/** The provider has finished; do not advertise cancellation of an atomic save. */
export function beginBackgroundCommit(signal: AbortSignal) {
  assertOperationActive(signal);
  const key = operationForSignal(signal);
  const op = key && operations.get(key);
  if (op) {
    operations.set(op.key, { ...op, committing: true });
    publish();
  }
}

/** One mutating action per target, with a synchronous lock before any await. */
export function runBackgroundOperation<T>(
  key: string, label: string, work: (signal: AbortSignal) => Promise<T>,
  originPath = typeof window === 'undefined' ? '/' : window.location.pathname,
): Promise<T | undefined> {
  if (inFlight.has(key)) return Promise.resolve(undefined);
  const controller = new AbortController();
  const startedEpoch = epoch;
  const retry = () => runBackgroundOperation(key, label, work, originPath);
  signalOwners.set(controller.signal, key);
  const op: BackgroundOperation = { key, label, controller, retry, originPath, status: 'running' };
  operations.set(key, op);
  inFlight.add(key);
  publish();
  return Promise.resolve().then(() => {
    assertOperationActive(controller.signal);
    return work(controller.signal);
  }).then(result => {
    if (startedEpoch !== epoch || operations.get(key)?.controller !== controller) return undefined;
    const latest = operations.get(key)!;
    operations.set(key, { ...latest, status: controller.signal.aborted ? 'cancelled' : latest.error ? 'failed' : 'completed' });
    inFlight.delete(key);
    operations.set(key, { ...operations.get(key)!, settled: true });
    publish();
    return result;
  }, error => {
    if (startedEpoch === epoch && operations.get(key)?.controller === controller) {
      operations.set(key, { ...op, status: controller.signal.aborted ? 'cancelled' : 'failed',
        error: error instanceof Error ? error.message : String(error), settled: true });
      inFlight.delete(key);
      publish();
    }
    // UI events are fire-and-forget; errors are retained for error/retry display.
    return undefined;
  });
}

/** A setter belongs to this cell, not whichever component is now mounted. */
export function retainedCell<T>(key: string, initial: T | (() => T)) {
  let cell = cells.get(key);
  if (!cell) {
    cell = { value: typeof initial === 'function' ? (initial as () => T)() : initial, listeners: new Set() };
    cells.set(key, cell);
  }
  const capturedCell = cell;
  const capturedEpoch = epoch;
  return {
    read: () => capturedCell.value as T,
    subscribe: (fn: () => void) => {
      capturedCell.listeners.add(fn);
      return () => { capturedCell.listeners.delete(fn); };
    },
    write: (next: T | ((prev: T) => T), onWrite?: (value: T) => T | void) => {
      if (epoch !== capturedEpoch) return;
      const value = typeof next === 'function' ? (next as (prev: T) => T)(capturedCell.value as T) : next;
      if (Object.is(value, capturedCell.value)) return;
      capturedCell.value = value;
      const normalized = onWrite?.(value);
      if (normalized !== undefined) capturedCell.value = normalized;
      capturedCell.listeners.forEach(fn => fn());
    },
  };
}
