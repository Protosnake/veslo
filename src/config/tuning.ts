/**
 * Frequently tweaked gameplay knobs.
 *
 * Defaults live here so testing does not depend on a local `.env` file. Each
 * value can still be overridden at build time with the matching `VITE_*`
 * variable, or per-load with its `?`-query flag where a loader supports one.
 */

export interface StorkTuning {
  /** Force constant hunting dives so the behaviour is easy to verify. */
  alwaysDive: boolean;
  /** Seconds between dedicated stork spawns; null uses the normal random mix. */
  spawnInterval: number | null;
  /** 0..1 share of normal bird spawns that are storks. */
  spawnWeight: number;
}

export interface DevTuning {
  /** Mount the isolated sprite viewer instead of the game. */
  spriteViewer: boolean;
}

export interface TuningConfig {
  /** Starting battery percentage (0-100). */
  initialBattery: number;
  /** Extra smugglers spawned immediately at run start. */
  initialSpawnCount: number;
  /** Kill-streak window in seconds. */
  killStreakSeconds: number;
  /** Request a screen wake lock for the duration of a run. */
  wakeLock: boolean;
  stork: StorkTuning;
  dev: DevTuning;
}

export const TUNING: TuningConfig = {
  initialBattery: 100,
  initialSpawnCount: 0,
  killStreakSeconds: 5,
  wakeLock: true,
  stork: {
    alwaysDive: false,
    spawnInterval: null,
    spawnWeight: 0.14
  },
  dev: {
    spriteViewer: false
  }
};
