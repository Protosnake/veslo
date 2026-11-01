---
name: sprite-review
description: Use when starting, continuing, or reviewing a game sprite in the dev sprite viewer. Always loads the selected sprite in the viewer, shares its deep-link URL in chat, and waits for the user's visual feedback before changing anything. Triggers include "sprite review", "review the boat", "next sprite", "start the first sprite", "load it in the viewer", and any sprite name from the catalog.
---

# Sprite review

Drive one-sprite-at-a-time visual review through the dev viewer. The user is
the visual oracle: load the sprite, give them a clickable URL, and wait.

## Non-negotiables

- Always load the sprite in the dev viewer and share the full URL in chat before
  asking for feedback.
- Never use Playwright, Puppeteer, or headless screenshots to judge visuals
  (project rule in `AGENTS.md`).
- Do not change the sprite until the user replies with visual feedback.
  Suggestions are allowed and encouraged; edits are not.
- Do not move on to another sprite until the current one is locked or the user
  asks to switch.

## 1. Pick the sprite ID

The catalog source of truth is `src/dev/sprites.js` (`SPRITES`). The review
tracker is `docs/sprite-review.md`; use its summary table for IDs, sources, and
status.

| User says | ID |
|---|---|
| boat / patrol boat / first one | `boat` |
| walking smuggler | `smuggler-walking` |
| swimming smuggler | `smuggler-swimming` |
| frog | `frog` |
| snake | `snake` |
| crow / bird | `bird-crow` |
| stork | `bird-stork` |
| drone | `drone` |
| minivan / van | `minivan` |
| soldier idle | `soldier-idle` |
| soldier binoculars | `soldier-binoculars` |
| soldier radio | `soldier-radio` |

If the user says "next" or "continue", find the first sprite in
`docs/sprite-review.md` whose status is `Not reviewed` or `In review` and use
its ID. If still ambiguous, ask one short question.

## 2. Make sure the viewer is running

The Vite dev server uses port `5174` (`vite.config.js`).

```bash
curl -sI http://localhost:5174/ | head -n 1
```

If that is not a `200`/`304`, start it in the background and wait for it:

```bash
npm run dev >/tmp/veslo-dev.log 2>&1 &
```

Then poll `curl -sI http://localhost:5174/` until it responds. Do not block the
session on a foreground dev server.

## 3. Build and verify the deep link

URL format:

```text
http://localhost:5174/?dev=sprites&sprite=<id>
```

Examples:

- Boat: `http://localhost:5174/?dev=sprites&sprite=boat`
- Stork: `http://localhost:5174/?dev=sprites&sprite=bird-stork`

The viewer reads `sprite=<id>` on mount, falls back to the first catalog entry
for unknown IDs, and keeps the URL in sync when the user clicks another sprite
or presses `←`/`→`. If the page does not select the requested sprite, fix
`src/dev/SpriteViewer.js` before continuing.

## 4. Share it and stop

Reply with a short message containing:

- The sprite name and ID.
- The clickable URL.
- A one-line prompt for feedback.

Example:

```md
Loaded **Patrol boat** (`boat`) in the dev preview:
http://localhost:5174/?dev=sprites&sprite=boat

Take a look and tell me what to change.
```

Then end the turn. Wait for the user's feedback.

## What you may suggest

You are expected to go beyond "does it look nice". After sharing the URL, you
may proactively add a short **Suggestions** list. Keep every item a proposal,
not an edit:

- **Performance:** mesh and draw-call count, triangle budget, shared
  geometry/material reuse, unnecessary shadow casters, per-frame allocations,
  instancing opportunities, and mobile fill-rate cost. Name the hot path or
  builder and the expected payoff.
- **Visual quality:** silhouette, proportions, scale, material palette,
  lighting contrast, seams, normals, shadow correctness, and readability at
  gameplay distance.
- **Behaviour and physical logic:** whether the model's movement/abilities make
  sense for the object and the game's rules. Flag contradictions, for example:
  - A boat cannot turn like a car: it needs lateral slip, stern swing, mass and
    inertia, and no zero-radius pivoting.
  - A frog cannot eat a bird: prey direction must match the food chain (storks
    eat frogs/snakes, not the reverse).
  - A stork should not carry arbitrary objects in its beak; only valid prey.
  - A drone should not fly through solid geometry or hover without rotor motion.
  - A swimming smuggler should not walk on the riverbed or breathe underwater
    without the snorkel being represented.
  If the current behaviour is intentionally arcade-style, say so and suggest the
  smallest plausible fix rather than a full simulation rewrite.
- **Consistency:** scale/detail level next to the other sprites, shared naming,
  reuse of existing helpers, and whether a change would break an established
  gameplay rule.

Write each suggestion as: what feels wrong, why (visual/physics/performance),
where it lives, and the smallest change that would test the idea. If the user
accepts one, then follow section 5.

## 5. Work from feedback

When feedback arrives:

1. Read the sprite's section in `docs/sprite-review.md` and the shared checklist.
2. Open the source file from the summary table.
3. Make only the requested change (plus obvious correctness fixes such as buried
   geometry or missing shadow flags).
4. Keep the viewer honest: if the change alters what the viewer builds, verify
   the builder adapter in `src/dev/sprites.js` still frames it.
5. Re-share the same URL. Vite hot-reloads, so no new URL is needed.
6. Record the finding and decision in `docs/sprite-review.md`, update its status
   (`In review`, `Revised`, or `Locked`), and append to the review log.
7. If the change is gameplay logic rather than pure model art, update the linked
   Mermaid diagram under `docs/features/` and `features.md`.

## Boundaries

- Visual polish alone does not require a `features.md` status change.
- Never claim the sprite "looks good" on the user's behalf.
- Do not batch multiple sprites into one review unless the user asks.
- Do not start the full game to inspect a sprite; use the isolated viewer.
