// ─── Veslo i18n System ───────────────────────────────────────────
// Lightweight, reactive, decoupled. To add a language:
//   1. Add a new locale object to `translations` below.
//   2. Add its entry to `locales`.
// All user-facing strings live in this file.

type LocaleCode = 'ua' | 'en';
type TranslationTable = Record<string, string>;
type LocaleChangeListener = (code: LocaleCode) => void;

interface Locale {
  code: LocaleCode;
  label: string;
}

interface RankLike {
  key?: string;
  title?: string;
  titleEn?: string;
}

const translations: Record<LocaleCode, TranslationTable> = {
  ua: {
    // ── Page ──
    'page.title': 'Річковий Прикордонний Патруль',
    'orientation.title': 'ПОТРІБЕН ЛАНДШАФТНИЙ РЕЖИМ',
    'orientation.subtitle': 'Поверніть пристрій горизонтально, щоб грати у Veslo.',
    'fullscreen.prompt.eyebrow': 'ПОРАДА ДЛЯ ПОВНОГО ЕКРАНА',
    'fullscreen.prompt.title': 'ДОДАЙТЕ НА ЕКРАН ДОМІВКИ',
    'fullscreen.prompt.body': 'Safari не приховує адресний рядок у звичайній вкладці. Натисніть <strong>Поділитися</strong> → <strong>На екран Домівка</strong>, а потім запустіть Veslo з екрана Домівки для повноекранного режиму.',
    'fullscreen.prompt.btn': 'ПРОДОВЖИТИ В БРАУЗЕРІ',

    // ── Drone OSD ──
    'osd.drone': 'DRONE D-07',
    'osd.borderPatrol': 'ДСПУ',
    'osd.uplink': 'UPLINK',
    'osd.stable': 'STABLE',
    'osd.rec': 'REC',
    'osd.resolution': '4K',
    'osd.alt': 'ALT',
    'osd.spd': 'SPD',
    'osd.hdg': 'HDG',
    'osd.fps': 'FPS',
    'osd.bat': 'BAT',
    'osd.gps': 'GPS',
    'osd.wind': 'WIND',
    'osd.sat': 'SAT',
    'osd.threats': 'ПОРУШНИКИ',

    // ── OSD Alerts ──
    'osd.alert.uplinkEstablished': 'ЗВ`ЯЗОК ВСТАНОВЛЕНО',
    'osd.alert.uplinkActive': 'ЗВ`ЯЗОК ВСТАНОВЛЕНО - ВИХОДИШ НА ПОЗИЦIЮ',
    'osd.alert.batteryCritical': 'НИЗЬКИЙ ЗАРЯД БАТАРЕЇ',
    'osd.alert.batteryLow': 'НИЗЬКИЙ ЗАРЯД',
    'osd.alert.batteryRecharged': 'БАТАРЕЮ ЗАРЯДЖЕНО',
    'osd.alert.signalLost': 'ЗВ`ЯЗОК ВТРАЧЕНО',
    'osd.alert.manOverboard': 'ЛЮДИНА ЗА БОРТОМ!',
    'osd.alert.manRecovered': 'ВЕСЛУНАРА ПІДІБРАНО',
    'osd.alert.targetLost': 'ЦІЛЬ ВТРАЧЕНО',

    // ── HUD ──
    'hud.scorePill': '{score} ОЧОК',
    'hud.nextRank': 'НАСТУПНЕ ЗВАННЯ: {title} ({score})',
    'hud.maxRank': 'МАКСИМАЛЬНЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ!',
    'hud.best': 'НАЙКРАЩИЙ РЕЗУЛЬТАТ',

    // ── Controls Footer ──
    'controls.throttle': 'Газ / Реверс',
    'controls.steering': 'Кермо',
    'controls.strike': 'УДАР (ВЕСЛО)',
    'controls.hitShort': 'УДАР',
    'controls.oar': 'ВЕСЛО',

    // ── Start Modal ──
    'modal.start.title': 'Вітаємо на службі, новобранцю!',
    'modal.start.missionTitle': '<strong>БОЙОВЕ ЗАВДАННЯ:</strong> Захистити кордон від порушників!',
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
    'modal.start.btn': 'ВИКОНУВАТИ!',

    // ── Pause Modal ──
    'modal.pause.eyebrow': 'ПАТРУЛЬ НА ПАУЗІ',
    'modal.pause.title': 'ПАУЗА',
    'modal.pause.subtitle': 'Натисни Esc, щоб продовжити патрулювання.',
    'modal.pause.btn': 'ПРОДОВЖИТИ',

    // ── Game Over Modal ──
    'modal.over.eyebrow': 'ЗАВДАННЯ ПРОВАЛЕНО',
    'modal.over.titleBreach': 'КОРДОН ПРОРВАНО!',
    'modal.over.subtitleBreach': 'Порушник переплив річку. Завдання провалено.',
    'modal.over.titleCrash': 'ТВОЮ ДІВІЗІЮ! ЧОВЕН СІВ НА МІЛЬ!',
    'modal.over.rankLabel': 'ДОСЯГНУТЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ',
    'modal.over.rankScore': 'Фінальний рахунок: {score} очок',
    'modal.over.statScore': 'Фінальний рахунок',
    'modal.over.statSmacked': 'Порушників знешкоджено',
    'modal.over.statFrogs': 'Вбито жаб',
    'modal.over.statSnakes': 'Вбито гадюк',
    'modal.over.btn': 'ПЕРЕДИСЛОКУВАТИ ДРОН',
    'gameover.lock': 'ЗАХОПЛЕННЯ ЦІЛІ',
    'gameover.linkLost': 'ЗВ`ЯЗОК ВТРАЧЕНО',
    'gameover.report': 'ЗВІТ ПІСЛЯ МІСІЇ',
    'gameover.score': 'РАХУНОК',
    'gameover.statSmacked': 'ЗНЕШКОДЖЕНО',
    'gameover.statFrogs': 'ЖАБИ',
    'gameover.statSnakes': 'ГАДЮКИ',
    'gameover.statStreak': 'МАКС. СЕРІЯ',
    'gameover.rank': 'ЗВАННЯ',

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
    'score.shred': 'РІЗНЯ! +500',
    'score.ram': 'ТАРАН! +50',
    'score.breach': 'ПРОРИВ КОРДОНУ! ⚠️',

    // ── Oar Kill Streak ──
    'streak.x1': 'БУМ',
    'streak.x2': 'ЛЯП',
    'streak.x3': 'ГЕП',

    // ── Crash Reasons ──
    'crash.riverbank': 'ВРІЗАВСЯ В БЕРЕГ РІЧКИ!',
    'crash.north': 'СУКА, КУДА ТИ ХУЯРИШ, БЛЯТЬ!',
    'crash.south': 'ТРЯСЦЯ ТВОЇЙ МАТЕРІ, МИ НА ІНШОМУ БОЦІ!',
    'crash.west': 'ТВОЮ НАЛЄВО, КУДИ ТИ ЇДЕШ?',
    'crash.east': 'ХОЛЕРА, ДАВАЙ ВЗАД!',
    'crash.stuckNorth': 'СУКА КАМИШІ НАМОТАЛО',
    'crash.stuckSouth': 'МОТОРУ ПИЗДА, ПОГНУЛИ ЛОПАСТІ',
    'crash.bankRam': 'ПРИПЛИЛІ',
    'crash.engineRock1': 'ПИЗДА ДВІЖКУ!',
    'crash.engineRock2': 'БЛЯДЬ, БОЧОК ПОТІК!',

    // ── Partner Rock-Bump Swears ──
    'partner.swear.1': "Ярік, блядь!",
    'partner.swear.2': 'Обережно, сука!',
    'partner.swear.3': 'Шамаіч, не души!',
    'partner.swear.4': 'Єбать його в рот!',
    'partner.swear.5': 'Сука!',
    'partner.swear.6': 'Пізда!',
    'partner.swear.7': 'Піздец нахуй!',
    'partner.swear.8': "В'їбалися нахуй!",
    'partner.swear.9': '3 наряда вне очереді!',
    'partner.swear.10': 'Їбать його в рот!',
    'partner.swear.11': 'Ти шо довбойоб?',
    'partner.swear.12': 'Блядь куда ти їдеш?',
    'partner.swear.13': 'Сука придурошне!',
    'partner.swear.14': 'Да... єбать-єбать...',
    'partner.swear.15': 'Ти сказал, шо ти шарішь в етой тємє!',
    'partner.swear.16': 'Прітормозі!',
    'partner.swear.17': 'Прівикні к аппарату!',
    'partner.swear.18': 'Остановітє я сойду!',
    'partner.manOverboard': 'Ярік за бортом, сука! Тримайся!',
    'partner.manRecovered': 'Ось ти, бідолага. Весло в руки!',

    // ── WebGL Fallback ──
    'error.webgl.eyebrow': 'ТРАНСЛЯЦІЯ НЕДОСТУПНА',
    'error.webgl.title': 'WEBGL НЕДОСТУПНИЙ',
    'error.webgl.subtitle': 'Цей пристрій не зміг створити контекст WebGL, тому трансляція з дрона не може запуститися.',
    'error.webgl.howTo': 'Як виправити:',
    'error.webgl.hint': 'Увімкніть апаратне прискорення в налаштуваннях браузера, оновіть графічні драйвери або відкрийте гру в актуальній версії Chrome, Edge чи Firefox на пристрої з підтримкою GPU.',

    // ── Resolution Fallback ──
    'error.resolution.eyebrow': 'ПОТОЧНИЙ РЕЖИМ НЕ ПІДТРИМУЄТЬСЯ',
    'error.resolution.title': 'РОЗДІЛЬНІСТЬ НЕ ПІДТРИМУЄТЬСЯ',
    'error.resolution.subtitle': 'Для гри Veslo потрібен екран із співвідношенням сторін 16:9 або ширшим.',
    'error.resolution.hint': 'Розгорніть вікно або перемкніть дисплей на 1920×1080 (Full HD) чи ширший режим і перезавантажте сторінку.',
  },

  en: {
    // ── Page ──
    'page.title': 'VESLO — Border River Patrol',
    'orientation.title': 'LANDSCAPE MODE REQUIRED',
    'orientation.subtitle': 'Rotate your device horizontally to play Veslo.',
    'fullscreen.prompt.eyebrow': 'FULLSCREEN TIP',
    'fullscreen.prompt.title': 'ADD TO HOME SCREEN',
    'fullscreen.prompt.body': 'Safari keeps its address bar in normal tabs. Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then launch Veslo from your Home Screen for true fullscreen.',
    'fullscreen.prompt.btn': 'CONTINUE IN BROWSER',

    // ── Drone OSD ──
    'osd.drone': 'DRONE D-07',
    'osd.borderPatrol': 'BORDER PATROL',
    'osd.uplink': 'UPLINK',
    'osd.stable': 'STABLE',
    'osd.rec': 'REC',
    'osd.resolution': '4K',
    'osd.alt': 'ALT',
    'osd.spd': 'SPD',
    'osd.hdg': 'HDG',
    'osd.fps': 'FPS',
    'osd.bat': 'BAT',
    'osd.gps': 'GPS',
    'osd.wind': 'WIND',
    'osd.sat': 'SAT',
    'osd.threats': 'THREATS',

    // ── OSD Alerts ──
    'osd.alert.uplinkEstablished': 'UPLINK ESTABLISHED',
    'osd.alert.uplinkActive': 'UPLINK ESTABLISHED · PATROL ACTIVE',
    'osd.alert.batteryCritical': 'BATTERY CRITICAL',
    'osd.alert.batteryLow': 'LOW BATTERY',
    'osd.alert.batteryRecharged': 'BATTERY RECHARGED',
    'osd.alert.signalLost': 'SIGNAL LOST',
    'osd.alert.manOverboard': 'MAN OVERBOARD!',
    'osd.alert.manRecovered': 'OARSMAN RECOVERED',
    'osd.alert.targetLost': 'TARGET LOST',

    // ── HUD ──
    'hud.scorePill': '{score} POINTS',
    'hud.nextRank': 'NEXT RANK: {title} ({score})',
    'hud.maxRank': 'MAXIMUM SBGS MILITARY RANK!',
    'hud.best': 'BEST',

    // ── Controls Footer ──
    'controls.throttle': 'Throttle / Reverse',
    'controls.steering': 'Steering',
    'controls.strike': 'STRIKE (OAR)',
    'controls.hitShort': 'HIT',
    'controls.oar': 'OAR',

    // ── Start Modal ──
    'modal.start.title': 'Welcome to the service, recruit!',
    'modal.start.missionTitle': '<strong>COMBAT MISSION:</strong> Protect the border from intruders!',
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
    'modal.start.btn': 'EXECUTE!',

    // ── Pause Modal ──
    'modal.pause.eyebrow': 'PATROL PAUSED',
    'modal.pause.title': 'PAUSED',
    'modal.pause.subtitle': 'Press Esc to resume the patrol.',
    'modal.pause.btn': 'RESUME',

    // ── Game Over Modal ──
    'modal.over.eyebrow': 'MISSION FAILED',
    'modal.over.titleBreach': 'BORDER BREACHED!',
    'modal.over.subtitleBreach': 'A smuggler reached the southern shore. Mission failed.',
    'modal.over.titleCrash': 'BOAT CRASHED INTO SHORE!',
    'modal.over.rankLabel': 'ACHIEVED SBGS MILITARY RANK',
    'modal.over.rankScore': 'Final score: {score} points',
    'modal.over.statScore': 'Final Score',
    'modal.over.statSmacked': 'Smugglers Smacked',
    'modal.over.statFrogs': 'Frogs Killed',
    'modal.over.statSnakes': 'Vipers Killed',
    'modal.over.btn': 'REDEPLOY DRONE',
    'gameover.lock': 'TARGET LOCK',
    'gameover.linkLost': 'LINK LOST',
    'gameover.report': 'AFTER ACTION REPORT',
    'gameover.score': 'SCORE',
    'gameover.statSmacked': 'NEUTRALIZED',
    'gameover.statFrogs': 'FROGS',
    'gameover.statSnakes': 'VIPERS',
    'gameover.statStreak': 'BEST STREAK',
    'gameover.rank': 'RANK',

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
    'score.shred': 'PROPELLER! +500',
    'score.ram': 'RAM! +50',
    'score.breach': 'BORDER BREACH! ⚠️',

    // ── Oar Kill Streak ──
    'streak.x1': 'BONK',
    'streak.x2': 'WHACK',
    'streak.x3': 'THWACK',

    // ── Crash Reasons ──
    'crash.riverbank': 'CRASHED INTO RIVERBANK!',
    'crash.north': 'CRASHED INTO NORTH BORDER POST!',
    'crash.south': 'CRASHED ONTO SOUTH BEACH!',
    'crash.west': 'CRASHED INTO WEST REEF BARRIER!',
    'crash.east': 'CRASHED INTO EAST REEF BARRIER!',
    'crash.stuckNorth': 'STUCK IN THE REEDS!',
    'crash.stuckSouth': 'STUCK IN THE SAND!',
    'crash.bankRam': 'WE MADE IT ASHORE!',
    'crash.engineRock1': "ENGINE'S FUCKED!",
    'crash.engineRock2': 'FUCK, THE HULL IS LEAKING!',

    // ── Partner Rock-Bump Swears ──
    'partner.swear.1': 'Yarik, for fuck sake!',
    'partner.swear.2': 'Careful, you bitch!',
    'partner.swear.3': "Shamaich, don't crowd me!",
    'partner.swear.4': 'Fuck him in the mouth!',
    'partner.swear.5': 'Bitch!',
    'partner.swear.6': 'Cunt!',
    'partner.swear.7': 'Fucked to hell!',
    'partner.swear.8': 'We smashed right into it!',
    'partner.swear.9': 'Three extra duties out of turn!',
    'partner.swear.10': 'Fuck him in the mouth!',
    'partner.swear.11': 'Are you a fucking idiot?',
    'partner.swear.12': 'Where the fuck are you going?',
    'partner.swear.13': 'You fucking moron!',
    'partner.swear.14': 'Yeah... fuck-fuck...',
    'partner.swear.15': 'You said you knew this topic!',
    'partner.swear.16': 'Slow the fuck down!',
    'partner.swear.17': 'Get used to the machine!',
    'partner.swear.18': "Stop, I'm getting out!",
    'partner.manOverboard': "Yarik's overboard, fuck! Hold on!",
    'partner.manRecovered': 'There you are, you poor bastard. Take the oar!',

    // ── WebGL Fallback ──
    'error.webgl.eyebrow': 'FEED UNAVAILABLE',
    'error.webgl.title': 'WEBGL OFFLINE',
    'error.webgl.subtitle': 'This device could not create a WebGL context, so the drone feed cannot start.',
    'error.webgl.howTo': 'How to fix:',
    'error.webgl.hint': 'Enable hardware acceleration in your browser settings, update your graphics drivers, or open the game in a recent Chrome, Edge or Firefox on a machine with GPU support.',

    // ── Resolution Fallback ──
    'error.resolution.eyebrow': 'CURRENT MODE UNSUPPORTED',
    'error.resolution.title': 'RESOLUTION NOT SUPPORTED',
    'error.resolution.subtitle': 'Veslo requires a 16:9 or wider display.',
    'error.resolution.hint': 'Maximize the window or switch your display to 1920×1080 (Full HD) or a wider mode, then reload the page.',
  }
};

// ── Registered locales (add new languages here) ──
const locales: Locale[] = [
  { code: 'ua', label: 'UA' },
  { code: 'en', label: 'EN' }
];

// ── Singleton state ──
let currentLocale = (localStorage.getItem('veslo_lang') as LocaleCode | null) || 'ua';
if (!translations[currentLocale]) currentLocale = 'ua';

const listeners: LocaleChangeListener[] = [];

/**
 * Translate a key, with optional {token} interpolation.
 * @param {string} key   Dot-delimited translation key
 * @param {Object} [params]  e.g. { score: 100 }
 * @returns {string}
 */
function t(key: string, params?: Record<string, string | number>): string {
  let str = (translations[currentLocale] && translations[currentLocale][key])
         || (translations.ua[key])
         || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

/**
 * Translate all elements carrying data-i18n / data-i18n-html attributes.
 * Used for static markup; dynamic text is set via t() in JS.
 */
function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n ?? '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml ?? '');
  });
  document.title = t('page.title');
}

function getLocale(): LocaleCode {
  return currentLocale;
}

function setLocale(code: string): void {
  if (!translations[code as LocaleCode] || code === currentLocale) return;
  currentLocale = code as LocaleCode;
  localStorage.setItem('veslo_lang', code);
  document.documentElement.lang = code === 'ua' ? 'uk' : code;
  applyTranslations();
  listeners.forEach(fn => fn(currentLocale));
}

function onLocaleChange(fn: LocaleChangeListener): void {
  listeners.push(fn);
}

/**
 * Return the locale-appropriate title for a rank object.
 * Ranks carry an i18n `key`; legacy `title`/`titleEn` fields still work.
 */
function getRankTitle(rank: RankLike | null | undefined): string {
  if (!rank) return '';
  if (rank.key) return t(rank.key);
  if (currentLocale === 'ua') return rank.title ?? '';
  return rank.titleEn || rank.title || '';
}

document.documentElement.lang = currentLocale === 'ua' ? 'uk' : currentLocale;
applyTranslations();

export { t, getRankTitle, getLocale, setLocale, onLocaleChange, applyTranslations, locales };
export const i18n = { t, getLocale, setLocale, onLocaleChange, locales, getRankTitle, applyTranslations };
