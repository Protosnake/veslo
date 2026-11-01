// Keeps the screen awake while a run is active. The browser releases the
// sentinel automatically when the tab is hidden, so re-request on return.

import { TUNING } from '../config/tuning.js';

type WakeLockSentinelLike = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockApi = {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
};

function getWakeLockApi(): WakeLockApi | null {
  if (typeof navigator === 'undefined') return null;
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  return api ?? null;
}

function readFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  return fallback;
}

function readEnabled(): boolean {
  const envDefault = readFlag(import.meta.env.VITE_WAKE_LOCK, TUNING.wakeLock);
  if (typeof window === 'undefined') return envDefault;
  const query = new URLSearchParams(window.location.search).get('wakeLock');
  return readFlag(query, envDefault);
}

export const WAKE_LOCK_ENABLED = readEnabled();

let sentinel: WakeLockSentinelLike | null = null;
let pending: Promise<void> | null = null;
let wanted = false;

async function request(): Promise<void> {
  const api = getWakeLockApi();
  if (!api || !wanted || sentinel || pending) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  pending = (async () => {
    try {
      const acquired = await api.request('screen');
      if (!wanted) {
        await acquired.release().catch(() => {});
        return;
      }
      sentinel = acquired;
      acquired.addEventListener('release', () => {
        sentinel = null;
        if (wanted && document.visibilityState === 'visible') void request();
      });
    } catch {
      sentinel = null;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

export function acquireWakeLock(): void {
  if (!WAKE_LOCK_ENABLED) return;
  wanted = true;
  void request();
}

export function releaseWakeLock(): void {
  wanted = false;
  const current = sentinel;
  sentinel = null;
  if (current) void current.release().catch(() => {});
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') void request();
  });
}

// Dev-only handle so a run can be validated from the console:
//   __vesloWakeLock.isHeld()  -> true while the screen lock is active
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as Window & { __vesloWakeLock?: unknown }).__vesloWakeLock = {
    acquire: acquireWakeLock,
    release: releaseWakeLock,
    isHeld: () => sentinel !== null,
    isWanted: () => wanted,
    enabled: WAKE_LOCK_ENABLED
  };
}
