import * as THREE from 'three';

export const SOLDIER_MATS = {
  skin: new THREE.MeshLambertMaterial({ color: 0xd6a37d }),
  uniform: new THREE.MeshLambertMaterial({ color: 0x3c4a33, flatShading: true }),
  vest: new THREE.MeshLambertMaterial({ color: 0x242c1f, flatShading: true }),
  boot: new THREE.MeshLambertMaterial({ color: 0x14170f }),
  metal: new THREE.MeshStandardMaterial({
    color: 0x20261f,
    roughness: 0.62,
    metalness: 0.28
  })
};

const GEO = {
  pelvis: new THREE.BoxGeometry(0.36, 0.2, 0.26),
  thigh: new THREE.BoxGeometry(0.18, 0.42, 0.2),
  shin: new THREE.BoxGeometry(0.16, 0.32, 0.18),
  boot: new THREE.BoxGeometry(0.17, 0.16, 0.3),
  torso: new THREE.BoxGeometry(0.54, 0.52, 0.3),
  vest: new THREE.BoxGeometry(0.48, 0.42, 0.35),
  neck: new THREE.CylinderGeometry(0.06, 0.07, 0.09, 8),
  head: new THREE.SphereGeometry(0.15, 8, 7),
  helmet: new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  upperArm: new THREE.BoxGeometry(0.12, 0.3, 0.13),
  forearm: new THREE.BoxGeometry(0.1, 0.26, 0.11),
  hand: new THREE.BoxGeometry(0.09, 0.11, 0.07)
};

// Joint order is also the order shown in the dev sprite viewer's rig panel.
export const SOLDIER_JOINT_LABELS = {
  spine: 'spine',
  neck: 'neck',
  head: 'head',
  shoulderLeft: 'left shoulder',
  elbowLeft: 'left elbow',
  wristLeft: 'left wrist',
  shoulderRight: 'right shoulder',
  elbowRight: 'right elbow',
  wristRight: 'right wrist',
  hipLeft: 'left hip',
  kneeLeft: 'left knee',
  ankleLeft: 'left ankle',
  hipRight: 'right hip',
  kneeRight: 'right knee',
  ankleRight: 'right ankle'
};

const STAND_LEGS = { hip: 0, knee: 0, ankle: 0 };
const ZERO = [0, 0, 0];

export const SOLDIER_POSES = {
  idle: {
    left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
    right: { shoulder: [0.27, 0, 0.04], elbow: -0.64 }
  },
  eyes: {
    left: { shoulder: [-1.58, 0, 0.54], elbow: -1.46 },
    right: { shoulder: [-1.58, 0, -0.54], elbow: -1.46 }
  },
  radioDown: {
    left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
    right: { shoulder: [0.12, 0, 0], elbow: -0.71 }
  },
  radioUp: {
    left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
    right: { shoulder: [-0.97, 0, -0.68], elbow: -2.09 }
  },
  steer: {
    left: { shoulder: [0.27, 0, -0.04], elbow: -0.64 },
    right: { shoulder: [1.1, 0, 0], elbow: -1.05 }
  },
  row: {
    left: { shoulder: [-0.7, 0, 0.12], elbow: -0.55 },
    right: { shoulder: [-0.7, 0, -0.12], elbow: -0.55 }
  },
  sitSteer: {
    legs: { hip: -Math.PI / 2, knee: Math.PI / 2 },
    left: { shoulder: [-0.65, 0.8, 0.45], elbow: 0.05 },
    right: { shoulder: [0.25, 0.3, 0.1], elbow: -1.25 }
  }
};

const AXES = ['x', 'y', 'z'];

function blend(rotation, axis, target, amount) {
  rotation[axis] += (target - rotation[axis]) * amount;
}

function buildMesh(geometry, material, position) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  return mesh;
}

export class Soldier {
  constructor({ pose = 'idle' } = {}) {
    this.group = new THREE.Group();
    this.mode = pose;
    this.targets = SOLDIER_POSES[pose] || SOLDIER_POSES.idle;
    this.jointLabels = SOLDIER_JOINT_LABELS;

    this.build();
    this.applyPose(this.targets, 1);
  }

  build() {
    this.group.add(buildMesh(GEO.pelvis, SOLDIER_MATS.uniform, [0, 0.93, 0]));

    this.legs = {
      left: this.createLeg(-1),
      right: this.createLeg(1)
    };

    const spine = new THREE.Group();
    spine.position.y = 1.03;
    this.group.add(spine);

    spine.add(buildMesh(GEO.torso, SOLDIER_MATS.uniform, [0, 0.26, 0]));
    spine.add(buildMesh(GEO.vest, SOLDIER_MATS.vest, [0, 0.3, 0.01]));

    const neck = new THREE.Group();
    neck.position.y = 0.52;
    spine.add(neck);
    neck.add(buildMesh(GEO.neck, SOLDIER_MATS.skin, [0, 0.04, 0]));

    const head = new THREE.Group();
    head.position.y = 0.08;
    neck.add(head);
    head.add(buildMesh(GEO.head, SOLDIER_MATS.skin, [0, 0.13, 0]));
    head.add(buildMesh(GEO.helmet, SOLDIER_MATS.vest, [0, 0.14, 0]));

    this.arms = {
      left: this.createArm(-1, spine),
      right: this.createArm(1, spine)
    };

    this.joints = {
      spine,
      neck,
      head,
      shoulderLeft: this.arms.left.shoulder,
      elbowLeft: this.arms.left.elbow,
      wristLeft: this.arms.left.wrist,
      shoulderRight: this.arms.right.shoulder,
      elbowRight: this.arms.right.elbow,
      wristRight: this.arms.right.wrist,
      hipLeft: this.legs.left.hip,
      kneeLeft: this.legs.left.knee,
      ankleLeft: this.legs.left.ankle,
      hipRight: this.legs.right.hip,
      kneeRight: this.legs.right.knee,
      ankleRight: this.legs.right.ankle
    };
  }

  createLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, 0.92, 0);
    this.group.add(hip);
    hip.add(buildMesh(GEO.thigh, SOLDIER_MATS.uniform, [0, -0.21, 0]));

    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    knee.add(buildMesh(GEO.shin, SOLDIER_MATS.uniform, [0, -0.16, 0]));

    const ankle = new THREE.Group();
    ankle.position.y = -0.32;
    knee.add(ankle);
    ankle.add(buildMesh(GEO.boot, SOLDIER_MATS.boot, [0, -0.09, 0.04]));

    return { hip, knee, ankle, side };
  }

  createArm(side, parent) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3, 0.52, 0);
    parent.add(shoulder);
    shoulder.add(buildMesh(GEO.upperArm, SOLDIER_MATS.uniform, [0, -0.15, 0]));

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(buildMesh(GEO.forearm, SOLDIER_MATS.uniform, [0, -0.13, 0]));

    const wrist = new THREE.Group();
    wrist.position.y = -0.26;
    elbow.add(wrist);
    wrist.add(buildMesh(GEO.hand, SOLDIER_MATS.skin, [0, -0.02, 0]));

    return { shoulder, elbow, wrist, side };
  }

  jointLabel(key) {
    return SOLDIER_JOINT_LABELS[key] || key;
  }

  setPose(pose, immediate = false) {
    if (typeof pose === 'string') {
      this.mode = pose;
      this.targets = SOLDIER_POSES[pose] || SOLDIER_POSES.idle;
    } else {
      this.mode = 'custom';
      this.targets = pose;
    }

    if (immediate) this.applyPose(this.targets, 1);
  }

  // Used by the viewer when a joint slider is moved: capture the current pose so
  // the blend in update() holds it instead of snapping back to the named pose.
  freezePose() {
    this.mode = 'custom';
    this.targets = this.capturePose();
  }

  capturePose() {
    const angle = (object) => [object.rotation.x, object.rotation.y, object.rotation.z];
    const arms = (arm) => ({
      shoulder: angle(arm.shoulder),
      elbow: arm.elbow.rotation.x,
      wrist: angle(arm.wrist)
    });
    const leg = (part) => ({
      hip: part.hip.rotation.x,
      knee: part.knee.rotation.x,
      ankle: part.ankle.rotation.x
    });

    return {
      spine: angle(this.joints.spine),
      neck: angle(this.joints.neck),
      head: angle(this.joints.head),
      left: arms(this.arms.left),
      right: arms(this.arms.right),
      legs: {
        left: leg(this.legs.left),
        right: leg(this.legs.right)
      }
    };
  }

  applyPose(pose, amount) {
    for (const key of ['left', 'right']) {
      const arm = this.arms[key];
      const source = pose[key] || SOLDIER_POSES.idle[key];
      const shoulder = source.shoulder || SOLDIER_POSES.idle[key].shoulder;
      const wrist = source.wrist || ZERO;

      for (let i = 0; i < AXES.length; i += 1) {
        blend(arm.shoulder.rotation, AXES[i], shoulder[i] || 0, amount);
        blend(arm.wrist.rotation, AXES[i], wrist[i] || 0, amount);
      }
      blend(arm.elbow.rotation, 'x', source.elbow ?? 0, amount);
    }

    const legPose = pose.legs || STAND_LEGS;
    for (const key of ['left', 'right']) {
      const leg = this.legs[key];
      const target = legPose[key] || legPose;
      blend(leg.hip.rotation, 'x', target.hip ?? 0, amount);
      blend(leg.knee.rotation, 'x', target.knee ?? 0, amount);
      blend(leg.ankle.rotation, 'x', target.ankle ?? 0, amount);
    }

    for (const key of ['spine', 'neck', 'head']) {
      const target = pose[key] || ZERO;
      for (let i = 0; i < AXES.length; i += 1) {
        blend(this.joints[key].rotation, AXES[i], target[i] || 0, amount);
      }
    }
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 9);
    this.applyPose(this.targets, k);
  }
}
