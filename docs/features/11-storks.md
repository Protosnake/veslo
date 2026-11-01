# 11 — Storks / hunting dives

Sources: `src/entities/Birds.js` (`BirdGroup` stork state machine), `src/entities/WildlifeManager.js` (`catchPrey`).

```mermaid
stateDiagram-v2
    [*] --> Cruise
    Cruise --> Cruise: cooldown > 0<br/>or scan timer > 0<br/>or no valid prey
    Cruise --> Diving: cooldown <= 0 AND prey found<br/>(debug forces a dive)
    Diving --> Diving: progress < 1<br/>descend, shrink, slide toward prey
    Diving --> Rising: progress >= 1<br/>splash, try catch, attach prey crosswise
    Rising --> Cruise: progress >= 1<br/>restore altitude/scale<br/>cooldown 7 .. 15 s
```

```mermaid
flowchart TD
    A["Cruise: scan timer"] --> B["findPrey(x, z)"]
    B --> C["for each live, non-diving creature"]
    C --> D{"forward distance in 1.5 .. 16 m<br/>and side distance <= 14 m?"}
    D -->|no| C
    D -->|yes| E["score = forward + 1.5 * abs(side)<br/>keep lowest score"]
    E --> C
    C --> F["best prey or none"]
    F --> G{"prey found or debug mode?"}
    G -->|no| A
    G -->|yes| H["Diving<br/>duration = clamp(forward / speed, 0.55, 2.5)"]
    H --> I["ease progress squared:<br/>y -> 0.35, scale -> 0.55<br/>z offset -> prey z<br/>pitch nose down (clamped 0.75 rad)"]
    I --> J{"progress >= 1?"}
    J -->|no| I
    J -->|yes| K["splash at strike point"]
    K --> L["preyManager.catchPrey(target, x, z, 3.5)"]
    L --> M{"caught?"}
    M -->|yes| N["attach prey to stork beak<br/>centered on prey body<br/>crosswise (perpendicular to flight)"]
    M -->|no| O["empty splash"]
    N --> P["Rising, 0.9 s<br/>pitch nose up from vertical speed"]
    O --> P
    P --> Q["restore y and scale, clear z offset<br/>pitch eases back to level<br/>Cruise cooldown 7 .. 15 s"]
    Q --> A
```

## Logic

- Storks always fly alone and use a higher, slower flight profile than other birds.
- `findPrey` only targets live creatures ahead of the stork (1.5-16 m forward, within 14 m sideways) and prefers the lowest `forward + 1.5 * |side|` score.
- On commit, dive duration comes from the forward distance divided by flight speed, clamped to 0.55-2.5 s. The stork shrinks to 55% scale and slides toward the prey's Z position.
- At the bottom it emits a splash and calls `catchPrey` with a 3.5 m radius. `catchPrey` rejects dead, finished, or diving prey and removes the caught creature from the wildlife list.
- A caught frog/snake is re-parented to the stork's beak at the prey's body center, oriented crosswise (perpendicular to the bird's flight direction), then carried through the climb.
- `Rising` takes 0.9 s, restores scale and altitude, then sets a 7-15 s cruise cooldown.
- Storks are advanced by the shared `BirdManager.update(dt)` loop that `main.animate()` runs unless the game is paused, so their dive state freezes with the patrol like the other birds.
- Stork pitch follows its vertical speed: the nose angles down toward the water during a dive, up away from it during the climb, and eases back to level in cruise. Pitch is clamped to 0.75 rad (~43°) and smoothed so the transitions do not snap.
- Debug/tuning: `?storkDive=1` / `VITE_STORK_ALWAYS_DIVE=1` forces dives, `?storkSpawn=` / `VITE_STORK_SPAWN_INTERVAL` adds dedicated spawns, `?storkWeight=` / `VITE_STORK_SPAWN_WEIGHT` changes the random bird mix.
- Cross-cutting lifecycle wiring in `main.js` (screen wake lock #20, offline service worker #22) is orthogonal to the stork state machine above and leaves it unchanged.
