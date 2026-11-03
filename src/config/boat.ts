/**
 * Boat handling-feel tunables. Defaults live here; each can be overridden at
 * build time with the matching `VITE_BOAT_*` variable.
 */
function envNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const BOAT_TUNING = {
  /** Bow-up trim (degrees) at top speed, like a planing inflatable. 0 disables. */
  planingPitchDegrees: envNumber(import.meta.env.VITE_BOAT_PLANING_PITCH_DEGREES, 9),
  /** Speed fraction (0-1) where the bow starts to rise; full trim at top speed. */
  planingStartRatio: envNumber(import.meta.env.VITE_BOAT_PLANING_START_RATIO, 0.25),
  /** How quickly the hull follows the target trim (1/s; higher = snappier). */
  pitchResponse: envNumber(import.meta.env.VITE_BOAT_PITCH_RESPONSE, 2.5),
  /** Extra bow lift (degrees) right when accelerating hard, settling back as speed holds. */
  accelSquatDegrees: envNumber(import.meta.env.VITE_BOAT_ACCEL_SQUAT_DEGREES, 3),
  /** Fraction of the wave motion (heave and pitch) the hull still follows at top speed; 1 = full, 0 = skims flat. */
  waveFollowAtSpeed: envNumber(import.meta.env.VITE_BOAT_WAVE_FOLLOW_AT_SPEED, 0.35),
  /** How quickly wave pitch follows the water slope (1/s); lower = calmer at speed. */
  wavePitchResponse: envNumber(import.meta.env.VITE_BOAT_WAVE_PITCH_RESPONSE, 5),
  /** Base hull height above the water plane (world units); lower sits deeper. Was 0.16. */
  rideHeight: envNumber(import.meta.env.VITE_BOAT_RIDE_HEIGHT, 0.04),
  /** How quickly the hull height follows the waves (1/s); lower = fewer jumps. */
  heaveResponse: envNumber(import.meta.env.VITE_BOAT_HEAVE_RESPONSE, 6),
  /** Bow spray / hull foam particles per second at top speed. 0 disables. */
  sprayRate: envNumber(import.meta.env.VITE_BOAT_SPRAY_RATE, 2500),
  /** Spray particles per second thrown off the outer hull in a hard turn at top speed. 0 disables. */
  turnSprayRate: envNumber(import.meta.env.VITE_BOAT_TURN_SPRAY_RATE, 2000),
  /** Turn rate fraction (0-1 of max turn speed) below which no turn spray is thrown. */
  turnSprayMinRatio: envNumber(import.meta.env.VITE_BOAT_TURN_SPRAY_MIN_RATIO, 0.2),
  /** Speed fraction (0-1) below which no bow spray is thrown. */
  sprayMinRatio: envNumber(import.meta.env.VITE_BOAT_SPRAY_MIN_RATIO, 0.15),
  /** Metres from the boat centre to the bow tip (spray origin). */
  bowOffset: envNumber(import.meta.env.VITE_BOAT_BOW_OFFSET, 1.9),
  /** Metres between the wave sample points used for wave pitch. */
  waveSampleSpan: envNumber(import.meta.env.VITE_BOAT_WAVE_SAMPLE_SPAN, 1.6),
  /** Master strength of the water ripple rings (wake, splashes). 0 disables. */
  rippleStrength: envNumber(import.meta.env.VITE_RIPPLE_STRENGTH, 1),
  /** Seconds a ripple ring lives before it fades out. */
  rippleLifetime: envNumber(import.meta.env.VITE_RIPPLE_LIFETIME, 3.2),
  /** How fast a ripple ring expands (m/s). */
  rippleSpeed: envNumber(import.meta.env.VITE_RIPPLE_SPEED, 3.5),
  /** Seconds between ripple rings dropped by the moving boat. */
  rippleInterval: envNumber(import.meta.env.VITE_BOAT_RIPPLE_INTERVAL, 0.15),
  /** Size multiplier for all water particles (wake, spray, splashes); lower = finer. */
  particleScale: envNumber(import.meta.env.VITE_PARTICLE_SCALE, 0.2),
  /** Multiplier on how many wake/splash particles are emitted. */
  particleDensity: envNumber(import.meta.env.VITE_PARTICLE_DENSITY, 1),
  /** Engine wake foam particles per second at top speed. 0 disables. */
  wakeRate: envNumber(import.meta.env.VITE_BOAT_WAKE_RATE, 1500),
  /** Multiplier on splash (man overboard, etc.) particle counts. */
  splashDensity: envNumber(import.meta.env.VITE_SPLASH_DENSITY, 6),
  /** Velocity decay (1/s) of airborne hull spray; higher = it falls behind the hull sooner. */
  sprayDrag: envNumber(import.meta.env.VITE_BOAT_SPRAY_DRAG, 2.5)
};
