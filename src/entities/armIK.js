import * as THREE from 'three';

const UPPER_ARM_LENGTH = 0.3;
const FOREARM_LENGTH = 0.28;
export const MAX_REACH = UPPER_ARM_LENGTH + FOREARM_LENGTH - 0.005;

export function createArmScratch() {
  return {
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
}

// Two-bone IK: shoulder to hand. `root` is the soldier group the shoulder lives
// under; `targetWorld` is where the hand should land. Caller updates matrices.
export function solveArm(arm, root, shoulderLocal, pole, targetWorld, scratch) {
  arm.shoulder.getWorldPosition(scratch.shoulderWorld);

  scratch.targetLocal.copy(targetWorld);
  root.worldToLocal(scratch.targetLocal);
  scratch.v.copy(scratch.targetLocal).sub(shoulderLocal);

  const distance = scratch.v.length();
  if (distance > MAX_REACH) scratch.v.setLength(MAX_REACH);
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
