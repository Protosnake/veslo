import * as THREE from 'three';
import { sx, sz } from '../world/Bounds.js';
import { TUNING } from '../config/tuning.js';

const BODY_GEO = new THREE.SphereGeometry(0.2, 6, 5);
const HEAD_GEO = new THREE.SphereGeometry(0.11, 6, 5);
const BEAK_GEO = new THREE.ConeGeometry(0.05, 0.22, 4);
const TAIL_GEO = new THREE.BoxGeometry(0.3, 0.04, 0.34);

const WING_GEO = (() => {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0.16, 0, 0.02,
    -0.22, 0, 0.05,
    -0.34, 0, 0.6,
    0.16, 0, 0.02,
    -0.34, 0, 0.6,
    0.02, 0, 1.02
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
})();

const PALETTES = [
  { body: 0x2b3036, wing: 0x22262b },
  { body: 0x343a40, wing: 0x2a2f34 },
  { body: 0x1f2429, wing: 0x181c20 },
  { body: 0x3d4348, wing: 0x30353a }
].map(({ body, wing }) => ({
  body: new THREE.MeshLambertMaterial({ color: body, flatShading: true }),
  wing: new THREE.MeshLambertMaterial({
    color: wing,
    flatShading: true,
    side: THREE.DoubleSide
  })
}));

const BEAK_MAT = new THREE.MeshLambertMaterial({ color: 0xb08a3e, flatShading: true });

const STORK_BODY_MAT = new THREE.MeshLambertMaterial({ color: 0xf3efe4, flatShading: true });
const STORK_WING_MAT = new THREE.MeshLambertMaterial({
  color: 0xf3efe4,
  flatShading: true,
  side: THREE.DoubleSide
});
const STORK_TIP_MAT = new THREE.MeshLambertMaterial({
  color: 0x1c1c22,
  flatShading: true,
  side: THREE.DoubleSide
});
const STORK_BEAK_MAT = new THREE.MeshLambertMaterial({ color: 0xd14a2c, flatShading: true });
const STORK_LEG_MAT = new THREE.MeshLambertMaterial({ color: 0xc4532f, flatShading: true });

const STORK_NECK_GEO = new THREE.CylinderGeometry(0.045, 0.065, 0.55, 5);
const STORK_HEAD_GEO = new THREE.SphereGeometry(0.1, 6, 5);
const STORK_BEAK_GEO = new THREE.ConeGeometry(0.045, 0.52, 5);
const STORK_LEG_GEO = new THREE.CylinderGeometry(0.018, 0.018, 0.66, 4);

const STORK_WING_INNER_GEO = (() => {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0.18, 0, 0.02,
    -0.24, 0, 0.04,
    -0.32, 0, 0.56,
    0.18, 0, 0.02,
    -0.32, 0, 0.56,
    0.12, 0, 0.56
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
})();

const STORK_WING_TIP_GEO = (() => {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.32, 0, 0.56,
    0.12, 0, 0.56,
    -0.05, 0, 1.18
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
})();

const BOUND_X = sx(118);
const MIN_Z = -sz(22);
const MAX_Z = sz(22);

const SEARCH_PARAMS = new URLSearchParams(window.location.search);

function readDebugFlag(value) {
  if (value === null || value === undefined || value === '') return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function readNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Debug: VITE_STORK_ALWAYS_DIVE=1 (build-time) or ?storkDive=1 (per-load).
// Makes storks scan the whole play area, dive with no cooldown, and always
// swoop even when no prey is found so the behaviour is easy to verify.
export const STORK_DIVE_DEBUG =
  readDebugFlag(SEARCH_PARAMS.get('storkDive')) ||
  readDebugFlag(import.meta.env.VITE_STORK_ALWAYS_DIVE) ||
  TUNING.stork.alwaysDive;

// Stork frequency controls:
//   VITE_STORK_SPAWN_INTERVAL / ?storkSpawn=  seconds between dedicated stork
//                                              spawns (unset = normal random mix)
//   VITE_STORK_SPAWN_WEIGHT   / ?storkWeight= 0..1 chance a normal bird spawn
//                                              is a stork (default 0.14)
const STORK_SPAWN_INTERVAL_RAW =
  readNumber(SEARCH_PARAMS.get('storkSpawn')) ??
  readNumber(import.meta.env.VITE_STORK_SPAWN_INTERVAL) ??
  TUNING.stork.spawnInterval;

export const STORK_SPAWN_INTERVAL =
  STORK_SPAWN_INTERVAL_RAW !== null && STORK_SPAWN_INTERVAL_RAW > 0
    ? Math.max(0.5, STORK_SPAWN_INTERVAL_RAW)
    : null;

const STORK_SPAWN_WEIGHT_RAW =
  readNumber(SEARCH_PARAMS.get('storkWeight')) ??
  readNumber(import.meta.env.VITE_STORK_SPAWN_WEIGHT) ??
  TUNING.stork.spawnWeight;

const STORK_SPAWN_WEIGHT =
  STORK_SPAWN_WEIGHT_RAW === null
    ? TUNING.stork.spawnWeight
    : Math.min(1, Math.max(0, STORK_SPAWN_WEIGHT_RAW));

const OTHER_KIND_WEIGHTS = [
  { kind: 'single', weight: 0.34 },
  { kind: 'flock', weight: 0.32 },
  { kind: 'skein', weight: 0.2 }
];

const OTHER_WEIGHT_TOTAL = OTHER_KIND_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);

const KIND_SPAWN_WEIGHTS = [
  ...OTHER_KIND_WEIGHTS.map((entry) => ({
    kind: entry.kind,
    weight: OTHER_WEIGHT_TOTAL > 0
      ? entry.weight * ((1 - STORK_SPAWN_WEIGHT) / OTHER_WEIGHT_TOTAL)
      : 0
  })),
  { kind: 'stork', weight: STORK_SPAWN_WEIGHT }
];

function pickKind() {
  let roll = Math.random();
  for (const entry of KIND_SPAWN_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.kind;
  }
  return 'single';
}

class Bird {
  constructor(scene, palette, size, variant = 'crow') {
    this.scene = scene;
    this.variant = variant;
    this.size = size;
    this.beak = null;
    this.carriedPrey = null;
    this.group = new THREE.Group();
    this.group.scale.setScalar(size);
    this.group.rotation.order = 'YXZ';

    if (variant === 'stork') {
      this.buildStorkModel();
    } else {
      this.buildCrowModel(palette);
    }

    this.flapPhaseOffset = Math.random() * Math.PI * 2;
    this.glideSeed = Math.random() * Math.PI * 2;
    this.glideSpeed = 0.12 + Math.random() * 0.12;

    this.scene.add(this.group);
  }

  buildCrowModel(palette) {
    const body = new THREE.Mesh(BODY_GEO, palette.body);
    body.scale.set(2.2, 0.8, 1.0);
    this.group.add(body);

    const head = new THREE.Mesh(HEAD_GEO, palette.body);
    head.position.set(0.5, 0.05, 0);
    this.group.add(head);

    const beak = new THREE.Mesh(BEAK_GEO, BEAK_MAT);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.66, 0.03, 0);
    this.group.add(beak);

    const tail = new THREE.Mesh(TAIL_GEO, palette.wing);
    tail.position.set(-0.5, 0.02, 0);
    this.group.add(tail);

    this.wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.02, 0.03, side * 0.1);

      const wing = new THREE.Mesh(WING_GEO, palette.wing);
      wing.scale.z = side;
      pivot.add(wing);

      this.group.add(pivot);
      this.wings.push({ pivot, side });
    }
  }

  buildStorkModel() {
    const body = new THREE.Mesh(BODY_GEO, STORK_BODY_MAT);
    body.scale.set(2.5, 0.8, 1.0);
    this.group.add(body);

    const neck = new THREE.Mesh(STORK_NECK_GEO, STORK_BODY_MAT);
    neck.rotation.z = -Math.PI / 2;
    neck.position.set(0.52, 0.08, 0);
    this.group.add(neck);

    const head = new THREE.Mesh(STORK_HEAD_GEO, STORK_BODY_MAT);
    head.position.set(0.86, 0.1, 0);
    this.group.add(head);

    const beak = new THREE.Mesh(STORK_BEAK_GEO, STORK_BEAK_MAT);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(1.15, 0.08, 0);
    this.group.add(beak);
    this.beak = beak;

    const tail = new THREE.Mesh(TAIL_GEO, STORK_TIP_MAT);
    tail.scale.set(0.8, 1, 0.7);
    tail.position.set(-0.5, 0.02, 0);
    this.group.add(tail);

    this.wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.04, 0.05, side * 0.08);

      const inner = new THREE.Mesh(STORK_WING_INNER_GEO, STORK_WING_MAT);
      inner.scale.z = side;
      pivot.add(inner);

      const tip = new THREE.Mesh(STORK_WING_TIP_GEO, STORK_TIP_MAT);
      tip.scale.z = side;
      pivot.add(tip);

      this.group.add(pivot);
      this.wings.push({ pivot, side });
    }

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(STORK_LEG_GEO, STORK_LEG_MAT);
      leg.rotation.z = -Math.PI / 2;
      leg.position.set(-0.62, -0.1, side * 0.06);
      this.group.add(leg);
    }
  }

  setScaleFactor(factor) {
    this.group.scale.setScalar(this.size * factor);
  }

  attachPrey(creature) {
    if (!this.beak || !creature) return false;

    if (this.carriedPrey) {
      this.group.remove(this.carriedPrey.group);
      this.carriedPrey.destroy();
      this.carriedPrey = null;
    }

    const preyGroup = creature.group;
    const localScale = creature.baseScale / this.size;
    const rotation = new THREE.Euler(0, 0, 0);
    const bodyCenter = creature.type === 'frog'
      ? new THREE.Vector3(0, 0.18, 0.12)
      : new THREE.Vector3(0, 0.12, -0.2);

    preyGroup.scale.setScalar(localScale);
    preyGroup.rotation.copy(rotation);

    const offset = bodyCenter
      .multiplyScalar(localScale)
      .applyEuler(rotation);

    this.group.add(preyGroup);
    preyGroup.position.copy(this.beak.position).sub(offset);

    this.carriedPrey = creature;
    return true;
  }

  setTransform(x, y, z, yaw, roll, pitch = 0) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
    this.group.rotation.x = roll;
    this.group.rotation.z = pitch;
  }

  animate(time, flapPhase) {
    const glide = Math.sin(time * this.glideSpeed + this.glideSeed);
    const amplitude = glide > 0.55 ? 0.08 : 0.72;
    const flap = Math.sin(flapPhase + this.flapPhaseOffset) * amplitude;

    for (const { pivot, side } of this.wings) {
      pivot.rotation.x = -side * flap;
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}

// Builds one standalone bird for the dev sprite viewer. The regular spawner
// always creates birds through BirdGroup, which randomises position and speed;
// the viewer needs just the model so it can frame the bird in isolation.
export function createPreviewBird(scene, variant = 'crow') {
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  return new Bird(scene, palette, 1, variant);
}

class BirdGroup {
  constructor(scene, world, kind, dir, x, flapBase, preyManager = null) {
    this.scene = scene;
    this.world = world;
    this.kind = kind;
    this.variant = kind === 'stork' ? 'stork' : 'crow';
    this.preyManager = preyManager;
    this.dir = dir;
    this.x = x;
    this.elapsed = 0;
    this.finished = false;
    this.focusX = 0;

    const config = kind === 'stork'
      ? { minY: 7, maxY: 11, minSpeed: 5.5, maxSpeed: 7.5, minSize: 1.25, maxSize: 1.45 }
      : kind === 'single'
        ? { minY: 5, maxY: 11, minSpeed: 7.5, maxSpeed: 10.5, minSize: 0.85, maxSize: 1.1 }
        : kind === 'flock'
          ? { minY: 6, maxY: 12, minSpeed: 6.5, maxSpeed: 9, minSize: 0.6, maxSize: 0.85 }
          : { minY: 9, maxY: 14, minSpeed: 5.5, maxSpeed: 7.5, minSize: 0.7, maxSize: 0.98 };

    this.baseY = config.minY + Math.random() * (config.maxY - config.minY);
    this.baseZ = MIN_Z + Math.random() * (MAX_Z - MIN_Z);
    this.speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
    this.minSize = config.minSize;
    this.maxSize = config.maxSize;

    this.seed = Math.random() * Math.PI * 2;
    this.flapBase = flapBase;
    this.flapSpeed = kind === 'stork'
      ? 3.0 + Math.random() * 1.0
      : 4.2 + Math.random() * 1.6;

    this.isStork = kind === 'stork';
    this.diveState = 'cruise';
    this.diveTimer = 0;
    this.diveDuration = 0;
    this.diveCooldown = STORK_DIVE_DEBUG ? 0.35 : 2 + Math.random() * 4;
    this.preyScanTimer = 0;
    this.diveTarget = null;
    this.diveStartY = 0;
    this.diveZOffset = 0;
    this.scaleFactor = 1;
    this.pitch = 0;
    this.lastLeadY = null;

    this.members = [];
    this.buildMembers();
  }

  buildMembers() {
    if (this.kind === 'single' || this.kind === 'stork') {
      this.addMember(0, 0, 0);
      return;
    }

    if (this.kind === 'flock') {
      const count = 4 + Math.floor(Math.random() * 5);
      this.addMember(0, 0, 0);
      for (let i = 1; i < count; i++) {
        const back = (Math.random() - 0.35) * 9;
        const side = (Math.random() - 0.5) * 9;
        this.addMember(back, side, (Math.random() - 0.5) * 1.4);
      }
      return;
    }

    const pairs = 3 + Math.floor(Math.random() * 4);
    const backStep = 2.4;
    const sideStep = 1.35;
    this.addMember(0, 0, 0);
    for (let i = 1; i <= pairs; i++) {
      for (const side of [-1, 1]) {
        const jitter = (Math.random() - 0.5) * 0.35;
        this.addMember(
          i * backStep + jitter,
          side * i * sideStep + jitter,
          (Math.random() - 0.5) * 0.5
        );
      }
    }
  }

  addMember(back, side, yOffset) {
    const size = this.minSize + Math.random() * (this.maxSize - this.minSize);
    const bird = new Bird(
      this.scene,
      PALETTES[Math.floor(Math.random() * PALETTES.length)],
      size,
      this.variant
    );

    this.members.push({
      bird,
      back,
      side,
      yOffset,
      seed: Math.random() * Math.PI * 2,
      bobSpeed: 1.6 + Math.random() * 1.4,
      yawJitter: (Math.random() - 0.5) * 0.12,
      rollJitter: (Math.random() - 0.5) * 0.12
    });
  }

  update(dt) {
    this.elapsed += dt;
    this.x += this.dir * this.speed * dt;

    const t = this.elapsed;
    const zDrift =
      Math.sin(t * 0.22 + this.seed) * 3.0 +
      Math.sin(t * 0.53 + this.seed * 2.1) * 0.8;
    const zVelocity =
      Math.cos(t * 0.22 + this.seed) * 0.66 +
      Math.cos(t * 0.53 + this.seed * 2.1) * 0.424;
    const yDrift = Math.sin(t * 0.4 + this.seed) * 0.9;

    const leadX = this.x;
    const cruiseY = this.baseY + yDrift;
    const rawLeadZ = this.baseZ + zDrift;
    const leadY = this.isStork
      ? this.updateStork(dt, cruiseY, leadX, rawLeadZ)
      : cruiseY;
    const leadZ = rawLeadZ + (this.isStork ? this.diveZOffset : 0);
    const yaw = Math.atan2(-zVelocity, this.dir * this.speed);
    const roll = -zVelocity * 0.12 * this.dir;

    let pitch = 0;
    if (this.isStork) {
      const dtSafe = Math.max(dt, 1e-4);
      const verticalSpeed = this.lastLeadY === null ? 0 : (leadY - this.lastLeadY) / dtSafe;
      this.lastLeadY = leadY;
      const targetPitch = this.diveState === 'cruise'
        ? 0
        : THREE.MathUtils.clamp(Math.atan2(verticalSpeed, this.speed), -0.75, 0.75);
      this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-dtSafe * 9));
      pitch = this.pitch;
    }

    const flapPhase = this.flapBase + t * this.flapSpeed;
    const jitterScale = this.kind === 'skein' ? 0.35 : 1;

    for (const member of this.members) {
      const wander = Math.sin(t * 0.9 + member.seed) * 0.28 * jitterScale;
      const bob = Math.sin(t * member.bobSpeed + member.seed) * 0.14;

      const x = leadX - this.dir * member.back;
      const z = leadZ + member.side + wander;
      const y = leadY + member.yOffset + bob;

      member.bird.setTransform(
        x,
        y,
        z,
        yaw + member.yawJitter,
        roll + member.rollJitter,
        pitch
      );
      if (this.isStork) {
        member.bird.setScaleFactor(this.scaleFactor);
      }
      member.bird.animate(t, flapPhase);
    }

    if ((this.x - this.focusX) * this.dir >= BOUND_X) {
      this.finished = true;
    }
  }

  findPrey(x, z) {
    const creatures = this.preyManager?.creatures;
    if (!creatures || !creatures.length) return null;

    let best = null;
    let bestScore = Infinity;

    for (const creature of creatures) {
      if (creature.isDead || creature.isFinished || creature.isDiving) continue;

      const dx = creature.position.x - x;
      const forward = dx * this.dir;
      const minForward = STORK_DIVE_DEBUG ? 0.5 : 1.5;
      const maxForward = STORK_DIVE_DEBUG ? 14 : 16;
      if (forward < minForward || forward > maxForward) continue;

      const dz = creature.position.z - z;
      const maxSide = STORK_DIVE_DEBUG ? 40 : 14;
      if (Math.abs(dz) > maxSide) continue;

      const score = forward + Math.abs(dz) * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = creature;
      }
    }

    return best;
  }

  updateStork(dt, cruiseY, x, z) {
    this.diveCooldown -= dt;

    if (this.diveState === 'cruise') {
      this.scaleFactor = 1;
      if (this.diveCooldown > 0 || !this.preyManager) return cruiseY;

      this.preyScanTimer -= dt;
      if (this.preyScanTimer > 0) return cruiseY;
      this.preyScanTimer = STORK_DIVE_DEBUG ? 0.2 : 0.35;

      const prey = this.findPrey(x, z);
      if (!prey && !STORK_DIVE_DEBUG) return cruiseY;

      this.diveTarget = prey;
      this.diveState = 'diving';
      this.diveTimer = 0;
      this.diveStartY = cruiseY;
      this.diveZOffset = 0;

      if (prey) {
        const forward = (prey.position.x - x) * this.dir;
        const maxDuration = STORK_DIVE_DEBUG ? 3.0 : 2.5;
        this.diveDuration = THREE.MathUtils.clamp(forward / this.speed, 0.55, maxDuration);
      } else {
        this.diveDuration = 1.0;
      }

      if (STORK_DIVE_DEBUG) {
        console.log(`[STORK DEBUG] Dive at ${prey ? prey.type : 'nothing'}`, {
          x: Number(x.toFixed(1)),
          z: Number(z.toFixed(1))
        });
      }
      return cruiseY;
    }

    if (this.diveState === 'diving') {
      this.diveTimer += dt;
      const progress = Math.min(1, this.diveTimer / this.diveDuration);

      if (this.diveTarget) {
        const desiredZ = this.diveTarget.position.z - z;
        this.diveZOffset = desiredZ * progress;
      }

      if (progress >= 1) {
        this.scaleFactor = 0.55;

        if (this.world?.emitSplash) {
          this.world.emitSplash(x, z + this.diveZOffset, 10, 0xdff2fc);
        }

        if (this.diveTarget && this.preyManager) {
          const caught = this.preyManager.catchPrey(
            this.diveTarget,
            x,
            z + this.diveZOffset,
            3.5
          );
          if (caught) {
            this.members[0]?.bird.attachPrey(caught);
          }
          if (STORK_DIVE_DEBUG) {
            console.log(`[STORK DEBUG] Catch ${this.diveTarget.type}: ${caught ? 'hit' : 'missed'}`);
          }
        } else if (STORK_DIVE_DEBUG) {
          console.log('[STORK DEBUG] Splash with no prey');
        }

        this.diveTarget = null;
        this.preyScanTimer = 0;
        this.diveState = 'rising';
        this.diveTimer = 0;
        this.diveDuration = 0.9;
        return 0.35;
      }

      const eased = progress * progress;
      this.scaleFactor = 1 - 0.45 * eased;
      return THREE.MathUtils.lerp(this.diveStartY, 0.35, eased);
    }

    this.diveTimer += dt;
    const progress = Math.min(1, this.diveTimer / this.diveDuration);
    const eased = progress * (2 - progress);
    this.diveZOffset *= Math.max(0, 1 - dt * 3);
    this.scaleFactor = 0.55 + 0.45 * eased;

    if (progress >= 1) {
      this.diveZOffset = 0;
      this.scaleFactor = 1;
      this.diveState = 'cruise';
      this.diveCooldown = STORK_DIVE_DEBUG ? 1.0 : 7 + Math.random() * 8;
    }

    return THREE.MathUtils.lerp(0.35, cruiseY, eased);
  }

  destroy() {
    for (const member of this.members) {
      member.bird.destroy();
    }
    this.members = [];
  }
}

export class BirdManager {
  constructor(scene, world, preyManager = null) {
    this.scene = scene;
    this.world = world;
    this.preyManager = preyManager;
    this.groups = [];
    this.elapsed = 0;
    this.spawnTimer = 1.2;
    this.maxGroups = 5;
    this.maxStorks = STORK_SPAWN_INTERVAL !== null ? 4 : 1;
    this.storkSpawnTimer = STORK_SPAWN_INTERVAL;

    this.spawnGroup('single', true);
    this.spawnGroup('flock', true);
    if (Math.random() < 0.5) this.spawnGroup('skein', true);
    this.spawnGroup('stork', true);
  }

  reset() {
    for (const group of this.groups) group.destroy();
    this.groups = [];
    this.spawnTimer = 2.5;
    this.storkSpawnTimer = STORK_SPAWN_INTERVAL;
    this.spawnGroup('stork', true);
  }

  spawnGroup(kind = pickKind(), initial = false) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const x = this.focusX + (initial
      ? (Math.random() * 1.6 - 0.8) * BOUND_X
      : -dir * BOUND_X);

    const group = new BirdGroup(
      this.scene,
      this.world,
      kind,
      dir,
      x,
      Math.random() * Math.PI * 2,
      this.preyManager
    );
    this.groups.push(group);
    return group;
  }

  update(dt, focusX = 0) {
    this.focusX = focusX;
    this.elapsed += dt;
    this.spawnTimer -= dt;

    if (STORK_SPAWN_INTERVAL !== null && this.storkSpawnTimer !== null) {
      this.storkSpawnTimer -= dt;
      if (this.storkSpawnTimer <= 0) {
        const storks = this.groups.filter((group) => group.kind === 'stork').length;
        if (storks < this.maxStorks) {
          // Spread over the map so a configured spawn interval is immediately
          // useful for testing instead of waiting for an edge-to-edge flight.
          this.spawnGroup('stork', true);
        }
        this.storkSpawnTimer = STORK_SPAWN_INTERVAL;
      }
    }

    if (this.spawnTimer <= 0 && this.groups.length < this.maxGroups) {
      let kind = pickKind();
      const storks = this.groups.filter((group) => group.kind === 'stork').length;
      if (kind === 'stork' && storks >= this.maxStorks) {
        kind = 'single';
      }
      this.spawnGroup(kind);
      this.spawnTimer = 4 + Math.random() * 7;
    }

    for (let i = this.groups.length - 1; i >= 0; i--) {
      const group = this.groups[i];
      group.focusX = focusX;
      group.update(dt);
      if (group.finished) {
        group.destroy();
        this.groups.splice(i, 1);
      }
    }
  }
}
