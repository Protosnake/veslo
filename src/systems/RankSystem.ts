// Ukrainian State Border Guard Service (Державна прикордонна служба України - ДПСУ)
import { RANK_CURVE, RANK_DEFINITIONS } from '../config/ranking.js';

export interface Rank {
  minScore: number;
  key: string;
  sprite: string;
}

export interface RankInfo {
  current: Rank;
  next: Rank | null;
  index: number;
}

function thresholdFor(index: number): number {
  if (index === 0) return 0;
  const raw = RANK_CURVE.quadratic * index * index + RANK_CURVE.linear * index;
  return RANK_CURVE.roundDownTo > 0
    ? Math.floor(raw / RANK_CURVE.roundDownTo) * RANK_CURVE.roundDownTo
    : Math.round(raw);
}

export const RANKS: Rank[] = RANK_DEFINITIONS.map((definition, index) => ({
  ...definition,
  minScore: definition.minScore ?? thresholdFor(index)
}));

export class RankSystem {
  lastRankIndex = 0;

  reset(): void {
    this.lastRankIndex = 0;
  }

  getRankForScore(score: number): RankInfo {
    let index = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (score >= RANKS[i].minScore) {
        index = i;
        break;
      }
    }
    return {
      current: RANKS[index],
      next: RANKS[index + 1] || null,
      index
    };
  }

  getProgress(score: number): number {
    const { current, next } = this.getRankForScore(score);
    if (!next) return 1.0;
    const range = next.minScore - current.minScore;
    const progress = (score - current.minScore) / range;
    return Math.min(1.0, Math.max(0.0, progress));
  }

  /**
   * Drop `ranks` ranks: the score falls to the threshold of the rank reached
   * (0 at the bottom). Keeps promotion tracking in sync so the lost ranks can
   * be earned (and announced) again.
   */
  demote(
    score: number,
    ranks = 1
  ): { score: number; fromIndex: number; toIndex: number; eliminated: boolean } {
    const fromIndex = this.getRankForScore(score).index;
    // Dropping below the lowest rank ends the run; the score is kept for the results screen.
    if (fromIndex - ranks < 0) return { score, fromIndex, toIndex: 0, eliminated: true };
    const toIndex = fromIndex - ranks;
    this.lastRankIndex = toIndex;
    return { score: toIndex === 0 ? 0 : RANKS[toIndex].minScore, fromIndex, toIndex, eliminated: false };
  }

  checkRankUp(score: number): Rank[] {
    const { index } = this.getRankForScore(score);
    if (index <= this.lastRankIndex) return [];
    const promoted: Rank[] = [];
    for (let i = this.lastRankIndex + 1; i <= index; i++) {
      promoted.push(RANKS[i]);
    }
    this.lastRankIndex = index;
    return promoted; // every rank crossed, in order
  }
}

export const rankSystem = new RankSystem();
