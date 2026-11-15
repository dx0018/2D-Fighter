import * as THREE from "three";
import {
  ball,
  roundBox,
  mesh,
  tube,
  curve,
  ring,
  surface,
  noiseTexture,
} from "./primitives.js";
function rig(type) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    head = new THREE.Group();
  root.add(body);
  head.position.set(0, 2.1, 0);
  body.add(head);
  return {
    type,
    root,
    body,
    head,
    arms: [],
    legs: [],
    eyes: [],
    pupils: [],
    materials: [],
    baseHead: 2.1,
  };
}
function skin(model, color, plush = false) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: plush ? 0.83 : 0.3,
    metalness: 0,
    clearcoat: plush ? 0 : 0.4,
    clearcoatRoughness: 0.28,
    sheen: plush ? 0.8 : 0,
    sheenColor: new THREE.Color(plush ? "#ff9b9a" : "#ffffff"),
    sheenRoughness: 0.8,
  });
  if (plush) {
    m.bumpMap = noiseTexture();
    m.bumpScale = 0.018;
  }
  model.materials.push(m);
  return m;
}
function limb(g, mat, handMat, side, shoulder, plush) {
  const joint = ball(g, mat, shoulder, [0.205, 0.205, 0.205]);
  const upper = mesh(
    g,
    new THREE.CapsuleGeometry(plush ? 0.17 : 0.19, 0.35, 5, 16),
    mat,
  );
  const lower = mesh(
    g,
    new THREE.CapsuleGeometry(plush ? 0.18 : 0.2, 0.27, 5, 16),
    mat,
  );
  const hand = new THREE.Group();
  g.add(hand);
  ball(
    hand,
    handMat,
    [0, 0, 0],
    plush ? [0.24, 0.26, 0.23] : [0.285, 0.27, 0.28],
  );
  if (plush) {
    ball(hand, handMat, [-side * 0.19, -0.03, 0.07], [0.11, 0.17, 0.13]);
    curve(
      hand,
      surface("#b7294d"),
      [
        [-0.1, -0.13, 0.2],
        [0.02, -0.15, 0.22],
        [0.13, -0.11, 0.19],
      ],
      0.006,
    );
  }
  return {
    joint,
    upper,
    lower,
    hand,
    shoulder: new THREE.Vector3(...shoulder),
    side,
  };
}
function legs(model, mat, shoeMat, plush) {
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.position.set(side * 0.37, 0.57, 0);
    model.body.add(group);
    const leg = ball(
      group,
      mat,
      [0, -0.12, 0],
      [plush ? 0.26 : 0.25, 0.33, 0.28],
    );
    const foot = ball(
      group,
      shoeMat,
      [side * 0.035, -0.38, 0.17],
      plush ? [0.33, 0.21, 0.47] : [0.4, 0.2, 0.49],
    );
    model.legs.push({ group, leg, foot, side });
  }
}
function eye(model, side, { x = 0.22, y = 0.26, z = 0.7, white = true } = {}) {
  const g = new THREE.Group();
  g.position.set(side * x, y, z);
  model.head.add(g);
  if (white)
    ball(
      g,
      surface("#fffef6", { roughness: 0.23 }),
      [0, 0, 0],
      [0.225, 0.295, 0.145],
    );
  const pupil = ball(
    g,
    surface("#12242e", { roughness: 0.15 }),
    [-side * 0.045, 0, 0.14],
    white ? [0.068, 0.105, 0.026] : [0.045, 0.065, 0.027],
  );
  ball(pupil, surface("#ffffff"), [-0.32, 0.35, 0.85], [0.26, 0.26, 0.1]);
  model.eyes.push(g);
  model.pupils.push(pupil);
  return g;
}
function doraemon() {
  const m = rig("doraemon"),
    blue = skin(m, "#058bd6"),
    white = skin(m, "#f4faf6"),
    red = skin(m, "#ec3c4d"),
    dark = surface("#263b48", { roughness: 0.8 }),
    gold = new THREE.MeshPhysicalMaterial({
      color: "#ffbf34",
      metalness: 0.6,
      roughness: 0.26,
      clearcoat: 0.3,
    });
  m.materials.push(gold);
  // Pear-shaped torso and integrated face volumes avoid the stacked-ball silhouette.
  const profile = [
    [0.08, 0.25],
    [0.43, 0.26],
    [0.63, 0.5],
    [0.72, 0.88],
    [0.66, 1.2],
    [0.52, 1.55],
    [0.3, 1.7],
    [0.01, 1.72],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(m.body, new THREE.LatheGeometry(profile, 48), blue);
  ball(m.body, white, [0, 1.01, 0.64], [0.55, 0.58, 0.2]);
  const pocketShape = new THREE.Shape();
  pocketShape.moveTo(-0.34, 0);
  pocketShape.lineTo(0.34, 0);
  pocketShape.absarc(0, 0, 0.34, 0, -Math.PI, true);
  const pocket = mesh(
    m.body,
    new THREE.ShapeGeometry(pocketShape, 36),
    white,
    [0, 1.08, 0.863],
  );
  pocket.rotation.x = -0.02;
  curve(
    m.body,
    surface("#b5d3d9"),
    [
      [-0.34, 1.08, 0.865],
      [-0.27, 0.88, 0.865],
      [0, 0.76, 0.865],
      [0.27, 0.88, 0.865],
      [0.34, 1.08, 0.865],
    ],
    0.009,
  );
  curve(
    m.body,
    white,
    [
      [-0.35, 1.09, 0.875],
      [0, 1.09, 0.88],
      [0.35, 1.09, 0.875],
    ],
    0.025,
  );
  const collar = ring(m.body, red, 0.48, 0.065, [0, 1.46, 0]);
  collar.rotation.x = Math.PI / 2;
  collar.scale.x = 1.14;
  curve(
    m.body,
    red,
    [
      [-0.48, 1.48, 0.52],
      [0, 1.45, 0.76],
      [0.48, 1.48, 0.52],
    ],
    0.055,
  );
  const bell = ball(m.body, gold, [0, 1.39, 0.78], [0.14, 0.15, 0.13]);
  const band = ring(m.body, gold, 0.14, 0.013, [0, 1.4, 0.78]);
  band.rotation.x = Math.PI / 2;
  curve(
    m.body,
    surface("#855c28"),
    [
      [-0.1, 1.42, 0.875],
      [0, 1.42, 0.921],
      [0.1, 1.42, 0.875],
    ],
    0.01,
  );
  ball(m.body, dark, [0, 1.35, 0.91], [0.026, 0.026, 0.012]);
  curve(
    m.body,
    dark,
    [
      [0, 1.35, 0.92],
      [0, 1.27, 0.88],
    ],
    0.008,
  );
  m.bell = bell;
  ball(m.head, blue, [0, 0, 0], [0.93, 0.87, 0.79]);
  ball(m.head, white, [0, -0.115, 0.57], [0.775, 0.67, 0.255]);
  for (const s of [-1, 1]) {
    eye(m, s, { y: 0.29, z: 0.68 });
    for (let i = 0; i < 3; i++)
      curve(
        m.head,
        dark,
        [
          [s * 0.32, -0.15 - i * 0.105, 0.824],
          [s * 0.49, -0.15 - i * 0.14, 0.794],
          [s * 0.7, -0.12 - i * 0.19, 0.716],
        ],
        0.011,
      );
  }
  ball(m.head, red, [0, 0.04, 0.88], [0.135, 0.127, 0.115]);
  curve(
    m.head,
    dark,
    [
      [0, -0.08, 0.855],
      [0, -0.34, 0.817],
    ],
    0.011,
  );
  m.smile = curve(
    m.head,
    dark,
    [
      [-0.46, -0.28, 0.78],
      [-0.28, -0.47, 0.779],
      [0, -0.54, 0.76],
      [0.28, -0.47, 0.779],
      [0.46, -0.28, 0.78],
    ],
    0.016,
  );
  m.mouth = ball(
    m.head,
    surface("#6c2635"),
    [0, -0.395, 0.811],
    [0.26, 0.15, 0.025],
  );
  m.mouth.visible = false;
  ball(m.mouth, surface("#f0858e"), [0, -0.32, 0.8], [0.7, 0.4, 0.3]);
  for (const side of [-1, 1])
    m.arms.push(limb(m.body, blue, white, side, [side * 0.61, 1.38, 0], false));
  legs(m, blue, white, false);
  // Actual barrel prop appears with gadget skills and follows the attacking wrist.
  m.cannon = new THREE.Group();
  m.arms[1].hand.add(m.cannon);
  const steel = surface("#8bb8c8", { metalness: 0.58, roughness: 0.26 }),
    rim = surface("#d1eef3", { metalness: 0.7, roughness: 0.21 });
  const barrel = tube(m.cannon, steel, [0.17, 0, 0], 0.24, 0.19, 0.62, 32);
  barrel.rotation.z = -Math.PI / 2;
  const rimMesh = ring(m.cannon, rim, 0.24, 0.043, [0.49, 0, 0]);
  rimMesh.rotation.y = Math.PI / 2;
  const hole = tube(
    m.cannon,
    surface("#123e54", { emissive: "#147a9d", emissiveIntensity: 0.8 }),
    [0.49, 0, 0],
    0.2,
    0.2,
    0.025,
    32,
  );
  hole.rotation.z = -Math.PI / 2;
  m.cannon.visible = false;
  ball(m.body, red, [0, 0.65, -0.63], [0.13, 0.13, 0.13]);
  return m;
}
function po() {
  const m = rig("po"),
    red = skin(m, "#d82f53", true),
    skinMat = skin(m, "#efc9a5"),
    inner = skin(m, "#ba2047", true);
  m.head.position.y = 2.13;
  m.baseHead = 2.13;
  const profile = [
    [0.02, 0.24],
    [0.39, 0.24],
    [0.61, 0.55],
    [0.66, 0.95],
    [0.55, 1.35],
    [0.34, 1.64],
    [0.01, 1.67],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(m.body, new THREE.LatheGeometry(profile, 40), red);
  curve(
    m.body,
    inner,
    [
      [0, 1.5, -0.47],
      [0, 1.1, -0.66],
      [0, 0.65, -0.56],
    ],
    0.008,
  );
  const bezel = roundBox(
    m.body,
    surface("#f3a1aa", { roughness: 0.45 }),
    [0, 1.07, 0.55],
    [0.87, 0.78, 0.17],
  );
  roundBox(
    m.body,
    surface("#7a939e", { metalness: 0.65, roughness: 0.25 }),
    [0, 1.07, 0.65],
    [0.73, 0.64, 0.06],
  );
  m.screen = roundBox(
    m.body,
    new THREE.MeshPhysicalMaterial({
      color: "#a2e7ee",
      metalness: 0.2,
      roughness: 0.17,
      clearcoat: 1,
      emissive: "#62bfe4",
      emissiveIntensity: 0.16,
    }),
    [0, 1.07, 0.685],
    [0.63, 0.53, 0.03],
  );
  m.materials.push(m.screen.material);
  curve(
    m.body,
    surface("#d5fbff", { emissive: "#9cf3ff", emissiveIntensity: 0.8 }),
    [
      [-0.23, 1.07, 0.709],
      [-0.12, 1.07, 0.709],
      [-0.05, 1.18, 0.709],
      [0.04, 0.96, 0.709],
      [0.1, 1.07, 0.709],
      [0.23, 1.07, 0.709],
    ],
    0.012,
  );
  ball(m.head, red, [0, 0, 0], [0.77, 0.7, 0.59]);
  for (const s of [-1, 1]) {
    const ear = ball(m.head, red, [s * 0.74, 0.08, -0.01], [0.25, 0.23, 0.19]);
    ear.rotation.z = -s * 0.3;
    ball(m.head, inner, [s * 0.78, 0.08, 0.14], [0.13, 0.145, 0.035]);
  }
  ball(m.head, skinMat, [0, -0.035, 0.51], [0.565, 0.505, 0.163]);
  for (const s of [-1, 1]) {
    eye(m, s, { x: 0.19, y: 0.075, z: 0.658, white: false });
    curve(
      m.head,
      surface("#8b5b53"),
      [
        [s * 0.1, 0.23, 0.66],
        [s * 0.19, 0.25, 0.665],
        [s * 0.27, 0.225, 0.636],
      ],
      0.014,
    );
    ball(
      m.head,
      surface("#e7a297", { roughness: 0.9 }),
      [s * 0.34, -0.16, 0.637],
      [0.09, 0.045, 0.013],
    );
  }
  ball(m.head, skinMat, [0, -0.07, 0.69], [0.08, 0.08, 0.065]);
  m.smile = curve(
    m.head,
    surface("#9f5c55"),
    [
      [-0.21, -0.23, 0.658],
      [-0.1, -0.29, 0.675],
      [0, -0.31, 0.675],
      [0.11, -0.29, 0.674],
      [0.21, -0.23, 0.658],
    ],
    0.016,
  );
  m.mouth = ball(
    m.head,
    surface("#81354b"),
    [0, -0.235, 0.682],
    [0.19, 0.125, 0.018],
  );
  m.mouth.visible = false;
  ball(m.mouth, surface("#f6aea8"), [0, -0.35, 0.8], [0.7, 0.4, 0.3]);
  m.antenna = new THREE.Group();
  m.antenna.position.set(0, 0.59, 0);
  m.head.add(m.antenna);
  curve(
    m.antenna,
    red,
    [
      [0, 0, 0],
      [0, 0.2, 0],
      [0.025, 0.35, 0],
    ],
    0.065,
  );
  ring(m.antenna, red, 0.175, 0.06, [0.025, 0.49, 0]);
  for (const side of [-1, 1])
    m.arms.push(limb(m.body, red, red, side, [side * 0.53, 1.43, 0], true));
  legs(m, red, red, true);
  return m;
}
const builders = new Map([
  ["robot-cat", doraemon],
  ["antenna", po],
]);
export const registerFighterModel = (style, builder) =>
  builders.set(style, builder);
export function makeFighter(c) {
  return (builders.get(c.bodyStyle) || doraemon)(c);
}
