# 41 — Beavers

Sources: `src/entities/Beaver.js` (model), `src/entities/BeaverManager.js` (`BeaverActor`, `BeaverManager`), `src/config/beaver.ts` (`BEAVER_TUNING`), `src/systems/Audio.js` (`playBeaver`), `src/main.js`.

```mermaid
flowchart TD
    A["spawn timer"] --> B{"big rock 40-160 m from boat,<br/>no beaver yet?"}
    B -->|yes| C{"sitStartChance"}
    C -->|sitting| E["sit on rock"]
    C -->|swim| D["enter at nearest bank,<br/>swim to rock edge"]
    D --> F["climb arc onto rock"] --> E
    E --> G{"smuggler on its rock<br/>or swimming within fearRadius?"}
    D --> G
    G -->|yes| H["splash, flee away<br/>at 2.2x speed"]
    H --> I["after fleeSeconds: dive, despawn"]
    J["boat within 50 m of a beaver"] --> T{"10 s since last beaver sound?"}
    T -->|yes| K["play random bobr_1..3.mp3<br/>(not the previous one)"]
    T -->|no| Q["silent"]
    K --> S["beaver marked seen: never plays again"]
    Q --> S
    L["rock recycled or beaver 320 m away"] --> M["despawn silently"]
```

## Decisions

- Decision: beavers live in their own `BeaverManager`, not `WildlifeManager`. Why: birds and smugglers iterate `wildlifeManager.creatures` as prey/scare sources and the kill counters assume frog/snake. Alternatives: a third creature type there.
- Decision: beavers only fear smugglers (swimming nearby, or resting on their rock), not the boat. Why: requested behaviour. Alternatives: dive from the boat like frogs.
- Decision: the sound clips are optional files in `public/` (`bobr_1..3.mp3`) fetched at runtime. Why: the YouTube source was age-gated, so the clips are user-supplied; the game runs silently if they are removed.
- Decision: one beaver sound at most every 10 s across all beavers, random of 3 clips, never the same twice in a row, volume 0.2. Why: several beavers in range would otherwise spam. Alternatives: per-beaver cooldown; a second-sighting clip (dropped when the user supplied 3 clips).
- Decision: a beaver is marked seen the first time it enters range, whether or not the throttle let the sound play. Why: stationary boat next to several beavers would otherwise play one sound per beaver every 10 s. Alternatives: retry throttled beavers when the throttle ends (previous behaviour).
