import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { Oar } from './Oar.js';
import { createArmScratch, solveArm } from './armIK.js';

// The oarsman sits on the raised front bench facing the motor, with one oar per
// side. Each hand is solved onto its own oar shaft, so the hands follow every
// swing independently (one oar, or both when enemies are on both sides).
const OARSMAN = Object.freeze({ y: -0.53, scale: 0.72, facing: -Math.PI / 2 });

const SHOULDER_RIGHT = new THREE.Vector3(0.3, 1.55, 0);
const SHOULDER_LEFT = new THREE.Vector3(-0.3, 1.55, 0);
const ARM_POLE_RIGHT = new THREE.Vector3(1, 0, 0);
const ARM_POLE_LEFT = new THREE.Vector3(-1, 0, 0);

// One grip point per oar, along the shaft (+Y).
const GRIP_RIGHT = new THREE.Vector3(0, 0.15, 0.02);
const GRIP_LEFT = new THREE.Vector3(0, 0.15, -0.02);

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
    solveArm(arm, this.group, shoulderLocal, pole, this.target, this.scratch);
  }
}
