# 08 — Oar auto-aim / head smack

Sources: `src/main.js` (input and AK fallback), `src/entities/Boat.js` (swing, aim, hitbox), `src/entities/SmugglerManager.js` (hit resolution).

```mermaid
flowchart TD
    A["Space keydown or 500 ms held-repeat"] --> B["main.triggerStrike()"]
    B --> C{"batteryDead and AK target?"}
    C -->|yes| D["fireAkShot()"]
    C -->|no| E["boat.triggerSlap()"]
    E --> F{"overboard, already slapping,<br/>or cooldown > 0?"}
    F -->|yes| G["ignore"]
    F -->|no| H["isSlapping = true<br/>slapCooldown = 0.5 s<br/>clear previous target"]
    H --> I["Boat.update(): progress = slapTime / 0.35"]
    I --> J{"target already acquired?"}
    J -->|no| K["findWhackTarget(smugglers)<br/>nearest live swimming target within 6 m"]
    J -->|yes| L["keep locked target"]
    K --> L
    L --> M{"target exists?"}
    M -->|yes| N["updateOarAim(target)<br/>convert target to boat-local space<br/>aim at head +0.3 m<br/>quaternion + length scale"]
    M -->|no| O["fixed oar arc fallback"]
    N --> P["animate windup 0-0.2<br/>strike 0.2-0.55<br/>recover 0.55-1.0"]
    O --> P
    P --> Q["getWhackHitbox()<br/>active only while 0.02 < slapTime < 0.32<br/>center = oarTip world position<br/>radius = 2.8"]
    Q --> R["SmugglerManager.update() priority check"]
    R --> S{"whack distance <= 2.8?"}
    S -->|yes| T["smack target, +100 points"]
    T --> T2["SmugglerManager flushes per-swing whack batch<br/>main.onSmugglerSmacked(count)<br/>cosmetic streak + no score change"]
    S -->|no| U{"motor distance <= 2.2?"}
    U -->|yes| V["shred target, +500 points, motor stall"]
    U -->|no| W{"hull distance <= 2.6?"}
    W -->|yes| X["ram target, +50 points"]
    W -->|no| Y["no hit"]
```

## Logic

- The swing locks the first valid target at the start of the strike, so the blade cannot chase a different smuggler after the intended one is already hit.
- `findWhackTarget` only considers live, visible smugglers in the `swimming` state within 6 m.
- `updateOarAim` converts the target to boat-local coordinates, aims at the head (`group.y + 0.3`) from the oar pivot (`y + 1.5`), and scales the oar length to the distance.
- The hitbox follows the visible blade tip (`oarTip`) when a target is locked; without a target it uses the fixed swing arc.
- Hit priority is oar whack (+100), then motor shred (+500), then hull ram (+50).
- Successful whacks are accumulated per swing and flushed together by `SmugglerManager`; `main.js` registers the cosmetic streak with the batch count (see [16-kill-streak.md](16-kill-streak.md)). Points per kill are unchanged.
- While the oarsman is overboard, `getWhackHitbox()` returns `null`, so the detached oar cannot hit anything.
- Cross-cutting lifecycle wiring in `main.js` (screen wake lock #20, offline service worker #22) is orthogonal to the strike/aim flow above and does not change it.
