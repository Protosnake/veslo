import * as THREE from 'three';

const SHAFT_GEO = new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6);
const BLADE_GEO = new THREE.BoxGeometry(0.36, 1.15, 0.06);
const TIP_GEO = new THREE.BoxGeometry(0.37, 0.32, 0.07);

const SHAFT_MAT = new THREE.MeshLambertMaterial({ color: 0xb58045 });
const BLADE_MAT = new THREE.MeshLambertMaterial({ color: 0xca8c4c });
const TIP_MAT = new THREE.MeshLambertMaterial({ color: 0xd92626 });

export class Oar {
  constructor() {
    this.group = new THREE.Group();

    const shaft = new THREE.Mesh(SHAFT_GEO, SHAFT_MAT);
    shaft.position.y = 0.9;
    shaft.castShadow = true;
    this.group.add(shaft);

    const blade = new THREE.Mesh(BLADE_GEO, BLADE_MAT);
    blade.position.y = 2.15;
    blade.castShadow = true;
    this.group.add(blade);

    const tip = new THREE.Mesh(TIP_GEO, TIP_MAT);
    tip.position.y = 2.55;
    this.group.add(tip);

    this.tip = new THREE.Object3D();
    this.tip.position.set(0, 2.15, 0);
    this.group.add(this.tip);
  }
}
