// Ukrainian State Border Guard Service (Державна прикордонна служба України - ДПСУ)
// Military rank progression following Fibonacci score milestones starting Private at 500
export const RANKS = [
  { minScore: 0, key: 'rank.title.recruit', sprite: 'rank-recruit' },
  { minScore: 500, key: 'rank.title.soldier', sprite: 'rank-soldier' },
  { minScore: 800, key: 'rank.title.seniorSoldier', sprite: 'rank-senior-soldier' },
  { minScore: 1300, key: 'rank.title.juniorSergeant', sprite: 'rank-junior-sergeant' },
  { minScore: 2100, key: 'rank.title.sergeant', sprite: 'rank-sergeant' },
  { minScore: 3400, key: 'rank.title.seniorSergeant', sprite: 'rank-senior-sergeant' },
  { minScore: 5500, key: 'rank.title.chiefSergeant', sprite: 'rank-chief-sergeant' },
  { minScore: 8900, key: 'rank.title.staffSergeant', sprite: 'rank-staff-sergeant' },
  { minScore: 14400, key: 'rank.title.masterSergeant', sprite: 'rank-master-sergeant' },
  { minScore: 23300, key: 'rank.title.juniorLieutenant', sprite: 'rank-junior-lieutenant' },
  { minScore: 37700, key: 'rank.title.lieutenant', sprite: 'rank-lieutenant' },
  { minScore: 61000, key: 'rank.title.seniorLieutenant', sprite: 'rank-senior-lieutenant' },
  { minScore: 98700, key: 'rank.title.captain', sprite: 'rank-captain' },
  { minScore: 159700, key: 'rank.title.major', sprite: 'rank-major' },
  { minScore: 258400, key: 'rank.title.lieutenantColonel', sprite: 'rank-lieutenant-colonel' },
  { minScore: 418100, key: 'rank.title.colonel', sprite: 'rank-colonel' },
  { minScore: 676500, key: 'rank.title.brigadierGeneral', sprite: 'rank-brigadier-general' },
  { minScore: 1094600, key: 'rank.title.majorGeneral', sprite: 'rank-major-general' },
  { minScore: 1771100, key: 'rank.title.general', sprite: 'rank-general' }
];

export class RankSystem {
  constructor() {
    this.lastRankIndex = 0;
  }

  reset() {
    this.lastRankIndex = 0;
  }

  getRankForScore(score) {
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

  getProgress(score) {
    const { current, next } = this.getRankForScore(score);
    if (!next) return 1.0;
    const range = next.minScore - current.minScore;
    const progress = (score - current.minScore) / range;
    return Math.min(1.0, Math.max(0.0, progress));
  }

  checkRankUp(score) {
    const { index, current } = this.getRankForScore(score);
    if (index > this.lastRankIndex) {
      this.lastRankIndex = index;
      return current; // returns newly unlocked rank!
    }
    return null;
  }
}

export const rankSystem = new RankSystem();
