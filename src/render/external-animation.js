import { poseLocomotion } from "./skeletal-locomotion.js";
import { recoveryMovement } from "../game/moves.js";
import { updateKuramaSummon } from "./kurama-summon.js";
import * as THREE from "three";
import { clamp, damp } from "./primitives.js";
import { aimChain } from "./articulated-pose.js";
import { externalSkill } from "./skill-motion.js";
import { spinChakraOrb } from "./ninja-effects.js";

const rest = (bone) => bone && (bone.userData.restPose ||= {
  position: bone.position.clone(),
  quaternion: bone.quaternion.clone(),
});

function play(m, name, oneShot = false, token = "") {
  const next = m.actions.get(name);
  if (!next) return;
  if (m.currentAction === next && (!oneShot || m.currentActionToken === token)) return;
  const previous = m.currentAction;
  next.reset();
  if (oneShot) {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    if (m.character.model.rig === "mixamo") next.setDuration(0.56);
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
  }
  next.enabled = true;
  next.fadeIn(previous ? 0.12 : 0.04).play();
  previous?.fadeOut(0.12);
  m.currentAction = next;
  m.currentActionName = name;
  if (!oneShot) next.timeScale = m.character.model.rig === "mixamo" ? 1.12 : 1;
  m.currentActionToken = token;
}

function animationName(m, f, walking, airborne, crouch, victory) {
  const rig = m.character.model.rig,
    clips = m.clips || {};
  if (rig === "mixamo") {
    if (victory && f.action === "victory") return [clips.victory, true];
    if (airborne) return [clips.jump, true];
    return [walking ? clips.walk : clips.idle, false];
  }
  if (rig === "teletubby") {
    if (crouch) return [clips.idle, false];
    if (airborne) return [f.vy < -0.8 ? clips.fall || clips.jump : clips.jump || clips.idle, true];
    return [walking ? clips.walk : clips.idle, false];
  }
  return ["", false];
}

function doraPose(m, f, dt, walking, crouch, airborne, hurt) {
  const rig = m.bones,
    squat = m.crouchBlend || 0,
    stride = m.walkCycle || 0;
  m.crouch = crouch ? 1 : 0;
  m.walkCycle = stride + dt * (walking ? 8 + Math.abs(f.vx) * 0.55 : 0);
  const hip = rest(rig.Hips), spine = rest(rig.Spine),
    chest = rest(rig.Chest), head = rest(rig.Head);
  if (hip) {
    rig.Hips.position.copy(hip.position);
    rig.Hips.position.y -= squat * 0.3 + (walking ? (0.5 - Math.cos(m.walkCycle)) * 0.018 : 0);
  }
  if (spine) {
    rig.Spine.position.copy(spine.position).addScaledVector(m.target.set(0, -1, 0), .12 * squat);
    rig.Spine.quaternion.copy(spine.quaternion).multiply(
      m.deltaQuaternion.setFromEuler(new THREE.Euler(m.frontAxis * (.49 * squat - (airborne ? .12 : 0)), 0, 0)),
    );
  }
  if (chest)
    rig.Chest.quaternion.copy(chest.quaternion).multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(m.frontAxis * (0.19 * squat + (hurt ? -0.18 : 0)), 0, 0),
      ),
    );
  if (head) {
    rig.Head.quaternion.copy(head.quaternion).multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(m.frontAxis * (-0.12 * squat + (airborne ? -0.08 : 0)), 0, 0),
      ),
    );
  }
  for (const [side, name] of [[1, "L"], [-1, "R"]]) {
    const phase = m.walkCycle + (side > 0 ? 0 : Math.PI),
      swing = walking ? Math.sin(phase) * 0.34 : 0,
      kick = airborne ? 0.28 : 0,
      ua = rest(rig[`UpperArm_${name}`]),
      fa = rest(rig[`Forearm_${name}`]),
      thigh = rest(rig[`Thigh_${name}`]),
      shin = rest(rig[`Shin_${name}`]);
    if (ua)
      rig[`UpperArm_${name}`].quaternion.copy(ua.quaternion).multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          swing + (airborne ? -kick : 0),
        ),
      );
    if (fa)
      rig[`Forearm_${name}`].quaternion.copy(fa.quaternion).multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), squat * 0.36),
      );
    if (thigh)
      rig[`Thigh_${name}`].quaternion.copy(thigh.quaternion).multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1),
          swing * 0.8 + squat * 0.22 - (airborne ? 0.45 : 0),
        ),
      );
    if (shin)
      rig[`Shin_${name}`].quaternion.copy(shin.quaternion).multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), squat * 0.42 + (airborne ? 0.55 : 0)),
      );
  }
}

function armNames(rig, index) {
  const side = index === 0 ? "L" : "R";
  if (rig === "mixamo") {
    const name = index === 0 ? "left" : "right";
    return [name + "Upper", name + "Lower", name + "Hand"];
  }
  return [
    (rig === "teletubby" ? "Upper_Arm_" : "UpperArm_") + side,
    "Forearm_" + side,
    "Hand_" + side,
  ];
}

function leadIndex(m, face) {
  return (face > 0 ? 0 : 1) ^ (m.frontAxis < 0 ? 1 : 0);
}

function poseArms(m, f, face, skill) {
  const guarding = f.guarding && !f.currentMove;
  if (!skill?.weight && !guarding) return;
  const rig = m.character.model.rig;
  const front = leadIndex(m, face);
  for (let index = 0; index < 2; index++) {
    const names = armNames(rig, index);
    const hand = m.bones[names[2]];
    if (!hand) continue;
    const lead = index === front;
    const side = index === 0 ? 1 : -1;
    const point = m.target;
    let weight = 1;
    if (skill && !guarding) {
      const [prepare, release] = lead ? skill.pose.lead : skill.pose.support;
      point.fromArray(prepare).lerp(m.joint.fromArray(release), skill.strike);
      point.z -= skill.recoil * (lead ? .06 : .025);
      weight = skill.weight;
    } else {
      point.set(.23, 2.05 - m.crouchBlend * .35, .48);
    }
    point.x *= side * m.frontAxis;
    point.z *= m.frontAxis;
    aimChain(m, m.visual, m.bones, names, point.toArray(), [side * m.frontAxis, -.73, .28 * m.frontAxis], false, weight);
  }
}

function animateKurama(m, f, cast, clock) {
  if (!m.kurama) return;
  const live = cast?.move.visual === "bijuu",
    windup = cast?.move.windup || 1,
    elapsed = cast?.elapsed || 0,
    fade = live
      ? elapsed < windup + cast.move.active
        ? 1
        : 1 - clamp((elapsed - windup - cast.move.active) / 0.32, 0, 1)
      : 0,
    reveal = THREE.MathUtils.smoothstep(elapsed, 0.08, 0.38);
  m.kurama.visible = fade > 0.01;
  if (!m.kurama.visible) return;
  m.kurama.position.set(-(f.facing || 1) * 0.35, 0.012 - Math.max(0, f.y), -1.4);
  // The fox faces along the combat lane, independent of the actor’s camera-facing stance.
  m.kurama.rotation.set(0, (cast?.facing || f.facing || 1) * Math.PI / 2, 0);
  m.kurama.scale.setScalar(1);
  for (const { material, opacity } of m.kurama.userData.opacityTargets)
    material.opacity = opacity * fade * reveal;
  if (m.kuramaSummon)
    updateKuramaSummon(m.kuramaSummon, elapsed, windup, cast.move.active, fade, m.kurama.rotation.y);
  m.kurama.userData.tails.forEach((tail, index) => {
    tail.rotation.x = Math.sin(clock * 3.2 + index * 0.48) * 0.075;
    tail.rotation.y = Math.sin(clock * 2.4 + index * 0.37) * 0.08;
  });
}

function updateDetails(m, f, dt, clock) {
  const cast = f.currentMove,
    visual = cast?.move.visual,
    elapsed = cast?.elapsed || 0,
    windup = cast?.move.windup || 1,
    face = cast?.facing ?? f.facing ?? 1;
  m.root.updateMatrixWorld(true);
  const rig = m.character.model.rig;
  const front = leadIndex(m, face);
  const hand = m.bones[armNames(rig, front)[2]];
  const origin = m.skillOrigin;
  m.skillOriginActive = false;
  if (m.rasengan) {
    const live = visual === "rasengan" && elapsed < windup + cast.move.active;
    m.rasengan.visible = live;
    if (live && hand) {
      hand.getWorldPosition(origin);
      const direction = m.target.set(face, cast.context === "air" ? -.4 : 0, 0).normalize();
      const charge = THREE.MathUtils.smoothstep(elapsed, 0, windup);
      const fade = 1 - THREE.MathUtils.smoothstep(elapsed, windup + cast.move.active * .52, windup + cast.move.active);
      origin.addScaledVector(direction, .08 + charge * .19);
      m.rasengan.position.copy(m.root.worldToLocal(origin));
      spinChakraOrb(m.rasengan, clock * 2, (.08 + .26 * charge) * Math.max(.025, fade));
    }
  }
  if (m.bijuu) {
    m.bijuu.visible = visual === "bijuu" && elapsed < windup;
    if (visual === "bijuu" && hand) {
      const support = m.bones[armNames(rig, 1 - front)[2]];
      hand.getWorldPosition(origin);
      if (support) {
        support.getWorldPosition(m.target);
        if (m.target.x * face > origin.x * face) origin.copy(m.target);
      }
      const charge = THREE.MathUtils.smoothstep(elapsed, 0, windup);
      origin.x += face * (.16 + THREE.MathUtils.smoothstep(elapsed, 0, windup * .74) * .36);
      m.bijuu.position.copy(origin);
      m.root.worldToLocal(m.bijuu.position);
      m.skillOriginActive = true;
      spinChakraOrb(m.bijuu, clock, .1 + .55 * charge);
    }
    m.chakraCloak.visible = visual === "bijuu";
    if (m.chakraCloak.visible) {
      const fade = 1 - THREE.MathUtils.smoothstep(elapsed, windup, windup + cast.move.active + cast.move.recovery);
      m.chakraCloak.material.opacity = fade * (.04 + Math.min(1, elapsed / windup) * .09);
    }
  }
  if (m.cannon) {
    m.cannon.visible = !!cast && ["beam", "projectile"].includes(cast.move.kind);
    if (hand && m.cannon.visible) {
      const angle = cast.move.angle || 0;
      hand.getWorldPosition(m.cannon.position);
      m.root.worldToLocal(m.cannon.position);
      m.cannon.position.x += face * .07;
      m.cannon.rotation.set(0, 0, (face < 0 ? Math.PI : 0) + face * angle);
      m.cannon.updateWorldMatrix(true, false);
      m.cannon.localToWorld(origin.set(.44, 0, 0));
      m.skillOriginActive = true;
    }
  }
  if (visual === "kunai" && hand) {
    hand.getWorldPosition(origin);
    origin.x += face * .14;
    m.skillOriginActive = true;
  }
  if (m.antenna) {
    if (m.head) {
      m.head.getWorldPosition(m.worldPosition);
      m.root.worldToLocal(m.worldPosition);
      m.antenna.position.copy(m.worldPosition);
      m.antenna.position.y += 0.62;
      m.antenna.position.addScaledVector(
        new THREE.Vector3(0, 0, m.frontAxis).applyQuaternion(m.visual.quaternion).normalize(),
        0.18,
      );
    }
    m.antenna.quaternion.copy(m.visual.quaternion).multiply(m.screenFacing);
    m.antenna.rotation.z = damp(
      m.antenna.rotation.z,
      (f.currentMove?.move.animation === "antenna-beam" ? -0.12 : 0) + Math.sin(clock * 7) * 0.025 + f.vx * 0.006,
      dt,
      8,
    );
    if (cast?.move.animation === "antenna-beam") {
      m.antenna.localToWorld(origin.set(0, .55, 0));
      m.skillOriginActive = true;
    }
  }
  if (m.screenGroup && m.chest) {
    m.chest.getWorldPosition(m.worldPosition);
    m.root.worldToLocal(m.worldPosition);
    const forward = new THREE.Vector3(0, 0, m.frontAxis)
      .applyQuaternion(m.visual.quaternion)
      .normalize();
    m.screenGroup.position.copy(m.worldPosition).addScaledVector(forward, 0.51);
    m.screenGroup.position.y -= 0.34;
    m.screenGroup.quaternion.copy(m.visual.quaternion).multiply(m.screenFacing);
  }
  const flash = Math.min(0.8, Math.max(0, f.flash || 0) * 5);
  for (const material of m.materials) {
    if (!material.emissive) continue;
    material.emissive.set(flash ? "#ffb28a" : "#000000");
    material.emissiveIntensity = flash;
  }
  if (m.screen) {
    const beam = cast?.move.animation === "antenna-beam";
    m.screen.emissive.set(beam ? "#2aa5cf" : "#000000");
    m.screen.emissiveIntensity = beam ? 1.25 + Math.sin(clock * 22) * 0.2 : 0.9;
  }
}

export function animateExternal(m, f, dt, clock) {
  const cast = f.currentMove,
    face = cast?.facing ?? f.facing ?? 1,
    airborne = !f.grounded,
    walking = !airborne && !f.crouching && (f.action === "walk" || recoveryMovement(f.currentMove)),
    crouch = !!f.crouching,
    hurt = f.action === "hurt" || f.stun > 0,
    victory = f.action === "victory";
  const nextSkill = externalSkill(cast, m.type);
  if (cast) {
    m.skillPose = nextSkill;
  } else if (m.skillPose) {
    const weight = damp(m.skillPose.weight, 0, dt, 34);
    m.skillPose = weight > .008 ? { ...m.skillPose, weight } : null;
  }
  const skill = m.skillPose;
  m.clock += dt;
  m.crouchBlend = damp(m.crouchBlend || 0, crouch ? 1 : 0, dt, 18);
  const targetYaw = m.visual.userData.baseYaw + face * 0.84;
  m.yaw = damp(m.yaw ?? m.visual.rotation.y, targetYaw, dt, 18);
  const turn = 2 * Math.PI;
  m.spinOffset = nextSkill?.pose.spin
    ? face * turn * nextSkill.sweep
    : damp(THREE.MathUtils.euclideanModulo((m.spinOffset ?? 0) + Math.PI, turn) - Math.PI, 0, dt, 24);
  m.visual.rotation.y = m.yaw + m.spinOffset;
  const choice = animationName(m, f, walking, airborne, crouch, victory);
  const token = choice[1] ? cast?.id ?? (victory ? "victory" : "") : "";
  const rig = m.character.model.rig;
  const chest = m.chest;
  if (chest) chest.quaternion.copy(rest(chest).quaternion);
  if (choice[0]) play(m, choice[0], choice[1], token);
  m.mixer.update(dt);
  if (rig === "doraemon") doraPose(m, f, dt, walking, crouch, airborne, hurt);
  const lean = (skill?.pose.lean ?? 0) * (skill?.weight ?? 0);
  const twist = (skill?.pose.twist ?? 0) * (skill?.weight ?? 0) * (1 - 2 * (skill?.sweep ?? 0));
  if (chest) {
    const crouchLean = rig === "doraemon" ? 0 : m.crouchBlend * .12;
    chest.quaternion.multiply(m.deltaQuaternion.setFromEuler(
      new THREE.Euler(m.frontAxis * (crouchLean + lean), face * twist, hurt ? Math.sin(clock * 24) * .08 : 0),
    ));
  }
  m.root.position.set(f.x, Math.max(0, f.y), 0);
  m.visual.scale.setScalar(1);
  m.root.scale.setScalar(1);
  poseLocomotion(m, f, dt, walking, skill);
  poseArms(m, f, face, skill);
  animateKurama(m, f, cast, clock);
  updateDetails(m, f, dt, clock);
}
