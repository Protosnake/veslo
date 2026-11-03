/**
 * River water shader tunables. Defaults live here so the game runs without a
 * local `.env`; each can be overridden with the matching `VITE_WATER_*` variable.
 */
function envNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const WATER_TUNING = {
  /** Brightness of the flowing current streaks (0 disables). */
  flowStrength: envNumber(import.meta.env.VITE_WATER_FLOW_STRENGTH, 0.22),
  /** Speed the streaks drift downstream (m/s). */
  flowSpeed: envNumber(import.meta.env.VITE_WATER_FLOW_SPEED, 0.9),
  /** Streak scale: cells per metre across the channel; higher = finer streaks. */
  flowScale: envNumber(import.meta.env.VITE_WATER_FLOW_SCALE, 0.7),
  /** How stretched streaks are along the flow (1 = round blobs). */
  flowStretch: envNumber(import.meta.env.VITE_WATER_FLOW_STRETCH, 5),
  /** Strength of light glints on steep wave facets (0 disables). */
  sparkleStrength: envNumber(import.meta.env.VITE_WATER_SPARKLE_STRENGTH, 0.5),
  /** Multiplier on boat-wake ripple ring height in the water normal (0 = flat). */
  rippleGain: envNumber(import.meta.env.VITE_WATER_RIPPLE_GAIN, 2.5),
  /** Multiplier on the white wake foam painted by ripple rings. */
  wakeFoamGain: envNumber(import.meta.env.VITE_WATER_WAKE_FOAM_GAIN, 1.8),
  /** Drifting foam flecks spawned per second around the boat (0 disables). */
  fleckRate: envNumber(import.meta.env.VITE_WATER_FLECK_RATE, 120),
  /** Half-length (m) of the river stretch along X around the focus that flecks spawn in. */
  fleckRange: envNumber(import.meta.env.VITE_WATER_FLECK_RANGE, 45),
  /** Seconds a fleck lives (randomised 0.6x-1x). */
  fleckLife: envNumber(import.meta.env.VITE_WATER_FLECK_LIFE, 6),
  /** Fleck size multiplier (before the global particle scale). */
  fleckSize: envNumber(import.meta.env.VITE_WATER_FLECK_SIZE, 0.2)
};
