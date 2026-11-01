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
    baseInterval: number;
    pressureDrop: number;
    /** 1.4 keeps the old full-pressure point at 1,400 score. */
    pressureGain: number;
    pressureMidpoint: number;
    minInterval: number;
    jitterMin: number;
    jitterMax: number;
    warmupWaves: number;
    warmupMin: number;
    warmupMax: number;
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
    baseInterval: 9,
    pressureDrop: 3.5,
    pressureGain: 1.4,
    pressureMidpoint: 560,
    minInterval: 3,
    jitterMin: 0.7,
    jitterMax: 1.3,
    warmupWaves: 2,
    warmupMin: 11,
    warmupMax: 15
  }
};
