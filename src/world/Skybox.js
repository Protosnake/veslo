import * as THREE from 'three';
import { CLOUD_TUNING, SUN_TUNING } from '../config/world.js';

const VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform float uTime;
uniform float uCoverage;
uniform float uScale;
uniform vec3 uSunDir;
uniform float uSunGlow;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 horizon = vec3(0.557, 0.655, 0.678);   // matches scene fog / background (0x8ea7ad)
  vec3 zenith = vec3(0.27, 0.35, 0.42);
  vec3 col = mix(horizon, zenith, pow(h, 0.55));

  // Project onto a flat cloud layer so clouds shrink toward the horizon.
  vec2 uv = d.xz / (h + 0.04) * 0.3 * uScale + vec2(uTime, uTime * 0.4);
  float n = fbm(uv);
  float density = smoothstep(1.0 - uCoverage, 1.0 - uCoverage + 0.28, n);
  // Cheap lighting: sample toward the sun; thicker = greyer underside.
  float shade = fbm(uv + vec2(0.06, 0.04));
  float dark = clamp((shade - n) * 4.0 + 0.45, 0.0, 1.0) * density;
  vec3 cloud = mix(vec3(0.82, 0.86, 0.87), vec3(0.34, 0.39, 0.44), dark);
  // Fade clouds into the haze at the horizon.
  float fade = smoothstep(0.0, 0.09, d.y);
  col = mix(col, cloud, density * fade * 0.96);
  // Sun: soft glow plus a pale disc, mostly veiled by cloud cover.
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float veil = 1.0 - density * 0.85;
  vec3 sunCol = vec3(1.0, 0.93, 0.78);
  col += sunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.35) * uSunGlow * (0.45 + 0.55 * veil);
  col += sunCol * smoothstep(0.9993, 0.9998, sd) * uSunGlow * veil;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Procedural sky dome (gradient + drifting clouds) that follows the camera. */
export class Skybox {
  constructor(scene) {
    this.uniforms = {
      uTime: { value: 0 },
      uCoverage: { value: CLOUD_TUNING.coverage },
      uScale: { value: CLOUD_TUNING.scale },
      uSunDir: { value: new THREE.Vector3(30, 50, 20).normalize() },
      uSunGlow: { value: SUN_TUNING.glow }
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), material);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update(dt, camera, sunDir) {
    if (sunDir) this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uTime.value += dt * CLOUD_TUNING.speed;
    this.mesh.position.copy(camera.position);

  }
}
