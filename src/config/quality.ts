/**
 * Adaptive quality presets chosen from device hints.
 *
 * Defaults live here so the game runs without any local `.env`. Every value
 * can be overridden at build time with the matching `VITE_*` variable or
 * per-load with its `?`-query flag.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityHints {
  deviceMemoryGB: number | null;
  cores: number | null;
  saveData: boolean;
}

export interface QualitySettings {
  tier: QualityTier;
  source: 'auto' | QualityTier;
  pixelRatioCap: number;
  shadowMapSize: number;
  particleBudget: number;
  antialias: boolean;
  hints: QualityHints;
}

type QualityPreset = Omit<QualitySettings, 'tier' | 'source' | 'hints'>;

const PRESETS: Record<QualityTier, QualityPreset> = {
  low: {
    pixelRatioCap: 1,
    shadowMapSize: 512,
    particleBudget: 20000,
    antialias: false
  },
  medium: {
    pixelRatioCap: 1.25,
    shadowMapSize: 1024,
    particleBudget: 30000,
    antialias: true
  },
  high: {
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    particleBudget: 40000,
    antialias: true
  }
};

function readTierOverride(value: unknown): QualityTier | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized === 'low' || normalized === 'medium' || normalized === 'high'
    ? normalized
    : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getQuery(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readHints(): QualityHints {
  if (typeof navigator === 'undefined') {
    return { deviceMemoryGB: null, cores: null, saveData: false };
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    deviceMemoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    saveData: nav.connection?.saveData === true
  };
}

function detectTier(hints: QualityHints): QualityTier {
  if (hints.saveData) return 'low';
  const memory = hints.deviceMemoryGB;
  const cores = hints.cores;
  if ((memory != null && memory <= 2) || (cores != null && cores <= 2)) return 'low';
  if ((memory != null && memory <= 4) || (cores != null && cores <= 4)) return 'medium';
  return 'high';
}

function resolveNumber(queryName: string, envValue: unknown, fallback: number): number {
  return readNumber(getQuery(queryName)) ?? readNumber(envValue) ?? fallback;
}

const hints = readHints();
const override =
  readTierOverride(getQuery('quality')) ??
  readTierOverride(import.meta.env.VITE_QUALITY);
const tier = override ?? detectTier(hints);
const preset = PRESETS[tier];

export const QUALITY: QualitySettings = {
  tier,
  source: override ?? 'auto',
  pixelRatioCap: clamp(
    resolveNumber('pixelRatio', import.meta.env.VITE_PIXEL_RATIO_CAP, preset.pixelRatioCap),
    0.5,
    3
  ),
  shadowMapSize: Math.round(
    clamp(
      resolveNumber('shadow', import.meta.env.VITE_SHADOW_MAP_SIZE, preset.shadowMapSize),
      256,
      4096
    )
  ),
  particleBudget: Math.round(
    clamp(
      resolveNumber('particles', import.meta.env.VITE_PARTICLE_BUDGET, preset.particleBudget),
      30,
      600
    )
  ),
  antialias: preset.antialias,
  hints
};
