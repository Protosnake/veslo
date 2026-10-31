// ─── Veslo i18n System ───────────────────────────────────────────
// Lightweight, reactive, decoupled. To add a language:
//   1. Add a new locale object to `translations` below.
//   2. Add its entry to `locales`.
// All user-facing strings live in this file.

const translations = {
  ua: {
    // ── Page ──
    'page.title': 'Річковий Прикордонний Патруль',

    // ── Drone OSD ──
    'osd.drone': 'DRONE D-07',
    'osd.borderPatrol': 'ДСПУ',
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
    'osd.threats': 'ПОРУШНИКИ',

    // ── OSD Alerts ──
    'osd.alert.uplinkEstablished': 'ЗВ`ЯЗОК ВСТАНОВЛЕНО',
    'osd.alert.uplinkActive': 'ЗВ`ЯЗОК ВСТАНОВЛЕНО - ВИХОДИШ НА ПОЗИЦIЮ',
    'osd.alert.batteryCritical': 'НИЗЬКИЙ ЗАРЯД БАТАРЕЇ',
    'osd.alert.signalLost': 'ЗВ`ЯЗОК ВТРАЧЕНО',

    // ── HUD ──
    'hud.scorePill': '{score} ОЧОК',
    'hud.nextRank': 'НАСТУПНЕ ЗВАННЯ: {title} ({score})',
    'hud.maxRank': 'МАКСИМАЛЬНЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ!',
    'hud.best': 'НАЙКРАЩИЙ РЕЗУЛЬТАТ',

    // ── Controls Footer ──
    'controls.throttle': 'Газ / Реверс',
    'controls.steering': 'Кермо',
    'controls.strike': 'УДАР (ВЕСЛО)',

    // ── Start Modal ──
    'modal.start.eyebrow': 'DRONE D-07 · UPLINK READY',
    'modal.start.title': 'ВЕСЛО',
    'modal.start.subtitle': 'Патруль ДСПУ • Пряма Трансляція',
    'modal.start.missionTitle': '⚠️ <strong>БОЙОВЕ ЗАВДАННЯ:</strong> Захистити кордон від порушників!',
    'modal.start.missionWarning': 'Якщо хоч один дістанеться іншого берегу або ви <strong>вріжетеся в берег</strong> — місію провалено!',
    'modal.start.oarTitle': '🛶 Удар веслом:',
    'modal.start.oarPoints': '+100 ОЧКІВ',
    'modal.start.oarDesc': 'Пробіл для удару веслом!',
    'modal.start.ramTitle': '💥 Таран човном:',
    'modal.start.ramPoints': '+50 ОЧКІВ',
    'modal.start.ramDesc': 'Збивайте порушників корпусом човна.',
    'modal.start.engineTitle': '🔥 Різня ГВИНТОМ:',
    'modal.start.enginePoints': '+500 ОЧКІВ',
    'modal.start.engineDesc': 'Задній хід на двигуні!',
    'modal.start.btn': 'ДО РОБОТИ',

    // ── Game Over Modal ──
    'modal.over.eyebrow': 'ТРАНСЛЯЦІЮ ПЕРЕРВАНО · СИГНАЛ ВТРАЧЕНО',
    'modal.over.titleBreach': 'КОРДОН ПРОРВАНО!',
    'modal.over.subtitleBreach': 'Порушник переплив річку. Завдання провалено.',
    'modal.over.titleCrash': 'ТВОЮ ДІВІЗІЮ! ЧОВЕН СІВ НА МІЛЬ!',
    'modal.over.rankLabel': 'ДОСЯГНУТЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ',
    'modal.over.rankScore': 'Фінальний рахунок: {score} очок',
    'modal.over.statScore': 'Фінальний рахунок',
    'modal.over.statSmacked': 'Порушників знешкоджено',
    'modal.over.btn': 'ПЕРЕДИСЛОКУВАТИ ДРОН',

    // ── Military Ranks ──
    'rank.title.recruit': 'Рекрут',
    'rank.title.soldier': 'Солдат',
    'rank.title.seniorSoldier': 'Старший солдат',
    'rank.title.juniorSergeant': 'Молодший сержант',
    'rank.title.sergeant': 'Сержант',
    'rank.title.seniorSergeant': 'Старший сержант',
    'rank.title.chiefSergeant': 'Головний сержант',
    'rank.title.staffSergeant': 'Штаб-сержант',
    'rank.title.masterSergeant': 'Майстер-сержант',
    'rank.title.juniorLieutenant': 'Молодший лейтенант',
    'rank.title.lieutenant': 'Лейтенант',
    'rank.title.seniorLieutenant': 'Старший лейтенант',
    'rank.title.captain': 'Капітан',
    'rank.title.major': 'Майор',
    'rank.title.lieutenantColonel': 'Підполковник',
    'rank.title.colonel': 'Полковник',
    'rank.title.brigadierGeneral': 'Бригадний генерал',
    'rank.title.majorGeneral': 'Генерал-майор',
    'rank.title.general': 'Генерал',

    // ── Rank Up Banner ──
    'rank.promotion': 'ПІДВИЩЕННЯ У ЗВАННІ ДПСУ!',

    // ── Floating Score Popups ──
    'score.whack': 'БУМ! +100',
    'score.shred': 'РІЗНЯ! +500',
    'score.ram': 'ТАРАН! +50',
    'score.breach': 'ПРОРИВ КОРДОНУ! ⚠️',

    // ── Crash Reasons ──
    'crash.riverbank': 'ВРІЗАВСЯ В БЕРЕГ РІЧКИ!',
    'crash.north': 'СУКА, КУДА ТИ ХУЯРИШ, БЛЯТЬ!',
    'crash.south': 'ТРЯСЦЯ ТВОЇЙ МАТЕРІ, МИ НА ІНШОМУ БОЦІ!',
    'crash.west': 'ТВОЮ НАЛЄВО, КУДИ ТИ ЇДЕШ?',
    'crash.east': 'ХОЛЕРА, ДАВАЙ ВЗАД!',

    // ── WebGL Fallback ──
    'error.webgl.eyebrow': 'ТРАНСЛЯЦІЯ НЕДОСТУПНА',
    'error.webgl.title': 'WEBGL НЕДОСТУПНИЙ',
    'error.webgl.subtitle': 'Цей пристрій не зміг створити контекст WebGL, тому трансляція з дрона не може запуститися.',
    'error.webgl.howTo': 'Як виправити:',
    'error.webgl.hint': 'Увімкніть апаратне прискорення в налаштуваннях браузера, оновіть графічні драйвери або відкрийте гру в актуальній версії Chrome, Edge чи Firefox на пристрої з підтримкою GPU.',
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
    'controls.strike': 'STRIKE (OAR)',

    // ── Start Modal ──
    'modal.start.eyebrow': 'DRONE D-07 · UPLINK READY',
    'modal.start.title': 'VESLO',
    'modal.start.subtitle': 'Border River Patrol • Live Aerial Feed',
    'modal.start.missionTitle': '⚠️ <strong>COMBAT MISSION:</strong> Protect the border from intruders!',
    'modal.start.missionWarning': 'If even one reaches the beach or you <strong>crash into the shore</strong> — mission failed!',
    'modal.start.oarTitle': '🛶 Oar strike:',
    'modal.start.oarPoints': '+100 POINTS',
    'modal.start.oarDesc': 'Space to strike with the oar!',
    'modal.start.ramTitle': '💥 Boat ram:',
    'modal.start.ramPoints': '+50 POINTS',
    'modal.start.ramDesc': 'Ram intruders with the boat hull.',
    'modal.start.engineTitle': '🔥 Engine propeller:',
    'modal.start.enginePoints': '+500 POINTS',
    'modal.start.engineDesc': 'Reverse throttle!',
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

    // ── Military Ranks ──
    'rank.title.recruit': 'Recruit',
    'rank.title.soldier': 'Private',
    'rank.title.seniorSoldier': 'Senior Soldier',
    'rank.title.juniorSergeant': 'Junior Sergeant',
    'rank.title.sergeant': 'Sergeant',
    'rank.title.seniorSergeant': 'Senior Sergeant',
    'rank.title.chiefSergeant': 'Chief Sergeant',
    'rank.title.staffSergeant': 'Staff Sergeant',
    'rank.title.masterSergeant': 'Master Sergeant',
    'rank.title.juniorLieutenant': 'Junior Lieutenant',
    'rank.title.lieutenant': 'Lieutenant',
    'rank.title.seniorLieutenant': 'Senior Lieutenant',
    'rank.title.captain': 'Captain',
    'rank.title.major': 'Major',
    'rank.title.lieutenantColonel': 'Lieutenant Colonel',
    'rank.title.colonel': 'Colonel',
    'rank.title.brigadierGeneral': 'Brigadier General',
    'rank.title.majorGeneral': 'Major General',
    'rank.title.general': 'General',

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

    // ── WebGL Fallback ──
    'error.webgl.eyebrow': 'FEED UNAVAILABLE',
    'error.webgl.title': 'WEBGL OFFLINE',
    'error.webgl.subtitle': 'This device could not create a WebGL context, so the drone feed cannot start.',
    'error.webgl.howTo': 'How to fix:',
    'error.webgl.hint': 'Enable hardware acceleration in your browser settings, update your graphics drivers, or open the game in a recent Chrome, Edge or Firefox on a machine with GPU support.',
  }
};

// ── Registered locales (add new languages here) ──
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

/**
 * Translate all elements carrying data-i18n / data-i18n-html attributes.
 * Used for static markup; dynamic text is set via t() in JS.
 */
function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.title = t('page.title');
}

function getLocale() {
  return currentLocale;
}

function setLocale(code) {
  if (!translations[code] || code === currentLocale) return;
  currentLocale = code;
  localStorage.setItem('veslo_lang', code);
  document.documentElement.lang = code === 'ua' ? 'uk' : code;
  applyTranslations();
  listeners.forEach(fn => fn(code));
}

function onLocaleChange(fn) {
  listeners.push(fn);
}

/**
 * Return the locale-appropriate title for a rank object.
 * Ranks carry an i18n `key`; legacy `title`/`titleEn` fields still work.
 */
function getRankTitle(rank) {
  if (!rank) return '';
  if (rank.key) return t(rank.key);
  if (currentLocale === 'ua') return rank.title;
  return rank.titleEn || rank.title;
}

document.documentElement.lang = currentLocale === 'ua' ? 'uk' : currentLocale;
applyTranslations();

export { t, getRankTitle, getLocale, setLocale, onLocaleChange, applyTranslations, locales };
export const i18n = { t, getLocale, setLocale, onLocaleChange, locales, getRankTitle, applyTranslations };
