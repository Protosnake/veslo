// ─── Veslo i18n System ───────────────────────────────────────────
// Lightweight, reactive, decoupled. Add a new language by adding
// a single locale object — nothing else needs to change.

const translations = {
  ua: {
    // ── Page ──
    'page.title': 'ВЕСЛО (Veslo) — Річковий Прикордонний Патруль',

    // ── Drone OSD ──
    'osd.drone': 'DRONE D-07',
    'osd.borderPatrol': 'BORDER PATROL',
    'osd.uplink': 'UPLINK',
    'osd.stable': 'STABLE',
    'osd.rec': 'REC',
    'osd.resolution': '4K 60FPS',
    'osd.alt': 'ALT',
    'osd.spd': 'SPD',
    'osd.hdg': 'HDG',
    'osd.bat': 'BAT',
    'osd.gps': 'GPS',
    'osd.wind': 'WIND',
    'osd.sat': 'SAT',
    'osd.threats': 'THREATS',

    // ── OSD Alerts ──
    'osd.alert.uplinkEstablished': 'UPLINK ESTABLISHED',
    'osd.alert.uplinkActive': 'UPLINK ESTABLISHED · PATROL ACTIVE',
    'osd.alert.batteryCritical': 'BATTERY CRITICAL',
    'osd.alert.signalLost': 'SIGNAL LOST',

    // ── HUD ──
    'hud.scorePill': '{score} ОЧКІВ',
    'hud.nextRank': 'НАСТУПНЕ ЗВАННЯ: {title} ({score})',
    'hud.maxRank': 'МАКСИМАЛЬНЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ!',
    'hud.best': 'BEST',

    // ── Controls Footer ──
    'controls.throttle': 'Газ / Задній хід',
    'controls.steering': 'Кермо',
    'controls.or': 'чи',
    'controls.strike': 'УДАР (ВЕСЛО)',

    // ── Start Modal ──
    'modal.start.eyebrow': 'DRONE D-07 · UPLINK READY',
    'modal.start.title': 'ВЕСЛО',
    'modal.start.subtitle': 'Річковий Прикордонний Патруль • Пряма Трансляція',
    'modal.start.mission': '⚠️ <strong>БОЙОВЕ ЗАВДАННЯ:</strong> Захистити кордон від порушників!\nЯкщо хоч один дістанеться пляжу або ви <strong>вріжетеся в берег</strong> — місію провалено!',
    'modal.start.oarTitle': '🛶 Удар веслом:',
    'modal.start.oarPoints': '+100 ОЧКІВ',
    'modal.start.oarDesc': 'Пробіл чи клік мишкою для удару веслом!',
    'modal.start.ramTitle': '💥 Таран човном:',
    'modal.start.ramPoints': '+50 ОЧКІВ',
    'modal.start.ramDesc': 'Збивайте порушників корпусом човна.',
    'modal.start.engineTitle': '🔥 Гвинт двигуна:',
    'modal.start.enginePoints': '+500 ОЧКІВ',
    'modal.start.engineDesc': 'Задній хід на двигуні! Одразу відкриває звання Солдата!',
    'modal.start.btn': 'ЗАПУСТИТИ ДРОН',

    // ── Game Over Modal ──
    'modal.over.eyebrow': 'ТРАНСЛЯЦІЮ ПЕРЕРВАНО · СИГНАЛ ВТРАЧЕНО',
    'modal.over.titleBreach': 'КОРДОН ПРОРВАНО!',
    'modal.over.subtitleBreach': 'Порушник переплив річку. Місію провалено.',
    'modal.over.titleCrash': 'ЧОВЕН ВРІЗАВСЯ В БЕРЕГ!',
    'modal.over.rankLabel': 'ДОСЯГНУТЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ',
    'modal.over.rankScore': 'Фінальний рахунок: {score} очок',
    'modal.over.statScore': 'Фінальний рахунок',
    'modal.over.statSmacked': 'Порушників знешкоджено',
    'modal.over.btn': 'ПЕРЕДИСЛОКУВАТИ ДРОН',

    // ── Rank Up Banner ──
    'rank.promotion': 'ПІДВИЩЕННЯ У ЗВАННІ ДПСУ!',

    // ── Floating Score Popups ──
    'score.whack': 'БОНК! +100',
    'score.shred': 'ПРОПЕЛЕР! +500',
    'score.ram': 'ТАРАН! +50',
    'score.breach': 'ПРОРИВ КОРДОНУ! ⚠️',

    // ── Crash Reasons ──
    'crash.riverbank': 'ВРІЗАВСЯ В БЕРЕГ РІЧКИ!',
    'crash.north': 'ВРІЗАВСЯ В ПІВНІЧНИЙ ПРИКОРДОННИЙ ПОСТ!',
    'crash.south': 'ВРІЗАВСЯ В ПІВДЕННИЙ ПЛЯЖ!',
    'crash.west': 'ВРІЗАВСЯ В ЗАХІДНИЙ РИФ!',
    'crash.east': 'ВРІЗАВСЯ В СХІДНИЙ РИФ!',
  },

  en: {
    // ── Page ──
    'page.title': 'VESLO — Border River Patrol',

    // ── Drone OSD ──
    'osd.drone': 'DRONE D-07',
    'osd.borderPatrol': 'BORDER PATROL',
    'osd.uplink': 'UPLINK',
    'osd.stable': 'STABLE',
    'osd.rec': 'REC',
    'osd.resolution': '4K 60FPS',
    'osd.alt': 'ALT',
    'osd.spd': 'SPD',
    'osd.hdg': 'HDG',
    'osd.bat': 'BAT',
    'osd.gps': 'GPS',
    'osd.wind': 'WIND',
    'osd.sat': 'SAT',
    'osd.threats': 'THREATS',

    // ── OSD Alerts ──
    'osd.alert.uplinkEstablished': 'UPLINK ESTABLISHED',
    'osd.alert.uplinkActive': 'UPLINK ESTABLISHED · PATROL ACTIVE',
    'osd.alert.batteryCritical': 'BATTERY CRITICAL',
    'osd.alert.signalLost': 'SIGNAL LOST',

    // ── HUD ──
    'hud.scorePill': '{score} POINTS',
    'hud.nextRank': 'NEXT RANK: {title} ({score})',
    'hud.maxRank': 'MAXIMUM SBGS MILITARY RANK!',
    'hud.best': 'BEST',

    // ── Controls Footer ──
    'controls.throttle': 'Throttle / Reverse',
    'controls.steering': 'Steering',
    'controls.or': 'or',
    'controls.strike': 'STRIKE (OAR)',

    // ── Start Modal ──
    'modal.start.eyebrow': 'DRONE D-07 · UPLINK READY',
    'modal.start.title': 'VESLO',
    'modal.start.subtitle': 'Border River Patrol • Live Aerial Feed',
    'modal.start.mission': '⚠️ <strong>COMBAT MISSION:</strong> Protect the border from intruders!\nIf even one reaches the beach or you <strong>crash into the shore</strong> — mission failed!',
    'modal.start.oarTitle': '🛶 Oar strike:',
    'modal.start.oarPoints': '+100 POINTS',
    'modal.start.oarDesc': 'Space or mouse click to strike with the oar!',
    'modal.start.ramTitle': '💥 Boat ram:',
    'modal.start.ramPoints': '+50 POINTS',
    'modal.start.ramDesc': 'Ram intruders with the boat hull.',
    'modal.start.engineTitle': '🔥 Engine propeller:',
    'modal.start.enginePoints': '+500 POINTS',
    'modal.start.engineDesc': 'Reverse throttle! Instantly unlocks the Private rank!',
    'modal.start.btn': 'LAUNCH DRONE',

    // ── Game Over Modal ──
    'modal.over.eyebrow': 'FEED INTERRUPTED · SIGNAL LOST',
    'modal.over.titleBreach': 'BORDER BREACHED!',
    'modal.over.subtitleBreach': 'A smuggler reached the southern shore. Mission failed.',
    'modal.over.titleCrash': 'BOAT CRASHED INTO SHORE!',
    'modal.over.rankLabel': 'ACHIEVED SBGS MILITARY RANK',
    'modal.over.rankScore': 'Final score: {score} points',
    'modal.over.statScore': 'Final Score',
    'modal.over.statSmacked': 'Smugglers Smacked',
    'modal.over.btn': 'REDEPLOY DRONE',

    // ── Rank Up Banner ──
    'rank.promotion': 'SBGS RANK PROMOTION!',

    // ── Floating Score Popups ──
    'score.whack': 'BONK! +100',
    'score.shred': 'PROPELLER! +500',
    'score.ram': 'RAM! +50',
    'score.breach': 'BORDER BREACH! ⚠️',

    // ── Crash Reasons ──
    'crash.riverbank': 'CRASHED INTO RIVERBANK!',
    'crash.north': 'CRASHED INTO NORTH BORDER POST!',
    'crash.south': 'CRASHED ONTO SOUTH BEACH!',
    'crash.west': 'CRASHED INTO WEST REEF BARRIER!',
    'crash.east': 'CRASHED INTO EAST REEF BARRIER!',
  }
};

// ── Available locales (drives the switcher UI) ──
const locales = [
  { code: 'ua', label: 'UA' },
  { code: 'en', label: 'EN' }
];

// ── Singleton state ──
let currentLocale = localStorage.getItem('veslo_lang') || 'ua';
if (!translations[currentLocale]) currentLocale = 'ua';

const listeners = [];

/**
 * Translate a key, with optional {token} interpolation.
 * @param {string} key   Dot-delimited translation key
 * @param {Object} [params]  e.g. { score: 100 }
 * @returns {string}
 */
function t(key, params) {
  let str = (translations[currentLocale] && translations[currentLocale][key])
         || (translations.ua[key])
         || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }
  return str;
}

function getLocale() {
  return currentLocale;
}

function setLocale(code) {
  if (!translations[code] || code === currentLocale) return;
  currentLocale = code;
  localStorage.setItem('veslo_lang', code);
  document.documentElement.lang = code === 'ua' ? 'uk' : code;
  document.title = t('page.title');
  listeners.forEach(fn => fn(code));
}

function onLocaleChange(fn) {
  listeners.push(fn);
}

/**
 * Return the locale-appropriate title for a rank object
 * (which carries both `title` and `titleEn`).
 */
function getRankTitle(rank) {
  if (!rank) return '';
  if (currentLocale === 'ua') return rank.title;
  return rank.titleEn || rank.title;
}

// Set initial HTML lang
document.documentElement.lang = currentLocale === 'ua' ? 'uk' : currentLocale;

export const i18n = { t, getLocale, setLocale, onLocaleChange, locales, getRankTitle };
export { t, getRankTitle };
