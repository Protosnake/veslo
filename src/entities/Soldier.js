import * as THREE from 'three';
import { ChestRadio } from './ChestRadio.js';

export const SOLDIER_MATS = {
  skin: new THREE.MeshLambertMaterial({ color: 0xd6a37d, flatShading: true }),
  uniform: new THREE.MeshLambertMaterial({ color: 0x5a6844, flatShading: true }),
  helmet: new THREE.MeshLambertMaterial({ color: 0x4a5638, flatShading: true }),
  vest: new THREE.MeshLambertMaterial({ color: 0x262a20, flatShading: true }),
  boot: new THREE.MeshLambertMaterial({ color: 0x2b241c, flatShading: true }),
  glove: new THREE.MeshLambertMaterial({ color: 0x2c2b24, flatShading: true }),
  webbing: new THREE.MeshLambertMaterial({ color: 0x6e6a4c, flatShading: true }),
  buckle: new THREE.MeshStandardMaterial({ color: 0x6a6b5c, roughness: 0.5, metalness: 0.5 }),
  sole: new THREE.MeshLambertMaterial({ color: 0x15130f }),
  strap: new THREE.MeshLambertMaterial({ color: 0x0c0e0a }),
  lens: new THREE.MeshStandardMaterial({ color: 0x3d5a60, roughness: 0.2, metalness: 0.3 }),
  eye: new THREE.MeshBasicMaterial({ color: 0x0b0b0a }),
  metal: new THREE.MeshStandardMaterial({
    color: 0x20261f,
    roughness: 0.62,
    metalness: 0.28
  })
};

const SMUGGLER_MATS = {
  charcoal: {
    cloth: new THREE.MeshLambertMaterial({ color: 0x26292b, flatShading: true }),
    hat: new THREE.MeshLambertMaterial({ color: 0x101113, flatShading: true })
  },
  olive: {
    cloth: new THREE.MeshLambertMaterial({ color: 0x3a4030, flatShading: true }),
    hat: new THREE.MeshLambertMaterial({ color: 0x151810, flatShading: true })
  },
  navy: {
    cloth: new THREE.MeshLambertMaterial({ color: 0x232b38, flatShading: true }),
    hat: new THREE.MeshLambertMaterial({ color: 0x0d1116, flatShading: true })
  }
};

export const SMUGGLER_OUTFITS = ['smuggler-charcoal', 'smuggler-olive', 'smuggler-navy'];

export function randomSmugglerOutfit() {
  return SMUGGLER_OUTFITS[Math.floor(Math.random() * SMUGGLER_OUTFITS.length)];
}

// One rig, two looks. Same joints, same poses; only the cloth colour, vest and
// headwear change. The smuggler is the same soldier in muted civilian colours
// without a carrier.
const OUTFITS = {
  soldier: {
    cloth: SOLDIER_MATS.uniform,
    boots: SOLDIER_MATS.boot,
    hat: SOLDIER_MATS.helmet,
    vest: SOLDIER_MATS.vest,
    gloves: SOLDIER_MATS.glove,
    headgear: 'helmet'
  },
  ...Object.fromEntries(
    SMUGGLER_OUTFITS.map((key) => {
      const look = SMUGGLER_MATS[key.replace('smuggler-', '')];
      const headgear = key === 'smuggler-olive' ? 'cap' : 'beanie';
      return [
        key,
        {
          cloth: look.cloth,
          boots: SOLDIER_MATS.boot,
          hat: look.hat,
          vest: null,
          gloves: SOLDIER_MATS.skin,
          headgear
        }
      ];
    })
  )
};

// Box whose top and bottom faces can differ in size: gives the torso and
// plate carrier a shoulders-to-waist taper instead of a plain crate.
function taperedBox(topW, botW, height, topD, botD) {
  const geometry = new THREE.BoxGeometry(1, height, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const top = position.getY(i) > 0;
    position.setX(i, position.getX(i) * (top ? topW : botW));
    position.setZ(i, position.getZ(i) * (top ? topD : botD));
  }
  geometry.computeVertexNormals();
  return geometry;
}

const GEO = {
  pelvis: taperedBox(0.4, 0.24, 0.14, 0.27, 0.22),
  thigh: new THREE.CylinderGeometry(0.095, 0.072, 0.42, 6),
  hipBall: new THREE.SphereGeometry(0.092, 6, 4),
  kneeBall: new THREE.SphereGeometry(0.07, 6, 4),
  cargo: new THREE.BoxGeometry(0.05, 0.14, 0.13),
  shin: new THREE.CylinderGeometry(0.07, 0.052, 0.32, 6),
  kneePad: new THREE.BoxGeometry(0.13, 0.12, 0.05),
  cuff: new THREE.CylinderGeometry(0.085, 0.09, 0.07, 8),
  boot: new THREE.BoxGeometry(0.13, 0.15, 0.27),
  torso: taperedBox(0.56, 0.44, 0.52, 0.31, 0.26),
  belt: new THREE.BoxGeometry(0.47, 0.08, 0.29),
  buckle: new THREE.BoxGeometry(0.06, 0.045, 0.02),
  vest: taperedBox(0.5, 0.46, 0.36, 0.36, 0.33),
  pouch: new THREE.BoxGeometry(0.1, 0.13, 0.06),
  vestStrap: new THREE.BoxGeometry(0.09, 0.05, 0.33),
  backPlate: new THREE.BoxGeometry(0.3, 0.3, 0.05),
  holster: new THREE.BoxGeometry(0.06, 0.17, 0.11),
  collar: new THREE.CylinderGeometry(0.1, 0.13, 0.06, 8),
  neck: new THREE.CylinderGeometry(0.06, 0.07, 0.09, 8),
  scarf: new THREE.TorusGeometry(0.085, 0.034, 5, 10),
  head: new THREE.SphereGeometry(0.15, 7, 5),
  mouth: new THREE.BoxGeometry(0.06, 0.008, 0.01),
  nose: new THREE.BoxGeometry(0.032, 0.05, 0.04),
  ear: new THREE.SphereGeometry(0.03, 6, 5),
  eye: new THREE.BoxGeometry(0.036, 0.02, 0.012),
  brow: new THREE.BoxGeometry(0.06, 0.014, 0.014),
  helmet: new THREE.SphereGeometry(0.18, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  helmetRail: new THREE.BoxGeometry(0.02, 0.04, 0.14),
  helmetRim: new THREE.CylinderGeometry(0.18, 0.185, 0.025, 12),
  helmetMount: new THREE.BoxGeometry(0.07, 0.05, 0.03),
  goggleBand: new THREE.TorusGeometry(0.16, 0.012, 4, 14, Math.PI * 1.35),
  goggles: new THREE.BoxGeometry(0.22, 0.065, 0.05),
  beanie: new THREE.SphereGeometry(0.163, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.58),
  beanieRoll: new THREE.CylinderGeometry(0.162, 0.166, 0.045, 10),
  capDome: new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42),
  capBrim: new THREE.BoxGeometry(0.2, 0.014, 0.1),
  shoulderPad: new THREE.SphereGeometry(0.072, 7, 5),
  upperArm: new THREE.CylinderGeometry(0.072, 0.06, 0.3, 6),
  forearm: new THREE.CylinderGeometry(0.06, 0.046, 0.26, 6),
  elbowBall: new THREE.SphereGeometry(0.06, 6, 4),
  elbowPad: new THREE.SphereGeometry(0.056, 6, 5),
  armCuff: new THREE.CylinderGeometry(0.05, 0.047, 0.03, 8),
  palm: new THREE.BoxGeometry(0.085, 0.12, 0.07),
  knuckles: new THREE.BoxGeometry(0.085, 0.03, 0.065),
  finger: new THREE.BoxGeometry(0.018, 0.05, 0.022),
  thumb: new THREE.BoxGeometry(0.028, 0.06, 0.03)
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
    right: { shoulder: [0.3, 0, 0.12], elbow: -0.6 }
  },
  sitRow: {
    legs: { hip: -Math.PI / 2, knee: Math.PI / 2 },
    left: { shoulder: [-0.7, 0, 0.12], elbow: -0.55 },
    right: { shoulder: [-0.7, 0, -0.12], elbow: -0.55 }
  }
};

const AXES = ['x', 'y', 'z'];

function blend(rotation, axis, target, amount) {
  rotation[axis] += (target - rotation[axis]) * amount;
}

function buildMesh(geometry, material, position, scale, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  return mesh;
}

export class Soldier {
  constructor({ pose = 'idle', outfit = 'soldier' } = {}) {
    this.group = new THREE.Group();
    this.mode = pose;
    this.outfit = outfit;
    this.look = OUTFITS[outfit] || OUTFITS.soldier;
    this.targets = typeof pose === 'string' ? SOLDIER_POSES[pose] || SOLDIER_POSES.idle : pose;
    this.jointLabels = SOLDIER_JOINT_LABELS;

    this.build();
    this.applyPose(this.targets, 1);
  }

  build() {
    this.group.add(buildMesh(GEO.pelvis, this.look.cloth, [0, 0.96, 0]));

    this.legs = {
      left: this.createLeg(-1),
      right: this.createLeg(1)
    };

    const spine = new THREE.Group();
    spine.position.y = 1.03;
    this.group.add(spine);

    spine.add(buildMesh(GEO.torso, this.look.cloth, [0, 0.26, 0]));
    spine.add(buildMesh(GEO.belt, SOLDIER_MATS.strap, [0, 0.02, 0]));
    spine.add(buildMesh(GEO.buckle, SOLDIER_MATS.buckle, [0, 0.02, 0.145]));
    if (this.look.vest) this.buildCarrier(spine);

    const neck = new THREE.Group();
    neck.position.y = 0.52;
    spine.add(neck);
    neck.add(buildMesh(GEO.neck, SOLDIER_MATS.skin, [0, 0.04, 0]));
    if (this.look.vest) {
      neck.add(buildMesh(GEO.collar, this.look.cloth, [0, 0.0, 0]));
    } else {
      // Civilians wear a loose scarf instead of a collar.
      neck.add(buildMesh(GEO.scarf, this.look.cloth, [0, 0.02, 0.01], [1, 1, 1], [Math.PI / 2, 0, 0]));
    }

    const head = new THREE.Group();
    head.position.y = 0.08;
    neck.add(head);
    this.buildHead(head);

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

  // Plate carrier: tapered shell, shoulder straps, back panel and the chest radio.
  buildCarrier(spine) {
    spine.add(buildMesh(GEO.vest, this.look.vest, [0, 0.32, 0.005]));
    for (const side of [-1, 1]) {
      spine.add(buildMesh(GEO.vestStrap, this.look.vest, [side * 0.17, 0.52, 0]));
    }
    // One row of magazine pouches along the bottom of the carrier.
    for (const x of [-0.14, 0, 0.14]) {
      spine.add(buildMesh(GEO.pouch, SOLDIER_MATS.webbing, [x, 0.17, 0.2]));
    }

    // Chest radio on the left of the carrier (kept as a handle for interactions).
    this.chestRadio = new ChestRadio();
    this.chestRadio.group.position.set(-0.15, 0.37, 0.185);
    spine.add(this.chestRadio.group);
    spine.add(buildMesh(GEO.backPlate, SOLDIER_MATS.webbing, [0, 0.3, -0.2]));
  }

  buildHead(head) {
    // Slightly egg-shaped skull, mouth line, nose, ears, eyes and brow so the face reads
    // from the camera and the top-down view alike.
    head.add(buildMesh(GEO.head, SOLDIER_MATS.skin, [0, 0.13, 0], [0.95, 1.05, 1]));
    head.add(buildMesh(GEO.mouth, SOLDIER_MATS.eye, [0, 0.07, 0.139]));
    head.add(buildMesh(GEO.nose, SOLDIER_MATS.skin, [0, 0.12, 0.155]));
    for (const side of [-1, 1]) {
      head.add(buildMesh(GEO.ear, SOLDIER_MATS.skin, [side * 0.142, 0.12, -0.005], [0.6, 1.2, 1]));
      head.add(buildMesh(GEO.eye, SOLDIER_MATS.eye, [side * 0.052, 0.15, 0.142]));
      head.add(buildMesh(GEO.brow, SOLDIER_MATS.eye, [side * 0.052, 0.178, 0.143], null, [0, 0, side * -0.12]));
    }

    const hat = this.look.hat;
    switch (this.look.headgear) {
      case 'beanie':
        head.add(buildMesh(GEO.beanie, hat, [0, 0.15, 0], [1, 1, 1.02]));
        head.add(buildMesh(GEO.beanieRoll, hat, [0, 0.185, 0]));
        break;
      case 'cap':
        head.add(buildMesh(GEO.capDome, hat, [0, 0.16, -0.005], [1, 0.9, 1.04]));
        head.add(buildMesh(GEO.capBrim, hat, [0, 0.215, 0.165], null, [0.12, 0, 0]));
        break;
      default:
        // Combat helmet: shell, rim, NVG mount, goggles pushed up.
        head.add(buildMesh(GEO.helmet, hat, [0, 0.15, 0], [1.05, 0.85, 1.1]));
        for (const side of [-1, 1]) {
          head.add(buildMesh(GEO.helmetRail, SOLDIER_MATS.metal, [side * 0.17, 0.19, 0]));
        }
        head.add(buildMesh(GEO.helmetRim, hat, [0, 0.145, 0], [1, 1, 1.05]));
        head.add(buildMesh(GEO.helmetMount, SOLDIER_MATS.metal, [0, 0.26, 0.15], null, [0.5, 0, 0]));
        head.add(buildMesh(GEO.goggles, SOLDIER_MATS.lens, [0, 0.235, 0.158], null, [-0.15, 0, 0]));
    }
  }

  createLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115, 0.92, 0);
    this.group.add(hip);
    hip.add(buildMesh(GEO.hipBall, this.look.cloth, [0, 0, 0]));
    hip.add(buildMesh(GEO.thigh, this.look.cloth, [0, -0.21, 0], [1, 1, 0.95]));
    if (this.look.vest && side < 0) {
      hip.add(buildMesh(GEO.cargo, this.look.cloth, [-0.1, -0.2, 0.01]));
    }
    if (this.look.vest && side > 0) {
      hip.add(buildMesh(GEO.holster, SOLDIER_MATS.strap, [0.1, -0.15, 0.01]));
    }

    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    knee.add(buildMesh(GEO.kneeBall, this.look.cloth, [0, 0, 0]));
    knee.add(buildMesh(GEO.shin, this.look.cloth, [0, -0.16, 0], [1, 1, 0.95]));
    if (this.look.vest) knee.add(buildMesh(GEO.kneePad, SOLDIER_MATS.webbing, [0, 0.0, 0.075]));

    const ankle = new THREE.Group();
    ankle.position.y = -0.32;
    knee.add(ankle);
    ankle.add(buildMesh(GEO.cuff, this.look.cloth, [0, 0.0, 0]));
    ankle.add(buildMesh(GEO.boot, this.look.boots, [0, -0.1, 0.05]));

    return { hip, knee, ankle, side };
  }

  createArm(side, parent) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3, 0.52, 0);
    parent.add(shoulder);
    shoulder.add(buildMesh(GEO.upperArm, this.look.cloth, [0, -0.15, 0]));

    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    shoulder.add(elbow);
    elbow.add(buildMesh(GEO.elbowBall, this.look.cloth, [0, 0, 0]));
    elbow.add(buildMesh(GEO.forearm, this.look.cloth, [0, -0.13, 0]));
    if (this.look.vest) elbow.add(buildMesh(GEO.elbowPad, SOLDIER_MATS.webbing, [0, 0.0, -0.03]));
    elbow.add(buildMesh(GEO.armCuff, this.look.cloth, [0, -0.235, 0]));

    const wrist = new THREE.Group();
    wrist.position.y = -0.26;
    elbow.add(wrist);

    // Hand: a simple glove block. A Group so props can parent to it.
    const hand = new THREE.Group();
    hand.position.y = -0.02;
    wrist.add(hand);
    const glove = this.look.gloves;
    hand.add(buildMesh(GEO.palm, glove, [0, -0.03, 0]));

    return { shoulder, elbow, wrist, hand, side };
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
