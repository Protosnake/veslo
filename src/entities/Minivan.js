import * as THREE from 'three';

export class Minivan {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.wheels = [];
    this.doors = [];
    this.doorOpen = 0;
    this.doorTarget = 0;

    this.build();
    scene.add(this.group);
  }

  build() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd7dce1,
      roughness: 0.58,
      metalness: 0.16
    });
    const lowerMat = new THREE.MeshLambertMaterial({ color: 0x69727b });
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x22313b });
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x101214 });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0x9aa4ad });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 4.4), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    this.group.add(body);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.42, 4.42), lowerMat);
    skirt.position.y = 0.48;
    skirt.castShadow = true;
    this.group.add(skirt);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.95, 2.7), bodyMat);
    cabin.position.set(0, 1.72, -0.1);
    cabin.castShadow = true;
    this.group.add(cabin);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.97, 0.58, 2.2), windowMat);
    sideGlass.position.set(0, 1.78, -0.1);
    this.group.add(sideGlass);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 0.08), windowMat);
    windshield.position.set(0, 1.76, 1.28);
    this.group.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.56, 0.08), windowMat);
    rearGlass.position.set(0, 1.76, -1.48);
    this.group.add(rearGlass);

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0xc3cbd2,
      roughness: 0.62,
      metalness: 0.14
    });
    const doorGapMat = new THREE.MeshBasicMaterial({ color: 0x0d1114 });
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x2a3137 });

    const doorPanelGeo = new THREE.BoxGeometry(0.06, 0.96, 1.12);
    const doorGlassGeo = new THREE.BoxGeometry(0.02, 0.5, 0.9);
    const doorGapGeo = new THREE.BoxGeometry(0.02, 1.02, 1.16);
    const handleGeo = new THREE.BoxGeometry(0.045, 0.09, 0.22);

    for (const side of [-1, 1]) {
      const gap = new THREE.Mesh(doorGapGeo, doorGapMat);
      gap.position.set(side * 1.062, 1.02, -0.54);
      this.group.add(gap);

      // Rear passenger doors hinge at their front edge and swing outward.
      const door = new THREE.Group();
      door.position.set(side * 1.08, 0, 0.02);
      door.userData.side = side;

      const panel = new THREE.Mesh(doorPanelGeo, doorMat);
      panel.position.set(0, 1.02, -0.56);
      panel.castShadow = true;
      door.add(panel);

      const glass = new THREE.Mesh(doorGlassGeo, windowMat);
      glass.position.set(side * 0.04, 1.64, -0.56);
      door.add(glass);

      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(side * 0.036, 1.16, -0.94);
      door.add(handle);

      this.group.add(door);
      this.doors.push(door);
    }

    const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.28), lowerMat);
    bumperFront.position.set(0, 0.56, 2.22);
    this.group.add(bumperFront);

    const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.28), lowerMat);
    bumperRear.position.set(0, 0.56, -2.22);
    this.group.add(bumperRear);

    for (const x of [-0.72, 0.72]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.08), headlightMat);
      headlight.position.set(x, 0.95, 2.23);
      this.group.add(headlight);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), tailMat);
      tail.position.set(x, 0.98, -2.23);
      this.group.add(tail);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8);
    rimGeo.rotateZ(Math.PI / 2);

    for (const x of [-1.0, 1.0]) {
      for (const z of [-1.45, 1.45]) {
        const wheel = new THREE.Group();
        wheel.position.set(x, 0.42, z);

        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.castShadow = true;
        wheel.add(tire);

        const rim = new THREE.Mesh(rimGeo, rimMat);
        wheel.add(rim);

        this.group.add(wheel);
        this.wheels.push(wheel);
      }
    }
  }

  setPose(frame, lateral = 0) {
    this.group.position.set(
      frame.x + frame.nx * lateral,
      frame.y,
      frame.z + frame.nz * lateral
    );
    this.group.rotation.y = frame.heading;
  }

  update(dt, speed) {
    const spin = (speed * dt) / 0.42;
    for (const wheel of this.wheels) {
      wheel.rotation.x += spin;
    }

    this.doorOpen = THREE.MathUtils.damp(this.doorOpen, this.doorTarget, 9, dt);
    const eased = this.doorOpen * this.doorOpen * (3 - 2 * this.doorOpen);
    for (const door of this.doors) {
      const side = door.userData.side || 1;
      door.rotation.y = -side * 1.25 * eased;
    }
  }

  openDoors() {
    this.doorTarget = 1;
  }

  closeDoors() {
    this.doorTarget = 0;
  }

  getDoorWorldPosition(side = 1) {
    this.group.updateMatrixWorld(true);
    return this.group.localToWorld(
      new THREE.Vector3(side * 1.32, 0, -0.5)
    );
  }

  getExhaustWorldPosition() {
    this.group.updateMatrixWorld(true);
    return this.group.localToWorld(
      new THREE.Vector3(0.72, 0.3, -2.24)
    );
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }
}
