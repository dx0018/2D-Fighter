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
  const standing = new THREE.Box3().setFromObject(m.head).max.y;
  f.crouching = true;
  f.action = "crouch";
  animate(m, f);
  assert.ok(new THREE.Box3().setFromObject(m.head).max.y < standing - 0.65);
  for (const leg of m.legs) {
    const box = new THREE.Box3().setFromObject(leg.foot);
    assert.ok(Math.abs(box.min.y) < 0.035, `ground contact ${box.min.y}`);
    assert.ok(Math.abs(leg.knee.position.x - leg.foot.position.x) > 0.1);
  }
  disposeTree(m.root);
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
