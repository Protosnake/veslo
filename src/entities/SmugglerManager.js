import { Smuggler } from './Smuggler.js';
import { sound } from '../systems/Audio.js';
import { t } from '../systems/I18n.js';
import { DIFFICULTY_TUNING } from '../config/difficulty.js';
import { BREACH_TUNING, STREAMING_TUNING } from '../config/world.js';
import { rankSystem } from '../systems/RankSystem.js';
import { WORLD_CHUNK_WIDTH } from '../world/Bounds.js';
import { tide } from '../systems/TideSystem.js';
import { TIDE_TUNING } from '../config/world.js';

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
    this.idleTimer = 0;
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
    return (0.75 * this.getSpeedMultiplier() + (Math.random() - 0.5) * 0.1) * DIFFICULTY_TUNING.swim.speedScale;
  }

  spawnSmuggler(spawnDistanceOffset = 0, boat = null) {
    const path = this.world.gravelPath;
    const xPos = path
      ? path.x + (Math.random() - 0.5) * path.halfWidth * 1.2
      : -26 + Math.random() * 52;
    const pathShiftX = boat ? Math.round(boat.position.x / WORLD_CHUNK_WIDTH) * WORLD_CHUNK_WIDTH : 0;
    const options = { pathShiftX, groupId: this.waveCount };
    if (boat && path && path.frameAt) {
      const point = this.pickSpawnPoint(path, boat, spawnDistanceOffset);
      if (!point) return false; // nothing ahead of the nose right now
      Object.assign(options, point);
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
    return true;
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
          const f = path.frameAt(d, shift);
          const dist = Math.hypot(f.x - boat.position.x, f.z - boat.position.z);
          if (dist >= minDist && dist <= maxDist) { hit = d; break; }
        }
        if (hit !== null) { valid.push({ pathDistance: hit, pathShiftX: shift }); break; }
      }
    }
    if (!valid.length) return null;
    // Prefer road copies in the half-plane the boat is heading toward (forward = (cos a, -sin a) in x/z).
    // "Ahead" is measured from the boat's nose (not its velocity), so a
    // stationary boat still gets swimmers in front of it. Only the cone in
    // front of the nose counts; with no qualifying road point there is no
    // spawn (the caller retries shortly) rather than a fallback behind.
    const fx = Math.cos(boat.angle || 0);
    const fz = -Math.sin(boat.angle || 0);
    const cosCone = Math.cos((Math.min(90, Math.max(1, STREAMING_TUNING.spawnAheadConeDeg)) * Math.PI) / 180);
    if (TIDE_TUNING.enabled) {
      // Tide: only the side the tide dictates, whichever way the boat faces.
      const side = valid.filter((v) => (path.frameAt(v.pathDistance, v.pathShiftX).x - boat.position.x) * tide.direction > 0);
      return side.length ? side[Math.floor(Math.random() * side.length)] : null;
    }
    const ahead = [];
    const behind = [];
    for (const v of valid) {
      const f = path.frameAt(v.pathDistance, v.pathShiftX);
      const dx = f.x - boat.position.x;
      const dz = f.z - boat.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      ((dx * fx + dz * fz) / dist >= cosCone ? ahead : behind).push(v);
    }
    const preferAhead = Math.random() < STREAMING_TUNING.spawnAheadBias;
    const pool = preferAhead ? ahead : behind;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
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

  spawnSwimmingAt(x, z, groupId = null) {
    const smuggler = new Smuggler(this.scene, this.world, x, this.getBaseSpeed(), 0, { groupId });
    smuggler.startSwimmingAt(x, z);
    this.smugglers.push(smuggler);
    return smuggler;
  }

  updateIntro(dt, boat) {
    for (const smuggler of this.smugglers) {
      smuggler.update(dt, boat);
    }
  }

  beginAfterIntro(boat = null) {
    tide.reset(boat ? Math.cos(boat.angle || 0) : 1);
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

  /**
   * Group-mates of a fresh kill may panic: chance falls linearly with
   * distance (baseChance at 0, none at `radius`) and is multiplied for a
   * rotor kill. Panicked swimmers bolt away and leave a yellow puddle.
   */
  scareGroup(victim, byRotor = false) {
    if (victim.groupId == null) return;
    const f = DIFFICULTY_TUNING.fright;
    const mult = byRotor ? f.rotorMultiplier : 1;
    for (const s of this.smugglers) {
      if (s === victim || s.isDead || s.groupId !== victim.groupId) continue;
      const d = Math.hypot(s.position.x - victim.position.x, s.position.z - victim.position.z);
      if (d >= f.radius) continue;
      const chance = f.baseChance * (1 - d / f.radius) * mult;
      if (Math.random() < chance) s.frighten(victim.position.x, victim.position.z);
    }
  }

  fireAkShot(boat) {
    const target = this.findAkTarget(boat);
    if (!target) return null;

    target.ak();
    this.scareGroup(target);
    this.totalSmacked++;
    this.onScore(0, target.position, '???', 'ak');
    return target;
  }

  /** Fires the next wave early when no live swimmer has been near the boat for a while. */
  updateIdleCatchUp(dt, boat) {
    const { idleRange, idleSeconds } = DIFFICULTY_TUNING.spawn;
    if (idleSeconds <= 0 || this.spawnTimer <= 0) return;
    const nearby = this.smugglers.some(
      (s) => !s.isDead && !s.reachedSouth && Math.hypot(s.position.x - boat.position.x, s.position.z - boat.position.z) <= idleRange
    );
    this.idleTimer = nearby ? 0 : (this.idleTimer || 0) + dt;
    if (this.idleTimer >= idleSeconds) {
      this.spawnTimer = 0;
      this.idleTimer = 0;
    }
  }

  update(dt, boat, wildlife = null) {
    if (!this.isRunning) return;

    this.flushWhackBatchIfReady(boat);

    // Spawn timer
    this.elapsed += dt;
    tide.update(dt);
    this.spawnTimer -= dt;
    this.updateIdleCatchUp(dt, boat);
    if (this.spawnTimer <= 0) {
      const alive = this.smugglers.reduce((n, s) => n + (s.isDead ? 0 : 1), 0);
      // Never exceed the alive cap: trim the group, or skip the wave when full.
      const groupSize = Math.min(this.getGroupSize(), Math.max(0, DIFFICULTY_TUNING.spawn.maxAlive - alive));
      let spawnDistanceOffset = 0;

      let spawned = 0;
      for (let i = 0; i < groupSize; i++) {
        if (this.spawnSmuggler(spawnDistanceOffset, boat)) spawned++;
        spawnDistanceOffset += 1.4 + Math.random() * 1.8;
      }

      if (groupSize > 0 && spawned === 0) {
        // No road point ahead of the nose is in the spawn band yet: retry soon.
        this.spawnTimer = 1;
      } else {
        this.waveCount += 1;
        this.spawnTimer = this.getSpawnInterval();
      }
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

      // Scared swimmers that made it back to their start bank just leave (no penalty).
      if (s.retreated) {
        s.destroy();
        this.smugglers.splice(i, 1);
        continue;
      }

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
            this.scareGroup(s);
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
        if (distMotor <= motorHitbox.radius && s.stunTimer <= 0 && (!s.isDiving || s.propVulnerable)) {
          s.shred();
          this.scareGroup(s, true);
          boat.applyMotorShred();
          this.totalSmacked++;
          this.score += 500;
          sound.playPropellerShred();
          this.onScore(500, s.position, t('score.shred'), 'shred');
          continue;
        }

        // Priority 3a: second ram on a floating stunned swimmer drowns him (+100)
        if (
          s.stunTimer > 0 &&
          !s.stunSubmerged &&
          Math.hypot(s.position.x - hullHitbox.center.x, s.position.z - hullHitbox.center.z) <= hullHitbox.radius
        ) {
          s.drown();
          this.scareGroup(s);
          boat.applyRamImpact();
          sound.playRam();
          this.totalSmacked++;
          this.score += 100;
          this.onScore(100, s.position, t('score.drown'), 'drown');
          continue;
        }

        // Priority 3: Boat Hull Ramming (stun only, no points)
        const distHull = Math.hypot(s.position.x - hullHitbox.center.x, s.position.z - hullHitbox.center.z);
        if (distHull <= hullHitbox.radius && !s.isDiving && s.stunTimer <= 0) {
          s.ram();
          this.scareGroup(s);
          boat.applyRamImpact();
          sound.playRam();
          this.onScore(0, s.position, t('score.ram'), 'ram');
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
