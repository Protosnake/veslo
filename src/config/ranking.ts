function envNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export interface RankDefinition {
  key: string;
  sprite: string;
  /** Optional explicit threshold; when omitted the curve is used. */
  minScore?: number;
}

export interface RankCurveConfig {
  /** Score for the first promotion (one kill ranks you up). */
  firstRankScore: number;
  /** Score for the top rank; ranks in between follow a power curve from first to top. */
  topRankScore: number;
  /** Round each derived threshold down to this multiple; 0 disables rounding. */
  roundDownTo: number;
}

export interface PromotionConfig {
  visibleMs: number;
  gapMs: number;
}

/** Rank order is lowest to highest. Add `minScore` to pin a single rank. */
export const RANK_DEFINITIONS: RankDefinition[] = [
  { key: 'rank.title.recruit', sprite: 'rank-recruit' },
  { key: 'rank.title.soldier', sprite: 'rank-soldier' },
  { key: 'rank.title.seniorSoldier', sprite: 'rank-senior-soldier' },
  { key: 'rank.title.juniorSergeant', sprite: 'rank-junior-sergeant' },
  { key: 'rank.title.sergeant', sprite: 'rank-sergeant' },
  { key: 'rank.title.seniorSergeant', sprite: 'rank-senior-sergeant' },
  { key: 'rank.title.chiefSergeant', sprite: 'rank-chief-sergeant' },
  { key: 'rank.title.staffSergeant', sprite: 'rank-staff-sergeant' },
  { key: 'rank.title.masterSergeant', sprite: 'rank-master-sergeant' },
  { key: 'rank.title.juniorLieutenant', sprite: 'rank-junior-lieutenant' },
  { key: 'rank.title.lieutenant', sprite: 'rank-lieutenant' },
  { key: 'rank.title.seniorLieutenant', sprite: 'rank-senior-lieutenant' },
  { key: 'rank.title.captain', sprite: 'rank-captain' },
  { key: 'rank.title.major', sprite: 'rank-major' },
  { key: 'rank.title.lieutenantColonel', sprite: 'rank-lieutenant-colonel' },
  { key: 'rank.title.colonel', sprite: 'rank-colonel' },
  { key: 'rank.title.brigadierGeneral', sprite: 'rank-brigadier-general' },
  { key: 'rank.title.majorGeneral', sprite: 'rank-major-general' },
  { key: 'rank.title.general', sprite: 'rank-general' }
];

export const RANK_CURVE: RankCurveConfig = {
  firstRankScore: envNumber(import.meta.env.VITE_RANK_FIRST_SCORE, 100),
  topRankScore: envNumber(import.meta.env.VITE_RANK_TOP_SCORE, 10000),
  roundDownTo: envNumber(import.meta.env.VITE_RANK_ROUND_TO, 50)
};

export const PROMOTION_TUNING: PromotionConfig = {
  visibleMs: 2300,
  gapMs: 250
};
