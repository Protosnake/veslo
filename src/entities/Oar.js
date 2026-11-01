import * as THREE from 'three';

const SHAFT_GEO = new THREE.CylinderGeometry(0.045, 0.055, 2.0, 8);
const BLADE_GEO = new THREE.CapsuleGeometry(0.16, 0.55, 4, 8);
const TIP_GEO = new THREE.SphereGeometry(0.13, 8, 6);

const SHAFT_MAT = new THREE.MeshLambertMaterial({ color: 0x1f2225, flatShading: true });
const BLADE_MAT = new THREE.MeshLambertMaterial({ color: 0x2a2e33, flatShading: true });
// Worn, dusty orange rather than a clean signal red.
const TIP_MAT = new THREE.MeshLambertMaterial({ color: 0xc46a2a, flatShading: true });

export class Oar {
  constructor() {
    this.group = new THREE.Group();

    const shaft = new THREE.Mesh(SHAFT_GEO, SHAFT_MAT);
    shaft.position.y = 0.8;
    shaft.castShadow = true;
    this.group.add(shaft);

    // Rounded paddle blade: a capsule flattened on Z reads as a soft oar blade
    // instead of a plank.
    const blade = new THREE.Mesh(BLADE_GEO, BLADE_MAT);
    blade.position.y = 1.75;
    blade.scale.set(1, 1, 0.45);
    blade.castShadow = true;
    this.group.add(blade);

    const tip = new THREE.Mesh(TIP_GEO, TIP_MAT);
    tip.position.y = 2.14;
    tip.scale.set(1, 0.8, 0.5);
    tip.castShadow = true;
    this.group.add(tip);

    this.tip = new THREE.Object3D();
    this.tip.position.set(0, 1.8, 0);
    this.group.add(this.tip);
  }
}
