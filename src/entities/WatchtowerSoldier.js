import * as THREE from 'three';
import { Soldier, SOLDIER_MATS } from './Soldier.js';

export class WatchtowerSoldier {
  constructor(scene) {
    this.scene = scene;
    this.soldier = new Soldier({ pose: 'idle' });
    this.group = this.soldier.group;
    this.group.visible = false;
    this.mode = 'idle';
    this.modeTime = 0;

    this.buildProps();
    scene.add(this.group);
  }

  buildProps() {
    this.binoculars = new THREE.Group();
    const tubeGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.2, 8);
    for (const side of [-1, 1]) {
      const tube = new THREE.Mesh(tubeGeo, SOLDIER_MATS.metal);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(side * 0.088, 0, 0);
      this.binoculars.add(tube);

      const eyepiece = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8),
        SOLDIER_MATS.metal
      );
      eyepiece.rotation.x = Math.PI / 2;
      eyepiece.position.set(side * 0.088, 0, -0.11);
      this.binoculars.add(eyepiece);
    }
    this.binoculars.position.set(0, 1.84, 0.26);
    this.binoculars.visible = false;
    this.group.add(this.binoculars);

    this.radio = new THREE.Group();
    const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.055), SOLDIER_MATS.metal);
    radioBody.position.y = 0.02;
    this.radio.add(radioBody);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.17, 5),
      SOLDIER_MATS.metal
    );
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

    this.soldier.arms.right.hand.add(this.radio);
  }

  setMode(mode, immediate = false) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.modeTime = 0;

    this.binoculars.visible = mode === 'binoculars';
    this.radio.visible = mode === 'radio';

    const pose = mode === 'binoculars' ? 'eyes' : mode === 'radio' ? 'radioDown' : 'idle';
    this.soldier.setPose(pose, immediate);
  }

  reset() {
    this.mode = 'idle';
    this.modeTime = 0;
    this.binoculars.visible = false;
    this.radio.visible = false;
    this.soldier.setPose('idle', true);
  }

  update(dt) {
    this.modeTime += dt;

    if (this.mode === 'radio') {
      this.soldier.setPose(this.modeTime < 0.5 ? 'radioDown' : 'radioUp');
    }

    this.soldier.update(dt);

    if (this.mode === 'radio') {
      const bob = Math.sin(this.modeTime * 2.2) * 0.02;
      this.radio.rotation.z = bob;
      this.radio.rotation.x = -(
        this.soldier.arms.right.shoulder.rotation.x + this.soldier.arms.right.elbow.rotation.x
      );
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
