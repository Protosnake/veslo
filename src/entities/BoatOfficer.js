import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { TILLER_GRIP_LOCAL } from './Boat.js';
import { createArmScratch, solveArm } from './armIK.js';

// The officer sits on the rear seat against the transom, works the tiller with
// the right hand and rests the left on the inboard lifeline. Both hands are
// solved with 2-bone IK every frame so they stay on their grips while the boat
// rolls and the motor turns.
const SEATED_OFFICER = Object.freeze({
  x: -1.11,
  y: 0.0356,
  z: 0.3,
  scale: 0.72,
  facing: Math.PI / 2
});

const SHOULDER_RIGHT = new THREE.Vector3(0.3, 1.55, 0);
const SHOULDER_LEFT = new THREE.Vector3(-0.3, 1.55, 0);
const ARM_POLE_RIGHT = new THREE.Vector3(1, 0, 0);
const ARM_POLE_LEFT = new THREE.Vector3(-1, 0, 0);
const HAND_LIFT = 0.09;
const HAND_REST_Y = 0.85;
const HAND_REST_Z = 0.62;

export class BoatOfficer {
  constructor(boat) {
    this.boat = boat;
    this.soldier = new Soldier({ pose: 'sitSteer' });
    this.group = this.soldier.group;

    const mount = boat.officerGroup;
    mount.position.set(SEATED_OFFICER.x, SEATED_OFFICER.y, SEATED_OFFICER.z);
    mount.rotation.y = SEATED_OFFICER.facing;
    mount.scale.setScalar(SEATED_OFFICER.scale);
    mount.add(this.group);

    this.rightArm = this.soldier.arms.right;
    this.leftArm = this.soldier.arms.left;

    this.scratch = createArmScratch();
    this.target = new THREE.Vector3();

    this.update();
  }

  /** Mount for a first-person camera: eye on the head, facing the way the boat does. */
  getCameraMount() {
    return { anchor: this.soldier.joints.head, orientation: this.boat.officerGroup };
  }

  /** Hide the head/helmet so a POV camera sitting inside it sees nothing of it. */
  setHeadVisible(visible) {
    this.soldier.joints.head.visible = visible;
  }

  update() {
    this.boat.group.updateMatrixWorld(true);
    this.solveRightHand();
    this.solveLeftHand();
  }

  solveRightHand() {
    this.target.set(TILLER_GRIP_LOCAL.x, TILLER_GRIP_LOCAL.y, TILLER_GRIP_LOCAL.z);
    this.boat.motorPivot.localToWorld(this.target);
    this.target.y += HAND_LIFT;
    solveArm(this.rightArm, this.group, SHOULDER_RIGHT, ARM_POLE_RIGHT, this.target, this.scratch);
  }

  solveLeftHand() {
    // The lifeline now sits on top of the thinner pontoon, out of arm's reach,
    // so the left hand rests on the hull rim beside the seat instead.
    this.target.set(SEATED_OFFICER.x, HAND_REST_Y, HAND_REST_Z);
    this.boat.group.localToWorld(this.target);
    solveArm(this.leftArm, this.group, SHOULDER_LEFT, ARM_POLE_LEFT, this.target, this.scratch);
  }
}
