import * as THREE from 'three';
import { QUALITY } from '../config/quality.js';

export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL is not available in this browser.');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

function detectWebGL(): boolean {
  try {
    if (!window.WebGLRenderingContext) return false;
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl' as unknown as 'webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export interface PortraitRigOptions {
  enabled: boolean;
  /** 'down': river flows toward the screen bottom (camera on +X looking -X). */
  flow: 'down' | 'up';
  fov: number;
  rigHeight: number;
  rigDistance: number;
  lead: number;
  /** Degrees the camera orbits down toward the water (boat stays centred). */
  tilt: number;
  fpv: PortraitFpvOptions;
}

export interface PortraitFpvOptions {
  enabled: boolean;
  distance: number;
  height: number;
  lookAhead: number;
  fov: number;
  /** Use the FPV chase camera in landscape (desktop) too. */
  desktop: boolean;
  /** Horizontal FOV (degrees) for the FPV camera in landscape. */
  desktopFov: number;
  headingStiffness: number;
  bank: number;
}

// Wide-angle patrol drone tracking the boat over the breach line.
export class GameRenderer {
  container: HTMLElement;
  scene: THREE.Scene;
  renderer!: THREE.WebGLRenderer;
  camera!: THREE.PerspectiveCamera;
  elapsed = 0;
  readonly defaultNear = 0.5;

  horizontalFov!: number;
  rigY?: number;
  aimStiffness!: number;
  droneStiffness!: number;
  lookHeight!: number;

  baseAnchor!: THREE.Vector3;
  anchor!: THREE.Vector3;
  rigOffset!: THREE.Vector3;
  followTarget!: THREE.Vector3;
  followLook!: THREE.Vector3;
  followLookTarget!: THREE.Vector3;
  fovHOverride: number | null = null;
  lookTarget!: THREE.Vector3;

  sun!: THREE.DirectionalLight;

  portraitOptions: PortraitRigOptions = {
    enabled: false,
    flow: 'down',
    fov: 58,
    rigHeight: 24,
    rigDistance: 30,
    lead: 12,
    tilt: 0,
    fpv: {
      enabled: false,
      distance: 9,
      height: 4,
      lookAhead: 12,
      fov: 62,
      desktop: false,
      desktopFov: 90,
      headingStiffness: 3,
      bank: 1
    }
  };
  private fpvHeading = 0;
  private fpvTargetHeading = 0;
  private fpvBank = 0;
  private readonly fpvForward = new THREE.Vector3();
  portrait = false;
  /** Rig yaw about Y: 0 is the landscape rig on +Z looking -Z. */
  private rigYaw = 0;
  private rigYawTarget = 0;
  private leadAmount = 0;
  private readonly landscapeRigY = 22;
  private readonly landscapeRigDistance = 30;
  private blendRate = 6;
  private readonly leadDir = new THREE.Vector3();

  shakeIntensity = 0;
  shakeDecay = 0.9;
  shakeOffset = new THREE.Vector3();

  manualCamera = false;
  manualPosition = new THREE.Vector3();
  manualLook = new THREE.Vector3();

  constructor(container: HTMLElement) {
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

  initRenderer(): void {
    if (!detectWebGL()) {
      throw new WebGLUnavailableError();
    }

    const attempts: THREE.WebGLRendererParameters[] = [
      { antialias: QUALITY.antialias, powerPreference: 'high-performance' },
      { antialias: QUALITY.antialias },
      { antialias: false }
    ];

    let lastError: unknown;
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

    // Rendering is fill-rate bound on high-DPI displays; cap the buffer at the
    // adaptive-quality tier instead of always paying for a 2x buffer.
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, QUALITY.pixelRatioCap)
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
  }

  initCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;

    // One rig for every platform. Centered behind the boat, sized for the
    // mobile framing that is now the primary target.
    this.horizontalFov = 76;

    // Quick dev tuning: ?y=24 lowers/raises the drone, ?look=3 tilts it up,
    // ?fov=80 zooms out further, ?aim=1.4 changes how hard the gimbal trails
    // (lower = more lag), ?drone=8 changes how tightly the body follows.
    const params = new URLSearchParams(window.location.search);
    const rigY = parseFloat(params.get('y') ?? '');
    const lookY = parseFloat(params.get('look') ?? '');
    const fovOverride = parseFloat(params.get('fov') ?? '');
    const aimParam = parseFloat(params.get('aim') ?? '');
    const droneParam = parseFloat(params.get('drone') ?? '');
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
    this.rigOffset = new THREE.Vector3(0, this.rigY ?? this.landscapeRigY, this.landscapeRigDistance);
    this.followTarget = new THREE.Vector3(0, 0, 4);
    this.followLook = new THREE.Vector3(0, 0, 4);
    this.followLookTarget = new THREE.Vector3(0, 0, 4);

    this.fovHOverride = null;
    this.camera = new THREE.PerspectiveCamera(52, aspect, this.defaultNear, 600);
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

  /**
   * Switch between the landscape rig and the vertical rig. In portrait the
   * drone swings 90 degrees about the follow point so the long river axis (X)
   * runs up the tall screen. Pass `instant` to skip the swing.
   */
  setPortrait(active: boolean, instant = false): void {
    const next = active && this.portraitOptions.enabled;
    this.portrait = next;
    // Camera on +X looking -X puts the river flowing down the screen.
    this.rigYawTarget = next ? (this.portraitOptions.flow === 'down' ? Math.PI / 2 : -Math.PI / 2) : 0;
    if (instant) {
      this.rigYaw = this.rigYawTarget;
      this.leadAmount = next ? this.portraitOptions.lead : 0;
      this.updateRigOffset();
    }
    this.applyResponsiveFov();
  }

  setPortraitOptions(options: PortraitRigOptions): void {
    this.portraitOptions = options;
    this.setPortrait(window.innerHeight > window.innerWidth, true);
  }

  /** Unit vector pointing at the top of the screen on the ground plane. */
  private screenUp(out: THREE.Vector3): THREE.Vector3 {
    // Landscape: screen-up is -Z. Rotate by the rig yaw.
    return out.set(-Math.sin(this.rigYaw), 0, -Math.cos(this.rigYaw));
  }

  private updateRigOffset(): void {
    const k = this.rigYaw === 0 ? 0 : Math.min(1, Math.abs(this.rigYaw) / (Math.PI / 2));
    const height = THREE.MathUtils.lerp(this.rigY ?? this.landscapeRigY, this.portraitOptions.rigHeight, k);
    const dist = THREE.MathUtils.lerp(this.landscapeRigDistance, this.portraitOptions.rigDistance, k);
    // Tilt orbits the camera down toward the water at the same distance, so
    // the horizon rises into view while the boat stays centred.
    const tilt = THREE.MathUtils.degToRad(this.portraitOptions.tilt) * k;
    let horiz = dist;
    let vert = height;
    if (tilt !== 0) {
      const radius = Math.hypot(dist, height);
      const elevation = Math.max(
        THREE.MathUtils.degToRad(6),
        Math.atan2(height, dist) - tilt
      );
      horiz = radius * Math.cos(elevation);
      vert = radius * Math.sin(elevation);
    }
    // Landscape rig sits on +Z; rotate that offset about Y by the yaw.
    this.rigOffset.set(Math.sin(this.rigYaw) * horiz, vert, Math.cos(this.rigYaw) * horiz);
  }

  /** Boat heading (radians, forward = (cos a, 0, -sin a)) for the FPV chase. */
  setFollowHeading(angle: number): void {
    this.fpvTargetHeading = angle;
  }

  /** True while the FPV-drone chase rig drives the camera (portrait, and desktop when enabled). */
  get fpvActive(): boolean {
    const o = this.portraitOptions.fpv;
    return o.enabled && (this.portrait || o.desktop);
  }

  private fpvPose(out: { position: THREE.Vector3; look: THREE.Vector3 }, heading: number): void {
    const o = this.portraitOptions.fpv;
    const fx = Math.cos(heading);
    const fz = -Math.sin(heading);
    out.position.set(
      this.anchor.x - fx * o.distance,
      this.anchor.y + o.height,
      this.anchor.z - fz * o.distance
    );
    out.look.set(
      this.anchor.x + fx * o.lookAhead,
      this.anchor.y + this.lookHeight,
      this.anchor.z + fz * o.lookAhead
    );
  }

  private updateFpv(dt: number): void {
    const o = this.portraitOptions.fpv;
    const t = this.elapsed;

    const anchorSmooth = 1 - Math.exp(-dt * this.droneStiffness);
    this.anchor.x += (this.followTarget.x - this.anchor.x) * anchorSmooth;
    this.anchor.z += (this.followTarget.z - this.anchor.z) * anchorSmooth;

    // Swing round behind the boat the short way; the lag drives the bank.
    let delta = this.fpvTargetHeading - this.fpvHeading;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.fpvHeading += delta * (1 - Math.exp(-dt * o.headingStiffness));
    const bankGoal = THREE.MathUtils.clamp(delta * 0.5 * o.bank, -0.35, 0.35);
    this.fpvBank += (bankGoal - this.fpvBank) * (1 - Math.exp(-dt * 6));

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

    this.fpvPose({ position: this.camera.position, look: this.lookTarget }, this.fpvHeading);
    // Light hover wobble, as on a real quad.
    this.camera.position.y += Math.sin(t * 0.9) * 0.12;
    this.camera.position.add(this.shakeOffset);
    this.camera.lookAt(this.lookTarget);
    this.camera.rotateZ(
      -this.fpvBank + Math.sin(t * 0.7) * 0.004 + (Math.random() - 0.5) * this.shakeIntensity * 0.02
    );
  }

  setFollowTarget(x: number, z: number): void {
    this.followTarget.set(x, 0, z);
    // The river is endless, so the shadow-casting sun travels with the boat.
    // Snapping to a coarse grid keeps shadow edges from shimmering.
    const gx = Math.round(x / 4) * 4;
    const gz = Math.round(z / 4) * 4;
    this.sun.position.set(gx + 30, 50, gz + 20);
    this.sun.target.position.set(gx, 0, gz);
    this.sun.target.updateMatrixWorld();
  }

  settleFollow(x: number, z: number): void {
    this.followTarget.set(x, 0, z);
    this.fpvHeading = this.fpvTargetHeading;
    this.screenUp(this.leadDir).multiplyScalar(this.leadAmount);
    const lx = x + this.leadDir.x;
    const lz = z + this.leadDir.z;
    this.followLook.set(lx, 0, lz);
    this.followLookTarget.set(lx, 0, lz);
    this.anchor.set(lx, 0, lz);
  }

  getGameplayPose(): { position: THREE.Vector3; look: THREE.Vector3 } {
    if (this.fpvActive) {
      const pose = { position: new THREE.Vector3(), look: new THREE.Vector3() };
      this.fpvPose(pose, this.fpvTargetHeading);
      return pose;
    }
    const position = this.anchor.clone().add(this.rigOffset);
    const look = new THREE.Vector3(
      this.followLook.x,
      this.anchor.y + this.lookHeight,
      this.followLook.z
    );
    return { position, look };
  }

  /** Override the near clip plane (null restores the default). */
  setNearPlane(near: number | null): void {
    this.camera.near = near ?? this.defaultNear;
    this.camera.updateProjectionMatrix();
  }

  setManualCamera(position: THREE.Vector3, look: THREE.Vector3): void {
    this.manualCamera = true;
    this.manualPosition.copy(position);
    this.manualLook.copy(look);
  }

  clearManualCamera(): void {
    this.manualCamera = false;
  }

  initLights(): void {
    const ambientLight = new THREE.AmbientLight(0xdff1ff, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff7e6, 0x3d7068, 0.4);
    this.scene.add(hemiLight);

    this.sun = new THREE.DirectionalLight(0xfffaf0, 1.4);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = QUALITY.shadowMapSize;
    this.sun.shadow.mapSize.height = QUALITY.shadowMapSize;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 120;

    const d = 35;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;

    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  /**
   * The camera holds a fixed horizontal field of view on every aspect ratio,
   * so phones and desktop see the same slice of river. Vertical FOV is derived
   * from the current aspect.
   */
  getGameplayHorizontalFov(): number {
    return this.horizontalFov;
  }

  setHorizontalFovOverride(hFov: number): void {
    this.fovHOverride = hFov;
    this.applyResponsiveFov();
  }

  clearHorizontalFovOverride(): void {
    this.fovHOverride = null;
    this.applyResponsiveFov();
  }

  applyResponsiveFov(): void {
    const aspect = window.innerWidth / window.innerHeight;
    let hDeg = this.fovHOverride != null ? this.fovHOverride : this.horizontalFov;
    // A phone held upright is much narrower, so the same horizontal FOV would
    // show a huge stretch of river and tiny boats. Scale every camera down.
    if (this.fpvActive) {
      const o = this.portraitOptions.fpv;
      hDeg *= (this.portrait ? o.fov : o.desktopFov) / this.horizontalFov;
    }
    else if (this.portrait) hDeg *= this.portraitOptions.fov / this.horizontalFov;
    const hFov = THREE.MathUtils.degToRad(hDeg);
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
  updateCamera(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed;

    if (this.manualCamera) {
      this.camera.position.copy(this.manualPosition);
      this.camera.lookAt(this.manualLook);
      this.camera.updateMatrixWorld();
      return;
    }

    if (this.fpvActive) {
      this.updateFpv(dt);
      return;
    }

    // Swing the rig between landscape and portrait.
    if (Math.abs(this.rigYaw - this.rigYawTarget) > 1e-4) {
      const k = 1 - Math.exp(-dt * this.blendRate);
      this.rigYaw += (this.rigYawTarget - this.rigYaw) * k;
      if (Math.abs(this.rigYaw - this.rigYawTarget) < 1e-3) this.rigYaw = this.rigYawTarget;
      this.updateRigOffset();
    }
    const leadTarget = this.portrait ? this.portraitOptions.lead : 0;
    this.leadAmount += (leadTarget - this.leadAmount) * (1 - Math.exp(-dt * this.blendRate));
    this.screenUp(this.leadDir).multiplyScalar(this.leadAmount);
    const targetX = this.followTarget.x + this.leadDir.x;
    const targetZ = this.followTarget.z + this.leadDir.z;

    // Drone body follows promptly; the gimbal lags much further behind.
    const anchorSmooth = 1 - Math.exp(-dt * this.droneStiffness);
    this.anchor.x += (targetX - this.anchor.x) * anchorSmooth;
    this.anchor.z += (targetZ - this.anchor.z) * anchorSmooth;

    const aimSmooth = 1 - Math.exp(-dt * this.aimStiffness);
    this.followLook.x += (targetX - this.followLook.x) * aimSmooth;
    this.followLook.z += (targetZ - this.followLook.z) * aimSmooth;

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

  triggerScreenShake(intensity = 0.5): void {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 1.2);
  }

  onResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.setPortrait(window.innerHeight > window.innerWidth);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
