import * as THREE from "three";
import { clamp, damp, ease } from "./primitives.js";
const up = new THREE.Vector3(0, 1, 0),
  a = new THREE.Vector3(),
  b = new THREE.Vector3(),
  dir = new THREE.Vector3();
function segment(mesh, from, to, length) {
  a.set(...from);
  b.set(...to);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  dir.copy(b).sub(a);
  mesh.scale.y = dir.length() / length;
  mesh.quaternion.setFromUnitVectors(up, dir.normalize());
}
function poseArm(limb, target, po) {
  const s = limb.side,
    shoulder = limb.shoulder.toArray();
  const elbow = [
    (shoulder[0] + target[0]) * 0.5 + s * 0.09,
    (shoulder[1] + target[1]) * 0.5 - 0.14,
    (shoulder[2] + target[2]) * 0.5 - 0.07,
  ];
  segment(limb.upper, shoulder, elbow, po ? 0.69 : 0.73);
  segment(limb.lower, elbow, target, po ? 0.63 : 0.67);
  limb.hand.position.set(...target);
}
export function animateFighter(m, f, dt, clock, index, hitstop = 0) {
  if (!m) return;
  const po = m.type === "po",
    face = f.facing || 1,
    walk = f.action === "walk",
    hurt = f.action === "hurt" || f.stun > 0,
    crouch = f.crouching,
    air = !f.grounded,
    victory = f.action === "victory",
    defeat = f.action === "defeat";
  const contactFrame = hitstop > 0 && !m.frozen;
  m.frozen = hitstop > 0;
  if (hitstop > 0) dt = contactFrame ? Math.max(dt, 1 / 30) : 0;
  m.animTime = (m.animTime || 0) + dt;
  const t = m.animTime,
    cycle = t * (po ? 13 : 14),
    stride = walk ? Math.sin(cycle) : 0;
  let lean = walk ? -face * 0.07 : Math.sin(t * 2.6 + index) * 0.012,
    twist = face * 0.48,
    squash = crouch ? 0.7 : 1,
    bodyY = walk
      ? Math.abs(Math.sin(cycle)) * 0.035
      : Math.sin(t * 2.7 + index) * 0.022;
  let hands = [
      [-0.77, 1.2, 0.47],
      [0.77, 1.2, 0.47],
    ],
    hipSwing = walk ? 0.29 : 0,
    mouth = false;
  if (walk) {
    hands = hands.map((h, i) => [
      h[0],
      h[1] + Math.cos(cycle + i * Math.PI) * 0.15,
      h[2] + Math.sin(cycle + i * Math.PI) * 0.24,
    ]);
  }
  if (air) {
    squash = f.vy > 1 ? 1.06 : 0.96;
    lean = -face * 0.08;
    hands = [
      [-0.96, 1.58, 0.18],
      [0.96, 1.58, 0.18],
    ];
    hipSwing = 0.2;
  }
  if (crouch) {
    hands = [
      [-0.75, 1.6, 0.5],
      [0.75, 1.6, 0.5],
    ];
    lean = face * 0.055;
  }
  const cast = f.currentMove;
  if (cast) {
    const { move, elapsed, key } = cast,
      w = ease(elapsed / move.windup),
      released = elapsed >= move.windup,
      recovery = clamp(
        (elapsed - move.windup - move.active) / move.recovery,
        0,
        1,
      ),
      power = released ? 1 - ease(recovery) : 0;
    const front = face > 0 ? 1 : 0,
      back = 1 - front;
    if (key === "attack") {
      if (!released) {
        hands[front] = [
          face * (0.8 - 0.3 * w),
          1.38 + (po ? 0.6 : 0.08) * w,
          0.42,
        ];
        lean = face * 0.12 * w;
        twist = face * (0.48 - 0.3 * w);
        squash = 1 - 0.05 * w;
      } else {
        hands[front] = [
          face * (0.8 + (po ? 0.98 : 1.25) * power),
          1.48 + (po ? 0.25 : 0) * power,
          0.42,
        ];
        hands[back] = [-face * 0.6, 1.2, 0.58];
        lean = -face * 0.18 * power;
        twist = face * (0.48 + 0.22 * power);
        bodyY = 0.03 * power;
        squash = 1 + 0.025 * power;
      }
    } else if (move.kind === "projectile" || move.kind === "beam") {
      hands[front] = [
        face * (0.92 + (released ? 0.35 : 0.24 * w)),
        move.kind === "beam" ? 1.45 : 1.86,
        0.39,
      ];
      hands[back] = [-face * 0.45, 1.15, 0.67];
      lean = face * (released ? 0.13 * power : -0.07 * w);
      twist = face * 0.65;
      squash = 1 - (released ? 0.08 * power : 0.04 * w);
      if (move.kind === "beam") {
        hands[back] = [face * 0.6, 1.14, 0.65];
        mouth = true;
        bodyY = 0.025 * Math.sin(t * 45) * w * (1 - power);
      }
    } else if (move.kind === "dash") {
      squash = released ? 1 - 0.14 * power : 1 - 0.18 * w;
      lean = -face * (released ? 0.38 * power : 0.13 * w);
      hands[front] = [face * 0.75, 1.65, 0.6];
      hands[back] = [-face * (0.8 + 0.24 * power), 0.99, 0.3];
      twist = face * 0.8;
      hipSwing = 0.45;
      bodyY = released ? 0.08 * power : 0;
    } else if (move.kind === "pulse") {
      if (!released) {
        hands = [
          [-0.5, 1.02 + 0.1 * w, 0.85],
          [0.5, 1.02 + 0.1 * w, 0.85],
        ];
        squash = 1 - 0.2 * w;
        lean = 0.04 * Math.sin(t * 19) * w;
        twist = face * 0.28;
      } else {
        hands = [
          [-1.35, 1.62 + 0.4 * power, 0.25],
          [1.35, 1.62 + 0.4 * power, 0.25],
        ];
        squash = 1 + 0.08 * power;
        bodyY = 0.18 * power;
        twist = face * 0.2;
        mouth = true;
      }
    }
  }
  if (hurt) {
    const recoil = f.hitDirection || -face;
    lean = -recoil * 0.24;
    squash = 1.05;
    bodyY = 0.05;
    hands = [
      [-1.03, 1.35, 0.13],
      [1.03, 1.35, 0.13],
    ];
    twist = face * 0.3;
  }
  if (victory) {
    hands = po
      ? [
          [-1.1, 2.15, 0.2],
          [1.1, 2.15, 0.2],
        ]
      : [
          [-0.7, 1.2, 0.6],
          [1.05, 2.4, 0.25],
        ];
    bodyY = Math.abs(Math.sin(t * 5)) * 0.15;
    mouth = true;
    lean = Math.sin(t * 5) * 0.06;
    twist = face * 0.15;
  }
  if (defeat) {
    squash = 0.64;
    lean = -face * 0.36;
    hands = [
      [-0.8, 0.7, 0.4],
      [0.8, 0.7, 0.4],
    ];
  }
  m.root.position.set(f.x, Math.max(0, f.y), 0);
  m.root.rotation.y = damp(m.root.rotation.y, twist, dt, 14);
  m.body.rotation.z = damp(m.body.rotation.z, lean, dt, 20);
  m.body.scale.set(
    1 + (1 - squash) * 0.22,
    damp(m.body.scale.y, squash, dt, 22),
    1 + (1 - squash) * 0.15,
  );
  m.body.position.y = damp(m.body.position.y, bodyY, dt, 20);
  m.head.position.y =
    m.baseHead +
    (walk ? Math.sin(cycle - 0.4) * 0.015 : Math.sin(t * 2.7 - 0.4) * 0.012);
  m.head.rotation.z = -m.body.rotation.z * 0.4;
  m.head.rotation.y = face * (hurt ? -0.09 : cast ? 0.08 : 0.035);
  m.head.rotation.x = defeat ? 0.18 : victory ? -0.08 : 0;
  hands.forEach((target, i) => {
    if (!m.handTargets)
      m.handTargets = [
        new THREE.Vector3(...target),
        new THREE.Vector3(...target),
      ];
    const v = m.handTargets[i];
    v.lerp(new THREE.Vector3(...target), 1 - Math.exp(-dt * (cast ? 55 : 18)));
    poseArm(m.arms[i], v.toArray(), po);
  });
  m.legs.forEach((leg, i) => {
    const phase = cycle + i * Math.PI;
    leg.group.position.x = leg.side * (crouch ? 0.49 : 0.37);
    leg.group.position.y = 0.57;
    leg.group.rotation.x = walk
      ? Math.sin(phase) * hipSwing
      : air
        ? leg.side * 0.3
        : 0;
    leg.group.rotation.z = crouch ? -leg.side * 0.2 : 0;
    leg.foot.position.y =
      -0.38 + (walk ? Math.max(0, Math.sin(phase)) * 0.16 : 0);
    leg.foot.position.z = 0.17 + (walk ? Math.cos(phase) * 0.15 : 0);
    leg.foot.rotation.x = walk ? Math.min(0, Math.sin(phase)) * 0.22 : 0;
  });
  const blink = Math.sin(t * 0.8 + index * 2) > 0.997;
  for (const eye of m.eyes)
    eye.scale.y = damp(eye.scale.y, hurt ? 0.28 : blink ? 0.08 : 1, dt, 35);
  m.pupils.forEach((p, i) => {
    p.position.x = (po ? 0 : i ? -0.045 : 0.045) + face * 0.02;
  });
  m.smile.visible = !mouth;
  m.mouth.visible = mouth;
  if (m.antenna) {
    m.antenna.rotation.z = damp(
      m.antenna.rotation.z,
      -lean * 0.7 + Math.sin(t * 7) * 0.035,
      dt,
      9,
    );
    m.screen.material.emissiveIntensity = cast
      ? 0.35 + Math.sin(t * 25) * 0.15
      : 0.14;
  }
  if (m.cannon) {
    m.cannon.visible =
      !!cast && ["beam", "projectile"].includes(cast.move.kind);
    const hand = m.arms[face > 0 ? 1 : 0].hand;
    if (m.cannon.parent !== hand) hand.add(m.cannon);
    m.cannon.rotation.y = face < 0 ? Math.PI : 0;
  }
  const flash = f.flash > 0 ? Math.min(0.7, f.flash * 5) : 0;
  for (const mat of m.materials) {
    if (mat === m.screen?.material) continue;
    mat.emissive.set("#ffc29b");
    mat.emissiveIntensity = flash;
  }
}
