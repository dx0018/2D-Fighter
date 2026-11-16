import * as THREE from "three";
import { clamp, damp, ease } from "./primitives.js";
import { poseChain } from "./rig.js";
import { sampleStep, updateGait } from "./locomotion.js";
import { sampleMelee } from "./melee-motion.js";
import { recoveryMovement } from "../game/moves.js";
import { narutoMovePose, animateNarutoDetails } from "./naruto-animation.js";
const TAU = Math.PI * 2;
function poseLeg(m, leg, target) {
  const origin = m.vector
    .set(leg.side * 0.29, m.hipHeight, 0)
    .applyMatrix4(m.body.matrix);
  m.target.copy(target);
  // Limit horizontal reach at the requested floor height. Clamping the whole
  // 3D vector would pull a planted foot up when turning or stopping abruptly.
  const dx = m.target.x - origin.x,
    dz = m.target.z - origin.z,
    horizontal = Math.hypot(dx, dz),
    vertical = m.target.y - origin.y,
    reach = leg.upperLength + leg.lowerLength - 0.003,
    maxHorizontal = Math.sqrt(Math.max(0, reach * reach - vertical * vertical));
  if (horizontal > maxHorizontal && horizontal > 0) {
    m.target.x = origin.x + (dx * maxHorizontal) / horizontal;
    m.target.z = origin.z + (dz * maxHorizontal) / horizontal;
  }
  m.pole.set(0, 0.02, 1);
  poseChain(leg, origin, m.target, m.pole);
  leg.foot.position.copy(leg.endpoint);
}
export function animateFighter(m, f, dt, clock, index = 0, hitstop = 0) {
  if (!m) return;
  const po = m.type === "po",
    face = f.facing || 1,
    cast = f.currentMove,
    hurt = f.action === "hurt" || f.stun > 0,
    air = !f.grounded;
  const walk =
      !air && !f.crouching && (f.action === "walk" || recoveryMovement(cast)),
    crouch = f.crouching,
    victory = f.action === "victory",
    defeat = f.action === "defeat";
  const contactFrame = hitstop > 0 && !m.frozen;
  m.frozen = hitstop > 0;
  if (hitstop > 0) dt = contactFrame ? Math.max(dt, 1 / 30) : 0;
  m.animTime = (m.animTime || 0) + dt;
  const t = m.animTime;
  const cycle = updateGait(m, f, dt, walk),
    gait = f.character.locomotion || {};
  m.crouchBlend = damp(m.crouchBlend || 0, crouch ? 1 : 0, dt, 50);
  const walking = m.walkBlend,
    squat = m.crouchBlend;
  const movement = m.travelDirection,
    takeoff =
      (f.jumpStartup || 0) > 0
        ? Math.sin((1 - f.jumpStartup / 0.025) * Math.PI * 0.7)
        : 0;
  const landing =
    Math.pow(clamp((f.landingTimer || 0) / 0.16, 0, 1), 0.7) *
    (f.landingImpact || 0);
  const tuck = air ? 0.35 + 0.45 * (1 - Math.min(1, Math.abs(f.vy) / 10)) : 0;
  let lean = -movement * 0.08 * walking + Math.sin(t * 2.6 + index) * 0.008,
    twist = face * 0.48,
    squash = 1 - squat * 0.32 - takeoff * 0.17 - landing * 0.15,
    bodyY =
      Math.cos(cycle * 2) * 0.025 * walking + Math.sin(t * 2.7 + index) * 0.012;
  let hands = [
      [-0.68, 1.3, 0.46],
      [0.68, 1.3, 0.46],
    ],
    mouth = false,
    kick = 0,
    kickHeight = 0.25,
    spin = 0;
  if (walking > 0.01) {
    hands = hands.map((h, i) => {
      const step = sampleStep(cycle + i * Math.PI, gait.stride, gait.lift);
      return [
        h[0],
        1.3 - 0.07 * walking + step.lift * 0.28 * walking,
        0.46 - face * step.x * (gait.armSwing || 0.4) * walking,
      ];
    });
  }
  if (air) {
    squash = 1 + (f.vy > 2 ? 0.045 : -0.025);
    bodyY = 0.02;
    lean = -movement * Math.min(0.11, Math.abs(f.vx) * 0.018);
    hands = [
      [-0.93, 1.65, 0.27],
      [0.93, 1.65, 0.27],
    ];
  }
  if (takeoff > 0) {
    hands = [
      [-0.75, 1.02, 0.08],
      [0.75, 1.02, 0.08],
    ];
    lean = -face * 0.08;
  }
  if (landing > 0.01 && !cast) {
    hands = [
      [-0.91, 1.26, 0.37],
      [0.91, 1.26, 0.37],
    ];
  }
  let power = 0,
    released = false,
    w = 0,
    strike = null;
  const guardHands = hands;
  if (cast) {
    const { move, elapsed, key } = cast;
    w = ease(elapsed / Math.max(0.001, move.windup));
    released = elapsed >= move.windup;
    const recovery = clamp(
      (elapsed - move.windup - move.active) / Math.max(0.001, move.recovery),
      0,
      1,
    );
    power = released ? 1 - ease(recovery) : 0;
    const front = face > 0 ? 1 : 0,
      back = 1 - front,
      style = move.animation,
      melee = key === "attack" ? sampleMelee(move, elapsed) : null;
    hands = hands.map((h) => [...h]);
    const ninjaPose =
      m.type === "naruto"
        ? narutoMovePose(cast, face, w, power, released)
        : null;
    if (ninjaPose) {
      ({ hands, lean, twist, bodyY, squash } = ninjaPose);
    } else if (style === "sweep" || style === "slide") {
      hands[front] = [face * 0.78, 1.55, 0.55];
      hands[back] = [-face * 0.65, 1.1, 0.2];
      kick = melee ? 0.72 * melee.extension : released ? 0.8 * power : 0;
      kickHeight = 0.22;
      lean =
        face *
        (style === "slide" ? -0.25 : 0.12) *
        (melee ? melee.weight : Math.max(w, power));
    } else if (style === "air-kick") {
      kick = 0.82 * melee.extension;
      kickHeight = 0.55;
      lean = -face * 0.17 * melee.weight;
      hands[back] = [-face * 0.8, 1.4, 0.2];
    } else if (style === "air-spin") {
      spin = released
        ? TAU * ease(clamp((elapsed - move.windup) / move.active, 0, 1))
        : 0;
      hands = [
        [-1.15, 1.35, 0.2],
        [1.15, 1.35, 0.2],
      ];
      kick = released ? 0.85 * power : 0;
      kickHeight = 0.65;
      mouth = true;
    } else if (style === "antenna-beam") {
      hands = [
        [-0.78, 1.95 + w * 0.3, 0.25],
        [0.78, 1.95 + w * 0.3, 0.25],
      ];
      lean = face * (released ? 0.1 : -0.07) * Math.max(w, power);
      twist = face * 0.3;
      mouth = released;
      bodyY -= 0.035 * power;
    } else if (key === "attack") {
      strike = melee;
      const { prepare, extension } = strike,
        motion = move.motion || {};
      hands[front] = [
        face * (0.5 - 0.1 * prepare + (motion.reach || 0.77) * extension),
        1.42 + (po ? 0.35 : 0.08) * prepare + (po ? 0.24 : 0.04) * extension,
        0.12 + (po ? 0.18 : 0.06) * prepare - 0.36 * extension,
      ];
      hands[back] = [-face * 0.22, 1.35, 0.6];
      lean += face * (0.09 * prepare - 0.14 * extension);
      twist += face * (-0.22 * prepare + 0.24 * extension);
      bodyY += -0.018 * prepare + 0.025 * extension;
      squash = 1 - 0.04 * prepare;
    } else if (move.kind === "projectile" || move.kind === "beam") {
      const handCannon = style === "cannon" || style === "retreat-cannon",
        divingCannon = style === "air-cannon";
      hands[front] = [
        face *
          (handCannon
            ? 1.0
            : divingCannon
              ? 0.98
              : 0.9 + (released ? 0.17 : 0.12 * w)),
        style === "low-cannon"
          ? 0.3
          : divingCannon
            ? 1.02
            : handCannon
              ? 1.56
              : move.kind === "beam"
                ? 1.45
                : 2.45,
        move.kind === "beam"
          ? 0.39
          : handCannon
            ? 0
            : divingCannon
              ? -0.08
              : -0.1,
      ];
      hands[back] = [-face * 0.45, 1.15, 0.67];
      lean = face * (released ? 0.13 * power : -0.07 * w);
      twist = face * 0.65;
      if (!crouch) squash = 1 - (released ? 0.08 * power : 0.04 * w);
      if (move.kind === "beam") {
        hands[back] = [face * 0.6, 1.14, 0.65];
        mouth = true;
      }
    } else if (move.kind === "dash") {
      squash = released ? 1 - 0.12 * power : 1 - 0.14 * w;
      lean = -face * (released ? 0.32 * power : 0.13 * w);
      hands[front] = [face * 0.75, 1.65, 0.6];
      hands[back] = [-face * (0.8 + 0.24 * power), 0.99, 0.3];
      twist = face * 0.8;
      bodyY = released ? 0.05 * power : 0;
    } else if (move.kind === "pulse") {
      if (!released) {
        hands = [
          [-0.5, 1.02 + 0.1 * w, 0.85],
          [0.5, 1.02 + 0.1 * w, 0.85],
        ];
        squash = 1 - 0.2 * w;
        lean = 0.025 * Math.sin(t * 19) * w;
        twist = face * 0.28;
      } else {
        hands = [
          [-1.35, 1.62 + 0.4 * power, 0.25],
          [1.35, 1.62 + 0.4 * power, 0.25],
        ];
        squash = 1 + 0.08 * power;
        bodyY = 0.12 * power;
        twist = face * 0.2;
        mouth = true;
      }
    }
    if (style === "retreat-pulse") {
      lean = face * 0.18;
      bodyY += Math.sin(Math.PI * power) * 0.08;
    }
  }
  if (hurt) {
    const recoil = f.hitDirection || -face;
    lean = -recoil * 0.24;
    squash = f.hitLevel === "low" ? 0.88 : 1.03;
    bodyY = f.hitLevel === "low" ? -0.08 : 0.03;
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
    bodyY = Math.abs(Math.sin(t * 5)) * 0.12;
    mouth = true;
    lean = Math.sin(t * 5) * 0.04;
    twist = face * 0.15;
  }
  if (defeat) {
    squash = 0.74;
    bodyY = -0.08;
    lean = -face * 0.3;
    hands = [
      [-0.8, 0.7, 0.4],
      [0.8, 0.7, 0.4],
    ];
  }
  m.root.position.set(f.x, Math.max(0, f.y), 0);
  const yawTarget =
    face * (0.82 + 0.26 * walking) + (twist - face * 0.48) * 0.4;
  if (m.wasSpin && !spin)
    m.root.rotation.y -=
      Math.round((m.root.rotation.y - yawTarget) / TAU) * TAU;
  m.wasSpin = !!spin;
  m.root.rotation.y = damp(
    m.root.rotation.y,
    yawTarget + spin,
    dt,
    spin ? 45 : 28,
  );
  // Rigid torso pivots at the pelvis. Crouch bends hips and knees, without squash.
  const pitch =
    squat * 0.64 - lean * face * (1 - squat) + landing * 0.12 + takeoff * 0.1;
  m.body.rotation.set(
    damp(m.body.rotation.x, pitch, dt, 45),
    damp(m.body.rotation.y, Math.sin(cycle) * walking * 0.035, dt, 24),
    damp(m.body.rotation.z, Math.sin(cycle) * walking * 0.012, dt, 24),
  );
  m.body.scale.set(1, 1, 1);
  const hipY =
    m.hipHeight -
    0.38 * squat +
    (-0.07 * walking -
      0.06 * takeoff -
      0.09 * landing +
      bodyY +
      (squash - 1) * 0.08) *
      (1 - squat);
  m.visualHipY = damp(m.visualHipY ?? hipY, hipY, dt, 32);
  m.vector.set(0, m.hipHeight, 0).applyQuaternion(m.body.quaternion);
  m.body.position.set(0, m.visualHipY, -squat * 0.28).sub(m.vector);
  m.head.scale.set(1, 1, 1);
  m.head.position.set(0, m.baseHead, 0);
  m.head.rotation.set(
    -m.body.rotation.x * 0.65 +
      (defeat
        ? 0.12
        : victory
          ? -0.08
          : air
            ? clamp(-f.vy * 0.006, -0.08, 0.08)
            : 0),
    -face * (cast ? 0.08 : 0.18),
    -m.body.rotation.z * 0.6,
  );
  m.body.updateMatrix();
  m.bodyInverse.copy(m.body.matrix).invert();
  const yaw = m.root.rotation.y,
    cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  if (!m.handTargets) m.handTargets = hands.map(() => new THREE.Vector3());
  hands.forEach((target, i) => {
    const localIdle = !cast && !hurt && !victory && !defeat && !air;
    if (localIdle) {
      m.target.set(...target).applyMatrix4(m.body.matrix);
      m.vector.set(m.arms[i].side * 0.48, 1.22, 0.9);
      m.target.lerp(m.vector, squat);
    } else {
      m.target.set(
        cy * target[0] - sy * target[2],
        target[1],
        sy * target[0] + cy * target[2],
      );
      if (strike) {
        m.vector.set(...guardHands[i]).applyMatrix4(m.body.matrix);
        m.target.lerpVectors(m.vector, m.target, strike.weight);
      }
    }
    const v = m.handTargets[i];
    v.lerp(m.target, 1 - Math.exp(-dt * (strike ? 110 : cast ? 70 : 32)));
    m.target.copy(v).applyMatrix4(m.bodyInverse);
    m.pole.set(m.arms[i].side * 0.4, -0.6, -0.3);
    poseChain(m.arms[i], m.arms[i].shoulder, m.target, m.pole);
    m.arms[i].hand.position
      .copy(m.arms[i].endpoint)
      .applyMatrix4(m.body.matrix);
    m.arms[i].hand.rotation.y = -yaw;
    m.arms[i].hand.rotation.z = damp(
      m.arms[i].hand.rotation.z,
      po && strike && i === (face > 0 ? 1 : 0)
        ? -face * strike.extension * 0.32
        : 0,
      dt,
      35,
    );
  });
  m.legs.forEach((leg, i) => {
    const step = sampleStep(cycle + i * Math.PI, gait.stride, gait.lift),
      front = leg.side === face;
    let travel = step.x * walking,
      footY = leg.footHeight + step.lift * walking;
    if (air) {
      travel = -face * (front ? 0.1 : 0.27);
      footY = leg.footHeight + (front ? 0.12 : 0.28) + tuck * 0.22;
    }
    if (kick && front) {
      travel = face * kick;
      footY = kickHeight;
    }
    if (cast?.move.animation === "slide" && !front) travel = -face * 0.4;
    const target = [
      leg.side * (0.29 + squat * 0.1) + cy * travel,
      footY,
      0.13 + sy * travel,
    ];
    // The support foot stays in world space even when movement reverses or the
    // torso turns. Swing feet are free to catch the next step.
    const planting = walk && walking > 0.08 && step.support;
    m.target.set(
      f.x + cy * target[0] + sy * target[2],
      f.y + target[1],
      -sy * target[0] + cy * target[2],
    );
    if (planting) {
      if (!leg.planted || leg.plantCycle !== step.cycle) {
        leg.plantX = leg.worldX ?? f.x + cy * target[0] + sy * target[2];
        leg.plantZ = leg.worldZ ?? -sy * target[0] + cy * target[2];
        leg.plantCycle = step.cycle;
      }
      m.target.x = leg.plantX;
      m.target.z = leg.plantZ;
    }
    leg.releaseOffset ??= new THREE.Vector3();
    if (walk && leg.planted && !planting) {
      // Start a swing from the real toe-off, including a short starting step.
      // A fixed ideal stride otherwise pulls that foot backward on release.
      leg.releaseOffset.set(
        leg.worldX - m.target.x,
        0,
        leg.worldZ - m.target.z,
      );
    }
    if (!walk || planting) leg.releaseOffset.set(0, 0, 0);
    m.target.add(leg.releaseOffset);
    leg.releaseOffset.multiplyScalar(Math.exp(-dt * 18));
    leg.planted = planting;
    // Smooth free ankles in world space, so moving the root never adds a
    // second, sudden movement to a foot that is just leaving the floor.
    // Air poses stay attached to the body rather than lagging behind takeoff.
    if (leg.placement && (air || leg.wasAir)) {
      leg.placement.x += f.x - (leg.rootX ?? f.x);
      leg.placement.y += f.y - (leg.rootY ?? f.y);
    }
    leg.placement ??= m.target.clone();
    if (planting) leg.placement.copy(m.target);
    else
      leg.placement.lerp(m.target, 1 - Math.exp(-dt * (air || kick ? 42 : 24)));
    const dx = leg.placement.x - f.x;
    m.target.set(
      cy * dx - sy * leg.placement.z,
      leg.placement.y - f.y,
      sy * dx + cy * leg.placement.z,
    );
    poseLeg(m, leg, m.target);
    leg.foot.rotation.order = "YXZ";
    leg.foot.rotation.y = (face * Math.PI) / 2 - yaw;
    leg.foot.rotation.x = damp(
      leg.foot.rotation.x,
      air ? -0.1 : step.roll * face * walking,
      dt,
      40,
    );
    leg.worldX = f.x + cy * leg.foot.position.x + sy * leg.foot.position.z;
    leg.worldZ = -sy * leg.foot.position.x + cy * leg.foot.position.z;
    leg.rootX = f.x;
    leg.rootY = f.y;
    leg.wasAir = air;
  });
  const blink = Math.sin(t * 0.8 + index * 2) > 0.997;
  m.eyes.forEach(
    (eye) =>
      (eye.scale.y = damp(eye.scale.y, hurt ? 0.28 : blink ? 0.08 : 1, dt, 35)),
  );
  m.pupils.forEach((p, i) => {
    p.position.x =
      (m.pupilRestX?.[i] ?? (po ? 0 : i ? -0.045 : 0.045)) + face * 0.02;
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
    // The barrel is mirrored with rotation.y for left-facing fighters. Its
    // vertical angle remains a world-space rise/fall and must not be mirrored.
    m.cannon.rotation.z = cast?.move.angle || 0;
    m.cannon.position.y = cast?.move.kind === "beam" ? -0.1 : 0.18;
  }
  const flash = f.flash > 0 ? Math.min(0.7, f.flash * 5) : 0;
  if (m.lastFlash !== flash)
    for (const mat of m.materials) {
      if (mat === m.screen?.material) continue;
      mat.emissive.set("#ffc29b");
      mat.emissiveIntensity = flash;
    }
  m.lastFlash = flash;
  if (m.type === "naruto") animateNarutoDetails(m, f, t);
}
