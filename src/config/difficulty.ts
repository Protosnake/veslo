export interface DifficultyTuning {
  speed: {
    /** Maximum extra speed (1.2 = up to +120%). */
    gain: number;
    /** Score at which half of the speed gain is reached. */
    midpoint: number;
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
  spawn: {
    baseInterval: 7.5,
    pressureDrop: 3.5,
    pressureGain: 1.4,
    pressureMidpoint: 560,
    minInterval: 2.5,
    jitterMin: 0.7,
    jitterMax: 1.3,
    warmupWaves: 2,
    warmupMin: 9,
    warmupMax: 13
  }
};
