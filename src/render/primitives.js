import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { mergeScenery } from "./surface-batching.js";
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, dt, s = 12) =>
  THREE.MathUtils.lerp(a, b, 1 - Math.exp(-dt * s));
export const ease = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const roundedGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.12);
const stageRoundedGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
export function surface(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.64,
    metalness: 0,
    ...extra,
  });
}
export function mesh(g, geo, mat, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, typeof mat === "string" ? surface(mat) : mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
export const ball = (g, mat, p, s) => mesh(g, sphereGeo, mat, p, s);
export const box = (g, mat, p, s) => mesh(g, boxGeo, mat, p, s);
export const roundBox = (g, mat, p, s) => mesh(g, roundedGeo, mat, p, s);
// Scenery bevels occupy only a few pixels. Keep the extra segments on fighters.
export const stageRoundBox = (g, mat, p, s) =>
  mesh(g, stageRoundedGeo, mat, p, s);
export const tube = (g, mat, p, top, bottom, height, n = 16) =>
  mesh(g, new THREE.CylinderGeometry(top, bottom, height, n), mat, p);
export function curve(g, mat, points, r = 0.015) {
  return mesh(
    g,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      24,
      r,
      6,
      false,
    ),
    mat,
  );
}
export function ring(g, mat, radius, thickness, p) {
  return mesh(g, new THREE.TorusGeometry(radius, thickness, 10, 56), mat, p);
}
export function label(
  text,
  {
    background = "#1c4b58",
    ink = "#fff1c9",
    width = 768,
    height = 256,
    subtext = "",
  } = {},
) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const x = c.getContext("2d");
  x.fillStyle = background;
  x.fillRect(0, 0, width, height);
  x.strokeStyle = ink;
  x.lineWidth = 3;
  x.strokeRect(12, 12, width - 24, height - 24);
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = ink;
  x.font = `800 ${subtext ? height * 0.36 : height * 0.43}px sans-serif`;
  x.fillText(text, width / 2, height * (subtext ? 0.42 : 0.52), width * 0.9);
  if (subtext) {
    x.font = `${height * 0.11}px sans-serif`;
    x.fillText(subtext, width / 2, height * 0.78, width * 0.85);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function sign(g, text, p, size, options = {}) {
  return roundBox(
    g,
    surface("#ffffff", { map: label(text, options), roughness: 0.6 }),
    p,
    size,
  );
}
export function noiseTexture(seed = 17) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    image = x.createImageData(128, 128);
  let n = seed;
  for (let i = 0; i < image.data.length; i += 4) {
    n = (n * 1664525 + 1013904223) >>> 0;
    const v = 115 + (n % 36);
    image.data.set([v, v, v, 255], i);
  }
  x.putImageData(image, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 5);
  return t;
}
// Static scenery is merged by material, keeping rich stages affordable to render.
export function batchStatic(group) {
  return mergeScenery(group, [sphereGeo, boxGeo, roundedGeo, stageRoundedGeo]);
}
export function disposeTree(root) {
  const geos = new Set(),
    mats = new Set(),
    textures = new Set();
  root?.traverse((o) => {
    if (
      o.geometry &&
      !o.geometry.userData.sharedAsset &&
      ![sphereGeo, boxGeo, roundedGeo, stageRoundedGeo].includes(o.geometry)
    )
      geos.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (m) {
        mats.add(m);
        if (!m.userData?.sharedTextures)
          for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      }
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
export function softShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    grad = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(17,29,38,.55)");
  grad.addColorStop(0.4, "rgba(17,29,38,.28)");
  grad.addColorStop(1, "rgba(17,29,38,0)");
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 2.25),
    new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.035;
  return m;
}

// Merge only rigid decoration inside a single attachment; animated nodes stay separate.
export function batchRigid(group, excluded = []) {
  group.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert(),
    parts = new Map(),
    originals = [];
  function visit(node) {
    if (excluded.includes(node)) return;
    if (node.isMesh && !node.isSkinnedMesh && !Array.isArray(node.material)) {
      const mat = node.material,
        key = [
          mat.type,
          mat.color?.getHexString(),
          mat.roughness,
          mat.metalness,
          mat.emissive?.getHexString(),
          mat.emissiveIntensity,
          mat.map?.uuid,
          mat.bumpMap?.uuid,
          !!node.userData.silhouette,
        ].join(":");
      if (!parts.has(key))
        parts.set(key, {
          material: mat,
          geos: [],
          shadow: !!node.userData.silhouette,
        });
      const geo = (
        node.geometry.index
          ? node.geometry.toNonIndexed()
          : node.geometry.clone()
      ).applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld),
      );
      parts.get(key).geos.push(geo);
      originals.push(node);
    } else for (const child of [...node.children]) visit(child);
  }
  for (const child of [...group.children]) visit(child);
  for (const { material, geos, shadow } of parts.values()) {
    const geometry = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (geometry) {
      const m = new THREE.Mesh(geometry, material);
      m.castShadow = shadow;
      m.userData.silhouette = shadow;
      m.receiveShadow = false;
      group.add(m);
    }
  }
  for (const node of originals) {
    node.removeFromParent();
    if (
      ![sphereGeo, boxGeo, roundedGeo, stageRoundedGeo].includes(node.geometry)
    )
      node.geometry.dispose();
  }
}
