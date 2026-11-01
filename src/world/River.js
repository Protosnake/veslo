import * as THREE from 'three';
import { sx, sz, RIVER_HALF_WIDTH } from './Bounds.js';

// Height of the northern border bank. Lowered from 4.5 so the reeds and
// incline stop swallowing the gravel patrol path from the drone camera.
const NORTH_BANK_Y = 3.0;

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

function waveAngleGLSL(kx, kz, speed, phase) {
  return [
    kx ? `${kx.toFixed(3)} * p.x` : null,
    kz ? `${kz.toFixed(3)} * p.y` : null,
    `${speed.toFixed(3)} * t`,
    phase ? `${phase.toFixed(3)}` : null
  ].filter(Boolean).join(' + ');
}

function waveGradientGLSL(name, waves) {
  const lines = waves.map(([kx, kz, amp, speed, phase]) => {
    const angle = waveAngleGLSL(kx, kz, speed, phase);
    const wavelength = Math.hypot(kx, kz).toFixed(3);
    return `  g += vec2(${(amp * kx).toFixed(4)}, ${(amp * kz).toFixed(4)}) * cos(${angle}) * (1.0 - smoothstep(0.8, 2.5, ${wavelength} * pixelSize));`;
  });

  return `vec2 ${name}(vec2 p, float t, float pixelSize) {
  vec2 g = vec2(0.0);
${lines.join('\n')}
  return g;
}`;
}

function waveHeightGLSL(name, waves) {
  const lines = waves.map(([kx, kz, amp, speed, phase]) => {
    const angle = waveAngleGLSL(kx, kz, speed, phase);
    return `  h += ${amp.toFixed(4)} * sin(${angle});`;
  });

  return `float ${name}(vec2 p, float t) {
  float h = 0.0;
${lines.join('\n')}
  return h;
}`;
}

const RIVER_SWELL_HEIGHT_GLSL = waveHeightGLSL('riverSwellHeight', RIVER_SWELL);

const RIVER_NORMAL_GLSL = `
${waveGradientGLSL('riverSwellGrad', RIVER_SWELL)}
vec3 riverWaveNormal(vec2 p, float t, float pixelSize) {
  vec2 g = riverSwellGrad(p, t, pixelSize);
  return normalize(vec3(-g.x, 1.0, -g.y));
}`;


export class RiverWorld {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.particles = [];
    this.particleIndex = 0;

    this.reedsWind = { value: 0 };
    this.crowdTime = { value: 0 };
    this.crowdShock = { value: 0 };
    this.crowdShockTime = 0;

    // Shared river current (world units/sec). Weather can later modify this object.
    this.current = {
      x: 0.1,
      z: 0.2
    };

    this.riverHalfWidth = RIVER_HALF_WIDTH;
    this.northBankY = NORTH_BANK_Y;
    this.riverSamples = this.buildRiverCenterline();
    this.rockColliders = [];

    this.createBanks();
    this.createGravelPath();
    this.createWater();
    this.createRiverBoundaries(); // East & West natural barriers (rocks, boulders, reeds)
    this.createReedsAndVegetation();
    this.createBankVegetation();
    this.createEnvironmentDetails();
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
      new THREE.Vector3(sx(-340), 0, sz(170)),
      new THREE.Vector3(sx(-190), 0, sz(110)),
      new THREE.Vector3(sx(-90), 0, 0),
      new THREE.Vector3(sx(-45), 0, 0)
    );
    const eastBend = new THREE.CubicBezierCurve3(
      new THREE.Vector3(sx(45), 0, 0),
      new THREE.Vector3(sx(95), 0, 0),
      new THREE.Vector3(sx(170), 0, sz(-40)),
      new THREE.Vector3(sx(340), 0, sz(-200))
    );

    for (let i = 0; i < 80; i++) points.push(westBend.getPoint(i / 80));
    for (let x = sx(-45); x <= sx(45); x += 2.5) points.push(new THREE.Vector3(x, 0, 0));
    for (let i = 1; i <= 100; i++) points.push(eastBend.getPoint(i / 100));

    // Continue both ends far into the fog so the river/water surface never
    // visibly stops. The playable stretch and its barriers stay unchanged.
    const extensionLength = 800;
    const extensionStep = 5;

    const westOut = new THREE.Vector3().subVectors(points[0], points[1]).normalize();
    const westExtension = [];
    for (let d = extensionStep; d <= extensionLength; d += extensionStep) {
      westExtension.push(points[0].clone().addScaledVector(westOut, d));
    }
    points.unshift(...westExtension.reverse());

    const eastOut = new THREE.Vector3()
      .subVectors(points[points.length - 1], points[points.length - 2])
      .normalize();
    const eastEnd = points[points.length - 1].clone();
    for (let d = extensionStep; d <= extensionLength; d += extensionStep) {
      points.push(eastEnd.clone().addScaledVector(eastOut, d));
    }

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
    points.push(new THREE.Vector2(2500, farSide * -2500));
    points.push(new THREE.Vector2(-2500, farSide * -2500));

    return new THREE.Shape(points);
  }

  createBanks() {
    const northMaterial = new THREE.MeshLambertMaterial({ color: 0x3d6630, side: THREE.DoubleSide });
    const southMaterial = new THREE.MeshLambertMaterial({ color: 0x4f8339, side: THREE.DoubleSide });
    const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x557a37, emissive: 0x1b2a12, side: THREE.DoubleSide });
    const lipMaterial = new THREE.MeshLambertMaterial({ color: 0x4f7333, emissive: 0x16230f, side: THREE.DoubleSide });
    const sandMaterial = new THREE.MeshLambertMaterial({ color: 0xbdb07d, side: THREE.DoubleSide });

    // Northern bank plateau (high border side)
    const northGeo = new THREE.ShapeGeometry(this.buildLandShape(-this.riverHalfWidth - 1.9, -1));
    northGeo.rotateX(-Math.PI / 2);
    const northBank = new THREE.Mesh(northGeo, northMaterial);
    northBank.position.y = NORTH_BANK_Y;
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
    const wallGeo = this.buildRiverWallGeometry(-this.riverHalfWidth, NORTH_BANK_Y, -0.6);
    const wall = new THREE.Mesh(wallGeo, dirtMaterial);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // Dirt lip on top of the cliff, plus the sandy southern shoreline
    const dirtLip = new THREE.Mesh(this.buildRibbonGeometry(-this.riverHalfWidth - 2.5, -this.riverHalfWidth + 0.15, NORTH_BANK_Y + 0.02), lipMaterial);
    dirtLip.receiveShadow = true;
    this.scene.add(dirtLip);

    const sand = new THREE.Mesh(this.buildRibbonGeometry(this.riverHalfWidth, this.riverHalfWidth + 2.6, 0.0), sandMaterial);
    sand.receiveShadow = true;
    this.scene.add(sand);
  }

  createGravelPath() {
    const points = [
      { x: sx(60), y: NORTH_BANK_Y + 0.16, z: sz(-66) },
      { x: sx(47), y: NORTH_BANK_Y + 0.16, z: sz(-57) },
      { x: sx(35), y: NORTH_BANK_Y + 0.16, z: sz(-49) },
      { x: sx(26), y: NORTH_BANK_Y + 0.16, z: sz(-42) },
      { x: sx(19), y: NORTH_BANK_Y + 0.16, z: sz(-36) },
      { x: sx(14.2), y: NORTH_BANK_Y + 0.15, z: sz(-31) },
      { x: sx(10.6), y: NORTH_BANK_Y + 0.12, z: sz(-27) },
      { x: sx(8.8), y: NORTH_BANK_Y + 0.06, z: sz(-23.5) },
      { x: sx(8.8), y: NORTH_BANK_Y + 0.05, z: sz(-19.5) },
      { x: sx(8.8), y: NORTH_BANK_Y + 0.04, z: sz(-17.8) }
    ];

    // Continue the road into the woods so the intro van enters from off-screen.
    const roadStart = points[0];
    const roadNext = points[1];
    const extX = roadStart.x - roadNext.x;
    const extZ = roadStart.z - roadNext.z;
    const extLen = Math.hypot(extX, extZ) || 1;
    const extUx = extX / extLen;
    const extUz = extZ / extLen;
    const EXTENSION_LENGTH = 45;
    const extensionPoints = [];
    for (let d = EXTENSION_LENGTH; d > 0; d -= 15) {
      extensionPoints.push({
        x: roadStart.x + extUx * d,
        y: roadStart.y,
        z: roadStart.z + extUz * d
      });
    }
    points.unshift(...extensionPoints);

    const path = {
      x: sx(8.8),
      halfWidth: 1.5,
      zMin: extensionPoints[0].z,
      zMax: sz(-17.8),
      walkStartZ: sz(-23.5),
      reedLineZ: sz(-17.75),
      emergeZ: sz(-14.7),
      reedZMin: sz(-25),
      reedZMax: sz(-19.45),
      woodedStartDistance: EXTENSION_LENGTH,
      introDropDistance: EXTENSION_LENGTH + 8,
      introVanStartDistance: Math.max(0, EXTENSION_LENGTH - 32)
    };
    this.gravelPath = path;

    const positions = [];
    const indices = [];

    points.forEach((point, i) => {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const length = Math.hypot(tx, tz) || 1;
      const nx = -tz / length;
      const nz = tx / length;

      positions.push(
        point.x + nx * path.halfWidth, point.y, point.z + nz * path.halfWidth,
        point.x - nx * path.halfWidth, point.y, point.z - nz * path.halfWidth
      );

      if (i > 0) {
        const a = (i - 1) * 2;
        const b = a + 1;
        const c = i * 2;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({ color: 0x6f5a42, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const heightAt = (z) => {
      if (z <= points[0].z) return points[0].y;

      for (let i = 1; i < points.length; i++) {
        if (z <= points[i].z) {
          const a = points[i - 1];
          const b = points[i];
          const t = (z - a.z) / (b.z - a.z);
          return a.y + (b.y - a.y) * t;
        }
      }
      return points[points.length - 1].y;
    };
    path.heightAt = heightAt;

    const segments = [];
    let totalLength = 0;

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      segments.push({ a, b, length, start: totalLength });
      totalLength += length;
    }

    const samplePath = (distance) => {
      const d = Math.max(0, Math.min(totalLength, distance));

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (d <= segment.start + segment.length || i === segments.length - 1) {
          const t = (d - segment.start) / segment.length;
          return {
            x: segment.a.x + (segment.b.x - segment.a.x) * t,
            y: segment.a.y + (segment.b.y - segment.a.y) * t,
            z: segment.a.z + (segment.b.z - segment.a.z) * t
          };
        }
      }
      return points[points.length - 1];
    };

    path.length = totalLength;
    path.sample = samplePath;
    // Spawn just a short walk from the reed line so waves reach the water
    // quickly instead of trekking the whole (now longer) road.
    path.smugglerSpawnDistance = Math.max(
      EXTENSION_LENGTH,
      totalLength - sz(12)
    );

    path.frameAt = (distance) => {
      const sample = samplePath(distance);
      const ahead = samplePath(Math.min(totalLength, distance + 0.5));
      const behind = samplePath(Math.max(0, distance - 0.5));
      let tx = ahead.x - behind.x;
      let tz = ahead.z - behind.z;
      const length = Math.hypot(tx, tz) || 1;
      tx /= length;
      tz /= length;

      return {
        x: sample.x,
        y: sample.y,
        z: sample.z,
        tx,
        tz,
        nx: tz,
        nz: -tx,
        heading: Math.atan2(tx, tz)
      };
    };

    path.isNear = (x, z, padding) => {
      const paddingSq = padding * padding;

      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lengthSq = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq));
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const distX = x - px;
        const distZ = z - pz;

        if (distX * distX + distZ * distZ <= paddingSq) return true;
      }
      return false;
    };

    const pebbleCount = 180;
    const pebbleGeo = new THREE.DodecahedronGeometry(0.12, 0);
    const pebbleMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    for (let i = 0; i < pebbleCount; i++) {
      const sample = samplePath(Math.random() * totalLength);
      const scale = 0.45 + Math.random() * 0.8;
      const offset = (Math.random() - 0.5) * path.halfWidth * 1.5;

      dummy.position.set(
        sample.x + offset,
        sample.y + 0.03,
        sample.z + (Math.random() - 0.5) * path.halfWidth * 1.5
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.set(scale * (0.7 + Math.random() * 0.6), scale * 0.45, scale);
      dummy.updateMatrix();
      pebbles.setMatrixAt(i, dummy.matrix);
      pebbles.setColorAt(i, tint.setHSL(0.09, 0.12, 0.32 + Math.random() * 0.17));
    }

    pebbles.instanceMatrix.needsUpdate = true;
    if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    pebbles.receiveShadow = true;
    this.scene.add(pebbles);
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
varying vec2 vWaterUv;
uniform float uTime;
${RIVER_SWELL_HEIGHT_GLSL}`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
float waterBankDist = min(uv.x, 1.0 - uv.x) * ${waterWidth.toFixed(2)};
float waterWaveBankDist = max(0.0, waterBankDist - 0.6);
float waterBankT = clamp(waterWaveBankDist / 3.0, 0.0, 1.0);
float waterBankFade = waterBankT * waterBankT * (3.0 - 2.0 * waterBankT);
float waterEndT = clamp(min(uv.y, 1.0 - uv.y) / 0.01, 0.0, 1.0);
float waterEndFade = waterEndT * waterEndT * (3.0 - 2.0 * waterEndT);
float waterFade = waterBankFade * waterEndFade;
float waterShoreDrop = 0.0;
if (waterBankDist < 1.1) {
  float waterShoreT = 1.0 - waterBankDist / 1.1;
  waterShoreDrop = -0.28 * waterShoreT * waterShoreT;
}
transformed.y += riverSwellHeight(transformed.xz, uTime) * waterFade + waterShoreDrop;
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
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.88, 0.86), waterFoam * 0.35);
float waterShoreAlpha = smoothstep(0.0, 0.9, waterBankDist);
diffuseColor.a *= mix(0.55, 1.0, waterShoreAlpha);`
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

  // Signed distance from the river centerline (negative = north bank side).
  lateralOffsetAt(x, z) {
    let bestSq = Infinity;
    let bestOffset = 0;

    for (let i = 0; i < this.riverSamples.length; i++) {
      const s = this.riverSamples[i];
      const dx = x - s.p.x;
      const dz = z - s.p.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq < bestSq) {
        bestSq = distanceSq;
        bestOffset = dx * s.n.x + dz * s.n.z;
      }
    }
    return bestOffset;
  }

  findRockCollision(x, z, radius) {
    let nearest = null;
    let nearestDistanceSq = Infinity;

    for (let i = 0; i < this.rockColliders.length; i++) {
      const rock = this.rockColliders[i];
      const dx = x - rock.x;
      const dz = z - rock.z;
      const minDistance = radius + rock.radius;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq <= minDistance * minDistance && distanceSq < nearestDistanceSq) {
        nearest = rock;
        nearestDistanceSq = distanceSq;
      }
    }
    return nearest;
  }

  isNearRock(x, z, padding = 0) {
    for (let i = 0; i < this.rockColliders.length; i++) {
      const rock = this.rockColliders[i];
      const dx = x - rock.x;
      const dz = z - rock.z;
      const minDistance = (rock.visualRadius ?? rock.radius) + padding;

      if (dx * dx + dz * dz < minDistance * minDistance) {
        return true;
      }
    }
    return false;
  }

  emitRockImpact(boatX, boatZ, rock) {
    const dx = boatX - rock.x;
    const dz = boatZ - rock.z;
    const distance = Math.hypot(dx, dz) || 1;
    const x = rock.x + (dx / distance) * rock.radius;
    const z = rock.z + (dz / distance) * rock.radius;

    this.emitSplash(x, z, 22, 0xd7e8e3);

    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.6;
      this.emitParticle(
        x + (Math.random() - 0.5) * 0.35,
        0.35 + Math.random() * 0.5,
        z + (Math.random() - 0.5) * 0.35,
        Math.cos(angle) * speed,
        1.5 + Math.random() * 2.5,
        Math.sin(angle) * speed,
        0x73787b,
        0.7 + Math.random() * 0.7,
        0.5 + Math.random() * 0.35
      );
    }
  }

  addReedSway(material) {
    const windUniform = this.reedsWind;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = windUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWindTime;
attribute float aBaseY;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
#ifdef USE_INSTANCING
vec4 reedWorld = instanceMatrix * vec4(transformed, 1.0);
float reedPhase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
float reedHeight = max(0.0, reedWorld.y - aBaseY);
float reedBendX = cos(uWindTime * 1.8 + reedPhase) * 0.08;
float reedBendZ = sin(uWindTime * 2.2 + reedPhase) * 0.12;
transformed.x += (reedBendX * reedHeight) / max(length(instanceMatrix[0].xyz), 0.001);
transformed.z += (reedBendZ * reedHeight) / max(length(instanceMatrix[2].xyz), 0.001);
#endif`
        );
    };
    material.customProgramCacheKey = () => 'reed-sway';
  }

  createReedsAndVegetation() {
    // Density multiplier for the straight, playable stretch. The curving
    // background sections keep their full coverage.
    const playDensity = 0.5;
    const stalkMat = new THREE.MeshLambertMaterial({ color: 0x5e7839, flatShading: true });
    const cattailMat = new THREE.MeshLambertMaterial({ color: 0x482b14 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x6e8f42 });
    const flowerMat = new THREE.MeshLambertMaterial({ color: 0xfff0fa });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x737678, flatShading: true });

    this.addReedSway(stalkMat);
    this.addReedSway(leafMat);
    this.addReedSway(cattailMat);

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
      { x: -28, z: -17.1, y: NORTH_BANK_Y }, { x: -20, z: -18.0, y: NORTH_BANK_Y },
      { x: -12, z: -16.8, y: NORTH_BANK_Y }, { x: -4, z: -17.8, y: NORTH_BANK_Y },
      { x: 4, z: -16.9, y: NORTH_BANK_Y }, { x: 12, z: -18.1, y: NORTH_BANK_Y },
      { x: 20, z: -17.0, y: NORTH_BANK_Y }, { x: 28, z: -17.9, y: NORTH_BANK_Y },
      // South shore waterline
      { x: -26, z: 15.1 }, { x: -14, z: 15.2 }, { x: -2, z: 15.0 },
      { x: 12, z: 15.3 }, { x: 22, z: 15.1 }, { x: 29, z: 15.2 }
    ].map((pos) => ({ ...pos, x: sx(pos.x), z: sz(pos.z) }));

    // All reeds are batched into a handful of InstancedMeshes. The dense
    // shoreline belts reuse those same meshes, and the wind sway is evaluated
    // in the vertex shader, so denser planting adds no draw calls or per-frame
    // CPU work.
    const stalks = [];
    const altStalks = [];
    const heads = [];
    const tips = [];
    const leaves = [];
    const rocks = [];
    const pads = [];
    const flowers = [];

    clumpPositions.forEach((pos, cIndex) => {
      const path = this.gravelPath;
      if (
        path &&
        pos.z > path.reedZMin &&
        pos.z < path.reedZMax &&
        path.isNear(pos.x, pos.z, path.halfWidth + 0.75)
      ) {
        return;
      }

      const baseY = pos.y || 0;
      const stalkCount = Math.max(
        2,
        Math.round((11 + (pos.y ? 6 : 0) + Math.floor(Math.sin(cIndex * 3) * 3 + 3)) * playDensity)
      );

      for (let i = 0; i < stalkCount; i++) {
        const height = (pos.y ? 2.8 : 2.1) + Math.random() * (pos.y ? 1.8 : 1.6);
        const x = pos.x + (Math.random() - 0.5) * 2.6;
        const z = pos.z + (Math.random() - 0.5) * 1.4;

        if (this.isNearRock(x, z, 0.18)) continue;

        stalks.push({ x, y: baseY, z, sy: height, baseY });

        if (Math.random() > 0.4) {
          heads.push({ x, y: baseY + height * 0.85 - 0.275, z, sy: 0.55, baseY });
          tips.push({ x, y: baseY + height * 0.85 + 0.225, z, sy: 0.25, baseY });
        }

        leaves.push({
          x: x + 0.08,
          y: baseY,
          z,
          sy: height * 0.7,
          rz: 0.2,
          baseY
        });
      }

      if (Math.random() > 0.3) {
        const rockSize = 0.35 + Math.random() * 0.4;
        rocks.push({
          x: pos.x + (Math.random() - 0.5) * 1.5,
          y: baseY + 0.1,
          z: pos.z + (Math.random() - 0.5) * 0.6,
          s: rockSize,
          rx: Math.random(),
          ry: Math.random(),
          rz: Math.random()
        });
      }

      if (!pos.y) {
        for (let l = 0; l < 2; l++) {
          const pzOffset = pos.z < 0 ? 0.9 : -0.9;
          const px = pos.x + (Math.random() - 0.5) * 2.0;
          const pz = pos.z + pzOffset + (Math.random() - 0.5) * 0.5;
          pads.push({ x: px, y: 0.03, z: pz, baseY: 0 });

          if (l === 0) {
            flowers.push({ x: px, y: 0.1, z: pz });
          }
        }
      }
    });

    const addExtraReed = (x, y, z, sizeScale = 1) => {
      const path = this.gravelPath;
      if (
        path &&
        z > path.reedZMin &&
        z < path.reedZMax &&
        path.isNear(x, z, path.halfWidth + 0.45)
      ) {
        return;
      }

      if (this.isNearRock(x, z, 0.18)) return;

      // Reject reeds that would sit inside the northern cliff/lip (buried and
      // poking through the ground) or float in the air just past its edge.
      const lateral = this.lateralOffsetAt(x, z);
      if (y > 1 && lateral > sz(-16.05)) return;
      if (y <= 1 && lateral < sz(-16.05)) return;

      const height = (1.7 + Math.random() * 1.8) * sizeScale;
      const target = Math.random() > 0.5 ? stalks : altStalks;
      target.push({ x, y, z, sy: height, ry: Math.random() * Math.PI, baseY: y });

      if (Math.random() > 0.7) {
        heads.push({ x, y: y + height * 0.84 - 0.225, z, sy: 0.45, baseY: y });
      }

      if (Math.random() > 0.45) {
        leaves.push({
          x: x + (Math.random() - 0.5) * 0.18,
          y,
          z,
          sy: height * (0.45 + Math.random() * 0.25),
          rz: (Math.random() - 0.5) * 0.8,
          baseY: y
        });
      }
    };

    const addReedPatch = ({
      y = 0,
      xMin,
      xMax,
      zMin,
      zMax,
      patchCount,
      patchRadiusX,
      patchRadiusZ,
      reedMin,
      reedMax,
      scaleMin,
      scaleMax
    }) => {
      const scaledXMin = sx(xMin);
      const scaledXMax = sx(xMax);
      const scaledZMin = sz(zMin);
      const scaledZMax = sz(zMax);
      const scaledRadiusX = sx(patchRadiusX);
      const scaledRadiusZ = sz(patchRadiusZ);

      for (let patch = 0; patch < patchCount; patch++) {
        const centerX = scaledXMin + Math.random() * (scaledXMax - scaledXMin);
        const centerZ = scaledZMin + Math.random() * (scaledZMax - scaledZMin);
        const reedCount = Math.max(
          2,
          Math.round((reedMin + Math.random() * (reedMax - reedMin + 1)) * playDensity)
        );

        for (let i = 0; i < reedCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spread = Math.sqrt(Math.random());
          addExtraReed(
            centerX + Math.cos(angle) * spread * scaledRadiusX,
            y,
            centerZ + Math.sin(angle) * spread * scaledRadiusZ,
            scaleMin + Math.random() * (scaleMax - scaleMin)
          );
        }
      }
    };

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: -16.2,
      zMax: -15.2,
      patchCount: 88,
      patchRadiusX: 3.2,
      patchRadiusZ: 0.65,
      reedMin: 10,
      reedMax: 18,
      scaleMin: 0.8,
      scaleMax: 1.35
    });

    addReedPatch({
      y: NORTH_BANK_Y,
      xMin: -48,
      xMax: 48,
      zMin: -19.4,
      zMax: -17.7,
      patchCount: 75,
      patchRadiusX: 3.4,
      patchRadiusZ: 1.3,
      reedMin: 9,
      reedMax: 15,
      scaleMin: 1.1,
      scaleMax: 1.65
    });

    addReedPatch({
      y: NORTH_BANK_Y,
      xMin: -48,
      xMax: 48,
      zMin: -17.7,
      zMax: -16.7,
      patchCount: 68,
      patchRadiusX: 3.2,
      patchRadiusZ: 0.7,
      reedMin: 9,
      reedMax: 16,
      scaleMin: 1.0,
      scaleMax: 1.55
    });

    addReedPatch({
      y: NORTH_BANK_Y,
      xMin: -48,
      xMax: 48,
      zMin: -18.4,
      zMax: -16.9,
      patchCount: 100,
      patchRadiusX: 3.5,
      patchRadiusZ: 0.9,
      reedMin: 11,
      reedMax: 18,
      scaleMin: 1.2,
      scaleMax: 1.85
    });

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: -16.0,
      zMax: -15.35,
      patchCount: 95,
      patchRadiusX: 3.4,
      patchRadiusZ: 0.35,
      reedMin: 10,
      reedMax: 18,
      scaleMin: 1.6,
      scaleMax: 2.2
    });

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: 15.05,
      zMax: 16.4,
      patchCount: 130,
      patchRadiusX: 3.4,
      patchRadiusZ: 0.85,
      reedMin: 12,
      reedMax: 20,
      scaleMin: 0.8,
      scaleMax: 1.4
    });

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: 16.2,
      zMax: 17.5,
      patchCount: 84,
      patchRadiusX: 3.2,
      patchRadiusZ: 0.6,
      reedMin: 8,
      reedMax: 14,
      scaleMin: 0.65,
      scaleMax: 1.1
    });

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: 14.4,
      zMax: 15.3,
      patchCount: 62,
      patchRadiusX: 2.8,
      patchRadiusZ: 0.5,
      reedMin: 6,
      reedMax: 12,
      scaleMin: 0.55,
      scaleMax: 0.95
    });

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: -15.6,
      zMax: -14.7,
      patchCount: 52,
      patchRadiusX: 2.8,
      patchRadiusZ: 0.45,
      reedMin: 6,
      reedMax: 11,
      scaleMin: 0.6,
      scaleMax: 1.0
    });

    // Extra coverage behind the northern reed belt so no bare dirt shows
    // through anywhere along the high bank.
    addReedPatch({
      y: NORTH_BANK_Y,
      xMin: -48,
      xMax: 48,
      zMin: -21.5,
      zMax: -18.0,
      patchCount: 110,
      patchRadiusX: 3.2,
      patchRadiusZ: 1.0,
      reedMin: 9,
      reedMax: 16,
      scaleMin: 1.0,
      scaleMax: 1.7
    });

    // Dense lip row right on the bank edge so the smooth strip between the
    // bank reeds and the water is closed up.
    addReedPatch({
      y: NORTH_BANK_Y,
      xMin: -48,
      xMax: 48,
      zMin: -17.4,
      zMax: -16.15,
      patchCount: 210,
      patchRadiusX: 3.4,
      patchRadiusZ: 0.1,
      reedMin: 10,
      reedMax: 18,
      scaleMin: 1.0,
      scaleMax: 1.6
    });

    // Tall reeds rooted at the waterline in front of the northern cliff, so
    // the bank face is hidden behind a wall of vegetation instead of reading
    // as a bare brown/dark band from the water.
    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: -15.5,
      zMax: -14.6,
      patchCount: 220,
      patchRadiusX: 3.6,
      patchRadiusZ: 0.25,
      reedMin: 12,
      reedMax: 20,
      scaleMin: 1.3,
      scaleMax: 2.1
    });

    addReedPatch({
      xMin: -48,
      xMax: 48,
      zMin: -15.9,
      zMax: -14.9,
      patchCount: 190,
      patchRadiusX: 3.6,
      patchRadiusZ: 0.3,
      reedMin: 10,
      reedMax: 18,
      scaleMin: 0.9,
      scaleMax: 1.7
    });

    // Fill the bald patches around the ends of the rock barriers on both banks.
    for (const side of [-1, 1]) {
      addReedPatch({
        y: NORTH_BANK_Y,
        xMin: side < 0 ? -44 : 26,
        xMax: side < 0 ? -26 : 44,
        zMin: -27,
        zMax: -18.0,
        patchCount: 36,
        patchRadiusX: 3.0,
        patchRadiusZ: 2.0,
        reedMin: 10,
        reedMax: 18,
        scaleMin: 1.0,
        scaleMax: 1.7
      });

      addReedPatch({
        xMin: side < 0 ? -44 : 26,
        xMax: side < 0 ? -26 : 44,
        zMin: 16.0,
        zMax: 26,
        patchCount: 30,
        patchRadiusX: 3.0,
        patchRadiusZ: 2.0,
        reedMin: 10,
        reedMax: 18,
        scaleMin: 0.9,
        scaleMax: 1.5
      });
    }

    // Follow the curving sections beyond the playable stretch. These reeds are
    // placed in river space (not fixed world Z), so the shoreline belts stay
    // glued to the banks as the channel bends away into the fog.
    for (let i = 0; i < this.riverSamples.length; i += 2) {
      const sample = this.riverSamples[i];
      if (Math.abs(sample.p.x) < sx(46)) continue;
      if (Math.hypot(sample.p.x, sample.p.z) > 500) continue;

      // Northern bank: waterline, cliff lip and plateau rows. Offsets are kept
      // clear of the cliff/lip geometry so no reed grows through the ground.
      const bands = [
        { offset: -15.0, half: 0.6, y: 0, scale: [0.9, 1.6] },
        { offset: -15.5, half: 0.4, y: 0, scale: [1.3, 2.0] },
        { offset: -16.4, half: 0.35, y: NORTH_BANK_Y, scale: [1.0, 1.8] },
        { offset: -17.2, half: 1.0, y: NORTH_BANK_Y, scale: [0.9, 1.5] },
        { offset: -20.8, half: 1.7, y: NORTH_BANK_Y, scale: [0.9, 1.5] },
        { offset: -24.5, half: 1.6, y: NORTH_BANK_Y, scale: [0.8, 1.35] }
      ].map((band) => ({
        ...band,
        offset: sz(band.offset),
        half: sz(band.half)
      }));

      const topBankDensity = 0.5;

      for (const band of bands) {
        if (Math.random() > 0.97) continue;

        const reedCount = Math.max(
          2,
          Math.round((8 + Math.floor(Math.random() * 8)) * topBankDensity)
        );

        for (let j = 0; j < reedCount; j++) {
          const along = (Math.random() - 0.5) * 4.5;
          const offset = band.offset + (Math.random() - 0.5) * band.half * 2;
          const x = sample.p.x + sample.n.x * offset + sample.t.x * along;
          const z = sample.p.z + sample.n.z * offset + sample.t.z * along;

          addExtraReed(
            x,
            band.y,
            z,
            band.scale[0] + Math.random() * (band.scale[1] - band.scale[0])
          );
        }
      }

      // Southern shore.
      if (Math.random() < 0.94) {
        const reedCount = 6 + Math.floor(Math.random() * 6);

        for (let j = 0; j < reedCount; j++) {
          const along = (Math.random() - 0.5) * 4.5;
          const offset = sz(15.8) + (Math.random() - 0.5) * sz(3.0);
          const x = sample.p.x + sample.n.x * offset + sample.t.x * along;
          const z = sample.p.z + sample.n.z * offset + sample.t.z * along;

          addExtraReed(x, 0, z, 0.85 + Math.random() * 0.7);
        }
      }
    }

    const pathEnd = this.gravelPath;
    if (pathEnd) {
      const endFrame = pathEnd.frameAt(pathEnd.length - 0.1);

      for (let i = 0; i < 140; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random());
        const x = endFrame.x + Math.cos(angle) * spread * sx(3.4);
        const z = endFrame.z + Math.sin(angle) * spread * sz(1.5);
        const height = 2.6 + Math.random() * 2.2;
        const baseY = NORTH_BANK_Y;

        stalks.push({ x, y: baseY, z, sy: height, ry: Math.random() * Math.PI, baseY });

        if (Math.random() > 0.3) {
          heads.push({ x, y: baseY + height * 0.84 - 0.225, z, sy: 0.45, baseY });
        }

        if (Math.random() > 0.2) {
          leaves.push({
            x: x + (Math.random() - 0.5) * 0.2,
            y: baseY,
            z,
            sy: height * (0.5 + Math.random() * 0.25),
            rz: (Math.random() - 0.5) * 0.8,
            baseY
          });
        }
      }
    }

    const dummy = new THREE.Object3D();
    const buildInstanced = (geometry, material, items, castShadow = true) => {
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);
      const bases = new Float32Array(items.length);

      items.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z);
        dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
        dummy.scale.set(it.s ?? it.sx ?? 1, it.sy ?? it.s ?? 1, it.s ?? it.sz ?? 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        bases[i] = it.baseY || 0;
      });

      geometry.setAttribute('aBaseY', new THREE.InstancedBufferAttribute(bases, 1));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      this.scene.add(mesh);
    };

    const stalkGeo = new THREE.CylinderGeometry(0.045, 0.07, 1, 4);
    stalkGeo.translate(0, 0.5, 0);
    const headGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 5);
    headGeo.translate(0, 0.5, 0);
    const tipGeo = new THREE.CylinderGeometry(0.02, 0.03, 1, 4);
    tipGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.BoxGeometry(0.04, 1, 0.16);
    leafGeo.translate(0, 0.5, 0);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const padGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.02, 6);
    const flowerGeo = new THREE.ConeGeometry(0.12, 0.15, 5);

    buildInstanced(stalkGeo, stalkMat, stalks);
    buildInstanced(stalkGeo.clone(), leafMat, altStalks);
    buildInstanced(headGeo, cattailMat, heads);
    buildInstanced(tipGeo, stalkMat, tips);
    buildInstanced(leafGeo, leafMat, leaves);
    buildInstanced(rockGeo, rockMat, rocks);
    buildInstanced(padGeo, leafMat, pads, false);
    buildInstanced(flowerGeo, flowerMat, flowers, false);
  }

  createBankVegetation() {
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const grassGeo = new THREE.ConeGeometry(0.1, 1, 4);
    grassGeo.translate(0, 0.5, 0);

    const bushMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const grassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

    const bushes = [];
    const grass = [];

    for (let patch = 0; patch < 96; patch++) {
      const centerX = sx(-68) + Math.random() * sx(136);
      const centerZ = sz(20) + Math.random() * sz(36);
      const count = 3 + Math.floor(Math.random() * 5);

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random()) * (2.5 + Math.random() * 3.5);
        const scale = 0.35 + Math.random() * 0.7;

        bushes.push({
          x: centerX + Math.cos(angle) * spread,
          z: centerZ + Math.sin(angle) * spread,
          sx: scale * (0.9 + Math.random() * 0.5),
          sy: scale * (0.55 + Math.random() * 0.4),
          sz: scale * (0.9 + Math.random() * 0.5),
          ry: Math.random() * Math.PI * 2
        });
      }
    }

    for (let patch = 0; patch < 240; patch++) {
      const centerX = sx(-68) + Math.random() * sx(136);
      const centerZ = sz(17.3) + Math.random() * sz(42);
      const count = 6 + Math.floor(Math.random() * 7);

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random()) * (1.4 + Math.random() * 2.6);

        grass.push({
          x: centerX + Math.cos(angle) * spread,
          z: centerZ + Math.sin(angle) * spread,
          sx: 0.7 + Math.random() * 1.0,
          sy: 0.5 + Math.random() * 1.5,
          sz: 0.7 + Math.random() * 1.0,
          ry: Math.random() * Math.PI * 2
        });
      }
    }

    // The high northern bank gets the same treatment: thick tufts and low
    // bushes swallow the dirt lip and any bare ground behind the reed belt.
    for (let patch = 0; patch < 220; patch++) {
      const centerX = sx(-70) + Math.random() * sx(140);
      const centerZ = sz(-27) + Math.random() * sz(8);

      for (let i = 0; i < 9 + Math.floor(Math.random() * 8); i++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random()) * (1.5 + Math.random() * 3.0);

        grass.push({
          x: centerX + Math.cos(angle) * spread,
          y: NORTH_BANK_Y,
          z: centerZ + Math.sin(angle) * spread,
          sx: 0.8 + Math.random() * 1.1,
          sy: 0.9 + Math.random() * 2.0,
          sz: 0.8 + Math.random() * 1.1,
          ry: Math.random() * Math.PI * 2
        });
      }
    }

    for (let patch = 0; patch < 70; patch++) {
      const centerX = sx(-70) + Math.random() * sx(140);
      const centerZ = sz(-27) + Math.random() * sz(5);
      const count = 2 + Math.floor(Math.random() * 4);

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random()) * (2.0 + Math.random() * 3.5);
        const scale = 0.35 + Math.random() * 0.6;

        bushes.push({
          x: centerX + Math.cos(angle) * spread,
          y: NORTH_BANK_Y,
          z: centerZ + Math.sin(angle) * spread,
          sx: scale * (0.9 + Math.random() * 0.5),
          sy: scale * (0.55 + Math.random() * 0.4),
          sz: scale * (0.9 + Math.random() * 0.5),
          ry: Math.random() * Math.PI * 2
        });
      }
    }

    // Dense low tufts along the sand-to-grass transition so the beach edge
    // doesn't read as a bare lawn between the reeds and the bushes.
    for (let patch = 0; patch < 150; patch++) {
      const centerX = sx(-64) + Math.random() * sx(128);
      const centerZ = sz(17.6) + Math.random() * sz(9);
      const count = 8 + Math.floor(Math.random() * 8);

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spread = Math.sqrt(Math.random()) * (1.2 + Math.random() * 2.2);

        grass.push({
          x: centerX + Math.cos(angle) * spread,
          z: centerZ + Math.sin(angle) * spread,
          sx: 0.6 + Math.random() * 0.9,
          sy: 0.45 + Math.random() * 1.2,
          sz: 0.6 + Math.random() * 0.9,
          ry: Math.random() * Math.PI * 2
        });
      }
    }

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    const build = (geometry, material, items, colorFn, castShadow) => {
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);

      items.forEach((it, i) => {
        const baseY = it.y ?? 0;
        const y = baseY + (it.sy ? it.sy * 0.55 : 0);
        dummy.position.set(it.x, geometry === bushGeo ? y : baseY, it.z);
        dummy.rotation.set(0, it.ry, 0);
        dummy.scale.set(it.sx, it.sy, it.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, colorFn(tint, it));
      });

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      this.scene.add(mesh);
    };

    build(
      bushGeo,
      bushMat,
      bushes,
      (color) => color.setHSL(0.28 + Math.random() * 0.05, 0.42, 0.16 + Math.random() * 0.09),
      true
    );
    build(
      grassGeo,
      grassMat,
      grass,
      (color) => color.setHSL(0.24 + Math.random() * 0.08, 0.5, 0.24 + Math.random() * 0.12),
      false
    );
  }

  createRiverBoundaries() {
    // Natural impassable barriers at West (X = -32 to -35) and East (X = +32 to +35)
    // Rocks, boulders, and thick standing камыши
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x525659, flatShading: true });
    const mossRockMat = new THREE.MeshLambertMaterial({ color: 0x48523c, flatShading: true });
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x4a6b2f, flatShading: true });
    const cattailMat = new THREE.MeshLambertMaterial({ color: 0x3d220e });
    this.addReedSway(reedMat);
    this.addReedSway(cattailMat);

    const rocks = [];
    const mossRocks = [];
    const stalks = [];
    const heads = [];

    const boundarySides = [sx(-33.5), sx(33.5)];
    const reedClusters = [];

    boundarySides.forEach((baseX) => {
      const isWest = baseX < 0;
      const riverSide = isWest ? 1 : -1;

      let z = sz(-16.5);
      while (z <= sz(16.5)) {
        const clusterZ = z + (Math.random() - 0.5) * sz(1.4);
        const clusterX = baseX + riverSide * sx(0.2 + Math.random() * 1.6);
        const clusterSize = 1 + Math.floor(Math.random() * 3);

        for (let i = 0; i < clusterSize; i++) {
          const size = 0.9 + Math.random() * 1.5;
          const x = clusterX + riverSide * sx(Math.random() * 2.0 - 0.2);
          const zz = clusterZ + (Math.random() - 0.5) * sz(2.4);
          const target = Math.random() > 0.48 ? rocks : mossRocks;
          target.push({
            x,
            y: 0.25 + Math.random() * 0.55,
            z: zz,
            s: size,
            rx: Math.random() * Math.PI,
            ry: Math.random() * Math.PI,
            rz: Math.random() * Math.PI
          });
          this.rockColliders.push({
            x,
            z: zz,
            radius: size * 0.88,
            visualRadius: size
          });
        }

        reedClusters.push({ clusterX, clusterZ, riverSide });
        z += sz(2.0) + Math.random() * sz(2.4);
      }

      for (let i = 0; i < 7; i++) {
        const size = 0.6 + Math.random() * 1.3;
        const x = baseX + riverSide * sx(1.8 + Math.random() * 2.8);
        const zz = sz(-15) + Math.random() * sz(30);
        const target = Math.random() > 0.5 ? rocks : mossRocks;
        target.push({
          x,
          y: 0.2 + Math.random() * 0.45,
          z: zz,
          s: size,
          rx: Math.random() * Math.PI,
          ry: Math.random() * Math.PI,
          rz: Math.random() * Math.PI
        });
        this.rockColliders.push({
          x,
          z: zz,
          radius: size * 0.88,
          visualRadius: size
        });
      }
    });

    const addBoundaryReed = (x, z, height) => {
      if (this.isNearRock(x, z, 0.16)) return;

      // At the northern end of a barrier the rock line runs into the high
      // bank; stand those reeds on the bank top instead of letting them clip
      // through the ground.
      const baseY = this.lateralOffsetAt(x, z) < sz(-15.9) ? NORTH_BANK_Y : 0;

      stalks.push({ x, y: baseY, z, sy: height, baseY });

      if (Math.random() > 0.45) {
        heads.push({ x, y: baseY + height * 0.82 - 0.3, z, sy: 0.6, baseY });
      }
    };

    reedClusters.forEach(({ clusterX, clusterZ, riverSide }) => {
      const clumpCount = Math.random() > 0.25 ? 5 + Math.floor(Math.random() * 3) : 0;
      const clumpX = clusterX + riverSide * (0.4 + Math.random() * 0.8);

      for (let s = 0; s < clumpCount; s++) {
        addBoundaryReed(
          clumpX + (Math.random() - 0.5) * 1.1,
          clusterZ + (Math.random() - 0.5) * 1.8,
          2.1 + Math.random() * 1.4
        );
      }
    });

    this.rockColliders.forEach((rock) => {
      const ringCount = 12 + Math.floor(Math.random() * 8);

      for (let i = 0; i < ringCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = rock.radius + 0.3 + Math.random() * 1.0;

        addBoundaryReed(
          rock.x + Math.cos(angle) * radius,
          rock.z + Math.sin(angle) * radius,
          1.8 + Math.random() * 1.8
        );
      }
    });

    const dummy = new THREE.Object3D();
    const build = (geometry, material, items, receiveShadow = false) => {
      if (!items.length) return;
      const mesh = new THREE.InstancedMesh(geometry, material, items.length);
      items.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z);
        dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
        dummy.scale.set(it.s ?? it.sx ?? 1, it.sy ?? it.s ?? 1, it.s ?? it.sz ?? 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      if (material === reedMat || material === cattailMat) {
        const bases = new Float32Array(items.length);
        items.forEach((it, i) => {
          bases[i] = it.baseY ?? 0;
        });
        geometry.setAttribute('aBaseY', new THREE.InstancedBufferAttribute(bases, 1));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = receiveShadow;
      this.scene.add(mesh);
    };

    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const stalkGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 4);
    stalkGeo.translate(0, 0.5, 0);
    const headGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 5);
    headGeo.translate(0, 0.5, 0);

    build(rockGeo, rockMat, rocks, true);
    build(rockGeo.clone(), mossRockMat, mossRocks, true);
    build(stalkGeo, reedMat, stalks);
    build(headGeo, cattailMat, heads);
  }

  createEnvironmentDetails() {
    const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6);
    const postMat = new THREE.MeshLambertMaterial({ color: 0xee2222 });
    const signGeo = new THREE.BoxGeometry(2.2, 1.1, 0.15);
    const signMat = new THREE.MeshLambertMaterial({ color: 0xffea00 });

    for (let x = sx(-28); x <= sx(28); x += sx(14)) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, NORTH_BANK_Y - 0.5, sz(-19.8));
      post.castShadow = true;
      this.scene.add(post);

      const signBoard = new THREE.Mesh(signGeo, signMat);
      signBoard.position.set(x, NORTH_BANK_Y + 0.7, sz(-19.8));
      signBoard.castShadow = true;
      this.scene.add(signBoard);
    }

    this.createWatchtower(sx(-20), sz(24));
    this.createWatchtower(sx(20), sz(24));
  }

  // Dense mixed forest belts along both banks plus a canopy wall that closes off
  // the horizon, so the river reads as a winding channel through woodland
  // instead of a rectangle floating on an empty field.
  createForests() {
    const samples = this.riverSamples;
    const trees = [];

    const addTree = (x, z, side, scale) => {
      // Keep the mission area readable: no trees on the beach, the patrol path
      // or in the water.
      if (Math.abs(x) < sx(47) && z > sz(-23) && z < sz(25)) return;

      // Keep a wide clearing around the gravel path so the drop-off van and
      // the road stay readable from the intro drone shot.
      if (this.gravelPath && this.gravelPath.isNear(x, z, 9)) return;

      // The river now continues far past the play space; don't populate the
      // fogged-out extensions with trees.
      if (Math.hypot(x, z) > 450) return;

      trees.push({
        x,
        z,
        y: side < 0 ? NORTH_BANK_Y : 0.05,
        scale: scale * (0.75 + Math.random() * 0.7),
        rotation: Math.random() * Math.PI * 2,
        pine: Math.random() > 0.22
      });
    };

    const plant = (s, side, offset, scale) => {
      const x = s.p.x + s.n.x * offset * side + (Math.random() - 0.5) * 3.5;
      const z = s.p.z + s.n.z * offset * side + (Math.random() - 0.5) * 3.5;
      addTree(x, z, side, scale);
    };

    for (let i = 4; i < samples.length - 4; i += 4) {
      const s = samples[i];
      for (const side of [-1, 1]) {
        // Four rows of forest climbing away from the water
        for (let row = 0; row < 4; row++) {
          const offset = sz(side < 0 ? 24 : 27) + row * sz(15) + Math.random() * sz(9);
          if (Math.random() > 0.82) continue;
          plant(s, side, offset, 1);
        }
        // Sparse taller canopy wall behind the belt
        if (i % 12 === 0) {
          plant(s, side, sz(95) + Math.random() * sz(40), 1.35);
        }
      }
    }

    for (const side of [-1, 1]) {
      const groveCount = side < 0 ? 14 : 10;
      for (let g = 0; g < groveCount; g++) {
        const groveX = sx(-58) + Math.random() * sx(116);
        const groveZ = side < 0
          ? sz(-28) - Math.random() * sz(36)
          : sz(28) + Math.random() * sz(36);
        const treeCount = 5 + Math.floor(Math.random() * 5);

        for (let i = 0; i < treeCount; i++) {
          addTree(
            groveX + (Math.random() - 0.5) * sx(14),
            groveZ + (Math.random() - 0.5) * sz(14),
            side,
            0.9 + Math.random() * 0.5
          );
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

    tower.position.set(x, -3.0, z);
    tower.rotation.y = Math.PI;
    this.scene.add(tower);
  }

  createAppalledCrowd() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5c29b });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
    const clothesMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const beanieMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const markMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });

    const crowdTime = this.crowdTime;
    const crowdShock = this.crowdShock;
    const addBob = (material) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uCrowdTime = crowdTime;
        shader.uniforms.uCrowdShock = crowdShock;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
uniform float uCrowdTime;
uniform float uCrowdShock;
attribute float aCrowdPhase;`
          )
          .replace(
            '#include <project_vertex>',
            `vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  mvPosition.y += sin(uCrowdTime * 3.5 + aCrowdPhase) * 0.06 + uCrowdShock;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`
          );
      };
      material.customProgramCacheKey = () => 'crowd-bob';
    };
    [skinMat, pantsMat, clothesMat, beanieMat, markMat].forEach(addBob);

    const jacketColors = [
      0xcc3333, 0x2a75d3, 0xffa500, 0x8b35bc, 0x228b22,
      0xd9447e, 0x17a2b8, 0x343a40, 0xf8f9fa, 0x9c27b0
    ];

    const parts = {
      legs: { geo: new THREE.BoxGeometry(0.14, 0.6, 0.16), mat: pantsMat, items: [], colored: false },
      bodies: { geo: new THREE.BoxGeometry(0.45, 0.65, 0.32), mat: clothesMat, items: [], colored: true },
      heads: { geo: new THREE.SphereGeometry(0.2, 7, 7), mat: skinMat, items: [], colored: false },
      beanies: { geo: new THREE.SphereGeometry(0.21, 6, 6), mat: beanieMat, items: [], colored: false },
      arms: { geo: new THREE.CylinderGeometry(0.06, 0.06, 1, 4), mat: clothesMat, items: [], colored: true },
      marks: { geo: new THREE.CylinderGeometry(0.05, 0.03, 1, 4), mat: markMat, items: [], colored: false },
      dots: { geo: new THREE.SphereGeometry(0.05, 4, 4), mat: markMat, items: [], colored: false }
    };

    const personDummy = new THREE.Object3D();
    const partDummy = new THREE.Object3D();
    const worldMatrix = new THREE.Matrix4();
    const addPart = (key, personMatrix, phase, color, x, y, z, rx = 0, ry = 0, rz = 0, length = 1) => {
      partDummy.position.set(x, y, z);
      partDummy.rotation.set(rx, ry, rz);
      partDummy.scale.set(1, length, 1);
      partDummy.updateMatrix();
      worldMatrix.multiplyMatrices(personMatrix, partDummy.matrix);
      parts[key].items.push({ matrix: worldMatrix.clone(), phase, color });
    };

    const spectatorCount = 13;
    for (let i = 0; i < spectatorCount; i++) {
      const jacketColor = new THREE.Color(jacketColors[i % jacketColors.length]);
      const seed = i * 1.5;

      const px = sx(-28) + ((i + 0.5) / spectatorCount) * sx(56) + (Math.random() - 0.5) * sx(5.5);
      const pz = sz(17.2) + Math.random() * sz(4.4);

      personDummy.position.set(px, 0, pz);
      personDummy.rotation.set(0, Math.PI + (Math.random() - 0.5) * 0.4, 0);
      personDummy.updateMatrix();
      const personMatrix = personDummy.matrix.clone();

      addPart('legs', personMatrix, seed, null, -0.12, 0.3, 0);
      addPart('legs', personMatrix, seed, null, 0.12, 0.3, 0);
      addPart('bodies', personMatrix, seed, jacketColor, 0, 0.85, 0);
      addPart('heads', personMatrix, seed, null, 0, 1.32, 0);

      if (i % 3 === 0) {
        addPart('beanies', personMatrix, seed, null, 0, 1.4, 0);
      }

      const poseType = i % 4;
      if (poseType === 0) {
        addPart('arms', personMatrix, seed, jacketColor, -0.25, 1.15, 0, 0, 0, Math.PI / 1.3, 0.45);
        addPart('arms', personMatrix, seed, jacketColor, 0.25, 1.15, 0, 0, 0, -Math.PI / 1.3, 0.45);
      } else if (poseType === 1) {
        addPart('arms', personMatrix, seed, jacketColor, -0.15, 0.95, -0.3, -Math.PI / 2, 0, 0, 0.55);
        addPart('arms', personMatrix, seed, jacketColor, 0.25, 0.8, 0, 0, 0, 0, 0.45);
      } else if (poseType === 2) {
        addPart('arms', personMatrix, seed, jacketColor, -0.28, 1.2, 0, 0, 0, Math.PI / 1.8, 0.5);
        addPart('arms', personMatrix, seed, jacketColor, 0.28, 1.2, 0, 0, 0, -Math.PI / 1.8, 0.5);
      } else {
        addPart('arms', personMatrix, seed, jacketColor, 0.12, 1.1, -0.15, -Math.PI / 2.5, 0, -0.5, 0.45);
      }

      if (i % 2 === 0) {
        addPart('marks', personMatrix, seed, null, 0, 1.95, 0, 0, 0, 0, 0.35);
        addPart('dots', personMatrix, seed, null, 0, 1.68, 0);
      }
    }

    Object.values(parts).forEach((part) => {
      if (!part.items.length) return;
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, part.items.length);
      const phases = new Float32Array(part.items.length);

      part.items.forEach((item, i) => {
        mesh.setMatrixAt(i, item.matrix);
        phases[i] = item.phase;
        if (part.colored) mesh.setColorAt(i, item.color);
      });

      part.geo.setAttribute('aCrowdPhase', new THREE.InstancedBufferAttribute(phases, 1));
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);
    });
  }

  triggerCrowdReaction() {
    this.crowdShockTime = 0.8;
  }

  createParticleSystem() {
    this.maxParticles = 220;
    this.particleIndex = 0;

    const pGeo = new THREE.SphereGeometry(0.2, 5, 4);
    this.particleOpacity = new Float32Array(this.maxParticles);
    this.particleOpacityAttr = new THREE.InstancedBufferAttribute(this.particleOpacity, 1);
    this.particleOpacityAttr.setUsage(THREE.DynamicDrawUsage);
    pGeo.setAttribute('aOpacity', this.particleOpacityAttr);

    const pMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    pMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aOpacity;
varying float vParticleOpacity;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vParticleOpacity = aOpacity;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying float vParticleOpacity;`
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
gl_FragColor.a *= vParticleOpacity;`
        );
    };
    pMat.customProgramCacheKey = () => 'particle-alpha';

    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.castShadow = false;
    this.particleMesh.receiveShadow = false;

    this.particleDummy = new THREE.Object3D();
    this._particleColor = new THREE.Color();
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    this.particlePool = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleMesh.setMatrixAt(i, zeroMatrix);
      this.particleMesh.setColorAt(i, this._particleColor.setHex(0xffffff));
      this.particlePool.push({
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        baseScale: 1,
        x: 0,
        y: 0,
        z: 0
      });
    }
    this.particleMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.particleMesh);
  }

  emitParticle(x, y, z, vx, vy, vz, color = 0xffffff, size = 1, maxLife = 0.8) {
    const index = this.particleIndex;
    this.particleIndex = (this.particleIndex + 1) % this.maxParticles;
    const p = this.particlePool[index];

    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.baseScale = size;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = 0;
    p.maxLife = maxLife;
    this.particleOpacity[index] = 0.85;
    this.particleOpacityAttr.needsUpdate = true;

    this.particleMesh.setColorAt(index, this._particleColor.setHex(color));
    this.particleMesh.instanceColor.needsUpdate = true;
  }

  emitEngineWake(motorPos, forwardVector, speed, isReverse = false) {
    // Exact wake generated at the outboard motor location!
    // Streams strictly in the opposite direction of motion
    const streamX = isReverse ? forwardVector.x : -forwardVector.x;
    const streamZ = isReverse ? forwardVector.z : -forwardVector.z;
    const perpX = -streamZ; // lateral spreading vector
    const perpZ = streamX;

    const count = Math.min(3, Math.floor(Math.abs(speed) * 0.12) + 1);
    for (let i = 0; i < count; i++) {
      // V-shaped wake pattern
      const lateral = (i === 0 ? 0 : (i === 1 ? 0.38 : -0.38));
      const px = motorPos.x + streamX * 0.4 + perpX * lateral;
      const pz = motorPos.z + streamZ * 0.4 + perpZ * lateral;

      const spd = 0.6 + Math.random() * 0.7;
      const vx = streamX * spd + perpX * (lateral * 0.5);
      const vz = streamZ * spd + perpZ * (lateral * 0.5);

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

    // Water displacement and reed sway both run on the GPU now. The CPU only
    // uploads two scalar uniforms per frame instead of rewriting thousands of
    // vertex positions/normals and per-stalk transforms.
    this.reedsWind.value = this.time;

    const waterShader = this.waterMat.userData.shader;
    if (waterShader) {
      waterShader.uniforms.uTime.value = this.time;
    }

    if (this.crowdShockTime > 0) {
      this.crowdShockTime -= dt;
    }

    this.crowdTime.value = this.time;
    this.crowdShock.value =
      this.crowdShockTime > 0 ? Math.sin(this.crowdShockTime * 15) * 0.4 : 0;

    const dummy = this.particleDummy;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.particleOpacity[i] = 0;
        dummy.position.set(0, 0, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      p.vy -= 9.8 * dt;
      if (p.y < 0.04) {
        p.y = 0.04;
        p.vy = 0;
      }

      const progress = p.life / p.maxLife;
      this.particleOpacity[i] = (1 - progress) * 0.85;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.baseScale * (1 + progress * 0.9));
      dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, dummy.matrix);
    }

    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleOpacityAttr.needsUpdate = true;
  }
}
