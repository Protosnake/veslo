import * as THREE from 'three';
import { sound } from '../systems/Audio.js';
import { sx, sz } from '../world/Bounds.js';

// Shared geometry cache to avoid runtime allocations / memory leaks
const SHARED_GEO = {
  head: new THREE.SphereGeometry(0.32, 8, 8),
  cap: new THREE.SphereGeometry(0.34, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  snorkelTube: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 5),
  snorkelTip: new THREE.BoxGeometry(0.08, 0.1, 0.12),
  bag: new THREE.BoxGeometry(0.7, 0.38, 0.9),
  tape: new THREE.BoxGeometry(0.72, 0.08, 0.2),
  arm: new THREE.CylinderGeometry(0.08, 0.08, 0.6, 5)
};

const SKIN_MAT = new THREE.MeshLambertMaterial({ color: 0xdeb887 });
const SNORKEL_MAT = new THREE.MeshLambertMaterial({ color: 0xffee00 });
const TIP_MAT = new THREE.MeshBasicMaterial({ color: 0xff3300 });
const TAPE_MAT = new THREE.MeshBasicMaterial({ color: 0xffea00 });
const CAP_COLORS = [0x222222, 0xd82b2b, 0x1e3f66, 0x5a189a];
const BAG_COLORS = [0x785633, 0x3d352e, 0x24422e];
const WILDLIFE_SCARE_RADIUS = 5;
const WILDLIFE_SCARE_DURATION = 1.5;

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
    this.currentHeading = Math.PI / 2; // facing south
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
    this.reedLineZ = this.path ? this.path.reedLineZ : sz(-16.4);
    this.emergeZ = this.path ? this.path.emergeZ : sz(-14.7);
    this.emergeX = this.position.x;
    this.hideDelay = 0;

    this.isDead = false;
    this.deathTimer = 0;
    this.deathType = 'smack'; // 'smack' | 'ram' | 'shred'
    this.reachedSouth = false;

    this.createModel();
  }

  createModel() {
    this.group = new THREE.Group();
    this.swimmerGroup = new THREE.Group();
    this.group.add(this.swimmerGroup);

    // 1. Swimmer Head
    this.head = new THREE.Mesh(SHARED_GEO.head, SKIN_MAT);
    this.head.position.set(0, 0.28, 0);
    this.head.castShadow = true;
    this.swimmerGroup.add(this.head);

    // Swimming Cap / Mask
    const capColor = CAP_COLORS[Math.floor(Math.random() * CAP_COLORS.length)];
    const capMat = new THREE.MeshLambertMaterial({ color: capColor });
    const cap = new THREE.Mesh(SHARED_GEO.cap, capMat);
    cap.position.set(0, 0.3, 0);
    this.swimmerGroup.add(cap);

    // Snorkel Tube
    const tube1 = new THREE.Mesh(SHARED_GEO.snorkelTube, SNORKEL_MAT);
    tube1.position.set(0.3, 0.55, -0.05);
    tube1.rotation.z = -0.2;
    this.swimmerGroup.add(tube1);

    const tubeTip = new THREE.Mesh(SHARED_GEO.snorkelTip, TIP_MAT);
    tubeTip.position.set(0.35, 0.8, -0.05);
    this.swimmerGroup.add(tubeTip);

    // 2. Contraband Bundle
    const bagColor = BAG_COLORS[Math.floor(Math.random() * BAG_COLORS.length)];
    const bagMat = new THREE.MeshLambertMaterial({ color: bagColor, flatShading: true });
    this.bag = new THREE.Mesh(SHARED_GEO.bag, bagMat);
    this.bag.position.set(0.48, 0.14, -0.45);
    this.bag.castShadow = true;
    this.swimmerGroup.add(this.bag);

    const tape1 = new THREE.Mesh(SHARED_GEO.tape, TAPE_MAT);
    tape1.position.set(0.48, 0.15, -0.45);
    this.swimmerGroup.add(tape1);

    // 3. Swimming Arms
    this.armL = new THREE.Mesh(SHARED_GEO.arm, SKIN_MAT);
    this.armL.rotation.z = Math.PI / 3;
    this.armL.position.set(-0.35, 0.12, 0.1);
    this.swimmerGroup.add(this.armL);

    this.armR = new THREE.Mesh(SHARED_GEO.arm, SKIN_MAT);
    this.armR.rotation.z = -Math.PI / 3;
    this.armR.position.set(0.35, 0.12, 0.1);
    this.swimmerGroup.add(this.armR);

    this.createWalkerModel();
    this.swimmerGroup.visible = false;

    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  createWalkerModel() {
    this.walkerGroup = new THREE.Group();

    const suitMat = new THREE.MeshLambertMaterial({ color: 0x1b2a24, flatShading: true });
    const bagColor = BAG_COLORS[Math.floor(Math.random() * BAG_COLORS.length)];
    const bagMat = new THREE.MeshLambertMaterial({ color: bagColor, flatShading: true });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x151515 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.32), suitMat);
    torso.position.set(0, 1.12, 0);
    torso.castShadow = true;
    this.walkerGroup.add(torso);

    const head = new THREE.Mesh(SHARED_GEO.head, SKIN_MAT);
    head.position.set(0, 1.72, 0);
    head.castShadow = true;
    this.walkerGroup.add(head);

    const cap = new THREE.Mesh(SHARED_GEO.cap, capMat);
    cap.position.set(0, 1.74, 0);
    this.walkerGroup.add(cap);

    const bag = new THREE.Mesh(SHARED_GEO.bag, bagMat);
    bag.position.set(0, 1.05, -0.3);
    bag.scale.set(0.8, 0.8, 0.7);
    bag.castShadow = true;
    this.walkerGroup.add(bag);

    this.walkLegL = new THREE.Group();
    this.walkLegL.position.set(-0.14, 0.76, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.76, 0.2), suitMat);
    legL.position.set(0, -0.38, 0);
    legL.castShadow = true;
    this.walkLegL.add(legL);
    this.walkerGroup.add(this.walkLegL);

    this.walkLegR = new THREE.Group();
    this.walkLegR.position.set(0.14, 0.76, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.76, 0.2), suitMat);
    legR.position.set(0, -0.38, 0);
    legR.castShadow = true;
    this.walkLegR.add(legR);
    this.walkerGroup.add(this.walkLegR);

    this.walkArmL = new THREE.Group();
    this.walkArmL.position.set(-0.33, 1.4, 0);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.66, 5), suitMat);
    armL.position.set(0, -0.33, 0);
    armL.castShadow = true;
    this.walkArmL.add(armL);
    this.walkerGroup.add(this.walkArmL);

    this.walkArmR = new THREE.Group();
    this.walkArmR.position.set(0.33, 1.4, 0);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.66, 5), suitMat);
    armR.position.set(0, -0.33, 0);
    armR.castShadow = true;
    this.walkArmR.add(armR);
    this.walkerGroup.add(this.walkArmR);

    this.group.add(this.walkerGroup);
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
    const stride = Math.sin(this.walkPhase);
    this.walkLegL.rotation.x = stride * 0.78;
    this.walkLegR.rotation.x = -stride * 0.78;
    this.walkArmL.rotation.x = -stride * 0.58;
    this.walkArmR.rotation.x = stride * 0.58;
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

  updateWalking(dt, boat) {
    this.walkPhase += dt * (4 + this.walkSpeed * 2);

    const stride = Math.sin(this.walkPhase);
    this.walkLegL.rotation.x = stride * 0.65;
    this.walkLegR.rotation.x = -stride * 0.65;
    this.walkArmL.rotation.x = -stride * 0.5;
    this.walkArmR.rotation.x = stride * 0.5;
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
    this.world.emitSplash(this.position.x, this.position.z, 22, 0xffffff);
  }

  ram() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathType = 'ram';
    this.deathTimer = 0;
    this.world.emitSplash(this.position.x, this.position.z, 26, 0xd8eeff);
  }

  shred() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathType = 'shred';
    this.deathTimer = 0;
    // Dramatic red/white propeller chop splashes
    this.world.emitSplash(this.position.x, this.position.z, 36, 0xff3b4b);
    this.world.emitSplash(this.position.x, this.position.z, 20, 0xffffff);
  }

  update(dt, boat, wildlife = null) {
    if (this.isDead) {
      this.deathTimer += dt;

      if (this.deathType === 'shred') {
        // Wild propeller spin & disintegration
        this.group.rotation.x += 24 * dt;
        this.group.rotation.y += 32 * dt;
        this.group.rotation.z += 28 * dt;
        this.group.position.y = -this.deathTimer * 3.5;
        const scale = Math.max(0.01, 1 - this.deathTimer * 2.2);
        this.group.scale.setScalar(scale);
      } else if (this.deathType === 'ram') {
        // Ram thud: pushed under boat and rolling back
        this.group.rotation.x += 10 * dt;
        this.group.position.y = -this.deathTimer * 2.2;
        const scale = Math.max(0.01, 1 - this.deathTimer * 1.8);
        this.group.scale.setScalar(scale);
      } else {
        // Classic cartoon oar bonk flip
        this.group.rotation.x += 14 * dt;
        this.group.rotation.y += 18 * dt;
        this.group.rotation.z += 10 * dt;
        this.group.position.y = Math.sin(this.deathTimer * 8) * 1.4 - this.deathTimer * 2.0;
        const scale = Math.max(0.01, 1 - this.deathTimer * 1.6);
        this.group.scale.setScalar(scale);
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

    // Detection radius and evasion
    const distToBoat = this.position.distanceTo(boat.position);
    const detectionRadius = 6.5;

    let moveX = Math.sin(this.world.time * this.wobbleFreq + this.wobbleSeed) * 0.2;
    let moveZ = 1.0;
    this.currentSpeed = this.baseSpeed;

    if (distToBoat < detectionRadius) {
      this.isPanicking = true;
      const awayX = this.position.x - boat.position.x;
      const awayZ = this.position.z - boat.position.z;
      const awayDist = Math.hypot(awayX, awayZ) || 1;

      const sideDodge = (awayX / awayDist) * 1.0;
      const forwardDart = Math.max(0.15, awayZ / awayDist);

      moveX += sideDodge * 0.8;
      moveZ = forwardDart * 0.8;
      // Gentle panic speedup (only 1.04x) so they never run away
      this.currentSpeed = this.baseSpeed * 1.04;

      this.armL.rotation.x = Math.sin(this.world.time * 14) * 0.7;
      this.armR.rotation.x = -Math.sin(this.world.time * 14) * 0.7;
    } else {
      this.isPanicking = false;
      this.armL.rotation.x = Math.sin(this.world.time * 6) * 0.4;
      this.armR.rotation.x = -Math.sin(this.world.time * 6) * 0.4;
    }

    const nearbyWildlife = this.findNearbyWildlife(wildlife);
    if (nearbyWildlife) {
      const awayX = this.position.x - nearbyWildlife.position.x;
      const awayZ = this.position.z - nearbyWildlife.position.z;
      const awayDist = Math.hypot(awayX, awayZ);

      if (awayDist > 0.001) {
        this.wildlifeScareX = awayX / awayDist;
        this.wildlifeScareZ = awayZ / awayDist;
      } else {
        this.wildlifeScareX = 0;
        this.wildlifeScareZ = -1;
      }

      this.wildlifeScareTimer = WILDLIFE_SCARE_DURATION;
    } else if (this.wildlifeScareTimer > 0) {
      this.wildlifeScareTimer = Math.max(0, this.wildlifeScareTimer - dt);
    }

    if (this.wildlifeScareTimer > 0) {
      moveX = this.wildlifeScareX;
      moveZ = this.wildlifeScareZ;

      this.armL.rotation.x = Math.sin(this.world.time * 14) * 0.7;
      this.armR.rotation.x = -Math.sin(this.world.time * 14) * 0.7;
    }

    // Normalize
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.001) {
      this.position.x += (moveX / len) * this.currentSpeed * dt;
      this.position.z += (moveZ / len) * this.currentSpeed * dt;
    }

    // River current advection (shared config so weather can change it later)
    if (this.world.getCurrentVelocity) {
      const current = this.world.getCurrentVelocity();
      this.position.x += current.x * dt;
      this.position.z += current.z * dt;
    }

    // Clamp inside river boundaries
    this.position.x = Math.max(sx(-36), Math.min(sx(36), this.position.x));
    this.position.y = Math.sin(this.world.time * 4 + this.wobbleSeed) * 0.05;
    this.resolveRockCollisions();

    // Smooth heading rotation interpolation
    const targetHeading = Math.atan2(moveZ, moveX);
    let diff = targetHeading - this.currentHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.currentHeading += diff * Math.min(1, dt * 8);

    this.group.position.copy(this.position);
    this.group.rotation.y = -this.currentHeading + Math.PI / 2;

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

    // Check if reached South Bank beach (fully visible on the flat shoreline!)
    if (this.position.z >= sz(15.3)) {
      this.reachedSouth = true;
      this.group.position.y = 0.35; // stands up on the beach
      this.armL.rotation.z = Math.PI / 1.5;
      this.armR.rotation.z = -Math.PI / 1.5;
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
