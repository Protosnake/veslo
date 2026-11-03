# 09 — Man overboard / oarsman pickup

Sources: `src/entities/Boat.js` (risk, fall, drift, recovery), `src/main.js` (alerts and partner lines).

```mermaid
stateDiagram-v2
    [*] --> Aboard
    Aboard --> Risk: speed > 80% max AND turn > 35% max<br/>after 5 s start grace
    Risk --> Aboard: leave fast/turn envelope<br/>or cooldown active
    Risk --> Overboard: risk >= random 0.5 .. 1.5 s
    Aboard --> Overboard: hard rock impact<br/>OR stern hit while fast and turning hard
    Overboard --> Overboard: drift with current, resolve rocks, clamp to bounds
    Overboard --> Aboard: after 0.7 s air time<br/>within 2.4 m of the hull
```

```mermaid
flowchart TD
    H2["rotor hit at speed >= 80% max<br/>(full speed minus ram slowdown)"] --> R2{"50% roll"}
    R2 -->|hit| A
    A["fallOverboard()"] --> B["drop active oar swing"]
    B --> C["throw toward outside of turn<br/>fall offset = 2.6 m"]
    C --> D["findSafeOverboardSpot()"]
    D --> E{"base spot clear of rocks<br/>and inside bounds?"}
    E -->|yes| F["use base spot"]
    E -->|no| G["search rings 2.6, 3.6, 4.6, 5.8, 7.0 m<br/>closest angle to fall direction first"]
    G --> H{"clear spot found?"}
    H -->|yes| F
    H -->|no| I["push fallback point out of overlapping rocks<br/>then clamp to bounds"]
    F --> J["detach playerGroup to scene<br/>set outward velocity + splash + marker"]
    I --> J
    J --> K["updateOverboardPlayer(dt)"]
    K --> L["damp velocity, add 35% river current<br/>resolve rock collisions, clamp bounds"]
    L --> M["bob on waves, pulse marker, rest oar across water"]
    M --> N{"air time > 0.7 s and distance to hull <= 2.4 m?"}
    N -->|no| K
    N -->|yes| O["recoverPlayer()"]
    O --> P["reattach playerGroup to boat<br/>reset pose, 10 s cooldown, splash + callback"]
```

## Logic

- **Risk path:** while off cooldown, being above 80% of max speed *and* above 35% of max turn rate builds `manOverboardRisk`. The fall threshold is randomized between 0.5 s and 1.5 s. Leaving the fast-turn envelope drains the risk at 1.5x.
- **Impact path:** a hard rock impact (normal speed <= -55% of max speed), or a stern-on rock hit while fast and turning hard, always throws him.
- **Landing:** the fall points to the outside of the turn, then searches outward rings for open water so he never lands inside a rock cluster the hull cannot reach.
- **Drift:** the detached oarsman keeps his outward velocity, is damped, carried by 35% of the river current, pushed out of rocks, clamped to the play bounds, and bobs on the wave height.
- **Recovery:** after a 0.7 s minimum air time, driving the hull within 2.4 m picks him up. The boat then has a 10 s cooldown before another fall can start.
- Losing him also costs 8% of boat velocity and cancels any active oar strike. `main.js` receives the `onManOverboard` / `onManRecovered` callbacks from the `Boat` constructor and shows the danger/men-recovered alerts, partner line, screen shake, splash, and alert sound.
- Cross-cutting lifecycle wiring in `main.js` (screen wake lock #20, offline service worker #22) is orthogonal to the fall/drift/recovery flow above and leaves it unchanged.
- **Hit path:** `rollOverboardOnHit` runs before the rotor hit's slowdown: at >= `VITE_RAM_SPEED_KEEP` (0.8) of max speed (full speed minus a ram's slowdown, so a rotor pass right after a ram qualifies) there is a `VITE_ROTOR_OVERBOARD_CHANCE` (0.5) chance. Ramming itself no longer rolls; instead the rammed swimmer is held underwater `VITE_RAM_UNDERWATER_SECONDS` (2) and the rotor ignores a rammed (stunned) swimmer for the whole stun.

## Decisions

- **Decision:** "full speed minus ramming speed" is the ram speed-keep ratio (0.8). **Why:** that is exactly the speed left after a full-speed ram. **Alternatives:** separate threshold knob (more config, same result).
- **Decision:** the ram-overboard roll was removed; ramming submerges the swimmer 2 s instead. **Why:** requested. **Alternatives:** keep a 10% ram roll.
- **Decision:** a rammed swimmer cannot be rotored during the stun. **Why:** requested. **Alternatives:** only while submerged.
- **Decision:** corpse bumps do not roll for overboard. **Why:** only live ram/rotor hits were requested. **Alternatives:** roll on all `applyRamImpact` calls.

## Decisions

- **Decision:** A second hull ram on a swimmer still floating from a ram stun drowns him for +100 (blue "DROWNED!" popup, feeds kill streak).
  **Why:** Rewards re-ramming helpless swimmers instead of leaving the stun as a dead end.
  **Alternatives:** Re-stun (no payoff); award more points (competes with +500 propeller).

```mermaid
flowchart LR
  R[Hull ram] --> S{Already stunned & surfaced?}
  S -- no --> St[Stun, 0 pts, RAM!]
  S -- yes --> D[Drown +100, blue DROWNED!]
```
