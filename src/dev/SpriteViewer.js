import * as THREE from 'three';
import './SpriteViewer.css';
import { SPRITE_GROUPS, SPRITE_BY_ID, SPRITES } from './sprites.js';

const BACKGROUNDS = [0x151b1f, 0x26323a, 0x45565f, 0x7dc0ea];
const MIN_POLAR = 0.08;
const MAX_POLAR = Math.PI * 0.49;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dimensionsText(box) {
  const size = box.getSize(new THREE.Vector3());
  return `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`;
}

export class SpriteViewer {
  constructor() {
    this.cache = new Map();
    this.active = null;
    this.activeId = null;
    this.autoRotate = false;
    this.wireframe = false;
    this.paused = false;
    this.showGrid = true;
    this.backgroundIndex = 0;

    this.target = new THREE.Vector3();
    this.theta = Math.PI * 0.23;
    this.phi = Math.PI * 0.36;
    this.radius = 8;
    this.fitRadius = 8;
    this.minRadius = 1;
    this.maxRadius = 40;

    this.pointers = new Map();
    this.mode = null;
    this.pinchDistance = 0;
    this.input = { left: false, right: false };

    this.time = 0;
  }

  mount() {
    if (document.getElementById('sprite-lab')) return this;
    document.body.classList.add('sprite-lab-open');

    const root = document.createElement('div');
    root.id = 'sprite-lab';
    root.className = 'sprite-lab';
    root.innerHTML = `
      <aside class="sprite-lab-sidebar">
        <header class="sprite-lab-header">
          <div class="sprite-lab-kicker">DEV // SPRITE LAB</div>
          <h1>Sprite viewer</h1>
          <p>Isolated model preview</p>
        </header>
        <nav class="sprite-lab-list" aria-label="Sprites"></nav>
        <footer class="sprite-lab-footer">
          <span>${SPRITES.length} sprites</span>
          <span>?dev=sprites</span>
        </footer>
      </aside>
      <main class="sprite-lab-main">
        <div class="sprite-lab-canvas"></div>
        <div class="sprite-lab-topbar">
          <div class="sprite-lab-identity">
            <div class="sprite-lab-title" data-role="title">Loading</div>
            <div class="sprite-lab-note" data-role="note"></div>
          </div>
          <div class="sprite-lab-tools">
            <button type="button" data-action="steer-left">Steer left</button>
            <button type="button" data-action="steer-right">Steer right</button>
            <button type="button" data-action="autorotate">Auto-rotate</button>
            <button type="button" data-action="wireframe">Wireframe</button>
            <button type="button" data-action="grid" class="is-on">Grid</button>
            <button type="button" data-action="pause">Pause</button>
            <button type="button" data-action="background">Background</button>
            <button type="button" data-action="reset">Reset view</button>
          </div>
        </div>
        <div class="sprite-lab-meta">
          <span data-role="source"></span>
          <span data-role="dims"></span>
        </div>
        <div class="sprite-lab-rig" data-role="rig" hidden>
          <div class="sprite-lab-rig-head">
            <span>Rig joints</span>
            <button type="button" data-rig="reset">Reset pose</button>
          </div>
          <label class="sprite-lab-rig-joint">
            <span>Joint</span>
            <select data-rig="joint"></select>
          </label>
          <label class="sprite-lab-rig-axis" data-axis="x">
            <span>X</span>
            <input type="range" min="-180" max="180" step="1" value="0" />
            <output>0°</output>
          </label>
          <label class="sprite-lab-rig-axis" data-axis="y">
            <span>Y</span>
            <input type="range" min="-180" max="180" step="1" value="0" />
            <output>0°</output>
          </label>
          <label class="sprite-lab-rig-axis" data-axis="z">
            <span>Z</span>
            <input type="range" min="-180" max="180" step="1" value="0" />
            <output>0°</output>
          </label>
        </div>
        <div class="sprite-lab-hint">
          Drag to orbit · Wheel to zoom · Right-drag to pan · ←/→ switch sprite ·
          W wireframe · G grid · Space pause · A/D steer · O auto-rotate
        </div>
      </main>`;

    document.body.appendChild(root);
    this.root = root;
    this.canvasHost = root.querySelector('.sprite-lab-canvas');
    this.listEl = root.querySelector('.sprite-lab-list');
    this.titleEl = root.querySelector('[data-role="title"]');
    this.noteEl = root.querySelector('[data-role="note"]');
    this.sourceEl = root.querySelector('[data-role="source"]');
    this.dimsEl = root.querySelector('[data-role="dims"]');
    this.buttons = new Map(
      [...root.querySelectorAll('[data-action]')].map((button) => [button.dataset.action, button])
    );
    this.rigEl = root.querySelector('[data-role="rig"]');
    this.rigJointSelect = root.querySelector('[data-rig="joint"]');
    this.rigResetButton = root.querySelector('[data-rig="reset"]');
    this.rigAxes = [...root.querySelectorAll('.sprite-lab-rig-axis')].map((row) => ({
      axis: row.dataset.axis,
      input: row.querySelector('input'),
      output: row.querySelector('output')
    }));

    this.initScene();
    this.buildList();
    this.bindControls();
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvasHost);

    const requested = new URLSearchParams(window.location.search).get('sprite');
    const initial = requested && SPRITE_BY_ID.has(requested) ? requested : SPRITES[0]?.id;
    this.select(initial);
    this.clock = new THREE.Clock();
    this.animate();
    return this;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUNDS[this.backgroundIndex]);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 500);
    this.camera.position.set(6, 4, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvasHost.appendChild(this.renderer.domElement);

    this.stage = new THREE.Group();
    this.scene.add(this.stage);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 64),
      new THREE.MeshStandardMaterial({ color: 0x232b2f, roughness: 0.96, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    const grid = new THREE.GridHelper(40, 40, 0x6f8794, 0x39474e);
    grid.position.y = 0;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    grid.material.depthWrite = false;
    this.scene.add(grid);
    this.grid = grid;

    const hemisphere = new THREE.HemisphereLight(0xdfeef7, 0x2b3236, 1.35);
    this.scene.add(hemisphere);

    this.lightTarget = new THREE.Object3D();
    this.scene.add(this.lightTarget);

    this.keyLight = new THREE.DirectionalLight(0xfff1de, 2.4);
    this.keyLight.target = this.lightTarget;
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);

    const fill = new THREE.DirectionalLight(0x9dc7ea, 0.65);
    fill.position.set(-7, 5, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-1, 6, -9);
    this.scene.add(rim);
  }

  buildList() {
    for (const group of SPRITE_GROUPS) {
      const heading = document.createElement('div');
      heading.className = 'sprite-lab-group-title';
      heading.textContent = group.label;
      this.listEl.appendChild(heading);

      for (const sprite of group.sprites) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sprite-lab-item';
        button.dataset.sprite = sprite.id;
        button.innerHTML = `<span>${sprite.label}</span><small>${sprite.id}</small>`;
        button.addEventListener('click', () => this.select(sprite.id));
        this.listEl.appendChild(button);
      }
    }
  }

  getRecord(id) {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const entry = SPRITE_BY_ID.get(id);
    // Build into a holder group: entity constructors add themselves to the
    // scene they are given, so a throwing build cannot leave orphaned meshes
    // behind on the real stage.
    const holder = new THREE.Group();
    let record;
    try {
      record = entry.build(holder);
    } catch (error) {
      console.error(`[Sprite Lab] Failed to build "${id}"`, error);
      holder.clear();
      record = { roots: [], error };
    }
    record.entry = entry;

    const roots = new Set(record.roots);
    for (const child of holder.children) roots.add(child);
    record.roots = [...roots];

    for (const root of record.roots) {
      if (root.parent !== this.stage) this.stage.add(root);
      root.visible = false;
    }
    this.cache.set(id, record);
    return record;
  }

  select(id) {
    if (!id || id === this.activeId) return;
    if (this.active) {
      for (const root of this.active.roots) root.visible = false;
    }

    this.input.left = false;
    this.input.right = false;

    const record = this.getRecord(id);
    for (const root of record.roots) root.visible = true;
    if (record.reset) record.reset();
    this.active = record;
    this.activeId = id;
    this.setRig(record);

    this.frame(record);
    this.updateMeta(record);
    this.updateActiveItem();
    this.syncUrl();

    if (this.wireframe) this.applyWireframe(true);
  }

  syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('sprites');
    url.searchParams.delete('view');
    url.searchParams.set('dev', 'sprites');
    url.searchParams.set('sprite', this.activeId);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  updateActiveItem() {
    for (const button of this.listEl.querySelectorAll('.sprite-lab-item')) {
      button.classList.toggle('is-active', button.dataset.sprite === this.activeId);
    }
  }

  updateMeta(record) {
    const entry = record.entry;
    this.titleEl.textContent = entry.label;
    this.noteEl.textContent = record.error
      ? `Build failed: ${record.error.message}`
      : entry.note;
    this.sourceEl.textContent = entry.source;
    this.dimsEl.textContent = record.box ? dimensionsText(record.box) : '';
  }

  setRig(record) {
    this.rig = record.rig || null;
    this.rigEl.hidden = !this.rig;
    if (!this.rig) {
      this.rigJointKey = null;
      this.rigJointSelect.innerHTML = '';
      return;
    }

    const keys = Object.keys(this.rig.joints);
    this.rigJointKey = keys[0] || null;
    this.rigJointSelect.innerHTML = keys
      .map((key) => `<option value="${key}">${this.rig.jointLabel(key)}</option>`)
      .join('');
    this.rigJointSelect.value = this.rigJointKey;
    this.syncRigSliders();
  }

  syncRigSliders() {
    const joint = this.rig?.joints[this.rigJointKey];
    if (!joint) return;
    for (const axis of this.rigAxes) {
      const degrees = Math.round(THREE.MathUtils.radToDeg(joint.rotation[axis.axis]));
      axis.input.value = String(degrees);
      axis.output.textContent = `${degrees}°`;
    }
  }

  applyRigAxis(axis) {
    const joint = this.rig?.joints[this.rigJointKey];
    if (!joint) return;
    const degrees = Number(axis.input.value);
    joint.rotation[axis.axis] = THREE.MathUtils.degToRad(degrees);
    axis.output.textContent = `${degrees}°`;
    this.rig.freezePose();
  }

  frame(record) {
    this.stage.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const root of record.roots) box.expandByObject(root);
    record.box = box;

    if (box.isEmpty()) return;

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.target.copy(sphere.center);

    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const distance = Math.max(
      sphere.radius / Math.sin(vFov / 2),
      sphere.radius / Math.sin(hFov / 2)
    );

    this.fitRadius = Math.max(distance * 1.35, 0.4);
    this.radius = this.fitRadius;
    this.minRadius = this.fitRadius * 0.12;
    this.maxRadius = this.fitRadius * 8;
    this.theta = Math.PI * 0.23;
    this.phi = Math.PI * 0.36;

    this.lightTarget.position.copy(sphere.center);
    const lightDistance = Math.max(sphere.radius * 3, 2);
    this.keyLight.position.copy(sphere.center).add(new THREE.Vector3(1, 1.6, 0.9).multiplyScalar(lightDistance));
    this.keyLight.shadow.camera.left = -sphere.radius * 2.2;
    this.keyLight.shadow.camera.right = sphere.radius * 2.2;
    this.keyLight.shadow.camera.top = sphere.radius * 2.2;
    this.keyLight.shadow.camera.bottom = -sphere.radius * 2.2;
    this.keyLight.shadow.camera.near = 0.05;
    this.keyLight.shadow.camera.far = lightDistance * 6;
    this.keyLight.shadow.camera.updateProjectionMatrix();

    this.updateCamera();
  }

  updateCamera() {
    const sinPhi = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sinPhi * Math.sin(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.cos(this.theta)
    );
    this.camera.lookAt(this.target);
  }

  resetView() {
    if (!this.active) return;
    this.radius = this.fitRadius;
    this.theta = Math.PI * 0.23;
    this.phi = Math.PI * 0.36;
    this.target.copy(this.active.box.getCenter(new THREE.Vector3()));
    this.updateCamera();
  }

  cycle(direction) {
    const index = SPRITES.findIndex((sprite) => sprite.id === this.activeId);
    const next = (index + direction + SPRITES.length) % SPRITES.length;
    this.select(SPRITES[next].id);
  }

  applyWireframe(enabled) {
    for (const record of this.cache.values()) {
      for (const root of record.roots) {
        root.traverse((object) => {
          if (!object.isMesh || !object.material) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.wireframe = enabled;
        });
      }
    }
  }

  toggle(action) {
    switch (action) {
      case 'autorotate':
        this.autoRotate = !this.autoRotate;
        this.buttons.get('autorotate').classList.toggle('is-on', this.autoRotate);
        break;
      case 'wireframe':
        this.wireframe = !this.wireframe;
        this.buttons.get('wireframe').classList.toggle('is-on', this.wireframe);
        this.applyWireframe(this.wireframe);
        break;
      case 'grid':
        this.showGrid = !this.showGrid;
        this.grid.visible = this.showGrid;
        this.buttons.get('grid').classList.toggle('is-on', this.showGrid);
        break;
      case 'pause':
        this.paused = !this.paused;
        this.buttons.get('pause').classList.toggle('is-on', this.paused);
        this.buttons.get('pause').textContent = this.paused ? 'Resume' : 'Pause';
        break;
      case 'background':
        this.backgroundIndex = (this.backgroundIndex + 1) % BACKGROUNDS.length;
        this.scene.background.setHex(BACKGROUNDS[this.backgroundIndex]);
        break;
      case 'reset':
        this.resetView();
        break;
      default:
        break;
    }
  }

  bindControls() {
    this.rigJointSelect.addEventListener('change', () => {
      this.rigJointKey = this.rigJointSelect.value;
      this.syncRigSliders();
    });
    for (const axis of this.rigAxes) {
      axis.input.addEventListener('input', () => this.applyRigAxis(axis));
    }
    this.rigResetButton.addEventListener('click', () => {
      if (!this.rig) return;
      this.rig.setPose('idle', true);
      this.syncRigSliders();
    });

    for (const [action, button] of this.buttons) {
      button.addEventListener('click', () => this.toggle(action));
    }

    for (const [action, side] of [
      ['steer-left', 'left'],
      ['steer-right', 'right']
    ]) {
      const button = this.buttons.get(action);
      if (!button) continue;
      const set = (value) => (event) => {
        event.preventDefault();
        this.input[side] = value;
        if (value && this.paused) this.toggle('pause');
      };
      button.addEventListener('pointerdown', set(true));
      button.addEventListener('pointerup', set(false));
      button.addEventListener('pointerleave', set(false));
      button.addEventListener('pointercancel', set(false));
    }

    const canvas = this.renderer.domElement;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        mode: event.button === 2 || event.shiftKey ? 'pan' : 'orbit'
      });
      this.mode = this.pointers.size >= 2 ? 'pinch' : this.pointers.values().next().value.mode;
      this.pinchDistance = this.pointerDistance();
      this.autoRotatePaused = true;
    });

    canvas.addEventListener('pointermove', (event) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;

      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      if (this.pointers.size >= 2) {
        const distance = this.pointerDistance();
        if (this.pinchDistance > 0 && distance > 0) {
          this.radius = clamp(this.radius * (this.pinchDistance / distance), this.minRadius, this.maxRadius);
        }
        this.pinchDistance = distance;
        return;
      }

      if (pointer.mode === 'pan') {
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        const scale = this.radius * 0.0016;
        this.target.addScaledVector(right, -dx * scale);
        this.target.addScaledVector(up, dy * scale);
        return;
      }

      this.theta -= dx * 0.006;
      this.phi = clamp(this.phi - dy * 0.006, MIN_POLAR, MAX_POLAR);
    });

    const release = (event) => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size === 0) {
        this.mode = null;
        this.autoRotatePaused = false;
      } else if (this.pointers.size === 1) {
        this.mode = this.pointers.values().next().value.mode;
        this.pinchDistance = 0;
      }
    };

    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.radius = clamp(
        this.radius * Math.exp(event.deltaY * 0.0012),
        this.minRadius,
        this.maxRadius
      );
    }, { passive: false });

    canvas.addEventListener('dblclick', () => this.resetView());

    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.cycle(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.cycle(-1);
      } else if (event.key === ' ') {
        event.preventDefault();
        this.toggle('pause');
      } else if (event.key === 'r' || event.key === 'R') {
        this.toggle('reset');
      } else if (event.key === 'w' || event.key === 'W') {
        this.toggle('wireframe');
      } else if (event.key === 'g' || event.key === 'G') {
        this.toggle('grid');
      } else if (event.key === 'a' || event.key === 'A') {
        this.input.left = true;
        if (this.paused) this.toggle('pause');
      } else if (event.key === 'd' || event.key === 'D') {
        this.input.right = true;
        if (this.paused) this.toggle('pause');
      } else if (event.key === 'o' || event.key === 'O') {
        this.toggle('autorotate');
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.key === 'a' || event.key === 'A') this.input.left = false;
      else if (event.key === 'd' || event.key === 'D') this.input.right = false;
    });
  }

  pointerDistance() {
    const values = [...this.pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  resize() {
    const width = Math.max(1, Math.floor(this.canvasHost.clientWidth));
    const height = Math.max(1, Math.floor(this.canvasHost.clientHeight));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;

    if (this.autoRotate && !this.autoRotatePaused && !this.paused) this.theta += dt * 0.45;
    if (this.active && !this.paused && this.active.update) {
      this.active.update(dt, this.time, this.input);
    }

    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  };
}

export function mountSpriteViewer() {
  const viewer = new SpriteViewer();
  viewer.mount();
  window.__spriteViewer = viewer;
  return viewer;
}
