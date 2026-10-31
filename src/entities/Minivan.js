import * as THREE from 'three';

export class Minivan {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.wheels = [];

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
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }
}
