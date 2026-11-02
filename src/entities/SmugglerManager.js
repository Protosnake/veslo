import { Smuggler } from './Smuggler.js';
import { sound } from '../systems/Audio.js';
import { t } from '../systems/I18n.js';
import { DIFFICULTY_TUNING } from '../config/difficulty.js';
import { BREACH_TUNING, STREAMING_TUNING } from '../config/world.js';
import { rankSystem } from '../systems/RankSystem.js';
import { WORLD_CHUNK_WIDTH } from '../world/Bounds.js';

export class SmugglerManager {
  constructor(scene, riverWorld, onScore, onBreach) {
    this.scene = scene;
    this.world = riverWorld;
    this.onScore = onScore;
    this.onBreach = onBreach;

    this.smugglers = [];
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.totalSmacked = 0;
    this.score = 0;
    this.peakScore = 0;
    this.isRunning = true;
    this.whackBatch = null;
  }

  reset() {
    this.smugglers.forEach((s) => s.destroy());
    this.smugglers = [];
    this.spawnTimer = 0.7;
    this.elapsed = 0;
    this.waveCount = 0;
    this.totalSmacked = 0;
    this.score = 0;
    this.peakScore = 0;
    this.breaches = 0;
    this.isRunning = true;
    this.whackBatch = null;
  }

  getSpeedMultiplier() {
    const { gain, midpoint } = DIFFICULTY_TUNING.speed;
    return 1 + gain * (this.score / (this.score + midpoint));
  }

  /** Linear in run time (not score), so pacing is the same every run. */
  getSpawnInterval() {
    const t = DIFFICULTY_TUNING.spawn;
    const progress = Math.min(1, this.elapsed / Math.max(1, t.rampSeconds));
    const base = t.startInterval + (t.minInterval - t.startInterval) * progress;
    const wobble = 1 + (Math.random() * 2 - 1) * t.jitter;
    return base * t.intervalScale * wobble;
  }

  /** Deterministic: grows by one every `wavesPerExtra` waves up to the cap. */
  getGroupSize() {
    const t = DIFFICULTY_TUNING.spawn;
    return Math.min(t.maxGroupSize, t.startGroupSize + Math.floor(this.waveCount / t.wavesPerExtra));
  }

  getBaseSpeed() {
    // Base speed: 0.75 units/sec (takes ~40s to cross river, boat is 30x faster so motor reverse kills are easy!)
    return 0.75 * this.getSpeedMultiplier() + (Math.random() - 0.5) * 0.1;
  }

  spawnSmuggler(spawnDistanceOffset = 0, boat = null) {
    const path = this.world.gravelPath;
    const xPos = path
      ? path.x + (Math.random() - 0.5) * path.halfWidth * 1.2
      : -26 + Math.random() * 52;
    const pathShiftX = boat ? Math.round(boat.position.x / WORLD_CHUNK_WIDTH) * WORLD_CHUNK_WIDTH : 0;
    const options = { pathShiftX };
    if (boat && path && path.frameAt) {
      const point = this.pickSpawnPoint(path, boat, spawnDistanceOffset);
      if (point) Object.assign(options, point);
    }
    const smuggler = new Smuggler(
      this.scene,
      this.world,
      xPos,
      this.getBaseSpeed(),
      spawnDistanceOffset,
      options
    );
    this.smugglers.push(smuggler);
  }

  /**
   * Pick where along the (chunk-repeating) road a new swimmer starts so it is
   * between spawnMinDistance and spawnMaxDistance from the boat. Returns
   * { pathDistance, pathShiftX } or null when no road point qualifies.
   */
  pickSpawnPoint(path, boat, offset) {
    const { spawnMinDistance: minDist, spawnMaxDistance: maxDist } = STREAMING_TUNING;
    const base = Math.min(
      Math.max(0, path.length - 8),
      path.smugglerSpawnDistance + offset + (Math.random() - 0.5) * 12
    );
    const centre = Math.round(boat.position.x / WORLD_CHUNK_WIDTH);
    const valid = [];
    for (let k = -3; k <= 3; k++) {
      const shift = (centre + k) * WORLD_CHUNK_WIDTH;
      // Nearest road point to the default spawn that is in the spawn band for this copy.
      for (let i = 0; i <= 20; i++) {
        let hit = null;
        for (const d of i === 0 ? [base] : [base - i * 2, base + i * 2]) {
          if (d < 0 || d > path.length - 8) continue;
          const f = path.frameAt(d);
          const dist = Math.hypot(f.x + shift - boat.position.x, f.z - boat.position.z);
          if (dist >= minDist && dist <= maxDist) { hit = d; break; }
        }
        if (hit !== null) { valid.push({ pathDistance: hit, pathShiftX: shift }); break; }
      }
    }
    return valid.length ? valid[Math.floor(Math.random() * valid.length)] : null;
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
    this.elapsed += dt;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const groupSize = this.getGroupSize();
      let spawnDistanceOffset = 0;

      for (let i = 0; i < groupSize; i++) {
        this.spawnSmuggler(spawnDistanceOffset, boat);
        spawnDistanceOffset += 1.4 + Math.random() * 1.8;
      }

      this.waveCount += 1;
      this.spawnTimer = this.getSpawnInterval();
    }

    this.peakScore = Math.max(this.peakScore, this.score);

    // Hitboxes
    const whackHitboxes = boat.getWhackHitboxes();
    const motorHitbox = boat.getMotorHitbox();
    const hullHitbox = boat.getHullHitbox();

    // Update active smugglers & check collisions
    for (let i = this.smugglers.length - 1; i >= 0; i--) {
      const s = this.smugglers[i];

      // Streaming: beyond the sim radius a living swimmer goes dormant (hidden
      // and frozen, so it costs nothing but still feeds its proximity arrow);
      // beyond the track radius, or when dead, it is dropped with no penalty.
      if (!s.breached) {
        const away = Math.abs(s.position.x - boat.position.x);
        if (away > STREAMING_TUNING.trackDistance || (away > STREAMING_TUNING.despawnDistance && s.isDead)) {
          s.destroy();
          this.smugglers.splice(i, 1);
          continue;
        }
        if (away > STREAMING_TUNING.despawnDistance) {
          if (!s.dormant) {
            s.dormant = true;
            s.wasVisible = s.group.visible;
            s.group.visible = false;
          }
          continue;
        }
        if (s.dormant) {
          s.dormant = false;
          s.group.visible = s.wasVisible;
        }
      }

      s.update(dt, boat, wildlife, this.smugglers);

      // A smuggler reaching the south shore costs rank, not the run.
      if ((s.state === 'swimming' || s.state === 'escaping') && s.reachedSouth && !s.isDead && !s.breached) {
        s.breached = true;
        this.breaches += 1;
        const result = rankSystem.demote(this.score, BREACH_TUNING.ranksLost);
        this.score = result.score;
        sound.playGameOver();
        this.onBreach(s, result);
      }

      // Breached smugglers keep running up the beach, then vanish.
      if (s.breached) {
        if (s.escapedAway) {
          s.destroy();
          this.smugglers.splice(i, 1);
        }
        continue;
      }

      if (!s.isDead && s.state === 'swimming') {
        // Priority 1: Oar Whack (+100 pts)
        let whacked = false;
        // A shallow dive is still within oar reach; a deep one is not.
        const canWhack = !s.isDiving || s.propVulnerable;
        for (const whackHitbox of canWhack ? whackHitboxes : []) {
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
        if (distMotor <= motorHitbox.radius && (!s.isDiving || s.propVulnerable)) {
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
        if (distHull <= hullHitbox.radius && !s.isDiving) {
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
