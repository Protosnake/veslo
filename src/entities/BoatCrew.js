import { BoatOfficer } from './BoatOfficer.js';
import { BoatOarsman } from './BoatOarsman.js';

export class BoatCrew {
  constructor(boat) {
    this.boat = boat;

    // Officer seated at the transom, hands solved onto the tiller and lifeline.
    this.officer = new BoatOfficer(boat);

    // Oarsman seated on the raised front bench, both hands solved onto the oar.
    this.oarsman = new BoatOarsman(boat);
  }

  update() {
    this.officer.update();
    this.oarsman.update();
  }
}
