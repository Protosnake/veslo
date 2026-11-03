import * as THREE from 'three';

const BODY_GEO = new THREE.SphereGeometry(0.5, 12, 9);
const HEAD_GEO = new THREE.SphereGeometry(0.3, 10, 8);
const SNOUT_GEO = new THREE.SphereGeometry(0.16, 8, 6);
const NOSE_GEO = new THREE.SphereGeometry(0.05, 6, 5);
const EYE_GEO = new THREE.SphereGeometry(0.045, 6, 5);
const EAR_GEO = new THREE.SphereGeometry(0.07, 6, 5);
const TOOTH_GEO = new THREE.BoxGeometry(0.05, 0.1, 0.03);
const TAIL_GEO = new THREE.SphereGeometry(0.5, 10, 6);
const LEG_GEO = new THREE.BoxGeometry(0.16, 0.2, 0.26);
const PAW_GEO = new THREE.BoxGeometry(0.1, 0.07, 0.12);

const FUR = new THREE.MeshLambertMaterial({ color: 0x7a4a26, flatShading: true });
const FUR_DARK = new THREE.MeshLambertMaterial({ color: 0x5a3519, flatShading: true });
const BELLY = new THREE.MeshLambertMaterial({ color: 0x9a6a3e, flatShading: true });
const TAIL = new THREE.MeshLambertMaterial({ color: 0x2f2a28, flatShading: true });
const TOOTH = new THREE.MeshLambertMaterial({ color: 0xf0e6c8 });
const NOSE = new THREE.MeshLambertMaterial({ color: 0x151110 });
const EYE = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });

// Beaver model only (no behaviour yet). Faces +Z, feet rest on y = 0.
export class Beaver {
  constructor(scene) {
    this.group = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = this.bodyGroup) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      parent.add(m);
      return m;
    };

    // Plump, low-slung body with a lighter belly.
    add(BODY_GEO, FUR, 0, 0.42, -0.05, 0.85, 0.72, 1.25);
    add(BODY_GEO, BELLY, 0, 0.3, 0.05, 0.62, 0.45, 0.95);

    // Head with blunt snout, nose, teeth, eyes and ears.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.55, 0.58);
    this.bodyGroup.add(this.head);
    add(HEAD_GEO, FUR, 0, 0, 0, 1, 0.95, 1.05, this.head);
    add(SNOUT_GEO, BELLY, 0, -0.07, 0.24, 1.15, 0.85, 1, this.head);
    add(NOSE_GEO, NOSE, 0, -0.01, 0.38, 1.3, 0.9, 1, this.head);
    for (const s of [-1, 1]) {
      add(TOOTH_GEO, TOOTH, s * 0.028, -0.2, 0.34, 1, 1, 1, this.head);
      add(EYE_GEO, EYE, s * 0.15, 0.1, 0.2, 1, 1, 1, this.head);
      add(EAR_GEO, FUR_DARK, s * 0.2, 0.25, -0.05, 1, 1, 0.6, this.head);
    }

    // Flat paddle tail, hinged at the rump so it can slap.
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.28, -0.45);
    this.bodyGroup.add(this.tail);
    add(TAIL_GEO, TAIL, 0, 0, -0.4, 0.5, 0.09, 0.7, this.tail);

    // Stubby legs and little front paws.
    for (const s of [-1, 1]) {
      add(LEG_GEO, FUR_DARK, s * 0.3, 0.1, -0.3, 1, 1, 1);
      add(LEG_GEO, FUR_DARK, s * 0.26, 0.1, 0.35, 0.8, 1, 0.8);
      add(PAW_GEO, FUR_DARK, s * 0.26, 0.035, 0.5);
    }

    if (scene) scene.add(this.group);
  }

  animate(time) {
    this.tail.rotation.x = Math.max(0, Math.sin(time * 3)) * 0.5;
    this.head.rotation.x = Math.sin(time * 2) * 0.05;
    this.bodyGroup.position.y = Math.sin(time * 2) * 0.008;
  }
}
