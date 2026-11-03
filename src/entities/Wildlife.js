import * as THREE from 'three';
import { sound } from '../systems/Audio.js';
import { sx, sz, riverZ } from '../world/Bounds.js';

const FROG_BODY_GEO = new THREE.SphereGeometry(0.5, 8, 6);
const FROG_HEAD_GEO = new THREE.SphereGeometry(0.3, 8, 6);
const FROG_EYE_GEO = new THREE.SphereGeometry(0.13, 7, 6);
const FROG_PUPIL_GEO = new THREE.SphereGeometry(0.07, 6, 5);
const FROG_LEG_GEO = new THREE.BoxGeometry(0.14, 0.09, 0.62);
const FROG_FOOT_GEO = new THREE.BoxGeometry(0.24, 0.06, 0.18);

const SNAKE_SEG_GEO = new THREE.SphereGeometry(0.24, 7, 6);
const SNAKE_HEAD_GEO = new THREE.SphereGeometry(0.3, 8, 6);
const SNAKE_EYE_GEO = new THREE.SphereGeometry(0.08, 6, 5);
const SNAKE_PUPIL_GEO = new THREE.SphereGeometry(0.045, 5, 4);
const SNAKE_TONGUE_GEO = new THREE.BoxGeometry(0.035, 0.02, 0.42);

const EYE_MAT = new THREE.MeshBasicMaterial({ color: 0xf4e04a });
const PUPIL_MAT = new THREE.MeshBasicMaterial({ color: 0x111111 });
const TONGUE_MAT = new THREE.MeshLambertMaterial({ color: 0xd94040 });

class WildlifeCreature {
  get startZ() { return riverZ(this.position.x, this.startLat); }
  get crossZ() { return riverZ(this.position.x, this.crossLat); }

  constructor(scene, world, type, side, x) {
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.side = side;

    // Bank lines are measured from the (bent) river centerline at the
    // creature's current X; see the startZ / crossZ getters below.
    this.startLat = side < 0 ? sz(-15.1) : sz(15.1);
    this.crossLat = side < 0 ? sz(15.1) : sz(-15.1);
    this.baseX = x;
    this.position = new THREE.Vector3(x, 0, 0);
    this.position.z = this.startZ;
    this.speed = type === 'frog' ? 2.0 + Math.random() * 0.5 : 1.35 + Math.random() * 0.35;
    this.radius = type === 'frog' ? 0.75 : 0.9;
    this.baseScale = type === 'frog' ? 0.2 : 1 / 3;
    this.wobbleSeed = Math.random() * Math.PI * 2;
    this.heading = side < 0 ? 0 : Math.PI;

    this.isDead = false;
    this.deathTimer = 0;
    this.deathDuration = 0.9;
    this.deathType = 'oar';
    this.isFinished = false;
    this.isDiving = false;
    this.diveTimer = 0;
    this.diveCooldown = 0;
    this.rippleTimer = 0;
    this.panicTimer = 0;
    this.panicDirX = 0;
    this.panicDirZ = 0;
    this.diveTarget = null;

    this.group = new THREE.Group();
    this.group.scale.setScalar(this.baseScale);
    if (type === 'frog') {
      this.createFrogModel();
    } else {
      this.createSnakeModel();
    }
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    if (world.emitSplash) {
      world.emitSplash(x, this.startZ, 8, 0xdff2fc);
    }
  }

  createFrogModel() {
    const hue = 0.26 + Math.random() * 0.06;
    const bodyMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(hue, 0.5, 0.32),
      flatShading: true
    });
    const bellyMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.16, 0.5, 0.62),
      flatShading: true
    });

    this.body = new THREE.Mesh(FROG_BODY_GEO, bodyMat);
    this.body.scale.set(1.1, 0.5, 1.3);
    this.body.position.y = 0.24;
    this.body.castShadow = true;
    this.group.add(this.body);

    const belly = new THREE.Mesh(FROG_BODY_GEO, bellyMat);
    belly.scale.set(0.82, 0.3, 0.95);
    belly.position.set(0, 0.12, 0.06);
    this.group.add(belly);

    const head = new THREE.Mesh(FROG_HEAD_GEO, bodyMat);
    head.scale.set(1.15, 0.8, 1.0);
    head.position.set(0, 0.26, 0.55);
    head.castShadow = true;
    this.group.add(head);

    this.legs = [];
    for (const sideSign of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sideSign * 0.42, 0.16, -0.45);

      const thigh = new THREE.Mesh(FROG_LEG_GEO, bodyMat);
      thigh.position.set(0, 0, -0.24);
      thigh.rotation.x = -0.18;
      thigh.castShadow = true;
      leg.add(thigh);

      const foot = new THREE.Mesh(FROG_FOOT_GEO, bodyMat);
      foot.position.set(0, -0.02, -0.56);
      leg.add(foot);
      this.legs.push(leg);
      this.group.add(leg);
    }

    for (const sideSign of [-1, 1]) {
      const eye = new THREE.Mesh(FROG_EYE_GEO, EYE_MAT);
      eye.position.set(sideSign * 0.19, 0.48, 0.65);
      this.group.add(eye);

      const pupil = new THREE.Mesh(FROG_PUPIL_GEO, PUPIL_MAT);
      pupil.position.set(sideSign * 0.19, 0.5, 0.76);
      this.group.add(pupil);
    }

    this.kickPhase = Math.random() * Math.PI * 2;
  }

  createSnakeModel() {
    const hue = 0.24 + Math.random() * 0.07;
    const bodyMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(hue, 0.42, 0.28),
      flatShading: true
    });
    const bandMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(0.14, 0.45, 0.2),
      flatShading: true
    });

    this.segments = [];
    const segmentCount = 9;
    for (let i = 0; i < segmentCount; i++) {
      const mesh = new THREE.Mesh(SNAKE_SEG_GEO, i % 2 === 0 ? bodyMat : bandMat);
      const size = 1.05 - i * 0.045;
      mesh.scale.set(size, 0.5, size * 1.25);
      mesh.castShadow = true;
      mesh.position.y = 0.12;
      this.group.add(mesh);
      this.segments.push({
        mesh,
        baseZ: 1.0 - i * 0.34,
        phase: i * 0.62
      });
    }

    this.head = new THREE.Mesh(SNAKE_HEAD_GEO, bodyMat);
    this.head.scale.set(1.15, 0.6, 1.3);
    this.head.position.set(0, 0.16, 1.32);
    this.head.castShadow = true;
    this.group.add(this.head);

    for (const sideSign of [-1, 1]) {
      const eye = new THREE.Mesh(SNAKE_EYE_GEO, EYE_MAT);
      eye.position.set(sideSign * 0.16, 0.3, 1.42);
      this.group.add(eye);

      const pupil = new THREE.Mesh(SNAKE_PUPIL_GEO, PUPIL_MAT);
      pupil.position.set(sideSign * 0.17, 0.31, 1.5);
      this.group.add(pupil);
    }

    this.tongue = new THREE.Mesh(SNAKE_TONGUE_GEO, TONGUE_MAT);
    this.tongue.position.set(0, 0.14, 1.7);
    this.group.add(this.tongue);

    this.slitherPhase = Math.random() * Math.PI * 2;
  }

  dive(avoidPoint = null) {
    if (this.isDead || this.isFinished || this.isDiving || this.diveCooldown > 0) return false;

    this.isDiving = true;
    this.diveTimer = 1.2 + Math.random() * 0.8;
    this.group.visible = false;
    this.diveTarget = null;

    if (avoidPoint) {
      const dx = this.position.x - avoidPoint.x;
      const side = Math.abs(dx) > 0.5
        ? Math.sign(dx)
        : (Math.random() < 0.5 ? -1 : 1);
      const targetX = avoidPoint.x + side * (8 + Math.random() * 3);

      const dirZ = Math.sign(this.crossZ - this.position.z) || 1;
      const zMin = Math.min(this.startZ, this.crossZ) + 0.4;
      const zMax = Math.max(this.startZ, this.crossZ) - 0.4;
      const targetZ = THREE.MathUtils.clamp(
        this.position.z + dirZ * (1.6 + Math.random() * 2.4),
        zMin,
        zMax
      );

      this.diveTarget = { x: targetX, z: targetZ };
      this.baseX = targetX;
    }

    sound.playWildlifeDiveIn();

    if (this.world.emitSplash) {
      this.world.emitSplash(this.position.x, this.position.z, 3, 0xdff2fc);
    }
    return true;
  }

  scareFrom(x, z) {
    if (this.isDead || this.isFinished || this.isDiving) return false;

    const dx = this.position.x - x;
    const dz = this.position.z - z;
    const distance = Math.hypot(dx, dz);

    if (distance > 0.001) {
      this.panicDirX = dx / distance;
      this.panicDirZ = dz / distance;
    } else {
      this.panicDirX = 0;
      this.panicDirZ = Math.sign(this.position.z - this.crossZ) || 1;
    }

    this.panicTimer = 2;
    return true;
  }

  updateDive(dt) {
    this.diveTimer -= dt;

    if (this.diveTarget) {
      const dx = this.diveTarget.x - this.position.x;
      const dz = this.diveTarget.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      const step = this.speed * 3.5 * dt;

      if (distance > step && distance > 0.001) {
        this.position.x += (dx / distance) * step;
        this.position.z += (dz / distance) * step;
      } else {
        this.position.x = this.diveTarget.x;
        this.position.z = this.diveTarget.z;
      }
    } else {
      const dirZ = Math.sign(this.crossZ - this.position.z);
      this.position.z += dirZ * this.speed * 0.35 * dt;
    }


    if (this.diveTimer <= 0) {
      if (this.diveTarget) {
        this.position.x = this.diveTarget.x;
        this.position.z = this.diveTarget.z;
        this.diveTarget = null;
      }

      this.isDiving = false;
      this.diveCooldown = 0.5;
      this.group.visible = true;
      this.group.position.set(this.position.x, 0.04, this.position.z);

      sound.playWildlifeDiveOut();

      if (this.world.emitSplash) {
        this.world.emitSplash(this.position.x, this.position.z, 3, 0xdff2fc);
      }
    }
  }

  kill(deathType) {
    if (this.isDead) return false;

    this.isDead = true;
    this.deathType = deathType;
    this.deathTimer = 0;

    if (this.world.emitSplash) {
      this.world.emitSplash(this.position.x, this.position.z, 20, 0xdff2fc);
    }
    return true;
  }

  update(dt) {
    if (this.isDead) {
      this.updateDeath(dt);
      return;
    }
    if (this.isFinished) return;

    if (this.diveCooldown > 0) {
      this.diveCooldown -= dt;
    }
    if (this.isDiving) {
      this.updateDive(dt);
      return;
    }

    this.rippleTimer -= dt;
    if (this.rippleTimer <= 0) {
      this.rippleTimer = 0.14 + Math.random() * 0.12;
      const bx = this.position.x - Math.sin(this.heading) * 0.6;
      const bz = this.position.z - Math.cos(this.heading) * 0.6;
      this.world.emitParticle(bx, 0.03, bz, 0, 0.05, 0, 0xdff2fc, 0.55, 0.4);
    }

    const time = this.world.time;
    let moveX;
    let moveZ;
    let moveSpeed = this.speed;

    if (this.panicTimer > 0) {
      this.panicTimer = Math.max(0, this.panicTimer - dt);
      moveX = this.panicDirX;
      moveZ = this.panicDirZ;
      moveSpeed *= 2;
    } else {
      const dirZ = Math.sign(this.crossZ - this.position.z);
      const targetX = this.baseX + Math.sin(time * 1.25 + this.wobbleSeed) * 2.2;
      const dx = targetX - this.position.x;
      const dz = dirZ * 1.6;
      const len = Math.hypot(dx, dz) || 1;
      moveX = dx / len;
      moveZ = dz / len;
    }

    const moveLen = Math.hypot(moveX, moveZ) || 1;
    this.position.x += (moveX / moveLen) * moveSpeed * dt;
    this.position.z += (moveZ / moveLen) * moveSpeed * dt;

    const targetHeading = Math.atan2(moveX, moveZ);
    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 5);

    this.group.position.set(
      this.position.x,
      0.04 + Math.sin(time * 3.2 + this.wobbleSeed) * 0.03,
      this.position.z
    );
    this.group.rotation.y = this.heading;

    if (this.type === 'frog') {
      this.animateFrog(dt, time);
    } else {
      this.animateSnake(dt, time);
    }

    if (Math.abs(this.position.z - this.crossZ) < 0.7) {
      this.isFinished = true;
      this.world.emitSplash(this.position.x, this.position.z, 8, 0xdff2fc);
    }
  }

  animateFrog(dt, time) {
    this.kickPhase += dt * (7 + this.speed * 2);
    const kick = Math.sin(this.kickPhase) * 0.75;
    this.legs[0].rotation.x = kick;
    this.legs[1].rotation.x = kick;
    this.body.position.y = 0.24 + Math.sin(time * 5 + this.wobbleSeed) * 0.02;
  }

  animateSnake(dt, time) {
    this.slitherPhase += dt * 4.2;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const wave = Math.sin(this.slitherPhase - seg.phase);
      seg.mesh.position.x = wave * 0.28 * (1 - i / this.segments.length);
      seg.mesh.position.z = seg.baseZ;
      seg.mesh.position.y = 0.12 + Math.cos(this.slitherPhase - seg.phase) * 0.015;
    }

    this.head.position.x = Math.sin(this.slitherPhase + 0.7) * 0.2;
    this.head.position.z = 1.32;
    this.head.position.y = 0.16 + Math.cos(this.slitherPhase + 0.7) * 0.015;

    const flick = Math.sin(time * 9 + this.wobbleSeed) > 0.65;
    this.tongue.visible = flick;
    this.tongue.position.x = this.head.position.x;
  }

  updateDeath(dt) {
    this.deathTimer += dt;
    const progress = this.deathTimer / this.deathDuration;

    this.group.rotation.x += 6 * dt;
    this.group.rotation.z += 4 * dt;
    this.group.position.y -= 1.8 * dt;
    this.group.scale.setScalar(this.baseScale * Math.max(0.01, 1 - progress));

    if (this.deathTimer >= this.deathDuration) {
      this.isFinished = true;
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}

export class Frog extends WildlifeCreature {
  constructor(scene, world, side, x) {
    super(scene, world, 'frog', side, x);
  }
}

export class Snake extends WildlifeCreature {
  constructor(scene, world, side, x) {
    super(scene, world, 'snake', side, x);
  }
}
