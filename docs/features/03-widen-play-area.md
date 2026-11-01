# 03 — Widen play area

Source: `src/world/Bounds.ts`. Consumers include `src/world/River.js`, `src/entities/Boat.js`, `src/entities/Birds.js`, `src/entities/SmugglerManager.js`, and `src/main.js`.

```mermaid
flowchart TD
    A["window.location.search"] --> B["readScale('worldX', 1.25)"]
    A --> C["readScale('worldZ', 1.5)"]
    B --> D["parseFloat + Number.isFinite"]
    C --> D
    D --> E["clamp 0.5 .. 3"]
    E --> F["WORLD_X_SCALE / WORLD_Z_SCALE"]
    F --> G["sx(value) = value * WORLD_X_SCALE"]
    F --> H["sz(value) = value * WORLD_Z_SCALE"]
    G --> I["PLAY_MIN_X = sx(-31.5)<br/>PLAY_MAX_X = sx(31.5)"]
    H --> J["PLAY_MIN_Z = sz(-14.6)<br/>PLAY_MAX_Z = sz(14.4)"]
    H --> K["RIVER_HALF_WIDTH = sz(16)"]
    I --> L["Boat movement, barrier/rock collision, overboard clamping"]
    J --> L
    K --> M["River geometry and prop/reeds decoration"]
    I --> N["Smuggler spawn and lifetime bounds"]
    J --> N
    I --> O["Bird flight bounds: BOUND_X = sx(118), Z = +/-sz(22)"]
    J --> O
```

## Logic

1. Read `?worldX=` and `?worldZ=` from the URL, falling back to 1.25 (125% long) and 1.5 (150% wide).
2. Reject non-finite values and clamp valid values to `0.5 .. 3`.
3. Export the scales plus `sx`/`sz` helpers; every world position, gameplay limit, river width, and spawn range derives from them.
4. Changing the defaults or URL parameters rescales the whole play area in sync without touching individual systems.
