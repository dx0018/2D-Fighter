import * as THREE from "three";
import { ball, noiseTexture } from "./primitives.js";
import { makeChain } from "./rig.js";

export function rig(type) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    head = new THREE.Group();
  root.add(body);
  body.add(head);
  head.position.y = type === "po" ? 2.1 : 2.21;
  return {
    type,
    root,
    body,
    head,
    baseHead: head.position.y,
    hipHeight: 0.82,
    bones: [],
    limbGeometries: [],
    arms: [],
    legs: [],
    eyes: [],
    pupils: [],
    materials: [],
  };
}
export function skin(m, color, plush = false) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: plush ? 0.76 : 0.43,
    metalness: 0,
    envMapIntensity: 0.65,
  });
  if (plush) {
    mat.bumpMap = noiseTexture();
    mat.bumpScale = 0.009;
  }
  m.materials.push(mat);
  return mat;
}
export function silhouette(object) {
  object.userData.silhouette = true;
  return object;
}
export function arms(m, material, handMat) {
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.55, m.type === "po" ? 1.49 : 1.56, 0],
      chain = makeChain(
        m,
        m.body,
        shoulder,
        0.52,
        0.48,
        m.type === "naruto" ? 0.125 : 0.155,
        material,
      );
    const hand = new THREE.Group();
    m.root.add(hand);
    silhouette(
      ball(
        hand,
        handMat,
        [0, 0, 0],
        m.type === "naruto"
          ? [0.18, 0.2, 0.18]
          : m.type === "po"
            ? [0.22, 0.24, 0.22]
            : [0.255, 0.24, 0.25],
      ),
    );
    if (m.type === "po")
      ball(hand, handMat, [-side * 0.16, -0.03, 0.06], [0.1, 0.13, 0.1]);
    m.arms.push({
      ...chain,
      hand,
      side,
      shoulder: new THREE.Vector3(...shoulder),
    });
  }
}
export function legs(m, material, shoeMat) {
  for (const side of [-1, 1]) {
    const chain = makeChain(
      m,
      m.root,
      [side * 0.29, 0.82, 0],
      0.43,
      0.42,
      0.18,
      material,
    );
    const foot = silhouette(
      ball(
        m.root,
        shoeMat,
        [side * 0.29, m.type === "naruto" ? 0.17 : 0.19, 0.13],
        m.type === "naruto"
          ? [0.28, 0.17, 0.36]
          : m.type === "po"
            ? [0.3, 0.2, 0.41]
            : [0.33, 0.19, 0.43],
      ),
    );
    m.legs.push({
      ...chain,
      foot,
      side,
      footHeight: m.type === "naruto" ? 0.17 : m.type === "po" ? 0.2 : 0.19,
    });
  }
}
