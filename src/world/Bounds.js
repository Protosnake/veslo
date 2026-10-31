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

const readScale = (name, fallback) => {
  const value = parseFloat(params?.get(name));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
};

export const WORLD_X_SCALE = readScale('worldX', DEFAULT_WORLD_X_SCALE);
export const WORLD_Z_SCALE = readScale('worldZ', DEFAULT_WORLD_Z_SCALE);

export const sx = (value) => value * WORLD_X_SCALE;
export const sz = (value) => value * WORLD_Z_SCALE;

export const RIVER_HALF_WIDTH = sz(16);

export const PLAY_MIN_X = sx(-31.5);
export const PLAY_MAX_X = sx(31.5);
export const PLAY_MIN_Z = sz(-14.6);
export const PLAY_MAX_Z = sz(14.4);
