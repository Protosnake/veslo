import { Soldier } from './Soldier.js';
import { Oar } from './Oar.js';

const CREW_SCALE = 0.85;
const CREW_FACING = Math.PI / 2;

export class BoatCrew {
  constructor(boat) {
    this.boat = boat;

    this.officer = new Soldier({ pose: 'steer' });
    this.officer.group.rotation.y = CREW_FACING;
    this.officer.group.scale.setScalar(CREW_SCALE);
    boat.officerGroup.add(this.officer.group);

    this.oarsman = new Soldier({ pose: 'row' });
    this.oarsman.group.rotation.y = CREW_FACING;
    this.oarsman.group.scale.setScalar(CREW_SCALE);
    boat.oarsmanMount.add(this.oarsman.group);

    this.oar = new Oar();
    boat.attachOar(this.oar);
  }

  update() {
    this.officer.arms.right.shoulder.rotation.y = -this.boat.motorPivot.rotation.y * 0.7;
  }
}
