import * as THREE from 'three';
import { GameRenderer } from './core/Renderer.js';
import { RiverWorld } from './world/River.js';
import { Boat } from './entities/Boat.js';
import { BoatCrew } from './entities/BoatCrew.js';
import { SmugglerManager } from './entities/SmugglerManager.js';
import { WildlifeManager } from './entities/WildlifeManager.js';
import { BirdManager } from './entities/Birds.js';
import { Minivan } from './entities/Minivan.js';
import { WatchtowerSoldier } from './entities/WatchtowerSoldier.js';
import { Drone } from './entities/Drone.js';
import { ConnectScreen } from './systems/ConnectScreen.js';
import { sound } from './systems/Audio.js';
import { acquireWakeLock, releaseWakeLock } from './systems/WakeLock.js';
import { registerOfflineServiceWorker } from './systems/ServiceWorker.js';
import { rankSystem } from './systems/RankSystem.js';
import { mountRankSprites, rankIconMarkup } from './systems/RankSprites.js';
import { logger } from './systems/Logger.js';
import { t, getRankTitle, onLocaleChange } from './systems/I18n.js';
import { PROMOTION_TUNING } from './config/ranking.js';
import { TUNING } from './config/tuning.js';
import { ChaseCamera } from './core/ChaseCamera.js';
import { ProximityMarkers } from './systems/ProximityMarkers.js';
import { MountCamera } from './core/MountCamera.js';

function isTouchDevice() {
  return (
    window.matchMedia('(any-pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

function lockLandscape() {
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.lock !== 'function') return;
  try {
    // Portrait play is supported: only pin the orientation when it is disabled.
    if (!LOCK_ORIENTATION) return;
    const result = orientation.lock(LOCK_ORIENTATION);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {}
}

function isStandaloneMode() {
  if (window.navigator.standalone === true) return true;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches;
}

function isIOSDevice() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const INSTALL_PROMPT_KEY = 'veslo_install_prompt_dismissed';
const GAME_OVER_RESTART_DELAY = 5000;

const PARTNER_SWEAR_KEYS = Array.from(
  { length: 18 },
  (_, index) => `partner.swear.${index + 1}`
);

function readBatteryPercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, parsed));
}

function readSpawnCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function readSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(120, Math.max(0.1, parsed));
}

function readFlag(value) {
  if (value === null || value === undefined || value === '') return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isSpriteViewerEnabled() {
  const params = new URLSearchParams(window.location.search);
  const queryEnabled =
    readFlag(params.get('sprites')) ||
    params.get('dev') === 'sprites' ||
    params.get('view') === 'sprites' ||
    params.has('sprite');

  // The query flag is a dev-only convenience; a production build must opt in
  // with VITE_SPRITE_VIEWER=1 (or TUNING.dev.spriteViewer) so the viewer is
  // never exposed to players by accident.
  return (
    readFlag(import.meta.env.VITE_SPRITE_VIEWER) ||
    TUNING.dev.spriteViewer ||
    (import.meta.env.DEV && queryEnabled)
  );
}

// Seconds the game-over camera chases the escaping smuggler before it stops.
const GAME_OVER_FOLLOW_SECONDS = 4;

const INITIAL_BATTERY =
  readBatteryPercent(new URLSearchParams(window.location.search).get('battery'))
  ?? readBatteryPercent(import.meta.env.VITE_START_BATTERY)
  ?? TUNING.initialBattery;

function readPositive(value, max = 600) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(max, parsed);
}

const BATTERY_DRAIN_PER_MINUTE =
  readPositive(new URLSearchParams(window.location.search).get('drain'), 10000)
  ?? readPositive(import.meta.env.VITE_BATTERY_DRAIN_PER_MINUTE, 10000)
  ?? TUNING.batteryDrainPerMinute;

const BATTERY_EVENTS = (() => {
  const raw = new URLSearchParams(window.location.search).get('batteryEvents')
    ?? import.meta.env.VITE_BATTERY_EVENTS;
  if (raw === undefined || raw === null || raw === '') return TUNING.batteryEvents;
  return raw === '1' || raw === 'true';
})();

const BATTERY_RECHARGE_SECONDS =
  readPositive(new URLSearchParams(window.location.search).get('recharge'))
  ?? readPositive(import.meta.env.VITE_BATTERY_RECHARGE_SECONDS)
  ?? TUNING.batteryRechargeSeconds;

const DRONE_READY_COUNTDOWN_SECONDS =
  readPositive(import.meta.env.VITE_DRONE_READY_COUNTDOWN_SECONDS, 60) ?? TUNING.droneReadyCountdownSeconds;
const DRONE_SWITCH_STATIC_SECONDS =
  readPositive(import.meta.env.VITE_DRONE_SWITCH_STATIC_SECONDS, 5) ?? TUNING.droneSwitchStaticSeconds;

const CHASE_CAMERA_OPTIONS = {
  distance: readPositive(import.meta.env.VITE_CHASE_CAMERA_DISTANCE, 100) ?? TUNING.chaseCamera.distance,
  height: readPositive(import.meta.env.VITE_CHASE_CAMERA_HEIGHT, 100) ?? TUNING.chaseCamera.height,
  blendSeconds: readPositive(import.meta.env.VITE_CHASE_CAMERA_BLEND_SECONDS, 10) ?? TUNING.chaseCamera.blendSeconds,
  fov: readPositive(import.meta.env.VITE_CHASE_CAMERA_FOV, 120) ?? TUNING.chaseCamera.fov
};

const AK_ENABLED = (() => {
  const raw =
    new URLSearchParams(window.location.search).get('ak')
    ?? import.meta.env.VITE_AK_ENABLED;
  if (raw === null || raw === undefined || raw === '') return TUNING.akEnabled;
  return readFlag(raw);
})();

const BATTERY_CAMERA = (() => {
  const raw = (
    new URLSearchParams(window.location.search).get('batteryCam')
    ?? import.meta.env.VITE_BATTERY_CAMERA
    ?? ''
  ).toString().trim().toLowerCase();
  return raw === 'pov' || raw === 'chase' ? raw : TUNING.batteryCamera;
})();

const POV_CAMERA_OPTIONS = {
  fov: readPositive(import.meta.env.VITE_POV_CAMERA_FOV, 120) ?? TUNING.povCamera.fov,
  blendSeconds: readPositive(import.meta.env.VITE_POV_CAMERA_BLEND_SECONDS, 10) ?? TUNING.povCamera.blendSeconds,
  yawSmoothing: readPositive(import.meta.env.VITE_POV_YAW_SMOOTHING, 60) ?? TUNING.povCamera.yawSmoothing
};
const POV_MAX_TURN_YAW =
  THREE.MathUtils.degToRad(readPositive(import.meta.env.VITE_POV_MAX_TURN_YAW_DEGREES, 180) ?? TUNING.povCamera.maxTurnYawDegrees);
const POV_TURN_RATE_FRACTION =
  readPositive(import.meta.env.VITE_POV_TURN_RATE_FRACTION, 1) ?? TUNING.povCamera.turnRateFraction;
const POV_ENEMY_BIAS =
  THREE.MathUtils.degToRad(readPositive(import.meta.env.VITE_POV_ENEMY_BIAS_DEGREES, 90) ?? TUNING.povCamera.enemyBiasDegrees);
const rl = TUNING.reverseLook;
const REVERSE_LOOK = {
  fullSpeed: readPositive(import.meta.env.VITE_REVERSE_LOOK_FULL_SPEED, 50) ?? rl.fullSpeed,
  torsoYaw: -THREE.MathUtils.degToRad(readPositive(import.meta.env.VITE_REVERSE_LOOK_TORSO_DEGREES, 90) ?? rl.torsoDegrees),
  headYaw: -THREE.MathUtils.degToRad(readPositive(import.meta.env.VITE_REVERSE_LOOK_HEAD_DEGREES, 90) ?? rl.headDegrees),
  cameraYaw: -THREE.MathUtils.degToRad(readPositive(import.meta.env.VITE_REVERSE_LOOK_CAMERA_DEGREES, 180) ?? rl.cameraDegrees),
  smoothing: readPositive(import.meta.env.VITE_REVERSE_LOOK_SMOOTHING, 20) ?? rl.smoothing
};
const CREW_GAZE = {
  range: readPositive(import.meta.env.VITE_CREW_GAZE_RANGE, 500) ?? TUNING.crewGaze.range,
  maxYaw: THREE.MathUtils.degToRad(
    readPositive(import.meta.env.VITE_CREW_GAZE_MAX_YAW_DEGREES, 120) ?? TUNING.crewGaze.maxHeadYawDegrees
  ),
  smoothing: readPositive(import.meta.env.VITE_CREW_GAZE_SMOOTHING, 60) ?? TUNING.crewGaze.smoothing
};

const PORTRAIT_FLOW = String(
  new URLSearchParams(window.location.search).get('flow')
  ?? import.meta.env.VITE_PORTRAIT_FLOW
  ?? TUNING.portrait.flow
).toLowerCase() === 'up' ? 'up' : 'down';

function readNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

const PORTRAIT_FPV = {
  enabled: new URLSearchParams(window.location.search).get('fpv') === '0'
    ? false
    : (import.meta.env.VITE_PORTRAIT_FPV === undefined || import.meta.env.VITE_PORTRAIT_FPV === ''
      ? TUNING.portrait.fpv.enabled
      : readFlag(import.meta.env.VITE_PORTRAIT_FPV)),
  distance: readPositive(import.meta.env.VITE_PORTRAIT_FPV_DISTANCE, 60) ?? TUNING.portrait.fpv.distance,
  height: readPositive(import.meta.env.VITE_PORTRAIT_FPV_HEIGHT, 40) ?? TUNING.portrait.fpv.height,
  lookAhead: readNumber(import.meta.env.VITE_PORTRAIT_FPV_LOOK_AHEAD, 0, 80) ?? TUNING.portrait.fpv.lookAhead,
  fov: readPositive(import.meta.env.VITE_PORTRAIT_FPV_FOV, 120) ?? TUNING.portrait.fpv.fov,
  desktop: new URLSearchParams(window.location.search).get('fpvDesktop') === '0'
    ? false
    : (import.meta.env.VITE_FPV_DESKTOP === undefined || import.meta.env.VITE_FPV_DESKTOP === ''
      ? TUNING.portrait.fpv.desktop
      : readFlag(import.meta.env.VITE_FPV_DESKTOP)),
  desktopFov: readPositive(import.meta.env.VITE_FPV_DESKTOP_FOV, 140) ?? TUNING.portrait.fpv.desktopFov,
  headingStiffness: readPositive(import.meta.env.VITE_PORTRAIT_FPV_HEADING_STIFFNESS, 20) ?? TUNING.portrait.fpv.headingStiffness,
  bank: readNumber(import.meta.env.VITE_PORTRAIT_FPV_BANK, 0, 3) ?? TUNING.portrait.fpv.bank
};

const PORTRAIT_OPTIONS = {
  fpv: PORTRAIT_FPV,
  enabled: new URLSearchParams(window.location.search).get('portrait') === '0'
    ? false
    : (import.meta.env.VITE_PORTRAIT_ENABLED === undefined || import.meta.env.VITE_PORTRAIT_ENABLED === ''
      ? TUNING.portrait.enabled
      : readFlag(import.meta.env.VITE_PORTRAIT_ENABLED)),
  flow: PORTRAIT_FLOW,
  fov: readPositive(import.meta.env.VITE_PORTRAIT_FOV, 120) ?? TUNING.portrait.fov,
  rigHeight: readPositive(import.meta.env.VITE_PORTRAIT_RIG_HEIGHT, 80) ?? TUNING.portrait.rigHeight,
  rigDistance: readPositive(import.meta.env.VITE_PORTRAIT_RIG_DISTANCE, 100) ?? TUNING.portrait.rigDistance,
  tilt: Number.isFinite(Number(import.meta.env.VITE_PORTRAIT_TILT)) && import.meta.env.VITE_PORTRAIT_TILT !== undefined && import.meta.env.VITE_PORTRAIT_TILT !== ''
    ? Math.min(60, Math.max(-30, Number(import.meta.env.VITE_PORTRAIT_TILT)))
    : TUNING.portrait.tilt,
  lead: Number.isFinite(Number(import.meta.env.VITE_PORTRAIT_LEAD)) && import.meta.env.VITE_PORTRAIT_LEAD !== undefined && import.meta.env.VITE_PORTRAIT_LEAD !== ''
    ? Number(import.meta.env.VITE_PORTRAIT_LEAD)
    : TUNING.portrait.lead
};
// Phones that cannot rotate vertically stay locked to landscape.
const LOCK_ORIENTATION = PORTRAIT_OPTIONS.enabled ? null : 'landscape';

const INITIAL_SPAWN_COUNT =
  readSpawnCount(new URLSearchParams(window.location.search).get('spawn'))
  ?? readSpawnCount(import.meta.env.VITE_INITIAL_SPAWN)
  ?? TUNING.initialSpawnCount;

const KILL_STREAK_WINDOW =
  readSeconds(new URLSearchParams(window.location.search).get('streak'))
  ?? readSeconds(import.meta.env.VITE_KILL_STREAK_SECONDS)
  ?? TUNING.killStreakSeconds;

function installPromptDismissed() {
  try {
    return localStorage.getItem(INSTALL_PROMPT_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function showIOSInstallPrompt() {
  if (isStandaloneMode() || !isIOSDevice() || installPromptDismissed()) return;
  document.getElementById('install-modal')?.classList.remove('hidden');
}

function requestGameFullscreen() {
  if (!isTouchDevice()) return;

  const activeFullscreen =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;

  if (activeFullscreen) {
    lockLandscape();
    return;
  }

  const root = document.documentElement;
  const request =
    root.requestFullscreen ||
    root.webkitRequestFullscreen ||
    root.mozRequestFullScreen ||
    root.msRequestFullscreen;

  if (!request) {
    showIOSInstallPrompt();
    return;
  }

  try {
    const result = request.call(root, { navigationUI: 'hide' });
    if (result && typeof result.then === 'function') {
      result.then(lockLandscape).catch(() => showIOSInstallPrompt());
    } else {
      lockLandscape();
      setTimeout(() => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          showIOSInstallPrompt();
        }
      }, 500);
    }
  } catch (e) {
    showIOSInstallPrompt();
  }
}

const SUPPORTED_ASPECT = 16 / 9;

function getViewportAspect() {
  return window.innerWidth / window.innerHeight;
}

function isSupportedDesktopResolution() {
  if (isTouchDevice()) return true;
  // Ultrawide displays are fine: the camera widens the horizontal view
  // instead of cropping. Only block windows narrower than 16:9.
  return getViewportAspect() >= SUPPORTED_ASPECT - 0.06;
}

function showUnsupportedResolution() {
  if (document.getElementById('resolution-modal')) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = (width / height).toFixed(2);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'resolution-modal';
  overlay.innerHTML = `
    <div class="modal-card resolution-card">
      <div class="modal-eyebrow danger">${t('error.resolution.eyebrow')}</div>
      <h1 class="modal-title danger">${t('error.resolution.title')}</h1>
      <div class="modal-subtitle">${t('error.resolution.subtitle')}</div>
      <div class="resolution-value">${width} × ${height} · ${ratio}:1</div>
      <div class="rule-highlight" style="margin-top:18px;margin-bottom:0;">${t('error.resolution.hint')}</div>
    </div>`;
  document.body.appendChild(overlay);
}

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'GAMEOVER'

    // Minimalist Rank HUD elements
    this.hudRankBadge = document.getElementById('hud-rank-badge');
    this.hudRankTitle = document.getElementById('hud-rank-title');
    this.hudScorePill = document.getElementById('hud-score-pill');
    this.hudRankBar = document.getElementById('hud-rank-bar');
    this.hudRankNext = document.getElementById('hud-rank-next');
    this.hudHighScore = document.getElementById('hud-high-score');

    // Oar kill-streak feedback
    this.killStreakBanner = document.getElementById('kill-streak');
    this.killStreakCount = document.getElementById('kill-streak-count');
    this.killStreak = 0;
    this.killStreakTimer = 0;
    this.killStreakWindow = KILL_STREAK_WINDOW;
    this.killStreakAnchor = new THREE.Vector3();
    this.enemyKillCount = 0;
    this.bestKillStreak = 0;

    // Modals
    this.startModal = document.getElementById('start-modal');
    this.startBtn = document.getElementById('start-btn');
    this.pauseModal = document.getElementById('pause-modal');
    this.resumeBtn = document.getElementById('resume-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.gameOverScreen = document.getElementById('gameover-screen');
    this.gameOverAt = 0;
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverSubtitle = document.getElementById('game-over-subtitle');
    this.gameOverFocus = null;
    this.finalRankBadge = document.getElementById('final-rank-badge');
    this.finalRankTitle = document.getElementById('final-rank-title');
    this.finalRankScore = document.getElementById('final-rank-score');
    this.finalScore = document.getElementById('final-score');
    this.finalSmacked = document.getElementById('final-smacked');
    this.finalFrogs = document.getElementById('final-frogs');
    this.finalSnakes = document.getElementById('final-snakes');
    this.finalStreak = document.getElementById('final-streak');
    this.restartBtn = document.getElementById('restart-btn');

    // Drone viewfinder elements
    this.osd = {
      root: document.getElementById('drone-osd'),
      timecode: document.getElementById('osd-timecode'),
      headingTape: document.getElementById('osd-heading-tape'),
      headingVal: document.getElementById('osd-heading-val'),
      alt: document.getElementById('osd-alt'),
      spd: document.getElementById('osd-spd'),
      hdg: document.getElementById('osd-hdg'),
      fps: document.getElementById('osd-fps'),
      batteryFill: document.getElementById('osd-battery-fill'),
      batteryVal: document.getElementById('osd-battery-val'),
      batteryWarningVal: document.getElementById('osd-battery-warning-val'),
      droneReadyVal: document.getElementById('osd-drone-ready-val'),
      degrade: document.getElementById('osd-degrade'),
      gps: document.getElementById('osd-gps'),
      threatCount: document.getElementById('osd-threat-count'),
      alert: document.getElementById('osd-alert')
    };

    this.missionTime = 0;
    this.battery = INITIAL_BATTERY;
    this.batteryDead = false;
    this.batteryDeadTimer = 0;
    this.chaseCamera = new ChaseCamera(CHASE_CAMERA_OPTIONS);
    this.povCamera = new MountCamera(POV_CAMERA_OPTIONS);
    this.floatLocal = new THREE.Vector3();
    this.floatRight = new THREE.Vector3();
    this.floatSide = new THREE.Vector3();
    this.batteryCam = null; // whichever camera currently replaces the drone feed
    this.rechargedTimer = 0;
    this.switchStaticTimer = 0;
    this.droneReadySeconds = 0;
    this.akReloadPending = false;
    this.akShotCooldownUntil = 0;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    this.osdTimer = 0;
    this.osdInterval = 0.1;
    this.cameraDir = new THREE.Vector3();
    this.vanScreenPos = new THREE.Vector3();
    this.prevThreatCount = 0;
    this.alertTimeout = null;
    this.glitchTimeout = null;
    this.rankUpQueue = [];
    this.rankUpActive = false;
    this.buildHeadingTape();

    // Storage
    this.highScore = parseInt(localStorage.getItem('veslo_high_score') || '0', 10);
    this.lastGameOver = null;

    this.partnerBubble = document.createElement('div');
    this.partnerBubble.className = 'partner-bubble';
    this.partnerBubble.setAttribute('aria-live', 'polite');
    document.getElementById('ui-layer')?.appendChild(this.partnerBubble);
    this.partnerBubbleAnchor = new THREE.Vector3();
    this.partnerSwearTimer = 0;
    this.partnerSwearCooldown = 0;
    this.partnerSwearIndex = -1;

    // Core 3D engine
    this.renderer = new GameRenderer(this.container);
    this.renderer.setPortraitOptions(PORTRAIT_OPTIONS);
    this.world = new RiverWorld(this.renderer.scene);
    this.boat = new Boat(
      this.renderer.scene,
      this.world,
      (reason) => this.onBoatCrash(reason),
      () => this.onRockBump(),
      (worldPos) => this.onManOverboard(worldPos),
      () => this.onManRecovered()
    );
    this.boatCrew = new BoatCrew(this.boat);

    // Smuggler Manager
    this.smugglerManager = new SmugglerManager(
      this.renderer.scene,
      this.world,
      (points, pos, text, type, count) => this.onSmugglerSmacked(points, pos, text, type, count),
      (smuggler, result) => this.onBreach(smuggler, result)
    );

    this.wildlifeManager = new WildlifeManager(
      this.renderer.scene,
      this.world,
      (type, kills) => this.onWildlifeKilled(type, kills)
    );

    this.birdManager = new BirdManager(this.renderer.scene, this.world, this.wildlifeManager);
    this.proximityMarkers = new ProximityMarkers(this.renderer.scene);

    this.minivan = new Minivan(this.renderer.scene);
    this.soldier = new WatchtowerSoldier(this.renderer.scene);
    this.drone = new Drone(this.renderer.scene);
    this.soldier.group.scale.setScalar(0.78);
    this.binocularOverlay = document.getElementById('binocular-overlay');
    this.connectScreen = new ConnectScreen(document.getElementById('drone-connect'));
    this.intro = {
      time: 0,
      spawned: false,
      vanDuration: 3.2,
      vanDelay: 1.8,
      soldierEnd: 2.0,
      binocularEnd: 6.8,
      droneRevealEnd: 9.4,
      droneScale: 1.6,
      duration: 10.7,
      vanStart: 0,
      vanDrop: 0,
      vanSpeed: 0,
      vanHideTimer: 0,
      exhaustTimer: 0,
      doorClosePlayed: false,
      fovH: 55,
      binocularFov: 12,
      tower: null,
      poses: null,
      droneRevealStartPos: new THREE.Vector3(),
      droneRevealEndPos: new THREE.Vector3(),
      startPose: { position: new THREE.Vector3(), look: new THREE.Vector3() },
      targetPose: { position: new THREE.Vector3(), look: new THREE.Vector3() }
    };

    // Input state
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      steerAxis: 0,
      throttleAxis: 0,
      mouseAiming: false,
      mouseThrust: false,
      targetWorldPos: new THREE.Vector3()
    };

    this.idleInput = { forward: false, backward: false, left: false, right: false };
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Clock
    this.clock = new THREE.Clock();

    this.initEvents();
    onLocaleChange(() => this.refreshLocale());
    this.updateHUD();
    // Compile the hidden cinematic actors while the start modal is up, so
    // their first appearance does not hitch the intro.
    if (typeof this.renderer.renderer.compileAsync === 'function') {
      this.renderer.renderer.compileAsync(this.renderer.scene, this.renderer.camera).catch(() => {});
    } else {
      this.renderer.renderer.compile(this.renderer.scene, this.renderer.camera);
    }
    if (import.meta.env.DEV) window.__vesloGame = this;
    this.animate();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
        return;
      }

      sound.init();

      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = true;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'PLAYING') {
          if (e.repeat) return;
          this.triggerStrike();
          clearInterval(this.keyHitRepeatTimer);
          this.keyHitRepeatTimer = setInterval(() => {
            if (this.state === 'PLAYING') this.triggerStrike();
          }, 500);
        } else if (this.state === 'INTRO') {
          this.skipIntro();
        } else if (this.state === 'MENU') {
          this.startGame();
        } else if (this.state === 'GAMEOVER') {
          if (e.repeat) return;
          if (performance.now() - this.gameOverAt < GAME_OVER_RESTART_DELAY) return;
          this.restartGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = false;
      if (e.code === 'Space') {
        clearInterval(this.keyHitRepeatTimer);
        this.keyHitRepeatTimer = null;
      }
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
      const intersectionPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.waterPlane, intersectionPoint)) {
        this.input.targetWorldPos.copy(intersectionPoint);
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) sound.init();
    });

    window.addEventListener('pointerdown', () => {
      if (this.state === 'INTRO') this.skipIntro();
    });

    this.startBtn.addEventListener('click', () => {
      // Unlock audio inside the tap before any fullscreen transition.
      sound.init();
      requestGameFullscreen();
      this.startGame();
    });

    this.restartBtn.addEventListener('click', () => {
      sound.init();
      requestGameFullscreen();
      this.restartGame();
    });

    if (this.resumeBtn) {
      this.resumeBtn.addEventListener('click', () => {
        sound.init();
        this.resumeGame();
      });
    }

    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => {
        sound.init();
        this.pauseGame();
      });
    }

    window.addEventListener('blur', () => this.clearInput());
    window.addEventListener('orientationchange', () => this.clearInput());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearInput();
    });

    this.initTouchControls();
  }

  initTouchControls() {
    const throttle = document.getElementById('touch-throttle');
    const throttleTrack = document.getElementById('touch-throttle-track');
    const throttleKnob = document.getElementById('touch-throttle-knob');

    if (throttle && throttleTrack && throttleKnob) {
      let pointerId = null;

      const applyThrottle = (clientY) => {
        const rect = throttleTrack.getBoundingClientRect();
        const knobSize = throttleKnob.offsetHeight || 58;
        const limit = Math.max(1, rect.height / 2 - knobSize / 2 - 4);
        const centerY = rect.top + rect.height / 2;

        let dy = clientY - centerY;
        if (dy > limit) dy = limit;
        else if (dy < -limit) dy = -limit;

        throttleKnob.style.transform = `translateY(${dy}px)`;

        // Up = forward throttle, down = reverse, spring back to neutral.
        const deadzone = 0.12;
        const value = -dy / limit;
        const magnitude = Math.abs(value);
        const shaped = magnitude < deadzone
          ? 0
          : Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
        this.input.throttleAxis = shaped * 0.7;
        throttle.classList.add('is-active');
      };

      const releaseThrottle = () => {
        pointerId = null;
        throttle.classList.remove('is-active');
        throttleKnob.style.transform = '';
        this.input.throttleAxis = 0;
      };

      throttleTrack.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        sound.init();
        pointerId = e.pointerId;
        throttle.classList.add('is-active');
        if (throttleTrack.setPointerCapture) {
          try { throttleTrack.setPointerCapture(e.pointerId); } catch {}
        }
        applyThrottle(e.clientY);
      });

      throttleTrack.addEventListener('pointermove', (e) => {
        if (e.pointerId !== pointerId) return;
        e.preventDefault();
        applyThrottle(e.clientY);
      });

      const endThrottle = (e) => {
        if (pointerId != null && e.pointerId !== pointerId) return;
        releaseThrottle();
      };

      throttleTrack.addEventListener('pointerup', endThrottle);
      throttleTrack.addEventListener('pointercancel', endThrottle);
      throttleTrack.addEventListener('lostpointercapture', releaseThrottle);
      throttleTrack.addEventListener('contextmenu', (e) => e.preventDefault());

      this.touchThrottle = { release: releaseThrottle };
    }

    const bindSteer = (id, prop) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const press = (e) => {
        e.preventDefault();
        sound.init();
        this.input[prop] = true;
        btn.classList.add('is-pressed');
        if (btn.setPointerCapture && e.pointerId != null) {
          try { btn.setPointerCapture(e.pointerId); } catch {}
        }
      };

      const release = () => {
        this.input[prop] = false;
        btn.classList.remove('is-pressed');
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };

    bindSteer('touch-left', 'left');
    bindSteer('touch-right', 'right');

    const hitBtn = document.getElementById('touch-hit');
    if (!hitBtn) return;

    const stopHit = () => {
      hitBtn.classList.remove('is-pressed');
      clearInterval(this.hitRepeatTimer);
      this.hitRepeatTimer = null;
    };

    hitBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sound.init();
      hitBtn.classList.add('is-pressed');
      if (hitBtn.setPointerCapture && e.pointerId != null) {
        try { hitBtn.setPointerCapture(e.pointerId); } catch {}
      }
      if (this.state === 'PLAYING') {
        this.triggerStrike();
        clearInterval(this.hitRepeatTimer);
        this.hitRepeatTimer = setInterval(() => {
          if (this.state === 'PLAYING') this.triggerStrike();
        }, 500);
      }
    });

    hitBtn.addEventListener('pointerup', stopHit);
    hitBtn.addEventListener('pointercancel', stopHit);
    hitBtn.addEventListener('lostpointercapture', stopHit);
    hitBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  clearInput() {
    this.input.forward = false;
    this.input.backward = false;
    this.input.left = false;
    this.input.right = false;
    this.input.steerAxis = 0;
    this.input.throttleAxis = 0;
    this.input.mouseThrust = false;
    if (this.touchThrottle) this.touchThrottle.release();
    document.querySelectorAll('.touch-btn.is-pressed').forEach((btn) => {
      btn.classList.remove('is-pressed');
    });
    clearInterval(this.hitRepeatTimer);
    this.hitRepeatTimer = null;
    clearInterval(this.keyHitRepeatTimer);
    this.keyHitRepeatTimer = null;
  }

  startGame() {
    this.state = 'INTRO';
    this.clearInput();
    this.startModal.classList.add('hidden');
    this.hideGameOverScreen();
    this.pauseModal.classList.add('hidden');
    document.body.classList.add('intro');

    this.boat.reset();
    this.world.rockField.reset(this.boat.position.x);
    this.smugglerManager.reset();
    this.wildlifeManager.reset();
    rankSystem.reset();
    clearTimeout(this.rankUpTimer);
    this.rankUpQueue.length = 0;
    this.rankUpActive = false;
    document.body.classList.remove('rank-up-active');
    if (this.rankUpBanner) this.rankUpBanner.classList.remove('is-visible');
    this.hidePartnerBubble();
    this.hideKillStreak();
    this.enemyKillCount = 0;
    this.bestKillStreak = 0;
    this.updateHUD();

    // Fresh drone feed for the new mission
    this.missionTime = 0;
    this.battery = INITIAL_BATTERY;
    this.batteryDead = false;
    this.batteryDeadTimer = 0;
    this.endBatteryChaseCamera();
    this.rechargedTimer = 0;
    this.switchStaticTimer = 0;
    this.droneReadySeconds = 0;
    this.boatCrew.oarsman.soldier.chestRadio.update(0, false);
    this.akReloadPending = false;
    this.akShotCooldownUntil = 0;
    this.prevThreatCount = 0;
    if (this.osd.root) {
      this.osd.root.classList.remove('low-battery', 'signal-lost', 'battery-recharged', 'drone-ready', 'switch-static');
    }
    if (this.container) this.container.classList.remove('feed-degraded');

    acquireWakeLock();
    this.startIntro();
  }

  startIntro() {
    const path = this.world.gravelPath;
    const intro = this.intro;
    if (!path || !path.frameAt) {
      this.finishIntro();
      return;
    }

    // Drop off where the road disappears into the woods. The watchtower sees
    // the last stretch, so the van enters from off-screen.
    const dropDistance = path.introDropDistance ?? path.length * 0.45;
    const dropFrame = path.frameAt(dropDistance);

    intro.time = 0;
    intro.spawned = false;
    intro.vanHideTimer = 0;
    intro.vanDrop = dropDistance;
    intro.vanStart = path.introVanStartDistance ?? 0;
    intro.vanSpeed = (intro.vanDrop - intro.vanStart) / intro.vanDuration;
    intro.exhaustTimer = 0;
    intro.doorClosePlayed = false;

    const tower = (this.world.watchtowers || []).find((item) => item.x > 0)
      || (this.world.watchtowers || [])[0];
    if (!tower) {
      this.finishIntro();
      return;
    }
    intro.tower = tower;

    const floorY = tower.floorY;
    const eyeY = floorY + 1.47;
    intro.poses = {
      guard: {
        position: new THREE.Vector3(tower.x + 1.3, floorY + 1.8, tower.z - 4.6),
        look: new THREE.Vector3(tower.x, floorY + 1.35, tower.z + 0.2)
      },
      eye: {
        position: new THREE.Vector3(tower.x, eyeY, tower.z - 0.55),
        look: new THREE.Vector3(dropFrame.x, dropFrame.y + 1, dropFrame.z)
      },
      reveal: {
        position: new THREE.Vector3(tower.x + 1.5, tower.topY + 3.0, tower.z + 12.5),
        look: new THREE.Vector3(tower.x, tower.topY + 0.2, tower.z - 18)
      }
    };

    intro.droneRevealStartPos.set(tower.x, tower.topY - 2.5, tower.z - 2.4);
    intro.droneRevealEndPos.set(tower.x, tower.topY + 3.6, tower.z - 4.2);

    intro.startPose.position.copy(intro.poses.guard.position);
    intro.startPose.look.copy(intro.poses.guard.look);

    this.soldier.reset();
    this.soldier.group.position.set(tower.x, floorY, tower.z);
    this.soldier.group.rotation.y = Math.PI;
    this.soldier.group.scale.setScalar(0.78);
    this.soldier.setMode('binoculars', true);
    this.soldier.setVisible(true);

    this.drone.setVisible(false);
    this.drone.group.scale.setScalar(intro.droneScale);
    if (this.binocularOverlay) this.binocularOverlay.classList.remove('is-active');
    this.connectScreen.hide();

    this.renderer.settleFollow(this.boat.position.x, this.boat.position.z);
    intro.targetPose = this.renderer.getGameplayPose();
    this.renderer.setHorizontalFovOverride(intro.fovH);
    this.renderer.setManualCamera(intro.startPose.position, intro.startPose.look);

    this.minivan.show();
    this.minivan.setPose(path.frameAt(intro.vanStart), 0);
    this.minivan.doorOpen = 0;
    this.minivan.closeDoors();
    this.minivan.update(0, 0);
    sound.startVanEngine();
    sound.updateVanEngine(0.25);
    sound.playExhaustPuff();
  }

  getIntroDronePosition(t) {
    const intro = this.intro;
    if (t < intro.binocularEnd) return intro.droneRevealStartPos.clone();
    if (t < intro.droneRevealEnd) {
      const k = THREE.MathUtils.smoothstep(t, intro.binocularEnd, intro.droneRevealEnd);
      return intro.droneRevealStartPos.clone().lerp(intro.droneRevealEndPos, k);
    }
    return intro.droneRevealEndPos.clone();
  }

  getIntroCameraPose(t) {
    const intro = this.intro;
    const poses = intro.poses;
    if (!poses) return null;

    if (t < intro.soldierEnd) {
      return {
        position: poses.guard.position.clone(),
        look: poses.guard.look.clone(),
        fov: 58
      };
    }

    if (t < intro.binocularEnd) {
      return {
        position: poses.eye.position.clone(),
        look: poses.eye.look.clone(),
        fov: intro.binocularFov
      };
    }

    if (t < intro.droneRevealEnd) {
      return {
        position: poses.reveal.position.clone(),
        look: poses.reveal.look.clone(),
        fov: 58
      };
    }

    return null;
  }

  updateIntro(dt) {
    const intro = this.intro;
    intro.time += dt;
    const t = intro.time;
    const path = this.world.gravelPath;
    const vanT = Math.max(0, t - intro.vanDelay);
    const spawnTime = intro.vanDuration + 0.55;
    const doorCloseTime = intro.vanDuration + 1.55;

    if (path && path.frameAt) {
      if (t < intro.vanDelay) {
        this.minivan.setPose(path.frameAt(intro.vanStart), 0);
        this.minivan.update(dt, 0);
        sound.updateVanEngine(0.22);
      } else if (vanT <= intro.vanDuration) {
        const k = THREE.MathUtils.smoothstep(vanT, 0, intro.vanDuration);
        const distance = THREE.MathUtils.lerp(intro.vanStart, intro.vanDrop, k);
        // Drift onto the shoulder before coming to a stop, never after.
        const lateral = 2.6 * THREE.MathUtils.smoothstep(k, 0.7, 1);
        const frame = path.frameAt(distance);
        this.minivan.setPose(frame, lateral);
        this.minivan.update(dt, intro.vanSpeed);
        this.updateVanExhaust(dt, 1);
        sound.updateVanEngine(0.9);
      } else {
        const stopFrame = path.frameAt(intro.vanDrop);
        this.minivan.setPose(stopFrame, 2.6);
        this.minivan.update(dt, 0);
        this.updateVanExhaust(dt, 0.2);
        sound.updateVanEngine(0.18);
      }
    }

    if (vanT >= doorCloseTime) {
      this.minivan.closeDoors();
      if (!intro.doorClosePlayed) {
        intro.doorClosePlayed = true;
        sound.playVanDoorClose();
      }
    } else if (vanT >= intro.vanDuration) {
      this.minivan.openDoors();
    }

    if (!intro.spawned && vanT >= spawnTime) {
      this.spawnIntroSmugglers();
    }

    this.smugglerManager.updateIntro(dt, this.boat);

    let soldierVisible = false;
    if (t < intro.binocularEnd) {
      this.soldier.setMode('binoculars');
      soldierVisible = t < intro.soldierEnd;
    }
    this.soldier.setVisible(soldierVisible);
    this.soldier.update(dt);

    if (this.binocularOverlay) {
      const overlayOn = t >= intro.soldierEnd && t < intro.binocularEnd;
      this.binocularOverlay.classList.toggle('is-active', overlayOn);
    }

    this.drone.setVisible(t >= intro.binocularEnd);
    if (t >= intro.binocularEnd) {
      const dronePos = this.getIntroDronePosition(t);
      this.drone.setPose(dronePos.x, dronePos.y, dronePos.z, Math.PI);
      this.drone.update(dt);
    }

    const pose = this.getIntroCameraPose(t);
    if (pose) {
      this.renderer.setManualCamera(pose.position, pose.look);
      this.renderer.setHorizontalFovOverride(pose.fov);
    }

    const connecting = t >= intro.droneRevealEnd && t < intro.duration;
    if (connecting) {
      if (!this.connectScreen.active) this.connectScreen.show();
      this.connectScreen.update(dt);
    } else if (this.connectScreen.active) {
      this.connectScreen.hide();
    }

    if (t >= intro.duration) {
      this.finishIntro();
    }
  }

  spawnIntroSmugglers() {
    const intro = this.intro;
    if (intro.spawned) return;
    intro.spawned = true;

    const vanLateral = 2.6;
    [-1, 1].forEach((side, index) => {
      const laneOffset = side * 1.2;
      const smuggler = this.smugglerManager.spawnSmugglerAt(
        intro.vanDrop - 1.65,
        laneOffset
      );
      smuggler.beginDisembark(this.minivan.getDoorWorldPosition(side), {
        delay: index * 0.12,
        side,
        laneOffset,
        laneMergeDistance: intro.vanDrop + 3.4,
        hold: 0.62,
        exitOffset: vanLateral + side * 1.55
      });
    });

    this.smugglerManager.beginAfterIntro();
  }

  spawnDebugSwimmers() {
    if (INITIAL_SPAWN_COUNT <= 0) return;

    const path = this.world.gravelPath;
    const z = (path ? path.emergeZ : 0) + 2;
    const halfWidth = this.world.riverHalfWidth ?? 24;
    const centerX = this.boat.position.x;

    for (let i = 0; i < INITIAL_SPAWN_COUNT; i++) {
      const spread = (i - (INITIAL_SPAWN_COUNT - 1) / 2) * 5;
      const jitter = (Math.random() - 0.5) * 3;
      const x = THREE.MathUtils.clamp(
        centerX + spread + jitter,
        -halfWidth + 3,
        halfWidth - 3
      );
      this.smugglerManager.spawnSwimmingAt(x, z);
    }
  }

  skipIntro() {
    if (this.state !== 'INTRO') return;

    this.spawnIntroSmugglers();
    for (const smuggler of this.smugglerManager.smugglers) {
      smuggler.skipDisembark();
    }

    this.minivan.hide();
    sound.stopVanEngine();
    this.finishIntro();
  }

  updateVanExhaust(dt, intensity = 1) {
    const intro = this.intro;
    intro.exhaustTimer -= dt;
    if (intro.exhaustTimer > 0) return;

    intro.exhaustTimer = intensity > 0.5
      ? 0.06 + Math.random() * 0.05
      : 0.28 + Math.random() * 0.14;

    const p = this.minivan.getExhaustWorldPosition();
    const count = intensity > 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.world.emitParticle(
        p.x + (Math.random() - 0.5) * 0.14,
        p.y + Math.random() * 0.06,
        p.z + (Math.random() - 0.5) * 0.14,
        (Math.random() - 0.5) * 0.25,
        0.45 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.25,
        i === 0 ? 0x3f4448 : 0x6b7176,
        0.55 + Math.random() * 0.45,
        0.8 + Math.random() * 0.5
      );
    }
  }

  finishIntro() {
    this.state = 'PLAYING';
    document.body.classList.remove('intro');
    this.intro.vanHideTimer = 1.0;
    sound.stopVanEngine();
    this.soldier.setVisible(false);
    this.drone.setVisible(false);
    this.drone.group.scale.setScalar(this.intro.droneScale);
    if (this.binocularOverlay) this.binocularOverlay.classList.remove('is-active');
    this.connectScreen.hide();
    this.renderer.clearManualCamera();
    this.renderer.clearHorizontalFovOverride();
    this.clearInput();
    this.glitchOsd(450);
    this.showOsdAlert(t('osd.alert.uplinkActive'), 'ok', 2.2);
    this.spawnDebugSwimmers();
  }

  updateVanVisibility(dt) {
    if (!this.minivan.group.visible) return;

    if (this.intro.vanHideTimer > 0) {
      this.intro.vanHideTimer -= dt;
      return;
    }

    const van = this.minivan.group.position;
    this.vanScreenPos.set(van.x, van.y, van.z);
    this.vanScreenPos.project(this.renderer.camera);

    const offscreen =
      Math.abs(this.vanScreenPos.x) > 1 ||
      Math.abs(this.vanScreenPos.y) > 1 ||
      this.vanScreenPos.z > 1;

    if (offscreen) {
      this.minivan.hide();
      sound.stopVanEngine();
    }
  }

  restartGame() {
    this.startGame();
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.clearInput();
    sound.pause();
    releaseWakeLock();
    this.pauseModal.classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.clearInput();
    sound.resume();
    acquireWakeLock();
    this.pauseModal.classList.add('hidden');
  }

  onWildlifeKilled(type, kills) {
    logger.log('WILDLIFE', `${type} killed`, { kills });
  }

  triggerStrike() {
    if (AK_ENABLED && this.batteryDead && this.smugglerManager.findAkTarget(this.boat)) {
      this.fireAkShot();
      return;
    }
    this.boat.triggerSlap();
  }

  fireAkShot() {
    if (!AK_ENABLED || this.state !== 'PLAYING' || !this.batteryDead) return;

    const now = performance.now();
    if (now < this.akShotCooldownUntil) return;
    this.akShotCooldownUntil = now + 500;

    if (this.akReloadPending) {
      sound.playAkReload();
      this.akReloadPending = false;
    }
    sound.playAkShot();

    this.smugglerManager.fireAkShot(this.boat);
  }

  onSmugglerSmacked(points, worldPos, text, type = 'whack', count = 1) {
    if (type === 'shred') {
      this.renderer.triggerScreenShake(0.95);
    } else if (type === 'ram') {
      this.renderer.triggerScreenShake(0.35);
    } else {
      this.renderer.triggerScreenShake(0.55 + Math.min(count, 4) * 0.12);
    }

    let displayText = text;
    const countsForStreak =
      type === 'whack' || type === 'ram' || type === 'shred' || type === 'ak';
    if (countsForStreak) {
      this.enemyKillCount += count;
      if (type === 'whack') {
        const wordTier = ((this.enemyKillCount - 1) % 3) + 1;
        const word = t(`streak.x${wordTier}`);
        displayText = `+${points} ${word}`;
      }
      this.registerKillStreak(count);
    }

    this.world.triggerCrowdReaction();
    this.updateHUD();
    this.createFloatingScore(worldPos, displayText, type);

    logger.log('COMBAT', `Smuggler neutralized via ${type}`, {
      points,
      kills: count,
      totalScore: this.smugglerManager.score
    });
  }

  createFloatingScore(worldPos, text, type = 'whack') {
    // Show the popup beside the boat on the side of the impact. Rotor kills
    // (and anything dead centre) pick a side at random.
    this.boat.group.updateMatrixWorld(true);
    this.floatLocal.copy(worldPos);
    this.boat.group.worldToLocal(this.floatLocal);
    const hitSign =
      Math.abs(this.floatLocal.z) < 0.4 || type === 'shred'
        ? (Math.random() < 0.5 ? -1 : 1)
        : Math.sign(this.floatLocal.z);

    const camera = this.renderer.camera;
    camera.updateMatrixWorld();
    const pov = !!this.batteryCam && BATTERY_CAMERA === 'pov';
    let x;
    let y;
    if (pov) {
      // The eye sits inside the boat: pin popups to the matching screen edge.
      this.floatRight.setFromMatrixColumn(camera.matrixWorld, 0);
      this.floatSide.set(0, 0, 1).transformDirection(this.boat.group.matrixWorld);
      const screenSign = hitSign * (this.floatSide.dot(this.floatRight) >= 0 ? 1 : -1);
      x = window.innerWidth * (0.5 + screenSign * 0.27);
      y = window.innerHeight * (0.5 + (Math.random() - 0.5) * 0.12);
    } else {
      this.floatSide.set(0.3, 1.2, hitSign * 2.4);
      this.boat.group.localToWorld(this.floatSide);
      this.floatSide.project(camera);
      x = (this.floatSide.x * 0.5 + 0.5) * window.innerWidth;
      y = (-(this.floatSide.y * 0.5) + 0.5) * window.innerHeight;
      x = Math.min(Math.max(x, 60), window.innerWidth - 60);
      y = Math.min(Math.max(y, 60), window.innerHeight - 60);
    }

    const popup = document.createElement('div');
    popup.className = `float-score type-${type}${pov ? ' pov' : ''}`;
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;

    document.body.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 900);
  }

  registerKillStreak(count = 1) {
    if (this.killStreakTimer > 0) {
      this.killStreak += count;
    } else {
      this.killStreak = count;
    }
    this.bestKillStreak = Math.max(this.bestKillStreak, this.killStreak);
    this.killStreakTimer = this.killStreakWindow;
    this.renderKillStreak();
  }

  renderKillStreak() {
    if (!this.killStreakBanner) return;
    const tier = Math.min(this.killStreak, 3);
    if (this.killStreakCount) this.killStreakCount.textContent = `×${this.killStreak}`;
    this.killStreakBanner.dataset.tier = String(tier);
    this.killStreakBanner.style.setProperty('--streak-progress', '1');
    this.killStreakBanner.classList.add('visible');
    this.updateKillStreakPosition();
  }

  updateKillStreakPosition() {
    if (!this.killStreakBanner || this.killStreakTimer <= 0) return;
    this.boat.getStreakAnchorWorldPosition(this.killStreakAnchor);
    this.renderer.camera.updateMatrixWorld();
    this.killStreakAnchor.project(this.renderer.camera);
    const x = (this.killStreakAnchor.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(this.killStreakAnchor.y * 0.5) + 0.5) * window.innerHeight;
    this.killStreakBanner.style.left = `${x}px`;
    this.killStreakBanner.style.top = `${y}px`;
  }

  hideKillStreak() {
    this.killStreak = 0;
    this.killStreakTimer = 0;
    if (this.killStreakBanner) this.killStreakBanner.classList.remove('visible');
  }

  updateKillStreak(dt) {
    if (this.killStreakTimer <= 0) return;
    this.killStreakTimer = Math.max(0, this.killStreakTimer - dt);
    if (this.killStreakBanner) {
      const progress = this.killStreakTimer / this.killStreakWindow;
      this.killStreakBanner.style.setProperty('--streak-progress', progress.toFixed(3));
    }
    if (this.killStreakTimer <= 0) this.hideKillStreak();
  }

  showGameOverScreen() {
    document.body.classList.add('game-over');
    this.gameOverScreen.classList.remove('hidden');
  }

  hideGameOverScreen() {
    document.body.classList.remove('game-over');
    if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');
    this.gameOverFocus = null;
    this.renderer.clearManualCamera();
    this.renderer.clearHorizontalFovOverride();
  }

  startGameOverFocus(target, follow = null) {
    // Hand over from the battery camera (if active) without a pose snap.
    this.stopBatteryCamera();
    const camera = this.renderer.camera;
    const focusPoint = target.clone();
    focusPoint.y += 0.9;

    const startLook = this.renderer.lookTarget.clone();

    // Look in from the river side. During a crash the hull can be buried in a
    // rock/reed belt, so the old "behind the current camera" offset sometimes
    // put the failure camera inside bank geometry.
    const inward = new THREE.Vector3(-focusPoint.x, 0, -focusPoint.z);
    if (inward.lengthSq() < 0.01) {
      inward.subVectors(focusPoint, camera.position);
      inward.y = 0;
    }
    if (inward.lengthSq() < 0.01) inward.set(0, 0, 1);
    inward.normalize();

    const distance = follow ? 10.5 : 12;
    const height = follow ? 11.5 : 14.5;
    const endPos = focusPoint
      .clone()
      .addScaledVector(inward, distance)
      .add(new THREE.Vector3(0, height, 0));

    // If that still lands in the rock line, climb and push farther into the
    // open water until the camera has clearance.
    if (this.world && this.world.isNearRock) {
      for (let guard = 0; guard < 6 && this.world.isNearRock(endPos.x, endPos.z, 2.5); guard++) {
        endPos.addScaledVector(inward, 1.5);
        endPos.y += 1.2;
      }
    }

    const offset = endPos.clone().sub(focusPoint);

    this.gameOverFocus = {
      elapsed: 0,
      duration: 1.9,
      startPos: camera.position.clone(),
      startLook,
      offset,
      endPos,
      endLook: focusPoint,
      follow,
      followElapsed: 0,
      followDuration: follow ? GAME_OVER_FOLLOW_SECONDS : 5,
      startFov: this.renderer.fovHOverride ?? this.renderer.getGameplayHorizontalFov(),
      endFov: 52
    };
  }

  updateGameOverFocus(dt) {
    const focus = this.gameOverFocus;
    if (!focus) return;

    focus.elapsed += dt;
    const k = THREE.MathUtils.clamp(focus.elapsed / focus.duration, 0, 1);
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

    if (focus.follow?.position) {
      focus.followElapsed += dt;
      if (focus.followElapsed >= focus.followDuration) {
        focus.follow = null;
        this.showOsdAlert(t('osd.alert.targetLost'), 'warn', 2.2);
      }
    }

    if (focus.follow?.position) {
      focus.endLook.copy(focus.follow.position);
      focus.endLook.y += 0.9;
      focus.endPos.copy(focus.endLook).add(focus.offset);
    }

    const pos = focus.startPos.clone().lerp(focus.endPos, eased);
    const look = focus.startLook.clone().lerp(focus.endLook, eased);

    const settle = Math.max(0, focus.elapsed - focus.duration);
    pos.x += Math.sin(settle * 0.9) * 0.35;
    pos.y += Math.sin(settle * 0.7) * 0.18;
    pos.z += Math.cos(settle * 0.8) * 0.35;
    look.x += Math.sin(settle * 0.55) * 0.2;
    look.z += Math.cos(settle * 0.5) * 0.2;

    this.renderer.setHorizontalFovOverride(
      THREE.MathUtils.lerp(focus.startFov, focus.endFov, eased)
    );
    this.renderer.setManualCamera(pos, look);
  }

  onBoatCrash(reason) {
    if (this.state !== 'PLAYING') return;
    this.state = 'GAMEOVER';
    this.gameOverAt = performance.now();
    this.hidePartnerBubble();
    this.hideKillStreak();
    this.clearInput();
    releaseWakeLock();
    this.renderer.triggerScreenShake(1.3);
    this.world.triggerCrowdReaction();
    sound.playRam();
    sound.playGameOver();
    this.glitchOsd(1400);

    logger.log('CRASH', reason);

    this.lastGameOver = { type: 'crash', reason };
    this.renderGameOverText();

    this.handleGameOverRanks();
    this.startGameOverFocus(this.boat.position);
    this.showGameOverScreen();
  }

  onRockBump() {
    if (this.state !== 'PLAYING') return;
    this.renderer.triggerScreenShake(0.25);
    this.showPartnerSwear();
  }

  onManOverboard() {
    if (this.state !== 'PLAYING') return;
    this.renderer.triggerScreenShake(0.45);
    sound.playSplash();
    sound.playAlert();
    this.showOsdAlert(t('osd.alert.manOverboard'), 'danger', 3);
    this.showPartnerLine(t('partner.manOverboard'), 3);
    logger.log('CREW', 'Oarsman fell overboard');
  }

  onManRecovered() {
    if (this.state !== 'PLAYING') return;
    this.showOsdAlert(t('osd.alert.manRecovered'), 'ok', 2.5);
    this.showPartnerLine(t('partner.manRecovered'), 2.5);
    logger.log('CREW', 'Oarsman recovered');
  }

  showPartnerLine(text, duration = 2.4) {
    if (!this.partnerBubble) return;
    this.partnerBubble.textContent = text;
    this.partnerBubble.classList.add('visible');
    this.partnerSwearTimer = duration;
    this.partnerSwearCooldown = Math.max(this.partnerSwearCooldown, duration);
  }

  showPartnerSwear() {
    if (!this.partnerBubble || this.partnerSwearCooldown > 0) return;
    this.partnerSwearCooldown = 2.4;
    this.partnerSwearTimer = 2.1;
    let index = Math.floor(Math.random() * PARTNER_SWEAR_KEYS.length);
    if (index === this.partnerSwearIndex) {
      index = (index + 1 + Math.floor(Math.random() * (PARTNER_SWEAR_KEYS.length - 1))) % PARTNER_SWEAR_KEYS.length;
    }
    this.partnerSwearIndex = index;
    this.partnerBubble.textContent = t(PARTNER_SWEAR_KEYS[index]);
    this.partnerBubble.classList.add('visible');
  }

  hidePartnerBubble() {
    if (!this.partnerBubble) return;
    this.partnerSwearTimer = 0;
    this.partnerSwearCooldown = 0;
    this.partnerSwearIndex = -1;
    this.partnerBubble.classList.remove('visible');
  }

  updatePartnerBubble(dt) {
    if (this.partnerSwearCooldown > 0) this.partnerSwearCooldown -= dt;
    if (!this.partnerBubble || this.partnerSwearTimer <= 0) return;

    this.partnerSwearTimer -= dt;
    if (this.partnerSwearTimer <= 0 || this.state !== 'PLAYING') {
      this.partnerBubble.classList.remove('visible');
      return;
    }

    this.partnerBubbleAnchor.copy(this.boat.position);
    this.partnerBubbleAnchor.y += 3.6;
    this.renderer.camera.updateMatrixWorld();
    this.partnerBubbleAnchor.project(this.renderer.camera);
    const x = (this.partnerBubbleAnchor.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.partnerBubbleAnchor.y * 0.5 + 0.5) * window.innerHeight;
    this.partnerBubble.style.left = `${x}px`;
    this.partnerBubble.style.top = `${y}px`;
  }

  // A smuggler reaching the south shore is no longer the end of the run: it
  // costs rank (the score drops to the threshold of the rank below).
  onBreach(breachedSmuggler, result) {
    if (this.state !== 'PLAYING') return;
    if (result.eliminated) {
      this.onBreachGameOver(breachedSmuggler, result);
      return;
    }
    this.renderer.triggerScreenShake(0.6);
    this.world.triggerCrowdReaction();
    sound.playAlert();
    this.glitchOsd(700);

    const demoted = result.toIndex < result.fromIndex;
    const title = getRankTitle(rankSystem.getRankForScore(result.score).current).toUpperCase();
    this.showOsdAlert(
      demoted ? t('osd.alert.derank', { title }) : t('osd.alert.breachNoRank'),
      'danger',
      4
    );
    this.showPartnerLine(t('partner.breach'), 3);
    if (breachedSmuggler && breachedSmuggler.position) {
      this.createFloatingScore(breachedSmuggler.position, t('score.breach'), 'shred');
    }
    logger.log('BREACH', 'Smuggler reached shore - demoted', result);
    this.updateHUD();
  }

  // A breach while already at the lowest rank (deranking below Recruit) ends the run.
  onBreachGameOver(breachedSmuggler, result) {
    this.state = 'GAMEOVER';
    this.gameOverAt = performance.now();
    this.hidePartnerBubble();
    this.hideKillStreak();
    this.clearInput();
    releaseWakeLock();
    this.renderer.triggerScreenShake(1.0);
    this.world.triggerCrowdReaction();
    sound.playGameOver();
    this.glitchOsd(1400);

    logger.log('BREACH', 'Smuggler reached shore at lowest rank - game over', result);

    this.lastGameOver = { type: 'breach' };
    this.renderGameOverText();
    this.handleGameOverRanks();
    this.startGameOverFocus(breachedSmuggler?.position ?? this.boat.position);
    this.showGameOverScreen();
  }

  renderGameOverText() {
    if (!this.lastGameOver) return;
    if (this.lastGameOver.type === 'crash') {
      if (this.gameOverTitle) this.gameOverTitle.textContent = t(`crash.${this.lastGameOver.reason}`);
      if (this.gameOverSubtitle) {
        this.gameOverSubtitle.textContent = '';
        this.gameOverSubtitle.hidden = true;
      }
    } else {
      if (this.gameOverTitle) this.gameOverTitle.textContent = t('modal.over.titleBreach');
      if (this.gameOverSubtitle) {
        this.gameOverSubtitle.textContent = t('modal.over.subtitleBreach');
        this.gameOverSubtitle.hidden = false;
      }
    }
  }

  refreshLocale() {
    this.updateHUD();
    if (this.killStreak > 0) this.renderKillStreak();
    if (this.lastGameOver) {
      this.renderGameOverText();
      this.handleGameOverRanks();
    }
  }

  handleGameOverRanks() {
    const score = this.smugglerManager.score;
    const best = Math.max(score, this.smugglerManager.peakScore || 0);
    if (best > this.highScore) {
      this.highScore = best;
      localStorage.setItem('veslo_high_score', this.highScore.toString());
    }

    const rankInfo = rankSystem.getRankForScore(score);
    if (this.finalRankBadge) this.finalRankBadge.innerHTML = rankIconMarkup(rankInfo.current, 'rank-insignia rank-insignia-lg');
    if (this.finalRankTitle) this.finalRankTitle.textContent = getRankTitle(rankInfo.current);
    if (this.finalRankScore) this.finalRankScore.textContent = t('modal.over.rankScore', { score });
    if (this.finalScore) this.finalScore.textContent = String(score);
    if (this.finalSmacked) this.finalSmacked.textContent = String(this.smugglerManager.totalSmacked);
    if (this.finalFrogs) this.finalFrogs.textContent = String(this.wildlifeManager.killsByType.frog);
    if (this.finalSnakes) this.finalSnakes.textContent = String(this.wildlifeManager.killsByType.snake);
    if (this.finalStreak) this.finalStreak.textContent = `×${this.bestKillStreak}`;
  }

  updateHUD() {
    const score = this.smugglerManager.score;
    const rankInfo = rankSystem.getRankForScore(score);
    const progress = rankSystem.getProgress(score);

    // Update Minimalist Rank HUD
    if (this.hudRankBadge) this.hudRankBadge.innerHTML = rankIconMarkup(rankInfo.current);
    if (this.hudRankTitle) this.hudRankTitle.textContent = getRankTitle(rankInfo.current);
    if (this.hudScorePill) this.hudScorePill.textContent = t('hud.scorePill', { score });
    if (this.hudHighScore) this.hudHighScore.textContent = Math.max(this.highScore, score);
    if (this.hudRankBar) this.hudRankBar.style.width = `${(progress * 100).toFixed(1)}%`;

    if (this.hudRankNext) {
      if (rankInfo.next) {
        this.hudRankNext.textContent = t('hud.nextRank', {
          title: getRankTitle(rankInfo.next).toUpperCase(),
          score: rankInfo.next.minScore
        });
      } else {
        this.hudRankNext.textContent = t('hud.maxRank');
      }
    }

    // Check if player just reached a new rank!
    const newRanks = rankSystem.checkRankUp(score);
    if (newRanks.length > 0) {
      sound.playAlert();
      for (const rank of newRanks) {
        this.rankUpQueue.push(rank);
        logger.log('RANK_UP', `Promoted to ${getRankTitle(rank)}!`, { score });
      }
      this.drainRankUpQueue();
    }
  }

  showRankUpBanner(rank) {
    if (!this.rankUpBanner) {
      this.rankUpBanner = document.createElement('div');
      this.rankUpBanner.className = 'rank-up-popup';
      document.body.appendChild(this.rankUpBanner);
    }

    const banner = this.rankUpBanner;
    banner.innerHTML = `
      <div class="rank-up-eyebrow">${t('rank.promotion')}</div>
      <div class="rank-up-main">
        ${rankIconMarkup(rank, 'rank-insignia rank-insignia-lg')}
        <span class="rank-up-title">${getRankTitle(rank)}</span>
      </div>
    `;

    // Restart the CSS animation on the cached node (no layout rebuild / removal thrash)
    banner.classList.remove('is-visible');
    void banner.offsetWidth;
    banner.classList.add('is-visible');
    document.body.classList.add('rank-up-active');

    clearTimeout(this.rankUpTimer);
    this.rankUpTimer = setTimeout(() => {
      banner.classList.remove('is-visible');
      document.body.classList.remove('rank-up-active');
      this.rankUpTimer = setTimeout(() => {
        this.rankUpActive = false;
        this.drainRankUpQueue();
      }, PROMOTION_TUNING.gapMs);
    }, PROMOTION_TUNING.visibleMs);
  }

  drainRankUpQueue() {
    if (this.rankUpActive || this.rankUpQueue.length === 0) return;
    const rank = this.rankUpQueue.shift();
    this.rankUpActive = true;
    this.showRankUpBanner(rank);
  }

  pad2(value) {
    return String(value).padStart(2, '0');
  }

  buildHeadingTape() {
    if (!this.osd.headingTape) return;
    this.headingPxPerDeg = 4;

    const fragment = document.createDocumentFragment();
    for (let deg = -360; deg <= 720; deg += 15) {
      const tick = document.createElement('span');
      tick.className = 'osd-tick';
      const norm = ((deg % 360) + 360) % 360;

      if (norm === 0) {
        tick.classList.add('cardinal');
        tick.textContent = 'N';
      } else if (norm === 90) {
        tick.classList.add('cardinal');
        tick.textContent = 'E';
      } else if (norm === 180) {
        tick.classList.add('cardinal');
        tick.textContent = 'S';
      } else if (norm === 270) {
        tick.classList.add('cardinal');
        tick.textContent = 'W';
      } else if (deg % 45 === 0) {
        tick.classList.add('major');
        tick.textContent = String(norm).padStart(3, '0');
      }

      tick.style.left = `${(deg + 360) * this.headingPxPerDeg}px`;
      fragment.appendChild(tick);
    }

    this.osd.headingTape.appendChild(fragment);
  }

  getCameraHeading() {
    const dir = this.renderer.camera.getWorldDirection(this.cameraDir);
    const deg = (Math.atan2(dir.x, -dir.z) * 180) / Math.PI;
    return (deg + 360) % 360;
  }

  updateHeadingTape(heading) {
    if (!this.osd.headingTape || !this.headingPxPerDeg) return;
    const windowWidth = 260; // matches .osd-heading-window width
    const x = windowWidth / 2 - (heading + 360) * this.headingPxPerDeg;
    this.osd.headingTape.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  updateHeading() {
    const heading = this.getCameraHeading();
    const headingText = String(Math.round(heading) % 360).padStart(3, '0');

    if (headingText !== this.lastHeadingText) {
      this.lastHeadingText = headingText;
      if (this.osd.hdg) this.osd.hdg.textContent = headingText;
      if (this.osd.headingVal) this.osd.headingVal.textContent = `${headingText}°`;
    }

    this.updateHeadingTape(heading);
  }

  updateFps(rawDt) {
    this.fpsFrames++;
    this.fpsElapsed += rawDt;
    if (this.fpsElapsed < 0.5) return;

    this.fps = Math.round(this.fpsFrames / this.fpsElapsed);
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    if (this.osd.fps) this.osd.fps.textContent = String(this.fps);
  }

  updateBattery(dt) {
    if (this.rechargedTimer > 0) {
      this.rechargedTimer = Math.max(0, this.rechargedTimer - dt);
    }

    if (this.switchStaticTimer > 0) {
      this.switchStaticTimer = Math.max(0, this.switchStaticTimer - dt);
    }

    const radio = this.boatCrew.oarsman.soldier.chestRadio;
    if (this.batteryDead) {
      this.batteryDeadTimer += dt;
      const remaining = Math.max(0, BATTERY_RECHARGE_SECONDS - this.batteryDeadTimer);
      const countdown = remaining <= Math.min(DRONE_READY_COUNTDOWN_SECONDS, BATTERY_RECHARGE_SECONDS);
      this.droneReadySeconds = countdown ? Math.ceil(remaining) : 0;
      radio.update(dt, countdown);
      if (remaining <= DRONE_SWITCH_STATIC_SECONDS) {
        this.switchStaticTimer = DRONE_SWITCH_STATIC_SECONDS;
      }
      // Show the recharge progress on the battery bar while the chase cam runs.
      this.battery = Math.min(100, (this.batteryDeadTimer / BATTERY_RECHARGE_SECONDS) * 100);
      if (this.batteryDeadTimer >= BATTERY_RECHARGE_SECONDS) {
        this.battery = 100;
        this.batteryDead = false;
        this.batteryDeadTimer = 0;
        this.rechargedTimer = 3;
        this.droneReadySeconds = 0;
        this.switchStaticTimer = DRONE_SWITCH_STATIC_SECONDS * 0.5;
        radio.update(0, false);
        this.endBatteryChaseCamera();
      }
      return;
    }

    this.battery = Math.max(0, this.battery - dt * (BATTERY_DRAIN_PER_MINUTE / 60));
    if (!BATTERY_EVENTS) {
      // Low/dead battery events are disabled: the gauge drains but never goes flat.
      this.battery = Math.max(1, this.battery);
      return;
    }
    if (this.battery > 0) return;

    this.battery = 0;
    this.batteryDead = true;
    this.batteryDeadTimer = 0;
    this.akReloadPending = true;
    this.beginBatteryChaseCamera();
  }

  /** Swap the dead drone feed for the engine operator's POV or a chase view. */
  beginBatteryChaseCamera() {
    const renderer = this.renderer;
    const from = {
      position: renderer.camera.position.clone(),
      look: renderer.lookTarget.clone()
    };
    if (BATTERY_CAMERA === 'pov') {
      this.boatCrew.officer.setHeadVisible(false);
      this.povCamera.start(this.boatCrew.officer.getCameraMount(), from);
      this.batteryCam = this.povCamera;
      renderer.setHorizontalFovOverride(POV_CAMERA_OPTIONS.fov);
      renderer.setNearPlane(this.povCamera.options.near);
    } else {
      this.chaseCamera.start(this.boat, from);
      this.batteryCam = this.chaseCamera;
      renderer.setHorizontalFovOverride(CHASE_CAMERA_OPTIONS.fov);
    }
    this.batteryCam.update(0);
  }

  /** Stop the battery camera but leave the renderer pose/FOV for a hand-off. */
  stopBatteryCamera() {
    if (!this.batteryCam) return;
    this.batteryCam.stop();
    this.batteryCam = null;
    this.boatCrew.officer.setHeadVisible(true);
    this.renderer.setNearPlane(null);
  }

  endBatteryChaseCamera() {
    if (!this.batteryCam) return;
    this.stopBatteryCamera();
    this.renderer.clearManualCamera();
    this.renderer.clearHorizontalFovOverride();
  }

  updateChaseCamera(dt) {
    if (!this.batteryCam) return;
    if (this.batteryCam === this.povCamera) {
      // Look into the turn (up to 180 deg), nudged toward the enemy the operator is watching.
      const fullRate = this.boat.turnSpeed * POV_TURN_RATE_FRACTION;
      const raw = THREE.MathUtils.clamp(this.boat.angularVelocity / fullRate, -1, 1);
      const turn = Math.sign(raw) * raw * raw; // ease-in: gentle for small turns
      const bearing = this.boatCrew.officerBearing;
      const bias = bearing === null ? 0 : THREE.MathUtils.clamp(bearing, -POV_ENEMY_BIAS, POV_ENEMY_BIAS);
      this.povCamera.setYawTarget(THREE.MathUtils.clamp(
        turn * POV_MAX_TURN_YAW + bias + REVERSE_LOOK.cameraYaw * this.boatCrew.officer.reverseAmount,
        -Math.PI,
        Math.PI
      ));
    }
    this.batteryCam.update(dt);
    this.renderer.setManualCamera(this.batteryCam.position, this.batteryCam.look);
  }

  updateOSD() {
    if (!this.osd.root) return;
    const playing = this.state === 'PLAYING';

    const total = this.missionTime;
    const secs = Math.floor(total);
    const frames = Math.floor((total % 1) * 60);
    if (this.osd.timecode) {
      this.osd.timecode.textContent =
        `${this.pad2(Math.floor(secs / 3600))}:${this.pad2(Math.floor(secs / 60) % 60)}:${this.pad2(secs % 60)}:${this.pad2(frames)}`;
    }

    if (this.osd.alt) {
      this.osd.alt.textContent = Math.max(0, this.renderer.camera.position.y).toFixed(1);
    }
    if (this.osd.spd) {
      this.osd.spd.textContent = (Math.abs(this.boat.speed) * 1.94).toFixed(1).padStart(4, '0');
    }

    if (this.osd.gps) {
      const lat = 46.61 + this.boat.position.z * 0.0008;
      const lon = 30.72 + this.boat.position.x * 0.0009;
      this.osd.gps.textContent = `${lat.toFixed(3)} N / ${lon.toFixed(3)} E`;
    }

    const batteryPct = Math.round(this.battery);
    const lowBattery = BATTERY_EVENTS && playing && !this.batteryDead && this.battery <= 20;
    if (this.osd.batteryFill) {
      this.osd.batteryFill.style.width = `${batteryPct}%`;
      this.osd.batteryFill.classList.toggle('low', this.battery <= 20);
    }
    if (this.osd.batteryVal) this.osd.batteryVal.textContent = String(batteryPct);
    if (this.osd.batteryWarningVal) {
      this.osd.batteryWarningVal.textContent = `${batteryPct}%`;
    }
    if (this.osd.degrade) {
      const degradation = lowBattery ? 0.1 + ((20 - batteryPct) / 20) * 0.55 : 0;
      this.osd.degrade.style.opacity = degradation.toFixed(3);
    }
    if (this.container) this.container.classList.toggle('feed-degraded', lowBattery);

    this.osd.root.classList.toggle('low-battery', lowBattery);
    this.osd.root.classList.toggle('signal-lost', playing && this.batteryDead);
    this.osd.root.classList.toggle('drone-ready', playing && this.batteryDead && this.droneReadySeconds > 0);
    this.osd.root.classList.toggle('switch-static', playing && this.switchStaticTimer > 0);
    if (this.osd.droneReadyVal && this.droneReadySeconds > 0) {
      this.osd.droneReadyVal.textContent = String(this.droneReadySeconds);
    }
    this.osd.root.classList.toggle(
      'battery-recharged',
      playing && this.rechargedTimer > 0
    );

    if (this.osd.threatCount) {
      const threats = this.smugglerManager.smugglers.filter(
        (s) => !s.isDead && s.state === 'swimming'
      ).length;
      this.osd.threatCount.textContent = String(threats);
      this.osd.threatCount.classList.toggle('hot', threats > 0);
    }
  }

  showOsdAlert(text, variant = 'info', duration = 1.8) {
    if (!this.osd.alert) return;
    const el = this.osd.alert;
    el.textContent = text;
    el.className = `osd-alert visible ${variant}`;
    clearTimeout(this.alertTimeout);
    this.alertTimeout = setTimeout(() => el.classList.remove('visible'), duration * 1000);
  }

  glitchOsd(duration = 900) {
    if (!this.osd.root) return;
    this.osd.root.classList.add('glitching');
    clearTimeout(this.glitchTimeout);
    this.glitchTimeout = setTimeout(() => this.osd.root.classList.remove('glitching'), duration);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    this.updateFps(rawDt);

    // Only block play in portrait when vertical mode is turned off.
    const portraitLocked =
      !PORTRAIT_OPTIONS.enabled && document.body.classList.contains('is-portrait');

    if (this.state === 'INTRO') {
      if (!portraitLocked) this.updateIntro(dt);
    } else if (this.state === 'PLAYING' && !portraitLocked) {
      this.missionTime += dt;
      this.updateBattery(dt);
      this.boat.update(dt, this.input, this.smugglerManager.smugglers);
      this.proximityMarkers.update(dt, this.boat, this.smugglerManager.smugglers);
      this.smugglerManager.update(dt, this.boat, this.wildlifeManager.creatures);
      this.wildlifeManager.update(dt, this.boat, this.smugglerManager.smugglers);
    } else if (this.state !== 'PAUSED') {
      this.boat.update(dt, this.idleInput);
    }

    if (this.state === 'GAMEOVER') {
      this.smugglerManager.updateEscaped(dt, this.boat);
    }

    if (this.state === 'PLAYING' && !portraitLocked) {
      this.updateVanVisibility(dt);
    }

    if (this.state !== 'PAUSED') {
      this.boatCrew.officer.updateReverseLook(dt, REVERSE_LOOK);
      this.boatCrew.update(dt);
      this.boatCrew.updateGaze(dt, this.smugglerManager.smugglers, CREW_GAZE);
    }

    this.world.update(dt, this.boat.position.x, this.boat.velocity.x);
    if (this.state !== 'PAUSED') this.birdManager.update(dt, this.boat.position.x);
    if (this.state !== 'PLAYING') this.proximityMarkers.hide();

    this.renderer.setFollowTarget(
      this.boat.position.x,
      this.boat.position.z
    );
    this.renderer.setFollowHeading(this.boat.angle);
    if (this.state === 'GAMEOVER') this.updateGameOverFocus(dt);
    else if (this.state === 'PLAYING') this.updateChaseCamera(dt);
    this.renderer.updateCamera(dt);
    this.updatePartnerBubble(dt);
    this.updateKillStreakPosition();
    if (this.state !== 'PAUSED') this.updateKillStreak(dt);

    // The compass tape must follow the camera every frame to stay smooth;
    // it is a single GPU-composited transform, so this is cheap.
    this.updateHeading();

    // DOM telemetry only needs a low refresh rate; updating a dozen text nodes
    // and styles every frame causes avoidable layout/paint work.
    this.osdTimer += dt;
    if (this.osdTimer >= this.osdInterval) {
      this.osdTimer = 0;
      this.updateOSD();
    }
    this.renderer.render();
  }
}

function showWebGLUnavailable() {
  document.getElementById('start-modal')?.classList.add('hidden');
  document.getElementById('gameover-screen')?.classList.add('hidden');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-eyebrow danger">${t('error.webgl.eyebrow')}</div>
      <h1 class="modal-title danger">${t('error.webgl.title')}</h1>
      <div class="modal-subtitle">${t('error.webgl.subtitle')}</div>
      <div class="rule-highlight">
        <strong>${t('error.webgl.howTo')}</strong><br>
        ${t('error.webgl.hint')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

window.addEventListener('DOMContentLoaded', () => {
  if (isSpriteViewerEnabled()) {
    document.getElementById('start-modal')?.classList.add('hidden');
    import('./dev/SpriteViewer.js')
      .then(({ mountSpriteViewer }) => mountSpriteViewer())
      .catch((error) => console.error('[Sprite Lab] Failed to mount', error));
    return;
  }

  const touch = isTouchDevice();
  const updateViewportClasses = () => {
    document.body.classList.toggle('touch-device', touch);
    document.body.classList.toggle(
      'is-portrait',
      touch && window.innerHeight > window.innerWidth
    );
    document.body.classList.toggle(
      'portrait-play',
      PORTRAIT_OPTIONS.enabled && window.innerHeight > window.innerWidth
    );
  };

  updateViewportClasses();
  window.addEventListener('resize', updateViewportClasses);
  window.addEventListener('orientationchange', updateViewportClasses);

  const refreshResolutionNotice = () => {
    document.getElementById('resolution-modal')?.remove();
    if (!isSupportedDesktopResolution()) showUnsupportedResolution();
  };

  refreshResolutionNotice();
  onLocaleChange(refreshResolutionNotice);

  if (!isSupportedDesktopResolution()) {
    document.getElementById('start-modal')?.classList.add('hidden');
    return;
  }

  const installModal = document.getElementById('install-modal');
  const installContinueBtn = document.getElementById('install-continue-btn');
  if (installModal) {
    installModal.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  if (installModal && installContinueBtn) {
    installContinueBtn.addEventListener('click', () => {
      try {
        localStorage.setItem(INSTALL_PROMPT_KEY, '1');
      } catch (e) {}
      installModal.classList.add('hidden');
    });
  }
  showIOSInstallPrompt();

  mountRankSprites();
  registerOfflineServiceWorker();
  try {
    const game = new Game();
    window.__game = game;
    if (new URLSearchParams(window.location.search).has('autostart')) {
      game.startGame(); // temporary screenshot hook
    }
  } catch (err) {
    if (err.name === 'WebGLUnavailableError') {
      showWebGLUnavailable();
    } else {
      throw err;
    }
  }
});
