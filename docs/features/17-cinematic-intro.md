# 17 — Watchtower cinematic intro

Sources: `src/main.js` (`startIntro`, `updateIntro`, `getIntroCameraPose`, `getIntroDronePosition`, `finishIntro`), `src/entities/WatchtowerSoldier.js`, `src/entities/Drone.js`, `src/systems/ConnectScreen.js`, `src/world/River.js` (`createWatchtower`, gravel-path intro drop), `index.html` / `src/style.css` (binocular viewport and connecting feed).

```mermaid
flowchart TD
    A["startGame()"] --> B["startIntro()<br/>state = INTRO, body.intro"]
    B --> C["Pick south-bank watchtower<br/>build soldier + drone poses"]
    C --> D["0.0-2.0 s<br/>front camera inside tower<br/>soldier at binoculars"]
    D --> E["2.0-6.8 s<br/>hard cut to eye POV<br/>binocular overlay fades in<br/>FOV 55 -> 12"]
    E --> F["van drives gravel path<br/>(delay 1.8 s) and stops<br/>smugglers disembark"]
    F --> G["6.8-9.4 s<br/>hard cut to camera behind tower<br/>drone rises from behind roof<br/>HUD hidden by body.intro"]
    G --> H["9.4-12.0 s<br/>cut to fuzzy CONNECTING screen<br/>signal-loss snow + blinking"]
    H --> I["finishIntro()<br/>state = PLAYING<br/>HUD returns + uplink alert"]
```

## Logic

- The cinematic runs before gameplay while `state === 'INTRO'`; the OSD/HUD is hidden by `body.intro .drone-osd`.
- A south-bank watchtower is selected (`x > 0`) and its cabin is an open-front shell so the soldier and camera can sit inside. The platform is raised well above the tall north-bank reeds.
- Scene 0 frames the guard through the tower window, so both the tower front and the guard holding the binoculars are visible.
- Scene 1 hard-cuts to the soldier's eye position, narrows the FOV to 12°, and shows the existing minivan arrival through the binocular mask. The overlay uses the periscope/binocular artwork in `src/assets/binocular-overlay.png`, keyed to transparent lenses. The intro drop was moved near the reed line so the road corridor is visible from the tower.
- Scene 2 hard-cuts straight from the binocular feed to the single drone shot: the 3D drone rises from behind the tower roof with the same battlefield behind it. There is no camera pan and no separate chase shot.
- Scene 3 cuts to a fuzzy `CONNECTING` feed (`ConnectScreen`) styled like the signal-loss screen: grayscale snow, a blinking red connection bar, then a hard cut to the gameplay camera. `finishIntro()` restores the HUD and shows the uplink/patrol alert. The hidden actors are precompiled with `compileAsync()` during the start modal.
- Skipping the intro calls `finishIntro()` directly, which hides all cinematic objects and the binocular overlay.
