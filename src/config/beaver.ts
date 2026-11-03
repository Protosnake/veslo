/**
 * Beaver tunables. Defaults live here; each can be overridden at build time
 * with the matching `VITE_BEAVER_*` variable.
 */
function envNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

// Debug: `?beavers=N` allows N beavers at once and tries to spawn every second.
const debugCount = Number(new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('beavers'));
const debug = Number.isFinite(debugCount) && debugCount > 0;

export const BEAVER_TUNING = {
  /** Master switch (1 = beavers on, 0 = off). */
  enabled: envNumber(import.meta.env.VITE_BEAVER_ENABLED, 1) > 0,
  /** Beavers alive at once. */
  maxActive: debug ? debugCount : envNumber(import.meta.env.VITE_BEAVER_MAX, 3),
  /** Seconds between spawn attempts (randomised +-30%). */
  spawnInterval: debug ? 1 : envNumber(import.meta.env.VITE_BEAVER_SPAWN_INTERVAL, 12),
  /** Spawn only on rocks within this X range of the boat (world units). */
  spawnMinDistance: envNumber(import.meta.env.VITE_BEAVER_SPAWN_MIN_DISTANCE, 40),
  spawnMaxDistance: envNumber(import.meta.env.VITE_BEAVER_SPAWN_MAX_DISTANCE, 160),
  /** Chance a new beaver is already sitting on its rock instead of swimming to it. */
  sitStartChance: envNumber(import.meta.env.VITE_BEAVER_SIT_START_CHANCE, 0.5),
  /** Only rocks at least this big (visual radius) are sat on. */
  minRockSize: envNumber(import.meta.env.VITE_BEAVER_MIN_ROCK_SIZE, 1.2),
  /** Model scale. */
  scale: envNumber(import.meta.env.VITE_BEAVER_SCALE, 0.9),
  /** Swim speed (m/s) and flee speed multiplier. */
  swimSpeed: envNumber(import.meta.env.VITE_BEAVER_SWIM_SPEED, 1.6),
  fleeSpeedMultiplier: envNumber(import.meta.env.VITE_BEAVER_FLEE_SPEED_MULTIPLIER, 2.2),
  /** Seconds the climb-up animation takes. */
  climbSeconds: envNumber(import.meta.env.VITE_BEAVER_CLIMB_SECONDS, 0.9),
  /** A swimming smuggler this close scares a beaver (world units). */
  fearRadius: envNumber(import.meta.env.VITE_BEAVER_FEAR_RADIUS, 9),
  /** Seconds a fleeing beaver swims before diving out of sight. */
  fleeSeconds: envNumber(import.meta.env.VITE_BEAVER_FLEE_SECONDS, 5),
  /** The boat getting this close to a beaver plays the beaver sound once. */
  sfxRadius: envNumber(import.meta.env.VITE_BEAVER_SFX_RADIUS, 50),
  /** After a beaver sound, no beaver sound plays for this many seconds (any beaver). */
  sfxThrottle: envNumber(import.meta.env.VITE_BEAVER_SFX_THROTTLE, 10),
  /** Beaver sound volume (0-1). */
  sfxVolume: envNumber(import.meta.env.VITE_BEAVER_SFX_VOLUME, 0.2)
};
