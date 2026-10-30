import * as THREE from 'three';

export class GameRenderer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dc0ea);
    this.scene.fog = new THREE.FogExp2(0x7dc0ea, 0.007);

    this.initRenderer();
    this.initCamera();
    this.initLights();

    window.addEventListener('resize', () => this.onResize());
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);
  }

  initCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.frustumSize = 42; // controls zoom level

    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      500
    );

    // Isometric angle: 45 degrees pitch, slight yaw so we see 3D boat profile clearly
    // top is -Z (north bank), bottom is +Z (south bank)
    this.camera.position.set(16, 42, 26);
    this.camera.lookAt(0, 0, 0);

    // Screen shake variables
    this.shakeIntensity = 0;
    this.shakeDecay = 0.9;
    this.baseCameraPos = this.camera.position.clone();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xdff1ff, 0.7);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff7e6, 0x3d7068, 0.4);
    this.scene.add(hemiLight);

    this.sun = new THREE.DirectionalLight(0xfffaf0, 1.4);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 120;

    const d = 35;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.bias = -0.0005;

    this.scene.add(this.sun);
  }

  triggerScreenShake(intensity = 0.5) {
    this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 1.2);
  }

  onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = (-this.frustumSize * aspect) / 2;
    this.camera.right = (this.frustumSize * aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(dt) {
    if (this.shakeIntensity > 0.005) {
      const offsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const offsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const offsetZ = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.camera.position.set(
        this.baseCameraPos.x + offsetX,
        this.baseCameraPos.y + offsetY,
        this.baseCameraPos.z + offsetZ
      );
      this.shakeIntensity *= Math.pow(this.shakeDecay, dt * 60);
    } else {
      this.camera.position.copy(this.baseCameraPos);
      this.shakeIntensity = 0;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
