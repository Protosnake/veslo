import * as THREE from 'three';

const SKIN_MAT = new THREE.MeshLambertMaterial({ color: 0xd6a37d });
const UNIFORM_MAT = new THREE.MeshLambertMaterial({ color: 0x3c4a33, flatShading: true });
const VEST_MAT = new THREE.MeshLambertMaterial({ color: 0x242c1f, flatShading: true });
const BOOT_MAT = new THREE.MeshLambertMaterial({ color: 0x14170f });
const METAL_MAT = new THREE.MeshStandardMaterial({
  color: 0x20261f,
  roughness: 0.62,
  metalness: 0.28
});

const EYE_POSE = {
  left: { shoulder: [-1.58, 0, 0.54], elbow: -1.46 },
  right: { shoulder: [-1.58, 0, -0.54], elbow: -1.46 }
};

const IDLE_POSE = {
  left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
  right: { shoulder: [0.27, 0, 0.04], elbow: -0.64 }
};

const RADIO_DOWN_POSE = {
  left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
  right: { shoulder: [0.12, 0, 0], elbow: -0.71 }
};

const RADIO_UP_POSE = {
  left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
  right: { shoulder: [-0.97, 0, -0.68], elbow: -2.09 }
};

export class WatchtowerSoldier {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.mode = 'idle';
    this.modeTime = 0;
    this.targets = IDLE_POSE;

    this.build();
    scene.add(this.group);
  }

  build() {
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.84, 0.28), UNIFORM_MAT);
    legs.position.y = 0.54;
    legs.castShadow = true;
    this.group.add(legs);

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.34), BOOT_MAT);
    leftBoot.position.set(-0.14, 0.09, 0.04);
    leftBoot.castShadow = true;
    this.group.add(leftBoot);

    const rightBoot = leftBoot.clone();
    rightBoot.position.x = 0.14;
    this.group.add(rightBoot);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.34), UNIFORM_MAT);
    torso.position.y = 1.32;
    torso.castShadow = true;
    this.group.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.39), VEST_MAT);
    vest.position.set(0, 1.38, 0.01);
    vest.castShadow = true;
    this.group.add(vest);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 8, 7), SKIN_MAT);
    head.position.y = 1.87;
    head.castShadow = true;
    this.group.add(head);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      VEST_MAT
    );
    helmet.position.y = 1.9;
    helmet.castShadow = true;
    this.group.add(helmet);

    this.arms = {
      left: this.createArm(-1),
      right: this.createArm(1)
    };

    this.binoculars = new THREE.Group();
    const tubeGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.2, 8);
    for (const side of [-1, 1]) {
      const tube = new THREE.Mesh(tubeGeo, METAL_MAT);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(side * 0.088, 0, 0);
      this.binoculars.add(tube);

      const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8), METAL_MAT);
      eyepiece.rotation.x = Math.PI / 2;
      eyepiece.position.set(side * 0.088, 0, -0.11);
      this.binoculars.add(eyepiece);
    }
    this.binoculars.position.set(0, 1.84, 0.26);
    this.binoculars.visible = false;
    this.group.add(this.binoculars);

    this.radio = new THREE.Group();
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.055), METAL_MAT);
    radioBody.position.y = 0.02;
    this.radio.add(radioBody);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.17, 5), METAL_MAT);
    antenna.position.set(0, 0.17, 0);
    this.radio.add(antenna);
    const radioLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xff4433 })
    );
    radioLight.position.set(0.02, 0.1, 0.03);
    this.radio.add(radioLight);
    this.radio.position.set(0, 0.02, 0.055);
    this.radio.visible = false;

    this.arms.right.hand.add(this.radio);
    this.applyPose(IDLE_POSE, 1);
  }

  createArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.30, 1.55, 0);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.13), UNIFORM_MAT);
    upper.position.y = -0.15;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.11), UNIFORM_MAT);
    forearm.position.y = -0.14;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), SKIN_MAT);
    hand.position.y = -0.28;
    hand.castShadow = true;
    elbow.add(hand);

    shoulder.add(elbow);
    this.group.add(shoulder);

    return { shoulder, elbow, hand, side };
  }

  setMode(mode, immediate = false) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.modeTime = 0;

    this.binoculars.visible = mode === 'binoculars';
    this.radio.visible = mode === 'radio';

    if (mode === 'binoculars') this.targets = EYE_POSE;
    else if (mode === 'radio') this.targets = RADIO_DOWN_POSE;
    else this.targets = IDLE_POSE;

    if (immediate) this.applyPose(this.targets, 1);
  }

  reset() {
    this.mode = 'idle';
    this.modeTime = 0;
    this.targets = IDLE_POSE;
    this.binoculars.visible = false;
    this.radio.visible = false;
    this.applyPose(IDLE_POSE, 1);
  }

  applyPose(pose, amount) {
    for (const key of ['left', 'right']) {
      const arm = this.arms[key];
      const target = pose[key];
      const shoulder = target.shoulder;
      arm.shoulder.rotation.x += (shoulder[0] - arm.shoulder.rotation.x) * amount;
      arm.shoulder.rotation.y += (shoulder[1] - arm.shoulder.rotation.y) * amount;
      arm.shoulder.rotation.z += (shoulder[2] - arm.shoulder.rotation.z) * amount;
      arm.elbow.rotation.x += (target.elbow - arm.elbow.rotation.x) * amount;
    }
  }

  update(dt) {
    this.modeTime += dt;

    if (this.mode === 'radio') {
      if (this.modeTime < 0.5) {
        this.targets = RADIO_DOWN_POSE;
      } else if (this.modeTime < 1.15) {
        this.targets = RADIO_UP_POSE;
      } else {
        this.targets = RADIO_UP_POSE;
      }
    }

    const k = 1 - Math.exp(-dt * 9);
    this.applyPose(this.targets, k);

    if (this.mode === 'radio') {
      const bob = Math.sin(this.modeTime * 2.2) * 0.02;
      this.radio.rotation.z = bob;
      this.radio.rotation.x =
        -(this.arms.right.shoulder.rotation.x + this.arms.right.elbow.rotation.x);
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
