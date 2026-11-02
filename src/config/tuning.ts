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

export interface ChaseCameraTuning {
  /** Metres behind the boat. */
  distance: number;
  /** Metres above the boat. */
  height: number;
  /** Seconds to ease from the drone view into the chase view. */
  blendSeconds: number;
  /** Horizontal FOV (degrees) while on the chase camera. */
  fov: number;
}

export interface PovCameraTuning {
  /** Horizontal FOV (degrees) for the engine-operator first-person view. */
  fov: number;
  /** Seconds to ease from the drone view into the first-person view. */
  blendSeconds: number;
}

export interface TuningConfig {
  /** Starting battery percentage (0-100). */
  initialBattery: number;
  /** Seconds a dead drone battery takes to recharge (chase camera runs meanwhile). */
  batteryRechargeSeconds: number;
  /** Seconds before recharge ends when the radio rumbles and the countdown shows. */
  droneReadyCountdownSeconds: number;
  /** Seconds the static screen covers the cut back to the drone view (before and after the switch). */
  droneSwitchStaticSeconds: number;
  /** Third-person boat camera shown while the drone is recharging. */
  chaseCamera: ChaseCameraTuning;
  /** Which view replaces the dead drone feed: 'pov' (engine operator) or 'chase'. */
  batteryCamera: 'pov' | 'chase';
  /** First-person view from the engine operator. */
  povCamera: PovCameraTuning;
  /** Allow AK shooting while the drone battery is dead (feature kept, off for now). */
  akEnabled: boolean;
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
  batteryRechargeSeconds: 30,
  droneReadyCountdownSeconds: 5,
  droneSwitchStaticSeconds: 0.8,
  chaseCamera: {
    distance: 9,
    height: 4,
    blendSeconds: 1.2,
    fov: 70
  },
  batteryCamera: 'pov',
  povCamera: {
    fov: 80,
    blendSeconds: 0.8
  },
  akEnabled: false,
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
