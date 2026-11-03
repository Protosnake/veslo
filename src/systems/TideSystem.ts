import { TIDE_TUNING } from '../config/world.js';

export type TideDirection = 1 | -1;

/**
 * Swimmers only ever spawn on one side of the boat along the river (world X),
 * whichever way it faces. The side flips every `minSeconds`..`maxSeconds`.
 * The water current is unaffected: this is a spawn rule, not physics.
 */
export class TideSystem {
  direction: TideDirection = 1;
  secondsLeft = 0;
  phaseSeconds = 1;
  /** True from `warningSeconds` before the flip until it happens. */
  warning = false;
  /** Fired once per phase when the warning window opens, with the upcoming direction. */
  onWarning?: (next: TideDirection) => void;
  /** Fired when the direction flips. */
  onFlip?: (dir: TideDirection) => void;

  /** Start a run; `facingX` is the boat's forward X component so phase one matches where it points. */
  reset(facingX = 1): void {
    this.direction = TIDE_TUNING.startDirection !== 0
      ? (Math.sign(TIDE_TUNING.startDirection) as TideDirection)
      : facingX < 0 ? -1 : 1;
    this.beginPhase();
  }

  private beginPhase(): void {
    const { minSeconds, maxSeconds } = TIDE_TUNING;
    const lo = Math.max(1, Math.min(minSeconds, maxSeconds));
    const hi = Math.max(lo, maxSeconds);
    this.phaseSeconds = this.secondsLeft = lo + Math.random() * (hi - lo);
    this.warning = false;
  }

  update(dt: number): void {
    if (!TIDE_TUNING.enabled) return;
    this.secondsLeft -= dt;
    if (!this.warning && this.secondsLeft <= TIDE_TUNING.warningSeconds && this.secondsLeft > 0) {
      this.warning = true;
      this.onWarning?.((this.direction * -1) as TideDirection);
    }
    if (this.secondsLeft <= 0) {
      this.direction = (this.direction * -1) as TideDirection;
      this.beginPhase();
      this.onFlip?.(this.direction);
    }
  }
}

export const tide = new TideSystem();
