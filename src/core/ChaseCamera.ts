import * as THREE from 'three';

/**
 * Anything a chase camera can follow. `angle` is the heading in the same
 * convention as `Boat.angle` (group.rotation.y, forward = +X local), so the
 * boat satisfies this interface directly; entities without a heading can omit
 * it and the camera falls back to `fallbackAngle`.
 */
export interface ChaseTarget {
  position: THREE.Vector3;
  angle?: number;
}

export interface ChaseCameraOptions {
  /** Metres behind the target (along its heading). */
  distance: number;
  /** Metres above the target's position. */
  height: number;
  /** Height of the look-at point above the target's position. */
  lookHeight: number;
  /** Metres ahead of the target the camera looks, so the view leads the bow. */
  lookAhead: number;
  /** Seconds to blend from the previous camera pose to the chase pose. */
  blendSeconds: number;
  /** Position follow stiffness (1/s); higher is tighter. */
  stiffness: number;
  /** Heading follow stiffness (1/s); lower gives a lazier swing behind turns. */
  headingStiffness: number;
  /** Horizontal FOV in degrees, or null to keep the gameplay FOV. */
  fov: number | null;
  /** Heading used when the target has none (radians). */
  fallbackAngle: number;
}

export const DEFAULT_CHASE_OPTIONS: ChaseCameraOptions = {
  distance: 9,
  height: 4,
  lookHeight: 1,
  lookAhead: 5,
  blendSeconds: 1.2,
  stiffness: 6,
  headingStiffness: 2.5,
  fov: null,
  fallbackAngle: 0
};

/**
 * Self-contained third-person camera. It owns no THREE camera and touches no
 * renderer: callers feed it a target and read back a pose, then apply that
 * pose however they like (`Renderer.setManualCamera`, a cutscene, a second
 * viewport...). That keeps it reusable for any entity or cinematic shot.
 */
export class ChaseCamera {
  readonly options: ChaseCameraOptions;
  readonly position = new THREE.Vector3();
  readonly look = new THREE.Vector3();

  private target: ChaseTarget | null = null;
  private heading = 0;
  private blend = 1;
  private blendFromPos = new THREE.Vector3();
  private blendFromLook = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();

  constructor(options: Partial<ChaseCameraOptions> = {}) {
    this.options = { ...DEFAULT_CHASE_OPTIONS, ...options };
  }

  get active(): boolean {
    return this.target !== null;
  }

  /**
   * Start following `target`. If a previous pose is supplied the camera eases
   * from it, otherwise it cuts straight to the chase position.
   */
  start(target: ChaseTarget, from?: { position: THREE.Vector3; look: THREE.Vector3 }): void {
    this.target = target;
    this.heading = target.angle ?? this.options.fallbackAngle;
    this.computeDesired(this.desiredPos, this.desiredLook);
    this.position.copy(this.desiredPos);
    this.look.copy(this.desiredLook);

    if (from && this.options.blendSeconds > 0) {
      this.blendFromPos.copy(from.position);
      this.blendFromLook.copy(from.look);
      this.blend = 0;
    } else {
      this.blend = 1;
    }
  }

  stop(): void {
    this.target = null;
  }

  update(dt: number): void {
    if (!this.target) return;
    const o = this.options;

    // Swing the heading toward the target's, taking the short way round.
    const goal = this.target.angle ?? o.fallbackAngle;
    let delta = goal - this.heading;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.heading += delta * (1 - Math.exp(-dt * o.headingStiffness));

    this.computeDesired(this.desiredPos, this.desiredLook);
    const k = 1 - Math.exp(-dt * o.stiffness);

    if (this.blend < 1) {
      // Blend between the old pose and the live chase pose, both still moving.
      this.blend = Math.min(1, this.blend + dt / o.blendSeconds);
      const eased = this.blend * this.blend * (3 - 2 * this.blend);
      this.position.lerpVectors(this.blendFromPos, this.desiredPos, eased);
      this.look.lerpVectors(this.blendFromLook, this.desiredLook, eased);
    } else {
      this.position.lerp(this.desiredPos, k);
      this.look.lerp(this.desiredLook, k);
    }
  }

  private computeDesired(pos: THREE.Vector3, look: THREE.Vector3): void {
    const o = this.options;
    const t = this.target!.position;
    const fx = Math.cos(this.heading);
    const fz = -Math.sin(this.heading);
    pos.set(t.x - fx * o.distance, t.y + o.height, t.z - fz * o.distance);
    look.set(t.x + fx * o.lookAhead, t.y + o.lookHeight, t.z + fz * o.lookAhead);
  }
}
