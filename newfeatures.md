# New Features

Status key: **Done** = shipped, **In progress** = partially implemented, **Not started** = untouched.

| # | Feature | Status | T-shirt | Priority | Notes |
|---|---------|--------|---------|----------|-------|
| 1 | Birds / drone hits | Not started | M | P2 | Additive entity + manager. Main cost: drone isn't a real object yet, so a hit proxy/damage model is new. |
| 2 | Weather | Not started | S–M | P1 | Hooks are in place: battery drain (`main.js`), fog (`Renderer.js`), and the shared river-current object. Rain/snow particles + tuning are the bulk. |
| 3 | Widen play area | **Done** | M (X) / L (Z) | P2 | Shipped at 125% X / 150% Z. Bounds are centralised in `src/world/Bounds.js` and overridable with `?worldX=` / `?worldZ=`. |
| 4 | Camera rubberband | **Done** | S–M | P1 | Simplified follow in `Renderer.updateCamera`; velocity is no longer the source of the jitter. |
| 5 | Dynamic river/area | Not started | M–L | P3 | Geometry is already procedural, but centerline, collision, and decoration ranges are fixed. Needs seeded config + `destroy()`. |
| 6 | USSR reskin | Not started | S–M (ranks) / L (full) | P1 | Current ranks are Ukrainian SBGS. USSR ranks as default + UA skins as DLC has not started. |
| 7 | Open sea / La Manche | Not started | L | P3 | Needs a formal world contract, level manager, teardown, and level-select UI. River-specific mission logic is the blocker. |

## Shipped since this list was drafted

- [x] Widen play area to 125% x 150% with configurable scale (`src/world/Bounds.js`).
- [x] Simplified camera follow to remove rubberbanding (`src/core/Renderer.js`).
- [x] Bank ramming rules and smuggler ram slowdown (`src/entities/Boat.js`, `SmugglerManager.js`).
- [x] Non-fatal rock collisions with partner swearing (`src/entities/Boat.js`, `src/main.js`).
- [x] AK battery mode, rotor stall, and floating corpses (`src/entities/Boat.js`, `Smuggler.js`, `main.js`).

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
