# 15 — Rock-safe crash freeze and separation

Source: `src/entities/Boat.js`.

```mermaid
flowchart TD
    A["Boat.update(dt)"] --> B["updateEngineFailureFx(dt)"]
    B --> C{"isCrashed?"}
    C -->|yes| D["holdCrashedPose(): zero velocity/speed/angular velocity<br/>copy frozen position + wave bob<br/>return"]
    C -->|no| E["input, momentum, river current"]
    E --> F{"engine rock / reeds / sand?"}
    F -->|no| G["normal collision pass"]
    F -->|yes| H["isCrashed = true<br/>zero velocity"]
    H --> I["separateFromRock(engineRock, 3.1)<br/>push hull outside visualRadius + clearance"]
    I --> J["startEngineFailure + holdCrashedPose"]
    J --> K["onLandCrash(reason)"]
    L["bounceOffBarrier(rockHit)"] --> M["push out by visualRadius + 2.6"]
```

## Logic

- Rock collision separation now uses `visualRadius` (the visible dodecahedron scale) instead of the smaller physics radius, with enough clearance for the hull/motor, so the mesh does not visibly enter the stone.
- Fatal engine rock hits run `separateFromRock` before the crash callback, placing the boat fully outside the rock.
- Once `isCrashed` is true, `update` short-circuits to `holdCrashedPose`. No input, momentum, steering or river-current advection is applied after the failure frame.
- `holdCrashedPose` keeps the frozen hull at the crash point with only the existing wave bob, so the game-over camera can circle above without the boat sliding through rocks or reeds.
- `reset()` clears `isCrashed` for the next run.
