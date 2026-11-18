import * as THREE from "three";
import { aimChain, resetBones } from "./articulated-pose.js";
import { SUSANOO_ARCHERY, susanooArchery } from "../game/susanoo-archery.js";

/** Preserve the uploaded bow as one rigid part and expose its authored limb tips. */
export function bindSusanooBow(root, bones) {
  const bone = bones.Bow_L;
  if (!bone) return null;
  let authored = null;
  root.traverse(node => { if (node.userData.bow_tip_top) authored = node.userData; });
  if (!authored) return null;
  root.updateMatrixWorld(true);
  const topWorld = new THREE.Vector3(...authored.bow_tip_top);
  const bottomWorld = new THREE.Vector3(...authored.bow_tip_bottom);
  const up = topWorld.clone().sub(bottomWorld).normalize();
  const forward = new THREE.Vector3(0, 0, 1).addScaledVector(up, -up.z).normalize();
  const side = new THREE.Vector3().crossVectors(forward, up).normalize();
  const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, up, side));
  const correction = basis.invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const top = new THREE.Object3D(), bottom = new THREE.Object3D();
  top.name = "authored-bow-top";bottom.name = "authored-bow-bottom";
  top.position.copy(bone.worldToLocal(topWorld));bottom.position.copy(bone.worldToLocal(bottomWorld));
  bone.add(top, bottom);
  return {bone, top, bottom, correction};
}

export function poseSusanooArchery(m, fighter, cast, opponent, fade) {
  const fx = m.sasukeFx;
  const cfg = SUSANOO_ARCHERY;
  const shot = cast.archery || susanooArchery(fighter, opponent, cast.move);
  const elapsed = cast.elapsed;
  const reveal = THREE.MathUtils.smoothstep(elapsed, 0, 0.22);
  const draw = THREE.MathUtils.smoothstep(elapsed, 0.15, cast.move.windup);
  const release = THREE.MathUtils.smoothstep(elapsed, cast.move.windup, cast.move.windup + cast.move.active);
  const drawLength = THREE.MathUtils.lerp(cfg.drawStart, shot.drawEnd, draw * (1 - release));
  const fullRoot = m.fullSusanoo || fx.skeleton.root;
  fullRoot.position.set(shot.root.x - fighter.x, shot.root.y - Math.max(0, fighter.y), shot.root.z);
  fullRoot.rotation.set(0, shot.facing * Math.PI / 2, 0);
  for (const mat of m.fullMaterials || []) mat.opacity = 0.8 * reveal * fade;
  if (!m.fullSusanoo) for (const mat of fx.skeleton.materials) {
    mat.userData.baseOpacity ??= mat.opacity;
    mat.opacity = mat.userData.baseOpacity * reveal * fade;
  }
  const s = fx.archeryScratch ||= {
    grip: new THREE.Vector3(), nock: new THREE.Vector3(), direction: new THREE.Vector3(),
    up: new THREE.Vector3(), side: new THREE.Vector3(), point: new THREE.Vector3(),
    matrix: new THREE.Matrix4(), worldQ: new THREE.Quaternion(), parentQ: new THREE.Quaternion(),
  };
  s.grip.set(shot.grip.x, shot.grip.y, shot.grip.z);
  s.grip.y -= .52 * (1 - THREE.MathUtils.smoothstep(elapsed, 0, .26));
  s.direction.set(shot.direction.x, shot.direction.y, shot.direction.z);
  s.up.set(shot.up.x, shot.up.y, shot.up.z);
  s.nock.copy(s.grip).addScaledVector(s.direction, -drawLength);
  m.root.updateMatrixWorld(true);
  if (m.fullBones) {
    resetBones(m.fullBones);
    m.fullBones.Chest.rotation.x += .045 * draw * (1 - release) - .08 * Math.sin(Math.PI * release);
    s.point.copy(s.grip); fullRoot.worldToLocal(s.point);
    aimChain(m, fullRoot, m.fullBones, ['UpperArm_L', 'Forearm_L', 'Hand_L'], s.point.toArray(), [1, 0, 0.5]);
    s.point.copy(s.nock);fullRoot.worldToLocal(s.point);
    aimChain(m, fullRoot, m.fullBones, ['UpperArm_R', 'Forearm_R', 'Hand_R'], [s.point.x, s.point.y, s.point.z], [-1, 0, 0.5]);
  }
  // Bow, string, nock and arrow share one world-space socket and aiming basis.
  s.side.crossVectors(s.direction, s.up).normalize();
  s.matrix.makeBasis(s.direction, s.up, s.side);
  fx.bow.position.copy(s.grip);m.root.worldToLocal(fx.bow.position);
  fx.bow.quaternion.setFromRotationMatrix(s.matrix);
  fx.bow.visible = true;
  if (m.fullBow) {
    s.worldQ.copy(fx.bow.quaternion).multiply(m.fullBow.correction);
    m.fullBow.bone.parent.getWorldQuaternion(s.parentQ).invert();
    m.fullBow.bone.quaternion.copy(s.parentQ.multiply(s.worldQ));
    m.root.updateMatrixWorld(true);
  }
  fx.bow.children[0].visible = !m.fullBow;
  fx.bow.children[1].visible = !m.fullBow;
  for (const material of fx.bow.userData.materials) {
    material.userData.baseOpacity ??= material.opacity;
    material.opacity = material.userData.baseOpacity * reveal * fade;
  }
  fx.charge.quaternion.copy(fx.bow.quaternion);
  fx.charge.scale.setScalar(cfg.arrowScale);
  fx.charge.position.copy(s.grip).addScaledVector(s.direction, cfg.arrowTail * cfg.arrowScale - drawLength);
  m.root.worldToLocal(fx.charge.position);
  for (const part of fx.charge.children) {
    const mat = part.material;
    mat.userData.baseOpacity ??= mat.opacity;
    mat.opacity = mat.userData.baseOpacity * (0.25 + draw * 0.75);
  }
  m.root.updateMatrixWorld(true);
  const vertices = fx.string.geometry.attributes.position;
  for (const [index, marker] of [[0, m.fullBow?.top || fx.bow.userData.top], [2, m.fullBow?.bottom || fx.bow.userData.bottom]]) {
    marker.getWorldPosition(s.point);m.root.worldToLocal(s.point);
    vertices.setXYZ(index, s.point.x, s.point.y, s.point.z);
  }
  s.point.copy(s.nock);m.root.worldToLocal(s.point);
  vertices.setXYZ(1, s.point.x, s.point.y, s.point.z);
  vertices.needsUpdate = true;
  const motes = fx.bow.userData.motes;
  const particles = motes.geometry.attributes.position;
  for (let i = 0; i < particles.count; i++) {
    const a = elapsed * 6 + i * 2.39996;
    particles.setXYZ(i, -0.65 + (i / particles.count) * 1.2, Math.sin(a) * 0.3, Math.cos(a) * 0.3);
  }
  particles.needsUpdate = true;
  motes.material.opacity = 0.65 * reveal * fade;
  fx.string.material.opacity = 0.85 * reveal * fade;
  fx.string.frustumCulled = false;
  // Diagnostics are also used to check actual asset hand sockets in browser tests.
  fx.archery = {shot, drawLength};
}
