import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { LIFELINE, TILLER_GRIP_LOCAL } from './Boat.js';

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

const UPPER_ARM_LENGTH = 0.3;
const FOREARM_LENGTH = 0.28;
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

    this.scratch = {
      shoulderWorld: new THREE.Vector3(),
      targetWorld: new THREE.Vector3(),
      targetLocal: new THREE.Vector3(),
      v: new THREE.Vector3(),
      vHat: new THREE.Vector3(),
      polePerp: new THREE.Vector3(),
      u: new THREE.Vector3(),
      n: new THREE.Vector3(),
      w: new THREE.Vector3(),
      cross: new THREE.Vector3(),
      xAxis: new THREE.Vector3(),
      yAxis: new THREE.Vector3(),
      zAxis: new THREE.Vector3(),
      basis: new THREE.Matrix4(),
      quat: new THREE.Quaternion()
    };

    this.update(0);
  }

  update() {
    this.solveRightHand();
    this.solveLeftHand();
  }

  solveArm(arm, shoulderLocal, pole, targetWorld) {
    const scratch = this.scratch;
    const boat = this.boat;

    boat.group.updateMatrixWorld(true);
    arm.shoulder.getWorldPosition(scratch.shoulderWorld);

    scratch.targetLocal.copy(targetWorld);
    this.group.worldToLocal(scratch.targetLocal);
    scratch.v.copy(scratch.targetLocal).sub(shoulderLocal);

    const distance = scratch.v.length();
    const maxReach = UPPER_ARM_LENGTH + FOREARM_LENGTH - 0.005;
    if (distance > maxReach) scratch.v.setLength(maxReach);
    else if (distance < 0.02) scratch.v.set(0, -1, 0);

    const d = scratch.v.length();
    scratch.vHat.copy(scratch.v).divideScalar(d);

    const alpha = Math.acos(
      THREE.MathUtils.clamp(
        (UPPER_ARM_LENGTH ** 2 + d ** 2 - FOREARM_LENGTH ** 2) /
          (2 * UPPER_ARM_LENGTH * d),
        -1,
        1
      )
    );

    scratch.polePerp.copy(pole).addScaledVector(scratch.vHat, -pole.dot(scratch.vHat));
    if (scratch.polePerp.lengthSq() < 1e-6) {
      scratch.polePerp.set(0, 0, 1).addScaledVector(scratch.vHat, -scratch.vHat.z);
    }
    scratch.polePerp.normalize();

    scratch.u
      .copy(scratch.vHat)
      .multiplyScalar(Math.cos(alpha))
      .addScaledVector(scratch.polePerp, Math.sin(alpha))
      .normalize();

    scratch.n.crossVectors(scratch.u, scratch.vHat).normalize();

    scratch.xAxis.copy(scratch.n);
    scratch.yAxis.copy(scratch.u).multiplyScalar(-1);
    scratch.zAxis.crossVectors(scratch.xAxis, scratch.yAxis);
    scratch.basis.makeBasis(scratch.xAxis, scratch.yAxis, scratch.zAxis);
    scratch.quat.setFromRotationMatrix(scratch.basis);
    arm.shoulder.quaternion.copy(scratch.quat);

    scratch.w
      .copy(scratch.v)
      .addScaledVector(scratch.u, -UPPER_ARM_LENGTH)
      .divideScalar(FOREARM_LENGTH)
      .normalize();
    scratch.cross.crossVectors(scratch.u, scratch.w);
    arm.elbow.rotation.x = Math.atan2(scratch.n.dot(scratch.cross), scratch.u.dot(scratch.w));
  }

  solveRightHand() {
    const scratch = this.scratch;
    scratch.targetWorld.set(TILLER_GRIP_LOCAL.x, TILLER_GRIP_LOCAL.y, TILLER_GRIP_LOCAL.z);
    this.boat.motorPivot.localToWorld(scratch.targetWorld);
    scratch.targetWorld.y += HAND_LIFT;
    this.solveArm(this.rightArm, SHOULDER_RIGHT, ARM_POLE_RIGHT, scratch.targetWorld);
  }

  solveLeftHand() {
    const scratch = this.scratch;
    scratch.targetWorld.set(SEATED_OFFICER.x, this.ropeY, LIFELINE.z);
    this.boat.group.localToWorld(scratch.targetWorld);
    this.solveArm(this.leftArm, SHOULDER_LEFT, ARM_POLE_LEFT, scratch.targetWorld);
  }
}
