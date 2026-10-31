import * as THREE from 'three';

// Sum-of-sines swell shared by the water mesh and anything floating on it.
// [kX, kZ, amplitude, angular speed, phase]
const RIVER_SWELL = [
  [0.38, 0.00, 0.075, 1.45, 0.0],  // long wind swell down the valley
  [0.10, 0.38, 0.090, -1.25, 1.7], // cross swell from the banks
  [0.82, 0.60, 0.050, 2.35, 2.4],  // short chop
  [0.30, -0.95, 0.060, -1.85, 0.6], // diagonal ripple
  [1.10, 0.30, 0.035, 2.90, 1.1],  // fine cross chop
  [-0.55, 1.10, 0.040, -2.20, 2.1], // opposing ripple
  [0.65, -0.45, 0.045, 2.70, 3.0], // oblique chop
  [0.20, 0.80, 0.050, -1.60, 0.9]  // bank reflection chop
];

function waveGradientGLSL(name, waves) {
  const lines = waves.map(([kx, kz, amp, speed, phase]) => {
    const angle = [
      kx ? `${kx.toFixed(3)} * p.x` : null,
      kz ? `${kz.toFixed(3)} * p.y` : null,
      `${speed.toFixed(3)} * t`,
      phase ? `${phase.toFixed(3)}` : null
    ].filter(Boolean).join(' + ');
    const wavelength = Math.hypot(kx, kz).toFixed(3);
    return `  g += vec2(${(amp * kx).toFixed(4)}, ${(amp * kz).toFixed(4)}) * cos(${angle}) * (1.0 - smoothstep(0.8, 2.5, ${wavelength} * pixelSize));`;
  });

  return `vec2 ${name}(vec2 p, float t, float pixelSize) {
  vec2 g = vec2(0.0);
${lines.join('\n')}
  return g;
}`;
}

const RIVER_NORMAL_GLSL = `
${waveGradientGLSL('riverSwellGrad', RIVER_SWELL)}
vec3 riverWaveNormal(vec2 p, float t, float pixelSize) {
  vec2 g = riverSwellGrad(p, t, pixelSize);
  return normalize(vec3(-g.x, 1.0, -g.y));
}`;

const _waveSample = { y: 0, dx: 0, dz: 0 };

function sampleWaterInto(out, x, z, t) {
  let y = 0;
  let dx = 0;
  let dz = 0;

  for (let i = 0; i < RIVER_SWELL.length; i++) {
    const [kx, kz, amp, speed, phase] = RIVER_SWELL[i];
    const angle = kx * x + kz * z + speed * t + phase;
    const c = Math.cos(angle);
    y += amp * Math.sin(angle);
    dx += amp * kx * c;
    dz += amp * kz * c;
  }

  out.y = y;
  out.dx = dx;
  out.dz = dz;
  return out;
}


export class RiverWorld {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.particles = [];
    this.particleIndex = 0;

    this.reedsList = [];
    this.crowdList = [];
    this.crowdShockTime = 0;

    // Shared river current (world units/sec). Weather can later modify this object.
    this.current = {
      x: 0.1,
      z: 0.2
    };

    this.riverHalfWidth = 16;
    this.riverSamples = this.buildRiverCenterline();

    this.createBanks();
    this.createWater();
    this.createReedsAndVegetation();
    this.createEnvironmentDetails();
    this.createRiverBoundaries(); // East & West natural barriers (rocks, reeds, warning posts)
    this.createForests();
    this.createAppalledCrowd();
    this.createParticleSystem();
  }

  // The playable stretch stays perfectly straight so the banks line up with the
  // boat's collision limits; beyond the barriers the river sweeps away to the
  // south-west and north-east and disappears into the forest.
  buildRiverCenterline() {
    const points = [];

    const westBend = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-340, 0, 170),
      new THREE.Vector3(-190, 0, 110),
      new THREE.Vector3(-90, 0, 0),
      new THREE.Vector3(-45, 0, 0)
    );
    const eastBend = new THREE.CubicBezierCurve3(
      new THREE.Vector3(45, 0, 0),
      new THREE.Vector3(95, 0, 0),
      new THREE.Vector3(170, 0, -40),
      new THREE.Vector3(340, 0, -200)
    );

    for (let i = 0; i <= 80; i++) points.push(westBend.getPoint(i / 80));
    for (let x = -45; x <= 45; x += 2.5) points.push(new THREE.Vector3(x, 0, 0));
    for (let i = 1; i <= 100; i++) points.push(eastBend.getPoint(i / 100));

    const samples = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tangent = new THREE.Vector3().subVectors(next, prev);
      if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
      tangent.normalize();
      // Positive offset points south (+Z), negative points north (-Z)
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      samples.push({ p: p.clone(), t: tangent, n: normal });
    }
    return samples;
  }

  // Flat strip that follows the river centerline between two lateral offsets.
  // `along` subdivides each centreline segment, which the water surface needs
  // to resolve short choppy ripples instead of a few huge flat facets.
  buildRibbonGeometry(fromOffset, toOffset, y, across = 1, along = 1) {
    const baseSamples = this.riverSamples;
    let samples = baseSamples;

    if (along > 1) {
      samples = [];
      for (let i = 0; i < baseSamples.length - 1; i++) {
        const a = baseSamples[i];
        const b = baseSamples[i + 1];
        for (let k = 0; k < along; k++) {
          const f = k / along;
          samples.push({
            p: a.p.clone().lerp(b.p, f),
            n: a.n.clone().lerp(b.n, f).normalize()
          });
        }
      }
      samples.push(baseSamples[baseSamples.length - 1]);
    }

    const cols = across + 1;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      for (let j = 0; j < cols; j++) {
        const offset = fromOffset + ((toOffset - fromOffset) * j) / across;
        positions.push(s.p.x + s.n.x * offset, y, s.p.z + s.n.z * offset);
        uvs.push(j / across, i / (samples.length - 1));
      }
    }

    for (let i = 0; i < samples.length - 1; i++) {
      for (let j = 0; j < across; j++) {
        const a = i * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Vertical face along one river bank (used for the high northern border bank).
  buildRiverWallGeometry(offset, topY, bottomY) {
    const samples = this.riverSamples;
    const positions = [];
    const indices = [];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const x = s.p.x + s.n.x * offset;
      const z = s.p.z + s.n.z * offset;
      positions.push(x, bottomY, z, x, topY, z);
      if (i > 0) {
        const a = (i - 1) * 2;
        const b = a + 1;
        const c = i * 2;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // One half of the world's land mass: everything on one side of the river
  // channel, closed off far beyond the fog.
  buildLandShape(offset, farSide) {
    const samples = this.riverSamples;
    const points = samples.map((s) => new THREE.Vector2(
      s.p.x + s.n.x * offset,
      -(s.p.z + s.n.z * offset) // shape Y is flipped into world Z
    ));

    // Close the polygon far away on the same side of the river.
    points.push(new THREE.Vector2(600, farSide * -600));
    points.push(new THREE.Vector2(-600, farSide * -600));

    return new THREE.Shape(points);
  }

  createBanks() {
    const northMaterial = new THREE.MeshLambertMaterial({ color: 0x3d6630, side: THREE.DoubleSide });
    const southMaterial = new THREE.MeshLambertMaterial({ color: 0x4f8339, side: THREE.DoubleSide });
    const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x4b3826, side: THREE.DoubleSide });
    const sandMaterial = new THREE.MeshLambertMaterial({ color: 0xbdb07d, side: THREE.DoubleSide });

    // Northern bank plateau (high border side)
    const northGeo = new THREE.ShapeGeometry(this.buildLandShape(-this.riverHalfWidth - 2.2, -1));
    northGeo.rotateX(-Math.PI / 2);
    const northBank = new THREE.Mesh(northGeo, northMaterial);
    northBank.position.y = 4.5;
    northBank.receiveShadow = true;
    this.scene.add(northBank);

    // Southern beach bank (low, where the crowd stands)
    const southGeo = new THREE.ShapeGeometry(this.buildLandShape(this.riverHalfWidth + 2.6, 1));
    southGeo.rotateX(-Math.PI / 2);
    const southBank = new THREE.Mesh(southGeo, southMaterial);
    southBank.position.y = 0.0;
    southBank.receiveShadow = true;
    this.scene.add(southBank);

    // Dirt cliff between the water and the high northern plateau
    const wallGeo = this.buildRiverWallGeometry(-this.riverHalfWidth, 4.5, -0.6);
    const wall = new THREE.Mesh(wallGeo, dirtMaterial);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Dirt lip on top of the cliff, plus the sandy southern shoreline
    const dirtLip = new THREE.Mesh(this.buildRibbonGeometry(-this.riverHalfWidth - 2.2, -this.riverHalfWidth, 4.52), dirtMaterial);
    dirtLip.receiveShadow = true;
    this.scene.add(dirtLip);

    const sand = new THREE.Mesh(this.buildRibbonGeometry(this.riverHalfWidth, this.riverHalfWidth + 2.6, 0.0), sandMaterial);
    sand.receiveShadow = true;
    this.scene.add(sand);
  }

  createWater() {
    const segAcross = 30;
    const segAlong = 3;
    // Let the surface run a little under the banks so wave crests lap against
    // the sand/cliff instead of ending on a hard geometric seam.
    const shoreOverlap = 0.6;

    this.waterGeo = this.buildRibbonGeometry(
      -this.riverHalfWidth - shoreOverlap,
      this.riverHalfWidth + shoreOverlap,
      0,
      segAcross,
      segAlong
    );
    this.waterBasePos = this.waterGeo.attributes.position.clone();

    // Bake a shallow-to-deep tint so the surface is not one flat slab of blue.
    // River palette leans green-teal: silty shallows lighten toward the banks.
    const positions = this.waterGeo.attributes.position;
    const uvs = this.waterGeo.attributes.uv;
    const colors = new Float32Array(positions.count * 3);
    const deepColor = new THREE.Color(0x17695a);
    const shallowColor = new THREE.Color(0x3a8f70);
    const tint = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const across = uvs.getX(i);
      const edge = Math.abs(across * 2 - 1);
      const shallow = edge * edge;
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const variation =
        0.95 +
        0.05 * Math.sin(x * 0.23 + z * 0.19) +
        0.03 * Math.sin(x * 0.07 - z * 0.11);

      tint.copy(deepColor).lerp(shallowColor, shallow);
      colors[i * 3] = tint.r * variation;
      colors[i * 3 + 1] = tint.g * variation;
      colors[i * 3 + 2] = tint.b * variation;
    }

    this.waterGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const waterWidth = (this.riverHalfWidth + shoreOverlap) * 2;
    this.waterWidth = waterWidth;

    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.16,
      metalness: 0.02,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      dithering: true
    });
    this.waterMat.customProgramCacheKey = () => 'river-water';

    this.waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWaterWorldPos;
varying vec2 vWaterUv;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWaterUv = uv;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWaterWorldPos;
varying vec2 vWaterUv;
uniform float uTime;
${RIVER_NORMAL_GLSL}`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float waterBankDist = min(vWaterUv.x, 1.0 - vWaterUv.x) * ${waterWidth.toFixed(2)};
float waterPixelSize = max(length(fwidth(vWaterWorldPos.xz)), 0.0001);
float waterFoamNoise = 0.5 + 0.5 * sin(vWaterWorldPos.x * 0.35 + uTime * 0.6) * cos(vWaterWorldPos.z * 0.5 - uTime * 0.4);
float waterFoamBand = 0.75 + waterFoamNoise * 0.9;
float waterFoamAA = max(fwidth(waterBankDist), 0.0001) * 1.5;
float waterFoam = 1.0 - smoothstep(waterFoamBand * 0.55 - waterFoamAA, waterFoamBand + waterFoamAA, waterBankDist);
float waterEndFade = smoothstep(0.0, 0.01, min(vWaterUv.y, 1.0 - vWaterUv.y));
waterFoam *= waterEndFade;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.88, 0.86), waterFoam * 0.55);`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
float waterShoreCalm = smoothstep(0.2, 3.0, waterBankDist);
vec3 waterWorldNormal = normalize(mix(vec3(0.0, 1.0, 0.0), riverWaveNormal(vWaterWorldPos.xz, uTime, waterPixelSize), waterShoreCalm));
normal = normalize((viewMatrix * vec4(waterWorldNormal, 0.0)).xyz);`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
vec3 waterViewWorld = normalize(cameraPosition - vWaterWorldPos);
vec3 waterReflectDir = reflect(-waterViewWorld, waterWorldNormal);
vec3 waterReflection = mix(
  vec3(0.16, 0.31, 0.27),
  vec3(0.34, 0.60, 0.80),
  smoothstep(-0.05, 0.65, waterReflectDir.y)
);
float waterFresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);
totalEmissiveRadiance += waterReflection * waterFresnel;`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
float waterDither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
gl_FragColor.rgb += (waterDither - 0.5) * (2.5 / 255.0);`
        );

      this.waterMat.userData.shader = shader;
    };

    this.waterMesh = new THREE.Mesh(this.waterGeo, this.waterMat);
    this.waterMesh.receiveShadow = false;
    this.scene.add(this.waterMesh);
  }

  getCurrentVelocity() {
    return this.current;
  }

  createReedsAndVegetation() {
    const stalkMat = new THREE.MeshLambertMaterial({ color: 0x5e7839, flatShading: true });
    const cattailMat = new THREE.MeshLambertMaterial({ color: 0x482b14 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x6e8f42 });
    const flowerMat = new THREE.MeshLambertMaterial({ color: 0xfff0fa });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x737678, flatShading: true });

    const clumpPositions = [
      // Dense north-shore reed belt
      { x: -31, z: -15.3 }, { x: -25, z: -15.1 }, { x: -19, z: -15.4 },
      { x: -13, z: -15.2 }, { x: -6, z: -14.9 }, { x: 0, z: -15.2 },
      { x: 6, z: -14.8 }, { x: 13, z: -15.3 }, { x: 19, z: -15.1 },
      { x: 25, z: -15.4 }, { x: 31, z: -15.2 }, { x: -28, z: -14.7 },
      { x: 9, z: -14.5 }, { x: 22, z: -14.8 },
      // Second lush row leaning into the water
      { x: -33, z: -14.4 }, { x: -22, z: -14.3 }, { x: -10, z: -14.2 },
      { x: 2, z: -14.4 }, { x: 15, z: -14.2 }, { x: 27, z: -14.3 },
      // Reeds on the north bank itself, hiding enemies as they walk in
      { x: -28, z: -17.1, y: 4.5 }, { x: -20, z: -18.0, y: 4.5 },
      { x: -12, z: -16.8, y: 4.5 }, { x: -4, z: -17.8, y: 4.5 },
      { x: 4, z: -16.9, y: 4.5 }, { x: 12, z: -18.1, y: 4.5 },
      { x: 20, z: -17.0, y: 4.5 }, { x: 28, z: -17.9, y: 4.5 },
      // South shore waterline
      { x: -26, z: 15.1 }, { x: -14, z: 15.2 }, { x: -2, z: 15.0 },
      { x: 12, z: 15.3 }, { x: 22, z: 15.1 }, { x: 29, z: 15.2 }
    ];

    clumpPositions.forEach((pos, cIndex) => {
      const clump = new THREE.Group();
      clump.position.set(pos.x, pos.y || 0, pos.z);

      const stalkCount = 11 + (pos.y ? 6 : 0) + Math.floor(Math.sin(cIndex * 3) * 3 + 3);
      for (let i = 0; i < stalkCount; i++) {
        const stalkGroup = new THREE.Group();
        const height = (pos.y ? 2.8 : 2.1) + Math.random() * (pos.y ? 1.8 : 1.6);
        const ox = (Math.random() - 0.5) * 2.6;
        const oz = (Math.random() - 0.5) * 1.4;

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
        rock.position.set(pos.x + (Math.random() - 0.5) * 1.5, (pos.y || 0) + 0.1, pos.z + (Math.random() - 0.5) * 0.6);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        this.scene.add(rock);
      }

      if (!pos.y) {
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
      }

      this.scene.add(clump);
    });

    // Extra scattered reeds fill out the shoreline into a dense, natural belt
    const extraStalkGeo = new THREE.CylinderGeometry(0.045, 0.07, 1, 4);
    const extraHeadGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.45, 5);

    const addExtraReed = (x, y, z, sizeScale = 1) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);

      const height = (1.7 + Math.random() * 1.8) * sizeScale;
      const stalk = new THREE.Mesh(extraStalkGeo, Math.random() > 0.5 ? stalkMat : leafMat);
      stalk.position.y = height / 2;
      stalk.scale.y = height;
      stalk.rotation.y = Math.random() * Math.PI;
      stalk.castShadow = true;
      group.add(stalk);

      if (Math.random() > 0.7) {
        const head = new THREE.Mesh(extraHeadGeo, cattailMat);
        head.position.y = height * 0.84;
        head.castShadow = true;
        group.add(head);
      }

      this.scene.add(group);
      this.reedsList.push({
        group,
        baseRotZ: 0,
        seed: x * 1.7 + z * 2.3
      });
    };

    // Dense rows leaning into the water along the north shore
    for (let row = 0; row < 4; row++) {
      const zBase = -14.4 + row * 0.52;
      for (let x = -40; x <= 40; x += 2.3 + Math.random() * 1.2) {
        addExtraReed(
          x + (Math.random() - 0.5) * 1.2,
          0,
          zBase + (Math.random() - 0.5) * 0.5,
          0.85 + Math.random() * 0.5
        );
      }
    }

    // Taller clumps on the north bank behind the walking path
    for (let row = 0; row < 2; row++) {
      const zBase = -17.2 - row * 1.1;
      for (let x = -36; x <= 36; x += 2.8 + Math.random() * 1.4) {
        addExtraReed(
          x + (Math.random() - 0.5) * 1.4,
          4.5,
          zBase + (Math.random() - 0.5) * 0.7,
          1.15 + Math.random() * 0.45
        );
      }
    }

    // Softer reed fringe on the south shore
    for (let row = 0; row < 2; row++) {
      const zBase = 14.6 + row * 0.55;
      for (let x = -38; x <= 38; x += 3.1 + Math.random() * 1.4) {
        addExtraReed(
          x + (Math.random() - 0.5) * 1.3,
          0,
          zBase + (Math.random() - 0.5) * 0.45,
          0.9 + Math.random() * 0.45
        );
      }
    }
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

  // Dense mixed forest belts along both banks plus a canopy wall that closes off
  // the horizon, so the river reads as a winding channel through woodland
  // instead of a rectangle floating on an empty field.
  createForests() {
    const samples = this.riverSamples;
    const trees = [];

    const plant = (s, side, offset, scale) => {
      const x = s.p.x + s.n.x * offset * side + (Math.random() - 0.5) * 3.5;
      const z = s.p.z + s.n.z * offset * side + (Math.random() - 0.5) * 3.5;

      // Keep the mission area readable: no trees on the beach, the patrol path
      // or in the water.
      if (Math.abs(x) < 47 && z > -24 && z < 28) return;

      trees.push({
        x,
        z,
        y: side < 0 ? 4.5 : 0.05,
        scale: scale * (0.75 + Math.random() * 0.7),
        rotation: Math.random() * Math.PI * 2,
        pine: Math.random() > 0.22
      });
    };

    for (let i = 4; i < samples.length - 4; i += 4) {
      const s = samples[i];
      for (const side of [-1, 1]) {
        // Four rows of forest climbing away from the water
        for (let row = 0; row < 4; row++) {
          const offset = (side < 0 ? 24 : 27) + row * 15 + Math.random() * 9;
          if (Math.random() > 0.82) continue;
          plant(s, side, offset, 1);
        }
        // Sparse taller canopy wall behind the belt
        if (i % 12 === 0) {
          plant(s, side, 95 + Math.random() * 40, 1.35);
        }
      }
    }

    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 2.8, 5);
    const pineGeo = new THREE.ConeGeometry(2.3, 6.4, 7);
    const pineTopGeo = new THREE.ConeGeometry(1.5, 4.4, 7);
    const broadleafGeo = new THREE.IcosahedronGeometry(2.5, 0);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3219 });
    const pineMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const broadleafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

    const pines = trees.filter((t) => t.pine);
    const broadleaves = trees.filter((t) => !t.pine);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const pineCanopies = new THREE.InstancedMesh(pineGeo, pineMat, pines.length);
    const pineTops = new THREE.InstancedMesh(pineTopGeo, pineMat, pines.length);
    const broadleafCanopies = new THREE.InstancedMesh(broadleafGeo, broadleafMat, broadleaves.length);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    trees.forEach((t, i) => {
      dummy.position.set(t.x, t.y + 1.4 * t.scale, t.z);
      dummy.rotation.set(0, t.rotation, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
    });

    pines.forEach((t, i) => {
      tint.setHSL(0.33 + (Math.random() - 0.5) * 0.03, 0.42, 0.16 + Math.random() * 0.08);

      dummy.position.set(t.x, t.y + 5.2 * t.scale, t.z);
      dummy.rotation.set(0, t.rotation, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      pineCanopies.setMatrixAt(i, dummy.matrix);
      pineCanopies.setColorAt(i, tint);

      dummy.position.set(t.x, t.y + 7.4 * t.scale, t.z);
      dummy.scale.setScalar(t.scale * 0.92);
      dummy.updateMatrix();
      pineTops.setMatrixAt(i, dummy.matrix);
      pineTops.setColorAt(i, tint);
    });

    broadleaves.forEach((t, i) => {
      tint.setHSL(0.3 + (Math.random() - 0.5) * 0.03, 0.45, 0.2 + Math.random() * 0.07);

      dummy.position.set(t.x, t.y + 5.0 * t.scale, t.z);
      dummy.rotation.set(0, t.rotation, 0);
      dummy.scale.set(t.scale * 1.05, t.scale * 0.9, t.scale * 1.05);
      dummy.updateMatrix();
      broadleafCanopies.setMatrixAt(i, dummy.matrix);
      broadleafCanopies.setColorAt(i, tint);
    });

    [trunks, pineCanopies, pineTops, broadleafCanopies].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
    });
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
      const py = 0.0;

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
    const normals = this.waterGeo.attributes.normal;
    const uvs = this.waterGeo.attributes.uv;
    const base = this.waterBasePos;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const x = base.getX(i);
      const z = base.getZ(i);
      const u = uvs.getX(i);
      const v = uvs.getY(i);

      const bankDist = Math.min(u, 1 - u) * this.waterWidth;
      const waveBankDist = Math.max(0, bankDist - 0.6);
      const bankT = Math.min(1, waveBankDist / 3);
      const bankFade = bankT * bankT * (3 - 2 * bankT);
      const endT = Math.min(1, Math.min(v, 1 - v) / 0.01);
      const endFade = endT * endT * (3 - 2 * endT);
      const fade = bankFade * endFade;

      let shoreDrop = 0;
      if (bankDist < 0.6) {
        const shoreT = 1 - bankDist / 0.6;
        shoreDrop = -0.22 * shoreT * shoreT;
      }

      sampleWaterInto(_waveSample, x, z, this.time);

      pos.setY(i, _waveSample.y * fade + shoreDrop);

      const nx = -_waveSample.dx * fade;
      const ny = 1;
      const nz = -_waveSample.dz * fade;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      normals.setXYZ(i, nx * inv, ny * inv, nz * inv);
    }
    pos.needsUpdate = true;
    normals.needsUpdate = true;

    const waterShader = this.waterMat.userData.shader;
    if (waterShader) {
      waterShader.uniforms.uTime.value = this.time;
    }

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
