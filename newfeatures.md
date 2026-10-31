# New Features

1. Birds — obscure view, can hit drone.
2. Weather — rain lowers visibility; snow causes faster battery drain plus lower visibility; summer causes faster battery drain.
3. Widen the play area a bit.
4. Fix laggy/rubberbandy camera movement.
5. Dynamically generated river/area.
6. USSR reskin — USSR ranks as default, UA skins as DLC in the future.
7. Open sea levels, aka La Manche.

## Assessment

| # | Feature | T-shirt | Priority | Notes |
|---|---------|---------|----------|-------|
| 1 | Birds / drone hits | M | P2 | Additive entity + manager. Main cost: drone isn't a real object yet, so a hit proxy/damage model is new. |
| 2 | Weather | S–M | P1 | Battery multiplier is trivial (`main.js` 1043); fog/lights are mutable (`Renderer.js` 42). Rain/snow particles + tuning are the bulk. |
| 3 | Widen play area | M (X) / L (Z) | P2 | Bounds are duplicated magic numbers in `Boat.js`, `River.js`, `Wildlife*.js`, `Smuggler*.js`. Widening X is mostly layout; widening Z is a level redesign. |
| 4 | Camera rubberband | S–M | P1 | Contained in `Renderer.updateCamera`. Velocity is already passed from `main.js` but ignored; static anchor vs. tracking aim is the likely cause. |
| 5 | Dynamic river/area | M–L | P3 | Geometry is already procedural, but centerline, collision, and decoration ranges are fixed. Needs seeded config + `destroy()`. |
| 6 | USSR reskin | S–M (ranks) / L (full) | P1 | Rank data and one SVG sheet are cleanly isolated. A full reskin (boat, OSD, copy) is much larger. |
| 7 | Open sea / La Manche | L | P3 | Needs a formal world contract, level manager, teardown, and level-select UI. River-specific mission logic is the blocker. |

### Priority rationale

**P1 — cheap, high impact, low risk**
- **Camera fix (4):** one-file UX win, already partially wired.
- **Weather (2):** battery hook is tiny; visibility hooks exist; makes runs feel varied.
- **USSR ranks (6):** isolated data/SVG swap; good theming win, DLC path later.

**P2 — worthwhile, moderate risk**
- **Birds (1):** needs the drone to become collidable, but otherwise additive.
- **Widen play area (3):** do X-only first after centralising bounds.

**P3 — architectural, defer until a world refactor**
- **Dynamic river (5)** and **open-sea levels (7)** both need the same groundwork: a `WorldConfig`/bounds contract, spawn-path API, level factory, and `destroy()` lifecycle. Do that refactor once, then both get cheaper.

### Suggested sequence

1. Camera fix (S)
2. Weather (S–M)
3. USSR rank skins (S–M)
4. Birds + drone hits (M)
5. Centralise world bounds → widen area X (M)
6. World contract + `destroy()` → dynamic river (M–L)
7. Open-sea level (L)
