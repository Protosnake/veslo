import * as THREE from 'three';

const MATS = {
  metal: new THREE.MeshStandardMaterial({ color: 0x3a3e3c, roughness: 0.55, metalness: 0.25, flatShading: true }),
  steel: new THREE.MeshStandardMaterial({ color: 0x5a605d, roughness: 0.5, metalness: 0.3, flatShading: true }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9a5426, roughness: 0.8, metalness: 0.0, flatShading: true }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x74381a, roughness: 0.85, metalness: 0.0, flatShading: true }),
  mag: new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 0.65, metalness: 0.15, flatShading: true })
};

const GEO = {
  receiver: new THREE.BoxGeometry(0.05, 0.065, 0.3),
  dustCover: new THREE.BoxGeometry(0.046, 0.016, 0.28),
  barrel: new THREE.CylinderGeometry(0.0095, 0.0095, 0.52, 8),
  gasTube: new THREE.CylinderGeometry(0.011, 0.011, 0.27, 8),
  gasBlock: new THREE.BoxGeometry(0.03, 0.07, 0.035),
  sightBase: new THREE.BoxGeometry(0.026, 0.04, 0.03),
  frontSight: new THREE.BoxGeometry(0.005, 0.03, 0.01),
  muzzle: new THREE.CylinderGeometry(0.0145, 0.0145, 0.06, 8),
  handguardLower: new THREE.BoxGeometry(0.054, 0.045, 0.24),
  handguardUpper: new THREE.BoxGeometry(0.042, 0.026, 0.24),
  rearSight: new THREE.BoxGeometry(0.03, 0.02, 0.05),
  grip: new THREE.BoxGeometry(0.038, 0.12, 0.05),
  triggerGuard: new THREE.BoxGeometry(0.01, 0.012, 0.1),
  trigger: new THREE.BoxGeometry(0.006, 0.03, 0.008),
  magWell: new THREE.BoxGeometry(0.04, 0.03, 0.065),
  magSegment: new THREE.BoxGeometry(0.036, 0.08, 0.055),
  stock: new THREE.BoxGeometry(0.04, 0.07, 0.32),
  butt: new THREE.BoxGeometry(0.042, 0.115, 0.07),
  buttPlate: new THREE.BoxGeometry(0.044, 0.118, 0.008),
  sling: new THREE.BoxGeometry(0.006, 0.02, 0.02)
};

function part(geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  return mesh;
}

const HALF_PI = Math.PI / 2;

// Low-poly AK-style assault rifle. Origin is the centre of the pistol grip so
// a hand attach point can hold it directly; +z is the muzzle direction and +y
// is up. `magazine` and `muzzleTip` are exposed for later reload / firing hooks.
export class AssaultRifle {
  constructor() {
    this.group = new THREE.Group();
    const g = this.group;

    // Receiver (z -0.09..0.21) and dust cover.
    g.add(part(GEO.receiver, MATS.metal, [0, 0.07, 0.06]));
    g.add(part(GEO.dustCover, MATS.steel, [0, 0.11, 0.07]));
    g.add(part(GEO.rearSight, MATS.steel, [0, 0.13, 0.17]));

    // Wooden furniture butted against the receiver: stock, grip, handguards.
    g.add(part(GEO.stock, MATS.wood, [0, 0.062, -0.25], [0.04, 0, 0]));
    g.add(part(GEO.butt, MATS.woodDark, [0, 0.03, -0.385], [0.04, 0, 0]));
    g.add(part(GEO.buttPlate, MATS.metal, [0, 0.03, -0.424], [0.04, 0, 0]));
    g.add(part(GEO.grip, MATS.woodDark, [0, -0.02, -0.01], [0.3, 0, 0]));
    g.add(part(GEO.handguardLower, MATS.wood, [0, 0.062, 0.33]));
    g.add(part(GEO.handguardUpper, MATS.woodDark, [0, 0.108, 0.33]));

    // Barrel, gas tube riding above the handguard, gas block, front sight, muzzle.
    g.add(part(GEO.barrel, MATS.steel, [0, 0.075, 0.46], [HALF_PI, 0, 0]));
    g.add(part(GEO.gasTube, MATS.steel, [0, 0.13, 0.345], [HALF_PI, 0, 0]));
    g.add(part(GEO.gasBlock, MATS.metal, [0, 0.1, 0.485]));
    g.add(part(GEO.sightBase, MATS.metal, [0, 0.09, 0.655]));
    g.add(part(GEO.frontSight, MATS.metal, [0, 0.125, 0.655]));
    g.add(part(GEO.muzzle, MATS.metal, [0, 0.075, 0.72], [HALF_PI, 0, 0]));

    // Trigger guard hugging the receiver underside, trigger inside it.
    g.add(part(GEO.triggerGuard, MATS.metal, [0, 0.031, 0.07]));
    g.add(part(GEO.trigger, MATS.metal, [0, 0.025, 0.065], [-0.25, 0, 0]));

    // Banana magazine: a chain of segments, each turned further toward the
    // muzzle, with every segment starting exactly where the last one ended.
    this.magazine = new THREE.Group();
    this.magazine.add(part(GEO.magWell, MATS.metal, [0, 0.025, 0.17]));
    let cz = 0.17;
    let cy = 0.01;
    let angle = 0.05;
    for (let i = 0; i < 2; i += 1) {
      const len = 0.08;
      const dz = Math.sin(angle);
      const dy = -Math.cos(angle);
      this.magazine.add(part(GEO.magSegment, MATS.mag, [0, cy + (dy * len) / 2, cz + (dz * len) / 2], [-angle, 0, 0]));
      cz += dz * len * 0.92;
      cy += dy * len * 0.92;
      angle += 0.45;
    }
    g.add(this.magazine);

    // Sling swivels and muzzle reference point.
    g.add(part(GEO.sling, MATS.metal, [0, 0.0, -0.1]));
    g.add(part(GEO.sling, MATS.metal, [0, 0.028, 0.44]));
    this.muzzleTip = new THREE.Object3D();
    this.muzzleTip.position.set(0, 0.075, 0.74);
    g.add(this.muzzleTip);
  }
}
