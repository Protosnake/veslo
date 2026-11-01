import * as THREE from 'three';
import { sound } from '../systems/Audio.js';
import { PLAY_MIN_X, PLAY_MAX_X, PLAY_MIN_Z, PLAY_MAX_Z } from '../world/Bounds.js';

const MAN_OVERBOARD_SPEED_RATIO = 0.8;
const MAN_OVERBOARD_TURN_RATIO = 0.35;
const MAN_OVERBOARD_MIN_DELAY = 0.5;
const MAN_OVERBOARD_MAX_DELAY = 1.5;
const MAN_OVERBOARD_RECOVER_RADIUS = 2.4;
const MAN_OVERBOARD_COOLDOWN = 10;
const MAN_OVERBOARD_START_GRACE = 5;
const MAN_OVERBOARD_FALL_OFFSET = 2.6;
const MAN_OVERBOARD_MIN_AIR_TIME = 0.7;
const MAN_OVERBOARD_ROCK_IMPACT_RATIO = 0.55;
const MAN_OVERBOARD_STERN_TURN_RATIO = 0.3;
const MAN_OVERBOARD_STERN_SPEED_RATIO = 0.3;

const PROP_REED_TOLERANCE = 1.0;
const PROP_REED_ESCAPE_SPEED = 0.3;

const rollManOverboardThreshold = () =>
  MAN_OVERBOARD_MIN_DELAY +
  Math.random() * (MAN_OVERBOARD_MAX_DELAY - MAN_OVERBOARD_MIN_DELAY);

export class Boat {
  constructor(scene, riverWorld, onLandCrash, onRockBump, onManOverboard, onManRecovered) {
    this.scene = scene;
    this.world = riverWorld;
    this.onLandCrash = onLandCrash;
    this.onRockBump = onRockBump;
    this.onManOverboard = onManOverboard;
    this.onManRecovered = onManRecovered;

    // Kinematics & Physics
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.angle = 0; // heading angle matching group.rotation.y
    this.angularVelocity = 0;
    this.speed = 0;

    // Heavier, momentum-driven handling
    this.maxSpeed = 26;
    this.maxReverseSpeed = this.maxSpeed * 0.5; // reverse is half as fast as forward
    this.acceleration = 12;
    this.reverseAcceleration = this.acceleration * 0.5;
    this.turnSpeed = 5.2;
    this.forwardDrag = 0.32; // low longitudinal drag keeps the boat coasting
    this.lateralDrag = 1.1; // low side grip lets the stern slide out in turns
    this.turnDrag = 2.6;

    // Whack (Весло) state
    this.isSlapping = false;
    this.slapTime = 0;
    this.slapDuration = 0.35;
    this.slapCooldown = 0;
    this.slapId = 0;
    this.slapArcAngle = 0;
    this.whackTarget = null;
    this.whackTargetAcquired = false;
    this.oarAimScale = 1;
    this.oarAimQuat = new THREE.Quaternion();
    this.oarRestQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, -0.4));
    this.oarWindupQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.1, -0.8, -0.8));
    this.oarAimDir = new THREE.Vector3();
    this.oarUp = new THREE.Vector3(0, 1, 0);
    this.isCrashed = false;
    this.rockBumpCooldown = 0;
    this.isBankRam = false;
    this.motorStallTimer = 0;

    // Man overboard: the oarsman can be thrown off during sharp high-speed turns.
    this.isManOverboard = false;
    this.manOverboardRisk = 0;
    this.manOverboardThreshold = MAN_OVERBOARD_MIN_DELAY;
    this.overboardCooldown = 0;
    this.overboardElapsed = 0;
    this.overboardPosition = new THREE.Vector3();
    this.overboardVelocity = new THREE.Vector3();
    this.overboardSafeSpot = new THREE.Vector3();

    // Scratch state reused every frame to keep the hot path allocation-free.
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.propOffset = new THREE.Vector3();
    this.propWorldPos = new THREE.Vector3();
    this.wakeForward = new THREE.Vector3();
    this.whackHitbox = { center: new THREE.Vector3(), radius: 2.8 };
    this.motorHitbox = { center: new THREE.Vector3(), radius: 2.2 };
    this.hullHitbox = { center: new THREE.Vector3(), radius: 2.6 };
    this.engineSoundTimer = 0;
    this.engineFailure = false;
    this.engineSmokeTimer = 0;
    this.engineFxPos = new THREE.Vector3();

    this.createBoatModel();
    this.createOverboardMarker();
    this.reset();
  }

  createOverboardMarker() {
    this.overboardMarker = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.55, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffd44d,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.overboardMarker.rotation.x = -Math.PI / 2;
    this.overboardMarker.visible = false;
    this.scene.add(this.overboardMarker);
  }

  createBoatModel() {
    this.group = new THREE.Group();

    // 1. Rubber Inflatable Boat (Надувная лодка / Dinghy)
    // Forward direction = +X (Bow nose at +X, Transom & Motor at -X)
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x2e3d33, // military rubberized green
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true
    });
    const bottomRubberMat = new THREE.MeshLambertMaterial({ color: 0x1a241e });
    const rubStrakeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const transomWoodMat = new THREE.MeshLambertMaterial({ color: 0x5c4028 });
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x6e5236, flatShading: true });
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x7d5a37 });
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xe6ebe0 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.3 });

    this.hull = new THREE.Group();

    const tubeRadius = 0.40;
    const tubeY = 0.45; // elevated so water waves never clip into floor

    // Side pontoon tubes: running from x = -1.5 to x = +0.7 (length 2.2, centered at x = -0.4)
    const sideTubeLength = 2.2;
    const sideTubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, sideTubeLength, 12);
    sideTubeGeo.rotateZ(Math.PI / 2);

    // Left Tube (+Z in local space)
    const tubeL = new THREE.Mesh(sideTubeGeo, rubberMat);
    tubeL.position.set(-0.4, tubeY, 0.82);
    tubeL.castShadow = true;
    this.hull.add(tubeL);

    // Right Tube (-Z in local space)
    const tubeR = new THREE.Mesh(sideTubeGeo, rubberMat);
    tubeR.position.set(-0.4, tubeY, -0.82);
    tubeR.castShadow = true;
    this.hull.add(tubeR);

    // Iconic Conical Pontoon Ends at Stern (pointing -X backwards past the motor)
    const coneGeo = new THREE.ConeGeometry(tubeRadius, 0.75, 12);
    coneGeo.rotateZ(Math.PI / 2); // points -X

    const coneL = new THREE.Mesh(coneGeo, rubberMat);
    coneL.position.set(-1.87, tubeY, 0.82);
    coneL.castShadow = true;
    this.hull.add(coneL);

    const coneR = new THREE.Mesh(coneGeo, rubberMat);
    coneR.position.set(-1.87, tubeY, -0.82);
    coneR.castShadow = true;
    this.hull.add(coneR);

    // Bow Inflatable Tubes (converging smoothly inward towards center z = 0 at +X)
    // From (0.7, ±0.82) to (2.0, 0): dx = 1.3, dz = ±0.82, length = 1.54, angle = ±0.563 rad
    const bowTubeLength = 1.54;
    const bowTubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, bowTubeLength, 12);
    bowTubeGeo.rotateZ(Math.PI / 2);

    // Left Bow Tube (curves inward toward z = 0)
    const bowL = new THREE.Mesh(bowTubeGeo, rubberMat);
    bowL.position.set(1.35, tubeY, 0.41);
    bowL.rotation.y = 0.563; // angles inward!
    bowL.castShadow = true;
    this.hull.add(bowL);

    // Right Bow Tube (curves inward toward z = 0)
    const bowR = new THREE.Mesh(bowTubeGeo, rubberMat);
    bowR.position.set(1.35, tubeY, -0.41);
    bowR.rotation.y = -0.563; // angles inward!
    bowR.castShadow = true;
    this.hull.add(bowR);

    // Rounded Nose Cap (+X) seamlessly sealing the bow apex
    const noseCap = new THREE.Mesh(new THREE.SphereGeometry(tubeRadius, 12, 10), rubberMat);
    noseCap.position.set(2.0, tubeY, 0);
    noseCap.castShadow = true;
    this.hull.add(noseCap);

    // Black Rubber Bumper Strake along side tubes
    const strakeL = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.08), rubStrakeMat);
    strakeL.position.set(-0.4, tubeY, 1.2);
    this.hull.add(strakeL);

    const strakeR = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.08), rubStrakeMat);
    strakeR.position.set(-0.4, tubeY, -1.2);
    this.hull.add(strakeR);

    // Safety Grab Lifeline (rope along tubes)
    const ropeL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), ropeMat);
    ropeL.rotation.z = Math.PI / 2;
    ropeL.position.set(-0.4, tubeY + 0.24, 0.82);
    this.hull.add(ropeL);

    const ropeR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), ropeMat);
    ropeR.rotation.z = Math.PI / 2;
    ropeR.position.set(-0.4, tubeY + 0.24, -0.82);
    this.hull.add(ropeR);

    // Solid Sealed Bottom Hull Under-plate (prevents any water rendering through bottom!)
    const bottomHull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.32, 1.35), bottomRubberMat);
    bottomHull.position.set(0.0, 0.22, 0);
    bottomHull.receiveShadow = true;
    this.hull.add(bottomHull);

    // Elevated Wooden Slatted Deck Floor (safely above water wave crests)
    const floorGeo = new THREE.BoxGeometry(2.7, 0.08, 1.25);
    const floor = new THREE.Mesh(floorGeo, deckMat);
    floor.position.set(0.0, 0.38, 0);
    floor.receiveShadow = true;
    this.hull.add(floor);

    // Solid Transom Board (-X)
    const transomGeo = new THREE.BoxGeometry(0.12, 0.65, 1.35);
    const transom = new THREE.Mesh(transomGeo, transomWoodMat);
    transom.position.set(-1.5, 0.48, 0);
    transom.castShadow = true;
    this.hull.add(transom);

    // Rear Wooden Bench Seat (Officer sits here near motor)
    const rearBench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 1.35), benchMat);
    rearBench.position.set(-1.05, 0.52, 0);
    rearBench.castShadow = true;
    this.hull.add(rearBench);

    // Front Wooden Bench Seat
    const frontBench = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 1.3), benchMat);
    frontBench.position.set(0.5, 0.52, 0);
    frontBench.castShadow = true;
    this.hull.add(frontBench);

    this.group.add(this.hull);

    // 2. Outboard Motor mounted on Transom (-X)
    this.motorPivot = new THREE.Group();
    this.motorPivot.position.set(-1.65, 0.52, 0);

    const engineMount = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.3), metalMat);
    engineMount.position.set(0.1, 0.1, 0);
    this.motorPivot.add(engineMount);

    const cowlMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 0.3 });
    const motorCowl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.38), cowlMat);
    motorCowl.position.set(-0.25, 0.35, 0);
    motorCowl.castShadow = true;
    this.motorPivot.add(motorCowl);

    const cowlStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.08, 0.39),
      new THREE.MeshBasicMaterial({ color: 0xee2222 })
    );
    cowlStripe.position.set(-0.25, 0.35, 0);
    this.motorPivot.add(cowlStripe);

    const engineShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.85, 6), metalMat);
    engineShaft.position.set(-0.25, -0.3, 0);
    this.motorPivot.add(engineShaft);

    const skeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.04), metalMat);
    skeg.position.set(-0.25, -0.65, 0);
    this.motorPivot.add(skeg);

    const tiller = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    tiller.rotation.z = Math.PI / 2;
    tiller.position.set(0.35, 0.35, 0);
    this.motorPivot.add(tiller);

    // Engine-failure flame: a small additive cone on top of the cowl, hidden
    // until the run ends with a broken motor.
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6418,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.engineFlame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 6), flameMat);
    this.engineFlame.position.set(-0.25, 0.96, 0);
    this.engineFlame.visible = false;
    this.motorPivot.add(this.engineFlame);

    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffe36b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.engineFlameCore = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.48, 5),
      flameCoreMat
    );
    this.engineFlameCore.position.set(0, 0.1, 0);
    this.engineFlame.add(this.engineFlameCore);

    this.group.add(this.motorPivot);

    // 3. Officer (Steering at the stern from rear bench)
    this.createOfficer();

    // 4. Player & Oar (Весло) standing at bow (+X)
    this.createPlayerAndOar();

    this.scene.add(this.group);
  }

  createOfficer() {
    this.officerGroup = new THREE.Group();
    this.officerGroup.position.set(-1.05, 0.55, 0.2);

    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x334d38 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf2bb9b });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x1d2e20 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.65, 0.55), uniformMat);
    body.position.set(0, 0.45, 0);
    body.castShadow = true;
    this.officerGroup.add(body);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), uniformMat);
    legs.position.set(0.28, 0.15, 0);
    this.officerGroup.add(legs);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), skinMat);
    head.position.set(0, 0.95, 0);
    head.castShadow = true;
    this.officerGroup.add(head);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 8), capMat);
    cap.position.set(0, 1.12, 0);
    this.officerGroup.add(cap);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.26), capMat);
    visor.position.set(0.18, 1.09, 0);
    this.officerGroup.add(visor);

    this.officerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.65, 6), uniformMat);
    this.officerArm.rotation.z = -Math.PI / 3;
    this.officerArm.position.set(-0.25, 0.55, -0.15);
    this.officerArm.castShadow = true;
    this.officerGroup.add(this.officerArm);

    this.group.add(this.officerGroup);
  }

  createPlayerAndOar() {
    this.playerGroup = new THREE.Group();
    this.playerGroup.position.set(0.5, 0.45, 0);

    const vestMat = new THREE.MeshLambertMaterial({ color: 0x223826 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1b281f });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5c29b });
    const hatMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.48), pantsMat);
    legs.position.set(0, 0.28, 0);
    this.playerGroup.add(legs);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.75, 0.62), vestMat);
    body.position.set(0, 0.85, 0);
    body.castShadow = true;
    this.playerGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skinMat);
    head.position.set(0, 1.4, 0);
    head.castShadow = true;
    this.playerGroup.add(head);

    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), hatMat);
    beanie.position.set(0, 1.5, 0);
    this.playerGroup.add(beanie);

    this.oarPivot = new THREE.Group();
    this.oarPivot.position.set(0.15, 1.05, 0);

    const shaftMat = new THREE.MeshLambertMaterial({ color: 0xb58045 });
    const oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), shaftMat);
    oarShaft.position.set(0, 0.9, 0);
    oarShaft.castShadow = true;
    this.oarPivot.add(oarShaft);

    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xca8c4c });
    const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.15, 0.06), bladeMat);
    oarBlade.position.set(0, 2.15, 0);
    oarBlade.castShadow = true;
    this.oarPivot.add(oarBlade);

    const bladeTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.32, 0.07),
      new THREE.MeshLambertMaterial({ color: 0xd92626 })
    );
    bladeTip.position.set(0, 2.55, 0);
    this.oarPivot.add(bladeTip);

    // Empty anchor at the blade centre so the hitbox can follow the visible oar.
    this.oarTip = new THREE.Object3D();
    this.oarTip.position.set(0, 2.15, 0);
    this.oarPivot.add(this.oarTip);

    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), skinMat);
    handL.position.set(0, 0.2, 0.15);
    this.oarPivot.add(handL);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), skinMat);
    handR.position.set(0, 0.5, -0.15);
    this.oarPivot.add(handR);

    this.oarPivot.rotation.x = 0.5;
    this.oarPivot.rotation.z = -0.4;
    this.oarPivot.rotation.y = 0;

    this.playerGroup.add(this.oarPivot);
    this.group.add(this.playerGroup);
  }

  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.angle = 0;
    this.angularVelocity = 0;
    this.isSlapping = false;
    this.slapTime = 0;
    this.slapCooldown = 0;
    this.slapId = 0;
    this.isCrashed = false;
    this.rockBumpCooldown = 0;
    this.isBankRam = false;
    this.motorStallTimer = 0;
    this.engineFailure = false;
    this.engineSmokeTimer = 0;
    if (this.engineFlame) this.engineFlame.visible = false;
    this.whackTarget = null;
    this.whackTargetAcquired = false;

    this.isManOverboard = false;
    this.manOverboardRisk = 0;
    this.manOverboardThreshold = rollManOverboardThreshold();
    this.overboardCooldown = MAN_OVERBOARD_START_GRACE;
    this.overboardElapsed = 0;
    this.overboardVelocity.set(0, 0, 0);
    if (this.overboardMarker) this.overboardMarker.visible = false;

    this.group.attach(this.playerGroup);
    this.playerGroup.position.set(0.5, 0.45, 0);
    this.playerGroup.rotation.set(0, 0, 0);

    this.oarPivot.rotation.set(0.5, 0, -0.4);
    this.oarPivot.scale.set(1, 1, 1);

    this.group.position.copy(this.position);
    this.group.rotation.set(0, 0, 0);
    sound.startEngineSound();
  }

  triggerSlap() {
    if (this.isManOverboard || this.isSlapping || this.slapCooldown > 0) return false;

    this.isSlapping = true;
    this.slapTime = 0;
    this.slapCooldown = 0.5;
    this.slapId += 1;
    this.whackTarget = null;
    this.whackTargetAcquired = false;
    this.oarPivot.scale.set(1, 1, 1);
    sound.playWhoosh();
    return true;
  }

  findWhackTarget(smugglers) {
    if (!smugglers || !smugglers.length) return null;

    let nearest = null;
    let nearestDistanceSq = 6 * 6;

    for (let i = 0; i < smugglers.length; i++) {
      const s = smugglers[i];
      if (!s || s.isDead || s.state !== 'swimming' || !s.group || !s.group.visible) continue;

      const dx = s.position.x - this.position.x;
      const dz = s.position.z - this.position.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq < nearestDistanceSq) {
        nearest = s;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  updateOarAim(target) {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const dx = target.position.x - this.position.x;
    const dz = target.position.z - this.position.z;

    // Smuggler head in boat-local space (the oar pivot sits at 0.65, 1.5).
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    const headY = (target.group ? target.group.position.y : target.position.y) + 0.3;
    const pivotY = this.group.position.y + 1.5;

    const dirX = localX - 0.65;
    const dirY = headY - pivotY;
    const dirZ = localZ;
    const distance = Math.hypot(dirX, dirY, dirZ);
    if (distance < 0.001) return false;

    this.oarAimDir.set(dirX / distance, dirY / distance, dirZ / distance);
    this.oarAimQuat.setFromUnitVectors(this.oarUp, this.oarAimDir);
    this.oarAimScale = THREE.MathUtils.clamp(distance / 2.15, 0.5, 1.5);
    return true;
  }

  getWhackHitbox() {
    if (this.isManOverboard) return null;
    if (!this.isSlapping || this.slapTime < 0.02 || this.slapTime > 0.32) {
      return null;
    }

    if (this.whackTarget && this.oarTip) {
      this.oarTip.getWorldPosition(this.whackHitbox.center);
      return this.whackHitbox;
    }

    this.propOffset.set(2.6, 0, 0).applyAxisAngle(this.yAxis, this.angle + this.slapArcAngle);
    this.whackHitbox.center.copy(this.position).add(this.propOffset);
    return this.whackHitbox;
  }

  getStreakAnchorWorldPosition(target) {
    if (this.oarTip && !this.isManOverboard) {
      this.oarTip.getWorldPosition(target);
      target.y += 0.9;
    } else {
      target.copy(this.position);
      target.y += 4.2;
    }
    return target;
  }

  getMotorHitbox() {
    this.propOffset.set(-2.1, 0, 0).applyAxisAngle(this.yAxis, this.angle);
    this.motorHitbox.center.copy(this.position).add(this.propOffset);
    return this.motorHitbox;
  }

  getHullHitbox() {
    this.propOffset.set(0.5, 0, 0).applyAxisAngle(this.yAxis, this.angle);
    this.hullHitbox.center.copy(this.position).add(this.propOffset);
    return this.hullHitbox;
  }

  updateManOverboardRisk(dt) {
    if (this.overboardCooldown > 0) {
      this.manOverboardRisk = Math.max(0, this.manOverboardRisk - dt * 2);
      return;
    }

    const speedRatio = Math.abs(this.speed) / this.maxSpeed;
    const turnRatio = Math.abs(this.angularVelocity) / this.turnSpeed;
    const fastEnough =
      this.speed > 0 && speedRatio >= MAN_OVERBOARD_SPEED_RATIO;
    const turningHardEnough = turnRatio >= MAN_OVERBOARD_TURN_RATIO;

    if (fastEnough && turningHardEnough) {
      const speedWeight = THREE.MathUtils.clamp(
        (speedRatio - MAN_OVERBOARD_SPEED_RATIO) /
          (1 - MAN_OVERBOARD_SPEED_RATIO),
        0,
        1
      );
      const turnWeight = THREE.MathUtils.clamp(
        (turnRatio - MAN_OVERBOARD_TURN_RATIO) /
          (1 - MAN_OVERBOARD_TURN_RATIO),
        0,
        1
      );
      this.manOverboardRisk += dt * (0.5 + 0.5 * speedWeight) * (0.6 + 0.4 * turnWeight);
      if (this.manOverboardRisk >= this.manOverboardThreshold) {
        this.fallOverboard();
      }
    } else {
      this.manOverboardRisk = Math.max(0, this.manOverboardRisk - dt * 1.5);
    }
  }

  isOverboardSpotClear(x, z, margin = 1.3) {
    const rocks = this.world.rockColliders;
    if (!rocks || !rocks.length) return true;

    for (let i = 0; i < rocks.length; i++) {
      const rock = rocks[i];
      const minDistance = (rock.visualRadius ?? rock.radius) + margin;
      const dx = x - rock.x;
      const dz = z - rock.z;
      if (dx * dx + dz * dz < minDistance * minDistance) return false;
    }

    return true;
  }

  resolveOverboardRockCollisions(margin = 1) {
    const rocks = this.world.rockColliders;
    if (!rocks || !rocks.length) return;

    const p = this.overboardPosition;
    for (let pass = 0; pass < 6; pass++) {
      let collided = false;

      for (let i = 0; i < rocks.length; i++) {
        const rock = rocks[i];
        const minDistance = (rock.visualRadius ?? rock.radius) + margin;
        let dx = p.x - rock.x;
        let dz = p.z - rock.z;
        let distance = Math.hypot(dx, dz);

        if (distance >= minDistance) continue;

        if (distance < 1e-4) {
          dx = 0;
          dz = 1;
          distance = 1;
        }

        p.x = rock.x + (dx / distance) * minDistance;
        p.z = rock.z + (dz / distance) * minDistance;
        collided = true;
      }

      if (!collided) break;
    }
  }

  findSafeOverboardSpot(baseX, baseZ, dirX, dirZ) {
    const spot = this.overboardSafeSpot;

    const clampIntoBounds = (x, z, out) => {
      out.x = THREE.MathUtils.clamp(x, PLAY_MIN_X + 1, PLAY_MAX_X - 1);
      out.z = THREE.MathUtils.clamp(z, PLAY_MIN_Z + 1.2, PLAY_MAX_Z - 1.2);
      return out;
    };

    clampIntoBounds(baseX, baseZ, spot);
    if (this.isOverboardSpotClear(spot.x, spot.z)) return spot;

    // The fall direction may point straight into a rock cluster. Search rings
    // around the boat, closest ring first and preferring the natural fall
    // direction, until there is a spot in open water the hull can reach.
    const preferredAngle = Math.atan2(dirZ, dirX);
    const radii = [MAN_OVERBOARD_FALL_OFFSET, 3.6, 4.6, 5.8, 7.0];
    const step = (Math.PI * 2) / 24;

    for (let r = 0; r < radii.length; r++) {
      const radius = radii[r];
      for (let s = 0; s < 24; s++) {
        const offset = Math.ceil(s / 2) * step * (s % 2 === 1 ? 1 : -1);
        const angle = preferredAngle + offset;
        const x = this.position.x + Math.cos(angle) * radius;
        const z = this.position.z + Math.sin(angle) * radius;

        if (x < PLAY_MIN_X + 1 || x > PLAY_MAX_X - 1) continue;
        if (z < PLAY_MIN_Z + 1.2 || z > PLAY_MAX_Z - 1.2) continue;
        if (!this.isOverboardSpotClear(x, z)) continue;

        spot.set(x, 0, z);
        return spot;
      }
    }

    // Fallback: shove the landing point out of any overlapping rocks.
    this.overboardPosition.set(baseX, 0, baseZ);
    this.resolveOverboardRockCollisions();
    return clampIntoBounds(this.overboardPosition.x, this.overboardPosition.z, spot);
  }

  fallOverboard() {
    if (this.isManOverboard) return;

    this.isManOverboard = true;
    this.manOverboardRisk = 0;
    this.manOverboardThreshold = rollManOverboardThreshold();
    this.overboardElapsed = 0;

    // Drop the active oar swing so the detached oarsman cannot keep hitting.
    this.isSlapping = false;
    this.slapTime = 0;
    this.whackTarget = null;
    this.whackTargetAcquired = false;
    this.oarPivot.scale.set(1, 1, 1);
    this.oarPivot.rotation.set(0.5, 0, -0.4);

    this.playerGroup.getWorldPosition(this.overboardPosition);

    // Throw him toward the outside of the turn, but never into a rock cluster.
    const outwardSign = this.angularVelocity >= 0 ? 1 : -1;
    const sideX = Math.sin(this.angle) * outwardSign;
    const sideZ = Math.cos(this.angle) * outwardSign;
    const baseX = this.overboardPosition.x + sideX * MAN_OVERBOARD_FALL_OFFSET;
    const baseZ = this.overboardPosition.z + sideZ * MAN_OVERBOARD_FALL_OFFSET;
    const safeSpot = this.findSafeOverboardSpot(baseX, baseZ, sideX, sideZ);
    this.overboardPosition.copy(safeSpot);

    this.overboardVelocity.set(
      this.velocity.x * 0.55 + sideX * 5,
      0,
      this.velocity.z * 0.55 + sideZ * 5
    );

    this.scene.attach(this.playerGroup);
    this.playerGroup.position.copy(this.overboardPosition);
    this.playerGroup.rotation.set(0, this.angle, 0);

    this.overboardMarker.visible = true;
    this.overboardMarker.position.set(this.overboardPosition.x, 0.08, this.overboardPosition.z);
    this.overboardMarker.scale.setScalar(1);
    this.overboardMarker.material.opacity = 0.5;

    if (this.world.emitSplash) {
      this.world.emitSplash(this.overboardPosition.x, this.overboardPosition.z, 16, 0xdff2fc);
    }

    // Losing a man overboard also costs a little momentum.
    this.velocity.multiplyScalar(0.92);
    this.speed =
      this.velocity.x * Math.cos(this.angle) - this.velocity.z * Math.sin(this.angle);

    if (this.onManOverboard) this.onManOverboard(this.overboardPosition);
  }

  updateOverboardPlayer(dt) {
    this.overboardElapsed += dt;

    const current = this.world.getCurrentVelocity ? this.world.getCurrentVelocity() : null;
    this.overboardVelocity.multiplyScalar(Math.exp(-1.6 * dt));

    this.overboardPosition.x +=
      (this.overboardVelocity.x + (current ? current.x * 0.35 : 0)) * dt;
    this.overboardPosition.z +=
      (this.overboardVelocity.z + (current ? current.z * 0.35 : 0)) * dt;

    // Drift must never leave him embedded in the rock line, otherwise the hull
    // has no way to reach him for pickup.
    this.resolveOverboardRockCollisions(1);

    this.overboardPosition.x = THREE.MathUtils.clamp(
      this.overboardPosition.x,
      PLAY_MIN_X + 1,
      PLAY_MAX_X - 1
    );
    this.overboardPosition.z = THREE.MathUtils.clamp(
      this.overboardPosition.z,
      PLAY_MIN_Z + 1.2,
      PLAY_MAX_Z - 1.2
    );

    const wave =
      Math.sin(this.overboardPosition.x * 0.35 + this.world.time * 2.2) * 0.22 +
      Math.cos(this.overboardPosition.z * 0.4 + this.world.time * 1.8) * 0.16;
    this.overboardPosition.y = Math.max(0, wave) * 0.5 - 0.05;

    this.playerGroup.position.copy(this.overboardPosition);
    this.playerGroup.rotation.y += dt * 0.3;
    this.playerGroup.rotation.x = Math.sin(this.overboardElapsed * 1.4) * 0.06;
    this.playerGroup.rotation.z = Math.cos(this.overboardElapsed * 1.1) * 0.05;

    // The oar rests across the water while he waits to be picked up.
    this.oarPivot.rotation.set(0.25, 0.2, -0.95);
    this.oarPivot.scale.set(1, 1, 1);

    this.overboardMarker.position.set(
      this.overboardPosition.x,
      0.08,
      this.overboardPosition.z
    );
    this.overboardMarker.scale.setScalar(
      1 + Math.sin(this.overboardElapsed * 3) * 0.08
    );
    this.overboardMarker.material.opacity =
      0.35 + Math.sin(this.overboardElapsed * 5) * 0.2;

    if (this.overboardElapsed < MAN_OVERBOARD_MIN_AIR_TIME) return;

    const dx = this.overboardPosition.x - this.position.x;
    const dz = this.overboardPosition.z - this.position.z;
    if (dx * dx + dz * dz <= MAN_OVERBOARD_RECOVER_RADIUS * MAN_OVERBOARD_RECOVER_RADIUS) {
      this.recoverPlayer();
    }
  }

  recoverPlayer() {
    if (!this.isManOverboard) return;

    this.group.attach(this.playerGroup);
    this.playerGroup.position.set(0.5, 0.45, 0);
    this.playerGroup.rotation.set(0, 0, 0);
    this.oarPivot.rotation.set(0.5, 0, -0.4);
    this.oarPivot.scale.set(1, 1, 1);

    this.isManOverboard = false;
    this.overboardElapsed = 0;
    this.overboardVelocity.set(0, 0, 0);
    this.overboardCooldown = MAN_OVERBOARD_COOLDOWN;
    this.manOverboardRisk = 0;
    this.manOverboardThreshold = rollManOverboardThreshold();
    this.overboardMarker.visible = false;

    if (this.world.emitSplash) {
      this.world.emitSplash(this.position.x, this.position.z, 12, 0xdff2fc);
    }

    if (this.onManRecovered) this.onManRecovered();
  }

  applyRamImpact() {
    this.velocity.multiplyScalar(0.35);
    this.speed = this.velocity.x * Math.cos(this.angle) - this.velocity.z * Math.sin(this.angle);
  }

  applyMotorShred() {
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.angularVelocity = 0;
    this.motorStallTimer = 0.5;
    sound.stopEngineSound();
    sound.playRotorThrottle();
  }

  startEngineFailure() {
    if (this.engineFailure) return;
    this.engineFailure = true;
    this.engineSmokeTimer = 0;
    if (this.engineFlame) this.engineFlame.visible = true;
    sound.stopEngineSound();
  }

  updateEngineFailureFx(dt) {
    if (!this.engineFailure) return;

    const t = this.world.time;
    const flicker = 0.75 + Math.sin(t * 43) * 0.18 + Math.sin(t * 71) * 0.1;
    if (this.engineFlame) {
      this.engineFlame.scale.set(1, Math.max(0.45, flicker), 1);
      this.engineFlame.material.opacity = 0.6 + Math.max(0, flicker - 0.55) * 0.7;
    }
    if (this.engineFlameCore) {
      this.engineFlameCore.material.opacity = 0.45 + Math.random() * 0.4;
    }

    this.engineSmokeTimer -= dt;
    if (this.engineSmokeTimer > 0 || !this.world.emitParticle || !this.engineFlame) return;
    this.engineSmokeTimer = 0.06 + Math.random() * 0.08;

    this.engineFlame.getWorldPosition(this.engineFxPos);
    const x = this.engineFxPos.x;
    const y = this.engineFxPos.y + 0.15;
    const z = this.engineFxPos.z;

    this.world.emitParticle(
      x + (Math.random() - 0.5) * 0.16,
      y,
      z + (Math.random() - 0.5) * 0.16,
      (Math.random() - 0.5) * 0.35,
      1.1 + Math.random() * 1.1,
      (Math.random() - 0.5) * 0.35,
      Math.random() < 0.35 ? 0x3a3a3a : 0x1c1c1c,
      0.9 + Math.random() * 0.6,
      1.6 + Math.random() * 1.3
    );

    if (Math.random() < 0.22) {
      this.world.emitParticle(
        x + (Math.random() - 0.5) * 0.2,
        y - 0.4,
        z + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.18,
        0.05,
        (Math.random() - 0.5) * 0.18,
        0x101310,
        1.2 + Math.random() * 0.6,
        2.4 + Math.random() * 1.4
      );
    }
  }

  separateFromRock(rock, clearance = 2.6) {
    if (!rock) return;
    let dx = this.position.x - rock.x;
    let dz = this.position.z - rock.z;
    let distance = Math.hypot(dx, dz);
    const minDistance = (rock.visualRadius ?? rock.radius) + clearance;
    if (distance >= minDistance) return;

    if (distance < 0.001) {
      dx = 1;
      dz = 0;
      distance = 1;
    }
    this.position.x = rock.x + (dx / distance) * minDistance;
    this.position.z = rock.z + (dz / distance) * minDistance;
  }

  holdCrashedPose() {
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.angularVelocity = 0;

    this.group.position.copy(this.position);
    const waveAtBoat =
      Math.sin(this.position.x * 0.35 + this.world.time * 2.2) * 0.22 +
      Math.cos(this.position.z * 0.4 + this.world.time * 1.8) * 0.16;
    this.group.position.y = Math.max(0, waveAtBoat) * 0.5 + 0.16;
    this.group.rotation.y = this.angle;
    this.motorPivot.rotation.y = THREE.MathUtils.lerp(
      this.motorPivot.rotation.y,
      0,
      0.25
    );
  }

  bounceOffBarrier(rockHit, hitWestBarrier, hitEastBarrier) {
    let normalX = 0;
    let normalZ = 0;

    if (rockHit) {
      const dx = this.position.x - rockHit.x;
      const dz = this.position.z - rockHit.z;
      const distance = Math.hypot(dx, dz) || 1;
      normalX = dx / distance;
      normalZ = dz / distance;
      const minDistance = (rockHit.visualRadius ?? rockHit.radius) + 2.6;
      this.position.x = rockHit.x + normalX * minDistance;
      this.position.z = rockHit.z + normalZ * minDistance;
    } else if (hitWestBarrier) {
      this.position.x = PLAY_MIN_X;
      normalX = 1;
    } else if (hitEastBarrier) {
      this.position.x = PLAY_MAX_X;
      normalX = -1;
    }

    const normalSpeed = this.velocity.x * normalX + this.velocity.z * normalZ;
    const impact = normalSpeed < -0.4;

    // Hard rock hits always throw the oarsman. So does catching the stern on a
    // rock while carving a fast turn, even if the impact itself is not huge.
    if (rockHit && !this.isManOverboard) {
      const forwardX = Math.cos(this.angle);
      const forwardZ = -Math.sin(this.angle);
      const sternHit = normalX * forwardX + normalZ * forwardZ > 0.2;
      const hardImpact =
        normalSpeed <= -this.maxSpeed * MAN_OVERBOARD_ROCK_IMPACT_RATIO;
      const hardTurn =
        Math.abs(this.angularVelocity) >=
        this.turnSpeed * MAN_OVERBOARD_STERN_TURN_RATIO;
      const fastEnough =
        Math.abs(this.speed) >= this.maxSpeed * MAN_OVERBOARD_STERN_SPEED_RATIO;

      if (hardImpact || (sternHit && hardTurn && fastEnough)) {
        this.fallOverboard();
      }
    }

    if (impact) {
      const restitution = 0.35;
      this.velocity.x -= (1 + restitution) * normalSpeed * normalX;
      this.velocity.z -= (1 + restitution) * normalSpeed * normalZ;
    }
    this.velocity.multiplyScalar(0.55);
    this.speed = this.velocity.x * Math.cos(this.angle) - this.velocity.z * Math.sin(this.angle);
    this.angularVelocity *= 0.5;

    if (impact && rockHit && this.world.emitRockImpact) {
      this.world.emitRockImpact(this.position.x, this.position.z, rockHit);
    }

    if (impact && this.rockBumpCooldown <= 0) {
      this.rockBumpCooldown = 1.2;
      if (this.onRockBump) this.onRockBump(rockHit);
    }
  }

  update(dt, input, smugglers = null) {
    this.updateEngineFailureFx(dt);

    // A dead run must not keep drifting on the river current. The hull stays
    // exactly where it crashed, clear of the rock that killed it.
    if (this.isCrashed) {
      this.holdCrashedPose();
      return;
    }

    if (this.slapCooldown > 0) {
      this.slapCooldown -= dt;
    }
    if (this.rockBumpCooldown > 0) {
      this.rockBumpCooldown -= dt;
    }
    if (this.overboardCooldown > 0) {
      this.overboardCooldown -= dt;
    }
    if (this.motorStallTimer > 0) {
      this.motorStallTimer = Math.max(0, this.motorStallTimer - dt);
      this.velocity.set(0, 0, 0);
      this.speed = 0;
      this.angularVelocity = 0;
      if (this.motorStallTimer <= 0) sound.startEngineSound();
      if (this.isManOverboard) this.updateOverboardPlayer(dt);
      return;
    }

    let throttle = 0;
    let steer = 0;

    if (input.forward) throttle += 1;
    if (input.backward) throttle -= 1.0; // full power reverse!
    if (input.left) steer += 1;
    if (input.right) steer -= 1;

    // Analog thumbstick uses the same model as WASD: the vertical axis is
    // throttle/reverse and the horizontal axis is steering, with granular
    // magnitudes instead of binary key presses.
    if (input.throttleAxis) throttle = input.throttleAxis;
    if (input.steerAxis) steer = input.steerAxis;

    if (input.mouseAiming && input.targetWorldPos) {
      const dx = input.targetWorldPos.x - this.position.x;
      const dz = input.targetWorldPos.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.2) {
        let desiredAngle = Math.atan2(-dz, dx);
        let diff = desiredAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        steer = Math.max(-1, Math.min(1, diff * 3.5));
        if (input.mouseThrust) {
          throttle = 1.0;
        }
      }
    }

    // Rudder authority builds up with boat speed: you cannot pivot in place
    const speedFactor = Math.min(1, Math.abs(this.speed) / (this.maxSpeed * 0.5));
    const steerAuthority = 0.2 + 0.8 * speedFactor;
    this.angularVelocity += steer * this.turnSpeed * steerAuthority * dt;
    this.angularVelocity -= this.angularVelocity * this.turnDrag * dt;
    this.angle += this.angularVelocity * dt;

    const forwardX = Math.cos(this.angle);
    const forwardZ = -Math.sin(this.angle);
    const sideX = Math.sin(this.angle);
    const sideZ = Math.cos(this.angle);

    // Split momentum into hull-aligned and sideways components
    let forwardSpeed = this.velocity.x * forwardX + this.velocity.z * forwardZ;
    let lateralSpeed = this.velocity.x * sideX + this.velocity.z * sideZ;

    if (throttle > 0) {
      forwardSpeed += throttle * this.acceleration * dt;
    } else if (throttle < 0) {
      forwardSpeed += throttle * this.reverseAcceleration * dt;
    }

    // Water resists sideways sliding less than forward motion, so turns drift
    forwardSpeed -= forwardSpeed * this.forwardDrag * dt;
    lateralSpeed -= lateralSpeed * this.lateralDrag * dt;

    forwardSpeed = Math.max(-this.maxReverseSpeed, Math.min(this.maxSpeed, forwardSpeed));
    lateralSpeed = Math.max(-this.maxSpeed * 0.8, Math.min(this.maxSpeed * 0.8, lateralSpeed));

    this.speed = forwardSpeed;
    this.velocity.set(
      forwardX * forwardSpeed + sideX * lateralSpeed,
      0,
      forwardZ * forwardSpeed + sideZ * lateralSpeed
    );

    // Momentum carries the boat: it does not stop or turn on a dime
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // River current advection (shared config so weather can change it later)
    if (this.world.getCurrentVelocity) {
      const current = this.world.getCurrentVelocity();
      this.position.x += current.x * dt;
      this.position.z += current.z * dt;
    }

    // Hull contact with a bank drags the boat unless it is a high-speed ram;
    // the engine/propeller crossing the bank line ends the run.
    const zHalfExtent =
      Math.abs(Math.sin(this.angle)) * 2.2 + Math.abs(Math.cos(this.angle)) * 1.2;
    const northPenetration = Math.max(0, PLAY_MIN_Z - (this.position.z - zHalfExtent));
    const southPenetration = Math.max(0, this.position.z + zHalfExtent - PLAY_MAX_Z);
    const bankPenetration = Math.max(northPenetration, southPenetration);

    if (!this.isCrashed && bankPenetration > 0) {
      const northSide = northPenetration > 0;
      const movingIntoBank = northSide ? this.velocity.z < 0 : this.velocity.z > 0;
      const ramming = movingIntoBank && this.speed >= this.maxSpeed * 0.75;
      if (ramming) this.isBankRam = true;
      const depth = Math.min(1, bankPenetration / 2.5);
      const awayFromBank = northSide ? 1 : -1;
      const escaping = this.velocity.z * awayFromBank > 0;
      const dragRate = ramming ? 0.6 : escaping ? 1.2 : 4 + depth * 9;
      const bankDamping = Math.exp(-dragRate * dt);
      this.velocity.multiplyScalar(bankDamping);
      this.speed =
        this.velocity.x * Math.cos(this.angle) - this.velocity.z * Math.sin(this.angle);
      this.angularVelocity *= Math.exp(-2 * dt);
    } else if (bankPenetration <= 0) {
      this.isBankRam = false;
    }

    const engineX = this.position.x - Math.cos(this.angle) * 1.9;
    const engineZ = this.position.z + Math.sin(this.angle) * 1.9;
    const engineNorthPenetration = PLAY_MIN_Z - engineZ;
    const engineSouthPenetration = engineZ - PLAY_MAX_Z;
    const engineInNorthReeds = engineNorthPenetration > 0;
    // Brushing the reeds is survivable. The prop only snags once it is properly
    // buried and still pushing north; backing away always pulls it free.
    const engineStuckNorth =
      engineNorthPenetration > PROP_REED_TOLERANCE &&
      this.velocity.z <= -PROP_REED_ESCAPE_SPEED;
    const engineStuckSouth = engineSouthPenetration >= 0;
    const hitWestBarrier = this.position.x <= PLAY_MIN_X;
    const hitEastBarrier = this.position.x >= PLAY_MAX_X;

    let engineRock = null;
    if (!this.isCrashed && this.world.findRockCollision) {
      engineRock = this.world.findRockCollision(engineX, engineZ, 0.45);
    }

    let rockHit = null;
    if (!this.isCrashed && this.world.findRockCollision) {
      const hullRadius = 1.15;
      rockHit = this.world.findRockCollision(
        this.position.x + forwardX * 1.15,
        this.position.z + forwardZ * 1.15,
        hullRadius
      );

      if (!rockHit) {
        rockHit = this.world.findRockCollision(this.position.x, this.position.z, hullRadius);
      }

      if (!rockHit) {
        rockHit = this.world.findRockCollision(
          this.position.x - forwardX * 0.85,
          this.position.z - forwardZ * 0.85,
          hullRadius
        );
      }
    }

    if (!this.isCrashed && (engineRock || engineStuckNorth || engineStuckSouth)) {
      this.isCrashed = true;
      this.speed = 0;
      this.velocity.set(0, 0, 0);
      this.angularVelocity = 0;

      // Make sure the hull is visibly outside the rock, not just the prop.
      if (engineRock) {
        this.separateFromRock(engineRock, 3.1);
        if (this.world.emitRockImpact) {
          this.world.emitRockImpact(engineX, engineZ, engineRock);
        }
      }

      this.startEngineFailure();
      this.holdCrashedPose();

      if (this.onLandCrash) {
        let reason;
        if (engineRock) {
          reason = Math.random() < 0.5 ? 'engineRock1' : 'engineRock2';
        } else if (this.isBankRam) {
          reason = 'bankRam';
        } else {
          reason = engineStuckNorth ? 'stuckNorth' : 'stuckSouth';
        }
        this.onLandCrash(reason);
      }
      return;
    }

    if (!this.isCrashed && (rockHit || hitWestBarrier || hitEastBarrier)) {
      this.bounceOffBarrier(rockHit, hitWestBarrier, hitEastBarrier);
    }

    if (!this.isCrashed && engineInNorthReeds) {
      const reedDamping = Math.exp(-3.5 * dt);
      this.velocity.multiplyScalar(reedDamping);
      this.speed =
        this.velocity.x * Math.cos(this.angle) - this.velocity.z * Math.sin(this.angle);
    }

    const speedRatio = Math.abs(this.speed) / this.maxSpeed;
    this.engineSoundTimer -= dt;
    if (this.engineSoundTimer <= 0) {
      this.engineSoundTimer = 0.1;
      sound.updateEngine(speedRatio);
    }

    // Engine wake strictly emitted directly behind the outboard motor propeller
    if (Math.abs(this.speed) > 1.2 && this.world) {
      this.propOffset.set(-1.8, 0, 0).applyAxisAngle(this.yAxis, this.angle);
      this.propWorldPos.copy(this.position).add(this.propOffset);
      this.wakeForward.set(forwardX, 0, forwardZ);
      if (this.world.emitEngineWake) {
        this.world.emitEngineWake(this.propWorldPos, this.wakeForward, this.speed, this.speed < 0);
      } else if (this.world.emitWake) {
        this.world.emitWake(this.position.x, this.position.z, this.angle, Math.abs(this.speed));
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.angle;

    // Dynamic wave riding: boat rides ON TOP of water waves so water never clips into the floor!
    const waveAtBoat = Math.sin(this.position.x * 0.35 + this.world.time * 2.2) * 0.22 +
                       Math.cos(this.position.z * 0.4 + this.world.time * 1.8) * 0.16;
    this.group.position.y = Math.max(0, waveAtBoat) * 0.5 + 0.16;

    // Banking roll
    const targetRoll = -this.angularVelocity * 0.12;
    this.hull.rotation.x = THREE.MathUtils.lerp(this.hull.rotation.x, targetRoll, 0.2);

    // Motor tiller steering animation
    const targetMotorAngle = steer * 0.45;
    this.motorPivot.rotation.y = THREE.MathUtils.lerp(this.motorPivot.rotation.y, targetMotorAngle, 0.25);
    if (this.officerArm) {
      this.officerArm.rotation.y = -this.motorPivot.rotation.y * 0.7;
    }

    // Man overboard: either build up the fall risk or drift the detached
    // oarsman and let the hull pick him back up.
    if (this.isManOverboard) {
      this.updateOverboardPlayer(dt);
    } else {
      this.updateManOverboardRisk(dt);
    }

    // Slap (Весло) Animation (the oar leaves with the oarsman when overboard)
    if (this.isManOverboard) {
      // Overboard oar pose is handled by updateOverboardPlayer.
    } else if (this.isSlapping) {
      this.slapTime += dt;
      const progress = this.slapTime / this.slapDuration;

      // Lock the first target of the swing so the oar does not chase a new
      // smuggler after the intended one has already been hit.
      if (!this.whackTargetAcquired) {
        this.whackTarget = this.findWhackTarget(smugglers);
        this.whackTargetAcquired = true;
      }
      const hasAim = this.whackTarget && this.updateOarAim(this.whackTarget);

      if (progress < 1.0) {
        if (hasAim) {
          if (progress < 0.2) {
            const t = progress / 0.2;
            this.oarPivot.quaternion.copy(this.oarRestQuat).slerp(this.oarWindupQuat, t);
            this.oarPivot.scale.y = 1;
            this.slapArcAngle = -0.8;
          } else if (progress < 0.55) {
            const t = (progress - 0.2) / 0.35;
            const eased = t * t * (3 - 2 * t);
            this.oarPivot.quaternion.copy(this.oarWindupQuat).slerp(this.oarAimQuat, eased);
            this.oarPivot.scale.y = THREE.MathUtils.lerp(1, this.oarAimScale, eased);
          } else {
            const t = (progress - 0.55) / 0.45;
            this.oarPivot.quaternion.copy(this.oarAimQuat).slerp(this.oarRestQuat, t);
            this.oarPivot.scale.y = THREE.MathUtils.lerp(this.oarAimScale, 1, t);
          }
        } else if (progress < 0.2) {
          const t = progress / 0.2;
          this.oarPivot.rotation.y = -t * 0.8;
          this.oarPivot.rotation.x = 0.5 + t * 0.6;
          this.oarPivot.rotation.z = -0.4 - t * 0.4;
          this.slapArcAngle = -0.8;
        } else if (progress < 0.65) {
          const t = (progress - 0.2) / 0.45;
          const arc = THREE.MathUtils.lerp(-0.8, 1.4, t);
          this.oarPivot.rotation.y = arc;
          this.oarPivot.rotation.x = 1.1 - t * 1.5;
          this.oarPivot.rotation.z = -0.8 + t * 1.6;
          this.slapArcAngle = arc;
        } else {
          const t = (progress - 0.65) / 0.35;
          this.oarPivot.rotation.y = THREE.MathUtils.lerp(1.4, 0, t);
          this.oarPivot.rotation.x = THREE.MathUtils.lerp(-0.4, 0.5, t);
          this.oarPivot.rotation.z = THREE.MathUtils.lerp(0.8, -0.4, t);
        }
      } else {
        this.isSlapping = false;
        this.whackTarget = null;
        this.whackTargetAcquired = false;
        this.oarPivot.scale.set(1, 1, 1);
        this.oarPivot.rotation.set(0.5, 0, -0.4);
      }
    } else {
      this.oarPivot.rotation.y = 0;
      this.oarPivot.rotation.z = -0.4 + Math.sin(this.world.time * 3) * 0.05;
      this.oarPivot.rotation.x = 0.5 + Math.cos(this.world.time * 2) * 0.03;
    }
  }
}
