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
  swim: {
    /** Multiplier on every swimmer's speed (0.75 = 25% slower than the original). */
    speedScale: number;
  };
  rockRest: {
    /** Chance a swimmer climbs a big rock it passes (rolled once per rock; 0 disables). */
    chance: number;
    /** Only rocks at least this big (visual radius) can be climbed. */
    minRockSize: number;
    /** A rock this close to the swimmer's edge (world units) counts as passed. */
    reach: number;
    /** Seconds spent resting on top (randomised +50%). */
    seconds: number;
    /** Seconds before the same swimmer may climb another rock. */
    cooldown: number;
    /** Boat distance that makes a resting swimmer jump back into the water. */
    fleeRadius: number;
  };
  /** Fraction of boat speed kept after the propeller shreds a swimmer (1 = no slowdown). */
  shredSpeedKeep: number;
  /** Fraction of boat speed kept after ramming a swimmer or corpse (1 = no slowdown). */
  ramSpeedKeep: number;
  dive: {
    /** Fraction of swimmers (rolled once at spawn) that are able to dive; the rest sprint. */
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
  fright: {
    /** Group-mates within this distance of a kill may panic. */
    radius: number;
    /** Panic chance at distance 0; falls linearly to 0 at `radius`. */
    baseChance: number;
    /** Chance multiplier when the kill was a propeller shred. */
    rotorMultiplier: number;
    /** Seconds spent fleeing away from the kill. */
    seconds: number;
    /** Speed multiplier while fleeing. */
    speedMultiplier: number;
    /** Chance a frightened swimmer then swims back to the bank it spawned on. */
    retreatChance: number;
    /** Swim speed multiplier while retreating to the start bank. */
    retreatSpeedMultiplier: number;
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
    /** A swimmer within this distance of the boat counts as "something to chase". */
    idleRange: number;
    /** Seconds with nothing in idleRange before the next wave fires early (0 disables). */
    idleSeconds: number;
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
  swim: {
    speedScale: envNumber(import.meta.env.VITE_SWIM_SPEED_SCALE, 0.75)
  },
  rockRest: {
    chance: envNumber(import.meta.env.VITE_ROCK_REST_CHANCE, 0.5),
    minRockSize: envNumber(import.meta.env.VITE_ROCK_REST_MIN_SIZE, 1.2),
    reach: envNumber(import.meta.env.VITE_ROCK_REST_REACH, 2.5),
    seconds: envNumber(import.meta.env.VITE_ROCK_REST_SECONDS, 1.5),
    cooldown: envNumber(import.meta.env.VITE_ROCK_REST_COOLDOWN, 5),
    fleeRadius: envNumber(import.meta.env.VITE_ROCK_REST_FLEE_RADIUS, 7)
  },
  shredSpeedKeep: envNumber(import.meta.env.VITE_SHRED_SPEED_KEEP, 0.5),
  ramSpeedKeep: envNumber(import.meta.env.VITE_RAM_SPEED_KEEP, 0.8),
  dive: {
    chance: envNumber(import.meta.env.VITE_SMUGGLER_DIVE_CHANCE, 0.1),
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
  fright: {
    radius: envNumber(import.meta.env.VITE_FRIGHT_RADIUS, 100),
    baseChance: envNumber(import.meta.env.VITE_FRIGHT_CHANCE, 0.5),
    rotorMultiplier: envNumber(import.meta.env.VITE_FRIGHT_ROTOR_MULTIPLIER, 2),
    seconds: envNumber(import.meta.env.VITE_FRIGHT_SECONDS, 3),
    speedMultiplier: envNumber(import.meta.env.VITE_FRIGHT_SPEED_MULTIPLIER, 1.8),
    retreatChance: envNumber(import.meta.env.VITE_FRIGHT_RETREAT_CHANCE, 0.5),
    retreatSpeedMultiplier: envNumber(import.meta.env.VITE_FRIGHT_RETREAT_SPEED, 2)
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
    maxAlive: envNumber(import.meta.env.VITE_SPAWN_MAX_ALIVE, 5),
    idleRange: envNumber(import.meta.env.VITE_SPAWN_IDLE_RANGE, 150),
    idleSeconds: envNumber(import.meta.env.VITE_SPAWN_IDLE_SECONDS, 4)
  }
};
