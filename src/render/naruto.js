import * as THREE from "three";
import { rig, skin, silhouette, arms, legs } from "./fighter-rig.js";
import {
  ball,
  roundBox,
  mesh,
  tube,
  curve,
  ring,
  surface,
} from "./primitives.js";
import { makeChakraOrb } from "./ninja-effects.js";

export function naruto() {
  const m = rig("naruto"),
    orange = skin(m, "#f78a24"),
    charcoal = skin(m, "#24344b"),
    face = skin(m, "#f5c89e"),
    gold = skin(m, "#ffd34e"),
    ink = surface("#493d38"),
    steel = skin(m, "#a9c2ce");
  orange.roughness = 0.7;
  charcoal.roughness = 0.8;
  steel.metalness = 0.6;
  steel.roughness = 0.36;
  // A narrower jacket and smaller head distinguish human proportions from Doraemon.
  const profile = [
    [0.7, 0.1],
    [0.76, 0.32],
    [0.9, 0.36],
    [1.1, 0.38],
    [1.32, 0.42],
    [1.43, 0.45],
    [1.48, 0.46],
    [1.59, 0.45],
    [1.69, 0.35],
    [1.77, 0.18],
  ];
  const jacket = new THREE.LatheGeometry(
    profile.map(([y, r]) => new THREE.Vector2(r, y)),
    24,
  );
  const positions = jacket.attributes.position,
    colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    positions.setZ(i, positions.getZ(i) * 0.78);
    color.copy(positions.getY(i) > 1.45 ? charcoal.color : orange.color);
    colors.push(color.r, color.g, color.b);
  }
  jacket.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  jacket.computeVertexNormals();
  const jacketMat = skin(m, "#ffffff");
  jacketMat.vertexColors = true;
  jacketMat.roughness = 0.72;
  silhouette(mesh(m.body, jacket, jacketMat));
  curve(
    m.body,
    charcoal,
    [
      [0, 0.78, 0.26],
      [0, 1.1, 0.31],
      [0, 1.43, 0.365],
      [0, 1.69, 0.29],
    ],
    0.016,
  );
  roundBox(m.body, steel, [0.025, 1.57, 0.36], [0.05, 0.075, 0.025]);
  const collar = ring(m.body, charcoal, 0.26, 0.09, [0, 1.73, 0]);
  collar.rotation.x = Math.PI / 2;
  tube(m.body, face, [0, 1.83, 0], 0.17, 0.2, 0.27, 12);
  roundBox(m.body, charcoal, [0.43, 0.98, -0.31], [0.23, 0.29, 0.18]);
  const emblem = ring(
    m.body,
    surface("#c95739"),
    0.18,
    0.035,
    [0, 1.42, -0.36],
  );
  emblem.rotation.y = Math.PI;

  m.baseHead = 2.23;
  m.head.position.y = m.baseHead;
  silhouette(
    mesh(
      m.head,
      new THREE.SphereGeometry(1, 28, 20),
      face,
      [0, -0.01, 0],
      [0.63, 0.65, 0.55],
    ),
  );
  const front = (x, y) =>
    0.55 *
    Math.sqrt(Math.max(0.02, 1 - (x / 0.63) ** 2 - ((y + 0.01) / 0.65) ** 2));
  for (const side of [-1, 1]) {
    ball(m.head, face, [side * 0.61, -0.02, 0], [0.105, 0.17, 0.105]);
    const eye = new THREE.Group();
    eye.position.set(side * 0.205, 0.065, front(0.205, 0.065));
    m.head.add(eye);
    ball(eye, surface("#fffdf6"), [0, 0, 0.012], [0.14, 0.085, 0.028]);
    const pupil = ball(
      eye,
      surface("#249edb"),
      [-side * 0.015, 0, 0.039],
      [0.055, 0.068, 0.015],
    );
    ball(pupil, ink, [0, 0, 0.88], [0.48, 0.7, 0.3]);
    ball(pupil, surface("#ffffff"), [-0.23, 0.35, 1.1], [0.25, 0.24, 0.2]);
    m.eyes.push(eye);
    m.pupils.push(pupil);
    (m.pupilRestX ??= []).push(-side * 0.015);
    curve(
      m.head,
      ink,
      [
        [side * 0.08, 0.2, front(0.08, 0.2) + 0.02],
        [side * 0.2, 0.21, front(0.2, 0.21) + 0.02],
        [side * 0.35, 0.25, front(0.35, 0.25) + 0.02],
      ],
      0.017,
    );
    for (let i = 0; i < 3; i++) {
      const y = -0.13 - i * 0.09;
      curve(
        m.head,
        surface("#a56b50"),
        [
          [side * 0.29, y, front(0.29, y) + 0.012],
          [side * 0.4, y - 0.015, front(0.4, y - 0.015) + 0.012],
          [side * 0.51, y - 0.02, front(0.51, y - 0.02) + 0.012],
        ],
        0.008,
      );
    }
  }
  ball(m.head, face, [0, -0.1, 0.566], [0.048, 0.07, 0.055]);
  m.smile = curve(
    m.head,
    ink,
    [
      [-0.17, -0.31, front(-0.17, -0.31) + 0.012],
      [0, -0.355, front(0, -0.355) + 0.012],
      [0.17, -0.31, front(0.17, -0.31) + 0.012],
    ],
    0.012,
  );
  m.mouth = ball(
    m.head,
    surface("#8b4141"),
    [0, -0.32, front(0, -0.32) + 0.018],
    [0.15, 0.08, 0.018],
  );
  m.mouth.visible = false;

  // A continuous cap under the spikes avoids gaps; each spike points out of the crown.
  silhouette(
    mesh(
      m.head,
      new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.36),
      gold,
      [0, 0.1, -0.025],
      [0.66, 0.67, 0.57],
    ),
  );
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const spike = mesh(
      m.head,
      new THREE.ConeGeometry(0.18, 0.55 + (i % 3) * 0.06, 5),
      gold,
      [Math.cos(a) * 0.5, 0.52 + (i % 2) * 0.08, Math.sin(a) * 0.39 - 0.02],
    );
    spike.quaternion.setFromUnitVectors(
      up,
      new THREE.Vector3(
        Math.cos(a) * 0.65,
        0.85,
        Math.sin(a) * 0.6,
      ).normalize(),
    );
    silhouette(spike);
  }
  for (const side of [-1, 1]) {
    const bang = mesh(m.head, new THREE.ConeGeometry(0.13, 0.35, 5), gold, [
      side * 0.49,
      0.3,
      0.31,
    ]);
    bang.rotation.z = side * 2.7;
    silhouette(bang);
  }
  const band = ring(m.head, charcoal, 0.59, 0.105, [0, 0.34, -0.015]);
  band.rotation.x = Math.PI / 2;
  band.scale.y = 0.88;
  roundBox(m.head, steel, [0, 0.345, 0.547], [0.78, 0.235, 0.065]);
  const leaf = surface("#40566c");
  curve(
    m.head,
    leaf,
    [
      [-0.16, 0.32, 0.587],
      [-0.1, 0.32, 0.593],
      [-0.12, 0.37, 0.593],
      [-0.06, 0.41, 0.593],
      [0.03, 0.4, 0.593],
      [0.08, 0.35, 0.593],
      [0.04, 0.3, 0.593],
      [-0.02, 0.31, 0.593],
      [-0.03, 0.35, 0.593],
      [0.01, 0.36, 0.593],
    ],
    0.009,
  );
  curve(
    m.head,
    leaf,
    [
      [-0.16, 0.32, 0.587],
      [-0.19, 0.4, 0.587],
      [-0.1, 0.37, 0.593],
    ],
    0.009,
  );
  for (const side of [-1, 1])
    for (const y of [0.285, 0.405])
      ball(m.head, leaf, [side * 0.325, y, 0.586], [0.015, 0.015, 0.008]);
  m.headbandTies = new THREE.Group();
  m.headbandTies.position.set(0, 0.3, -0.56);
  m.head.add(m.headbandTies);
  for (const side of [-1, 1]) {
    const tie = roundBox(
      m.headbandTies,
      charcoal,
      [side * 0.16, -0.2, -0.12],
      [0.12, 0.58, 0.045],
    );
    tie.rotation.z = side * 0.5;
  }
  arms(m, orange, face);
  legs(m, orange, charcoal);
  for (const arm of m.arms) {
    const wrap = ring(arm.hand, charcoal, 0.145, 0.045, [0, -0.12, 0]);
    wrap.rotation.x = Math.PI / 2;
  }
  for (const leg of m.legs) {
    ball(leg.foot, face, [0, 0.1, 0.86], [0.68, 0.52, 0.28]);
    const wrap = tube(
      leg.lower,
      surface("#e5e9dd"),
      [0, -0.17, 0],
      0.186,
      0.186,
      0.16,
      12,
    );
    wrap.castShadow = false;
  }
  m.rasengan = makeChakraOrb();
  m.arms[1].hand.add(m.rasengan);
  m.rasengan.visible = false;
  m.bijuu = makeChakraOrb("bijuu");
  m.root.add(m.bijuu);
  m.bijuu.visible = false;
  m.chakraCloak = ball(
    m.root,
    new THREE.MeshBasicMaterial({
      color: "#ffbc48",
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    [0, 1.55, 0],
    [0.85, 1.65, 0.73],
  );
  m.chakraCloak.visible = false;
  return m;
}
