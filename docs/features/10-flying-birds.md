# 10 — Flying birds / flocks / migration skeins

Sources: `src/entities/Birds.js` (`BirdManager`, `BirdGroup`, `Bird`), updated from `src/main.js`.

```mermaid
flowchart TD
    A["BirdManager constructor"] --> B["spawn initial single, flock,<br/>50% skein, one stork"]
    C["main.animate(): BirdManager.update(dt)<br/>skipped while paused"] --> D["spawnTimer -= dt"]
    D --> E{"stork spawn interval configured<br/>and timer elapsed?"}
    E -->|yes| F["spawn spread stork if under cap"]
    E -->|no| G["continue"]
    F --> H{"spawnTimer <= 0 and groups < 5?"}
    G --> H
    H -->|yes| I["pickKind() weighted roll<br/>single 34%, flock 32%, skein 20%, stork 14%"]
    I --> J["spawnGroup(kind)<br/>random direction, off-screen edge"]
    H -->|no| K["update existing groups"]
    J --> K
    K --> L["group.update(dt)"]
    L --> M{"group.finished?"}
    M -->|yes| N["destroy group, remove from list"]
    M -->|no| O["keep group"]
```

```mermaid
flowchart TD
    A["BirdGroup spawn"] --> B{"kind"}
    B -->|single| C["1 bird<br/>Y 5-11, speed 7.5-10.5, size 0.85-1.1"]
    B -->|flock| D["4-8 birds<br/>random back/side offsets<br/>Y 6-12, speed 6.5-9, size 0.6-0.85"]
    B -->|skein| E["V formation, 3-6 pairs<br/>back step 2.4 m, side step 1.35 m<br/>Y 9-14, speed 5.5-7.5, size 0.7-0.98"]
    B -->|stork| F["1 stork<br/>Y 7-11, speed 5.5-7.5, size 1.25-1.45"]
    C --> G["per-frame update"]
    D --> G
    E --> G
    F --> G
    G --> H["x += dir * speed * dt"]
    H --> I["baseZ + sinusoidal z drift<br/>baseY + sinusoidal y drift"]
    I --> J["yaw from z velocity, roll from z velocity * dir"]
    J --> K["for each member:<br/>offset by back/side, add wander + bob"]
    K --> L["animate wings: flap or glide<br/>glide amplitude 0.08, flap amplitude 0.72"]
    L --> M{"x * dir >= BOUND_X?"}
    M -->|yes| N["finished = true, then destroy"]
    M -->|no| G
```

## Logic

- `BirdManager` keeps at most 5 groups and respawns every 4-11 seconds.
- `pickKind()` uses a weighted roll: single bird 34%, flock 32%, migration skein 20%, stork 14% (configurable).
- Initial groups spawn anywhere across the river; later groups enter from the off-screen edge in a random direction.
- Each kind has its own altitude, speed, and size range. Flocks use random offsets; skeins use a strict V formation with much less jitter.
- Members share the group's flap phase, but each has its own bob, wander, yaw, and roll jitter. A slow glide oscillator briefly reduces flap amplitude.
- A group is removed once its lead bird crosses `BOUND_X = sx(118)`.
- Birds are ambient only; there is no collision yet (see feature #1).
- `main.animate()` advances `BirdManager` only when the game is not paused, so groups and spawn timers freeze with the patrol.
