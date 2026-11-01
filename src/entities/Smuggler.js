import * as THREE from 'three';
import { sound } from '../systems/Audio.js';
import { sx, sz } from '../world/Bounds.js';
import { DIFFICULTY_TUNING } from '../config/difficulty.js';
import { Soldier, randomSmugglerOutfit } from './Soldier.js';

// Shared geometry cache to avoid runtime allocations / memory leaks
const SHARED_GEO = {
  packBody: new THREE.BoxGeometry(0.34, 0.42, 0.2),
  packLid: new THREE.BoxGeometry(0.36, 0.12, 0.22),
  packBase: new THREE.BoxGeometry(0.3, 0.08, 0.16),
  packPocket: new THREE.BoxGeometry(0.07, 0.2, 0.14),
  packBand: new THREE.BoxGeometry(0.35, 0.035, 0.21),
  packTag: new THREE.BoxGeometry(0.09, 0.06, 0.012),
  strap: new THREE.BoxGeometry(0.055, 0.4, 0.03),
  chestStrap: new THREE.BoxGeometry(0.34, 0.05, 0.03)
};

function createBloodGeometry() {
  const baseRadius = 0.65;
  const geometry = new THREE.CircleGeometry(baseRadius, 28);
  const position = geometry.attributes.position;
  const phaseA = Math.random() * Math.PI * 2;
  const phaseB = Math.random() * Math.PI * 2;

  for (let i = 1; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const angle = Math.atan2(y, x);
    const radius = baseRadius * (
      0.9 +
      Math.sin(angle * 3 + phaseA) * 0.14 +
      Math.sin(angle * 7 + phaseB) * 0.08
    );
    position.setXY(i, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const BLOOD_GEOMETRIES = [
  createBloodGeometry(),
  createBloodGeometry(),
  createBloodGeometry()
];

const PACK_MAT = new THREE.MeshLambertMaterial({ color: 0x6b5a3e, flatShading: true });
const PACK_ACCENT_MAT = new THREE.MeshLambertMaterial({ color: 0xd8b23a, flatShading: true });
const PACK_DARK_MAT = new THREE.MeshLambertMaterial({ color: 0x4c402d, flatShading: true });
const STRAP_MAT = new THREE.MeshLambertMaterial({ color: 0x241f1a, flatShading: true });
const WILDLIFE_SCARE_RADIUS = 5;
const SMUGGLER_SEPARATION_RADIUS = 3.2;
const WILDLIFE_SCARE_DURATION = 1.5;

// Swimmer body tilt: a little back from horizontal so the head clears the water.
// cos(1.12) ≈ 0.43, sin(1.12) ≈ 0.90.
const SWIM_TILT = Math.PI / 2 - 0.45;
const SWIM_Y = -0.47;
const SWIM_Z = -0.9;
// ~30° below the body line, so the hands skim the water instead of reaching up.
const SWIM_ARM_DROP = 0.525;

// Breaststroke keyframes, one full cycle over phase 0..1. `reach` is an offset
// from PI on the shoulder X axis (PI = arms extended forward along the body),
// `spread` is the lateral shoulder/hip opening, the rest are joint bends.
const BREASTSTROKE = [
  { t: 0, spread: 0.06, reach: -0.02, elbow: 0.12, hip: 0.02, knee: 0.08, legSpread: 0.05 },
  { t: 0.22, spread: 0.95, reach: -0.18, elbow: 0.35, hip: 0.06, knee: 0.3, legSpread: 0.12 },
  { t: 0.44, spread: 0.5, reach: -0.42, elbow: 1.35, hip: 0.1, knee: 0.55, legSpread: 0.42 },
  { t: 0.62, spread: 0.18, reach: -0.12, elbow: 0.45, hip: 0.06, knee: 0.25, legSpread: 0.18 },
  { t: 0.8, spread: 0.06, reach: -0.02, elbow: 0.14, hip: 0.03, knee: 0.1, legSpread: 0.05 },
  { t: 1, spread: 0.06, reach: -0.02, elbow: 0.12, hip: 0.02, knee: 0.08, legSpread: 0.05 }
];

function sampleBreaststroke(phase) {
  const t = ((phase % 1) + 1) % 1;
  for (let i = 0; i < BREASTSTROKE.length - 1; i += 1) {
    const from = BREASTSTROKE[i];
    const to = BREASTSTROKE[i + 1];
    if (t > to.t) continue;
    const k = (t - from.t) / (to.t - from.t || 1);
    const e = k * k * (3 - 2 * k);
    const mix = (a, b) => a + (b - a) * e;
    return {
      phase: t,
      spread: mix(from.spread, to.spread),
      reach: mix(from.reach, to.reach),
      elbow: mix(from.elbow, to.elbow),
      hip: mix(from.hip, to.hip),
      knee: mix(from.knee, to.knee),
      legSpread: mix(from.legSpread, to.legSpread)
    };
  }
  return { ...BREASTSTROKE[BREASTSTROKE.length - 1], phase: t };
}

export const ESCAPE_RUN_SECONDS = 9;

export class Smuggler {
  constructor(scene, riverWorld, startX, baseSpeed, spawnDistanceOffset = 0, options = {}) {
    this.scene = scene;
    this.world = riverWorld;
    this.baseSpeed = baseSpeed;
    this.currentSpeed = baseSpeed;

    // Spawn out along the gravel road and follow it down to the reeds
    this.path = riverWorld.gravelPath;
    this.pathDistance = 0;
    this.pathOffset = 0;

    if (this.path && this.path.frameAt) {
      const spawnJitter = (Math.random() - 0.5) * 12;
      this.pathDistance = Number.isFinite(options.pathDistance)
        ? THREE.MathUtils.clamp(options.pathDistance, 0, this.path.length)
        : THREE.MathUtils.clamp(
          this.path.smugglerSpawnDistance + spawnDistanceOffset + spawnJitter,
          0,
          Math.max(0, this.path.length - 8)
        );
      this.pathOffset = Number.isFinite(options.pathOffset)
        ? options.pathOffset
        : (Math.random() - 0.5) * this.path.halfWidth * 1.1;
      const frame = this.path.frameAt(this.pathDistance);
      this.position = new THREE.Vector3(
        frame.x + frame.nx * this.pathOffset,
        frame.y,
        frame.z + frame.nz * this.pathOffset
      );
    } else {
      const startZ = sz(-20) + Math.random() * sz(1.5);
      this.position = new THREE.Vector3(startX, riverWorld.northBankY ?? 4.5, startZ);
    }
    this.walkTarget = this.position.clone();
    this.laneOffset = this.pathOffset;
    this.laneMergeDistance = this.pathDistance;
    this.waitTimer = 0;
    this.targetZ = sz(16.5);

    // AI & Smooth Movement
    this.wobbleSeed = Math.random() * 100;
    this.wobbleFreq = 1.8 + Math.random() * 1.2;
    this.isPanicking = false;
    this.sprintTimer = 0;
    this.sprintCooldown = 0;
    this.isDiving = false;
    this.diveTimer = 0;
    this.diveDepth = 0;
    this.propVulnerable = false;
    this.diveCooldown = 0;
    this.diveCount = 0;
    this.diveRecoverTimer = 0;
    this.currentHeading = Math.PI / 2; // facing south
    this.steerX = 0;
    this.steerZ = 1;
    this.wildlifeScareTimer = 0;
    this.wildlifeScareX = 0;
    this.wildlifeScareZ = 0;

    // State: walking -> hidden in reeds -> swimming
    this.state = 'walking';
    this.disembark = null;
    this.walkPhase = Math.random() * Math.PI * 2;
    // The gravel road is longer than the old river box, so hurry the walk to
    // keep the first smugglers from taking forever to reach the water.
    this.walkSpeed = this.path
      ? (4.2 + Math.random() * 0.9) * 1.75
      : 1.4 + Math.random() * 0.5;
    this.escapeSpeed = 5.5 + Math.random() * 2;
    this.escapeRunSeconds = ESCAPE_RUN_SECONDS;
    this.escapeElapsed = 0;
    this.escapedAway = false;
    this.reedLineZ = this.path ? this.path.reedLineZ : sz(-16.4);
    this.emergeZ = this.path ? this.path.emergeZ : sz(-14.7);
    this.emergeX = this.position.x;
    this.hideDelay = 0;

    this.isDead = false;
    this.deathTimer = 0;
    this.deathDuration = 0.6;
    this.deathType = 'smack'; // 'smack' | 'ram' | 'shred' | 'ak'
    this.corpseHit = false;
    this.bloodPuddle = null;
    this.reachedSouth = false;

    // One outfit per smuggler so the swimmer wears what the walker wore.
    this.outfit = randomSmugglerOutfit();
    this.swimPhase = Math.random();

    this.createModel();
  }

  createModel() {
    this.group = new THREE.Group();
    this.swimmerGroup = new THREE.Group();
    this.group.add(this.swimmerGroup);

    this.createSwimmerModel();
    this.createWalkerModel();
    this.swimmerGroup.visible = false;

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  // Head-up breaststroke: the rig is tilted (not flat) so the head clears the
  // water and the back-mounted rucksack rides above the surface.
  createSwimmerModel() {
    this.swimmerRig = new Soldier({ pose: 'idle', outfit: this.outfit });
    this.swimmerRig.group.rotation.x = SWIM_TILT;
    this.swimmerRig.group.position.set(0, SWIM_Y, SWIM_Z);
    this.swimmerGroup.add(this.swimmerRig.group);
    this.createContraband(this.swimmerRig);
    this.applySwimPose(this.swimPhase);
  }

  animateSwim(dt, rate = 1.05) {
    this.swimPhase = (this.swimPhase + dt * rate) % 1;
    this.applySwimPose(this.swimPhase);
  }

  applySwimPose(phase) {
    const pose = sampleBreaststroke(phase);
    const { left, right } = this.swimmerRig.arms;
    const legs = this.swimmerRig.legs;

    for (const arm of [left, right]) {
      arm.shoulder.rotation.x = Math.PI + pose.reach + SWIM_ARM_DROP;
      arm.shoulder.rotation.y = 0;
      arm.elbow.rotation.x = pose.elbow;
    }
    left.shoulder.rotation.z = -pose.spread;
    right.shoulder.rotation.z = pose.spread;

    for (const leg of [legs.left, legs.right]) {
      leg.hip.rotation.x = pose.hip;
      leg.knee.rotation.x = pose.knee;
    }
    legs.left.hip.rotation.z = -pose.legSpread;
    legs.right.hip.rotation.z = pose.legSpread;

    this.swimmerRig.joints.spine.rotation.x = Math.sin(pose.phase * Math.PI * 2) * 0.04;
    this.swimmerRig.joints.head.rotation.x = -0.32;
  }

  createWalkerModel() {
    this.walkerGroup = new THREE.Group();

    // Same rig as the idle soldier in a muted civilian outfit: black/olive/navy
    // cloth, no plate carrier, black cap instead of the helmet.
    this.soldier = new Soldier({ pose: 'idle', outfit: this.outfit });
    this.walkerGroup.add(this.soldier.group);

    this.createContraband();

    // Drive the shared joints from the existing walk cycle.
    this.walkLegL = this.soldier.legs.left.hip;
    this.walkLegR = this.soldier.legs.right.hip;
    this.walkArmL = this.soldier.arms.left.shoulder;
    this.walkArmR = this.soldier.arms.right.shoulder;

    this.group.add(this.walkerGroup);
  }

  // Worn rucksack on the upper back: anchored to the spine so it moves with the
  // torso instead of floating at hip height and clipping the swinging arm.
  createContraband(soldier = this.soldier) {
    const pack = new THREE.Group();

    const body = new THREE.Mesh(SHARED_GEO.packBody, PACK_MAT);
    body.castShadow = true;
    pack.add(body);

    const lid = new THREE.Mesh(SHARED_GEO.packLid, PACK_DARK_MAT);
    lid.position.y = 0.24;
    lid.castShadow = true;
    pack.add(lid);

    const base = new THREE.Mesh(SHARED_GEO.packBase, PACK_DARK_MAT);
    base.position.y = -0.24;
    base.castShadow = true;
    pack.add(base);

    for (const side of [-1, 1]) {
      const pocket = new THREE.Mesh(SHARED_GEO.packPocket, PACK_DARK_MAT);
      pocket.position.set(side * 0.2, -0.03, 0);
      pocket.castShadow = true;
      pack.add(pocket);
    }

    const band = new THREE.Mesh(SHARED_GEO.packBand, PACK_ACCENT_MAT);
    band.position.y = 0.02;
    pack.add(band);

    const tag = new THREE.Mesh(SHARED_GEO.packTag, PACK_ACCENT_MAT);
    tag.position.set(0, 0.24, -0.116);
    pack.add(tag);

    pack.position.set(0, 0.3, -0.27);
    soldier.joints.spine.add(pack);

    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(SHARED_GEO.strap, STRAP_MAT);
      strap.position.set(side * 0.14, 0.34, 0.165);
      strap.castShadow = true;
      soldier.joints.spine.add(strap);
    }

    const chestStrap = new THREE.Mesh(SHARED_GEO.chestStrap, STRAP_MAT);
    chestStrap.position.set(0, 0.5, 0.165);
    chestStrap.castShadow = true;
    soldier.joints.spine.add(chestStrap);
  }

  resolveRockCollisions(radius = 0.4) {
    const rocks = this.world?.rockColliders;
    if (!rocks || !rocks.length) return;

    for (let pass = 0; pass < 3; pass++) {
      let collided = false;

      for (let i = 0; i < rocks.length; i++) {
        const rock = rocks[i];
        const minDistance = (rock.visualRadius ?? rock.radius) + radius;
        let dx = this.position.x - rock.x;
        let dz = this.position.z - rock.z;
        let distance = Math.hypot(dx, dz);

        if (distance >= minDistance) continue;

        if (distance < 1e-4) {
          dx = 0;
          dz = 1;
          distance = 1;
        }

        this.position.x = rock.x + (dx / distance) * minDistance;
        this.position.z = rock.z + (dz / distance) * minDistance;
        collided = true;
      }

      if (!collided) break;
    }
  }

  startDive() {
    const dive = DIFFICULTY_TUNING.dive;
    this.isDiving = true;
    this.diveTimer = dive.minDuration + Math.random() * (dive.maxDuration - dive.minDuration);
    this.diveDepth = dive.minDepth + Math.random() * (dive.maxDepth - dive.minDepth);
    this.propVulnerable = this.diveDepth < dive.safeDepth;
    // Exhaustion: every consecutive dive costs more before the next one.
    this.diveCooldown = Math.min(
      dive.maxCooldown,
      dive.cooldown * dive.cooldownGrowth ** this.diveCount
    );
    this.diveCount += 1;
    this.diveRecoverTimer = 0;
    this.sprintTimer = 0;

    if (this.world.emitSplash) {
      this.world.emitSplash(this.position.x, this.position.z, 9, 0xdff2fc);
    }
  }

  endDive() {
    this.isDiving = false;
    this.diveTimer = 0;
    this.diveDepth = 0;
    this.propVulnerable = false;

    if (this.world.emitSplash) {
      this.world.emitSplash(this.position.x, this.position.z, 5, 0xdff2fc);
    }
  }

  findNearbyWildlife(wildlife) {
    if (!wildlife || !wildlife.length) return null;

    let nearest = null;
    let nearestDistanceSq = WILDLIFE_SCARE_RADIUS * WILDLIFE_SCARE_RADIUS;

    for (let i = 0; i < wildlife.length; i++) {
      const creature = wildlife[i];
      if (creature.isDead || creature.isDiving || creature.isFinished) continue;

      const dx = this.position.x - creature.position.x;
      const dz = this.position.z - creature.position.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq < nearestDistanceSq) {
        nearest = creature;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  chooseEmergeX(boat) {
    const minX = sx(-27);
    const maxX = sx(27);
    const minDistance = 15;
    const maxDistance = 24;
    const boatX = boat ? boat.position.x : 0;
    const boatZ = boat ? boat.position.z : 0;
    const preferredSide = Math.sign(-boatX) || (Math.random() > 0.5 ? 1 : -1);
    const candidates = [];

    for (let i = 0; i < 12; i++) {
      const side = i < 10 ? preferredSide : -preferredSide;
      const distance = minDistance + Math.random() * (maxDistance - minDistance);
      candidates.push({
        x: THREE.MathUtils.clamp(boatX + side * distance, minX, maxX),
        distance: 0
      });
    }

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      candidate.distance = Math.hypot(candidate.x - boatX, this.emergeZ - boatZ);
    }

    let farthest = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].distance > farthest.distance) farthest = candidates[i];
    }

    const farCandidates = candidates.filter(
      (candidate) => candidate.distance >= Math.max(minDistance, farthest.distance * 0.8)
    );
    return farCandidates[Math.floor(Math.random() * farCandidates.length)].x;
  }

  beginDisembark(startPosition, options = {}) {
    const frame = this.path && this.path.frameAt
      ? this.path.frameAt(this.pathDistance)
      : null;
    const side = options.side >= 0 ? 1 : -1;
    const headingEnd = frame ? frame.heading : 0;

    if (frame && Number.isFinite(options.exitOffset)) {
      const exitOffset = options.exitOffset;
      this.pathOffset = exitOffset;
      this.walkTarget.set(
        frame.x + frame.nx * exitOffset,
        frame.y,
        frame.z + frame.nz * exitOffset
      );
      this.laneOffset = Number.isFinite(options.laneOffset)
        ? options.laneOffset
        : exitOffset;
      this.laneMergeDistance = Number.isFinite(options.laneMergeDistance)
        ? options.laneMergeDistance
        : this.pathDistance;
    }

    this.state = 'disembarking';
    this.disembark = {
      time: -(options.delay || 0),
      duration: options.duration || 0.82,
      start: startPosition.clone(),
      side,
      headingStart: headingEnd + side * (Math.PI / 2),
      headingEnd,
      hold: options.hold || 0
    };

    this.walkerGroup.visible = true;
    this.swimmerGroup.visible = false;
    this.group.position.copy(this.disembark.start);
    this.group.rotation.set(0, this.disembark.headingStart, 0);
  }

  updateDisembark(dt) {
    const d = this.disembark;
    d.time += dt;
    if (d.time < 0) {
      this.group.position.copy(d.start);
      return;
    }

    const k = Math.min(1, d.time / d.duration);
    const eased = k * k * (3 - 2 * k);
    const target = this.walkTarget;

    this.walkPhase += dt * (6 + this.walkSpeed * 1.6);
    this.applyRunPose(Math.sin(this.walkPhase), 0.1);
    this.walkerGroup.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.05;

    this.position.set(
      THREE.MathUtils.lerp(d.start.x, target.x, eased),
      THREE.MathUtils.lerp(d.start.y, target.y, eased) + Math.sin(k * Math.PI) * 0.15,
      THREE.MathUtils.lerp(d.start.z, target.z, eased)
    );
    this.group.position.copy(this.position);

    let headingDiff = d.headingEnd - d.headingStart;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    this.group.rotation.y = d.headingStart + headingDiff * eased;

    if (k >= 1) {
      this.state = d.hold > 0 ? 'waiting' : 'walking';
      this.waitTimer = d.hold;
      this.disembark = null;
      this.position.copy(target);
      this.group.position.copy(this.position);
      this.group.rotation.set(0, d.headingEnd, 0);
      for (let i = 0; i < 3; i++) {
        this.world.emitParticle(
          target.x + (Math.random() - 0.5) * 0.4,
          target.y + 0.08,
          target.z + (Math.random() - 0.5) * 0.4,
          0,
          0.35 + Math.random() * 0.3,
          0,
          0x8d8271,
          0.6 + Math.random() * 0.4,
          0.45 + Math.random() * 0.2
        );
      }
    }
  }

  waitForDoors(dt) {
    this.waitTimer -= dt;
    this.walkPhase += dt * 2.2;
    this.walkerGroup.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.02;
    this.walkArmL.rotation.x = Math.sin(this.walkPhase) * 0.12;
    this.walkArmR.rotation.x = -Math.sin(this.walkPhase) * 0.12;
    this.soldier.legs.left.knee.rotation.x = 0.08;
    this.soldier.legs.right.knee.rotation.x = 0.08;

    if (this.waitTimer <= 0) {
      this.state = 'walking';
    }
  }

  skipDisembark() {
    if (this.state !== 'disembarking' && this.state !== 'waiting') return;
    this.state = 'walking';
    this.disembark = null;
    this.waitTimer = 0;
    this.position.copy(this.walkTarget);
    this.group.position.copy(this.position);
  }

  startSwimmingAt(x, z) {
    this.state = 'swimming';
    this.position.set(x, 0, z);
    this.emergeX = x;
    this.emergeZ = z;
    this.currentHeading = Math.PI / 2;
    this.group.visible = true;
    this.group.position.copy(this.position);
    this.group.rotation.set(0, 0, 0);
    this.swimmerGroup.visible = true;
    this.walkerGroup.visible = false;
  }

  // Natural run cycle: bent knees on the swing leg, counter-swinging bent
  // arms and a forward lean, instead of stiff straight legs.
  applyRunPose(stride, lean = 0.12, amplitude = 1) {
    const legs = this.soldier.legs;
    const arms = this.soldier.arms;
    const swing = stride * amplitude;

    legs.left.hip.rotation.x = swing * 0.75;
    legs.right.hip.rotation.x = -swing * 0.75;
    legs.left.knee.rotation.x = 0.12 + Math.max(0, -swing) * 2.0;
    legs.right.knee.rotation.x = 0.12 + Math.max(0, swing) * 2.0;
    legs.left.ankle.rotation.x = -Math.max(0, -swing) * 0.35;
    legs.right.ankle.rotation.x = -Math.max(0, swing) * 0.35;

    arms.left.shoulder.rotation.x = -swing * 0.7;
    arms.right.shoulder.rotation.x = swing * 0.7;
    arms.left.elbow.rotation.x = -0.8;
    arms.right.elbow.rotation.x = -0.8;

    this.soldier.joints.spine.rotation.x = lean + Math.abs(swing) * 0.03;
    this.soldier.joints.head.rotation.x = -lean * 0.6;
  }

  updateWalking(dt, boat) {
    this.walkPhase += dt * (4 + this.walkSpeed * 2);

    this.applyRunPose(Math.sin(this.walkPhase), 0.12);
    this.walkerGroup.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.04;

    const stepSpeed = this.walkSpeed;
    if (
      Number.isFinite(this.laneOffset) &&
      this.pathDistance >= this.laneMergeDistance
    ) {
      const laneDelta = this.laneOffset - this.pathOffset;
      if (Math.abs(laneDelta) > 0.001) {
        this.pathOffset += laneDelta * Math.min(1, dt * 2.4);
      }
    }
    const lateralOffset = this.pathOffset;
    let reachedEnd = false;

    if (this.path && this.path.frameAt) {
      let frame = this.path.frameAt(this.pathDistance);

      this.pathDistance = Math.min(this.path.length, this.pathDistance + stepSpeed * dt);
      frame = this.path.frameAt(this.pathDistance);
      this.position.set(
        frame.x + frame.nx * lateralOffset,
        frame.y,
        frame.z + frame.nz * lateralOffset
      );
      this.resolveRockCollisions();
      this.group.position.copy(this.position);
      this.group.rotation.y = frame.heading;
      reachedEnd = this.pathDistance >= this.path.length - 0.02;
    } else {
      this.position.z += stepSpeed * dt;
      this.position.y = this.world.northBankY ?? 4.5;
      this.resolveRockCollisions();
      this.group.position.copy(this.position);
      this.group.rotation.y = 0;
      reachedEnd = this.position.z >= this.reedLineZ;
    }

    if (reachedEnd) {
      this.state = 'hidden';
      this.hideDelay = 0.5 + Math.random() * 0.4;
      this.group.visible = false;
      this.walkerGroup.visible = false;
      this.world.emitParticle(
        this.position.x,
        this.position.y + 1.2,
        this.position.z,
        0,
        0.4,
        0,
        0x8ea85a,
        0.7,
        0.7
      );
    }
  }

  smack() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathType = 'smack';
    this.deathTimer = 0;
    this.deathDuration = 5;
    this.corpseHit = false;
    if (this.bloodPuddle) {
      this.scene.remove(this.bloodPuddle);
      this.bloodPuddle.material.dispose();
      this.bloodPuddle = null;
    }
    this.world.emitSplash(this.position.x, this.position.z, 22, 0xffffff);
  }

  ram() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathType = 'ram';
    this.deathTimer = 0;
    this.deathDuration = 5;
    this.corpseHit = false;
    this.world.emitSplash(this.position.x, this.position.z, 26, 0xd8eeff);
  }

  shred() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathType = 'shred';
    this.deathTimer = 0;
    this.deathDuration = 5;
    this.corpseHit = false;
    this.world.emitSplash(this.position.x, this.position.z, 36, 0xff3b4b);
    this.world.emitSplash(this.position.x, this.position.z, 20, 0xffffff);
    this.spawnBloodPuddle();
  }

  ak() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathType = 'ak';
    this.deathTimer = 0;
    this.deathDuration = 5;
    this.corpseHit = false;
    this.world.emitSplash(this.position.x, this.position.z, 18, 0xff3b4b);
    this.spawnBloodPuddle();
  }

  spawnBloodPuddle() {
    const material = new THREE.MeshBasicMaterial({
      color: 0x7a0d14,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const geometry = BLOOD_GEOMETRIES[Math.floor(Math.random() * BLOOD_GEOMETRIES.length)];
    this.bloodPuddle = new THREE.Mesh(geometry, material);
    this.bloodPuddle.rotation.x = -Math.PI / 2;
    this.bloodPuddle.position.set(this.position.x, 0.06, this.position.z);
    this.bloodPuddle.scale.setScalar(0.9);
    this.scene.add(this.bloodPuddle);
  }

  update(dt, boat, wildlife = null, smugglers = []) {
    if (this.isDead) {
      this.deathTimer += dt;
      const sinkProgress = Math.min(1, this.deathTimer / this.deathDuration);

      const bob = Math.sin(this.deathTimer * 2.4 + this.wobbleSeed) * 0.05 * (1 - sinkProgress);
      this.group.position.y = 0.08 + bob - sinkProgress * 0.95;
      this.group.rotation.z = Math.sin(this.deathTimer * 1.3 + this.wobbleSeed) * 0.12 * (1 - sinkProgress);
      if (this.bloodPuddle) {
        const grow = Math.min(1, this.deathTimer * 2.5);
        const fade = Math.min(1, Math.max(0, (this.deathDuration - this.deathTimer) / 1.2));
        this.bloodPuddle.scale.setScalar(0.9 + grow * 0.7);
        this.bloodPuddle.material.opacity = 0.75 * fade;
      }
      return;
    }

    if (this.state === 'disembarking') {
      this.updateDisembark(dt);
      return;
    }

    if (this.state === 'waiting') {
      this.waitForDoors(dt);
      return;
    }

    if (this.state === 'walking') {
      this.updateWalking(dt, boat);
      return;
    }

    if (this.state === 'hidden') {
      this.hideDelay -= dt;
      if (this.hideDelay <= 0) {
        this.emergeX = this.chooseEmergeX(boat);
        this.state = 'swimming';
        this.group.visible = true;
        this.swimmerGroup.visible = true;
        this.walkerGroup.visible = false;
        this.position.set(this.emergeX, 0, this.emergeZ);
        this.group.position.copy(this.position);
        this.group.rotation.set(0, 0, 0);
        this.world.emitSplash(this.position.x, this.position.z, 10, 0xdff2fc);
        sound.playSplash();
      }
      return;
    }

    if (this.state === 'escaping') {
      this.updateEscaping(dt);
      return;
    }

    // Detection radius and evasion
    const distToBoat = this.position.distanceTo(boat.position);
    const detectionRadius = 6.5;

    let moveX = Math.sin(this.world.time * this.wobbleFreq + this.wobbleSeed) * 0.2;
    let moveZ = 1.0;
    this.currentSpeed = this.baseSpeed;

    // Every threat contributes to one repulsion vector: the boat, nearby
    // wildlife and other swimmers. Previously wildlife overrode the boat, so a
    // snake made them ignore the hull; now they dodge everything together.
    let avoidX = 0;
    let avoidZ = 0;

    // Burst swim when the hull gets close: a short, readable dodge rather than
    // a constant speed advantage. If the hull is closing on a line that will run
    // them over, they may dive instead (and may misjudge it).
    const sprint = DIFFICULTY_TUNING.sprint;
    const dive = DIFFICULTY_TUNING.dive;

    if (this.diveCooldown > 0) this.diveCooldown = Math.max(0, this.diveCooldown - dt);
    if (this.isDiving) {
      this.diveTimer -= dt;
      if (this.diveTimer <= 0) this.endDive();
    } else if (distToBoat > dive.senseRadius * 1.5 && this.diveCount > 0) {
      // Away from the boat they get their breath back, one step at a time.
      this.diveRecoverTimer += dt;
      if (this.diveRecoverTimer >= dive.recoverySeconds) {
        this.diveRecoverTimer = 0;
        this.diveCount -= 1;
      }
    } else {
      this.diveRecoverTimer = 0;
    }

    if (!this.isDiving) {
      if (this.sprintCooldown > 0) this.sprintCooldown = Math.max(0, this.sprintCooldown - dt);
      if (this.sprintTimer > 0) this.sprintTimer = Math.max(0, this.sprintTimer - dt);

      const toX = this.position.x - boat.position.x;
      const toZ = this.position.z - boat.position.z;
      const dist = Math.hypot(toX, toZ) || 1;
      const boatSpeed = Math.hypot(boat.velocity.x, boat.velocity.z);
      const closing = (boat.velocity.x * toX + boat.velocity.z * toZ) / dist;
      const lateral =
        boatSpeed > 0.001
          ? Math.abs(boat.velocity.x * toZ - boat.velocity.z * toX) / boatSpeed
          : Infinity;
      const trapped = dist < dive.senseRadius && closing > 4 && lateral < 2.6;

      if (trapped && this.diveCooldown <= 0 && Math.random() < dive.chance) {
        this.startDive();
      } else if (distToBoat < sprint.senseRadius && this.sprintCooldown <= 0) {
        this.sprintTimer = sprint.duration;
        this.sprintCooldown = sprint.cooldown;
      }
    }

    if (distToBoat < detectionRadius) {
      this.isPanicking = true;
      const awayX = this.position.x - boat.position.x;
      const awayZ = this.position.z - boat.position.z;
      const awayDist = Math.hypot(awayX, awayZ) || 1;
      const weight = 1 + (1 - distToBoat / detectionRadius) * 0.8;

      avoidX += (awayX / awayDist) * weight;
      avoidZ += (awayZ / awayDist) * weight;
      // Gentle panic speedup (only 1.04x) so they never run away
      this.currentSpeed = this.baseSpeed * 1.04;
    } else {
      this.isPanicking = false;
    }

    const nearbyWildlife = this.findNearbyWildlife(wildlife);
    if (nearbyWildlife) {
      const awayX = this.position.x - nearbyWildlife.position.x;
      const awayZ = this.position.z - nearbyWildlife.position.z;
      const awayDist = Math.hypot(awayX, awayZ);

      if (awayDist > 0.001) {
        avoidX += (awayX / awayDist) * 1.25;
        avoidZ += (awayZ / awayDist) * 1.25;
      }

      this.wildlifeScareTimer = WILDLIFE_SCARE_DURATION;
    } else if (this.wildlifeScareTimer > 0) {
      this.wildlifeScareTimer = Math.max(0, this.wildlifeScareTimer - dt);
    }

    // Swimmers keep their distance from each other instead of stacking.
    for (const other of smugglers) {
      if (other === this || other.isDead || other.state !== 'swimming') continue;

      const awayX = this.position.x - other.position.x;
      const awayZ = this.position.z - other.position.z;
      const distanceSq = awayX * awayX + awayZ * awayZ;
      if (distanceSq <= 1e-6 || distanceSq >= SMUGGLER_SEPARATION_RADIUS ** 2) continue;

      const distance = Math.sqrt(distanceSq);
      const weight = 2.4 * (1 - distance / SMUGGLER_SEPARATION_RADIUS);
      avoidX += (awayX / distance) * weight;
      avoidZ += (awayZ / distance) * weight;
    }

    if (avoidX !== 0 || avoidZ !== 0) {
      const avoidLen = Math.hypot(avoidX, avoidZ) || 1;
      moveX = moveX * 0.25 + (avoidX / avoidLen) * 1.3;
      moveZ = moveZ * 0.25 + (avoidZ / avoidLen) * 1.3;
    }

    if (this.isDiving) {
      // Submerged: hold position. The dive is a commitment, not a free dodge.
      this.currentSpeed = 0;
    } else if (this.sprintTimer > 0) {
      this.currentSpeed *= sprint.multiplier;
    }

    // Normalize and smooth the steering: with threats pulling both ways the
    // raw vector flips frame to frame, which read as glitching in place. The
    // heading lags the desired direction, so indecision becomes a slow drift.
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.001) {
      const blend = 1 - Math.exp(-dt * 3.2);
      this.steerX += (moveX / len - this.steerX) * blend;
      this.steerZ += (moveZ / len - this.steerZ) * blend;
      const steerLen = Math.hypot(this.steerX, this.steerZ) || 1;
      this.steerX /= steerLen;
      this.steerZ /= steerLen;
      this.position.x += this.steerX * this.currentSpeed * dt;
      this.position.z += this.steerZ * this.currentSpeed * dt;
    }

    // River current advection (shared config so weather can change it later)
    if (this.world.getCurrentVelocity) {
      const current = this.world.getCurrentVelocity();
      this.position.x += current.x * dt;
      this.position.z += current.z * dt;
    }

    // Clamp inside river boundaries
    this.position.x = Math.max(sx(-36), Math.min(sx(36), this.position.x));
    this.position.y = this.isDiving
      ? -this.diveDepth + Math.sin(this.world.time * 4 + this.wobbleSeed) * 0.03
      : Math.sin(this.world.time * 4 + this.wobbleSeed) * 0.05;
    this.resolveRockCollisions();

    // Smooth heading rotation interpolation
    const targetHeading = Math.atan2(this.steerZ, this.steerX);
    let diff = targetHeading - this.currentHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.currentHeading += diff * Math.min(1, dt * 8);

    this.group.position.copy(this.position);
    this.group.rotation.y = -this.currentHeading + Math.PI / 2;

    // Breaststroke: panicked swimmers churn faster.
    const strokeRate =
      this.sprintTimer > 0 ? 2.3 : this.isPanicking || this.wildlifeScareTimer > 0 ? 1.6 : 1.05;
    this.animateSwim(dt, strokeRate);

    // Small swimming ripple trail
    if (Math.random() < 0.2) {
      this.world.emitParticle(
        this.position.x + (Math.random() - 0.5) * 0.3,
        0.04,
        this.position.z - 0.4,
        0,
        0.08,
        -0.3,
        0xdff2fc,
        0.5,
        0.35
      );
    }

    // Crossed the line: get out of the water and keep running up the beach.
    if (this.position.z >= sz(15.3) && !this.reachedSouth) {
      this.reachedSouth = true;
      this.state = 'escaping';
      this.swimmerGroup.visible = false;
      this.walkerGroup.visible = true;
      this.group.rotation.y = 0;
      this.currentHeading = Math.PI / 2;
      this.walkPhase = 0;
      this.escapeElapsed = 0;
      this.escapedAway = false;
      this.position.y = 0;
      this.group.position.copy(this.position);
    }
  }

  updateEscaping(dt) {
    if (this.escapedAway) return;

    this.escapeElapsed += dt;
    if (this.escapeElapsed >= this.escapeRunSeconds) {
      this.escapedAway = true;
      this.group.visible = false;
      return;
    }

    this.walkPhase += dt * (8 + this.escapeSpeed * 1.6);

    this.applyRunPose(Math.sin(this.walkPhase), 0.24, 1.1);
    this.walkerGroup.position.y = Math.abs(Math.sin(this.walkPhase * 2)) * 0.06;

    this.position.z += this.escapeSpeed * dt;
    this.position.x += Math.sin(this.walkPhase * 0.5 + this.wobbleSeed) * 0.25 * dt;
    this.position.y = 0;
    this.group.position.copy(this.position);
    this.group.rotation.y = 0;

    if (Math.random() < 0.18) {
      this.world.emitParticle(
        this.position.x + (Math.random() - 0.5) * 0.4,
        0.12,
        this.position.z - 0.3,
        (Math.random() - 0.5) * 0.3,
        0.3 + Math.random() * 0.3,
        -0.4,
        0x8d8271,
        0.5 + Math.random() * 0.4,
        0.5
      );
    }
  }

  destroy() {
    this.scene.remove(this.group);
    if (this.bloodPuddle) {
      this.scene.remove(this.bloodPuddle);
      this.bloodPuddle.material.dispose();
      this.bloodPuddle = null;
    }
  }
}
