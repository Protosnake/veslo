import * as THREE from 'three';

const BODY_MAT = new THREE.MeshStandardMaterial({
  color: 0x2a302b,
  roughness: 0.58,
  metalness: 0.24,
  flatShading: true
});
const TRIM_MAT = new THREE.MeshLambertMaterial({ color: 0x565f51 });
const ROTOR_MAT = new THREE.MeshBasicMaterial({
  color: 0xb9c7b5,
  transparent: true,
  opacity: 0.22,
  depthWrite: false
});
const BLADE_MAT = new THREE.MeshLambertMaterial({ color: 0x171b16 });
const LENS_MAT = new THREE.MeshStandardMaterial({
  color: 0x101512,
  roughness: 0.3,
  metalness: 0.4
});
const GLASS_MAT = new THREE.MeshBasicMaterial({ color: 0x8fd6ff });

export class Drone {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.rotors = [];
    this.build();
    scene.add(this.group);
  }

  build() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.56), BODY_MAT);
    body.castShadow = true;
    this.group.add(body);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.84), TRIM_MAT);
    spine.castShadow = true;
    this.group.add(spine);

    const armGeo = new THREE.BoxGeometry(0.86, 0.055, 0.075);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, BODY_MAT);
      arm.position.set(0, 0.02, side * 0.16);
      arm.rotation.y = side * Math.PI / 4;
      arm.castShadow = true;
      this.group.add(arm);
    }

    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        const rotor = new THREE.Group();
        rotor.position.set(x * 0.43, 0.09, z * 0.43);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 6), TRIM_MAT);
        rotor.add(hub);

        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.01, 16), ROTOR_MAT);
        disc.position.y = 0.045;
        rotor.add(disc);

        const blades = new THREE.Group();
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.012, 0.045), BLADE_MAT);
        blades.add(blade);
        const crossBlade = blade.clone();
        crossBlade.rotation.y = Math.PI / 2;
        blades.add(crossBlade);
        blades.position.y = 0.05;
        rotor.add(blades);

        this.rotors.push(blades);
        this.group.add(rotor);
      }
    }

    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), BODY_MAT);
    gimbal.position.set(0, -0.15, 0.05);
    gimbal.castShadow = true;
    this.group.add(gimbal);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.13, 8), LENS_MAT);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, -0.15, 0.19);
    this.group.add(lens);

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.02, 8), GLASS_MAT);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, -0.15, 0.26);
    this.group.add(glass);

    const legGeo = new THREE.BoxGeometry(0.045, 0.26, 0.045);
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, TRIM_MAT);
        leg.position.set(x * 0.22, -0.23, z * 0.2);
        leg.rotation.z = x * 0.18;
        this.group.add(leg);
      }
    }

    const tailLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xff3322 })
    );
    tailLight.position.set(0, 0.02, -0.32);
    this.group.add(tailLight);
  }

  setPose(x, y, z, yaw = Math.PI) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
  }

  update(dt) {
    for (const rotor of this.rotors) {
      rotor.rotation.y += dt * 42;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
