# 35 — Battery-out chase camera

Source: `src/core/ChaseCamera.ts`, `src/core/MountCamera.ts`, `src/entities/BoatOfficer.js`, `src/main.js`, `src/config/tuning.ts`, `src/style.css`.

```mermaid
flowchart TD
    A["updateBattery(dt): battery hits 0"] --> B["batteryDead = true<br/>AK mode on"]
    B --> C["beginBatteryChaseCamera()<br/>BATTERY_CAMERA = pov (default) or chase"]
    C --> D["ChaseCamera.start(boat, fromPose = current drone pose)<br/>FOV override = chaseCamera.fov"]
    D --> E["animate() while PLAYING"]
    E --> F["ChaseCamera.update(dt)<br/>pos = boat - heading*distance + height<br/>look = boat + heading*lookAhead<br/>eases in over blendSeconds"]
    F --> G["Renderer.setManualCamera(pos, look)"]
    E --> H["batteryDeadTimer += dt<br/>battery bar fills 0 -> 100"]
    H --> I{"timer >= BATTERY_RECHARGE_SECONDS<br/>(default 30)?"}
    I -->|no| E
    I -->|"last 5 s"| R["oarsman ChestRadio rumbles + yellow motion strokes<br/>'DRONE READY IN n SEC'"]
    R --> S["last 0.8 s: static overlay fades in"]
    S --> I
    I -->|yes| J["endBatteryChaseCamera()<br/>clear manual camera + FOV"]
    J --> K["drone view returns, BATTERY RECHARGED"]
    B --> AK{"akEnabled?<br/>(default false)"}
    AK -->|no| AK1["strike = oar slap"]
    AK -->|yes| AK2["fireAkShot()"]
    B --> L{"crash / breach while chasing?"}
    L -->|yes| M["chaseCamera.stop()<br/>game-over focus starts from current pose + FOV"]
```

`ChaseCamera` is renderer-agnostic: it takes any `{ position, angle? }` target and exposes `position`/`look`; the caller applies the pose. Reuse it for other entities or cinematic shots by calling `start(target, fromPose)` / `update(dt)` / `stop()`.

`pov` mode uses `MountCamera`: the eye sits on the engine operator's head joint (head/helmet hidden), faces along the boat, near plane drops to 0.1, and it rolls with the hull. `MountCamera` accepts any `{ anchor, orientation? }` object pair, so it works for any entity.

Radio countdown: in the last `droneReadyCountdownSeconds` (5) of the recharge the oarsman's `ChestRadio` shakes and emits cartoon motion strokes, with a "DRONE READY IN n SEC" label. The last `droneSwitchStaticSeconds` (0.8) before the cut shows TV static over the view (and half of that after it) so the POV-to-drone switch is masked. Knobs `VITE_DRONE_READY_COUNTDOWN_SECONDS`, `VITE_DRONE_SWITCH_STATIC_SECONDS`.

Knobs: `VITE_BATTERY_CAMERA` / `?batteryCam=pov|chase`, `VITE_POV_CAMERA_FOV` (80), `VITE_POV_CAMERA_BLEND_SECONDS` (0.8), `VITE_BATTERY_RECHARGE_SECONDS` / `?recharge=` (default 30), `VITE_CHASE_CAMERA_DISTANCE`, `_HEIGHT`, `_BLEND_SECONDS`, `_FOV`.

## Decisions

- **Battery-out shows the engine operator's first-person view, not a black screen.** Why: the black screen was dead time; seeing the scene keeps the player engaged. Alternative: third-person `ChaseCamera`, built first and kept as `?batteryCam=chase`.
- **Cameras are decoupled from the renderer and from the battery feature.** `ChaseCamera` and `MountCamera` only compute a pose; callers apply it via `Renderer.setManualCamera`. Why: reuse for other entities and cinematic shots.
- **Recharge is 30 s (was a hard-coded 5 s) and the bar fills during it.** Why: gives the new view time to matter and shows progress.
- **AK shooting is disabled while the battery is dead (`TUNING.akEnabled = false`).** The code, audio and reload stay; only `triggerStrike`/`fireAkShot` are gated in `main.js`. Why: battery-out is being reworked around camera views and AK interferes with testing. Re-enable with `VITE_AK_ENABLED=1` or `?ak=1`.
- **Local test overrides go in the gitignored `.env.local`** (e.g. `VITE_START_BATTERY=5`); defaults stay in `src/config/`. Why: `.env` was not ignored, and the game must never require an env file.

- **Decision:** Removed the big top-centre `#pov-score` readout from the first-person view. Kill popups (+100/+500/+50) now appear beside the boat on the impact side (boat-local Z sign of the hit; random for rotor kills or dead-centre hits), pinned to the screen edge at 27% from centre and enlarged in first-person.
  **Why:** The readout was a mistake. Popups projected from the target's world position were often behind or off the first-person camera, so they looked inconsistent or invisible.
  **Alternatives:** Keep projecting over the target (unreliable in POV); keep the score readout (rejected by the user).

- **Decision:** Radio countdown + static cover the POV-to-drone cut instead of cutting instantly. **Why:** the hard cut between two unrelated views felt jarring and gave no warning. **Alternatives:** a fade to black (loses the drone-feed look), a longer camera blend (the drone pose is unrelated to the POV pose).
