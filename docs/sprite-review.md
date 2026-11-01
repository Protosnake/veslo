# Sprite review

Structured working document for reviewing every game model in isolation. Companion to the dev viewer described in [34-sprite-viewer.md](features/34-sprite-viewer.md).

## How to use

1. Run `npm run dev`.
2. Open `http://localhost:5174/?dev=sprites`.
3. Pick a sprite from the left list.
4. Review it from at least three angles: front three-quarter, side, and top-down.
5. Turn on `Wireframe` to inspect topology and `Grid` for scale.
6. Record findings under that sprite's **Findings** block.
7. Update the **Status** column in the summary table and add a dated entry to the [review log](#review-log).

Viewer shortcuts: drag orbit, wheel/pinch zoom, right-drag/shift-drag pan, `←/→` cycle, `W` wireframe, `G` grid, `Space` pause, `A` auto-rotate, `R` reset view. When a sprite exposes a rig (the idle soldier), the **Rig joints** panel poses each joint with X/Y/Z sliders.

## Status legend

| Status | Meaning |
|---|---|
| Not reviewed | Model exists and is in the viewer, but no quality pass has happened. |
| In review | Notes collected; changes proposed or in progress. |
| Revised | Geometry/materials changed and verified in the viewer. |
| Locked | Reviewed and accepted for the current art direction. |

## Summary

| # | Viewer ID | Sprite | Group | Source | Motion in viewer | Status |
|---|---|---|---|---|---|---|
| 1 | `boat` | Patrol boat | Boat | `src/entities/Boat.js` | Static | In review |
| 2 | `oar` | Oar | Boat | `src/entities/Oar.js` | Static | In review |
| 3 | `boat-officer` | Boat — seated officer | Boat | `src/dev/sprites.js` (boat + soldier) | A/D steering | In review |
| 4 | `smuggler-walking` | Smuggler — walking | Smugglers | `src/entities/Smuggler.js` | Static | Not reviewed |
| 5 | `smuggler-swimming` | Smuggler — swimming | Smugglers | `src/entities/Smuggler.js` | Static | Not reviewed |
| 6 | `frog` | Frog | Wildlife | `src/entities/Wildlife.js` | Static | Not reviewed |
| 7 | `snake` | Snake | Wildlife | `src/entities/Wildlife.js` | Static | Not reviewed |
| 8 | `bird-crow` | Crow | Birds | `src/entities/Birds.js` | Flap/glide | Not reviewed |
| 9 | `bird-stork` | Stork | Birds | `src/entities/Birds.js` | Flap/glide | Not reviewed |
| 10 | `drone` | Drone | Cinematic | `src/entities/Drone.js` | Rotor spin | Not reviewed |
| 11 | `minivan` | Minivan | Cinematic | `src/entities/Minivan.js` | Static | Not reviewed |
| 12 | `soldier-idle` | Soldier — idle | Cinematic | `src/entities/Soldier.js` | Joint sliders | In review |
| 13 | `soldier-binoculars` | Soldier — binoculars | Cinematic | `src/entities/Soldier.js` + `WatchtowerSoldier.js` | Pose blend | Not reviewed |
| 14 | `soldier-radio` | Soldier — radio | Cinematic | `src/entities/Soldier.js` + `WatchtowerSoldier.js` | Radio arm bob | Not reviewed |

Suggested review order: boat first (highest screen time), then the oar, the seated-officer composition, smugglers, wildlife, birds, and finally the cinematic props and poses.

## Shared checklist

Apply these to every sprite unless its section says otherwise.

- [ ] Silhouette reads clearly at normal gameplay distance (drone camera, mobile screen).
- [ ] Proportions match the intended real-world scale and the other entities.
- [ ] All faces point outward; no inside-out or missing surfaces when orbiting.
- [ ] Flat shading facets are deliberate and consistent; no accidental smoothing seams.
- [ ] Material palette survives ACES tone mapping and the river/golden-hour lighting.
- [ ] Shadows: the right meshes cast, the right meshes receive, no shadow acne or peter-panning.
- [ ] Mesh count and triangle count are reasonable for the mobile target.
- [ ] Geometry and materials are reused where it is safe (module-level caches, shared palettes).
- [ ] Animation pivots keep limbs/parts attached through the full motion range.
- [ ] Collision volumes (if any) line up with the visible model.
- [ ] No magic numbers that would be better as named tuning constants.
- [ ] Viewer dimensions look right (record them in the section).

## Boat — `boat`

- **Builder:** `buildBoat` in `src/dev/sprites.js`
- **In-game role:** player vehicle; the primary silhouette on screen.
- **Forward axis:** local `+X` (bow), motor at `-X`.

**Model composition**

- Hull: two side pontoon tubes, two rear cone caps, two inward-angled bow tubes, two joint spheres and a nose cap, two black rubber strakes, two rope lifelines.
- Deck: sealed bottom under-plate, wooden deck floor, transom board, black rear bench with seat pad, front bench.
- Outboard: mount block, cowl with red stripe, shaft, skeg, short tiller with grip knob, hidden engine-failure flame and flame core.
- Officer: empty `officerGroup` mount; `BoatCrew` attaches a shared `Soldier` posed `steer`.
- Oarsman: empty `oarsmanMount`; `BoatCrew` attaches a shared `Soldier` posed `row`, plus the separate `Oar` model on `oarPivot`.
- Excluded from viewer: crew, oar and world-space overboard marker ring. Those are separate models/composition.

**Motion & states outside viewer**

Oar whack animation, oar auto-aim, man-overboard fall/recover, engine-failure flame and smoke, river wake, hull bobbing, steering tilt.

**Priority checks**

- [ ] Hull reads as an inflatable boat, not a hard-shell dinghy.
- [ ] Bow joints and nose cap have no visible seams or daylight gaps.
- [ ] Oarsman and officer proportions feel correct relative to tube diameter.
- [ ] Oar length and blade shape read clearly during a swing.
- [ ] Motor silhouette does not merge into the stern cones.
- [ ] Deck and benches are legible from the drone's high three-quarter angle.
- [ ] Engines, oar and figures still read when wireframe is off and terrain is busy.

**Measured size (viewer):**

Hull footprint is about `4.65 × 2.84 m` (stern cone tip to nose cap × strake to strake), with `0.8 m`-diameter pontoons and a `1.24 m` clear interior. The viewer box no longer includes crew or oar.

**Findings:**

- The two lifelines were originally buried inside the `0.4 m` tube radius. They are now sagging tan rope tubes running along the inner top of each pontoon (`z ±0.68`, `y 0.82`), close enough for the seated officer to hold.
- The deck was described as slatted but was one `2.7 × 1.25 m` box. Replaced with five planks and dark seams.
- Officer legs/cap/visor, oarsman legs/beanie/hands, and motor mount/shaft/skeg/tiller did not cast shadows. Added `castShadow`.
- Fully decoupled: `Boat.js` no longer imports or builds crew/oar art. It exposes `officerGroup` and `oarsmanMount` for `BoatCrew`, and `attachOar(oar)` for the separate `Oar` model while keeping the oar pivot and hitbox.
- Beam widened from `2.48 m` to `2.84 m` (pontoon centres `z ±1.02`) so the helm seat has room without the crew clipping the tubes. Benches, deck and transom widened to match; the rear bench and seat pad are black and the pad is `1.1 m` wide.
- Still open: the oarsman's arms do not yet track the moving oar grips; the stern cones extend slightly past the motor; the tubes do not receive shadows.
- Scale question: a `4.65 m` hull with `2.84 m` beam and `0.8 m` tubes is large for the in-game role. Decide whether this is the intended patrol-dinghy size before adding more detail.

**Decisions / next changes:**

- 2026-11-01: Applied lifeline, deck-plank and shadow fixes. Pending visual check in `?dev=sprites`.
- 2026-11-01: Boat sprite is hull/motor only; crew and oar moved to `BoatCrew` and separate models.
- Next candidates: add plank spacing variation, confirm the target hull scale, then review the oar and crew separately.

## Oar — `oar`

- **Builder:** `buildOar` in `src/dev/sprites.js`
- **In-game role:** the oarsman's weapon and rowing tool; attached to `boat.oarPivot` at runtime.

**Model composition**

- Wooden shaft cylinder, flat box blade, red box tip, and an empty aim anchor at the blade centre.
- No hands; the oarsman model supplies the visible hands (tracking is pending).

**Motion & states outside viewer**

Whack windup/aim/swing/return, idle sway, aim stretch via `oarPivot.scale.y`, man-overboard detachment.

**Priority checks**

- [ ] Shaft, blade and red tip read clearly during a swing.
- [ ] Blade shape reads as an oar, not a paddle or plank.
- [ ] Aim anchor still lines up with the visible blade.
- [ ] Pivot origin keeps the oar attached to the oarsman through the full arc.
- [ ] Scale matches the boat and crew.

**Measured size (viewer):**

**Findings:**

- Extracted from `Boat.js`; the boat now keeps only the pivot/hitbox and receives the model through `attachOar`.

**Decisions / next changes:**

- Next: lock the blade silhouette before animating the grip.

## Boat — seated officer — `boat-officer`

- **Builder:** `buildBoatOfficer` in `src/dev/sprites.js` (composes `Boat` + `Soldier`).
- **In-game role:** candidate composition for the officer sitting on the rear seat and holding the tiller.

**Model composition**

- Patrol boat with the rear seat pad.
- One `Soldier` in `sitSteer`, scaled `0.72`, rotated to face the bow, placed against the transom at `x -1.11, y 0.1156, z +0.3`. Right hand IK-grips the short tiller knob; left hand hangs on the inboard lifeline.

**Motion & states outside viewer**

None in gameplay yet. The viewer preview steers with `A`/`D`: the boat heading, hull bank, motor pivot and officer arm all follow the same rates as `Boat.update`/`BoatCrew.update`.

**Priority checks**

- [ ] Butt sits on the seat pad; feet rest on the deck.
- [ ] Right hand lands on the tiller handle.
- [ ] Hand stays near the tiller through the steering range.
- [ ] Silhouette reads as sitting, not crouching.
- [ ] No limb/tube/bench intersections.
- [ ] Scale feels right next to the tiller and bench.

**Measured size (viewer):**

**Findings:**

- The rear bench was too low for a seated figure (feet fell under the deck). Added a `0.07 m` rear seat pad and sized the officer to `0.72` so the feet meet the deck.
- Officer sits forward on the black bench at `x -1.11, z +0.3`, with the bench/pad front at `x -1.0` so the shins and boots clear it and the boots rest on the deck.
- The outboard tiller is now a short `0.4 m` arm with a knob behind the seat. The right hand IKs to the knob through the full steering arc; the shaft stays behind the torso instead of sweeping through it.
- The lift is `0.09 m` so the hand rests on the knob and the forearm stays above it.
- The lifelines are moved inboard (`z 0.68`, slight sag) and re-coloured like rope; the left hand IKs onto the starboard line and overlaps it.

**Decisions / next changes:**

- Iterating on placement/scale; not yet wired into `BoatCrew`.

## Smuggler — walking — `smuggler-walking`

- **Builder:** `buildSmuggler(stage, 'walking')` in `src/dev/sprites.js`
- **In-game role:** primary target on the gravel road before entering the water.

**Model composition**

- Torso box, sphere head, hemisphere cap, scaled contraband bundle.
- Two leg groups with box legs; two arm groups with cylinder arms.
- Random bag color per instance; dark suit with flat shading; skin material shared with other characters.

**Motion & states outside viewer**

Road walking with swinging arms/legs and body bob, disembark transition, panicked escape run, death shrink.

**Priority checks**

- [ ] Walking silhouette separates from reeds and gravel at distance.
- [ ] Head/cap/bundle read as three distinct shapes.
- [ ] Limb pivots remain attached during the full walk cycle.
- [ ] Bundle scale does not look detached or oversized next to the torso.
- [ ] Pose reads as carrying/tension, not a neutral mannequin.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Smuggler — swimming — `smuggler-swimming`

- **Builder:** `buildSmuggler(stage, 'swimming')` in `src/dev/sprites.js`
- **In-game role:** water target once the smuggler has entered the river.

**Model composition**

- Sphere head with hemisphere cap, snorkel tube and orange tip.
- Contraband bundle with yellow tape.
- Two angled cylinder arms for the swim stroke.
- Random cap and bag colors per instance.

**Motion & states outside viewer**

Swim stroke, panic direction changes, dive/escape run, death types and blood puddle.

**Priority checks**

- [ ] Head, cap and snorkel read clearly when only the upper body is above water.
- [ ] Snorkel tube and tip do not disappear against the river highlights.
- [ ] Bundle sits low enough to look towed, not floating separately.
- [ ] Arm angles suggest swimming rather than a static cross pose.
- [ ] Silhouette works from the top-down drone angle, not only side-on.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Frog — `frog`

- **Builder:** `buildFrog` in `src/dev/sprites.js`
- **In-game role:** ambient wildlife and stork prey.

**Model composition**

- Scaled body sphere, pale belly sphere, scaled head sphere.
- Two leg groups with thigh boxes and foot boxes.
- Two eyes and two pupils; random green hue per instance.

**Motion & states outside viewer**

Kick cycle, dive avoidance, scare/panic, oar death shrink.

**Priority checks**

- [ ] Silhouette reads as a frog at a glance, not a green blob.
- [ ] Eye placement and pupil size carry the character.
- [ ] Rear legs are visible and clearly folded.
- [ ] Belly/body two-tone is visible under the game lighting.
- [ ] Scale remains readable when next to the boat and snake.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Snake — `snake`

- **Builder:** `buildSnake` in `src/dev/sprites.js`
- **In-game role:** ambient wildlife and stork prey.

**Model composition**

- Nine sphere body segments, alternating body/band material, tapering scale.
- Scaled head sphere, two eyes, two pupils, tongue box.
- Shared eye/pupil/tongue materials with the frog.

**Motion & states outside viewer**

Slither wave through segment positions, dive avoidance, scare/panic, oar death shrink.

**Priority checks**

- [ ] Body segments form a continuous snake without visible gaps at the chosen scale.
- [ ] Head and tongue read as a snake rather than a thick worm.
- [ ] Alternating bands are visible but not noisy at gameplay distance.
- [ ] Slither amplitude keeps segments connected.
- [ ] Eyes/tongue stay legible from the drone camera angle.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Crow — `bird-crow`

- **Builder:** `buildBird(stage, 'crow')` in `src/dev/sprites.js`
- **In-game role:** ambient single birds, loose flocks and migration skeins.

**Model composition**

- Scaled body sphere, head sphere, cone beak, box tail.
- Two wing pivots with custom triangular `BufferGeometry` wings.
- Four grey palette variants selected per instance; brass beak material.

**Motion & states outside viewer**

Flap/glide cycle, group wandering and bob, yaw/roll from drift, stork-specific dive behaviour is not used by this variant.

**Priority checks**

- [ ] Wing shape reads as a bird in both flap and glide extremes.
- [ ] Body/head/beak silhouette is clear from below and side-on.
- [ ] Palette does not vanish against the sky or water.
- [ ] Flap pivot does not tear the wing root away from the body.
- [ ] Crow size variation in flocks still reads at distance.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Stork — `bird-stork`

- **Builder:** `buildBird(stage, 'stork')` in `src/dev/sprites.js`
- **In-game role:** white stork that hunts frogs/snakes and dives at the water.

**Model composition**

- Body sphere, long neck cylinder, head sphere, long red cone beak.
- Dark box tail.
- Two-piece wings: white inner custom geometry plus dark tip custom geometry.
- Two red cylinder legs.

**Motion & states outside viewer**

Flap/glide cycle, diving descent scale/pitch, climbing recovery, prey carried in the beak.

**Priority checks**

- [ ] Long neck, beak and legs are unmistakably stork-like.
- [ ] White body keeps visible definition against the sky and bright water.
- [ ] Black wing tips read during flap and glide.
- [ ] Neck/head/beak connection survives pitch changes during a dive.
- [ ] Carried-prey position looks attached to the beak, not floating.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Drone — `drone`

- **Builder:** `buildDrone` in `src/dev/sprites.js`
- **In-game role:** the player camera and the game-over targeting vehicle.

**Model composition**

- Main body box, spine box, two angled arm boxes.
- Four rotor groups: hub cylinder, translucent disc, two crossed blade boxes.
- Gimbal sphere, lens cylinder, glowing glass cylinder.
- Four angled leg boxes, red tail-light sphere.

**Motion & states outside viewer**

Rotor spin, intro rise/approach, game-over look-at behaviour.

**Priority checks**

- [ ] Silhouette reads as a quadcopter at a glance.
- [ ] Translucent rotor discs suggest spin without looking like solid plates.
- [ ] Gimbal/camera lens reads from the front and below.
- [ ] Legs and arms do not merge into a single mass.
- [ ] Red tail light and glass lens stay visible against the sky.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Minivan — `minivan`

- **Builder:** `buildMinivan` in `src/dev/sprites.js`
- **In-game role:** smuggler drop-off vehicle in the intro and shore staging.

**Model composition**

- Body box, lower skirt, cabin box.
- Side glass, windshield, rear glass.
- Two side door groups with panel, glass and handle.
- Front/rear bumpers, four headlight boxes, four tail-light boxes.
- Four wheel groups with tire cylinders and rim cylinders.

**Motion & states outside viewer**

Wheel spin, rear-door open/close swing, exhaust positioning, drop-off movement.

**Priority checks**

- [ ] Van reads as a civilian minivan, not a generic box.
- [ ] Windows and doors break up the side mass correctly.
- [ ] Door hinge line and open angle look plausible.
- [ ] Wheels sit in the arches without clipping the body.
- [ ] Headlights and tail lights read as the right materials at night/dusk.
- [ ] Scale feels right next to the boat and soldiers.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Soldier — idle — `soldier-idle`

- **Builder:** `buildSoldierIdle(stage)` in `src/dev/sprites.js`
- **In-game role:** shared human rig reused by the boat crew and the watchtower poses.

**Model composition**

- `Soldier` in `src/entities/Soldier.js` is the one soldier model: pelvis, torso, plate carrier, helmet, neck, head, two arm chains and two leg chains. No props and nothing else in the scene.
- Every soldier in the game is this same model: `boat` crew (`BoatCrew` officer/oarsman), `boat-officer` preset, watchtower idle/binoculars/radio, and the viewer's `soldier-idle` entry. No separate variants, palettes or inline crew geometry.
- 15 articulated joints: `spine`, `neck`, `head`, `shoulder/elbow/wrist` per side and `hip/knee/ankle` per side. Joints live in `soldier.joints` and carry labels from `SOLDIER_JOINT_LABELS`.
- The viewer exposes the rig: a joint `<select>` plus X/Y/Z degree sliders and **Reset pose**. Moving a slider calls `soldier.freezePose()`, which snapshots the current rotations into the pose targets so the idle blend does not snap them back.
- `WatchtowerSoldier` remains a thin wrapper that adds the hidden binoculars and radio props and drives the watchtower pose modes.
- Poses live in `SOLDIER_POSES` (`idle`, `eyes`, `radioDown`, `radioUp`, `steer`, `row`, `sitSteer`).

**Motion & states outside viewer**

Idle arm pose; reused with `steer`/`row` on the boat and `eyes`/`radio` on the watchtower.

**Priority checks**

- [ ] Every joint in the panel moves without detaching a mesh or leaving a gap.
- [ ] Plain figure reads as a human at gameplay distance, not a blocky mannequin.
- [ ] Shoulders/hips sit at the torso/pelvis edges in every extreme rotation.
- [ ] Elbows and knees bend in the natural direction only.
- [ ] Rest pose stands on the ground (feet at `y ≈ 0`).
- [ ] Arm chains still reach the tiller on `boat-officer` (the IK shoulder constants assume `±0.3, 1.55`).

**Measured size (viewer):** about `0.74 × 1.93 × 0.36 m` at scale 1, 18 meshes / 396 triangles.

**Findings:**

- Rebuilt the model as a real joint chain: the previous version rotated whole limbs only and had no wrist, ankle, neck or spine.
- `soldier-idle` builds the shared `Soldier` directly (no `WatchtowerSoldier`), so the viewer shows the soldier with helmet and plate carrier, with no binoculars, radio or boat composition.

**Decisions / next changes:**

- 2026-11-01: One canonical soldier for the whole game — helmet and plate carrier are always on the model; boat crew, boat-officer, watchtower and `soldier-idle` all instantiate this same `Soldier`.
- 2026-11-01: Decoupled parts from compositions — `Boat` is the vehicle only, `BoatCrew` attaches soldiers, `boat-officer` is a viewer preset. Reuse the parts for wrecks/moored props later.

## Soldier — binoculars — `soldier-binoculars`

- **Builder:** `buildSoldier(stage, 'binoculars')` in `src/dev/sprites.js`
- **In-game role:** pose used during the binocular POV shot.

**Model composition**

- Same body as idle, with the binocular group visible.
- Binoculars: two tubes and two eyepieces in dark metal.
- Eye pose targets: both shoulders raised, elbows folded to the face.

**Motion & states outside viewer**

Pose blend into the binocular stance; head/eye line drives the POV framing.

**Priority checks**

- [ ] Binoculars sit on the eye line, not the chest or forehead.
- [ ] Hands/forearms look like they support the binoculars.
- [ ] Elbow and shoulder angles avoid self-intersection with the helmet.
- [ ] Silhouette remains readable from the watchtower camera distance.
- [ ] Pose matches the binocular overlay's framing.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Soldier — radio — `soldier-radio`

- **Builder:** `buildSoldier(stage, 'radio')` in `src/dev/sprites.js`
- **In-game role:** pose used while calling in the minivan drop.

**Model composition**

- Same body as idle, with the radio group visible.
- Radio: body box, antenna cylinder, red indicator light.
- Radio pose targets: one hand raised toward the face, radio bobbing in the off-hand.

**Motion & states outside viewer**

Two-stage arm pose (lowered then raised), radio bob and tilt following the arm.

**Priority checks**

- [ ] Radio is visibly held, not floating near the chest.
- [ ] Antenna and red light read at the watchtower camera distance.
- [ ] Raised arm does not clip the helmet or binoculars position.
- [ ] Radio tilt follows the hand naturally through the pose blend.
- [ ] Pose reads as communicating, not waving.

**Measured size (viewer):**

**Findings:**

**Decisions / next changes:**

## Related models not yet in the viewer

These are real visual assets in the project but are currently built as part of `RiverWorld` or the UI rather than as standalone viewer entries. Add them when we start reviewing environment art.

| Asset | Where it lives | Notes |
|---|---|---|
| Rank insignia sprite sheet | `src/assets/ranks.svg`, `src/systems/RankSprites.ts` | 2D `<symbol>` sheet injected once; needs a DOM/2D tab, not the 3D viewer. |
| Watchtowers | `src/world/River.js` (`createWatchtower`) | Two towers on the south bank used by the intro. |
| Rocks and boulders | `src/world/River.js` (`createRiverBoundaries`) | Procedural boundary meshes and colliders. |
| Reeds and bank vegetation | `src/world/River.js` (`createReedsAndVegetation`, `createBankVegetation`) | Instanced, wind-sway material. |
| Forests / background trees | `src/world/River.js` (`createForests`) | Distant scenery batches. |
| Appalled crowd | `src/world/River.js` (`createAppalledCrowd`) | Shore celebration actors. |
| Particles, wakes, splashes | `src/world/River.js` (particle system, `emit*` methods) | Effect-driven, not static models. |
| Binocular overlay | `src/assets/binocular-overlay.png` | 2D UI texture. |
| Rank promotion banner | `src/style.css`, `src/systems/RankSprites.ts` | DOM/CSS presentation. |

## Review log

| Date | Sprite | Change | Result |
|---|---|---|---|
| — | — | Initial document created | 12 viewer sprites catalogued, all Not reviewed |
| 2026-11-01 | `boat` | Lifelines moved outside tubes; deck split into five planks; missing character/motor shadow flags added | Pending visual check |
| 2026-11-01 | `boat` | Crew uniform and helmet share one colour; both characters now wear the same-size shared cap geometry | Pending visual check |
| 2026-11-01 | `boat` | Rebuilt both crew figures as articulated low-poly soldiers (legs, boots, plate carrier, arms, masked head, curved visor) using the reference palette | Pending visual check |
| 2026-11-01 | `soldier-idle` | Adopted as the starting point for the shared crew soldier; discarded the separate minimal-soldier experiment | Reviewing |
| 2026-11-01 | `soldier-idle` | `WatchtowerSoldier` now wraps the shared `Soldier` model; poses moved to `SOLDIER_POSES` | Reviewing |
| 2026-11-01 | `boat` | Removed inline crew; officer/oarsman now instantiate the shared `Soldier` with `steer`/`row` poses | Pending visual check |
| 2026-11-01 | `boat` | Removed oar geometry; boat keeps the pivot/hitbox and accepts the `Oar` model via `attachOar` | Pending visual check |
| 2026-11-01 | `oar` | Extracted the oar into `src/entities/Oar.js` and added a standalone viewer sprite | In review |
| 2026-11-01 | `boat` | Added a dark rear seat pad so a seated officer can reach the deck with his feet | Pending visual check |
| 2026-11-01 | `boat-officer` | Added the seated-officer composition; soldier scaled 0.72, moved to `z +0.3`, hand tuned onto the tiller | Pending visual check |
| 2026-11-01 | `boat-officer` | Added A/D steering preview with blended arm keyframes so the hand tracks the tiller instead of moving opposite | Pending visual check |
| 2026-11-01 | `boat-officer` | Replaced the blended poses with per-frame 2-bone IK; hand now stays on the tiller line across the full steering arc | Pending visual check |
| 2026-11-01 | `boat-officer` | Moved to `x -1.08, z +0.2` and tucked the left arm onto the lap to clear the starboard pontoon | Pending visual check |
| 2026-11-01 | `boat` | Beam widened to `2.84 m`; rear bench/seat moved aft and seat pad widened so the officer can sit without leg/seat clipping | Pending visual check |
| 2026-11-01 | `boat-officer` | Seated against the transom at `x -1.31, z +0.3`; IK grip lifted `0.09 m` so only the hand overlaps the tiller | Pending visual check |
| 2026-11-01 | `boat` | Rear bench and pad now all black; lifelines changed to sagging tan rope tubes moved inboard | Pending visual check |
| 2026-11-01 | `boat-officer` | Shortened the tiller to a knob behind the seat and moved the officer to `x -1.11`; left hand now IKs onto the inboard lifeline | Pending visual check |
| 2026-11-01 | `boat` | Lifeline moved to `z 0.68` so the left hand overlaps it; rope uses a sagging tan tube | Pending visual check |
| 2026-11-01 | `soldier-idle` | Rebuilt `Soldier` as a 15-joint rig (spine, neck, head, shoulders/elbows/wrists, hips/knees/ankles) with helmet and plate carrier | In review |
| 2026-11-01 | `soldier-idle` | Viewer now shows the shared `Soldier` instead of a `WatchtowerSoldier`; added the Rig joints panel with per-axis sliders and Reset pose | In review |
| 2026-11-01 | all | One canonical soldier: `BoatCrew`, `boat-officer`, `WatchtowerSoldier` and `soldier-idle` all instantiate the same `Soldier` model | In review |
| 2026-11-01 | `soldier-idle` | Fixed `boat-officer` build crash (missing `LIFELINE` import) that left the hull orphaned on the viewer stage and visible under every other sprite | Fixed |
| 2026-11-01 | — | Viewer builds into a throwaway holder group, so a failed build can no longer leave stray meshes on the stage | Fixed |
