import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { LIFELINE, TILLER_GRIP_LOCAL } from './Boat.js';
import { createArmScratch, solveArm } from './armIK.js';

// The officer sits on the rear seat against the transom, offset toward the
// left pontoon: the left hand holds the lifeline, the right works the tiller.
// Both hands are solved with 2-bone IK every frame so they stay put while the
// boat rolls.
const SEATED_OFFICER = Object.freeze({
  x: -1.11,
  y: 0.0356,
  z: 0.4,
  scale: 0.72,
  facing: Math.PI / 2
});

const SHOULDER_RIGHT = new THREE.Vector3(0.3, 1.55, 0);
const SHOULDER_LEFT = new THREE.Vector3(-0.3, 1.55, 0);
const ARM_POLE_RIGHT = new THREE.Vector3(1, 0, 0);
const ARM_POLE_LEFT = new THREE.Vector3(-1, 0, 0);
const GRIP_X = -1.0;
const HAND_LIFT = 0.09;
const UP = new THREE.Vector3(0, 1, 0);

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
    this.shoulderRight = SHOULDER_RIGHT.clone();
    this.shoulderLeft = SHOULDER_LEFT.clone();
    this.spineInverse = new THREE.Quaternion();
    this.reverseAmount = 0; // eased 0..1: how far the operator is looking back
    this.headLook = 0; // extra head yaw (radians) added on top of the enemy gaze

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

  /**
   * When reversing, turn the torso and head a little toward the direction of
   * travel. Eased slowly so neither the body nor the POV camera swings fast.
   * Returns the eased 0..1 amount.
   */
  updateReverseLook(dt, { fullSpeed, torsoYaw, headYaw, smoothing }) {
    const target = THREE.MathUtils.clamp(-this.boat.speed / fullSpeed, 0, 1);
    this.reverseAmount += (target - this.reverseAmount) * (1 - Math.exp(-dt * smoothing));
    const spine = this.soldier.joints.spine;
    spine.rotation.y = torsoYaw * this.reverseAmount;
    this.headLook = headYaw * this.reverseAmount;
    return this.reverseAmount;
  }

  update() {
    // Keep the shoulders (and the IK that targets them) in step with the turned spine.
    const yaw = this.soldier.joints.spine.rotation.y;
    this.shoulderRight.copy(SHOULDER_RIGHT).applyAxisAngle(UP, yaw);
    this.shoulderLeft.copy(SHOULDER_LEFT).applyAxisAngle(UP, yaw);
    this.spineInverse.setFromAxisAngle(UP, -yaw);
    this.boat.group.updateMatrixWorld(true);
    this.solveRightHand();
    this.solveLeftHand();
  }

  solveRightHand() {
    this.target.set(TILLER_GRIP_LOCAL.x, TILLER_GRIP_LOCAL.y, TILLER_GRIP_LOCAL.z);
    this.boat.motorPivot.localToWorld(this.target);
    this.target.y += HAND_LIFT;
    solveArm(this.rightArm, this.group, this.shoulderRight, ARM_POLE_RIGHT, this.target, this.scratch);
    this.rightArm.shoulder.quaternion.premultiply(this.spineInverse);
  }

  solveLeftHand() {
    // Hold the lifeline rope on the left pontoon (hull space, so it follows roll).
    this.target.set(GRIP_X, LIFELINE.y, LIFELINE.z);
    this.boat.hull.localToWorld(this.target);
    solveArm(this.leftArm, this.group, this.shoulderLeft, ARM_POLE_LEFT, this.target, this.scratch);
    this.leftArm.shoulder.quaternion.premultiply(this.spineInverse);
  }
}
