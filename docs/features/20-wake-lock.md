# 20 — Wake Lock (keep the screen on)

Source: `src/systems/WakeLock.ts`, called from `src/main.js`.

```mermaid
flowchart TD
    A["startGame() / resumeGame()"] --> B0{"VITE_WAKE_LOCK<br/>or ?wakeLock= enabled?"}
    B0 -->|no| F["do nothing"]
    B0 -->|yes| B["acquireWakeLock()<br/>wanted = true"]
    C["pauseGame() / onBoatCrash() / onGameOver()"] --> D["releaseWakeLock()<br/>wanted = false"]

    B --> E{"api, wanted,<br/>no sentinel,<br/>no pending,<br/>visible?"}
    E -->|no| F["do nothing"]
    E -->|yes| G["navigator.wakeLock.request('screen')"]
    G -->|resolved| H["store sentinel<br/>listen for 'release'"]
    G -->|rejected/unsupported| I["ignore, stay silent"]

    H --> J["sentinel 'release'"]
    J --> K{"wanted && visible?"}
    K -->|yes| E
    K -->|no| F

    D --> L["release stored sentinel<br/>(no-op if none)"]

    M["document visibilitychange"] --> N{"wanted && visible?"}
    N -->|yes| E
    N -->|no| F

    O["Tab hidden"] --> P["browser auto-releases sentinel<br/>-> 'release' handler, no re-request"]
```

## Logic

- A single module-scoped `wanted` flag records player intent; the sentinel itself is owned by the browser and can be revoked at any time.
- `acquireWakeLock` is idempotent: repeated calls during a run do not stack requests (`sentinel`/`pending` guards).
- The browser requires a secure context and a visible document; unsupported browsers or rejected requests fail silently, so the game is unaffected.
- The screen lock is held across the cinematic intro and gameplay, released on pause and on both game-over paths, and reacquired on resume.
- When the tab is hidden the browser releases the sentinel automatically; on `visibilitychange` back to visible the module re-requests because `wanted` is still true.
- Enabled by default. Toggle for testing with `VITE_WAKE_LOCK=0` (build/env) or `?wakeLock=0` (per-load, overrides the env). Truthy values: `1/true/on/yes`; falsy: `0/false/off/no`. When disabled, `acquireWakeLock()` is a no-op.
