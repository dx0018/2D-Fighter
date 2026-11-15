import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeFighter } from "../src/render/fighters.js";
import { animateFighter } from "../src/render/animation.js";
import { characters } from "../src/config/content.js";
import { disposeTree } from "../src/render/primitives.js";
const state = () => ({
  character: characters[0],
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  walkDistance: 0,
  grounded: true,
  facing: 1,
  action: "idle",
  crouching: false,
});
function animate(m, f, n = 60) {
  for (let i = 0; i < n; i++) animateFighter(m, f, 1 / 60, i / 60, 0);
  m.root.updateMatrixWorld(true);
}
test("crouch lowers the head, bends the legs and keeps both feet on the floor", () => {
  const m = makeFighter(characters[0]),
    f = state();
  animate(m, f);
  const standing = new THREE.Box3().setFromObject(m.head, true).max.y;
  f.crouching = true;
  f.action = "crouch";
  animate(m, f);
  assert.ok(
    new THREE.Box3().setFromObject(m.head, true).max.y < standing - 0.55,
  );
  for (const part of m.body.children.filter((o) => o.isMesh))
    assert.ok(
      new THREE.Box3().setFromObject(part, true).min.y > -0.035,
      "torso stays above the floor",
    );
  for (const leg of m.legs) {
    const box = new THREE.Box3().setFromObject(leg.foot);
    assert.ok(Math.abs(box.min.y) < 0.035, `ground contact ${box.min.y}`);
    assert.ok(
      Math.abs(leg.knee.distanceTo(leg.upper.position) - leg.upperLength) <
        1e-5,
    );
    assert.ok(
      Math.abs(leg.endpoint.distanceTo(leg.knee) - leg.lowerLength) < 1e-5,
    );
  }
  disposeTree(m.root);
});
test("all walking and crouch poses preserve limb lengths and torso proportions", () => {
  const m = makeFighter(characters[0]),
    f = state();
  for (let i = 0; i < 180; i++) {
    f.walkDistance = (i / 180) * 2.1;
    f.vx = 6.6;
    f.action = i < 120 ? "walk" : "crouch";
    f.crouching = i >= 120;
    animateFighter(m, f, 1 / 60, i / 60, 0);
    for (const limb of [...m.arms, ...m.legs]) {
      assert.ok(
        Math.abs(limb.knee.distanceTo(limb.upper.position) - limb.upperLength) <
          1e-5,
      );
      assert.ok(
        Math.abs(limb.endpoint.distanceTo(limb.knee) - limb.lowerLength) < 1e-5,
      );
      assert.deepEqual(limb.upper.scale.toArray(), [1, 1, 1]);
    }
    assert.deepEqual(m.body.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(m.head.scale.toArray(), [1, 1, 1]);
  }
  disposeTree(m.root);
  m.skeleton.dispose();
});
test("support foot stays planted during actual horizontal travel instead of swinging into depth", () => {
  const m = makeFighter(characters[0]),
    f = state();
  animate(m, f);
  f.action = "walk";
  f.vx = 6.6;
  f.walkDistance = 0.25 * 2.1;
  animate(m, f);
  const before = m.legs[0].foot.getWorldPosition(new THREE.Vector3());
  f.x += 0.1;
  f.walkDistance += 0.1;
  animate(m, f, 1);
  const after = m.legs[0].foot.getWorldPosition(new THREE.Vector3());
  assert.ok(
    Math.abs(after.x - before.x) < 0.035,
    `planted drift ${after.x - before.x}`,
  );
  assert.ok(Math.abs(after.y - before.y) < 0.015);
  disposeTree(m.root);
});
test("jump tucks the legs, and paused animation holds the complete pose", () => {
  const m = makeFighter(characters[0]),
    f = state();
  f.grounded = false;
  f.y = 2;
  f.vy = 1;
  f.action = "jump";
  animate(m, f);
  assert.ok(m.legs.every((l) => l.foot.position.y > 0.4));
  const before = m.root.toJSON();
  animateFighter(m, f, 0, 200, 0);
  assert.deepEqual(m.root.toJSON(), before);
  disposeTree(m.root);
});
test("reversing movement does not teleport an already planted support foot", () => {
  const m = makeFighter(characters[0]),
    f = state();
  f.action = "walk";
  f.vx = 6.6;
  f.walkDistance = 0.2 * 2.1;
  animate(m, f);
  const planted = m.legs[0].foot.getWorldPosition(new THREE.Vector3());
  f.vx = -6.6;
  f.x -= 0.06;
  f.walkDistance += 0.06;
  animate(m, f, 1);
  const after = m.legs[0].foot.getWorldPosition(new THREE.Vector3());
  assert.ok(after.distanceTo(planted) < 0.035);
  disposeTree(m.root);
  m.skeleton.dispose();
});
