# 12 — Ranking system rework

Sources: `src/config/ranking.ts` (rank definitions, curve, banner timing), `src/config/difficulty.ts` (speed + spawn tuning), `src/systems/RankSystem.ts` (thresholds + promotion detection), `src/main.js` (HUD + banner queue), `src/entities/SmugglerManager.js` (difficulty scaling).

```mermaid
flowchart TD
    A["RANK_DEFINITIONS<br/>key + sprite (+ optional minScore)"] --> B{"minScore set?"}
    B -->|yes| C["use explicit value"]
    B -->|no| D["threshold(n) =<br/>quadratic * n² + linear * n"]
    D --> E["floor to roundDownTo"]
    C --> F["RANKS table"]
    E --> F
    F --> G["getRankForScore(score)"]
    G --> H["HUD badge, title, progress, next rank"]
    G --> I["checkRankUp(score)"]
    I --> J{"index > lastRankIndex?"}
    J -->|no| K["no promotion"]
    J -->|yes| L["collect every rank<br/>from lastRankIndex + 1 to index"]
    L --> M["show banners one at a time<br/>visibleMs, then gapMs"]
    M --> N["lastRankIndex = index"]
    O["startGame()"] --> P["rankSystem.reset()<br/>clear rank-up queue + banner"]
```

```mermaid
flowchart LR
    S["score"] --> P["pressure = pressureGain *<br/>score / (score + pressureMidpoint)"]
    P --> W["baseInterval = max(minInterval,<br/>baseInterval - pressure * pressureDrop)"]
    W --> J["* random jitter<br/>[jitterMin, jitterMax]"]
    S --> V["speed = 1 + gain *<br/>score / (score + midpoint)"]
    S --> R["rank = highest threshold <= score"]
```

## Logic

- Tunables are split by concern: `src/config/ranking.ts` holds `RANK_DEFINITIONS` (order, i18n key, sprite, optional `minScore` pin), `RANK_CURVE` (quadratic, linear, `roundDownTo`), and `PROMOTION_TUNING`; `src/config/difficulty.ts` holds speed and spawn tuning.
- Defaults: `70n² + 500n` rounded down to 50 gives Junior Lieutenant at 10,150 and General at 31,650. The smallest gap is 550, above the 500-point propeller kill, so one kill cannot skip a rank.
- `checkRankUp` returns every crossed rank in order. `main.js` queues them and chains banners (`visibleMs`, then `gapMs`), clearing the queue when a run starts. This preserves intermediate promotions that the old single-return version silently dropped.
- Difficulty uses asymptotic curves instead of hard caps: `1 + gain * score / (score + midpoint)` for speed and a pressure ratio for spawn timing, so high scores keep ramping. Waves within `warmupWaves` use the calmer `warmupMin..warmupMax` range.
- Ranks remain per-run; `startGame()` resets `rankSystem`, clears the pending promotion queue, hides the active banner, and resets the run score.
