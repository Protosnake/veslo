import * as THREE from 'three';

const MATS = {
  body: new THREE.MeshStandardMaterial({ color: 0x1d231b, roughness: 0.7, metalness: 0.25, flatShading: true }),
  face: new THREE.MeshLambertMaterial({ color: 0x0e110c, flatShading: true }),
  grille: new THREE.MeshLambertMaterial({ color: 0x050605 }),
  knob: new THREE.MeshStandardMaterial({ color: 0x3a3f36, roughness: 0.5, metalness: 0.5 }),
  button: new THREE.MeshLambertMaterial({ color: 0x4a2a1c }),
  antenna: new THREE.MeshStandardMaterial({ color: 0x0b0d0a, roughness: 0.8 }),
  led: new THREE.MeshBasicMaterial({ color: 0xff4433 })
};

const GEO = {
  body: new THREE.BoxGeometry(0.1, 0.15, 0.05),
  face: new THREE.BoxGeometry(0.086, 0.12, 0.012),
  grilleSlot: new THREE.BoxGeometry(0.06, 0.007, 0.006),
  knob: new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8),
  button: new THREE.BoxGeometry(0.022, 0.05, 0.018),
  antenna: new THREE.CylinderGeometry(0.006, 0.01, 0.12, 6),
  antennaBase: new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8),
  led: new THREE.SphereGeometry(0.008, 6, 5),
  stroke: new THREE.BoxGeometry(0.05, 0.012, 0.004)
};

function part(geometry, material, position, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  return mesh;
}

// Chest-mounted tactical radio. Origin is the centre of the back face, +z is
// the front, so a parent only needs to position it on the plate carrier.
// `led` and `pttButton` are exposed for later interactions (blink, key-up).
export class ChestRadio {
  constructor() {
    this.group = new THREE.Group();
    this.group.add(part(GEO.body, MATS.body, [0, 0, 0.025]));
    this.group.add(part(GEO.face, MATS.face, [0, -0.005, 0.054]));

    for (let i = 0; i < 4; i += 1) {
      this.group.add(part(GEO.grilleSlot, MATS.grille, [0, -0.04 - i * 0.017, 0.061]));
    }

    this.led = part(GEO.led, MATS.led, [-0.025, 0.045, 0.062]);
    this.group.add(this.led);

    this.group.add(part(GEO.knob, MATS.knob, [0.03, 0.09, 0.02]));
    this.pttButton = part(GEO.button, MATS.button, [0.06, 0.0, 0.03]);
    this.group.add(this.pttButton);

    this.group.add(part(GEO.antennaBase, MATS.knob, [-0.03, 0.085, 0.02]));
    this.group.add(part(GEO.antenna, MATS.antenna, [-0.035, 0.15, 0.015], [0, 0, 0.12]));

    this.buildBurst();
    this.time = 0;
    this.base = null;
  }

  // Cartoon "vibrating" strokes: short bars radiating from the radio that pulse
  // outward and fade, like the motion lines drawn around a buzzing phone.
  buildBurst() {
    this.burst = new THREE.Group();
    this.burst.position.set(0, 0.02, 0.07);
    this.burst.visible = false;
    this.group.add(this.burst);
    this.strokes = [];
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / count;
      const material = new THREE.MeshBasicMaterial({
        color: 0xffe14a,
        transparent: true,
        depthTest: false
      });
      const mesh = new THREE.Mesh(GEO.stroke, material);
      mesh.renderOrder = 10;
      const holder = new THREE.Group();
      holder.rotation.z = angle;
      holder.add(mesh);
      this.burst.add(holder);
      this.strokes.push({ mesh, material, phase: (i % 4) / 4 });
    }
  }

  /** Shake the radio and emit motion strokes while `active`; call every frame. */
  update(dt, active) {
    if (!this.base) this.base = this.group.position.clone();
    if (!active) {
      if (this.burst.visible) {
        this.burst.visible = false;
        this.group.position.copy(this.base);
        this.group.rotation.set(0, 0, 0);
      }
      return;
    }
    this.time += dt;
    const t = this.time;
    this.burst.visible = true;
    // High-frequency jitter plus a slow wobble.
    this.group.position.set(
      this.base.x + Math.sin(t * 90) * 0.006,
      this.base.y + Math.sin(t * 110 + 1) * 0.006,
      this.base.z
    );
    this.group.rotation.z = Math.sin(t * 70) * 0.12;
    for (const stroke of this.strokes) {
      const k = (t * 2.2 + stroke.phase) % 1;
      stroke.mesh.position.x = 0.09 + k * 0.1;
      stroke.mesh.scale.setScalar(1 - k * 0.4);
      stroke.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.95;
    }
  }
}
