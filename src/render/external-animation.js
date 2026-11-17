import { poseLocomotion } from "./skeletal-locomotion.js";
import { recoveryMovement } from "../game/moves.js";
import { updateKuramaSummon } from "./kurama-summon.js";
import * as THREE from "three";
import { clamp, damp } from "./primitives.js";
import { solveTwoBone } from "./rig.js";
import { spinChakraOrb } from "./ninja-effects.js";

const rest = (bone) => bone && (bone.userData.restPose ||= {
  position: bone.position.clone(),
  quaternion: bone.quaternion.clone(),
});

function play(m, name, delta, oneShot = false, token = "") {
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

function animationName(m, f, walking, airborne, crouch, hurt, victory) {
  const rig = m.character.model.rig,
    clips = m.clips || {};
  if (rig === "mixamo") {
    if (victory && f.action === "victory") return [clips.victory, true];
    if (f.currentMove?.key === "attack" && f.grounded && !f.crouching)
      return [clips.attack, true];
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

function aimArm(m, upper, lower, hand, target, bendSide = 1) {
  if (!upper || !lower || !hand) return;
  m.root.updateMatrixWorld(true);
  const origin = upper.getWorldPosition(new THREE.Vector3()),
    elbow = lower.getWorldPosition(new THREE.Vector3()),
    wrist = hand.getWorldPosition(new THREE.Vector3()),
    upperLength = Math.max(0.08, origin.distanceTo(elbow)),
    lowerLength = Math.max(0.08, elbow.distanceTo(wrist)),
    pole = new THREE.Vector3(
      bendSide * 0.15 + m.forward.x * 0.5,
      target.y < origin.y ? 0.8 : -0.35,
      m.forward.z * 0.65,
    ),
    jointTarget = new THREE.Vector3(),
    endTarget = new THREE.Vector3();
  solveTwoBone(
    origin,
    target,
    pole,
    upperLength,
    lowerLength,
    jointTarget,
    endTarget,
    { axis: new THREE.Vector3(), bend: new THREE.Vector3() },
  );
  const oldJoint = lower.getWorldPosition(new THREE.Vector3()),
    fromA = oldJoint.sub(origin).normalize(),
    toA = jointTarget.clone().sub(origin).normalize();
  upper.getWorldQuaternion(m.worldQuaternion);
  m.deltaQuaternion.setFromUnitVectors(fromA, toA);
  m.worldQuaternion.premultiply(m.deltaQuaternion);
  upper.parent.getWorldQuaternion(m.parentQuaternion).invert();
  upper.quaternion.copy(m.parentQuaternion.multiply(m.worldQuaternion));
  m.root.updateMatrixWorld(true);

  const oldWrist = hand.getWorldPosition(new THREE.Vector3()),
    nowElbow = lower.getWorldPosition(new THREE.Vector3()),
    fromB = oldWrist.sub(nowElbow).normalize(),
    toB = endTarget.clone().sub(nowElbow).normalize();
  lower.getWorldQuaternion(m.worldQuaternion);
  m.deltaQuaternion.setFromUnitVectors(fromB, toB);
  m.worldQuaternion.premultiply(m.deltaQuaternion);
  lower.parent.getWorldQuaternion(m.parentQuaternion).invert();
  lower.quaternion.copy(m.parentQuaternion.multiply(m.worldQuaternion));
  m.root.updateMatrixWorld(true);
}

function doraPose(m, f, dt, clock, walking, crouch, airborne, cast, hurt) {
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
  if (spine)
    rig.Spine.quaternion.copy(spine.quaternion).multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(m.frontAxis * (0.16 * squat - 0.24 * (cast?.key === "attack" ? 1 : 0) + (airborne ? -0.12 : 0)), 0, 0),
      ),
    );
  if (chest)
    rig.Chest.quaternion.copy(chest.quaternion).multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(m.frontAxis * (0.12 * squat + (hurt ? -0.18 : 0)), 0, 0),
      ),
    );
  if (head) {
    rig.Head.quaternion.copy(head.quaternion).multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(m.frontAxis * (0.12 * squat + (airborne ? -0.08 : 0)), 0, 0),
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
          swing + (cast?.key === "attack" && side === f.facing ? -0.38 : 0) + (airborne ? -kick : 0),
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

function poseAim(m, f, cast, walking) {
  const rig = m.character.model.rig;
  let pose = null,
    bilateral = false;
  if (f.guarding && !cast) {pose="guard";bilateral=true;}
  else if (cast?.key === "attack") pose = "punch";
  else if (cast?.move.visual === "rasengan") pose = "rasengan";
  else if (cast?.move.visual === "bijuu") {
    pose = "bijuu";
  } else if (cast?.move.animation?.includes("cannon")) pose = "cannon";
  else if (cast?.move.animation === "low-cannon") pose = "low";
  else if (cast?.move.animation === "antenna-beam") {
    pose = "beam";
    bilateral = true;
  } else if (cast?.move.animation === "pulse" || cast?.move.animation === "retreat-pulse") {
    pose = "pulse";
    bilateral = true;
  }
  if (!pose) return;
  const names = rig === "mixamo"
    ? [[m.bones.leftUpper, m.bones.leftLower, m.bones.leftHand], [m.bones.rightUpper, m.bones.rightLower, m.bones.rightHand]]
    : rig === "teletubby"
      ? [[m.bones.Upper_Arm_L, m.bones.Forearm_L, m.bones.Hand_L], [m.bones.Upper_Arm_R, m.bones.Forearm_R, m.bones.Hand_R]]
      : [[m.bones.UpperArm_L, m.bones.Forearm_L, m.bones.Hand_L], [m.bones.UpperArm_R, m.bones.Forearm_R, m.bones.Hand_R]];
  const front = (f.facing > 0 ? 0 : 1) ^ (m.frontAxis < 0 ? 1 : 0),
    targets = pose === "guard"
      ? [[.22,2.05,.5],[-.22,2.05,.5]]
      : pose === "beam"
      ? [[0.45, 2.16, 0.1], [-0.45, 2.16, 0.1]]
      : pose === "pulse"
        ? [[0.85, 1.55, 0.2], [-0.85, 1.55, 0.2]]
        : pose === "bijuu"
          ? [[0.15, 1.85, 0.8], [-0.15, 1.85, 0.8]]
          : pose === "low"
            ? [[0.55, 0.43, 0.28], [-0.42, 1.05, 0.16]]
            : pose === "cannon"
              ? [[0.92, 1.62, 0.18], [-0.42, 1.1, 0.24]]
              : pose === "rasengan"
                ? [[0.5, 1.62, 0.34], [0.18, 1.52, 0.32]]
                : [[0.92, 1.45, 0.3], [-0.25, 1.24, 0.36]];
  m.visual.updateMatrixWorld(true);
  const selected = bilateral ? [0, 1] : [front];
  for (const index of selected) {
    const local = new THREE.Vector3(...targets[index]);
    local.z *= m.frontAxis;
    let target = m.visual.localToWorld(local);
    if (cast?.key === "attack" && rig === "mixamo") continue;
    if (pose === "bijuu") {
      const hand = names[index][2],
        charge = clamp(
          (cast?.elapsed || 0) / Math.max(0.08, (cast?.move.windup || 0.9) * 0.58),
          0,
          1,
        );
      if (hand) {
        hand.getWorldPosition(m.worldPosition);
        target = m.worldPosition.clone().lerp(target, charge);
      }
    }
    if (cast?.key === "attack") {
      const hand = names[index][2];
      if (hand) {
        const elapsed = cast.elapsed || 0,
          move = cast.move,
          windup = Math.max(0.001, move.windup || 0.08),
          active = Math.max(0.001, move.active || 0.1),
          recovery = Math.max(0.001, move.recovery || 0.18),
          weight = elapsed < windup
            ? 0.15 + 0.85 * (elapsed / windup) ** 2
            : elapsed < windup + active
              ? 1
              : 1 - clamp((elapsed - windup - active) / recovery, 0, 1);
        hand.getWorldPosition(m.worldPosition);
        target = m.worldPosition.clone().lerp(target, weight);
      }
    }
    aimArm(m, ...names[index], target, index === 0 ? -1 : 1);
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
    face = f.facing ?? 1;
  m.root.updateMatrixWorld(true);
  if (m.rasengan) {
    const live = visual === "rasengan" && elapsed < windup + cast.move.active;
    m.rasengan.visible = !!live;
    if (live) {
      const hand = face > 0 ? m.bones.leftHand || m.bones.Hand_L : m.bones.rightHand || m.bones.Hand_R;
      if (hand) {
        hand.getWorldPosition(m.worldPosition);
        m.root.worldToLocal(m.worldPosition);
        m.rasengan.position.copy(m.worldPosition);
      }
      m.rasengan.position.z += m.frontAxis * 0.08;
      spinChakraOrb(m.rasengan, clock * 2, 0.15 + 0.19 * Math.min(1, elapsed / Math.max(0.001, windup)));
    }
  }
  if (m.bijuu) {
    m.bijuu.visible = visual === "bijuu" && elapsed < windup;
    if (m.bijuu.visible) {
      const front = (face > 0 ? 0 : 1) ^ (m.frontAxis < 0 ? 1 : 0);
      const hand = front === 0 ? m.bones.leftHand : m.bones.rightHand;
      if (hand) {
        hand.getWorldPosition(m.worldPosition);
        m.root.worldToLocal(m.worldPosition);
        m.bijuu.position.copy(m.worldPosition);
        m.bijuu.position.x += face * 0.52;
      }
      spinChakraOrb(m.bijuu, clock, 0.15 + 0.5 * Math.min(1, elapsed / Math.max(0.001, windup)));
    }
    m.chakraCloak.visible = visual === "bijuu";
    m.chakraCloak.material.opacity = 0.035 + (elapsed / Math.max(0.001, windup)) * 0.055;
  }
  if (m.cannon) {
    m.cannon.visible = !!cast && ["beam", "projectile"].includes(cast.move.kind);
    const hand = face > 0 ? m.bones.Hand_L : m.bones.Hand_R;
    if (hand && m.cannon.visible) {
      hand.getWorldPosition(m.worldPosition);
      m.root.worldToLocal(m.worldPosition);
      m.cannon.position.copy(m.worldPosition);
      m.cannon.position.x += face * 0.1;
    }
    m.cannon.rotation.y = face > 0 ? 0 : Math.PI;
    m.cannon.rotation.z = cast?.move.angle || 0;
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
      8,
      dt,
    );
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

export function animateExternal(m, f, dt, clock, hitstop = 0) {
  const face = f.facing ?? 1,
    airborne = !f.grounded,
    walking = !airborne && !f.crouching && (f.action === "walk" || recoveryMovement(f.currentMove)),
    crouch = !!f.crouching,
    hurt = f.action === "hurt" || f.stun > 0,
    victory = f.action === "victory",
    bijuuCharge = f.currentMove?.move.visual === "bijuu"
      ? clamp((f.currentMove.elapsed || 0) / Math.max(0.08, f.currentMove.move.windup || 0.95), 0, 1)
      : 0;
  m.clock += dt;
  m.crouchBlend = damp(m.crouchBlend || 0, crouch ? 1 : 0, 18, dt);
  const targetYaw = m.visual.userData.baseYaw + face * 0.84;
  m.visual.rotation.y = damp(m.visual.rotation.y, targetYaw, 18, dt);
  const choice = animationName(m, f, walking, airborne, crouch, hurt, victory);
  const token = choice[1] ? f.currentMove?.id ?? (victory ? "victory" : "") : "";
  if (choice[0]) play(m, choice[0], dt, choice[1], token);
  if (dt > 0) m.mixer.update(dt);
  if (m.character.model.rig === "doraemon")
    doraPose(m, f, dt, clock, walking, crouch, airborne, f.currentMove, hurt);
  else if (m.hips) {
    const hip = rest(m.hips);
    if (hip) m.hips.position.copy(hip.position);
  }
  if (
    m.character.model.rig !== "doraemon" &&
    m.chest &&
    (hurt || m.crouchBlend > 0.001 || bijuuCharge > 0)
  ) {
    const chest = rest(m.chest);
    if (chest)
      m.chest.quaternion
        .copy(chest.quaternion)
        .multiply(
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              m.frontAxis * (m.crouchBlend * 0.12 + bijuuCharge * 0.12),
              0,
              hurt ? Math.sin(clock * 24) * 0.08 : 0,
              "XYZ",
            ),
          ),
        );
  }
  m.root.position.set(f.x, Math.max(0, f.y), 0);
  m.root.updateMatrixWorld(true);
  m.forward.set(0, 0, m.frontAxis).applyQuaternion(m.visual.quaternion).normalize();
  m.visual.scale.setScalar(1);
  poseLocomotion(m,f,dt,walking);
  poseAim(m, f, f.currentMove, walking);
  animateKurama(m, f, f.currentMove, clock);
  updateDetails(m, f, dt, clock);
  m.root.scale.setScalar(1);
}
