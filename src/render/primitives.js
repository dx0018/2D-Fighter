import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const damp = (a, b, dt, s = 12) =>
  THREE.MathUtils.lerp(a, b, 1 - Math.exp(-dt * s));
export const ease = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const roundedGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.12);
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
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const originals = [];
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const key = [
      o.material.color?.getHexString(),
      o.material.roughness,
      o.material.metalness,
      o.material.emissive?.getHexString(),
      o.material.emissiveIntensity,
      o.material.map?.uuid || "",
      o.material.bumpMap?.uuid || "",
      o.material.transparent,
      o.material.opacity,
    ].join(":");
    if (!buckets.has(key))
      buckets.set(key, { mat: o.material, geos: [], shadow: o.castShadow });
    const geo = (
      o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    ).applyMatrix4(o.matrixWorld);
    buckets.get(key).geos.push(geo);
    originals.push(o);
  });
  const merged = new THREE.Group();
  for (const { mat, geos, shadow } of buckets.values()) {
    const geo = mergeGeometries(geos);
    if (geo) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      merged.add(m);
    }
    geos.forEach((g) => g.dispose());
  }
  const used = new Set([...buckets.values()].map((b) => b.mat));
  for (const o of originals) {
    if (![sphereGeo, boxGeo, roundedGeo].includes(o.geometry))
      o.geometry.dispose();
    if (!used.has(o.material)) o.material.dispose();
  }
  return merged;
}
export function disposeTree(root) {
  const geos = new Set(),
    mats = new Set(),
    textures = new Set();
  root?.traverse((o) => {
    if (o.geometry && ![sphereGeo, boxGeo, roundedGeo].includes(o.geometry))
      geos.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (m) {
        mats.add(m);
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
