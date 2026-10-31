import * as THREE from 'three';

export class WebGLUnavailableError extends Error {
  constructor(cause) {
    super('WebGL is not available in this browser.');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

function isTouchDevice() {
  return (
    window.matchMedia('(any-pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
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

// Wide-angle patrol drone holding a static overwatch over the breach line.
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

    this.baseFov = 52;
    this.baseAspect = 16 / 9;
    this.isTouch = isTouchDevice();

    // Mobile framing tests, selectable with ?cam=follow|moderate
    const MOBILE_CAMERAS = {
      follow: { hfov: 76, rig: [0, 22, 30], follow: true },
      moderate: { hfov: 72, rig: [0, 36, 30], follow: false }
    };
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('cam');
    this.cameraMode = this.isTouch
      ? (MOBILE_CAMERAS[requested] ? requested : 'follow')
      : 'desktop';
    this.mobileCamera = MOBILE_CAMERAS[this.cameraMode] || null;

    // Quick dev tuning: ?y=24 lowers/raises the drone, ?look=3 tilts it up,
    // ?fov=80 zooms out further.
    const rigY = parseFloat(params.get('y'));
    const lookY = parseFloat(params.get('look'));
    const fovOverride = parseFloat(params.get('fov'));
    if (this.mobileCamera && Number.isFinite(rigY)) {
      this.mobileCamera.rig[1] = THREE.MathUtils.clamp(rigY, 14, 44);
    }
    if (this.mobileCamera && Number.isFinite(fovOverride)) {
      this.mobileCamera.hfov = THREE.MathUtils.clamp(fovOverride, 40, 100);
    }
    this.lookHeight = Number.isFinite(lookY)
      ? THREE.MathUtils.clamp(lookY, -1, 10)
      : 1;

    // Desktop keeps the original angled overwatch. Mobile uses a centered rig
    // so zooming doesn't push one bank off-screen.
    this.touchHorizontalFov = this.mobileCamera ? this.mobileCamera.hfov : 78.5;
    this.baseAnchor = new THREE.Vector3(0, 0, 4);
    this.anchor = this.baseAnchor.clone();
    this.rigOffset = new THREE.Vector3(
      ...(this.mobileCamera ? this.mobileCamera.rig : [13, 36, 30])
    );
    this.followEnabled = Boolean(this.mobileCamera && this.mobileCamera.follow);
    this.followTarget = new THREE.Vector3(0, 0, 4);
    this.followLook = new THREE.Vector3(0, 0, 4);
    this.followLookTarget = new THREE.Vector3(0, 0, 4);

    this.fovHOverride = null;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.5, 600);
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

    if (this.isTouch) {
      console.info(`[camera] mobile mode: ${this.cameraMode}`);
    }
  }

  setFollowTarget(x, z) {
    this.followTarget.set(x, 0, z);
  }

  settleFollow(x, z) {
    this.followTarget.set(x, 0, z);
    this.followLook.set(x, 0, z);
    this.followLookTarget.set(x, 0, z);
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
   * Preserve the 16:9 horizontal framing on narrower screens (phones in
   * portrait, 16:10 laptops). Without this the drone feed loses the river
   * banks on either side and the game becomes unplayable.
   */
  getGameplayHorizontalFov() {
    if (this.isTouch) return this.touchHorizontalFov;
    return THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * this.baseAspect)
    );
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

    if (this.fovHOverride != null) {
      const hFov = THREE.MathUtils.degToRad(this.fovHOverride);
      const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
      this.camera.fov = THREE.MathUtils.radToDeg(vFov);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.isTouch) {
      const hFov = THREE.MathUtils.degToRad(this.touchHorizontalFov);
      const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
      this.camera.fov = THREE.MathUtils.radToDeg(vFov);
    } else if (aspect >= this.baseAspect) {
      this.camera.fov = this.baseFov;
    } else {
      const hFov = 2 * Math.atan(
        Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * this.baseAspect
      );
      const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
      this.camera.fov = THREE.MathUtils.radToDeg(vFov);
    }

    this.camera.updateProjectionMatrix();
  }

  /**
   * Static overwatch: the rig never tracks the boat. Only a slow wind drift
   * and a gentle pan keep the feed feeling like a live drone.
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

    // The drone body is fixed; only its gimbal turns to keep the boat framed.
    const aimSmooth = 1 - Math.exp(-dt * 8);
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
