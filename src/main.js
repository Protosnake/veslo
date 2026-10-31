import * as THREE from 'three';
import { GameRenderer } from './core/Renderer.js';
import { RiverWorld } from './world/River.js';
import { Boat } from './entities/Boat.js';
import { SmugglerManager } from './entities/SmugglerManager.js';
import { WildlifeManager } from './entities/WildlifeManager.js';
import { Minivan } from './entities/Minivan.js';
import { sound } from './systems/Audio.js';
import { rankSystem } from './systems/RankSystem.js';
import { mountRankSprites, rankIconMarkup } from './systems/RankSprites.js';
import { logger } from './systems/Logger.js';
import { t, getRankTitle, onLocaleChange } from './systems/I18n.js';

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
    const result = orientation.lock('landscape');
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {}
}

function requestGameFullscreen() {
  if (!isTouchDevice()) return;

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    lockLandscape();
    return;
  }

  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return;

  try {
    const result = request.call(root, { navigationUI: 'hide' });
    if (result && typeof result.then === 'function') {
      result.then(lockLandscape).catch(() => {});
    } else {
      lockLandscape();
    }
  } catch {}
}

const SUPPORTED_ASPECT = 16 / 9;

function getScreenAspect() {
  const width = (window.screen && window.screen.width) || window.innerWidth;
  const height = (window.screen && window.screen.height) || window.innerHeight;
  return width / height;
}

function isSupportedDesktopResolution() {
  if (isTouchDevice()) return true;
  return Math.abs(getScreenAspect() - SUPPORTED_ASPECT) <= 0.06;
}

function showUnsupportedResolution() {
  if (document.getElementById('resolution-modal')) return;
  const width = (window.screen && window.screen.width) || window.innerWidth;
  const height = (window.screen && window.screen.height) || window.innerHeight;
  const ratio = (width / height).toFixed(2);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'resolution-modal';
  overlay.innerHTML = `
    <div class="modal-card resolution-card">
      <div class="modal-eyebrow danger"><span class="osd-rec-dot"></span> ${t('error.resolution.eyebrow')}</div>
      <h1 class="modal-title">${t('error.resolution.title')}</h1>
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

    // Modals
    this.startModal = document.getElementById('start-modal');
    this.startBtn = document.getElementById('start-btn');
    this.pauseModal = document.getElementById('pause-modal');
    this.resumeBtn = document.getElementById('resume-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverSubtitle = document.getElementById('game-over-subtitle');
    this.finalRankBadge = document.getElementById('final-rank-badge');
    this.finalRankTitle = document.getElementById('final-rank-title');
    this.finalRankScore = document.getElementById('final-rank-score');
    this.finalScore = document.getElementById('final-score');
    this.finalSmacked = document.getElementById('final-smacked');
    this.finalFrogs = document.getElementById('final-frogs');
    this.finalSnakes = document.getElementById('final-snakes');
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
      gps: document.getElementById('osd-gps'),
      threatCount: document.getElementById('osd-threat-count'),
      alert: document.getElementById('osd-alert')
    };

    this.missionTime = 0;
    this.battery = 100;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
    this.osdTimer = 0;
    this.osdInterval = 0.1;
    this.cameraDir = new THREE.Vector3();
    this.vanScreenPos = new THREE.Vector3();
    this.prevThreatCount = 0;
    this.lowBatteryWarned = false;
    this.alertTimeout = null;
    this.glitchTimeout = null;
    this.buildHeadingTape();

    // Storage
    this.highScore = parseInt(localStorage.getItem('veslo_high_score') || '0', 10);
    this.lastGameOver = null;

    // Core 3D engine
    this.renderer = new GameRenderer(this.container);
    this.world = new RiverWorld(this.renderer.scene);
    this.boat = new Boat(this.renderer.scene, this.world, (reason) => this.onBoatCrash(reason));

    // Smuggler Manager
    this.smugglerManager = new SmugglerManager(
      this.renderer.scene,
      this.world,
      (points, pos, text, type) => this.onSmugglerSmacked(points, pos, text, type),
      (smuggler) => this.onGameOver(smuggler)
    );

    this.wildlifeManager = new WildlifeManager(
      this.renderer.scene,
      this.world,
      (type, kills) => this.onWildlifeKilled(type, kills)
    );

    this.minivan = new Minivan(this.renderer.scene);
    this.intro = {
      time: 0,
      spawned: false,
      vanDuration: 3.2,
      transitionStart: 6.0,
      duration: 8.5,
      vanStart: 0,
      vanDrop: 0,
      vanSpeed: 0,
      vanHideTimer: 0,
      exhaustTimer: 0,
      doorClosePlayed: false,
      fovH: 50,
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
          this.boat.triggerSlap();
        } else if (this.state === 'INTRO') {
          this.skipIntro();
        } else if (this.state === 'MENU') {
          this.startGame();
        } else if (this.state === 'GAMEOVER') {
          this.restartGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = false;
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
        this.boat.triggerSlap();
        clearInterval(this.hitRepeatTimer);
        this.hitRepeatTimer = setInterval(() => {
          if (this.state === 'PLAYING') this.boat.triggerSlap();
        }, 360);
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
  }

  startGame() {
    this.state = 'INTRO';
    this.clearInput();
    this.startModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    document.body.classList.add('intro');

    this.boat.reset();
    this.smugglerManager.reset();
    this.wildlifeManager.reset();
    rankSystem.reset();
    this.updateHUD();

    // Fresh drone feed for the new mission
    this.missionTime = 0;
    this.battery = 100;
    this.prevThreatCount = 0;
    this.lowBatteryWarned = false;

    this.startIntro();
  }

  startIntro() {
    const path = this.world.gravelPath;
    const intro = this.intro;
    if (!path || !path.frameAt) {
      this.finishIntro();
      return;
    }

    // Drop off where the road disappears into the woods. The fixed drone shot
    // only sees the last stretch, so the van enters from off-screen.
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

    // Fixed high drone POV over the north plateau, framed on the drop point.
    intro.startPose.position.set(
      dropFrame.x - 4,
      dropFrame.y + 32,
      dropFrame.z + 26
    );
    intro.startPose.look.set(dropFrame.x, dropFrame.y + 1, dropFrame.z);

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

  updateIntro(dt) {
    const intro = this.intro;
    intro.time += dt;
    const t = intro.time;
    const path = this.world.gravelPath;
    const spawnTime = intro.vanDuration + 0.55;
    const doorCloseTime = intro.vanDuration + 1.55;

    if (path && path.frameAt) {
      if (t <= intro.vanDuration) {
        const k = THREE.MathUtils.smoothstep(t, 0, intro.vanDuration);
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

    if (t >= doorCloseTime) {
      this.minivan.closeDoors();
      if (!intro.doorClosePlayed) {
        intro.doorClosePlayed = true;
        sound.playVanDoorClose();
      }
    } else if (t >= intro.vanDuration) {
      this.minivan.openDoors();
    }

    if (!intro.spawned && t >= spawnTime) {
      this.spawnIntroSmugglers();
    }

    this.smugglerManager.updateIntro(dt, this.boat);

    if (t >= intro.transitionStart) {
      const duration = Math.max(0.001, intro.duration - intro.transitionStart);
      const k = THREE.MathUtils.clamp((t - intro.transitionStart) / duration, 0, 1);
      const eased = k * k * (3 - 2 * k);
      const position = intro.startPose.position.clone().lerp(intro.targetPose.position, eased);
      const look = intro.startPose.look.clone().lerp(intro.targetPose.look, eased);
      this.renderer.setManualCamera(position, look);
      this.renderer.setHorizontalFovOverride(
        THREE.MathUtils.lerp(
          intro.fovH,
          this.renderer.getGameplayHorizontalFov(),
          eased
        )
      );
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
    this.renderer.clearManualCamera();
    this.renderer.clearHorizontalFovOverride();
    this.clearInput();
    this.glitchOsd(450);
    this.showOsdAlert(t('osd.alert.uplinkActive'), 'ok', 2.2);
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
    this.pauseModal.classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.clearInput();
    this.pauseModal.classList.add('hidden');
  }

  onWildlifeKilled(type, kills) {
    logger.log('WILDLIFE', `${type} killed`, { kills });
  }

  onSmugglerSmacked(points, worldPos, text, type = 'whack') {
    if (type === 'shred') {
      this.renderer.triggerScreenShake(0.95);
    } else if (type === 'ram') {
      this.renderer.triggerScreenShake(0.35);
    } else {
      this.renderer.triggerScreenShake(0.65);
    }

    this.world.triggerCrowdReaction();
    this.updateHUD();
    this.createFloatingScore(worldPos, text, type);

    logger.log('COMBAT', `Smuggler neutralized via ${type}`, {
      points,
      totalScore: this.smugglerManager.score
    });
  }

  createFloatingScore(worldPos, text, type = 'whack') {
    const vector = worldPos.clone();
    vector.y += 1.0;
    vector.project(this.renderer.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    const popup = document.createElement('div');
    popup.className = `float-score type-${type}`;
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;

    document.body.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 900);
  }

  onBoatCrash(reason) {
    if (this.state !== 'PLAYING') return;
    this.state = 'GAMEOVER';
    this.clearInput();
    this.renderer.triggerScreenShake(1.3);
    this.world.triggerCrowdReaction();
    sound.playRam();
    sound.playGameOver();
    this.glitchOsd(1400);

    logger.log('CRASH', reason);

    this.lastGameOver = { type: 'crash', reason };
    this.renderGameOverText();

    this.handleGameOverRanks();

    this.gameOverModal.classList.remove('hidden');
  }

  onGameOver(breachedSmuggler) {
    if (this.state !== 'PLAYING') return;
    this.state = 'GAMEOVER';
    this.clearInput();
    this.renderer.triggerScreenShake(0.8);
    this.world.triggerCrowdReaction();
    this.glitchOsd(1400);

    logger.log('BREACH', 'Smuggler reached shore!');

    this.lastGameOver = { type: 'breach' };
    this.renderGameOverText();

    if (breachedSmuggler && breachedSmuggler.position) {
      this.createFloatingScore(breachedSmuggler.position, t('score.breach'), 'shred');
    }

    this.handleGameOverRanks();

    this.gameOverModal.classList.remove('hidden');
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
    if (this.lastGameOver) {
      this.renderGameOverText();
      this.handleGameOverRanks();
    }
  }

  handleGameOverRanks() {
    const score = this.smugglerManager.score;
    if (score > this.highScore) {
      this.highScore = score;
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
    const newRank = rankSystem.checkRankUp(score);
    if (newRank) {
      sound.playAlert();
      this.showRankUpBanner(newRank);
      logger.log('RANK_UP', `Promoted to ${getRankTitle(newRank)}!`, { score });
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
    }, 2300);
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
    if (this.osd.batteryFill) {
      this.osd.batteryFill.style.width = `${batteryPct}%`;
      this.osd.batteryFill.classList.toggle('low', batteryPct < 25);
    }
    if (this.osd.batteryVal) this.osd.batteryVal.textContent = `${batteryPct}%`;
    this.osd.root.classList.toggle('low-battery', playing && batteryPct < 25);

    if (playing && batteryPct < 20 && !this.lowBatteryWarned) {
      this.lowBatteryWarned = true;
      this.showOsdAlert(t('osd.alert.batteryCritical'), 'danger', 2.2);
    }

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

    const portraitLocked = document.body.classList.contains('is-portrait');

    if (this.state === 'INTRO') {
      if (!portraitLocked) this.updateIntro(dt);
    } else if (this.state === 'PLAYING' && !portraitLocked) {
      this.missionTime += dt;
      this.battery = Math.max(6, this.battery - dt * 0.22);
      this.boat.update(dt, this.input);
      this.smugglerManager.update(dt, this.boat, this.wildlifeManager.creatures);
      this.wildlifeManager.update(dt, this.boat, this.smugglerManager.smugglers);
    } else if (this.state !== 'PAUSED') {
      this.boat.update(dt, this.idleInput);
    }

    if (this.state === 'PLAYING' && !portraitLocked) {
      this.updateVanVisibility(dt);
    }

    this.world.update(dt);

    this.renderer.setFollowTarget(
      this.boat.position.x,
      this.boat.position.z,
      this.boat.velocity.x,
      this.boat.velocity.z
    );
    this.renderer.updateCamera(dt);

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
  document.getElementById('game-over-modal')?.classList.add('hidden');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-eyebrow danger"><span class="osd-rec-dot"></span> ${t('error.webgl.eyebrow')}</div>
      <h1 class="modal-title">${t('error.webgl.title')}</h1>
      <div class="modal-subtitle">${t('error.webgl.subtitle')}</div>
      <div class="rule-highlight">
        <strong>${t('error.webgl.howTo')}</strong><br>
        ${t('error.webgl.hint')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

window.addEventListener('DOMContentLoaded', () => {
  const touch = isTouchDevice();
  const updateViewportClasses = () => {
    document.body.classList.toggle('touch-device', touch);
    document.body.classList.toggle(
      'is-portrait',
      touch && window.innerHeight > window.innerWidth
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

  mountRankSprites();
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
