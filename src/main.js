import * as THREE from 'three';
import { GameRenderer } from './core/Renderer.js';
import { RiverWorld } from './world/River.js';
import { Boat } from './entities/Boat.js';
import { SmugglerManager } from './entities/SmugglerManager.js';
import { sound } from './systems/Audio.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.state = 'MENU'; // 'MENU' | 'PLAYING' | 'GAMEOVER'

    // DOM UI elements
    this.hudScore = document.getElementById('hud-score');
    this.hudHighScore = document.getElementById('hud-high-score');
    this.hudMultiplier = document.getElementById('hud-multiplier');
    this.hudSmacked = document.getElementById('hud-smacked');
    this.slapDot = document.getElementById('slap-dot');

    this.startModal = document.getElementById('start-modal');
    this.startBtn = document.getElementById('start-btn');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverSubtitle = document.getElementById('game-over-subtitle');
    this.restartBtn = document.getElementById('restart-btn');
    this.finalScore = document.getElementById('final-score');
    this.finalSmacked = document.getElementById('final-smacked');

    // Storage
    this.highScore = parseInt(localStorage.getItem('veslo_high_score') || '0', 10);
    this.hudHighScore.textContent = this.highScore;

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
    this.animate();
  }

  initEvents() {
    // Keyboard inputs
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

    // Mouse movement to project water cursor
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
      const intersectionPoint = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.waterPlane, intersectionPoint)) {
        this.input.targetWorldPos.copy(intersectionPoint);
      }
    });

    // Mouse down / click to slap
    window.addEventListener('mousedown', (e) => {
      sound.init();
      if (e.button === 0) { // Left click
        if (this.state === 'PLAYING') {
          this.boat.triggerSlap();
        }
      }
    });

    // Buttons
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
    this.updateHUD();
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
  }

  createFloatingScore(worldPos, text, type = 'whack') {
    // Project 3D coordinate to 2D screen coordinate
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

    if (this.gameOverTitle) this.gameOverTitle.textContent = "BOAT CRASHED ON SHORE!";
    if (this.gameOverSubtitle) this.gameOverSubtitle.textContent = reason;

    // Save high score
    if (this.smugglerManager.score > this.highScore) {
      this.highScore = this.smugglerManager.score;
      localStorage.setItem('veslo_high_score', this.highScore.toString());
      this.hudHighScore.textContent = this.highScore;
    }

    this.finalScore.textContent = this.smugglerManager.score;
    this.finalSmacked.textContent = this.smugglerManager.totalSmacked;

    setTimeout(() => {
      this.gameOverModal.classList.remove('hidden');
    }, 600);
  }

  onGameOver(breachedSmuggler) {
    if (this.state !== 'PLAYING') return;
    this.state = 'GAMEOVER';
    this.renderer.triggerScreenShake(0.8);
    this.world.triggerCrowdReaction();

    if (this.gameOverTitle) this.gameOverTitle.textContent = "BORDER BREACHED!";
    if (this.gameOverSubtitle) this.gameOverSubtitle.textContent = "A smuggler reached the southern shore. Mission Failed.";

    if (breachedSmuggler && breachedSmuggler.position) {
      this.createFloatingScore(breachedSmuggler.position, "ПРОРИВ КОРДОНУ! ⚠️", "shred");
    }

    // Save high score
    if (this.smugglerManager.score > this.highScore) {
      this.highScore = this.smugglerManager.score;
      localStorage.setItem('veslo_high_score', this.highScore.toString());
      this.hudHighScore.textContent = this.highScore;
    }

    this.finalScore.textContent = this.smugglerManager.score;
    this.finalSmacked.textContent = this.smugglerManager.totalSmacked;

    setTimeout(() => {
      this.gameOverModal.classList.remove('hidden');
    }, 1200);
  }

  updateHUD() {
    this.hudScore.textContent = this.smugglerManager.score;
    this.hudSmacked.textContent = this.smugglerManager.totalSmacked;
    const mult = this.smugglerManager.getSpeedMultiplier().toFixed(1);
    this.hudMultiplier.textContent = `${mult}x`;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Slap recharge indicator dot
    if (this.slapDot) {
      if (this.boat.slapCooldown > 0 || this.boat.isSlapping) {
        this.slapDot.classList.add('recharging');
      } else {
        this.slapDot.classList.remove('recharging');
      }
    }

    if (this.state === 'PLAYING') {
      this.boat.update(dt, this.input);
      this.smugglerManager.update(dt, this.boat);
    } else {
      // Gentle idle boat bobbing when on menu
      this.boat.update(dt, { forward: false, backward: false, left: false, right: false });
    }

    this.world.update(dt);
    this.renderer.render(dt);
  }
}

// Start game instance on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
