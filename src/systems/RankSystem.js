// Ukrainian State Border Guard Service (Державна прикордонна служба України - ДПСУ)
// Military rank progression following Fibonacci score milestones starting Private at 500
export const RANKS = [
  { minScore: 0, title: 'Рекрут', titleEn: 'Recruit', badge: '🪖' },
  { minScore: 500, title: 'Солдат', titleEn: 'Private', badge: '🎖️' },
  { minScore: 800, title: 'Старший солдат', titleEn: 'Senior Soldier', badge: '🎖️' },
  { minScore: 1300, title: 'Молодший сержант', titleEn: 'Junior Sergeant', badge: '🎗️' },
  { minScore: 2100, title: 'Сержант', titleEn: 'Sergeant', badge: '🎗️' },
  { minScore: 3400, title: 'Старший сержант', titleEn: 'Senior Sergeant', badge: '🎗️' },
  { minScore: 5500, title: 'Головний сержант', titleEn: 'Chief Sergeant', badge: '⭐' },
  { minScore: 8900, title: 'Штаб-сержант', titleEn: 'Staff Sergeant', badge: '⭐' },
  { minScore: 14400, title: 'Майстер-сержант', titleEn: 'Master Sergeant', badge: '⭐⭐' },
  { minScore: 23300, title: 'Молодший лейтенант', titleEn: 'Junior Lieutenant', badge: '💠' },
  { minScore: 37700, title: 'Лейтенант', titleEn: 'Lieutenant', badge: '💠💠' },
  { minScore: 61000, title: 'Старший лейтенант', titleEn: 'Senior Lieutenant', badge: '💠💠💠' },
  { minScore: 98700, title: 'Капітан', titleEn: 'Captain', badge: '🌟' },
  { minScore: 159700, title: 'Майор', titleEn: 'Major', badge: '🌟🌟' },
  { minScore: 258400, title: 'Підполковник', titleEn: 'Lieutenant Colonel', badge: '🌟🌟🌟' },
  { minScore: 418100, title: 'Полковник', titleEn: 'Colonel', badge: '🔱' },
  { minScore: 676500, title: 'Бригадний генерал', titleEn: 'Brigadier General', badge: '👑' },
  { minScore: 1094600, title: 'Генерал-майор', titleEn: 'Major General', badge: '👑👑' },
  { minScore: 1771100, title: 'Генерал', titleEn: 'General', badge: '👑👑👑' }
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
