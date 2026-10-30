import * as THREE from 'three';

export class RiverWorld {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.particles = [];
    this.particleIndex = 0;

    this.reedsList = [];
    this.crowdList = [];
    this.crowdShockTime = 0;

    this.createBanks();
    this.createWater();
    this.createReedsAndVegetation();
    this.createEnvironmentDetails();
    this.createRiverBoundaries(); // East & West natural barriers (rocks, reeds, warning posts)
    this.createAppalledCrowd();
    this.createParticleSystem();
  }

  createBanks() {
    const bankMaterialNorth = new THREE.MeshLambertMaterial({ color: 0x3d6630 });
    const bankMaterialSouth = new THREE.MeshLambertMaterial({ color: 0x5a9143 });
    const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x543f29 });

    // North Bank Ground (Top of screen, Z <= -16)
    const northGeo = new THREE.BoxGeometry(90, 6, 25);
    const northBank = new THREE.Mesh(northGeo, bankMaterialNorth);
    northBank.position.set(0, 1.5, -28);
    northBank.receiveShadow = true;
    northBank.castShadow = true;
    this.scene.add(northBank);

    // North Bank Cliff/Dirt Edge
    const northEdgeGeo = new THREE.BoxGeometry(90, 3, 2);
    const northEdge = new THREE.Mesh(northEdgeGeo, dirtMaterial);
    northEdge.position.set(0, 0.5, -16);
    northEdge.receiveShadow = true;
    this.scene.add(northEdge);

    // South Bank Ground (Flat recreational bank, top at Y = 0.05 so swimmers are never occluded!)
    const southGeo = new THREE.BoxGeometry(90, 4, 25);
    const southBank = new THREE.Mesh(southGeo, bankMaterialSouth);
    southBank.position.set(0, -1.95, 28);
    southBank.receiveShadow = true;
    southBank.castShadow = true;
    this.scene.add(southBank);

    // South Bank Sand/Pebble Shoreline (Flat beach edge, top at Y = 0.02)
    const sandMaterial = new THREE.MeshLambertMaterial({ color: 0xbdb07d });
    const southEdgeGeo = new THREE.BoxGeometry(90, 2, 2.5);
    const southEdge = new THREE.Mesh(southEdgeGeo, sandMaterial);
    southEdge.position.set(0, -0.98, 16.5);
    southEdge.receiveShadow = true;
    this.scene.add(southEdge);

    // Danger demarcation line along Z = 15.5
    const lineGeo = new THREE.PlaneGeometry(80, 0.3);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    this.dangerLine = new THREE.Mesh(lineGeo, lineMat);
    this.dangerLine.rotation.x = -Math.PI / 2;
    this.dangerLine.position.set(0, 0.05, 15.4);
    this.scene.add(this.dangerLine);
  }

  createWater() {
    this.waterWidth = 90;
    this.waterHeight = 32;
    const segX = 48;
    const segZ = 20;

    this.waterGeo = new THREE.PlaneGeometry(this.waterWidth, this.waterHeight, segX, segZ);
    this.waterGeo.rotateX(-Math.PI / 2);
    this.waterBasePos = this.waterGeo.attributes.position.clone();

    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x1b779c,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      flatShading: true
    });

    this.waterMesh = new THREE.Mesh(this.waterGeo, this.waterMat);
    this.waterMesh.position.set(0, 0, 0);
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Foam strips along the banks
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45
    });

    const foamNorth = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.8), foamMat);
    foamNorth.rotation.x = -Math.PI / 2;
    foamNorth.position.set(0, 0.03, -15.2);
    this.scene.add(foamNorth);

    const foamSouth = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.8), foamMat);
    foamSouth.rotation.x = -Math.PI / 2;
    foamSouth.position.set(0, 0.03, 15.2);
    this.scene.add(foamSouth);
  }

  createReedsAndVegetation() {
    const stalkMat = new THREE.MeshLambertMaterial({ color: 0x5e7839, flatShading: true });
    const cattailMat = new THREE.MeshLambertMaterial({ color: 0x482b14 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x6e8f42 });
    const flowerMat = new THREE.MeshLambertMaterial({ color: 0xfff0fa });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x737678, flatShading: true });

    const clumpPositions = [
      { x: -28, z: -15.2 }, { x: -18, z: -15.3 }, { x: -6, z: -15.1 },
      { x: 6, z: -15.3 }, { x: 18, z: -15.2 }, { x: 28, z: -15.1 },
      { x: -26, z: 15.1 }, { x: -14, z: 15.2 }, { x: -2, z: 15.0 },
      { x: 12, z: 15.3 }, { x: 22, z: 15.1 }, { x: 29, z: 15.2 }
    ];

    clumpPositions.forEach((pos, cIndex) => {
      const clump = new THREE.Group();
      clump.position.set(pos.x, 0, pos.z);

      const stalkCount = 7 + Math.floor(Math.sin(cIndex * 3) * 3 + 3);
      for (let i = 0; i < stalkCount; i++) {
        const stalkGroup = new THREE.Group();
        const height = 1.8 + Math.random() * 1.3;
        const ox = (Math.random() - 0.5) * 2.2;
        const oz = (Math.random() - 0.5) * 1.0;

        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, height, 4), stalkMat);
        stalk.position.y = height / 2;
        stalk.castShadow = true;
        stalkGroup.add(stalk);

        if (Math.random() > 0.4) {
          const cattailHead = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 5), cattailMat);
          cattailHead.position.y = height * 0.85;
          cattailHead.castShadow = true;
          stalkGroup.add(cattailHead);

          const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 4), stalkMat);
          tip.position.y = height * 0.85 + 0.35;
          stalkGroup.add(tip);
        }

        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, height * 0.7, 0.16), leafMat);
        leaf.position.set(0.08, height * 0.35, 0);
        leaf.rotation.z = 0.2;
        stalkGroup.add(leaf);

        stalkGroup.position.set(ox, 0, oz);
        clump.add(stalkGroup);

        this.reedsList.push({
          group: stalkGroup,
          baseRotZ: stalkGroup.rotation.z,
          seed: pos.x + i * 1.3
        });
      }

      if (Math.random() > 0.3) {
        const rockSize = 0.35 + Math.random() * 0.4;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockSize, 0), rockMat);
        rock.position.set(pos.x + (Math.random() - 0.5) * 1.5, 0.1, pos.z + (Math.random() - 0.5) * 0.6);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        this.scene.add(rock);
      }

      for (let l = 0; l < 2; l++) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.02, 6), leafMat);
        const pzOffset = pos.z < 0 ? 0.9 : -0.9;
        pad.position.set(pos.x + (Math.random() - 0.5) * 2.0, 0.03, pos.z + pzOffset + (Math.random() - 0.5) * 0.5);
        this.scene.add(pad);

        if (l === 0) {
          const flower = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.15, 5), flowerMat);
          flower.position.set(pad.position.x, 0.1, pad.position.z);
          this.scene.add(flower);
        }
      }

      this.scene.add(clump);
    });
  }

  createRiverBoundaries() {
    // Natural impassable barriers at West (X = -32 to -35) and East (X = +32 to +35)
    // Rocks, boulders, thick standing камыши, and warning barrier posts
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x525659, flatShading: true });
    const mossRockMat = new THREE.MeshLambertMaterial({ color: 0x48523c, flatShading: true });
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd92626 });
    const signMat = new THREE.MeshLambertMaterial({ color: 0xffea00 });
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x4a6b2f, flatShading: true });
    const cattailMat = new THREE.MeshLambertMaterial({ color: 0x3d220e });

    const boundarySides = [-33.5, 33.5];

    boundarySides.forEach((baseX) => {
      const isWest = baseX < 0;
      const barrierGroup = new THREE.Group();

      // Ridge of rocks & boulders across Z from -15 to +15
      for (let z = -15; z <= 15; z += 2.2) {
        const rSize = 1.2 + Math.random() * 0.9;
        const mat = Math.random() > 0.5 ? rockMat : mossRockMat;
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(rSize, 1), mat);
        const xOffset = (Math.random() - 0.5) * 1.8;
        boulder.position.set(baseX + xOffset, 0.4 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.5);
        boulder.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        barrierGroup.add(boulder);

        // Dense clump of камыши between the barrier boulders
        const reedClump = new THREE.Group();
        reedClump.position.set(baseX + xOffset + (isWest ? 1.0 : -1.0), 0, z);
        for (let s = 0; s < 5; s++) {
          const h = 2.2 + Math.random() * 1.2;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 4), reedMat);
          stalk.position.set((Math.random() - 0.5) * 0.8, h / 2, (Math.random() - 0.5) * 0.8);
          reedClump.add(stalk);

          if (s % 2 === 0) {
            const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 5), cattailMat);
            head.position.set(stalk.position.x, h * 0.82, stalk.position.z);
            reedClump.add(head);
          }
        }
        barrierGroup.add(reedClump);
      }

      // Wooden Warning Barrier Posts
      for (let z = -12; z <= 12; z += 8) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 4.2, 6), postMat);
        post.position.set(baseX + (isWest ? 1.5 : -1.5), 1.6, z);
        post.castShadow = true;
        barrierGroup.add(post);

        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.12), signMat);
        sign.position.set(baseX + (isWest ? 1.5 : -1.5), 3.2, z);
        sign.rotation.y = isWest ? Math.PI / 2 : -Math.PI / 2;
        sign.castShadow = true;
        barrierGroup.add(sign);
      }

      this.scene.add(barrierGroup);
    });
  }

  createEnvironmentDetails() {
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x1f4726, flatShading: true });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3219 });
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 5);
    const foliageGeo = new THREE.ConeGeometry(1.6, 3.8, 6);

    for (let x = -38; x <= 38; x += 6) {
      if (Math.sin(x * 12.3) > -0.3) {
        const tree = new THREE.Group();
        const zOffset = -20 - (Math.abs(Math.sin(x)) * 7);

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 4;
        trunk.castShadow = true;
        tree.add(trunk);

        const foliage = new THREE.Mesh(foliageGeo, treeMat);
        foliage.position.y = 6.2;
        foliage.castShadow = true;
        tree.add(foliage);

        tree.position.set(x + (Math.cos(x) * 2), 0, zOffset);
        this.scene.add(tree);
      }
    }

    const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6);
    const postMat = new THREE.MeshLambertMaterial({ color: 0xee2222 });
    const signGeo = new THREE.BoxGeometry(2.2, 1.1, 0.15);
    const signMat = new THREE.MeshLambertMaterial({ color: 0xffea00 });

    for (let x = -28; x <= 28; x += 14) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, 4, -17.5);
      post.castShadow = true;
      this.scene.add(post);

      const signBoard = new THREE.Mesh(signGeo, signMat);
      signBoard.position.set(x, 5.2, -17.5);
      signBoard.castShadow = true;
      this.scene.add(signBoard);
    }

    this.createWatchtower(-20, -21);
    this.createWatchtower(20, -21);

    this.buoys = [];
    const buoyMat = new THREE.MeshLambertMaterial({ color: 0xff4422 });
    const buoyGeo = new THREE.SphereGeometry(0.45, 8, 6);
    for (let i = 0; i < 6; i++) {
      const buoy = new THREE.Mesh(buoyGeo, buoyMat);
      buoy.position.set(-25 + i * 10, 0, 14.8);
      buoy.castShadow = true;
      this.scene.add(buoy);
      this.buoys.push({ mesh: buoy, baseX: buoy.position.x, baseZ: buoy.position.z, seed: i * 2.1 });
    }
  }

  createWatchtower(x, z) {
    const tower = new THREE.Group();
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x4f361c, flatShading: true });

    const legGeo = new THREE.CylinderGeometry(0.18, 0.22, 9, 5);
    const offsets = [
      [-1.2, -1.2],
      [1.2, -1.2],
      [-1.2, 1.2],
      [1.2, 1.2]
    ];
    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(ox, 5.5, oz);
      leg.castShadow = true;
      tower.add(leg);
    });

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.2, 3.2),
      new THREE.MeshLambertMaterial({ color: 0x2e3828 })
    );
    cabin.position.set(0, 10.5, 0);
    cabin.castShadow = true;
    tower.add(cabin);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 1.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 12.3, 0);
    roof.castShadow = true;
    tower.add(roof);

    const lightHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffeeaa, emissiveIntensity: 0.6 })
    );
    lightHead.rotation.x = -Math.PI / 3;
    lightHead.position.set(0, 10.2, 1.8);
    tower.add(lightHead);

    tower.position.set(x, 1.5, z);
    this.scene.add(tower);
  }

  createAppalledCrowd() {
    this.crowdList = [];
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5c29b });
    const jacketColors = [
      0xcc3333, 0x2a75d3, 0xffa500, 0x8b35bc, 0x228b22,
      0xd9447e, 0x17a2b8, 0x343a40, 0xf8f9fa, 0x9c27b0
    ];

    const spectatorCount = 22;
    for (let i = 0; i < spectatorCount; i++) {
      const person = new THREE.Group();

      const jacketColor = jacketColors[i % jacketColors.length];
      const clothesMat = new THREE.MeshLambertMaterial({ color: jacketColor });
      const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), pantsMat);
      legL.position.set(-0.12, 0.3, 0);
      person.add(legL);

      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), pantsMat);
      legR.position.set(0.12, 0.3, 0);
      person.add(legR);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.32), clothesMat);
      body.position.set(0, 0.85, 0);
      body.castShadow = true;
      person.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 7), skinMat);
      head.position.set(0, 1.32, 0);
      head.castShadow = true;
      person.add(head);

      if (i % 3 === 0) {
        const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.21, 6, 6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        beanie.position.set(0, 1.4, 0);
        person.add(beanie);
      }

      const poseType = i % 4;
      const armMat = clothesMat;

      if (poseType === 0) {
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 4), armMat);
        armL.position.set(-0.25, 1.15, 0);
        armL.rotation.z = Math.PI / 1.3;
        person.add(armL);

        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 4), armMat);
        armR.position.set(0.25, 1.15, 0);
        armR.rotation.z = -Math.PI / 1.3;
        person.add(armR);
      } else if (poseType === 1) {
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 4), armMat);
        armL.position.set(-0.15, 0.95, -0.3);
        armL.rotation.x = -Math.PI / 2;
        person.add(armL);

        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 4), armMat);
        armR.position.set(0.25, 0.8, 0);
        person.add(armR);
      } else if (poseType === 2) {
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4), armMat);
        armL.position.set(-0.28, 1.2, 0);
        armL.rotation.z = Math.PI / 1.8;
        person.add(armL);

        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 4), armMat);
        armR.position.set(0.28, 1.2, 0);
        armR.rotation.z = -Math.PI / 1.8;
        person.add(armR);
      } else {
        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 4), armMat);
        armR.position.set(0.12, 1.1, -0.15);
        armR.rotation.x = -Math.PI / 2.5;
        armR.rotation.z = -0.5;
        person.add(armR);
      }

      let exclamationMark = null;
      if (i % 2 === 0) {
        exclamationMark = new THREE.Group();
        const markMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        const markBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.35, 4), markMat);
        markBar.position.y = 1.95;
        exclamationMark.add(markBar);
        const markDot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), markMat);
        markDot.position.y = 1.68;
        exclamationMark.add(markDot);
        person.add(exclamationMark);
      }

      const px = -28 + (i / spectatorCount) * 56 + (Math.random() - 0.5) * 2.5;
      const pz = 17.6 + (Math.sin(i * 1.7) * 0.5 + 0.5) * 3.0;
      const py = 0.05;

      person.position.set(px, py, pz);
      person.rotation.y = Math.PI + (Math.random() - 0.5) * 0.4;

      this.scene.add(person);
      this.crowdList.push({
        group: person,
        baseY: py,
        baseRotY: person.rotation.y,
        seed: i * 1.5,
        exclamation: exclamationMark
      });
    }
  }

  triggerCrowdReaction() {
    this.crowdShockTime = 0.8;
  }

  createParticleSystem() {
    this.maxParticles = 280;
    this.particleIndex = 0;

    const pGeo = new THREE.SphereGeometry(0.2, 5, 4);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });

    this.particleMeshGroup = new THREE.Group();
    this.scene.add(this.particleMeshGroup);

    this.particlePool = [];
    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(pGeo, pMat.clone());
      mesh.visible = false;
      this.particleMeshGroup.add(mesh);
      this.particlePool.push({
        mesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        baseScale: 1
      });
    }
  }

  emitParticle(x, y, z, vx, vy, vz, color = 0xffffff, size = 1, maxLife = 0.8) {
    const p = this.particlePool[this.particleIndex];
    this.particleIndex = (this.particleIndex + 1) % this.maxParticles;

    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(size);
    p.baseScale = size;
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 0.85;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = 0;
    p.maxLife = maxLife;
  }

  emitEngineWake(motorPos, forwardVector, speed, isReverse = false) {
    // Exact wake generated at the outboard motor location!
    // Streams strictly in the opposite direction of motion
    const streamDir = isReverse ? forwardVector.clone() : forwardVector.clone().negate();
    const perp = new THREE.Vector3(-streamDir.z, 0, streamDir.x); // lateral spreading vector

    const count = Math.min(3, Math.floor(Math.abs(speed) * 0.12) + 1);
    for (let i = 0; i < count; i++) {
      // V-shaped wake pattern
      const lateral = (i === 0 ? 0 : (i === 1 ? 0.38 : -0.38));
      const px = motorPos.x + streamDir.x * 0.4 + perp.x * lateral;
      const pz = motorPos.z + streamDir.z * 0.4 + perp.z * lateral;

      const spd = 0.6 + Math.random() * 0.7;
      const vx = streamDir.x * spd + perp.x * (lateral * 0.5);
      const vz = streamDir.z * spd + perp.z * (lateral * 0.5);

      this.emitParticle(
        px,
        0.04,
        pz,
        vx,
        0.1 + Math.random() * 0.2,
        vz,
        0xd8eeff, // frothy aerated water foam
        1.1 + Math.random() * 0.7,
        0.7 + Math.random() * 0.35
      );
    }
  }

  emitWake(x, z, angle, speed) {
    const propPos = new THREE.Vector3(x, 0, z);
    const fwdVec = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    this.emitEngineWake(propPos, fwdVec, speed, speed < 0);
  }

  emitSplash(x, z, count = 14, color = 0xeeffff) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      this.emitParticle(
        x + (Math.random() - 0.5) * 0.5,
        0.1,
        z + (Math.random() - 0.5) * 0.5,
        Math.cos(ang) * spd,
        2.5 + Math.random() * 3.5,
        Math.sin(ang) * spd,
        color,
        1.1 + Math.random() * 0.6,
        0.45 + Math.random() * 0.3
      );
    }
  }

  update(dt) {
    this.time += dt;

    const pos = this.waterGeo.attributes.position;
    const base = this.waterBasePos;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const u = base.getX(i);
      const w = base.getZ(i);
      const wave1 = Math.sin(u * 0.35 + this.time * 2.2) * 0.22;
      const wave2 = Math.cos(w * 0.4 + this.time * 1.8) * 0.16;
      pos.setY(i, wave1 + wave2);
    }
    pos.needsUpdate = true;

    for (let i = 0; i < this.reedsList.length; i++) {
      const r = this.reedsList[i];
      const breeze = Math.sin(this.time * 2.2 + r.seed) * 0.12;
      r.group.rotation.z = r.baseRotZ + breeze;
      r.group.rotation.x = Math.cos(this.time * 1.8 + r.seed) * 0.08;
    }

    if (this.crowdShockTime > 0) {
      this.crowdShockTime -= dt;
    }

    const shockPulse = this.crowdShockTime > 0 ? Math.sin(this.crowdShockTime * 15) * 0.4 : 0;
    for (let i = 0; i < this.crowdList.length; i++) {
      const p = this.crowdList[i];
      const bob = Math.sin(this.time * 3.5 + p.seed) * 0.06;
      p.group.position.y = p.baseY + bob + shockPulse;
      p.group.rotation.y = p.baseRotY + Math.sin(this.time * 5 + p.seed) * 0.12;

      if (p.exclamation) {
        p.exclamation.position.y = Math.sin(this.time * 6 + p.seed) * 0.15 + (this.crowdShockTime > 0 ? 0.3 : 0);
      }
    }

    if (this.buoys) {
      this.buoys.forEach((b) => {
        b.mesh.position.y = Math.sin(this.time * 2.5 + b.seed) * 0.15;
      });
    }

    if (this.dangerLine) {
      this.dangerLine.material.opacity = 0.45 + Math.sin(this.time * 5) * 0.25;
    }

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      p.vy -= 9.8 * dt;
      if (p.mesh.position.y < 0.04) {
        p.mesh.position.y = 0.04;
        p.vy = 0;
      }

      const progress = p.life / p.maxLife;
      p.mesh.material.opacity = (1 - progress) * 0.85;
      p.mesh.scale.setScalar(p.baseScale * (1 + progress * 0.9));
    }
  }
}
