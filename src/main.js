import * as THREE from 'three';
import { GameRenderer } from './core/Renderer.js';
import { RiverWorld } from './world/River.js';
import { Boat } from './entities/Boat.js';
import { SmugglerManager } from './entities/SmugglerManager.js';
import { sound } from './systems/Audio.js';
import { rankSystem } from './systems/RankSystem.js';
import { logger } from './systems/Logger.js';

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

    // Debug toggle button
    this.debugToggleBtn = document.getElementById('debug-toggle-btn');
    if (this.debugToggleBtn) {
      this.debugToggleBtn.addEventListener('click', () => {
        logger.toggle();
      });
    }

    // Drone viewfinder elements
    this.osd = {
      root: document.getElementById('drone-osd'),
      timecode: document.getElementById('osd-timecode'),
      headingTape: document.getElementById('osd-heading-tape'),
      headingVal: document.getElementById('osd-heading-val'),
      alt: document.getElementById('osd-alt'),
      spd: document.getElementById('osd-spd'),
      hdg: document.getElementById('osd-hdg'),
      batteryFill: document.getElementById('osd-battery-fill'),
      batteryVal: document.getElementById('osd-battery-val'),
      gps: document.getElementById('osd-gps'),
      threatCount: document.getElementById('osd-threat-count'),
      alert: document.getElementById('osd-alert')
    };

    this.missionTime = 0;
    this.battery = 100;
    this.prevThreatCount = 0;
    this.lowBatteryWarned = false;
    this.alertTimeout = null;
    this.glitchTimeout = null;
    this.buildHeadingTape();

    // Storage
    this.highScore = parseInt(localStorage.getItem('veslo_high_score') || '0', 10);

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

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Clock
    this.clock = new THREE.Clock();

    this.initEvents();
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
      sound.init();
      if (e.button === 0) {
        if (this.state === 'PLAYING') {
          this.boat.triggerSlap();
        }
      }
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
    this.showOsdAlert('UPLINK ESTABLISHED · PATROL ACTIVE', 'ok', 2.2);
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
    this.showOsdAlert('SIGNAL LOST', 'danger', 4);

    logger.log('CRASH', reason);

    if (this.gameOverTitle) this.gameOverTitle.textContent = "ЧОВЕН ВРІЗАВСЯ В БЕРЕГ!";
    if (this.gameOverSubtitle) this.gameOverSubtitle.textContent = reason;

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
    this.showOsdAlert('SIGNAL LOST', 'danger', 4);

    logger.log('BREACH', 'Smuggler reached shore!');

    if (this.gameOverTitle) this.gameOverTitle.textContent = "КОРДОН ПРОРВАНО!";
    if (this.gameOverSubtitle) this.gameOverSubtitle.textContent = "Порушник переплив річку. Місію провалено.";

    if (breachedSmuggler && breachedSmuggler.position) {
      this.createFloatingScore(breachedSmuggler.position, "ПРОРИВ КОРДОНУ! ⚠️", "shred");
    }

    this.handleGameOverRanks();

    setTimeout(() => {
      this.gameOverModal.classList.remove('hidden');
    }, 1200);
  }

  handleGameOverRanks() {
    const score = this.smugglerManager.score;
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('veslo_high_score', this.highScore.toString());
    }

    const rankInfo = rankSystem.getRankForScore(score);
    if (this.finalRankBadge) this.finalRankBadge.textContent = rankInfo.current.badge;
    if (this.finalRankTitle) this.finalRankTitle.textContent = rankInfo.current.title;
    if (this.finalRankScore) this.finalRankScore.textContent = `Фінальний рахунок: ${score} очок`;
  }

  updateHUD() {
    const score = this.smugglerManager.score;
    const rankInfo = rankSystem.getRankForScore(score);
    const progress = rankSystem.getProgress(score);

    // Update Minimalist Rank HUD
    if (this.hudRankBadge) this.hudRankBadge.textContent = rankInfo.current.badge;
    if (this.hudRankTitle) this.hudRankTitle.textContent = rankInfo.current.title;
    if (this.hudScorePill) this.hudScorePill.textContent = `${score} ОЧКІВ`;
    if (this.hudRankBar) this.hudRankBar.style.width = `${(progress * 100).toFixed(1)}%`;

    if (this.hudRankNext) {
      if (rankInfo.next) {
        this.hudRankNext.textContent = `НАСТУПНЕ ЗВАННЯ: ${rankInfo.next.title.toUpperCase()} (${rankInfo.next.minScore})`;
      } else {
        this.hudRankNext.textContent = `МАКСИМАЛЬНЕ ВІЙСЬКОВЕ ЗВАННЯ ДПСУ!`;
      }
    }

    // Check if player just reached a new rank!
    const newRank = rankSystem.checkRankUp(score);
    if (newRank) {
      sound.playAlert();
      this.showRankUpBanner(newRank);
      logger.log('RANK_UP', `Promoted to ${newRank.title}!`, { score });
    }
  }

  showRankUpBanner(rank) {
    const banner = document.createElement('div');
    banner.className = 'rank-up-popup';
    banner.innerHTML = `
      <div style="font-size: 13px; letter-spacing: 2px; color: #a4ceb2; font-weight: 800; text-transform: uppercase;">
        ПІДВИЩЕННЯ У ЗВАННІ ДПСУ!
      </div>
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 6px;">
        <span style="font-size: 36px;">${rank.badge}</span>
        <span style="font-size: 26px; font-weight: 900; color: #ffd000; letter-spacing: 1px;">${rank.title}</span>
      </div>
    `;
    document.body.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
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
    const dir = new THREE.Vector3();
    this.renderer.camera.getWorldDirection(dir);
    const deg = (Math.atan2(dir.x, -dir.z) * 180) / Math.PI;
    return (deg + 360) % 360;
  }

  updateHeadingTape(heading) {
    if (!this.osd.headingTape || !this.headingPxPerDeg) return;
    const windowWidth = 260; // matches .osd-heading-window width
    const x = windowWidth / 2 - (heading + 360) * this.headingPxPerDeg;
    this.osd.headingTape.style.transform = `translateX(${x}px)`;
  }

  updateOSD(dt) {
    if (!this.osd.root) return;
    const playing = this.state === 'PLAYING';

    if (playing) {
      this.missionTime += dt;
      this.battery = Math.max(6, this.battery - dt * 0.22);
    }

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
      this.showOsdAlert('BATTERY CRITICAL', 'danger', 2.2);
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

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.state === 'PLAYING') {
      this.boat.update(dt, this.input);
      this.smugglerManager.update(dt, this.boat);
    } else {
      this.boat.update(dt, { forward: false, backward: false, left: false, right: false });
    }

    this.world.update(dt);

    this.renderer.updateCamera(dt);

    this.updateOSD(dt);
    this.renderer.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  if (new URLSearchParams(window.location.search).has('autostart')) {
    game.startGame(); // temporary screenshot hook
  }
});
