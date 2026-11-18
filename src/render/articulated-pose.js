import * as THREE from "three";
import { solveTwoBone } from "./rig.js";

export function captureBones(scene) {
  const bones = {};
  scene.traverse(node => {
    if (!node.isBone) return;
    bones[node.name] = node;
    node.userData.bindPose = { position: node.position.clone(), quaternion: node.quaternion.clone() };
  });
  return bones;
}
export function resetBones(bones) {
  for (const bone of Object.values(bones)) {
    const rest = bone.userData.bindPose;
    bone.position.copy(rest.position);
    bone.quaternion.copy(rest.quaternion);
  }
}
// World-space two-bone IK, preserving mesh weights and authored bone lengths.
export function aimChain(owner, space, bones, names, localTarget, localPole = [0, 0, 1], upright = false, weight = 1) {
  const [upper, lower, end] = names.map(name => bones[name]);
  if (!upper || !lower || !end) return;
  if (upright && !end.userData.spaceOrientation) {
    end.userData.spaceOrientation = space.getWorldQuaternion(new THREE.Quaternion()).invert()
      .multiply(end.getWorldQuaternion(new THREE.Quaternion()));
  }
  const s = owner.ikScratch ||= {
    origin:new THREE.Vector3(), joint:new THREE.Vector3(), end:new THREE.Vector3(),
    target:new THREE.Vector3(), pole:new THREE.Vector3(), a:new THREE.Vector3(), b:new THREE.Vector3(),
    from:new THREE.Vector3(), to:new THREE.Vector3(), q:new THREE.Quaternion(), parent:new THREE.Quaternion(), delta:new THREE.Quaternion(),
    baseUpper: new THREE.Quaternion(), baseLower: new THREE.Quaternion(),
    work:{axis:new THREE.Vector3(),bend:new THREE.Vector3()},
  };
  if (weight < 1) {
    s.baseUpper.copy(upper.quaternion);
    s.baseLower.copy(lower.quaternion);
  }
  owner.root.updateMatrixWorld(true);
  upper.getWorldPosition(s.origin);lower.getWorldPosition(s.joint);end.getWorldPosition(s.end);
  s.target.set(...localTarget);space.localToWorld(s.target);
  s.pole.set(...localPole).transformDirection(space.matrixWorld);
  solveTwoBone(s.origin,s.target,s.pole,s.origin.distanceTo(s.joint),s.joint.distanceTo(s.end),s.a,s.b,s.work);
  s.from.copy(s.joint).sub(s.origin).normalize();s.to.copy(s.a).sub(s.origin).normalize();
  upper.getWorldQuaternion(s.q);s.delta.setFromUnitVectors(s.from,s.to);s.q.premultiply(s.delta);
  upper.parent.getWorldQuaternion(s.parent).invert();upper.quaternion.copy(s.parent.multiply(s.q));
  owner.root.updateMatrixWorld(true);
  lower.getWorldPosition(s.joint);end.getWorldPosition(s.end);
  s.from.copy(s.end).sub(s.joint).normalize();s.to.copy(s.b).sub(s.joint).normalize();
  lower.getWorldQuaternion(s.q);s.delta.setFromUnitVectors(s.from,s.to);s.q.premultiply(s.delta);
  lower.parent.getWorldQuaternion(s.parent).invert();lower.quaternion.copy(s.parent.multiply(s.q));
  if (weight < 1) {
    upper.quaternion.slerp(s.baseUpper, 1 - weight);
    lower.quaternion.slerp(s.baseLower, 1 - weight);
  }
  if (upright) {
    space.getWorldQuaternion(s.q).multiply(end.userData.spaceOrientation);
    end.parent.getWorldQuaternion(s.parent).invert();end.quaternion.copy(s.parent.multiply(s.q));
  }
  owner.root.updateMatrixWorld(true);
}
