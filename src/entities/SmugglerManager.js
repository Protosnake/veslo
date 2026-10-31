import { Smuggler } from './Smuggler.js';
import { sound } from '../systems/Audio.js';
import { t } from '../systems/I18n.js';

export class SmugglerManager {
  constructor(scene, riverWorld, onScore, onGameOver) {
    this.scene = scene;
    this.world = riverWorld;
    this.onScore = onScore;
    this.onGameOver = onGameOver;

    this.smugglers = [];
    this.spawnTimer = 0;
    this.totalSmacked = 0;
    this.score = 0;
    this.isRunning = true;
  }

  reset() {
    this.smugglers.forEach((s) => s.destroy());
    this.smugglers = [];
    this.spawnTimer = 2.5; // generous initial breathing room
    this.totalSmacked = 0;
    this.score = 0;
    this.isRunning = true;
  }

  getSpeedMultiplier() {
    // Gentle progression: +2.5% speed per 100 points, capped at +60%
    return 1 + Math.min(0.6, (this.score / 100) * 0.025);
  }

  getSpawnInterval() {
    const minInterval = 2.5;
    const baseInterval = 5.5;
    const interval = baseInterval - Math.min(3.0, (this.score / 100) * 0.07);
    return Math.max(minInterval, interval);
  }

  spawnSmuggler() {
    const xPos = -26 + Math.random() * 52;
    // Base speed: 0.75 units/sec (takes ~40s to cross river, boat is 30x faster so motor reverse kills are easy!)
    const baseSpeed = 0.75 * this.getSpeedMultiplier() + (Math.random() - 0.5) * 0.1;
    const smuggler = new Smuggler(this.scene, this.world, xPos, baseSpeed);
    this.smugglers.push(smuggler);
  }

  update(dt, boat) {
    if (!this.isRunning) return;

    // Spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnSmuggler();
      this.spawnTimer = this.getSpawnInterval();
    }

    // Hitboxes
    const whackHitbox = boat.getWhackHitbox();
    const motorHitbox = boat.getMotorHitbox();
    const hullHitbox = boat.getHullHitbox();

    // Update active smugglers & check collisions
    for (let i = this.smugglers.length - 1; i >= 0; i--) {
      const s = this.smugglers[i];
      s.update(dt, boat);

      // 1-life sudden death check
      if (s.state === 'swimming' && s.reachedSouth && !s.isDead) {
        this.isRunning = false;
        sound.playGameOver();
        this.onGameOver(s);
        return;
      }

      if (!s.isDead && s.state === 'swimming') {
        // Priority 1: Oar Whack (+100 pts)
        if (whackHitbox) {
          const distWhack = Math.hypot(s.position.x - whackHitbox.center.x, s.position.z - whackHitbox.center.z);
          if (distWhack <= whackHitbox.radius) {
            s.smack();
            this.totalSmacked++;
            this.score += 100;
            sound.playSmack();
            this.onScore(100, s.position, t('score.whack'), 'whack');
            continue;
          }
        }

        // Priority 2: Outboard Engine / Propeller Chop (+500 pts!)
        const distMotor = Math.hypot(s.position.x - motorHitbox.center.x, s.position.z - motorHitbox.center.z);
        if (distMotor <= motorHitbox.radius) {
          s.shred();
          this.totalSmacked++;
          this.score += 500;
          sound.playPropellerShred();
          this.onScore(500, s.position, t('score.shred'), 'shred');
          continue;
        }

        // Priority 3: Boat Hull Ramming (+50 pts)
        const distHull = Math.hypot(s.position.x - hullHitbox.center.x, s.position.z - hullHitbox.center.z);
        if (distHull <= hullHitbox.radius) {
          s.ram();
          this.totalSmacked++;
          this.score += 50;
          sound.playRam();
          this.onScore(50, s.position, t('score.ram'), 'ram');
          continue;
        }
      }

      // Cleanup finished death animation
      if (s.isDead && s.deathTimer >= 0.6) {
        s.destroy();
        this.smugglers.splice(i, 1);
      }
    }
  }
}
