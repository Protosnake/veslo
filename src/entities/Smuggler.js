import * as THREE from 'three';

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

export class Smuggler {
  constructor(scene, riverWorld, startX, baseSpeed) {
    this.scene = scene;
    this.world = riverWorld;
    this.baseSpeed = baseSpeed;
    this.currentSpeed = baseSpeed;

    this.position = new THREE.Vector3(startX, 0, -17.5);
    this.targetZ = 16.5;

    // AI & Smooth Movement
    this.wobbleSeed = Math.random() * 100;
    this.wobbleFreq = 1.8 + Math.random() * 1.2;
    this.isPanicking = false;
    this.currentHeading = Math.PI / 2; // facing south

    // State
    this.isDead = false;
    this.deathTimer = 0;
    this.deathType = 'smack'; // 'smack' | 'ram' | 'shred'
    this.reachedSouth = false;

    this.createModel();
  }

  createModel() {
    this.group = new THREE.Group();

    // 1. Swimmer Head
    this.head = new THREE.Mesh(SHARED_GEO.head, SKIN_MAT);
    this.head.position.set(0, 0.28, 0);
    this.head.castShadow = true;
    this.group.add(this.head);

    // Swimming Cap / Mask
    const capColor = CAP_COLORS[Math.floor(Math.random() * CAP_COLORS.length)];
    const capMat = new THREE.MeshLambertMaterial({ color: capColor });
    const cap = new THREE.Mesh(SHARED_GEO.cap, capMat);
    cap.position.set(0, 0.3, 0);
    this.group.add(cap);

    // Snorkel Tube
    const tube1 = new THREE.Mesh(SHARED_GEO.snorkelTube, SNORKEL_MAT);
    tube1.position.set(0.3, 0.55, -0.05);
    tube1.rotation.z = -0.2;
    this.group.add(tube1);

    const tubeTip = new THREE.Mesh(SHARED_GEO.snorkelTip, TIP_MAT);
    tubeTip.position.set(0.35, 0.8, -0.05);
    this.group.add(tubeTip);

    // 2. Contraband Bundle
    const bagColor = BAG_COLORS[Math.floor(Math.random() * BAG_COLORS.length)];
    const bagMat = new THREE.MeshLambertMaterial({ color: bagColor, flatShading: true });
    this.bag = new THREE.Mesh(SHARED_GEO.bag, bagMat);
    this.bag.position.set(0.48, 0.14, -0.45);
    this.bag.castShadow = true;
    this.group.add(this.bag);

    const tape1 = new THREE.Mesh(SHARED_GEO.tape, TAPE_MAT);
    tape1.position.set(0.48, 0.15, -0.45);
    this.group.add(tape1);

    // 3. Swimming Arms
    this.armL = new THREE.Mesh(SHARED_GEO.arm, SKIN_MAT);
    this.armL.rotation.z = Math.PI / 3;
    this.armL.position.set(-0.35, 0.12, 0.1);
    this.group.add(this.armL);

    this.armR = new THREE.Mesh(SHARED_GEO.arm, SKIN_MAT);
    this.armR.rotation.z = -Math.PI / 3;
    this.armR.position.set(0.35, 0.12, 0.1);
    this.group.add(this.armR);

    this.group.position.copy(this.position);
    this.scene.add(this.group);
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

  update(dt, boat) {
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

    // Normalize
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.001) {
      this.position.x += (moveX / len) * this.currentSpeed * dt;
      this.position.z += (moveZ / len) * this.currentSpeed * dt;
    }

    // Clamp inside river boundaries
    this.position.x = Math.max(-36, Math.min(36, this.position.x));
    this.position.y = Math.sin(this.world.time * 4 + this.wobbleSeed) * 0.05;

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
    if (this.position.z >= 15.3) {
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
