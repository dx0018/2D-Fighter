import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeFighter } from "../src/render/fighters.js";
import { animateFighter } from "../src/render/animation.js";
import { selectMove } from "../src/game/moves.js";
import { characters, maps } from "../src/config/content.js";
import { disposeTree } from "../src/render/primitives.js";
import { Game } from "../src/game/engine.js";
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

test("Doraemon's chest and diving cannon poses align with the shot in both directions", () => {
  for (const context of ["neutral", "air"])
    for (const facing of [1, -1]) {
      const m = makeFighter(characters[0]),
        f = state(),
        move = selectMove(characters[0], "skill", context);
      f.facing = facing;
      f.grounded = context !== "air";
      f.y = context === "air" ? 2 : 0;
      f.action = "skill";
      f.currentMove = {
        key: "skill",
        move,
        elapsed: move.windup + 0.02,
        facing,
      };
      for (let i = 0; i < 90; i++) animateFighter(m, f, 1 / 60, i / 60, 0);
      m.root.updateMatrixWorld(true);

      const muzzle = m.cannon.getWorldPosition(new THREE.Vector3()),
        direction = new THREE.Vector3(1, 0, 0).transformDirection(
          m.cannon.matrixWorld,
        ),
        expectedY = f.y + (context === "air" ? 1.2 : 1.75);
      assert.ok(Math.abs(muzzle.y - expectedY) < 0.16, `${context} muzzle Y`);
      assert.ok(
        direction.x * facing > 0,
        `${context} aims toward the opponent`,
      );
      if (context === "air")
        assert.ok(
          direction.y < 0,
          "the diving cannon points down on both sides",
        );
      m.skeleton.dispose();
      disposeTree(m.root);
    }
});

test("walk start, release and reversal keep feet grounded without large pose jumps", () => {
  const g = new Game({ characters, map: maps[0] }),
    m = makeFighter(characters[0]),
    f = g.state.fighters[0];
  g.state.phase = "fighting";
  f.x = -10;
  g.state.fighters[1].x = 20;
  animate(m, f);
  let previous = m.legs.map((leg) =>
    leg.foot.getWorldPosition(new THREE.Vector3()),
  );
  for (let i = 0; i < 120; i++) {
    const input =
      i < 40 ? { right: true } : i < 65 ? {} : i < 100 ? { left: true } : {};
    g.step(1 / 60, [input, {}]);
    animateFighter(m, f, 1 / 60, i / 60);
    m.root.updateMatrixWorld(true);
    const feet = m.legs.map((leg) =>
      leg.foot.getWorldPosition(new THREE.Vector3()),
    );
    feet.forEach((foot, j) => {
      assert.ok(foot.distanceTo(previous[j]) < 0.4, `foot jumps on frame ${i}`);
      const floor = new THREE.Box3().setFromObject(m.legs[j].foot, true).min.y;
      assert.ok(floor > -0.035, `floor penetration on frame ${i}`);
      if (m.legs[j].planted)
        assert.ok(floor < 0.04, `support foot floats on frame ${i}`);
    });
    previous = feet;
  }
  m.skeleton.dispose();
  disposeTree(m.root);
});

test("the first walking frame plants a real support foot without sliding the idle pose", () => {
  const g = new Game({ characters, map: maps[0] });
  g.state.phase = "fighting";
  const f = g.state.fighters[0],
    m = makeFighter(characters[0]);
  animate(m, f);
  const before = m.legs.map((leg) =>
    leg.foot.getWorldPosition(new THREE.Vector3()),
  );
  g.step(1 / 60, [{ right: true }, {}]);
  animateFighter(m, f, 1 / 60, 1);
  m.root.updateMatrixWorld(true);
  assert.ok(m.legs.some((leg) => leg.planted));
  m.legs.forEach((leg, i) => {
    if (leg.planted)
      assert.ok(
        leg.foot.getWorldPosition(new THREE.Vector3()).distanceTo(before[i]) <
          0.025,
      );
  });
  m.skeleton.dispose();
  disposeTree(m.root);
});

test("a normal punch extends before contact and returns to guard without a release snap", () => {
  const m = makeFighter(characters[0]),
    f = state(),
    move = f.character.moves.attack;
  animate(m, f);
  const guard = m.arms[1].hand.getWorldPosition(new THREE.Vector3());
  let previous = guard.clone(),
    beforeContact;
  f.action = "attack";
  f.currentMove = { key: "attack", move, elapsed: 0, facing: 1 };
  for (let i = 0; i < 30; i++) {
    const elapsed = (i + 1) / 60;
    if (elapsed < move.windup + move.active + move.recovery)
      f.currentMove.elapsed = elapsed;
    else {
      f.currentMove = null;
      f.action = "idle";
    }
    animateFighter(m, f, 1 / 60, elapsed);
    m.root.updateMatrixWorld(true);
    const fist = m.arms[1].hand.getWorldPosition(new THREE.Vector3());
    assert.ok(fist.distanceTo(previous) < 0.4, `fist snaps on frame ${i}`);
    if (elapsed < move.windup) beforeContact = fist.x;
    previous = fist;
  }
  assert.ok(
    beforeContact > guard.x + 0.15,
    "the fist travels before the hit window",
  );
  assert.ok(
    previous.distanceTo(guard) < 0.05,
    "recovery ends in the original guard",
  );
  m.skeleton.dispose();
  disposeTree(m.root);
});
