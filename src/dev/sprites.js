import * as THREE from 'three';
import { Boat } from '../entities/Boat.js';
import { BoatOfficer } from '../entities/BoatOfficer.js';
import { Oar } from '../entities/Oar.js';
import { Soldier } from '../entities/Soldier.js';
import { Smuggler } from '../entities/Smuggler.js';
import { Frog, Snake } from '../entities/Wildlife.js';
import { createPreviewBird } from '../entities/Birds.js';
import { Drone } from '../entities/Drone.js';
import { Minivan } from '../entities/Minivan.js';
import { WatchtowerSoldier } from '../entities/WatchtowerSoldier.js';

const noop = () => {};

// Entities expect a RiverWorld for pathing, collisions and effects. The viewer
// only builds their models, so a tiny stub with the fields constructors touch is
// enough and keeps the full river, water shader and decorations out of this view.
const STUB_WORLD = {
  gravelPath: null,
  northBankY: 0,
  time: 0,
  rockColliders: [],
  emitSplash: noop,
  emitParticle: noop,
  emitRockImpact: noop,
  emitWake: noop,
  emitEngineWake: noop,
  getCurrentVelocity: () => null,
  findRockCollision: () => null
};

const MAX_MOTOR_ANGLE = 0.45;

function buildBoatOfficer(stage) {
  const boat = new Boat(stage, STUB_WORLD, noop, noop, noop, noop);
  stage.remove(boat.overboardMarker);

  const officer = new BoatOfficer(boat);

  let steer = 0;
  let angularVelocity = 0;

  return {
    roots: [boat.group],
    steering: true,
    reset() {
      steer = 0;
      angularVelocity = 0;
      boat.group.rotation.y = 0;
      boat.hull.rotation.x = 0;
      boat.motorPivot.rotation.y = 0;
      officer.update();
    },
    update(dt, time, input) {
      const targetSteer = (input?.left ? 1 : 0) - (input?.right ? 1 : 0);
      steer += (targetSteer - steer) * (1 - Math.exp(-dt * 6));
      angularVelocity += steer * 1.6 * dt;
      angularVelocity -= angularVelocity * 1.2 * dt;

      boat.group.rotation.y += angularVelocity * dt;
      boat.hull.rotation.x = THREE.MathUtils.lerp(boat.hull.rotation.x, -angularVelocity * 0.12, 0.2);
      boat.motorPivot.rotation.y = THREE.MathUtils.lerp(
        boat.motorPivot.rotation.y,
        steer * MAX_MOTOR_ANGLE,
        0.25
      );

      officer.update();
    }
  };
}

function buildOar(stage) {
  const oar = new Oar();
  oar.group.rotation.set(0.5, 0, -0.4);
  stage.add(oar.group);
  return { roots: [oar.group] };
}

function buildBoat(stage) {
  const boat = new Boat(stage, STUB_WORLD, noop, noop, noop, noop);
  // The overboard marker is a world-space helper, not part of the sprite.
  stage.remove(boat.overboardMarker);
  return { roots: [boat.group] };
}

function buildSmuggler(stage, form) {
  const smuggler = new Smuggler(stage, STUB_WORLD, 0, 1);

  if (form === 'swimming') {
    smuggler.group.remove(smuggler.walkerGroup);
    smuggler.swimmerGroup.visible = true;
    return {
      roots: [smuggler.group],
      update: (dt) => smuggler.animateSwim(dt)
    };
  }

  smuggler.group.remove(smuggler.swimmerGroup);
  return { roots: [smuggler.group] };
}

function buildFrog(stage) {
  const frog = new Frog(stage, STUB_WORLD, 1, 0);
  return { roots: [frog.group] };
}

function buildSnake(stage) {
  const snake = new Snake(stage, STUB_WORLD, 1, 0);
  return { roots: [snake.group] };
}

function buildBird(stage, variant) {
  const bird = createPreviewBird(stage, variant);
  // Birds fly in-game; lift the preview so the ground stays visibly below.
  bird.group.position.y = 1.5;
  return {
    roots: [bird.group],
    update: (dt, time) => bird.animate(time, time * (variant === 'stork' ? 4 : 7))
  };
}

function buildDrone(stage) {
  const drone = new Drone(stage);
  drone.setVisible(true);
  drone.group.position.y = 1.5;
  return { roots: [drone.group], update: (dt) => drone.update(dt) };
}

function buildMinivan(stage) {
  const minivan = new Minivan(stage);
  minivan.show();
  return { roots: [minivan.group] };
}

function buildSoldier(stage, mode = 'idle') {
  const soldier = new WatchtowerSoldier(stage);
  soldier.setVisible(true);
  if (mode === 'idle') {
    soldier.reset();
  } else {
    soldier.setMode(mode, true);
  }
  return { roots: [soldier.group], update: (dt) => soldier.update(dt) };
}

// The idle entry is the raw shared soldier: every joint exposed to the
// viewer's rig panel, no binoculars/radio props and nothing else in the scene.
function buildSoldierIdle(stage) {
  const soldier = new Soldier({ pose: 'idle' });
  stage.add(soldier.group);
  return {
    roots: [soldier.group],
    rig: soldier,
    reset: () => soldier.setPose('idle', true),
    update: (dt) => soldier.update(dt)
  };
}

export const SPRITE_GROUPS = [
  {
    label: 'Boat',
    sprites: [
      {
        id: 'boat',
        label: 'Patrol boat',
        note: 'Rubber hull, benches, outboard and empty crew/oar mounts.',
        source: 'src/entities/Boat.js',
        build: buildBoat
      },
      {
        id: 'oar',
        label: 'Oar',
        note: 'Shaft, blade, red tip and aim anchor; attached to the boat at runtime.',
        source: 'src/entities/Oar.js',
        build: buildOar
      },
      {
        id: 'boat-officer',
        label: 'Boat — seated officer',
        note: 'Boat with one soldier seated on the transom holding the tiller.',
        source: 'src/dev/sprites.js',
        build: buildBoatOfficer
      }
    ]
  },
  {
    label: 'Smugglers',
    sprites: [
      {
        id: 'smuggler-walking',
        label: 'Smuggler — walking',
        note: 'Road walker with contraband bundle.',
        source: 'src/entities/Smuggler.js',
        build: (stage) => buildSmuggler(stage, 'walking')
      },
      {
        id: 'smuggler-swimming',
        label: 'Smuggler — swimming',
        note: 'Swimmer, cap, snorkel and bundle.',
        source: 'src/entities/Smuggler.js',
        build: (stage) => buildSmuggler(stage, 'swimming')
      }
    ]
  },
  {
    label: 'Wildlife',
    sprites: [
      {
        id: 'frog',
        label: 'Frog',
        note: 'Prey for storks and oar practice.',
        source: 'src/entities/Wildlife.js',
        build: buildFrog
      },
      {
        id: 'snake',
        label: 'Snake',
        note: 'Prey for storks and oar practice.',
        source: 'src/entities/Wildlife.js',
        build: buildSnake
      }
    ]
  },
  {
    label: 'Birds',
    sprites: [
      {
        id: 'bird-crow',
        label: 'Crow',
        note: 'Ambient single/flock bird; wings flap in the viewer.',
        source: 'src/entities/Birds.js',
        build: (stage) => buildBird(stage, 'crow')
      },
      {
        id: 'bird-stork',
        label: 'Stork',
        note: 'Hunting stork variant with long beak and legs.',
        source: 'src/entities/Birds.js',
        build: (stage) => buildBird(stage, 'stork')
      }
    ]
  },
  {
    label: 'Cinematic',
    sprites: [
      {
        id: 'drone',
        label: 'Drone',
        note: 'Patrol drone with spinning rotors.',
        source: 'src/entities/Drone.js',
        build: buildDrone
      },
      {
        id: 'minivan',
        label: 'Minivan',
        note: 'Smuggler drop-off vehicle.',
        source: 'src/entities/Minivan.js',
        build: buildMinivan
      },
      {
        id: 'soldier-idle',
        label: 'Soldier — idle',
        note: 'Shared soldier: helmet, plate carrier and 15 articulated joints. The same model the boat crew and watchtower use.',
        source: 'src/entities/Soldier.js',
        build: buildSoldierIdle
      },
      {
        id: 'soldier-binoculars',
        label: 'Soldier — binoculars',
        note: 'Watchtower soldier on the binoculars.',
        source: 'src/entities/Soldier.js + WatchtowerSoldier.js',
        build: (stage) => buildSoldier(stage, 'binoculars')
      },
      {
        id: 'soldier-radio',
        label: 'Soldier — radio',
        note: 'Watchtower soldier calling in the drop.',
        source: 'src/entities/Soldier.js + WatchtowerSoldier.js',
        build: (stage) => buildSoldier(stage, 'radio')
      }
    ]
  }
];

export const SPRITES = SPRITE_GROUPS.flatMap((group) => group.sprites);

export const SPRITE_BY_ID = new Map(SPRITES.map((sprite) => [sprite.id, sprite]));
