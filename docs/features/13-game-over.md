# 13 — Game over target-lock screen

Source: `src/main.js`, `src/entities/Smuggler.js`, `src/entities/SmugglerManager.js`, `index.html`, `src/style.css`.

```mermaid
flowchart TD
    A["Boat crash / smuggler breach"] --> B["state = GAMEOVER"]
    B --> C{"cause?"}
    C -->|crash| D["focus target = boat.position<br/>no follow object"]
    C -->|breach| E["focus target = breachedSmuggler.position<br/>follow = breachedSmuggler"]
    D --> F["startGameOverFocus(target, follow)"]
    E --> F
    F --> G["approach from river side:<br/>offset = inward * distance + 14.5 up<br/>climb if near rock colliders"]
    G --> H["showGameOverScreen(): body.game-over<br/>HUD/footer/touch controls hidden"]
    H --> I["animate() while GAMEOVER"]
    I --> J["SmugglerManager.updateEscaped(dt, boat)<br/>breached smuggler switches to walker and runs"]
    J --> J2{"escapeElapsed >= 5s?"}
    J2 -->|yes| J3["escapedAway = true<br/>group hidden"]
    J2 -->|no| J4["continue running inland"]
    I --> K["updateGameOverFocus(dt)"]
    K --> L{"follow object?"}
    L -->|yes| M["endLook/endPos track the running smuggler<br/>release after 5s + TARGET LOST alert"]
    L -->|no| N["keep crash point fixed"]
    M --> O["ease-in-out lerp start -> end pose<br/>subtle settle drift"]
    N --> O
    O --> P["renderer.setManualCamera(pos, look)<br/>renderer.setHorizontalFovOverride(52)"]
    P --> Q["center reticle holds the failure target"]
    Q --> R["after-action report below the reticle:<br/>score | 4 stat cells (incl. best streak) | rank"]
    R --> S["Redeploy button (OSD green, not gold)"]
    S --> T["restartGame() -> startGame()"]
    T --> U["hideGameOverScreen(): clear manual camera/FOV<br/>remove body.game-over"]
    U --> V["intro camera takes over"]
```

## Logic

- Game over is a full-screen OSD layer, not a modal card: no backdrop blur, no boxed panel.
- The drone eases from the live gameplay pose to a close pose over the crash or breach point, and narrows the horizontal FOV from the gameplay value to 52°.
- The target pose is built from the river-side direction (toward the river centre), not from the old camera position. Crash points sit inside rock/reed belts, so this keeps the drone over open water. It then climbs and backs farther into open water while `world.isNearRock` reports intersection, which removes the severe near-plane clipping through bank rocks.
- `manualCamera` owns the camera while `state === 'GAMEOVER'`, so the normal follow rig cannot pull focus away from the action.
- After a breach, `SmugglerManager.updateEscaped` keeps updating only the smuggler who crossed. `Smuggler` switches from the swimmer mesh to the walker mesh at the south bank and runs inland; the camera follows it so the action stays centered.
- The escape is capped at 5 seconds (`ESCAPE_RUN_SECONDS`). The runner then leaves the world and is hidden, the camera releases its follow target and holds the last pose, and the OSD shows `TARGET LOST`.
- After the dolly-in completes, a slow settle drift keeps the shot alive without moving the target off center.
- The reticle is fixed at screen center, which is where the focus point projects. The failure target is left unobstructed; all interface chrome lives in an after-action report strip anchored below it.
- Breach shots use a slightly lower/farther offset and the focus end pose follows the running smuggler, so they stay framed while they escape.
- The report uses a fixed three-column grid: final score, four equal stat cells (smacked, frogs, vipers, best streak) with short labels, then rank. Equal cells and nowrap labels keep values aligned.
- The redeploy button uses the same clipped, green, mono/display styling as the drone OSD instead of the gold `action-btn` treatment.
- Restart clears the focus, manual camera and FOV override before the intro shot starts again.
