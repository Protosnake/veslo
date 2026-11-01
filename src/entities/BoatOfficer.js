import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { LIFELINE, TILLER_GRIP_LOCAL } from './Boat.js';
import { createArmScratch, solveArm } from './armIK.js';

// The officer sits on the rear seat against the transom, works the tiller with
// the right hand and rests the left on the inboard lifeline. Both hands are
// solved with 2-bone IK every frame so they stay on their grips while the boat
// rolls and the motor turns.
const SEATED_OFFICER = Object.freeze({
  x: -1.11,
  y: 0.1156,
  z: 0.3,
  scale: 0.72,
  facing: Math.PI / 2
});

const SHOULDER_RIGHT = new THREE.Vector3(0.3, 1.55, 0);
const SHOULDER_LEFT = new THREE.Vector3(-0.3, 1.55, 0);
const ARM_POLE_RIGHT = new THREE.Vector3(1, 0, 0);
const ARM_POLE_LEFT = new THREE.Vector3(-1, 0, 0);
const HAND_LIFT = 0.09;

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

    this.ropeY =
      LIFELINE.y -
      Math.sin(
        Math.PI *
          ((SEATED_OFFICER.x - LIFELINE.xMin) / (LIFELINE.xMax - LIFELINE.xMin))
      ) *
        LIFELINE.sag;

    this.scratch = createArmScratch();
    this.target = new THREE.Vector3();

    this.update();
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
    this.target.set(SEATED_OFFICER.x, this.ropeY, LIFELINE.z);
    this.boat.group.localToWorld(this.target);
    solveArm(this.leftArm, this.group, SHOULDER_LEFT, ARM_POLE_LEFT, this.target, this.scratch);
  }
}
