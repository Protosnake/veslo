// World / play-area configuration. The original design was a 100% x 100% box;
// the default is now 125% long (X) and 150% wide (Z). All world positions and
// gameplay limits derive from these so the river, banks, props and AI stay in
// sync. Tweak the defaults here, or override per-load with ?worldX= & ?worldZ=.
const DEFAULT_WORLD_X_SCALE = 1.25;
const DEFAULT_WORLD_Z_SCALE = 1.5;
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
