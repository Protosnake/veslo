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
  count: envNumber(import.meta.env.VITE_ROCK_COUNT, 16),
  /** Clusters spawn this far from the boat along the river (hidden by fog). */
  spawnDistance: envNumber(import.meta.env.VITE_ROCK_SPAWN_DISTANCE, 320),
  /** Clusters farther than this from the boat are recycled ahead of it. */
  recycleDistance: envNumber(import.meta.env.VITE_ROCK_RECYCLE_DISTANCE, 360),
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
  /** Extra rocks per cluster at the widest river sections (0.25 = +25%, scaled by local width). */
  wideBonus: envNumber(import.meta.env.VITE_ROCK_WIDE_BONUS, 0.25),
  /** Reeds per small rock around each cluster. */
  reedsPerSmallRock: envNumber(import.meta.env.VITE_ROCK_REEDS_PER_SMALL, 3),
  /** Minimum centre-to-centre gap between clusters. */
  minGap: envNumber(import.meta.env.VITE_ROCK_MIN_GAP, 30),
  /** Seconds a freshly spawned cluster takes to surface. */
  riseSeconds: envNumber(import.meta.env.VITE_ROCK_RISE_SECONDS, 0.01),
  /** Margin kept between a cluster and the bank (world units). */
  bankMargin: envNumber(import.meta.env.VITE_ROCK_BANK_MARGIN, 2.5)
};

export const STREAMING_TUNING = {
  /**
   * Wildlife farther than this from the boat is despawned with no penalty.
   * Swimmers farther than this go dormant (hidden, frozen, still shown by
   * their proximity arrow) until trackDistance. Nothing spawns beyond it.
   */
  despawnDistance: envNumber(import.meta.env.VITE_DESPAWN_DISTANCE, 320),
  /** Dormant swimmers are dropped (no penalty) beyond this distance; keep above despawnDistance. */
  trackDistance: envNumber(import.meta.env.VITE_TRACK_DISTANCE, 600),
  /** New swimmers appear at least this far from the boat (world units / metres). */
  spawnMinDistance: envNumber(import.meta.env.VITE_SPAWN_MIN_DISTANCE, 100),
  /** ...and no farther than this. Keep below despawnDistance. */
  spawnMaxDistance: envNumber(import.meta.env.VITE_SPAWN_MAX_DISTANCE, 250),
  /** Used only when the tide is disabled: chance (0-1) a swimmer spawns ahead of the nose (rest behind). */
  spawnAheadBias: envNumber(import.meta.env.VITE_SPAWN_AHEAD_BIAS, 1),
  /** Used only when the tide is disabled: half-angle (degrees) of the cone ahead of the nose. */
  spawnAheadConeDeg: envNumber(import.meta.env.VITE_SPAWN_AHEAD_CONE_DEG, 75)
};

function queryParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

/** Tide: swimmers spawn on one side of the boat (along X) and the side flips every phase. */
export const TIDE_TUNING = {
  /** 0 disables the tide (spawns follow the boat's nose again). */
  enabled: envNumber(queryParam('tide') ?? import.meta.env.VITE_TIDE_ENABLED, 1) !== 0,
  /** Phase length is random between these (seconds); set equal for a fixed length. `?tideSeconds=` sets both. */
  minSeconds: envNumber(queryParam('tideSeconds') ?? import.meta.env.VITE_TIDE_MIN_SECONDS, 60),
  maxSeconds: envNumber(queryParam('tideSeconds') ?? import.meta.env.VITE_TIDE_MAX_SECONDS, 180),
  /** Warning shown this many seconds before the flip. */
  warningSeconds: envNumber(import.meta.env.VITE_TIDE_WARNING_SECONDS, 8),
  /** 1 = +X first, -1 = -X first, 0 = whichever way the boat faces at run start. */
  startDirection: envNumber(queryParam('tideStart') ?? import.meta.env.VITE_TIDE_START_DIRECTION, 0)
};

export const MARKER_TUNING = {
  /** Triangles on an invisible ring around the boat pointing at nearby swimmers. */
  enabled: envNumber(import.meta.env.VITE_MARKERS_ENABLED, 1) !== 0,
  /** Ring radius around the boat (world units). */
  radius: envNumber(import.meta.env.VITE_MARKER_RADIUS, 4.5),
  /** Swimmers closer than this get a marker. */
  range: envNumber(import.meta.env.VITE_MARKER_RANGE, 1000),
  /** Swimmers closer than this lose their marker (they are visible by then). */
  hideDistance: envNumber(import.meta.env.VITE_MARKER_HIDE_DISTANCE, 20),
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

export const ZOOM_TUNING = {
  /** Gameplay camera zooms in this fraction on the boat at rest (0.25 = 25% closer). */
  zoomIn: envNumber(import.meta.env.VITE_ZOOM_IN, 0.25),
  /** Extra view widening at full speed, relative to the resting view (1 = up to 100% zoom out). */
  zoomOutAtMaxSpeed: envNumber(import.meta.env.VITE_ZOOM_OUT_MAX_SPEED, 1),
  /** How fast the zoom eases toward its target (per second). */
  smoothing: envNumber(import.meta.env.VITE_ZOOM_SMOOTHING, 2)
};

export const BREACH_TUNING = {
  /** Ranks lost when a smuggler reaches the south shore. */
  ranksLost: Math.max(1, Math.round(envNumber(import.meta.env.VITE_BREACH_RANKS_LOST, 1)))
};

export const VEGETATION_TUNING = {
  /**
   * Multiplier on shoreline reed clumps, patches and stalks (0 = none, 1 = the
   * original lush look). Reeds are instanced, so this cuts triangles and
   * instance-matrix uploads, not draw calls.
   */
  reedDensity: Math.min(1, Math.max(0, envNumber(import.meta.env.VITE_REED_DENSITY, 0.4)))
};

export const CLOUD_TUNING = {
  /** 0..1 share of the sky covered by clouds (0 = clear sky). */
  coverage: envNumber(import.meta.env.VITE_CLOUD_COVERAGE, 0.68),
  /** Wind drift speed of the cloud layer (sky-units per second). */
  speed: envNumber(import.meta.env.VITE_CLOUD_SPEED, 0.004),
  /** Cloud feature size; higher = smaller, more numerous clouds. */
  scale: envNumber(import.meta.env.VITE_CLOUD_SCALE, 1.6)
};

export const FOG_TUNING = {
  /** Base FogExp2 density (higher = thicker haze everywhere). */
  density: envNumber(import.meta.env.VITE_FOG_DENSITY, 0.0055),
  /** Extra density multiplier right at water level (ground mist); 1 = no layering. */
  groundBoost: envNumber(import.meta.env.VITE_FOG_GROUND_BOOST, 2.2),
  /** Density multiplier high above the water (treetops, towers, sky). */
  highFactor: envNumber(import.meta.env.VITE_FOG_HIGH_FACTOR, 0.35),
  /** How fast the mist thins with height (per metre). */
  heightFalloff: envNumber(import.meta.env.VITE_FOG_HEIGHT_FALLOFF, 0.12)
};

export const SUN_TUNING = {
  /** Brightness of the sun glow seen through the clouds (0 = hidden). */
  glow: envNumber(import.meta.env.VITE_SUN_GLOW, 1.0),
  /** Sun azimuth drift in rad/s (0 = fixed sun). 0.004 is ~26 min per full turn. */
  driftSpeed: envNumber(import.meta.env.VITE_SUN_DRIFT_SPEED, 0.004),
  /** Mean sun elevation above the horizon, degrees. */
  elevation: envNumber(import.meta.env.VITE_SUN_ELEVATION, 40),
  /** Elevation swing (+/- degrees) as the sun bobs through the clouds. */
  elevationSwing: envNumber(import.meta.env.VITE_SUN_ELEVATION_SWING, 10)
};

export const CLOUD_SHADOW_TUNING = {
  /** Darkening under cloud patches drifting over water and land (0 = off). */
  strength: envNumber(import.meta.env.VITE_CLOUD_SHADOW, 0.45),
  /** Patch size in 1/metres; lower = larger patches. */
  scale: envNumber(import.meta.env.VITE_CLOUD_SHADOW_SCALE, 0.012),
  /** Drift speed in patch units per second. */
  speed: envNumber(import.meta.env.VITE_CLOUD_SHADOW_SPEED, 0.03)
};
