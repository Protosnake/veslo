// Backend-Connected Debug Logger and HUD Overlay for Observability

interface DebugBoat {
  position: { x: number; z: number };
  speed: number;
  maxSpeed: number;
  angle: number;
  isSlapping: boolean;
}

interface DebugSmugglerManager {
  smugglers: unknown[];
}

class DebugLogger {
  enabled = false;
  fps = 60;
  frames = 0;
  lastTime = performance.now();
  overlayElement: HTMLElement | null = null;

  constructor() {
    this.createOverlay();
    this.initBackendPolling();
  }

  createOverlay(): void {
    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'debug-overlay';
    this.overlayElement.style.cssText = `
      position: absolute;
      top: 90px;
      left: 20px;
      background: rgba(10, 15, 20, 0.92);
      border: 1px solid #4ade80;
      color: #4ade80;
      font-family: var(--font-military);
      font-size: 11px;
      line-height: 1.45;
      padding: 10px 14px;
      border-radius: 8px;
      z-index: 999;
      pointer-events: none;
      display: none;
      max-width: 340px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.6);
    `;
    document.body.appendChild(this.overlayElement);

    // Global keyboard listener for F2 or Backtick (`)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2' || e.key === '`') {
        this.toggle();
      }
    });
  }

  async initBackendPolling(): Promise<void> {
    // The debug backend only exists in the Vite dev server; on static hosting
    // there is nothing to poll, so skip it (F2 still shows the overlay locally).
    if (import.meta.env.PROD) return;

    // Check backend status immediately and every 3 seconds
    const check = async () => {
      try {
        const res = await fetch('/api/debug/status');
        if (res.ok) {
          const data = await res.json();
          if (data.enabled !== this.enabled) {
            this.enabled = data.enabled;
            this.updateOverlayVisibility();
            console.log(`[DEBUGGER] Backend toggle updated state: ${this.enabled ? 'ACTIVE' : 'INACTIVE'}`);
          }
        }
      } catch (e) {}
    };

    check();
    setInterval(check, 3000);
  }

  updateOverlayVisibility(): void {
    if (this.overlayElement) {
      this.overlayElement.style.display = this.enabled ? 'block' : 'none';
    }
  }

  async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    this.updateOverlayVisibility();

    // Inform backend
    try {
      await fetch('/api/debug/toggle', { method: 'POST' });
    } catch (e) {}

    this.sendBackend('SYSTEM', `Debug logging ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    return this.enabled;
  }

  sendBackend(type: string, message: string, data: unknown = null): void {
    if (!this.enabled) return;
    try {
      fetch('/api/debug/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, data })
      }).catch(() => {});
    } catch (e) {}
  }

  log(category: string, message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    const time = new Date().toISOString().substring(11, 19);
    console.log(`%c[${time}] [${category}]`, 'color: #4ade80; font-weight: bold;', message, ...args);
    this.sendBackend(category, message, args.length ? args : null);
  }

  error(category: string, message: string, ...args: unknown[]): void {
    console.error(`[${category}]`, message, ...args);
    this.sendBackend('ERROR', `${category}: ${message}`, args.length ? args : null);
  }

  update(boat: DebugBoat, smugglerManager: DebugSmugglerManager | null | undefined, score: number, rankTitle = ''): void {
    if (!this.enabled || !this.overlayElement) return;

    this.frames++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastTime = now;
    }

    const bPos = boat.position;
    const activeCount = smugglerManager ? smugglerManager.smugglers.length : 0;

    this.overlayElement.innerHTML = `
      <div style="font-weight:bold; color:#ffd000; margin-bottom:4px;">🐞 DEBUG (Backend Synced / F2)</div>
      <div>FPS: <span style="color:#fff;">${this.fps}</span></div>
      <div>Boat Pos: <span style="color:#fff;">X:${bPos.x.toFixed(1)} Z:${bPos.z.toFixed(1)}</span></div>
      <div>Boat Spd: <span style="color:#fff;">${boat.speed.toFixed(1)}</span> (Max: ${boat.maxSpeed})</div>
      <div>Angle: <span style="color:#fff;">${(boat.angle * 180 / Math.PI).toFixed(0)}°</span></div>
      <div>Slap state: <span style="color:#fff;">${boat.isSlapping ? 'ACTIVE' : 'IDLE'}</span></div>
      <div>Swimmers Active: <span style="color:#fff;">${activeCount}</span></div>
      <div>Score: <span style="color:#fff;">${score}</span></div>
      <div>Rank: <span style="color:#ffd000;">${rankTitle}</span></div>
    `;
  }
}

export const logger = new DebugLogger();
