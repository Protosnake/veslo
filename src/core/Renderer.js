import * as THREE from 'three';

export class WebGLUnavailableError extends Error {
  constructor(cause) {
    super('WebGL is not available in this browser.');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'));
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// Wide-angle patrol drone tracking the boat over the breach line.
export class GameRenderer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dc0ea);
    this.scene.fog = new THREE.FogExp2(0x7dc0ea, 0.007);

    this.initRenderer();
    this.initCamera();
    this.initLights();

    this.elapsed = 0;

    window.addEventListener('resize', () => this.onResize());
  }

  initRenderer() {
    if (!detectWebGL()) {
      throw new WebGLUnavailableError();
    }

    const attempts = [
      { antialias: true, powerPreference: 'high-performance' },
      { antialias: true },
      { antialias: false }
    ];

    let lastError;
    for (const options of attempts) {
      try {
        this.renderer = new THREE.WebGLRenderer(options);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!this.renderer) {
      throw new WebGLUnavailableError(lastError);
    }

    // Rendering is fill-rate bound on high-DPI displays; 1.5x keeps the image
    // crisp while avoiding the 4x pixel cost of an uncapped 2x buffer.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
  }

  initCamera() {
    const aspect = window.innerWidth / window.innerHeight;

    // One rig for every platform. Centered behind the boat, sized for the
    // mobile framing that is now the primary target.
    this.horizontalFov = 76;

    // Quick dev tuning: ?y=24 lowers/raises the drone, ?look=3 tilts it up,
    // ?fov=80 zooms out further, ?aim=1.4 changes how hard the gimbal trails
    // (lower = more lag), ?drone=8 changes how tightly the body follows.
    const params = new URLSearchParams(window.location.search);
    const rigY = parseFloat(params.get('y'));
    const lookY = parseFloat(params.get('look'));
    const fovOverride = parseFloat(params.get('fov'));
    const aimParam = parseFloat(params.get('aim'));
    const droneParam = parseFloat(params.get('drone'));
    if (Number.isFinite(rigY)) {
      this.rigY = THREE.MathUtils.clamp(rigY, 14, 44);
    }
    if (Number.isFinite(fovOverride)) {
      this.horizontalFov = THREE.MathUtils.clamp(fovOverride, 40, 100);
    }
    this.aimStiffness = Number.isFinite(aimParam)
      ? THREE.MathUtils.clamp(aimParam, 0.2, 12)
      : 1.4;
    this.droneStiffness = Number.isFinite(droneParam)
      ? THREE.MathUtils.clamp(droneParam, 0.2, 12)
      : 8;
    this.lookHeight = Number.isFinite(lookY)
      ? THREE.MathUtils.clamp(lookY, -1, 10)
      : 1;

    this.baseAnchor = new THREE.Vector3(0, 0, 4);
    this.anchor = this.baseAnchor.clone();
    this.rigOffset = new THREE.Vector3(0, this.rigY ?? 22, 30);
    this.followTarget = new THREE.Vector3(0, 0, 4);
    this.followLook = new THREE.Vector3(0, 0, 4);
    this.followLookTarget = new THREE.Vector3(0, 0, 4);

    this.fovHOverride = null;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.5, 600);
    this.applyResponsiveFov();

    this.camera.position.copy(this.anchor).add(this.rigOffset);
    this.lookTarget = this.anchor.clone();
    this.lookTarget.y += this.lookHeight;
    this.camera.lookAt(this.lookTarget);

    this.elapsed = 0;

    // Screen shake variables
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9;
    this.shakeOffset = new THREE.Vector3();

    // Cinematic intro camera override
    this.manualCamera = false;
    this.manualPosition = new THREE.Vector3();
    this.manualLook = new THREE.Vector3();
  }

  setFollowTarget(x, z) {
    this.followTarget.set(x, 0, z);
  }

  settleFollow(x, z) {
    this.followTarget.set(x, 0, z);
    this.followLook.set(x, 0, z);
    this.followLookTarget.set(x, 0, z);
    this.anchor.set(x, 0, z);
  }

  getGameplayPose() {
    const position = this.anchor.clone().add(this.rigOffset);
    const look = new THREE.Vector3(
      this.followLook.x,
      this.anchor.y + this.lookHeight,
      this.followLook.z
    );
    return { position, look };
  }

  setManualCamera(position, look) {
    this.manualCamera = true;
    this.manualPosition.copy(position);
    this.manualLook.copy(look);
  }

  clearManualCamera() {
    this.manualCamera = false;
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xdff1ff, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff7e6, 0x3d7068, 0.4);
    this.scene.add(hemiLight);

    this.sun = new THREE.DirectionalLight(0xfffaf0, 1.4);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 1024;
    this.sun.shadow.mapSize.height = 1024;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 120;

    const d = 35;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;

    this.scene.add(this.sun);
  }

  /**
   * The camera holds a fixed horizontal field of view on every aspect ratio,
   * so phones and desktop see the same slice of river. Vertical FOV is derived
   * from the current aspect.
   */
  getGameplayHorizontalFov() {
    return this.horizontalFov;
  }

  setHorizontalFovOverride(hFov) {
    this.fovHOverride = hFov;
    this.applyResponsiveFov();
  }

  clearHorizontalFovOverride() {
    this.fovHOverride = null;
    this.applyResponsiveFov();
  }

  applyResponsiveFov() {
    const aspect = window.innerWidth / window.innerHeight;
    const hFov = THREE.MathUtils.degToRad(
      this.fovHOverride != null ? this.fovHOverride : this.horizontalFov
    );
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
    this.camera.fov = THREE.MathUtils.radToDeg(vFov);
    this.camera.updateProjectionMatrix();
  }

  /**
   * The drone follows the boat, but like a real operator it only reacts to
   * where the boat has already been: it cannot predict the next turn. The rig
   * therefore sits slightly behind the boat and the gimbal trails further
   * still, then both ease in smoothly once the boat slows or stops. No
   * velocity feed-forward and no overshoot, so the trail reads as deliberate
   * lag rather than rubberbanding.
   */
  updateCamera(dt) {
    this.elapsed += dt;
    const t = this.elapsed;

    if (this.manualCamera) {
      this.camera.position.copy(this.manualPosition);
      this.camera.lookAt(this.manualLook);
      this.camera.updateMatrixWorld();
      return;
    }

    // Drone body follows promptly; the gimbal lags much further behind.
    const anchorSmooth = 1 - Math.exp(-dt * this.droneStiffness);
    this.anchor.x += (this.followTarget.x - this.anchor.x) * anchorSmooth;
    this.anchor.z += (this.followTarget.z - this.anchor.z) * anchorSmooth;

    const aimSmooth = 1 - Math.exp(-dt * this.aimStiffness);
    this.followLook.x += (this.followTarget.x - this.followLook.x) * aimSmooth;
    this.followLook.z += (this.followTarget.z - this.followLook.z) * aimSmooth;

    // Wind pushes the hovering drone around by a metre or two
    const driftX = Math.sin(t * 0.11) * 1.4 + Math.sin(t * 0.37) * 0.3;
    const driftZ = Math.cos(t * 0.09) * 1.1 + Math.cos(t * 0.29) * 0.25;
    const driftY = Math.sin(t * 0.17) * 0.6;

    // The operator keeps the camera on the breach line, with a lazy pan
    const panX = Math.sin(t * 0.061) * 1.1;
    const panZ = Math.cos(t * 0.047) * 0.7;

    // Handheld vibration on impacts
    if (this.shakeIntensity > 0.005) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        (Math.random() - 0.5) * this.shakeIntensity * 2
      );
      this.shakeIntensity *= Math.pow(this.shakeDecay, dt * 60);
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shakeIntensity = 0;
    }

    this.camera.position.set(
      this.anchor.x + this.rigOffset.x + driftX + this.shakeOffset.x,
      this.anchor.y + this.rigOffset.y + driftY + this.shakeOffset.y,
      this.anchor.z + this.rigOffset.z + driftZ + this.shakeOffset.z
    );

    this.lookTarget.set(
      this.followLook.x + panX,
      this.anchor.y + this.lookHeight,
      this.followLook.z + panZ
    );

    this.camera.lookAt(this.lookTarget);
    // Faint rotor/wind roll
    this.camera.rotateZ(Math.sin(t * 0.13) * 0.006 + (Math.random() - 0.5) * this.shakeIntensity * 0.02);
  }

  triggerScreenShake(intensity = 0.5) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 1.2);
  }

  onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.applyResponsiveFov();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
