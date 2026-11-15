import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeFighter, registerFighterModel } from "./fighters.js";
import { animateFighter } from "./animation.js";
import { buildStage, makeObject } from "./stages.js";
import { CombatEffects } from "./effects.js";
import { ArenaCamera } from "./camera.js";
import { drawFallback } from "./fallback.js";
import { disposeTree, softShadow } from "./primitives.js";
export { registerFighterModel };
export class ArenaRenderer {
  constructor(container, { map, characters, onError } = {}) {
    this.container = container;
    this.map = map;
    this.characters = characters;
    this.clock = 0;
    this.objects = new Map();
    this.disposed = false;
    this.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.95;
      this.canvas = this.renderer.domElement;
      container.append(this.canvas);
      this.canvas.setAttribute("aria-label", "透视 2.5D 双人格斗场景");
      this.scene = new THREE.Scene();
      this.cameraRig = new ArenaCamera(map);
      this.camera = this.cameraRig.camera;
      // Studio reflections give curved surfaces readable highlights without flattening shadows.
      const pmrem = new THREE.PMREMGenerator(this.renderer),
        room = new RoomEnvironment();
      this.environment = pmrem.fromScene(room, 0.05);
      this.scene.environment = this.environment.texture;
      this.scene.environmentIntensity = map.theme === "moon" ? 0.2 : 0.28;
      room.dispose();
      pmrem.dispose();
      const night = map.theme === "moon",
        sunset = map.theme === "sunset";
      this.scene.add(
        new THREE.HemisphereLight(
          night ? "#91b8db" : "#d3eff8",
          night ? "#3f405e" : "#6b777a",
          night ? 0.55 : 0.75,
        ),
      );
      this.sun = new THREE.DirectionalLight(
        night ? "#a7ccf5" : sunset ? "#ffd1a0" : "#fff1d1",
        night ? 1.8 : 2.7,
      );
      this.sun.position.set(-12, 18, 10);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.left = -24;
      this.sun.shadow.camera.right = 24;
      this.sun.shadow.camera.top = 17;
      this.sun.shadow.camera.bottom = -17;
      this.sun.shadow.camera.far = 70;
      this.sun.shadow.normalBias = 0.025;
      this.sun.shadow.bias = -0.00015;
      this.sun.shadow.radius = 3;
      this.scene.add(this.sun, this.sun.target);
      const rim = new THREE.DirectionalLight(
        night ? "#d2b5fb" : "#b5efff",
        night ? 1.6 : 1.3,
      );
      rim.position.set(6, 8, -9);
      this.scene.add(rim);
      this.stage = buildStage(this.scene, map);
      this.fighters = characters.map((c) => {
        const f = makeFighter(c);
        this.scene.add(f.root);
        return f;
      });
      this.shadows = characters.map(() => {
        const s = softShadow();
        this.scene.add(s);
        return s;
      });
      for (const data of map.objects) {
        const m = makeObject(data);
        this.objects.set(data.id, m);
        this.scene.add(m.root);
      }
      this.fx = new CombatEffects(this.scene);
    } catch (error) {
      this.renderer?.dispose();
      this.canvas?.remove();
      this.fallback = true;
      this.canvas = document.createElement("canvas");
      container.append(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      onError?.(error);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  resize() {
    if (this.disposed) return;
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.aspect = this.width / this.height;
    if (this.fallback) {
      this.canvas.width = this.width * 1.5;
      this.canvas.height = this.height * 1.5;
    } else this.renderer.setSize(this.width, this.height, false);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
  }
  update(state, dt = 1 / 60) {
    if (this.disposed || !state) return;
    this.clock += dt;
    if (this.fallback) {
      drawFallback.call(this, state);
      return;
    }
    this.cameraRig.update(
      state.fighters,
      this.aspect,
      dt,
      this.reduceMotion ? 0 : state.shake,
      this.clock,
    );
    this.cameraCenter = this.cameraRig.center;
    this.cameraWidth = this.cameraRig.width;
    const d = this.cameraRig.distance;
    this.scene.fog.near = d + 30;
    this.scene.fog.far = d + 110;
    this.sun.position.x = this.cameraCenter - 12;
    this.sun.target.position.set(this.cameraCenter, 0, 0);
    state.fighters.forEach((f, i) => {
      animateFighter(this.fighters[i], f, dt, this.clock, i, state.hitstop);
      const s = this.shadows[i];
      s.position.x = f.x;
      const size = 1 + f.y * 0.09;
      s.scale.setScalar(size);
      s.material.opacity = 0.65 / (1 + f.y * 0.25);
    });
    for (const o of state.objects) {
      const m = this.objects.get(o.id);
      if (!m) continue;
      m.root.visible = !o.destroyed;
      m.shape.rotation.z = Math.sin(this.clock * 32) * (o.shake || 0) * 0.11;
      if (m.shape.userData.signPivot)
        m.shape.userData.signPivot.rotation.z =
          Math.sin(this.clock * 24) * (o.shake || 0) * 0.34;
      m.shape.scale.setScalar(1 + (o.flash > 0 ? 0.045 : 0));
    }
    this.stage.update(this.clock);
    this.fx.update(state, this.clock);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.fx?.dispose();
    disposeTree(this.scene);
    this.environment?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();
  }
}
