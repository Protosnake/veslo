# Features

Status key: **Done** = shipped, **In progress** = partially implemented, **TODO** = not implemented.

Implemented features have a Mermaid logic diagram under `docs/features/`. The project-local hook in `.opencode/plugin/diagram-sync.js` queues a diagram refresh when a tracked source file changes.

| # | Feature | Status | T-shirt | Priority | Logic diagram | Notes |
|---|---------|--------|---------|----------|---------------|-------|
| 1 | Birds / drone hits | In progress | M | P2 | — | Ambient flying birds shipped (see #10). Remaining cost: drone isn't a real object yet, so a collision/hit proxy and damage model are still new. |
| 2 | Weather | TODO | S–M | P1 | — | Hooks are in place: battery drain (`main.js`), fog (`Renderer.ts`), and the shared river-current object. Rain/snow particles + tuning are the bulk. |
| 3 | Widen play area | **Done** | M (X) / L (Z) | P2 | [03-widen-play-area.md](docs/features/03-widen-play-area.md) | Shipped at 125% X / 150% Z. Bounds are centralised in `src/world/Bounds.ts` and overridable with `?worldX=` / `?worldZ=`. |
| 4 | Camera rubberband | **Done** | S–M | P1 | [04-camera-follow.md](docs/features/04-camera-follow.md) | Simplified follow in `Renderer.updateCamera`; velocity is no longer the source of the jitter. |
| 5 | Dynamic river/area | TODO | M–L | P3 | — | Geometry is already procedural, but centerline, collision, and decoration ranges are fixed. Needs seeded config + `destroy()`. |
| 6 | USSR reskin | TODO | S–M (ranks) / L (full) | P1 | — | Current ranks are Ukrainian SBGS. USSR ranks as default + UA skins as DLC has not started. |
| 7 | Open sea / La Manche | TODO | L | P3 | — | Needs a formal world contract, level manager, teardown, and level-select UI. River-specific mission logic is the blocker. |
| 8 | Oar auto-aim / head smack | **Done** | S | P1 | [08-oar-auto-aim.md](docs/features/08-oar-auto-aim.md) | Swing locks the closest swimming smuggler and aims the blade at their head (`src/entities/Boat.js`, `smugglers` passed from `src/main.js`). |
| 9 | Man overboard / oarsman pickup | **Done** | M | P1 | [09-man-overboard.md](docs/features/09-man-overboard.md) | Sharp top-speed turns can throw the oarsman overboard; hard rock hits and fast stern-on rock hits while turning always do. Landing spots avoid rock clusters so he stays reachable. Lose the oar until the boat drives back over him (`src/entities/Boat.js`, `src/main.js`). |
| 10 | Flying birds (singles, flocks, migration skeins) | **Done** | S–M | P2 | [10-flying-birds.md](docs/features/10-flying-birds.md) | Ambient birds cross the river in both directions at several altitudes: lone birds, loose flocks, and V-formation migration skeins. Procedural low-poly models with synced flapping/gliding; no collision (`src/entities/Birds.js`, updated from `src/main.js`). |
| 11 | Storks / hunting dives | **Done** | M | P2 | [11-storks.md](docs/features/11-storks.md) | White storks (`аист`) always fly alone and occasionally dive at frogs/snakes, shrinking on the descent and growing back on the climb. They pitch nose-down toward the water while diving, nose-up while climbing, and ease back to level in cruise. A successful catch is carried in the beak at the prey's body centre, held perpendicular to the bird's flight direction. Debug: `VITE_STORK_ALWAYS_DIVE=1` / `?storkDive=1` forces constant dives; `VITE_STORK_SPAWN_INTERVAL` / `?storkSpawn=` sets seconds between dedicated stork spawns; `VITE_STORK_SPAWN_WEIGHT` / `?storkWeight=` sets the stork share of the random bird mix (`src/entities/Birds.js`, `src/entities/WildlifeManager.js`). |
| 12 | Ranking system rework | **Done** | S | P1 | [12-ranking.md](docs/features/12-ranking.md) | Per-run quadratic thresholds with tunables in `src/config/ranking.ts` and `src/config/difficulty.ts`; promotion queue prevents skipped ranks; speed and spawn scaling are asymptotic instead of capped (`src/systems/RankSystem.ts`, `src/entities/SmugglerManager.js`, `src/main.js`). |
| 13 | Game over target-lock screen | **Done** | M | P1 | [13-game-over.md](docs/features/13-game-over.md) | Game over no longer uses a modal: the drone approaches from the river side (so it does not clip into bank rocks/reeds), narrows its FOV onto the crash/breach point, and tracks a breached smuggler who runs inland for up to 5 seconds before vanishing and the camera releases. Score/stats (including best streak)/rank live in an aligned after-action strip below the target, and the redeploy button uses the green OSD style (`src/main.js`, `src/entities/Smuggler.js`, `src/entities/SmugglerManager.js`, `index.html`, `src/style.css`). |
| 14 | Engine failure smoke, flame, oil leak | **Done** | S | P2 | [14-engine-failure.md](docs/features/14-engine-failure.md) | When the outboard is destroyed by a rock, reeds or sand, the cowl gets a flickering additive flame, black smoke particles, and a dark oil slick on the water. Effects reset on redeploy (`src/entities/Boat.js`, `src/world/River.js`). |
| 15 | Rock-safe crash freeze and separation | **Done** | S | P1 | [15-rock-separation.md](docs/features/15-rock-separation.md) | Fatal rock hits push the hull clear by the rock's visual radius, and crashed boats stop simulating entirely: no throttle, momentum or river-current drift, so they cannot slide through stones after game over (`src/entities/Boat.js`). |
| 16 | Oar kill streak | **Done** | S | P2 | [16-kill-streak.md](docs/features/16-kill-streak.md) | Compact oar-anchored row with a small 5 s timer ring beside the `×N` multiplier. Whacks, ramming, motor shreds and AK shots all feed the streak; kills pop `+100 БУМ`, `+200 ЛЯП`, etc., with words cycling БУМ → ЛЯП → ГЕП across the run. Best streak is shown in the game-over report. Multi-kills from one swing batch into one combined popup. Window override: `VITE_KILL_STREAK_SECONDS` / `?streak=`. No point multiplier (`src/main.js`, `src/entities/Boat.js`, `src/entities/SmugglerManager.js`, `src/systems/I18n.ts`, `src/style.css`). |
| 17 | Watchtower cinematic intro | **Done** | M | P1 | [17-cinematic-intro.md](docs/features/17-cinematic-intro.md) | Multi-shot pre-game sequence: soldier on binoculars in a south-bank watchtower, binocular POV of the minivan drop, then a hard cut to the single 3D drone shot of it rising from behind the tower, a fuzzy CONNECTING feed, and finally the gameplay camera with the uplink alert. HUD is hidden until the game starts (`src/main.js`, `src/entities/WatchtowerSoldier.js`, `src/entities/Drone.js`, `src/systems/ConnectScreen.js`, `src/world/River.js`, `index.html`, `src/style.css`). |

## Shipped since this list was drafted

- [x] Widen play area to 125% x 150% with configurable scale (`src/world/Bounds.ts`).
- [x] Simplified camera follow to remove rubberbanding (`src/core/Renderer.ts`).
- [x] Bank ramming rules and smuggler ram slowdown (`src/entities/Boat.js`, `SmugglerManager.js`).
- [x] Non-fatal rock collisions with partner swearing (`src/entities/Boat.js`, `src/main.js`).
- [x] AK battery mode, rotor stall, and floating corpses (`src/entities/Boat.js`, `Smuggler.js`, `main.js`).
- [x] Whack oar tracks and strikes the closest swimming smuggler's head (`src/entities/Boat.js`).
- [x] Oarsman can fall overboard on sharp high-speed turns and is picked up by driving the hull over him; hard rock hits and fast turning stern hits always throw him, landing in rock-free water (`src/entities/Boat.js`, `src/main.js`).
- [x] Game-over space-to-restart throttle (5s) to prevent accidental instant restarts.
- [x] Forgiving prop-in-reeds collisions: grazing the reed line only drags the boat, and backing away pulls the prop free instead of ending the run (`src/entities/Boat.js`).
- [x] Incremental TypeScript migration started: `tsc --noEmit` tooling plus typed core modules (`src/core/Renderer.ts`, `src/systems/I18n.ts`, `Logger.ts`, `RankSystem.ts`, `RankSprites.ts`, `src/world/Bounds.ts`). Remaining JS is checked as it is converted (`checkJs: false`).
- [x] Ambient flying birds: lone birds, loose flocks, and V-formation migration skeins crossing the river in both directions (`src/entities/Birds.js`, `src/main.js`).
- [x] **Done** — Ranking rework: per-run quadratic curve (`70n² + 500n`, rounded down to 50), officer tier from 10,150, General at 31,650; queued promotion banners; asymptotic difficulty scaling; tunables centralised in `src/config/ranking.ts` and `src/config/difficulty.ts`.
- [x] **Done** — Game over target-lock screen: camera zooms onto the crash/breach, no modal, breached smuggler keeps running inland, aligned after-action report below the target, and OSD-green redeploy button (`src/main.js`, `src/entities/Smuggler.js`, `src/entities/SmugglerManager.js`, `index.html`, `src/style.css`).
- [x] **Done** — Game-over camera approaches from the river side and climbs clear of rock colliders, removing near-plane/geometry clipping on crash shots (`src/main.js`).
- [x] **Done** — Engine-failure effects: flickering cowl flame, black smoke, and an oil slick on the water after motor-destroying crashes (`src/entities/Boat.js`).
- [x] **Done** — Crash freeze/separation: fatal rock hits push the hull out by the rock's visual radius, and a crashed boat no longer advects on the river current or accepts input (`src/entities/Boat.js`).
- [x] **Done** — Global military typography: bundled SIL-OFL Oswald applied to every game surface (OSD, HUD, modals, buttons, game over) with its licence in `src/assets/fonts/`.
- [x] **Done** — Oar kill streak: oar-anchored 5 s timer with multiplier-only badge, `+200 ЛЯП`-style batched popups, run-wide cycling words and best-streak stat in the game-over report (`src/main.js`, `src/entities/Boat.js`, `src/entities/SmugglerManager.js`, `src/style.css`).
- [x] **Done** — Watchtower cinematic intro: soldier with binoculars, binocular POV of the van drop, a single hard-cut drone rise, a fuzzy CONNECTING feed, and a cut to the gameplay camera with the HUD hidden until the run starts (`src/main.js`, `src/entities/WatchtowerSoldier.js`, `src/entities/Drone.js`, `src/systems/ConnectScreen.js`, `src/world/River.js`).

## Assessment

### Priority rationale

**P1 — cheap, high impact, low risk**
- ~~**Camera fix (4):** one-file UX win, already partially wired.~~ Done.
- **Weather (2):** battery hook is tiny; visibility hooks exist; makes runs feel varied.
- **USSR ranks (6):** isolated data/SVG swap; good theming win, DLC path later.

**P2 — worthwhile, moderate risk**
- **Birds (1):** needs the drone to become collidable, but otherwise additive.
- ~~**Widen play area (3):** do X-only first after centralising bounds.~~ Done.

**P3 — architectural, defer until a world refactor**
- **Dynamic river (5)** and **open-sea levels (7)** both need the same groundwork: a `WorldConfig`/bounds contract, spawn-path API, level factory, and `destroy()` lifecycle. Do that refactor once, then both get cheaper.

### Suggested sequence

1. ~~Camera fix (S)~~ Done
2. Weather (S–M)
3. USSR rank skins (S–M)
4. Birds + drone hits (M)
5. ~~Centralise world bounds → widen area X (M)~~ Done
6. World contract + `destroy()` → dynamic river (M–L)
7. Open-sea level (L)
