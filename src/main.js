import * as THREE from 'three';
import { GameRenderer } from './core/Renderer.js';
import { RiverWorld } from './world/River.js';
import { Boat } from './entities/Boat.js';
import { SmugglerManager } from './entities/SmugglerManager.js';
import { sound } from './systems/Audio.js';
import { rankSystem } from './systems/RankSystem.js';
import { mountRankSprites, rankIconMarkup } from './systems/RankSprites.js';
import { logger } from './systems/Logger.js';
import { t, getRankTitle, onLocaleChange } from './systems/I18n.js';

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
    this.gameOverModal = document.getElementById('game-over-modal');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverSubtitle = document.getElementById('game-over-subtitle');
    this.finalRankBadge = document.getElementById('final-rank-badge');
    this.finalRankTitle = document.getElementById('final-rank-title');
    this.finalRankScore = document.getElementById('final-rank-score');
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

    // Input state
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
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
      sound.init();

      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.input.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.input.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.input.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.input.right = true;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'PLAYING') {
          this.boat.triggerSlap();
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

    this.startBtn.addEventListener('click', () => {
      sound.init();
      this.startGame();
    });

    this.restartBtn.addEventListener('click', () => {
      sound.init();
      this.restartGame();
    });
  }

  startGame() {
    this.state = 'PLAYING';
    this.startModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.boat.reset();
    this.smugglerManager.reset();
    rankSystem.reset();
    this.updateHUD();

    // Fresh drone feed for the new mission
    this.missionTime = 0;
    this.battery = 100;
    this.prevThreatCount = 0;
    this.lowBatteryWarned = false;
    this.glitchOsd(450);
    this.showOsdAlert(t('osd.alert.uplinkActive'), 'ok', 2.2);
  }

  restartGame() {
    this.startGame();
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
    this.renderer.triggerScreenShake(1.3);
    this.world.triggerCrowdReaction();
    sound.playRam();
    sound.playGameOver();
    this.glitchOsd(1400);
    this.showOsdAlert(t('osd.alert.signalLost'), 'danger', 4);

    logger.log('CRASH', reason);

    this.lastGameOver = { type: 'crash', reason };
    this.renderGameOverText();

    this.handleGameOverRanks();

    setTimeout(() => {
      this.gameOverModal.classList.remove('hidden');
    }, 600);
  }

  onGameOver(breachedSmuggler) {
    if (this.state !== 'PLAYING') return;
    this.state = 'GAMEOVER';
    this.renderer.triggerScreenShake(0.8);
    this.world.triggerCrowdReaction();
    this.glitchOsd(1400);
    this.showOsdAlert(t('osd.alert.signalLost'), 'danger', 4);

    logger.log('BREACH', 'Smuggler reached shore!');

    this.lastGameOver = { type: 'breach' };
    this.renderGameOverText();

    if (breachedSmuggler && breachedSmuggler.position) {
      this.createFloatingScore(breachedSmuggler.position, t('score.breach'), 'shred');
    }

    this.handleGameOverRanks();

    setTimeout(() => {
      this.gameOverModal.classList.remove('hidden');
    }, 1200);
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

    clearTimeout(this.rankUpTimer);
    this.rankUpTimer = setTimeout(() => {
      banner.classList.remove('is-visible');
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
    this.osd.headingTape.style.transform = `translateX(${x}px)`;
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

    const heading = this.getCameraHeading();
    const headingText = String(Math.round(heading) % 360).padStart(3, '0');
    if (this.osd.hdg) this.osd.hdg.textContent = headingText;
    if (this.osd.headingVal) this.osd.headingVal.textContent = `${headingText}°`;
    this.updateHeadingTape(heading);

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

    if (this.state === 'PLAYING') {
      this.missionTime += dt;
      this.battery = Math.max(6, this.battery - dt * 0.22);
      this.boat.update(dt, this.input);
      this.smugglerManager.update(dt, this.boat);
    } else {
      this.boat.update(dt, this.idleInput);
    }

    this.world.update(dt);

    this.renderer.updateCamera(dt);

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
