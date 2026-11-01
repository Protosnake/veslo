import { Frog, Snake } from './Wildlife.js';
import { sound } from '../systems/Audio.js';
import { sx } from '../world/Bounds.js';

const SMUGGLER_SCARE_RADIUS = 4;

export class WildlifeManager {
  constructor(scene, riverWorld, onKill) {
    this.scene = scene;
    this.world = riverWorld;
    this.onKill = onKill;

    this.creatures = [];
    this.kills = 0;
    this.killsByType = { frog: 0, snake: 0 };
    this.spawnTimer = 0;
    this.baseSpawnInterval = 7.5;
    this.minSpawnInterval = 1.6;
    this.maxActive = 10;
  }

  reset() {
    this.creatures.forEach((creature) => creature.destroy());
    this.creatures = [];
    this.kills = 0;
    this.killsByType = { frog: 0, snake: 0 };
    this.spawnTimer = 3.5;
  }

  getSpawnInterval() {
    const pressure = Math.pow(0.88, this.kills);
    const interval = Math.max(this.minSpawnInterval, this.baseSpawnInterval * pressure);
    return interval * (0.85 + Math.random() * 0.3);
  }

  spawnCreature() {
    const type = Math.random() < 0.5 ? 'frog' : 'snake';
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = sx(-25) + Math.random() * sx(50);

    const creature = type === 'frog'
      ? new Frog(this.scene, this.world, side, x)
      : new Snake(this.scene, this.world, side, x);

    this.creatures.push(creature);
  }

  registerKill(creature) {
    this.kills += 1;

    if (creature.type === 'frog') {
      this.killsByType.frog += 1;
      sound.playFrogRibbit();
    } else {
      this.killsByType.snake += 1;
      sound.playSnakeHiss();
    }

    this.spawnTimer = Math.min(this.spawnTimer, this.getSpawnInterval());

    if (this.onKill) {
      this.onKill(creature.type, this.kills);
    }
  }

  catchPrey(creature, x, z, radius = 3) {
    if (!creature || creature.isDead || creature.isFinished || creature.isDiving) return null;

    const dx = creature.position.x - x;
    const dz = creature.position.z - z;
    if (Math.hypot(dx, dz) > radius) return null;

    const index = this.creatures.indexOf(creature);
    if (index === -1) return null;

    this.creatures.splice(index, 1);
    return creature;
  }

  scareFromSmugglers(creature, smugglers) {
    if (!smugglers || !smugglers.length) return;

    let nearest = null;
    let nearestDistanceSq = SMUGGLER_SCARE_RADIUS * SMUGGLER_SCARE_RADIUS;

    for (let i = 0; i < smugglers.length; i++) {
      const smuggler = smugglers[i];
      if (smuggler.isDead || smuggler.state !== 'swimming') continue;

      const dx = creature.position.x - smuggler.position.x;
      const dz = creature.position.z - smuggler.position.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq < nearestDistanceSq) {
        nearest = smuggler;
        nearestDistanceSq = distanceSq;
      }
    }

    if (nearest) {
      creature.scareFrom(nearest.position.x, nearest.position.z);
    }
  }

  update(dt, boat, smugglers = []) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.creatures.length < this.maxActive) {
      this.spawnCreature();
      this.spawnTimer = this.getSpawnInterval();
    }

    const whackHitboxes = boat.getWhackHitboxes();
    const motorHitbox = boat.getMotorHitbox();
    const hullHitbox = boat.getHullHitbox();

    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const creature = this.creatures[i];
      creature.update(dt);
      this.scareFromSmugglers(creature, smugglers);

      if (!creature.isDead && !creature.isFinished && !creature.isDiving) {
        let whacked = false;
        for (const whackHitbox of whackHitboxes) {
          const distWhack = Math.hypot(
            creature.position.x - whackHitbox.center.x,
            creature.position.z - whackHitbox.center.z
          );
          if (distWhack <= whackHitbox.radius + creature.radius) {
            if (creature.kill('oar')) this.registerKill(creature);
            whacked = true;
            break;
          }
        }
        if (whacked) continue;

        const distHull = Math.hypot(
          creature.position.x - hullHitbox.center.x,
          creature.position.z - hullHitbox.center.z
        );
        if (distHull <= hullHitbox.radius * 0.75 + creature.radius) {
          creature.dive(boat.position);
          continue;
        }

        const motorRunning = Math.abs(boat.speed) > 1.0;
        const distMotor = Math.hypot(
          creature.position.x - motorHitbox.center.x,
          creature.position.z - motorHitbox.center.z
        );
        if (motorRunning && distMotor <= motorHitbox.radius + creature.radius) {
          if (creature.kill('motor')) this.registerKill(creature);
          continue;
        }
      }

      if (creature.isFinished) {
        creature.destroy();
        this.creatures.splice(i, 1);
      }
    }
  }
}
