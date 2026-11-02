import * as THREE from 'three';
import { BoatOfficer } from './BoatOfficer.js';
import { BoatOarsman } from './BoatOarsman.js';

const NOTICEABLE_STATES = new Set(['walking', 'swimming', 'disembarking', 'waiting']);

export class BoatCrew {
  constructor(boat) {
    this.boat = boat;

    // Officer seated at the transom, hands solved onto the tiller and lifeline.
    this.officer = new BoatOfficer(boat);

    // Oarsman seated on the raised front bench, both hands solved onto the oar.
    this.oarsman = new BoatOarsman(boat);

    this.head = new THREE.Vector3();
    this.local = new THREE.Vector3();
    /** Bearing (radians, soldier-local, +Y rotation) of the officer's watched enemy, or null. */
    this.officerBearing = null;
    this.gazeYaw = new Map();
    this.lastBest = new Map();
    /** Swimmer the oarsman is watching inside oar reach (the one his oar will hit), or null. */
    this.strikeTarget = null;
  }

  /** Turn both crew heads toward the closest visible enemy (or back to centre). */
  updateGaze(dt, smugglers, { range, maxYaw, smoothing }, strikeRange = 0) {
    this.officerBearing = this.lookAtClosest(this.officer.soldier, smugglers, dt, range, maxYaw, smoothing);
    // The oarsman prefers swimmers inside oar reach, so his gaze names the swing target.
    this.lookAtClosest(this.oarsman.soldier, smugglers, dt, range, maxYaw, smoothing, strikeRange);
    this.strikeTarget = this.lastBest.get(this.oarsman.soldier) ?? null;
    if (this.strikeTarget && (this.strikeTarget.state !== 'swimming' || !strikeRange)) this.strikeTarget = null;
    // Reversing: the officer's head adds a little over-the-shoulder turn on top of the gaze.
    this.officer.soldier.joints.head.rotation.y += this.officer.headLook;
  }

  lookAtClosest(soldier, smugglers, dt, range, maxYaw, smoothing, preferSwimmerWithin = 0) {
    const head = soldier.joints.head;
    head.getWorldPosition(this.head);
    let best = null;
    let bestSq = range * range;
    let bestReach = false;
    const reachSq = preferSwimmerWithin * preferSwimmerWithin;
    for (const s of smugglers || []) {
      if (!s || s.isDead || !s.group || !s.group.visible || !NOTICEABLE_STATES.has(s.state)) continue;
      const dx = s.position.x - this.head.x;
      const dz = s.position.z - this.head.z;
      const distanceSq = dx * dx + dz * dz;
      const inReach = reachSq > 0 && s.state === 'swimming' && distanceSq < reachSq;
      // A swimmer in oar reach always beats anything else; otherwise closest wins.
      if ((inReach && !bestReach) || (inReach === bestReach && distanceSq < bestSq)) {
        bestSq = distanceSq;
        best = s;
        bestReach = inReach;
      }
    }
    this.lastBest.set(soldier, best);

    let bearing = null;
    if (best) {
      this.local.set(best.position.x, this.head.y, best.position.z);
      soldier.group.worldToLocal(this.local);
      bearing = Math.atan2(this.local.x, this.local.z);
    }
    const relative = bearing === null ? 0 : bearing - soldier.joints.spine.rotation.y; // head sits on the turned torso
    const target = THREE.MathUtils.clamp(relative, -maxYaw, maxYaw);
    const current = this.gazeYaw.get(soldier) ?? 0;
    const next = current + (target - current) * (1 - Math.exp(-dt * smoothing));
    this.gazeYaw.set(soldier, next);
    head.rotation.y = next;
    return bearing;
  }

  update() {
    this.officer.update();
    this.oarsman.update();
  }
}
