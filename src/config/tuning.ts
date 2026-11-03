/**
 * Frequently tweaked gameplay knobs.
 *
 * Defaults live here so testing does not depend on a local `.env` file. Each
 * value can still be overridden at build time with the matching `VITE_*`
 * variable, or per-load with its `?`-query flag where a loader supports one.
 */

export interface StorkTuning {
  /** Force constant hunting dives so the behaviour is easy to verify. */
  alwaysDive: boolean;
  /** Seconds between dedicated stork spawns; null uses the normal random mix. */
  spawnInterval: number | null;
  /** 0..1 share of normal bird spawns that are storks. */
  spawnWeight: number;
}

export interface DevTuning {
  /** Mount the isolated sprite viewer instead of the game. */
  spriteViewer: boolean;
}

export interface ChaseCameraTuning {
  /** Metres behind the boat. */
  distance: number;
  /** Metres above the boat. */
  height: number;
  /** Seconds to ease from the drone view into the chase view. */
  blendSeconds: number;
  /** Horizontal FOV (degrees) while on the chase camera. */
  fov: number;
}

export interface PovCameraTuning {
  /** Horizontal FOV (degrees) for the engine-operator first-person view. */
  fov: number;
  /** Seconds to ease from the drone view into the first-person view. */
  blendSeconds: number;
  /** Max view yaw (degrees) when the boat turns hard; the view looks into the turn. */
  maxTurnYawDegrees: number;
  /** Fraction of the boat's top turn rate that reaches the full turn yaw. */
  turnRateFraction: number;
  /** How fast (1/s) the view yaw eases toward its target. */
  yawSmoothing: number;
  /** Extra yaw (degrees, max) toward the closest enemy the operator is watching. */
  enemyBiasDegrees: number;
}

export interface ReverseLookTuning {
  /** Boat reverse speed (m/s) at which the full look-back is reached. */
  fullSpeed: number;
  /** Torso turn (degrees) over the shoulder at full reverse. */
  torsoDegrees: number;
  /** Extra head turn (degrees) at full reverse. */
  headDegrees: number;
  /** Extra POV view yaw (degrees) at full reverse. */
  cameraDegrees: number;
  /** How fast (1/s) the look-back eases in and out; low keeps it calm. */
  smoothing: number;
}

export interface CrewGazeTuning {
  /** Metres within which a crew member notices and watches an enemy. */
  range: number;
  /** Max head turn (degrees) either side of straight ahead. */
  maxHeadYawDegrees: number;
  /** How fast (1/s) heads ease toward their target. */
  smoothing: number;
}

export interface PortraitFpvTuning {
  /** FPV-drone chase in portrait: the camera sits behind the boat and turns with its heading. */
  enabled: boolean;
  /** Metres behind the boat. */
  distance: number;
  /** Metres above the water. */
  height: number;
  /** Metres ahead of the boat the camera looks. */
  lookAhead: number;
  /** Horizontal FOV (degrees); FPV drones are wide. */
  fov: number;
  /** Use the same FPV chase camera in landscape / desktop. */
  desktop: boolean;
  /** Horizontal FOV (degrees) of the FPV camera in landscape. */
  desktopFov: number;
  /** How quickly the camera swings round behind a turn (1/s); lower is lazier. */
  headingStiffness: number;
  /** Bank (roll) into turns, 0 = none, 1 = default amount. */
  bank: number;
}

export interface PortraitTuning {
  fpv: PortraitFpvTuning;
  /** Allow the vertical (portrait) camera rig on tall screens. */
  enabled: boolean;
  /** Which way the river runs on screen: 'down' (flows toward the bottom) or 'up'. */
  flow: 'down' | 'up';
  /** Horizontal FOV (degrees) for the gameplay camera in portrait. */
  fov: number;
  /** Metres the drone hovers above the water in portrait. */
  rigHeight: number;
  /** Metres the drone sits back from the follow point along the river. */
  rigDistance: number;
  /** Metres the view leads ahead of the boat; 0 keeps the boat centred. */
  lead: number;
  /** Degrees the camera orbits down toward the horizon in portrait, keeping the boat centred (0 = none). */
  tilt: number;
  /** Seconds the camera rig takes to swing between landscape and portrait. */
  blendSeconds: number;
}

export interface TuningConfig {
  /** Starting battery percentage (0-100). */
  initialBattery: number;
  /** Percent of battery the drone loses per minute of play. */
  batteryDrainPerMinute: number;
  /** Low-battery / battery-out event (degraded feed, signal lost, POV cam). Off for now. */
  batteryEvents: boolean;
  /** Seconds a dead drone battery takes to recharge (chase camera runs meanwhile). */
  batteryRechargeSeconds: number;
  /** Seconds before recharge ends when the radio rumbles and the countdown shows. */
  droneReadyCountdownSeconds: number;
  /** Seconds the static screen covers the cut back to the drone view (before and after the switch). */
  droneSwitchStaticSeconds: number;
  /** Vertical (portrait) play on phones. */
  portrait: PortraitTuning;
  /** Third-person boat camera shown while the drone is recharging. */
  chaseCamera: ChaseCameraTuning;
  /** Which view replaces the dead drone feed: 'pov' (engine operator) or 'chase'. */
  batteryCamera: 'pov' | 'chase';
  /** First-person view from the engine operator. */
  povCamera: PovCameraTuning;
  /** Rower and engine operator heads tracking the closest enemy. */
  crewGaze: CrewGazeTuning;
  /** Engine operator looking over the shoulder while reversing. */
  reverseLook: ReverseLookTuning;
  /** Allow AK shooting while the drone battery is dead (feature kept, off for now). */
  akEnabled: boolean;
  /** Extra smugglers spawned immediately at run start. */
  initialSpawnCount: number;
  /** Kill-streak window in seconds. */
  killStreakSeconds: number;
  /** Boat speed ratio (0-1 of max speed) at or above which the kill-streak timer stops ticking. */
  killStreakFreezeSpeedRatio: number;
  /** Request a screen wake lock for the duration of a run. */
  wakeLock: boolean;
  stork: StorkTuning;
  dev: DevTuning;
}

export const TUNING: TuningConfig = {
  initialBattery: 100,
  batteryDrainPerMinute: 1,
  batteryEvents: false,
  batteryRechargeSeconds: 30,
  droneReadyCountdownSeconds: 5,
  droneSwitchStaticSeconds: 0.8,
  portrait: {
    fpv: {
      enabled: true,
      distance: 9,
      height: 4,
      lookAhead: 12,
      fov: 55.8,
      desktop: true,
      desktopFov: 81,
      headingStiffness: 3,
      bank: 1
    },
    enabled: true,
    flow: 'down',
    fov: 15.3,
    rigHeight: 24,
    rigDistance: 30,
    lead: 0,
    tilt: 25,
    blendSeconds: 0.6
  },
  chaseCamera: {
    distance: 9,
    height: 4,
    blendSeconds: 1.2,
    fov: 70
  },
  batteryCamera: 'pov',
  povCamera: {
    fov: 80,
    blendSeconds: 0.8,
    maxTurnYawDegrees: 180,
    turnRateFraction: 1,
    yawSmoothing: 1.5,
    enemyBiasDegrees: 20
  },
  reverseLook: {
    fullSpeed: 5,
    torsoDegrees: 25,
    headDegrees: 25,
    cameraDegrees: 45,
    smoothing: 1
  },
  crewGaze: {
    range: 45,
    maxHeadYawDegrees: 80,
    smoothing: 8
  },
  akEnabled: false,
  initialSpawnCount: 0,
  killStreakSeconds: 10,
  killStreakFreezeSpeedRatio: 0.98,
  wakeLock: true,
  stork: {
    alwaysDive: false,
    spawnInterval: null,
    spawnWeight: 0.14
  },
  dev: {
    spriteViewer: false
  }
};
