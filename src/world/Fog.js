import * as THREE from 'three';
import { FOG_TUNING, CLOUD_SHADOW_TUNING } from '../config/world.js';

/**
 * Height-layered exponential fog: thick ground mist hugging the water that
 * thins out toward treetops and sky. Patches the global fog shader chunks so
 * every fogged material gets it.
 */
THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWp;
#endif`;

THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vec4 fogWp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    fogWp = instanceMatrix * fogWp;
  #endif
  vFogWp = ( modelMatrix * fogWp ).xyz;
#endif`;

THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWp;
  uniform float uCloudT;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  float csHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float csNoise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( csHash( i ), csHash( i + vec2( 1.0, 0.0 ) ), f.x ),
                mix( csHash( i + vec2( 0.0, 1.0 ) ), csHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
  }
#endif`;

const f = (n) => n.toFixed(4);
THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogLayer = mix( ${f(FOG_TUNING.highFactor)}, ${f(FOG_TUNING.groundBoost)},
      exp( - max( vFogWp.y, 0.0 ) * ${f(FOG_TUNING.heightFalloff)} ) );
    float fogD = fogDensity * fogLayer * vFogDepth;
    float fogFactor = 1.0 - exp( - fogD * fogD );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  #ifdef FOG_EXP2
    vec2 csP = vFogWp.xz * ${f(CLOUD_SHADOW_TUNING.scale)} + vec2( uCloudT, uCloudT * 0.4 );
    float csN = csNoise( csP ) * 0.65 + csNoise( csP * 2.3 + 7.1 ) * 0.35;
    gl_FragColor.rgb *= 1.0 - smoothstep( 0.38, 0.6, csN ) * ${f(CLOUD_SHADOW_TUNING.strength)};
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;

/** Shared cloud-shadow clock; advance with `cloudShadowTime.value += dt * speed`. */
export const cloudShadowTime = { value: 0 };
export const CLOUD_SHADOW_SPEED = CLOUD_SHADOW_TUNING.speed;

// Every material gets the shared uCloudT uniform, including ones that set their
// own onBeforeCompile (wrapped so their program cache key is unchanged).
const proto = THREE.Material.prototype;
const addUniform = (shader) => { shader.uniforms.uCloudT = cloudShadowTime; };
Object.defineProperty(proto, 'onBeforeCompile', {
  configurable: true,
  get() { return this._obc || addUniform; },
  set(fn) {
    const w = function (shader, renderer) { addUniform(shader); return fn.call(this, shader, renderer); };
    w.toString = () => fn.toString();
    this._obc = w;
  }
});
