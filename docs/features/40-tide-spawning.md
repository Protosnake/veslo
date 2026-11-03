# 40 — Tide spawning

Source: `src/systems/TideSystem.ts`, `src/entities/SmugglerManager.js` (`pickSpawnPoint`), `src/config/world.ts` (`TIDE_TUNING`), `src/main.js` (indicator, partner lines), `src/style.css`.

```mermaid
flowchart TD
    A["run starts (beginAfterIntro)"] --> B["tide.reset: direction = boat facing X (or VITE_TIDE_START_DIRECTION)<br/>phase = random 60-180 s"]
    B --> C["every frame: tide.update(dt)"]
    C --> D{"secondsLeft <= 8 s?"}
    D -->|"once per phase"| E["warning: partner line + blinking HUD"]
    C --> F{"secondsLeft <= 0?"}
    F -->|yes| G["flip direction, new random phase, partner line<br/>(no slack pause, current untouched)"]
    H["wave timer fires"] --> I["pickSpawnPoint: road points in 100-250 m band"]
    I --> J{"tide enabled?"}
    J -->|yes| K["keep points where (x - boat.x) * direction > 0<br/>boat heading ignored"]
    J -->|no| L["old 75 deg nose cone"]
    K --> M{"any point?"}
    M -->|no| N["retry in 1 s"]
    M -->|yes| O["spawn swimmer"]
```

## Logic

- Direction is along world X (the river axis). Swimmers already alive when the tide flips keep playing out; the dormant/despawn streaming rules clean up ones left behind.
- HUD: an arrow (projected through the camera so it points at the spawn side on screen) with seconds to the flip; blinks yellow during the warning.
- Knobs: `VITE_TIDE_ENABLED` / `?tide=0`, `VITE_TIDE_MIN_SECONDS` / `_MAX_SECONDS` (60/180; `?tideSeconds=N` sets both), `VITE_TIDE_WARNING_SECONDS` (8), `VITE_TIDE_START_DIRECTION` / `?tideStart=` (0).

## Decisions

- **Decision:** One-sided spawning that flips on a timer. **Why:** requested; spawning from both ends while circling a stuck swimmer made it impossible to reach both, and forward-only play was boring. **Alternatives:** nose-cone spawns (old; follows heading so never forces a turn).
- **Decision:** Phase length random 60-180 s, not scaled by rank. **Why:** requested ("fixed"); set min = max for an exact length. **Alternatives:** shorten with rank.
- **Decision:** No slack-water pause at the flip. **Why:** requested. **Alternatives:** 4 s spawn pause.
- **Decision:** The water current does not reverse. **Why:** requested; the tide is only a spawn rule. **Alternatives:** ease the river current on flip (changes boat handling).
