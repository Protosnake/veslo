// Registers the build-generated service worker for offline play. The worker
// itself (sw.js) is emitted by the `offline-service-worker` plugin in
// vite.config.js, so registration is production-only.

function readSeconds(value: unknown, fallbackSeconds: number): number {
  if (typeof value !== 'string' || value.trim() === '') return fallbackSeconds;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackSeconds;
  return parsed;
}

function readUpdateIntervalMs(): number {
  const envSeconds = readSeconds(import.meta.env.VITE_SW_UPDATE_INTERVAL, 300);
  if (typeof window === 'undefined') return envSeconds * 1000;
  const query = new URLSearchParams(window.location.search).get('swUpdate');
  return readSeconds(query, envSeconds) * 1000;
}

export const UPDATE_INTERVAL_MS = readUpdateIntervalMs();

export function registerOfflineServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  let lastUpdateCheck = 0;

  const checkForUpdate = () => {
    const now = Date.now();
    if (now - lastUpdateCheck < UPDATE_INTERVAL_MS) return;
    lastUpdateCheck = now;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {});
  };

  const register = () => {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then(() => checkForUpdate())
      .catch(() => {});
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('focus', checkForUpdate);
  window.addEventListener('online', checkForUpdate);

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
