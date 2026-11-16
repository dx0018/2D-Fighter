import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { makeChakraOrb, makeKuramaAura, setBijuuModel, attachBijuuModel } from "./ninja-effects.js";

const cache = new Map();
const assetBase = import.meta.env?.BASE_URL || "/";
const load = (url) => {
  if (!cache.has(url))
    cache.set(url, new GLTFLoader().loadAsync(url).catch((error) => {
      cache.delete(url);
      throw error;
    }));
  return cache.get(url);
};

const findBone = (root, names) => {
  let result = null;
  root.traverse((node) => {
    if (!result && node.isBone && names.includes(node.name)) result = node;
  });
  return result;
};

function addPoDetails(m) {
  const red = new THREE.MeshStandardMaterial({
    color: "#d92c4b",
    roughness: 0.82,
    metalness: 0.02,
  });
  const antennaHighlight = new THREE.MeshStandardMaterial({
    color: "#ff6b80",
    emissive: "#be294c",
    emissiveIntensity: 0.38,
    roughness: 0.42,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#253a50",
    roughness: 0.44,
    metalness: 0.12,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#8beaff",
    emissive: "#43c9f2",
    emissiveIntensity: 0.9,
    roughness: 0.38,
  });
  m.materials.push(red, dark, glass);
  const antenna = new THREE.Group();
  antenna.position.y = 0.34;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.048, 0.48, 10),
    red,
  );
  stem.position.y = 0.26;
  antenna.add(stem);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 24), antennaHighlight);
  coil.position.y = 0.55;
  antenna.add(coil);
  m.root.add(antenna);
  m.antenna = antenna;
  m.materials.push(antennaHighlight);

  const screen = new THREE.Group();
  const caseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.36, 0.06),
    dark,
  );
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.28),
    glass,
  );
  panel.position.z = 0.034;
  screen.add(caseMesh, panel);
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.018, 0.009),
      new THREE.MeshBasicMaterial({ color: i === 1 ? "#ffe796" : "#f5fff9" }),
    );
    line.position.set((i - 1) * 0.105, -0.09, 0.043);
    screen.add(line);
  }
  m.root.add(screen);
  m.screenGroup = screen;
  m.screen = glass;
  m.screenFacing = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI,
  );
}

function addDoraCannon(m) {
  const material = new THREE.MeshStandardMaterial({
    color: "#89b5c5",
    metalness: 0.58,
    roughness: 0.28,
    emissive: "#15566d",
    emissiveIntensity: 0.16,
  });
  const group = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.095, 0.48, 20),
    material,
  );
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.x = 0.19;
  group.add(barrel);
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.025, 7, 20),
    new THREE.MeshStandardMaterial({ color: "#d6f1f1", metalness: 0.65 }),
  );
  lip.rotation.y = Math.PI / 2;
  lip.position.x = 0.44;
  group.add(lip);
  group.visible = false;
  m.root.add(group);
  m.cannon = group;
  m.materials.push(material, lip.material);
}

/** Fetch and clone a local, licensed actor. A failure leaves the procedural actor live. */
export async function loadFighterModel(character) {
  if (!character.model?.src) return null;
  const gltf = await load(character.model.src);
  const actor = cloneSkeleton(gltf.scene);
  actor.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(actor, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.1)
    throw new Error(`Invalid fighter model: ${character.id}`);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = character.model.height / size.y;
  const m = {
    external: true,
    type: character.bodyStyle === "antenna" ? "po" : character.id,
    character,
    root: new THREE.Group(),
    visual: new THREE.Group(),
    model: actor,
    bones: {},
    materials: [],
    sharedAsset: true,
    clock: 0,
    baseYaw: 0,
    groundHeight: 0,
    actions: new Map(),
    currentAction: null,
    currentActionName: "",
    worldPosition: new THREE.Vector3(),
    target: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    axis: new THREE.Vector3(),
    joint: new THREE.Vector3(),
    end: new THREE.Vector3(),
    parentQuaternion: new THREE.Quaternion(),
    worldQuaternion: new THREE.Quaternion(),
    deltaQuaternion: new THREE.Quaternion(),
    mixer: new THREE.AnimationMixer(actor),
    animations: gltf.animations,
    frontAxis: character.model.frontAxis || 1,
  };
  m.root.add(m.visual);
  m.visual.add(actor);
  actor.scale.setScalar(scale);
  actor.position.set(
    -center.x * scale,
    -bounds.min.y * scale,
    -center.z * scale,
  );

  actor.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = false;
    node.frustumCulled = false;
    node.geometry.userData.sharedAsset = true;
    const original = Array.isArray(node.material)
      ? node.material
      : [node.material];
    const copy = original.map((base) => {
      const material = base.clone();
      material.userData.sharedTextures = true;
      if (character.model.rig === "teletubby") {
        const part = node.name.toLowerCase();
        material.color.set(part === "face" ? "#f4d2b3" : "#d42b4a");
        material.roughness = part === "face" ? 0.72 : 0.88;
        material.metalness = 0.01;
      }
      m.materials.push(material);
      return material;
    });
    node.material = Array.isArray(node.material) ? copy : copy[0];
  });

  if (character.model.rig === "mixamo") {
    for (const [key, names] of Object.entries({
      hips: ["mixamorigHips_01"],
      chest: ["mixamorigSpine2_04"],
      head: ["mixamorigHead_06"],
      leftUpper: ["mixamorigLeftArm_09"],
      leftLower: ["mixamorigLeftForeArm_010"],
      leftHand: ["mixamorigLeftHand_011"],
      rightUpper: ["mixamorigRightArm_033"],
      rightLower: ["mixamorigRightForeArm_034"],
      rightHand: ["mixamorigRightHand_035"],
      rootBone: ["_rootJoint"],
    })) m.bones[key] = findBone(actor, names);
    m.chest = m.bones.chest;
    m.head = m.bones.head;
    m.clips = {
      idle: "stand",
      walk: "walk",
      jump: "jumpDown",
      attack: "punch",
      victory: "waveHello",
    };
    m.rasengan = makeChakraOrb("rasengan");
    m.bijuu = makeChakraOrb("bijuu");
    m.kurama = makeKuramaAura();
    m.kurama.visible = false;
    try {
      const [fox, bomb] = await Promise.all([
        load(`${assetBase}models/kurama-user.glb`),
        load(`${assetBase}models/bijuu-user.glb`),
      ]);
      setBijuuModel(bomb.scene);
      attachBijuuModel(m.bijuu);
      const head = fox.scene.clone(true);
      head.position.set(0, 0.55, 0);
      head.scale.setScalar(1);
      head.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = false;
        node.receiveShadow = false;
        node.frustumCulled = false;
        node.renderOrder = 2;
        node.geometry.userData.sharedAsset = true;
        const originals = Array.isArray(node.material)
          ? node.material
          : [node.material];
        const materials = originals.map((base) => {
          const material = base.clone();
          material.userData.sharedTextures = true;
          material.transparent = true;
          material.depthWrite = true;
          material.opacity = 0.88;
          material.roughness = 0.92;
          material.metalness = 0;
          material.envMapIntensity = 0.35;
          // Recolor warm fur only; preserve dark markings and purple mouth details.
          material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              `#include <map_fragment>
              float furWarmth = smoothstep(0.008, 0.055, diffuseColor.r - diffuseColor.b);
              float furLight = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
              float furShade = clamp(sqrt(max(furLight, 0.0)) * 1.65 + 0.045, 0.0, 1.0);
              vec3 orangeFur = vec3(0.95, 0.255, 0.027) * furShade;
              diffuseColor.rgb = mix(diffuseColor.rgb, orangeFur, furWarmth * 0.9);`,
            );
          };
          material.customProgramCacheKey = () => "kurama-orange-fur-v1";
          m.kurama.userData.opacityTargets.push({
            material,
            opacity: material.opacity,
          });
          return material;
        });
        node.material = Array.isArray(node.material) ? materials : materials[0];
      });
      m.kurama.add(head);
      m.kurama.userData.headFallback.visible = false;
      m.kurama.userData.modelHead = head;
      m.kurama.userData.userModel = true;
      for (const tail of m.kurama.userData.tails) tail.visible = false;
    } catch (error) {
      console.warn("Using the built-in Kurama head:", error);
    }
    m.chakraCloak = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshBasicMaterial({
        color: "#e94dff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    m.chakraCloak.scale.set(0.64, 1.15, 0.38);
    m.chakraCloak.position.set(0, 1.55, 0);
    m.root.add(m.rasengan, m.bijuu, m.chakraCloak, m.kurama);
  } else if (character.model.rig === "teletubby") {
    for (const key of [
      "Pelvis",
      "Spine_001",
      "Spine_002",
      "Chest",
      "Head",
      "Upper_Arm_L",
      "Forearm_L",
      "Hand_L",
      "Upper_Arm_R",
      "Forearm_R",
      "Hand_R",
      "Thigh_L",
      "Shin_L",
      "Foot_L",
      "Thigh_R",
      "Shin_R",
      "Foot_R",
      "Root",
    ]) m.bones[key] = findBone(actor, [key]);
    m.hips = m.bones.Pelvis;
    m.chest = m.bones.Chest;
    m.head = m.bones.Head;
    m.clips = {
      idle: "Player_Idle",
      walk: "Player_Walk",
      jump: "Player_Jump",
      fall: "Player_Fall",
      crouch: "Player_Crouch",
    };
    addPoDetails(m);
  } else {
    for (const key of [
      "Hips",
      "Spine",
      "Chest",
      "Head",
      "UpperArm_L",
      "Forearm_L",
      "Hand_L",
      "UpperArm_R",
      "Forearm_R",
      "Hand_R",
      "Thigh_L",
      "Shin_L",
      "Foot_L",
      "Thigh_R",
      "Shin_R",
      "Foot_R",
    ]) m.bones[key] = findBone(actor, [key]);
    m.hips = m.bones.Hips;
    m.chest = m.bones.Chest;
    m.head = m.bones.Head;
    addDoraCannon(m);
  }

  for (const clip of gltf.animations) {
    if (clip.duration <= 0.015 || clip.name === "RESET") continue;
    const copy = clip.clone();
    // Keep authored locomotion while removing small baked root drift from
    // Naruto's Mixamo clips. Gameplay remains responsible for travel distance.
    for (const track of copy.tracks) {
      if (!track.name.endsWith(".position")) continue;
      const nodeName = track.name.slice(0, -".position".length);
      if (!nodeName.toLowerCase().includes("hips")) continue;
      const values = track.values;
      const stride = track.getValueSize();
      const firstX = values[0];
      const firstZ = values[2];
      for (let i = 0; i < values.length; i += stride) {
        values[i] = firstX;
        values[i + 2] = firstZ;
      }
    }
    const action = m.mixer.clipAction(copy);
    m.actions.set(clip.name, action);
  }
  m.root.userData.modelCredit = gltf.asset?.extras || null;
  m.visual.rotation.y = character.model.rig === "teletubby" ? Math.PI : 0;
  m.visual.userData.baseYaw = m.visual.rotation.y;

  if (character.model.rig === "mixamo") {
    for (const [key, named] of Object.entries(m.clips))
      if (!m.actions.has(named)) m.clips[key] = "stand";
  }
  if (character.model.rig === "teletubby") {
    for (const key of Object.keys(m.clips))
      if (!m.actions.has(m.clips[key])) delete m.clips[key];
  }
  return m;
}

