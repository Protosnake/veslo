import { Smuggler } from './Smuggler.js';
import { sound } from '../systems/Audio.js';
import { t } from '../systems/I18n.js';
import { DIFFICULTY_TUNING } from '../config/difficulty.js';

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
    this.whackBatch = null;
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
    this.whackBatch = null;
  }

  getSpeedMultiplier() {
    const { gain, midpoint } = DIFFICULTY_TUNING.speed;
    return 1 + gain * (this.score / (this.score + midpoint));
  }

  getSpawnInterval() {
    const tuning = DIFFICULTY_TUNING.spawn;
    if (this.waveCount <= tuning.warmupWaves) {
      return tuning.warmupMin + Math.random() * (tuning.warmupMax - tuning.warmupMin);
    }

    const pressure = tuning.pressureGain * (this.score / (this.score + tuning.pressureMidpoint));
    const baseInterval = Math.max(tuning.minInterval, tuning.baseInterval - pressure * tuning.pressureDrop);
    return baseInterval * (tuning.jitterMin + Math.random() * (tuning.jitterMax - tuning.jitterMin));
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

  spawnSwimmingAt(x, z) {
    const smuggler = new Smuggler(this.scene, this.world, x, this.getBaseSpeed());
    smuggler.startSwimmingAt(x, z);
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

  findAkTarget(boat) {
    const range = 40;
    let target = null;
    let bestDistance = Infinity;

    for (const s of this.smugglers) {
      if (s.isDead || s.state !== 'swimming') continue;

      const dx = s.position.x - boat.position.x;
      const dz = s.position.z - boat.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > range || distance < 0.001) continue;

      if (distance < bestDistance) {
        bestDistance = distance;
        target = s;
      }
    }

    return target;
  }

  fireAkShot(boat) {
    const target = this.findAkTarget(boat);
    if (!target) return null;

    target.ak();
    this.totalSmacked++;
    this.onScore(0, target.position, '???', 'ak');
    return target;
  }

  update(dt, boat, wildlife = null) {
    if (!this.isRunning) return;

    this.flushWhackBatchIfReady(boat);

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
    const whackHitboxes = boat.getWhackHitboxes();
    const motorHitbox = boat.getMotorHitbox();
    const hullHitbox = boat.getHullHitbox();

    // Update active smugglers & check collisions
    for (let i = this.smugglers.length - 1; i >= 0; i--) {
      const s = this.smugglers[i];
      s.update(dt, boat, wildlife, this.smugglers);

      // 1-life sudden death check
      if ((s.state === 'swimming' || s.state === 'escaping') && s.reachedSouth && !s.isDead) {
        this.isRunning = false;
        sound.playGameOver();
        this.onGameOver(s);
        return;
      }

      if (!s.isDead && s.state === 'swimming') {
        // Priority 1: Oar Whack (+100 pts)
        let whacked = false;
        for (const whackHitbox of whackHitboxes) {
          const distWhack = Math.hypot(s.position.x - whackHitbox.center.x, s.position.z - whackHitbox.center.z);
          if (distWhack <= whackHitbox.radius) {
            s.smack();
            this.totalSmacked++;
            this.score += 100;
            sound.playSmack();
            this.addWhackBatch(s.position, 100, boat);
            whacked = true;
            break;
          }
        }
        if (whacked) continue;

        // Priority 2: Outboard Engine / Propeller Chop (+500 pts!)
        const distMotor = Math.hypot(s.position.x - motorHitbox.center.x, s.position.z - motorHitbox.center.z);
        if (distMotor <= motorHitbox.radius) {
          s.shred();
          boat.applyMotorShred();
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

      if (
        s.isDead &&
        !s.corpseHit &&
        (s.deathType === 'shred' || s.deathType === 'ak')
      ) {
        const distCorpse = Math.hypot(
          s.position.x - hullHitbox.center.x,
          s.position.z - hullHitbox.center.z
        );
        if (distCorpse <= hullHitbox.radius) {
          s.corpseHit = true;
          boat.applyRamImpact();
        }
      }

      // Cleanup finished death animation
      if (s.isDead && s.deathTimer >= s.deathDuration) {
        s.destroy();
        this.smugglers.splice(i, 1);
      }
    }
  }

  addWhackBatch(position, points, boat) {
    if (!this.whackBatch || this.whackBatch.slapId !== boat.slapId) {
      this.whackBatch = {
        slapId: boat.slapId,
        count: 0,
        points: 0,
        position: position.clone()
      };
    }
    const batch = this.whackBatch;
    batch.count += 1;
    batch.points += points;
    batch.position.copy(position);
  }

  flushWhackBatchIfReady(boat) {
    if (!this.whackBatch) return;
    if (boat.isSlapping && boat.slapId === this.whackBatch.slapId) return;
    this.flushWhackBatch();
  }

  flushWhackBatch() {
    const batch = this.whackBatch;
    if (!batch || batch.count === 0) {
      this.whackBatch = null;
      return;
    }
    this.whackBatch = null;
    this.onScore(batch.points, batch.position, '', 'whack', batch.count);
  }

  // Keep the smuggler who crossed the line running up the beach while the
  // failure camera closes in. Gameplay collisions/spawns stay frozen.
  updateEscaped(dt, boat) {
    for (const s of this.smugglers) {
      if (s.reachedSouth && !s.isDead && !s.escapedAway) s.update(dt, boat);
    }
  }
}
