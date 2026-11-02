import * as THREE from 'three';

/**
 * A camera rigidly attached to a scene object (first-person / POV / on-board
 * shot). Like `ChaseCamera` it owns no THREE camera and touches no renderer:
 * feed it a mount, read back `position` / `look`, apply however you like.
 */
export interface CameraMount {
  /** Object whose world position is the eye (e.g. a head joint). */
  anchor: THREE.Object3D;
  /** Object whose world rotation sets the view direction; defaults to `anchor`. */
  orientation?: THREE.Object3D;
}

export interface MountCameraOptions {
  /** Eye offset in the anchor's local space. */
  eyeOffset: THREE.Vector3;
  /** View direction in the orientation object's local space. */
  lookDirection: THREE.Vector3;
  /** Distance of the look-at point from the eye. */
  lookDistance: number;
  /** Seconds to blend from the previous camera pose into the mount. */
  blendSeconds: number;
  /** Horizontal FOV in degrees, or null to keep the gameplay FOV. */
  fov: number | null;
  /** Near clip plane for this view, or null to keep the renderer's. */
  near: number | null;
}

export const DEFAULT_MOUNT_OPTIONS: MountCameraOptions = {
  eyeOffset: new THREE.Vector3(0, 0.14, 0.08),
  lookDirection: new THREE.Vector3(0, -0.04, 1),
  lookDistance: 20,
  blendSeconds: 0.8,
  fov: 80,
  near: 0.1
};

export class MountCamera {
  readonly options: MountCameraOptions;
  readonly position = new THREE.Vector3();
  readonly look = new THREE.Vector3();

  private mount: CameraMount | null = null;
  private blend = 1;
  private readonly fromPos = new THREE.Vector3();
  private readonly fromLook = new THREE.Vector3();
  private readonly livePos = new THREE.Vector3();
  private readonly liveLook = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly dir = new THREE.Vector3();

  constructor(options: Partial<MountCameraOptions> = {}) {
    this.options = { ...DEFAULT_MOUNT_OPTIONS, ...options };
  }

  get active(): boolean {
    return this.mount !== null;
  }

  start(mount: CameraMount, from?: { position: THREE.Vector3; look: THREE.Vector3 }): void {
    this.mount = mount;
    this.sample();
    this.position.copy(this.livePos);
    this.look.copy(this.liveLook);
    if (from && this.options.blendSeconds > 0) {
      this.fromPos.copy(from.position);
      this.fromLook.copy(from.look);
      this.blend = 0;
    } else {
      this.blend = 1;
    }
  }

  stop(): void {
    this.mount = null;
  }

  update(dt: number): void {
    if (!this.mount) return;
    this.sample();
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.options.blendSeconds);
      const eased = this.blend * this.blend * (3 - 2 * this.blend);
      this.position.lerpVectors(this.fromPos, this.livePos, eased);
      this.look.lerpVectors(this.fromLook, this.liveLook, eased);
    } else {
      this.position.copy(this.livePos);
      this.look.copy(this.liveLook);
    }
  }

  private sample(): void {
    const { anchor, orientation } = this.mount!;
    const o = this.options;
    anchor.updateWorldMatrix(true, false);
    this.livePos.copy(o.eyeOffset);
    anchor.localToWorld(this.livePos);

    const orient = orientation ?? anchor;
    orient.updateWorldMatrix(true, false);
    orient.getWorldQuaternion(this.quat);
    this.dir.copy(o.lookDirection).normalize().applyQuaternion(this.quat);
    this.liveLook.copy(this.livePos).addScaledVector(this.dir, o.lookDistance);
  }
}
