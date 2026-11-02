import * as THREE from 'three';
import { ROCK_TUNING } from '../config/world.js';

// Rock clusters scattered at random along the endless river: 1-2 big rocks,
// 3-6 small rocks around them and three reeds per small rock. A fixed pool of
// clusters is recycled: whatever falls far from the boat is re-rolled ahead of
// it, so the river keeps producing fresh obstacles in whichever direction the
// boat travels. Every rock (big or small) is a collider in `colliders`, shared
// with the boat/smuggler collision code; unused slots are parked far away.
const PARKED_X = 1e9;
const MAX_BIG = 4;
const MAX_SMALL = 10;

const randInt = (min, max) => Math.floor(min + Math.random() * (Math.floor(max) - Math.floor(min) + 1));

const ROCK_VARIANTS = 4;

function makeLumpyRock(seed) {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const hash = (x, y, z) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.3) * 43758.5453;
    return n - Math.floor(n);
  };
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      k = 0.72 + hash(x, y, z) * 0.5;
      cache.set(key, k);
    }
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export class RockField {
  constructor(scene, colliders, riverHalfWidth, applyReedSway = null) {
    this.colliders = colliders;
    this.riverHalfWidth = riverHalfWidth;
    this.clusters = [];
    this.dir = 1;

    const slotsPerCluster = Math.min(MAX_BIG, Math.ceil(ROCK_TUNING.bigMax)) + Math.min(MAX_SMALL, Math.ceil(ROCK_TUNING.smallMax));
    this.rockCapacity = ROCK_TUNING.count * slotsPerCluster;
    this.reedCapacity = ROCK_TUNING.count * Math.min(MAX_SMALL, Math.ceil(ROCK_TUNING.smallMax)) * Math.ceil(ROCK_TUNING.reedsPerSmallRock);

    // A few lumpy variants: vertices pushed in/out by a position hash (shared
    // vertices move together, so no cracks) so no two rock shapes look alike.
    const variants = Array.from({ length: ROCK_VARIANTS }, (_, v) => makeLumpyRock(v + 1));
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x525659, flatShading: true });
    const mossMat = new THREE.MeshLambertMaterial({ color: 0x48523c, flatShading: true });
    // meshes[group * ROCK_VARIANTS + variant]
    this.meshes = [rockMat, mossMat].flatMap((material) => variants.map((geo) => {
      const mesh = new THREE.InstancedMesh(geo, material, this.rockCapacity);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    }));

    const stalkGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 4);
    stalkGeo.translate(0, 0.5, 0);
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x4a6b2f, flatShading: true });
    if (applyReedSway) applyReedSway(reedMat);
    this.reedMesh = new THREE.InstancedMesh(stalkGeo, reedMat, this.reedCapacity);
    this.reedMesh.castShadow = true;
    this.reedMesh.frustumCulled = false;
    this.reedMesh.count = 0;
    scene.add(this.reedMesh);

    this.dummy = new THREE.Object3D();

    for (let i = 0; i < ROCK_TUNING.count; i++) {
      const cluster = { x: PARKED_X, z: 0, rise: 1, rocks: [], reeds: [] };
      for (let r = 0; r < slotsPerCluster; r++) {
        const rock = { x: PARKED_X, z: 0, radius: 0, visualRadius: 0, moss: false, variant: 0, sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, active: false };
        cluster.rocks.push(rock);
        colliders.push(rock);
      }
      this.clusters.push(cluster);
    }
  }

  /** Scatter the initial field around `focusX`, leaving the start area clear. */
  reset(focusX = 0, clearRadius = 30) {
    for (const cluster of this.clusters) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const span = ROCK_TUNING.spawnDistance - clearRadius;
      this.place(cluster, focusX + side * (clearRadius + Math.random() * span), false);
    }
    this.writeAll();
  }

  place(cluster, x, animate = true) {
    const T = ROCK_TUNING;
    const bigCount = randInt(T.bigMin, Math.min(T.bigMax, MAX_BIG));
    const smallCount = randInt(T.smallMin, Math.min(T.smallMax, MAX_SMALL));
    const reach = 5.5;
    const limit = Math.max(0, this.riverHalfWidth - T.bankMargin - reach);

    let cx = x;
    let cz = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      cx = x + (attempt > 3 ? (Math.random() - 0.5) * 30 : 0);
      cz = (Math.random() * 2 - 1) * limit;
      let clear = true;
      for (const other of this.clusters) {
        if (other === cluster || other.x === PARKED_X) continue;
        if (Math.hypot(other.x - cx, other.z - cz) < T.minGap) {
          clear = false;
          break;
        }
      }
      if (clear) break;
    }
    cluster.x = cx;
    cluster.z = cz;
    cluster.rise = animate ? 0 : 1;

    const placed = [];
    const setRock = (rock, rx, rz, size) => {
      rock.x = rx;
      rock.z = rz;
      rock.radius = size * 0.88;
      rock.visualRadius = size;
      rock.moss = Math.random() > 0.5;
      rock.variant = Math.floor(Math.random() * ROCK_VARIANTS);
      // Uneven stretch so rocks are squat, long or leaning, never a ball.
      rock.sx = 0.7 + Math.random() * 0.45;
      rock.sy = 0.6 + Math.random() * 0.5;
      rock.sz = 0.7 + Math.random() * 0.45;
      rock.rx = Math.random() * Math.PI;
      rock.ry = Math.random() * Math.PI;
      rock.rz = Math.random() * Math.PI;
      rock.active = true;
      placed.push(rock);
    };

    let slot = 0;
    for (let i = 0; i < bigCount; i++) {
      const size = T.minSize + Math.random() * (T.maxSize - T.minSize);
      const spread = i === 0 ? 0 : (size + placed[0].visualRadius) * (0.75 + Math.random() * 0.15);
      const angle = Math.random() * Math.PI * 2;
      setRock(cluster.rocks[slot++], cx + Math.cos(angle) * spread, cz + Math.sin(angle) * spread, size);
    }
    for (let i = 0; i < smallCount; i++) {
      const size = T.smallMinSize + Math.random() * (T.smallMaxSize - T.smallMinSize);
      const anchor = placed[Math.floor(Math.random() * Math.min(bigCount, placed.length))];
      const angle = Math.random() * Math.PI * 2;
      const dist = (anchor.visualRadius + size) * (0.8 + Math.random() * 0.2);
      setRock(cluster.rocks[slot++], anchor.x + Math.cos(angle) * dist, anchor.z + Math.sin(angle) * dist, size);
    }
    for (; slot < cluster.rocks.length; slot++) {
      const rock = cluster.rocks[slot];
      rock.x = PARKED_X;
      rock.radius = 0;
      rock.visualRadius = 0;
      rock.active = false;
    }

    // Reeds (3 per small rock by default) hug the small rocks, never inside one.
    cluster.reeds.length = 0;
    const perRock = Math.max(1, Math.round(T.reedsPerSmallRock));
    for (let i = bigCount; i < placed.length; i++) {
      const anchor = placed[i];
      for (let n = 0; n < perRock; n++) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = anchor.visualRadius + 0.1 + Math.random() * 0.7;
          const rx = anchor.x + Math.cos(angle) * dist;
          const rz = anchor.z + Math.sin(angle) * dist;
          if (placed.some((rock) => Math.hypot(rx - rock.x, rz - rock.z) < rock.visualRadius + 0.1)) continue;
          cluster.reeds.push({ x: rx, z: rz, h: 1.8 + Math.random() * 1.8, ry: Math.random() * Math.PI });
          break;
        }
      }
    }
  }

  update(dt, focusX, velocityX = 0) {
    if (Math.abs(velocityX) > 1) this.dir = Math.sign(velocityX);

    for (const cluster of this.clusters) {
      if (Math.abs(cluster.x - focusX) > ROCK_TUNING.recycleDistance) {
        const side = Math.random() < 0.8 ? this.dir : -this.dir;
        this.place(cluster, focusX + side * ROCK_TUNING.spawnDistance * (0.8 + Math.random() * 0.2));
      } else if (cluster.rise < 1) {
        cluster.rise = Math.min(1, cluster.rise + dt / ROCK_TUNING.riseSeconds);
      }
    }
    this.writeAll();
  }

  writeAll() {
    const counts = new Array(this.meshes.length).fill(0);
    let reedCount = 0;
    const d = this.dummy;

    for (const cluster of this.clusters) {
      const eased = cluster.rise * cluster.rise * (3 - 2 * cluster.rise);

      for (const rock of cluster.rocks) {
        if (!rock.active) continue;
        const group = (rock.moss ? 1 : 0) * ROCK_VARIANTS + rock.variant;
        const size = rock.visualRadius;
        d.position.set(rock.x, (0.25 + size * 0.25) * eased - size * (1 - eased), rock.z);
        d.rotation.set(rock.rx, rock.ry, rock.rz);
        d.scale.set(size * rock.sx, size * rock.sy, size * rock.sz);
        d.updateMatrix();
        this.meshes[group].setMatrixAt(counts[group]++, d.matrix);
      }

      for (const reed of cluster.reeds) {
        if (reedCount >= this.reedCapacity) break;
        d.position.set(reed.x, -0.2 * (1 - eased), reed.z);
        d.rotation.set(0, reed.ry, 0);
        d.scale.set(1, Math.max(0.01, reed.h * eased), 1);
        d.updateMatrix();
        this.reedMesh.setMatrixAt(reedCount++, d.matrix);
      }
    }

    this.meshes.forEach((mesh, i) => {
      mesh.count = counts[i];
      mesh.instanceMatrix.needsUpdate = true;
    });
    this.reedMesh.count = reedCount;
    this.reedMesh.instanceMatrix.needsUpdate = true;
  }
}
