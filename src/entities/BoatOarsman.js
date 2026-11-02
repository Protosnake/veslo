import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { Oar } from './Oar.js';
import { createArmScratch, solveArm, MAX_REACH } from './armIK.js';

// The oarsman sits on the raised front bench facing the motor, with one oar per
// side. Each hand is solved onto its own oar shaft, so the hands follow every
// swing independently (one oar, or both when enemies are on both sides).
const OARSMAN = Object.freeze({ y: -0.53, scale: 0.72, facing: -Math.PI / 2 });

const SHOULDER_RIGHT = new THREE.Vector3(0.3, 1.55, 0);
const SHOULDER_LEFT = new THREE.Vector3(-0.3, 1.55, 0);
const ARM_POLE_RIGHT = new THREE.Vector3(1, 0, 0);
const ARM_POLE_LEFT = new THREE.Vector3(-1, 0, 0);

// One grip point per oar on the inboard handle (-Y of the oarlock), like a real rower.
const GRIP_RIGHT = new THREE.Vector3(0, -0.55, 0.02);
const GRIP_LEFT = new THREE.Vector3(0, -0.55, -0.02);
// Inboard stretch of the shaft the hand may slide along when the oar swings
// away, so the hand stays on the oar instead of detaching.
const GRIP_MIN_Y = -0.68;
const GRIP_MAX_Y = 0.6;
const GRIP_REACH_MARGIN = 0.92;

export class BoatOarsman {
  constructor(boat) {
    this.boat = boat;
    this.soldier = new Soldier({ pose: 'sitRow' });
    this.group = this.soldier.group;
    this.group.rotation.y = OARSMAN.facing;
    this.group.scale.setScalar(OARSMAN.scale);
    this.group.position.y = OARSMAN.y;
    boat.oarsmanMount.add(this.group);

    this.oarLeft = new Oar();
    boat.attachOar(this.oarLeft, 'left');

    this.oarRight = new Oar();
    boat.attachOar(this.oarRight, 'right');

    this.rightArm = this.soldier.arms.right;
    this.leftArm = this.soldier.arms.left;
    this.scratch = createArmScratch();
    this.target = new THREE.Vector3();
    this.shoulderOar = new THREE.Vector3();
    this.local = new THREE.Vector3();

    this.update();
  }

  update() {
    this.boat.group.updateMatrixWorld(true);
    // Facing the motor, the soldier's right arm is on the port (+Z) oar.
    this.solveHand(this.rightArm, SHOULDER_RIGHT, ARM_POLE_RIGHT, this.oarLeft, GRIP_RIGHT);
    this.solveHand(this.leftArm, SHOULDER_LEFT, ARM_POLE_LEFT, this.oarRight, GRIP_LEFT);
  }

  solveHand(arm, shoulderLocal, pole, oar, grip) {
    this.target.copy(grip);
    oar.group.localToWorld(this.target);

    // If the preferred grip is out of reach, slide the hand along the shaft to
    // the point nearest the shoulder.
    this.local.copy(this.target);
    this.group.worldToLocal(this.local);
    if (this.local.distanceTo(shoulderLocal) > MAX_REACH * GRIP_REACH_MARGIN) {
      this.shoulderOar.copy(shoulderLocal);
      this.group.localToWorld(this.shoulderOar);
      oar.group.worldToLocal(this.shoulderOar);
      this.target.set(
        grip.x,
        THREE.MathUtils.clamp(this.shoulderOar.y, GRIP_MIN_Y, GRIP_MAX_Y),
        grip.z
      );
      oar.group.localToWorld(this.target);
    }
    solveArm(arm, this.group, shoulderLocal, pole, this.target, this.scratch);
  }
}
