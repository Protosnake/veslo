/**
 * Endless-river tunables (rocks, streaming distance, breach penalty). Defaults
 * live here; each can be overridden at build time with the matching `VITE_*`
 * variable.
 */
function envNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const ROCK_TUNING = {
  /** Rock clusters alive in the river at once (shared by both travel directions). */
  count: envNumber(import.meta.env.VITE_ROCK_COUNT, 9),
  /** Clusters spawn this far from the boat along the river (hidden by fog). */
  spawnDistance: envNumber(import.meta.env.VITE_ROCK_SPAWN_DISTANCE, 170),
  /** Clusters farther than this from the boat are recycled ahead of it. */
  recycleDistance: envNumber(import.meta.env.VITE_ROCK_RECYCLE_DISTANCE, 210),
  /** Big rocks per cluster (inclusive range) and their radius. */
  bigMin: envNumber(import.meta.env.VITE_ROCK_BIG_MIN, 1),
  bigMax: envNumber(import.meta.env.VITE_ROCK_BIG_MAX, 2),
  minSize: envNumber(import.meta.env.VITE_ROCK_MIN_SIZE, 1.5),
  maxSize: envNumber(import.meta.env.VITE_ROCK_MAX_SIZE, 2.4),
  /** Small rocks per cluster (inclusive range) and their radius. */
  smallMin: envNumber(import.meta.env.VITE_ROCK_SMALL_MIN, 3),
  smallMax: envNumber(import.meta.env.VITE_ROCK_SMALL_MAX, 6),
  smallMinSize: envNumber(import.meta.env.VITE_ROCK_SMALL_MIN_SIZE, 0.5),
  smallMaxSize: envNumber(import.meta.env.VITE_ROCK_SMALL_MAX_SIZE, 0.9),
  /** Reeds per small rock around each cluster. */
  reedsPerSmallRock: envNumber(import.meta.env.VITE_ROCK_REEDS_PER_SMALL, 3),
  /** Minimum centre-to-centre gap between clusters. */
  minGap: envNumber(import.meta.env.VITE_ROCK_MIN_GAP, 30),
  /** Seconds a freshly spawned cluster takes to surface. */
  riseSeconds: envNumber(import.meta.env.VITE_ROCK_RISE_SECONDS, 1.4),
  /** Margin kept between a cluster and the bank (world units). */
  bankMargin: envNumber(import.meta.env.VITE_ROCK_BANK_MARGIN, 2.5)
};

export const STREAMING_TUNING = {
  /**
   * Swimmers and wildlife farther than this from the boat are despawned with
   * no penalty; nothing spawns or simulates beyond it either.
   */
  despawnDistance: envNumber(import.meta.env.VITE_DESPAWN_DISTANCE, 320),
  /** New swimmers appear at least this far from the boat (world units / metres). */
  spawnMinDistance: envNumber(import.meta.env.VITE_SPAWN_MIN_DISTANCE, 100),
  /** ...and no farther than this. Keep below despawnDistance. */
  spawnMaxDistance: envNumber(import.meta.env.VITE_SPAWN_MAX_DISTANCE, 250)
};

export const MARKER_TUNING = {
  /** Triangles on an invisible ring around the boat pointing at nearby swimmers. */
  enabled: envNumber(import.meta.env.VITE_MARKERS_ENABLED, 1) !== 0,
  /** Ring radius around the boat (world units). */
  radius: envNumber(import.meta.env.VITE_MARKER_RADIUS, 4.5),
  /** Swimmers closer than this get a marker. */
  range: envNumber(import.meta.env.VITE_MARKER_RANGE, 1000),
  /** Base triangle size. */
  size: envNumber(import.meta.env.VITE_MARKER_SIZE, 0.7),
  /** Peak triangle opacity (0..1). */
  opacity: envNumber(import.meta.env.VITE_MARKER_OPACITY, 0.9),
  /** Fraction of peak opacity kept at the farthest distance, so far enemies never fade out (0..1). */
  minOpacityFraction: envNumber(import.meta.env.VITE_MARKER_MIN_OPACITY, 0.8),
  /** Distance at which closeness (size/brightness ramp) reaches zero. */
  falloffDistance: envNumber(import.meta.env.VITE_MARKER_FALLOFF, 250),
  /** Arrows pointing within this many degrees of each other merge so labels never overlap. */
  mergeAngleDeg: envNumber(import.meta.env.VITE_MARKER_MERGE_ANGLE, 20),
  /** Distance label size multiplier (1 = original). */
  labelScale: envNumber(import.meta.env.VITE_MARKER_LABEL_SCALE, 0.5),
  /** Arrows shown at once; extra swimmers merge into the arrow of the nearest direction. */
  maxMarkers: Math.max(1, Math.round(envNumber(import.meta.env.VITE_MARKER_MAX, 5)))
};

export const BREACH_TUNING = {
  /** Ranks lost when a smuggler reaches the south shore. */
  ranksLost: Math.max(1, Math.round(envNumber(import.meta.env.VITE_BREACH_RANKS_LOST, 1)))
};
