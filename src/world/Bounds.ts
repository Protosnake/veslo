// World / play-area configuration. The original design was a 100% x 100% box;
// the default is now 125% long (X) and 225% wide (Z). All world positions and
// gameplay limits derive from these so the river, banks, props and AI stay in
// sync. Tweak the defaults here, or override per-load with ?worldX= & ?worldZ=.
const DEFAULT_WORLD_X_SCALE = 1.25;
const DEFAULT_WORLD_Z_SCALE = 2.25;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

const params = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search)
  : null;

const readScale = (name: string, fallback: number): number => {
  const value = parseFloat(params?.get(name) ?? '');
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
};

export const WORLD_X_SCALE = readScale('worldX', DEFAULT_WORLD_X_SCALE);
export const WORLD_Z_SCALE = readScale('worldZ', DEFAULT_WORLD_Z_SCALE);

export const sx = (value: number): number => value * WORLD_X_SCALE;
export const sz = (value: number): number => value * WORLD_Z_SCALE;

export const RIVER_HALF_WIDTH = sz(16);

// Endless river: the static world is WORLD_CHUNKS distinct chunks laid end to
// end that repeat every WORLD_PERIOD units, so the boat can run forever along X.
// Tune with VITE_WORLD_CHUNKS / VITE_WORLD_CHUNK_WIDTH or ?worldChunks= .
const readInt = (query: string, envValue: unknown, fallback: number, min: number, max: number): number => {
  const fromQuery = parseFloat(params?.get(query) ?? '');
  const fromEnv = Number(envValue);
  const hasEnv = envValue !== undefined && envValue !== '' && Number.isFinite(fromEnv);
  const raw = Number.isFinite(fromQuery) ? fromQuery : hasEnv ? fromEnv : fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
};

export const WORLD_CHUNK_WIDTH = readInt('worldChunkWidth', import.meta.env.VITE_WORLD_CHUNK_WIDTH, Math.round(sx(140)), 80, 600);
export const WORLD_CHUNKS = readInt('worldChunks', import.meta.env.VITE_WORLD_CHUNKS, 3, 1, 8);
export const WORLD_PERIOD = WORLD_CHUNK_WIDTH * WORLD_CHUNKS;

/** Fold an X coordinate into [-WORLD_CHUNK_WIDTH/2, WORLD_CHUNK_WIDTH/2]. */
export const foldChunkX = (x: number): number => x - WORLD_CHUNK_WIDTH * Math.round(x / WORLD_CHUNK_WIDTH);

export const PLAY_MIN_Z = sz(-14.6);
export const PLAY_MAX_Z = sz(14.4);

// ---------------------------------------------------------------------------
// River bends. The channel meanders as an S / reversed S: the centerline Z is a
// sum of three harmonics of WORLD_PERIOD (so the endless tiling still closes
// exactly) with different weights and phases, so each bend has its own length
// and sharpness. All static world content is authored on a straight river and
// sheared by riverCenterZ(x); gameplay uses the same function for bank limits.
// Tune with VITE_RIVER_BEND_AMPLITUDE / _MAX_SLOPE / _SCALE or ?bend= (0 = straight).
// ---------------------------------------------------------------------------
const readFloat = (query: string, envValue: unknown, fallback: number, min: number, max: number): number => {
  const fromQuery = parseFloat(params?.get(query) ?? '');
  const fromEnv = Number(envValue);
  const hasEnv = envValue !== undefined && envValue !== '' && Number.isFinite(fromEnv);
  const raw = Number.isFinite(fromQuery) ? fromQuery : hasEnv ? fromEnv : fallback;
  return Math.min(max, Math.max(min, raw));
};

/** Wanted peak sideways drift of the centerline (world units); steeper bends are scaled down to MAX_SLOPE. */
export const RIVER_BEND_AMPLITUDE = readFloat('bendAmp', import.meta.env.VITE_RIVER_BEND_AMPLITUDE, 80, 0, 300);
/** Steepest allowed centerline slope (dz/dx); keeps the banks from folding over. */
export const RIVER_BEND_MAX_SLOPE = readFloat('bendSlope', import.meta.env.VITE_RIVER_BEND_MAX_SLOPE, 0.4, 0.05, 1);
/** 0 = straight river, 1 = full bends. */
export const RIVER_BEND_SCALE = readFloat('bend', import.meta.env.VITE_RIVER_BEND_SCALE, 1, 0, 1);

// [harmonic, weight, phase]: a wide lazy S, a tighter reversed S, and a short wiggle.
const BEND_HARMONICS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1.0, 0.0],
  [2, 0.42, 1.3],
  [3, 0.18, 2.6]
];
const BEND_OMEGA = (Math.PI * 2) / WORLD_PERIOD;

const rawBend = (x: number): number => {
  let sum = 0;
  for (const [k, w, p] of BEND_HARMONICS) sum += w * Math.sin(k * BEND_OMEGA * x + p);
  return sum;
};
const rawBendSlope = (x: number): number => {
  let sum = 0;
  for (const [k, w, p] of BEND_HARMONICS) sum += w * k * BEND_OMEGA * Math.cos(k * BEND_OMEGA * x + p);
  return sum;
};
const rawBendCurve = (x: number): number => {
  let sum = 0;
  for (const [k, w, p] of BEND_HARMONICS) sum -= w * k * k * BEND_OMEGA * BEND_OMEGA * Math.sin(k * BEND_OMEGA * x + p);
  return sum;
};

const BEND_ORIGIN = rawBend(0); // so the centerline passes through z = 0 at x = 0 (intro shot)
const bendScale = (): number => {
  let maxDev = 1e-6;
  let maxSlope = 1e-6;
  let maxCurve = 1e-9;
  const samples = 1024;
  for (let i = 0; i < samples; i++) {
    const x = (WORLD_PERIOD * i) / samples;
    maxDev = Math.max(maxDev, Math.abs(rawBend(x) - BEND_ORIGIN));
    maxSlope = Math.max(maxSlope, Math.abs(rawBendSlope(x)));
    maxCurve = Math.max(maxCurve, Math.abs(rawBendCurve(x)));
  }
  // Bend radius must stay well above the half width or the inner bank folds.
  const maxCurvature = 1 / (RIVER_HALF_WIDTH * 1.8);
  return RIVER_BEND_SCALE * Math.min(
    RIVER_BEND_AMPLITUDE / maxDev,
    RIVER_BEND_MAX_SLOPE / maxSlope,
    maxCurvature / maxCurve
  );
};
const BEND_K = bendScale();

/** Z of the river centerline at world X (0 at x = 0; periodic in WORLD_PERIOD). */
export const riverCenterZ = (x: number): number => (rawBend(x) - BEND_ORIGIN) * BEND_K;
/** dz/dx of the centerline. */
export const riverSlopeAt = (x: number): number => rawBendSlope(x) * BEND_K;
/** Z position relative to the centerline (the old straight-river Z, before width variation). */
export const lateralOf = (x: number, z: number): number => z - riverCenterZ(x);

// River width varies along its length: a lateral stretch factor (1 = nominal
// width) from two harmonics that do not line up with the bend harmonics, so
// pinches and wide pools fall at different places than the turns.
/** Width swing as a fraction of nominal (0.5 = from 50% to 150%); 0 = constant width. */
export const RIVER_WIDTH_VARIATION = readFloat('widthVar', import.meta.env.VITE_RIVER_WIDTH_VARIATION, 0.5, 0, 0.8);
const WIDTH_HARMONICS: ReadonlyArray<readonly [number, number, number]> = [
  [2, 0.6, 0.7],
  [3, 0.4, 4.1]
];
const rawWidth = (x: number): number => {
  let sum = 0;
  for (const [k, w, p] of WIDTH_HARMONICS) sum += w * Math.sin(k * BEND_OMEGA * x + p);
  return sum;
};
const WIDTH_NORM = (() => {
  let peak = 1e-6;
  for (let i = 0; i < 1024; i++) peak = Math.max(peak, Math.abs(rawWidth((WORLD_PERIOD * i) / 1024)));
  return peak;
})();
/** Width multiplier at world X (periodic in WORLD_PERIOD). */
export const riverWidthScale = (x: number): number => 1 + RIVER_WIDTH_VARIATION * (rawWidth(x) / WIDTH_NORM);
/** Maps a straight-river lateral offset (old Z, relative to the centerline) to world Z at world X. */
export const riverZ = (x: number, lateral: number): number => riverCenterZ(x) + lateral * riverWidthScale(x);
export const playMinZ = (x: number): number => riverZ(x, PLAY_MIN_Z);
export const playMaxZ = (x: number): number => riverZ(x, PLAY_MAX_Z);
/** Actual peak drift after slope/curvature limits (for docs and debugging). */
export const RIVER_BEND_PEAK = (() => {
  let peak = 0;
  for (let i = 0; i < 1024; i++) peak = Math.max(peak, Math.abs(riverCenterZ((WORLD_PERIOD * i) / 1024)));
  return peak;
})();
