import * as THREE from 'three';
import { Beaver } from './Beaver.js';
import { sound } from '../systems/Audio.js';
import { BEAVER_TUNING as B } from '../config/beaver.js';
import { STREAMING_TUNING } from '../config/world.js';
import { riverZ } from '../world/Bounds.js';

const WATER_Y = -0.1; // body half submerged while swimming
const SIT_OFFSET = 0.12; // sink a little into the rock so the feet touch it

/** Same top height the smugglers use when climbing a rock (see RockField). */
const rockTopY = (rock) => {
  const size = rock.visualRadius;
  return 0.25 + size * 0.25 + size * (rock.sy ?? 0.8) * 0.85;
};

const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// One beaver: swims to a big rock, climbs it and sits. A smuggler swimming
// close to it, or climbing onto its rock, makes it jump in and flee.
class BeaverActor {
  constructor(scene, world, rock, sitting) {
    this.scene = scene;
    this.world = world;
    this.rock = rock;
    this.rockX = rock.x;
    this.rockZ = rock.z;
    this.size = rock.visualRadius;
    this.seed = Math.random() * Math.PI * 2;
    this.sfxPlayed = false;
    this.isFinished = false;

    this.model = new Beaver(scene);
    this.model.group.scale.setScalar(B.scale);
    this.group = this.model.group;

    // Sit on the side facing the nearest bank, a little off-centre.
    const bankSign = Math.sign(rock.z - riverZ(rock.x, 0)) || 1;
    this.sitAngle = (bankSign > 0 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 1.2;
    this.sitPos = new THREE.Vector3(
      rock.x + Math.sin(this.sitAngle) * this.size * 0.25,
      rockTopY(rock) - SIT_OFFSET,
      rock.z + Math.cos(this.sitAngle) * this.size * 0.25
    );
    this.heading = this.sitAngle;
    this.timer = 0;
    this.flee = null;

    if (sitting) {
      this.state = 'sit';
      this.position = this.sitPos.clone();
    } else {
      // Enter from the bank nearest the rock and swim over.
      this.state = 'swim';
      this.position = new THREE.Vector3(
        rock.x + (Math.random() - 0.5) * 12,
        WATER_Y,
        riverZ(rock.x, bankSign * 14.5)
      );
      this.world.emitSplash?.(this.position.x, this.position.z, 6, 0xdff2fc);
    }
    this.applyTransform();
  }

  /** Is this beaver's rock still the same rock (the field recycles them)? */
  rockValid() {
    const r = this.rock;
    return r.active !== false && r.visualRadius > 0 && r.x === this.rockX && r.z === this.rockZ;
  }

  scare(fromX, fromZ) {
    if (this.state === 'flee') return;
    if (this.state === 'sit' || this.state === 'climb') {
      this.position.y = WATER_Y;
      this.world.emitSplash?.(this.position.x, this.position.z, 10, 0xdff2fc);
      sound.playWildlifeDiveIn?.();
    }
    let dx = this.position.x - fromX;
    let dz = this.position.z - fromZ;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) { dx = 0; dz = Math.sign(this.sitAngle) || 1; } else { dx /= len; dz /= len; }
    // Bias away along the river, never toward the nearest rock edge.
    this.flee = { dx, dz };
    this.state = 'flee';
    this.timer = B.fleeSeconds;
  }

  swimToward(tx, tz, speed, dt) {
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-3) {
      const step = Math.min(dist, speed * dt);
      this.position.x += (dx / dist) * step;
      this.position.z += (dz / dist) * step;
      this.turnTo(Math.atan2(dx, dz), dt);
    }
    return dist;
  }

  turnTo(target, dt) {
    this.heading += wrapAngle(target - this.heading) * Math.min(1, dt * 6);
  }

  emitRipple(dt, time) {
    this.rippleTimer = (this.rippleTimer ?? 0) - dt;
    if (this.rippleTimer > 0) return;
    this.rippleTimer = 0.15 + Math.random() * 0.1;
    const bx = this.position.x - Math.sin(this.heading) * 0.8;
    const bz = this.position.z - Math.cos(this.heading) * 0.8;
    this.world.emitParticle?.(bx, 0.03, bz, 0, 0.05, 0, 0xdff2fc, 0.55, 0.4);
  }

  update(dt, time) {
    if (this.state === 'swim') {
      this.position.y = WATER_Y + Math.sin(time * 3 + this.seed) * 0.03;
      // Aim for the rock edge on the sit side, then climb.
      const ex = this.rockX + Math.sin(this.sitAngle) * (this.size + 0.5);
      const ez = this.rockZ + Math.cos(this.sitAngle) * (this.size + 0.5);
      const dist = this.swimToward(ex, ez, B.swimSpeed, dt);
      this.emitRipple(dt, time);
      if (dist < 0.4) {
        this.state = 'climb';
        this.timer = 0;
        this.climbFrom = this.position.clone();
        this.world.emitSplash?.(this.position.x, this.position.z, 4, 0xdff2fc);
      }
    } else if (this.state === 'climb') {
      this.timer += dt;
      const k = Math.min(1, this.timer / B.climbSeconds);
      const e = k * k * (3 - 2 * k);
      this.position.lerpVectors(this.climbFrom, this.sitPos, e);
      this.position.y += Math.sin(k * Math.PI) * 0.4;
      this.turnTo(Math.atan2(this.sitPos.x - this.climbFrom.x, this.sitPos.z - this.climbFrom.z), dt);
      if (k >= 1) this.state = 'sit';
    } else if (this.state === 'sit') {
      this.position.copy(this.sitPos);
      // Look out over the water, with a slow sniffing sway.
      this.turnTo(this.sitAngle + Math.sin(time * 0.6 + this.seed) * 0.35, dt);
    } else if (this.state === 'flee') {
      this.timer -= dt;
      this.position.y = WATER_Y + Math.sin(time * 5 + this.seed) * 0.03;
      this.position.x += this.flee.dx * B.swimSpeed * B.fleeSpeedMultiplier * dt;
      this.position.z += this.flee.dz * B.swimSpeed * B.fleeSpeedMultiplier * dt;
      // Stay in the channel.
      const lat = this.position.z - riverZ(this.position.x, 0);
      const lim = riverZ(this.position.x, 14.5) - riverZ(this.position.x, 0);
      if (Math.abs(lat) > Math.abs(lim)) {
        this.position.z = riverZ(this.position.x, 0) + Math.sign(lat) * Math.abs(lim);
        this.flee.dz = -Math.sign(lat) * Math.abs(this.flee.dz) * 0.3;
      }
      this.turnTo(Math.atan2(this.flee.dx, this.flee.dz), dt);
      this.emitRipple(dt, time);
      if (this.timer <= 0) {
        sound.playWildlifeDiveIn?.();
        this.world.emitSplash?.(this.position.x, this.position.z, 6, 0xdff2fc);
        this.isFinished = true;
      }
    }

    this.model.animate(time + this.seed);
    this.applyTransform();
  }

  applyTransform() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
  }

  destroy() {
    this.scene.remove(this.group);
  }
}

export class BeaverManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.beavers = [];
    this.spawnTimer = 2;
    this.time = 0;
    this.lastSfxTime = -Infinity;
  }

  reset() {
    this.beavers.forEach((b) => b.destroy());
    this.beavers = [];
    this.spawnTimer = 2;
    this.lastSfxTime = -Infinity;
  }

  spawn(boat) {
    const rocks = this.world.rockColliders;
    if (!rocks) return;
    const candidates = rocks.filter((rock) => {
      const size = rock.visualRadius ?? 0;
      if (size < B.minRockSize || rock.active === false) return false;
      const d = Math.abs(rock.x - boat.position.x);
      if (d < B.spawnMinDistance || d > B.spawnMaxDistance) return false;
      return !this.beavers.some((b) => b.rock === rock);
    });
    if (!candidates.length) return;
    const rock = candidates[Math.floor(Math.random() * candidates.length)];
    this.beavers.push(new BeaverActor(this.scene, this.world, rock, Math.random() < B.sitStartChance));
  }

  /**
   * Called when a beaver first comes into range: it counts as seen right away,
   * so it never plays again, even if the boat sits still beside it. The sound
   * itself is throttled to one per sfxThrottle seconds across all beavers, so a
   * beaver sighted during the throttle stays silent.
   */
  playSightingSound(beaver) {
    beaver.sfxPlayed = true;
    if (this.time - this.lastSfxTime < B.sfxThrottle) return;
    this.lastSfxTime = this.time;
    sound.playBeaver(B.sfxVolume);
  }

  update(dt, boat, smugglers = []) {
    if (!B.enabled) return;
    this.time += dt;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (this.beavers.length < B.maxActive) this.spawn(boat);
      this.spawnTimer = B.spawnInterval * (0.7 + Math.random() * 0.6);
    }

    for (let i = this.beavers.length - 1; i >= 0; i--) {
      const beaver = this.beavers[i];
      const farFromBoat = Math.abs(beaver.position.x - boat.position.x) > STREAMING_TUNING.despawnDistance;
      const rockGone = beaver.state !== 'flee' && !beaver.rockValid();
      if (farFromBoat || rockGone || beaver.isFinished) {
        beaver.destroy();
        this.beavers.splice(i, 1);
        continue;
      }

      // Fear: a swimming smuggler close by, or any smuggler on this beaver's rock.
      if (beaver.state !== 'flee') {
        for (const smuggler of smugglers) {
          if (smuggler.isDead) continue;
          const onRock = smuggler.rest && smuggler.rest.rock === beaver.rock;
          const dx = beaver.position.x - smuggler.position.x;
          const dz = beaver.position.z - smuggler.position.z;
          const near = smuggler.state === 'swimming' && dx * dx + dz * dz < B.fearRadius * B.fearRadius;
          if (onRock || near) {
            beaver.scare(smuggler.position.x, smuggler.position.z);
            break;
          }
        }
      }

      // Boat close: beaver call (throttled, see playSightingSound).
      if (!beaver.sfxPlayed) {
        const d = Math.hypot(beaver.position.x - boat.position.x, beaver.position.z - boat.position.z);
        if (d <= B.sfxRadius) this.playSightingSound(beaver);
      }

      beaver.update(dt, this.time);
    }
  }
}
