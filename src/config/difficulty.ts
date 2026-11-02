function envNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export interface DifficultyTuning {
  speed: {
    /** Maximum extra speed (1.2 = up to +120%). */
    gain: number;
    /** Score at which half of the speed gain is reached. */
    midpoint: number;
  };
  sprint: {
    /** Seconds of burst speed after the boat gets close. */
    duration: number;
    /** Speed multiplier while sprinting. */
    multiplier: number;
    /** Seconds before another burst can trigger. */
    cooldown: number;
    /** Boat distance that triggers the burst. */
    senseRadius: number;
  };
  dive: {
    /** Probability a trapped swimmer dives instead of trying to sprint. */
    chance: number;
    /** Dives allowed per swimmer life. */
    maxDives: number;
    /** Boat distance at which a swimmer starts judging the dodge. */
    senseRadius: number;
    minDuration: number;
    maxDuration: number;
    /** Randomised dive depth range; deep dives clear the propeller. */
    minDepth: number;
    maxDepth: number;
    /** Dives shallower than this stay within oar/propeller reach. */
    safeDepth: number;
    /** Base cooldown before the next dive. */
    cooldown: number;
    /** Each consecutive dive multiplies the cooldown by this (exhaustion). */
    cooldownGrowth: number;
    /** Cooldown ceiling so exhausted swimmers still surface eventually. */
    maxCooldown: number;
    /** Seconds away from the boat needed to recover one exhaustion step. */
    recoverySeconds: number;
  };
  spawn: {
    /** Multiplies every spawn interval; higher means fewer smugglers. */
    intervalScale: number;
    /** Seconds between waves at run start (before intervalScale). */
    startInterval: number;
    /** Seconds between waves once fully ramped (before intervalScale). */
    minInterval: number;
    /** Run seconds over which the interval falls linearly from start to min. */
    rampSeconds: number;
    /** +/- fraction of random wobble on each interval (0 = metronome). */
    jitter: number;
    /** Smugglers in the first wave group. */
    startGroupSize: number;
    /** Waves between each +1 in group size (linear growth). */
    wavesPerExtra: number;
    /** Group size ceiling. */
    maxGroupSize: number;
    /** Living smugglers at once; waves are skipped while at the cap, so cruising away cannot pile them up. */
    maxAlive: number;
  };
}

export const DIFFICULTY_TUNING: DifficultyTuning = {
  speed: {
    gain: 1.2,
    midpoint: 2500
  },
  sprint: {
    duration: 2,
    multiplier: 2.6,
    cooldown: 2.5,
    senseRadius: 6.5
  },
  dive: {
    chance: 0.6,
    maxDives: envNumber(import.meta.env.VITE_SMUGGLER_MAX_DIVES, 1),
    senseRadius: 9,
    minDuration: 1.5,
    maxDuration: 2.8,
    minDepth: 0.35,
    maxDepth: 1.2,
    safeDepth: 0.8,
    cooldown: 4,
    cooldownGrowth: 1.8,
    maxCooldown: 18,
    recoverySeconds: 6
  },
  spawn: {
    intervalScale: envNumber(import.meta.env.VITE_SMUGGLER_SPAWN_INTERVAL_SCALE, 3.2),
    startInterval: envNumber(import.meta.env.VITE_SPAWN_START_INTERVAL, 8),
    minInterval: envNumber(import.meta.env.VITE_SPAWN_MIN_INTERVAL, 3),
    rampSeconds: envNumber(import.meta.env.VITE_SPAWN_RAMP_SECONDS, 240),
    jitter: envNumber(import.meta.env.VITE_SPAWN_JITTER, 0.1),
    startGroupSize: envNumber(import.meta.env.VITE_SPAWN_START_GROUP, 1),
    wavesPerExtra: envNumber(import.meta.env.VITE_SPAWN_WAVES_PER_EXTRA, 4),
    maxGroupSize: envNumber(import.meta.env.VITE_SPAWN_MAX_GROUP, 2),
    maxAlive: envNumber(import.meta.env.VITE_SPAWN_MAX_ALIVE, 5)
  }
};
