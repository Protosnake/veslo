// Runs non-critical construction work when the browser is idle, so boot does
// not block the first frames. Prefers the scheduler API, then
// requestIdleCallback, then a timeout.

type IdleTask = () => void;

type SchedulerApi = {
  postTask: (
    task: IdleTask,
    options?: { priority?: 'user-blocking' | 'user-visible' | 'background' }
  ) => Promise<unknown>;
};

const IDLE_FALLBACK_TIMEOUT_MS = 2000;

function readFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  return fallback;
}

function readEnabled(): boolean {
  const envDefault = readFlag(import.meta.env.VITE_IDLE_DECOR, true);
  if (typeof window === 'undefined') return envDefault;
  const query = new URLSearchParams(window.location.search).get('idleDecor');
  return readFlag(query, envDefault);
}

export const IDLE_DECOR_ENABLED = readEnabled();

type IdleTaskRecord = { name: string; ms: number; at: number };

function runTask(task: IdleTask): void {
  if (!import.meta.env.DEV) {
    task();
    return;
  }

  const start = performance.now();
  try {
    task();
  } finally {
    const win = window as Window & { __vesloIdleRecords?: IdleTaskRecord[] };
    const records = (win.__vesloIdleRecords ??= []);
    records.push({
      name: task.name || 'idle task',
      ms: performance.now() - start,
      at: performance.now()
    });
    if (records.length > 50) records.shift();
  }
}

export function runWhenIdle(task: IdleTask): void {
  if (typeof window === 'undefined') {
    runTask(task);
    return;
  }

  const scheduler = (window as Window & { scheduler?: SchedulerApi }).scheduler;
  if (scheduler && typeof scheduler.postTask === 'function') {
    scheduler.postTask(() => runTask(task), { priority: 'background' }).catch(() => {});
    return;
  }

  const requestIdle = (window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
  }).requestIdleCallback;

  if (typeof requestIdle === 'function') {
    requestIdle(() => runTask(task), { timeout: IDLE_FALLBACK_TIMEOUT_MS });
    return;
  }

  setTimeout(() => runTask(task), 0);
}
