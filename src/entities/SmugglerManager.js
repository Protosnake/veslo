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
    this.spawnTimer = 0.7;
    this.firstWave = true;
    this.waveCount = 0;
    this.totalSmacked = 0;
    this.score = 0;
    this.isRunning = true;
  }

  getSpeedMultiplier() {
    // Gentle progression: +2.5% speed per 100 points, capped at +60%
    return 1 + Math.min(0.6, (this.score / 100) * 0.025);
  }

  getSpawnInterval() {
    if (this.waveCount <= 2) return 9 + Math.random() * 4;

    const pressure = Math.min(1, this.score / 1400);
    const baseInterval = 7.5 - pressure * 3.5;
    return baseInterval * (0.7 + Math.random() * 0.6);
  }

  getGroupSize() {
    const roll = Math.random();

    if (this.waveCount <= 2) return 1;
    if (this.waveCount <= 4) return roll < 0.6 ? 1 : 2;
    if (this.waveCount <= 6) {
      if (roll < 0.45) return 1;
      if (roll < 0.75) return 2;
      return 3;
    }

    if (roll < 0.35) return 1;
    if (roll < 0.65) return 2;
    if (roll < 0.85) return 3;
    return 4;
  }

  getBaseSpeed() {
    // Base speed: 0.75 units/sec (takes ~40s to cross river, boat is 30x faster so motor reverse kills are easy!)
    return 0.75 * this.getSpeedMultiplier() + (Math.random() - 0.5) * 0.1;
  }

  spawnSmuggler(spawnDistanceOffset = 0) {
    const path = this.world.gravelPath;
    const xPos = path
      ? path.x + (Math.random() - 0.5) * path.halfWidth * 1.2
      : -26 + Math.random() * 52;
    const smuggler = new Smuggler(
      this.scene,
      this.world,
      xPos,
      this.getBaseSpeed(),
      spawnDistanceOffset
    );
    this.smugglers.push(smuggler);
  }

  spawnSmugglerAt(pathDistance, pathOffset = 0) {
    const path = this.world.gravelPath;
    const frame = path && path.frameAt ? path.frameAt(pathDistance) : null;
    const smuggler = new Smuggler(
      this.scene,
      this.world,
      frame ? frame.x : 0,
      this.getBaseSpeed(),
      0,
      { pathDistance, pathOffset }
    );
    this.smugglers.push(smuggler);
    return smuggler;
  }

  updateIntro(dt, boat) {
    for (const smuggler of this.smugglers) {
      smuggler.update(dt, boat);
    }
  }

  beginAfterIntro() {
    this.firstWave = false;
    this.waveCount = Math.max(this.waveCount, 1);
    this.spawnTimer = 3 + Math.random() * 2;
  }

  update(dt, boat, wildlife = null) {
    if (!this.isRunning) return;

    // Spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const groupSize = this.firstWave ? 1 : this.getGroupSize();
      this.firstWave = false;
      let spawnDistanceOffset = 0;

      for (let i = 0; i < groupSize; i++) {
        this.spawnSmuggler(spawnDistanceOffset);
        spawnDistanceOffset += 1.4 + Math.random() * 1.8;
      }

      this.waveCount += 1;
      this.spawnTimer = this.getSpawnInterval();
    }

    // Hitboxes
    const whackHitbox = boat.getWhackHitbox();
    const motorHitbox = boat.getMotorHitbox();
    const hullHitbox = boat.getHullHitbox();

    // Update active smugglers & check collisions
    for (let i = this.smugglers.length - 1; i >= 0; i--) {
      const s = this.smugglers[i];
      s.update(dt, boat, wildlife);

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
          boat.applyRamImpact();
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
