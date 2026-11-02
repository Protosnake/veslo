# 04 — Camera rubberband / follow

Source: `src/core/Renderer.ts`, driven from `src/main.js`.

```mermaid
flowchart TD
    A["main animate() frame"] --> B["setFollowTarget(boat.x, boat.z)"]
    B --> C["updateCamera(dt)"]
    C --> D{"manualCamera?"}
    D -->|yes| E["use manualPosition / manualLook<br/>return early"]
    D -->|no| F["anchor lerp toward followTarget<br/>droneStiffness"]
    F --> G["followLook lerp toward followTarget<br/>aimStiffness"]
    G --> H["procedural drone drift + pan"]
    H --> I["screen-shake offset, decay by shakeDecay"]
    I --> J["camera.position = anchor + rigOffset + drift + shake"]
    J --> K["lookTarget = followLook + pan, y = anchor.y + lookHeight"]
    K --> L["camera.lookAt(lookTarget)<br/>subtle rotor/wind roll"]
    M["settleFollow(x, z) on start/restart"] --> N["snap followTarget, followLook, followLookTarget, anchor"]
    N --> C
```

## Logic

- `setFollowTarget` only receives the boat's current position; there is no velocity feed-forward, so the drone cannot predict the next turn.
- The drone body (`anchor`) follows promptly via `droneStiffness`; the gimbal (`followLook`) trails farther behind via `aimStiffness` and then eases in when the boat slows or stops.
- Exponential smoothing (`1 - exp(-dt * stiffness)`) keeps the trail frame-rate independent and removes the old rubberband overshoot.
- Procedural drift, lazy pan, and rotor roll keep the shot alive without touching the gameplay follow.
- `settleFollow` snaps all camera vectors on start/restart so the camera never sweeps in from an old position.
- Game over reuses `manualCamera`: `main.js` eases a target-lock pose and a 50° horizontal FOV override onto the crash/breach point while `state === 'GAMEOVER'` (see [13-game-over.md](13-game-over.md)).
- Tuning overrides: `?y=`, `?look=`, `?fov=`, `?aim=`, `?drone=`.
- On tall screens the rig yaws 90° about the follow point and the target is shifted by a lead along screen-up; see [36-portrait-mode.md](36-portrait-mode.md).
