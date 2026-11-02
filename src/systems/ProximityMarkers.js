import * as THREE from 'three';
import { MARKER_TUNING } from '../config/world.js';

// An invisible ring around the boat. Every swimmer inside MARKER_TUNING.range
// gets a flat triangle on that ring pointing at it, so threats stay readable
// from the low FPV chase camera. Triangles grow and brighten as the swimmer
// closes in, and dim while it is diving.
export class ProximityMarkers {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      1, 0, 0,
      -0.7, 0, 0.8,
      -0.7, 0, -0.8
    ], 3));
    geo.setIndex([0, 2, 1]);
    geo.computeVertexNormals();

    this.group = new THREE.Group();
    this.group.visible = MARKER_TUNING.enabled;
    scene.add(this.group);

    this.pool = [];
    this.labels = [];
    for (let i = 0; i < MARKER_TUNING.maxMarkers; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xff4a3d,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        fog: false
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.renderOrder = 20;
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.pool.push(mesh);

      // Distance label (metres) floating over the triangle.
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 48;
      const texture = new THREE.CanvasTexture(canvas);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        fog: false
      }));
      label.renderOrder = 21;
      label.visible = false;
      label.scale.set(2.6 * MARKER_TUNING.labelScale, 0.98 * MARKER_TUNING.labelScale, 1);
      label.frustumCulled = false;
      label.userData = { canvas, texture, meters: -1 };
      this.group.add(label);
      this.labels.push(label);
    }
    this.time = 0;

    // Redraw labels once the HUD font has loaded.
    document.fonts?.load("600 34px 'Oswald'").then(() => {
      for (const label of this.labels) label.userData.meters = -1;
    }).catch(() => {});
  }

  hide() {
    for (const mesh of this.pool) mesh.visible = false;
    for (const label of this.labels) label.visible = false;
  }

  update(dt, boat, smugglers) {
    if (!MARKER_TUNING.enabled) return;
    this.time += dt;

    const { radius, range, size } = MARKER_TUNING;
    const bx = boat.position.x;
    const bz = boat.position.z;
    let used = 0;

    // One entry per swimmer in range; entries are merged below if there are too many.
    let groups = [];
    for (const s of smugglers) {
      if (s.isDead || s.state !== 'swimming') continue;
      const dx = s.position.x - bx;
      const dz = s.position.z - bz;
      const dist = Math.hypot(dx, dz);
      if (dist > range || dist < 0.001) continue;
      groups.push({ dx, dz, dist, angle: Math.atan2(dz, dx), diving: !!s.isDiving, sum: dist, count: 1 });
    }

    // Merge the two arrows pointing in the most similar direction until the cap is met.
    // The merged arrow keeps the direction of its nearest swimmer; the label shows the group's average distance.
    const cap = Math.min(this.pool.length, MARKER_TUNING.maxMarkers);
    const mergeGap = THREE.MathUtils.degToRad(MARKER_TUNING.mergeAngleDeg);
    while (groups.length > 1) {
      groups.sort((p, q) => p.angle - q.angle);
      let best = 0;
      let bestGap = Infinity;
      for (let i = 0; i < groups.length; i++) {
        const j = (i + 1) % groups.length;
        let gap = groups[j].angle - groups[i].angle;
        if (gap < 0) gap += Math.PI * 2;
        if (gap < bestGap) { bestGap = gap; best = i; }
      }
      // Also merge arrows so close together that their labels would overlap.
      if (groups.length <= cap && bestGap >= mergeGap) break;
      const j = (best + 1) % groups.length;
      const a = groups[best];
      const b = groups[j];
      const keep = a.dist <= b.dist ? a : b;
      keep.diving = a.diving && b.diving;
      keep.sum = a.sum + b.sum;
      keep.count = a.count + b.count;
      groups = groups.filter((g) => g !== a && g !== b);
      groups.push(keep);
    }

    for (const g of groups) {
      const { dx, dz, dist } = g;
      const closeness = Math.min(1, Math.max(0, 1 - dist / MARKER_TUNING.falloffDistance));
      const mesh = this.pool[used++];
      // Sit on the ring, but never past the swimmer itself.
      const place = Math.min(radius, Math.max(1.5, dist - 1.2));
      mesh.position.set(bx + (dx / dist) * place, 0.4, bz + (dz / dist) * place);
      mesh.rotation.set(0, -Math.atan2(dz, dx), 0);
      const pulse = 1 + 0.12 * Math.sin(this.time * 8 + dist);
      mesh.scale.setScalar(size * (0.7 + closeness * 0.9) * pulse);
      mesh.material.opacity = MARKER_TUNING.opacity * (MARKER_TUNING.minOpacityFraction + closeness * (1 - MARKER_TUNING.minOpacityFraction)) * (g.diving ? 0.75 : 1);
      mesh.visible = true;

      const label = this.labels[used - 1];
      const meters = Math.round(g.sum / g.count);
      if (label.userData.meters !== meters) {
        label.userData.meters = meters;
        const ctx = label.userData.canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 48);
        ctx.font = "600 34px 'Oswald', 'Trebuchet MS', system-ui, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.fillStyle = '#ff8a7d';
        ctx.strokeText(`${meters} m`, 64, 24);
        ctx.fillText(`${meters} m`, 64, 24);
        label.userData.texture.needsUpdate = true;
      }
      label.position.set(mesh.position.x, 1.5, mesh.position.z);
      label.material.opacity = mesh.material.opacity;
      label.visible = true;
    }

    for (let i = used; i < this.pool.length; i++) {
      this.pool[i].visible = false;
      this.labels[i].visible = false;
    }
  }
}
