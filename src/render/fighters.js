import * as THREE from "three";
import {
  ball,
  roundBox,
  mesh,
  tube,
  curve,
  ring,
  surface,
  batchRigid,
} from "./primitives.js";
import { bindLimbs } from "./rig.js";

import { rig, skin, silhouette, arms, legs } from "./fighter-rig.js";
import { naruto } from "./naruto.js";

function facePatch(g, mat, rx, ry, cy, depth) {
  const positions = [0, cy, depth(0, cy)],
    uv = [0.5, 0.5],
    indices = [],
    rows = 14,
    sides = 40;
  for (let row = 1; row <= rows; row++)
    for (let col = 0; col < sides; col++) {
      const t = (col / sides) * Math.PI * 2,
        r = row / rows,
        x = rx * r * Math.cos(t),
        y = cy + ry * r * Math.sin(t);
      positions.push(x, y, depth(x, y));
      uv.push((x / rx) * 0.5 + 0.5, ((y - cy) / ry) * 0.5 + 0.5);
    }
  for (let col = 0; col < sides; col++)
    indices.push(0, 1 + col, 1 + ((col + 1) % sides));
  for (let row = 0; row < rows - 1; row++)
    for (let col = 0; col < sides; col++) {
      const a = 1 + row * sides + col,
        b = 1 + row * sides + ((col + 1) % sides),
        c = a + sides,
        d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return mesh(g, geo, mat);
}
const torsoProfile = [
  [0.6, 0.02],
  [0.72, 0.46],
  [0.94, 0.63],
  [1.18, 0.64],
  [1.44, 0.57],
  [1.65, 0.39],
  [1.78, 0.02],
];
function bodyRadius(y) {
  let i = 0;
  while (i < torsoProfile.length - 2 && y > torsoProfile[i + 1][0]) i++;
  const [a, ra] = torsoProfile[i],
    [b, rb] = torsoProfile[i + 1],
    t = THREE.MathUtils.clamp((y - a) / (b - a), 0, 1),
    p = torsoProfile[Math.max(0, i - 1)],
    q = torsoProfile[Math.min(torsoProfile.length - 1, i + 2)],
    ma = (rb - p[1]) / (b - p[0]),
    mb = (q[1] - ra) / (q[0] - a);
  return Math.max(
    0.005,
    (2 * t * t * t - 3 * t * t + 1) * ra +
      (t * t * t - 2 * t * t + t) * (b - a) * ma +
      (-2 * t * t * t + 3 * t * t) * rb +
      (t * t * t - t * t) * (b - a) * mb,
  );
}
const bellyZ = (x, y) =>
  Math.sqrt(Math.max(0.002, bodyRadius(y) ** 2 - x * x)) + 0.009;
function torso(m, mat) {
  const points = Array.from({ length: 49 }, (_, i) => {
    const y = 0.6 + (i / 48) * 1.18;
    return new THREE.Vector2(bodyRadius(y), y);
  });
  silhouette(mesh(m.body, new THREE.LatheGeometry(points, 40), mat));
}
function eye(m, side, { x = 0.19, y = 0.28, z = 0.74, white = true } = {}) {
  const g = new THREE.Group();
  g.position.set(side * x, y, z);
  m.head.add(g);
  if (white)
    ball(
      g,
      surface("#fffdf6", { roughness: 0.45 }),
      [0, 0, 0],
      [0.198, 0.255, 0.105],
    );
  const pupil = ball(
    g,
    surface("#172933", { roughness: 0.34 }),
    [white ? -side * 0.035 : 0, 0, white ? 0.098 : 0.025],
    white ? [0.057, 0.083, 0.024] : [0.039, 0.058, 0.023],
  );
  ball(pupil, surface("#ffffff"), [-0.25, 0.3, 0.85], [0.24, 0.24, 0.1]);
  m.eyes.push(g);
  m.pupils.push(pupil);
}
function doraemon() {
  const m = rig("doraemon"),
    blue = skin(m, "#048fd0"),
    white = skin(m, "#f5f7f1"),
    red = skin(m, "#e74349"),
    ink = surface("#263c49", { roughness: 0.8 }),
    gold = surface("#edb531", { metalness: 0.62, roughness: 0.3 });
  m.materials.push(gold);
  torso(m, blue);
  facePatch(m.body, white, 0.5, 0.44, 1.16, bellyZ);
  const seam = [
    [-0.29, 1.17],
    [-0.23, 0.99],
    [0, 0.9],
    [0.23, 0.99],
    [0.29, 1.17],
  ].map(([x, y]) => [x, y, bellyZ(x, y) + 0.014]);
  curve(m.body, surface("#bad1d4"), seam, 0.007);
  curve(
    m.body,
    white,
    [
      [-0.29, 1.18],
      [0, 1.18],
      [0.29, 1.18],
    ].map(([x, y]) => [x, y, bellyZ(x, y) + 0.018]),
    0.018,
  );
  const collar = ring(m.body, red, 0.4, 0.054, [0, 1.58, 0]);
  collar.rotation.x = Math.PI / 2;
  collar.scale.x = 1.12;
  curve(
    m.body,
    red,
    [
      [-0.44, 1.56, 0.3],
      [0, 1.53, 0.57],
      [0.44, 1.56, 0.3],
    ],
    0.045,
  );
  m.bell = ball(m.body, gold, [0, 1.46, 0.64], [0.124, 0.13, 0.12]);
  curve(
    m.body,
    surface("#92642b"),
    [
      [-0.09, 1.49, 0.735],
      [0, 1.49, 0.766],
      [0.09, 1.49, 0.735],
    ],
    0.007,
  );
  ball(m.body, ink, [0, 1.42, 0.76], [0.022, 0.022, 0.01]);
  curve(
    m.body,
    ink,
    [
      [0, 1.42, 0.762],
      [0, 1.35, 0.73],
    ],
    0.006,
  );
  const headGeo = new THREE.SphereGeometry(1, 32, 24);
  silhouette(mesh(m.head, headGeo, blue, [0, 0, 0], [0.92, 0.85, 0.8]));
  const faceZ = (x, y) =>
    0.8 * Math.sqrt(Math.max(0.015, 1 - (x / 0.92) ** 2 - (y / 0.85) ** 2)) +
    0.007;
  facePatch(m.head, white, 0.77, 0.66, -0.09, faceZ);
  for (const side of [-1, 1]) {
    eye(m, side);
    for (let i = 0; i < 3; i++) {
      const points = [
        [side * 0.3, -0.11 - i * 0.105],
        [side * 0.46, -0.11 - i * 0.14],
        [side * 0.66, -0.08 - i * 0.18],
      ].map(([x, y]) => [x, y, faceZ(x, y) + 0.014]);
      curve(m.head, ink, points, 0.008);
    }
  }
  ball(m.head, red, [0, 0.035, 0.849], [0.12, 0.11, 0.105]);
  curve(
    m.head,
    ink,
    [
      [0, -0.075],
      [0, -0.3],
    ].map(([x, y]) => [x, y, faceZ(x, y) + 0.012]),
    0.008,
  );
  m.smile = curve(
    m.head,
    ink,
    [
      [-0.43, -0.25],
      [-0.25, -0.42],
      [0, -0.49],
      [0.25, -0.42],
      [0.43, -0.25],
    ].map(([x, y]) => [x, y, faceZ(x, y) + 0.012]),
    0.011,
  );
  m.mouth = ball(
    m.head,
    surface("#6d2b38"),
    [0, -0.36, faceZ(0, -0.36) + 0.018],
    [0.22, 0.12, 0.022],
  );
  ball(m.mouth, surface("#eb9295"), [0, -0.35, 0.8], [0.65, 0.36, 0.23]);
  m.mouth.visible = false;
  arms(m, blue, white);
  legs(m, blue, white);
  ball(m.body, red, [0, 0.9, -0.57], [0.12, 0.12, 0.12]);
  m.cannon = new THREE.Group();
  m.arms[1].hand.add(m.cannon);
  const steel = surface("#8bb2c2", { metalness: 0.5, roughness: 0.35 }),
    rim = surface("#cbe4e8", { metalness: 0.55, roughness: 0.3 });
  const barrel = tube(m.cannon, steel, [0.14, 0, 0], 0.22, 0.18, 0.56, 20);
  barrel.rotation.z = -Math.PI / 2;
  const lip = ring(m.cannon, rim, 0.22, 0.032, [0.43, 0, 0]);
  lip.rotation.y = Math.PI / 2;
  const hole = tube(
    m.cannon,
    surface("#16455b", { emissive: "#137a9a", emissiveIntensity: 0.3 }),
    [0.435, 0, 0],
    0.18,
    0.18,
    0.016,
    20,
  );
  hole.rotation.z = -Math.PI / 2;
  m.cannon.visible = false;
  return m;
}
function po() {
  const m = rig("po"),
    red = skin(m, "#d83150", true),
    face = skin(m, "#edc7a5"),
    inner = surface("#ae2845");
  torso(m, red);
  roundBox(m.body, surface("#eaa2a7"), [0, 1.19, 0.6], [0.79, 0.68, 0.14]);
  roundBox(
    m.body,
    surface("#718e99", { metalness: 0.4, roughness: 0.4 }),
    [0, 1.19, 0.68],
    [0.68, 0.57, 0.055],
  );
  m.screen = roundBox(
    m.body,
    surface("#a4dde5", {
      metalness: 0.16,
      roughness: 0.3,
      emissive: "#65bbd3",
      emissiveIntensity: 0.14,
    }),
    [0, 1.19, 0.715],
    [0.58, 0.47, 0.025],
  );
  m.materials.push(m.screen.material);
  curve(
    m.body,
    surface("#e0fbf5", { emissive: "#8ddcdb", emissiveIntensity: 0.35 }),
    [
      [-0.22, 1.18, 0.735],
      [-0.11, 1.18, 0.735],
      [-0.04, 1.28, 0.735],
      [0.04, 1.08, 0.735],
      [0.1, 1.18, 0.735],
      [0.22, 1.18, 0.735],
    ],
    0.008,
  );
  silhouette(
    mesh(
      m.head,
      new THREE.SphereGeometry(1, 32, 22),
      red,
      [0, 0, 0],
      [0.76, 0.7, 0.61],
    ),
  );
  const front = (x, y) =>
    0.61 * Math.sqrt(Math.max(0.02, 1 - (x / 0.76) ** 2 - (y / 0.7) ** 2)) +
    0.01;
  facePatch(m.head, face, 0.555, 0.49, -0.025, front);
  for (const side of [-1, 1]) {
    ball(m.head, red, [side * 0.73, 0.07, -0.01], [0.225, 0.21, 0.175]);
    ball(m.head, inner, [side * 0.77, 0.07, 0.14], [0.115, 0.13, 0.027]);
    eye(m, side, { x: 0.18, y: 0.075, z: front(0.18, 0.075), white: false });
    curve(
      m.head,
      surface("#805c52"),
      [
        [side * 0.1, 0.22],
        [side * 0.18, 0.24],
        [side * 0.26, 0.215],
      ].map(([x, y]) => [x, y, front(x, y) + 0.009]),
      0.01,
    );
    ball(
      m.head,
      surface("#dfa298"),
      [side * 0.33, -0.14, front(0.33, -0.14) + 0.01],
      [0.075, 0.034, 0.012],
    );
  }
  ball(m.head, face, [0, -0.07, front(0, -0.07) + 0.028], [0.07, 0.068, 0.057]);
  m.smile = curve(
    m.head,
    surface("#9b6055"),
    [
      [-0.2, -0.21],
      [-0.1, -0.27],
      [0, -0.29],
      [0.1, -0.27],
      [0.2, -0.21],
    ].map(([x, y]) => [x, y, front(x, y) + 0.014]),
    0.011,
  );
  m.mouth = ball(
    m.head,
    surface("#783548"),
    [0, -0.23, front(0, -0.23) + 0.015],
    [0.17, 0.105, 0.018],
  );
  ball(m.mouth, surface("#f1ada9"), [0, -0.35, 0.8], [0.65, 0.36, 0.23]);
  m.mouth.visible = false;
  m.antenna = new THREE.Group();
  m.antenna.position.set(0, 0.61, 0);
  m.head.add(m.antenna);
  curve(
    m.antenna,
    red,
    [
      [0, 0, 0],
      [0, 0.2, 0],
      [0.025, 0.35, 0],
    ],
    0.055,
  );
  ring(m.antenna, red, 0.16, 0.05, [0.025, 0.49, 0]);
  arms(m, red, red);
  legs(m, red, red);
  return m;
}
const builders = new Map([
  ["robot-cat", doraemon],
  ["antenna", po],
  ["ninja", naruto],
  ["ninja", naruto],
]);
export const registerFighterModel = (style, builder) =>
  builders.set(style, builder);
export function makeFighter(character) {
  const m = (builders.get(character.bodyStyle) || doraemon)(character);
  if (!m.bones) return m;
  bindLimbs(m);
  batchRigid(
    m.head,
    [...m.eyes, m.smile, m.mouth, m.antenna, m.headbandTies].filter(Boolean),
  );
  batchRigid(m.body, [m.head]);
  for (const arm of m.arms)
    batchRigid(arm.hand, [m.cannon, m.rasengan].filter(Boolean));
  m.root.traverse((o) => {
    if (o.isMesh && !o.isSkinnedMesh) {
      o.castShadow = !!o.userData.silhouette;
      o.receiveShadow = false;
    }
  });
  m.bodyInverse = new THREE.Matrix4();
  m.vector = new THREE.Vector3();
  m.target = new THREE.Vector3();
  m.pole = new THREE.Vector3();
  return m;
}
