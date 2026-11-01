import { Soldier } from './Soldier.js';
import { BoatOfficer } from './BoatOfficer.js';
import { Oar } from './Oar.js';

const CREW_SCALE = 0.85;
const CREW_FACING = Math.PI / 2;

export class BoatCrew {
  constructor(boat) {
    this.boat = boat;

    // Seated at the transom with both hands solved onto the tiller and lifeline.
    this.officer = new BoatOfficer(boat);

    this.oarsman = new Soldier({ pose: 'row' });
    this.oarsman.group.rotation.y = CREW_FACING;
    this.oarsman.group.scale.setScalar(CREW_SCALE);
    boat.oarsmanMount.add(this.oarsman.group);

    this.oar = new Oar();
    boat.attachOar(this.oar);
  }

  update() {
    this.officer.update();
  }
}
