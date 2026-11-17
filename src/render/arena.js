import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeFighter, registerFighterModel } from "./fighters.js";
import { loadFighterModel } from "./model-loader.js";
import { animateFighter } from "./animation.js";
import { buildStage, makeObject } from "./stages.js";
import { CombatEffects } from "./effects.js";
import { ArenaCamera } from "./camera.js";
import { drawFallback } from "./fallback.js";
import { disposeTree, softShadow } from "./primitives.js";
import { bakeStaticShadows } from "./static-shadows.js";
import { RenderQuality } from "./quality.js";
import { localize } from "../i18n/index.js";
import { makeSupply } from "./arena-supplies.js";
export { registerFighterModel };
export class ArenaRenderer {
  constructor(container, { map, characters, onError, quality = "auto" } = {}) {
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
      const gl = this.renderer.getContext(),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      const software =
        debug &&
        /swiftshader|llvmpipe|software/i.test(
          gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
        );
      this.quality = new RenderQuality(quality, !!software);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.95;
      this.canvas = this.renderer.domElement;
      container.append(this.canvas);
      this.canvas.setAttribute("aria-label", "透视 2.5D 双人格斗场景");
      localize(this.canvas);
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
      this.staticShadows = bakeStaticShadows(
        this.renderer,
        this.scene,
        this.sun,
        map,
      );
      this.applyQuality();
      this.modelsReady = false;
      this.container.setAttribute("aria-busy","true");
      if(this.container.id==="home-arena"){
        this.loadingLabel=document.createElement("span");
        this.loadingLabel.className="model-loading";
        this.loadingLabel.textContent="正在准备角色模型";
        this.container.append(this.loadingLabel);localize(this.loadingLabel);
      }
      this.fighters = characters.map((c) => {
        const f = makeFighter(c);
        f.root.visible=false;
        this.scene.add(f.root);
        return f;
      });
      this.ready = Promise.all(
        characters.map(async (character, index) => {
          try {
            const loaded = await loadFighterModel(character);
            if (!loaded) return;
            if (this.disposed) {
              loaded.root.traverse((node) => node.skeleton?.dispose());
              disposeTree(loaded.root);
              return;
            }
            const previous = this.fighters[index];
            this.scene.remove(previous.root);
            previous.skeleton?.dispose();
            previous.root.traverse((node) => node.skeleton?.dispose());
            disposeTree(previous.root);
            loaded.root.visible=false;
            this.fighters[index] = loaded;
            this.scene.add(loaded.root);
            this.needsRender = true;
          } catch (error) {
            console.warn(`Using the built-in ${character.id} model:`, error);
          }
        }),
      ).then(()=>{
        if(this.disposed)return;
        this.modelsReady=true;
        this.loadingLabel?.remove();
        this.container.setAttribute("aria-busy","false");
        for(const f of this.fighters)f.root.visible=true;
        for(const s of this.shadows)s.visible=true;
        this.needsRender=true;
      });
      this.shadows = characters.map(() => {
        const s = softShadow();
        s.visible=false;
        this.scene.add(s);
        return s;
      });
      for (const data of map.objects) {
        const m = makeObject(data);
        this.objects.set(data.id, m);
        this.scene.add(m.root);
      }
      this.supplies=(map.supplies||[]).map(data=>{const item=makeSupply(data);this.scene.add(item.root);return item;});
      this.fx = new CombatEffects(this.scene);
    } catch (error) {
      this.renderer?.dispose();
      this.canvas?.remove();
      this.fallback = true;
      this.modelsReady = true;
      this.loadingLabel?.remove();
      this.container.setAttribute("aria-busy","false");
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
    this.needsRender = true;
  }
  applyQuality() {
    if (this.fallback || !this.quality) return;
    const p = this.quality.profile;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, p.pixelRatio));
    this.staticShadows?.setSamples(p.shadowSamples);
    this.sun.castShadow = p.shadows;
    if (this.sun.shadow.map && this.sun.shadow.map.width !== p.shadowSize) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.mapSize.set(p.shadowSize, p.shadowSize);
    this.needsRender = true;
  }
  setQuality(mode) {
    if (this.quality) {
      this.quality.setMode(mode);
      this.applyQuality();
      this.resize();
    }
  }
  sampleFrame(seconds) {
    if (this.quality?.sample(seconds)) {
      this.applyQuality();
      this.resize();
    }
  }
  update(state, dt = 1 / 60) {
    if (this.disposed || !state) return;
    if(this.modelsReady!==false)this.clock += dt;
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
    const half = this.cameraWidth / 2 + 5;
    this.sun.shadow.camera.left = -half;
    this.sun.shadow.camera.right = half;
    this.sun.shadow.camera.top = 15;
    this.sun.shadow.camera.bottom = -15;
    this.sun.shadow.camera.updateProjectionMatrix();
    state.fighters.forEach((f, i) => {
      animateFighter(this.fighters[i], f, dt, this.clock, i, state.hitstop, state.fighters[1 - i]);
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
    for(const [i,supply] of (state.supplies||[]).entries())this.supplies[i]?.update(supply,this.clock);
    this.stage.update(this.clock);
    this.fx.update(state, this.clock);
    this.renderer.render(this.scene, this.camera);
    this.needsRender = false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.fx?.dispose();
    this.staticShadows?.dispose();
    this.sun?.shadow.dispose();
    this.fighters?.forEach((f) => {
      f.skeleton?.dispose();
      f.root.traverse((node) => node.skeleton?.dispose());
    });
    disposeTree(this.scene);
    this.environment?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();
    this.loadingLabel?.remove();
  }
}
