import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/engine.js";
import { characters, maps } from "../src/config/content.js";
import { selectMove, moveList } from "../src/game/moves.js";
import { segmentHitsBox } from "../src/game/collision.js";
const tick = (g, t, input = [{}, {}]) => {
  for (let i = 0; i < t - 1e-7; i += 1 / 120)
    g.step(Math.min(1 / 120, t - i), input);
};
function match() {
  const g = new Game({ characters, map: maps[0] });
  g.state.phase = "fighting";
  g.state.fighters[0].x = -3;
  g.state.fighters[1].x = 3;
  return g;
}
test("both kits expose five named skills, with shared energy costs and distinct high/low/air behavior", () => {
  for (const c of characters) {
    const moves = moveList(c);
    assert.equal(moves.length, 5);
    assert.equal(new Set(moves.map((m) => m.name)).size, 5);
    assert.ok(moves.every((m) => m.cost === 24));
    assert.equal(selectMove(c, "skill", "crouch").posture, "crouch");
    assert.notEqual(selectMove(c, "attack", "air").name, c.moves.attack.name);
  }
});
test("forward is relative to the enemy on either side for both players", () => {
  for (const p of [0, 1])
    for (const side of [-1, 1]) {
      const g = match(),
        f = g.state.fighters[p],
        enemy = g.state.fighters[1 - p];
      f.x = side * 3;
      enemy.x = -side * 3;
      const input = [{}, {}];
      input[p] = { skill: true, [side === 1 ? "left" : "right"]: true };
      g.step(1 / 120, input);
      assert.equal(f.currentMove.context, "forward");
      assert.equal(f.currentMove.move.kind, "dash");
      assert.equal(f.currentMove.facing, -side);
    }
});
test("standing Po fires from the antenna along a locked diagonal ray and only hits once", () => {
  const g = match(),
    po = g.state.fighters[1];
  g.step(1 / 120, [{}, { skill: true }]);
  assert.equal(po.currentMove.move.name, "天线光线");
  tick(g, 0.34);
  const ray = { ...po.currentMove.ray };
  assert.ok(Math.abs(ray.y - 3.15) < 0.01);
  assert.ok(ray.dy < 0 && ray.dx < 0);
  assert.equal(g.state.fighters[0].hp, 85);
  tick(g, 0.18);
  assert.equal(g.state.fighters[0].hp, 85);
  assert.deepEqual(po.currentMove.ray, ray);
});
test("opposing horizontal keys cancel, and releasing movement selects the neutral skill", () => {
  const g = match();
  g.step(1 / 120, [{}, { left: true, right: true, skill: true }]);
  assert.equal(g.state.fighters[1].currentMove.move.name, "天线光线");
});
test("a crouching skill preserves the low hurtbox throughout its cast after direction is released", () => {
  const g = match(),
    f = g.state.fighters[1];
  g.step(1 / 120, [{}, { crouch: true, skill: true }]);
  assert.equal(f.currentMove.move.name, "贴地滑踢");
  tick(g, 0.32);
  assert.equal(f.crouching, true);
  assert.equal(f.currentMove.context, "crouch");
  tick(g, 0.6);
  assert.equal(f.crouching, false);
});
test("chest-height cannon reaches crouching opponents while the ground shot stays low", () => {
  const mid = match();
  tick(mid, 0.9, [{ skill: true }, { crouch: true }]);
  assert.equal(mid.state.fighters[1].hp, 85);
  const low = match();
  tick(low, 0.9, [{ crouch: true, skill: true }, { crouch: true }]);
  assert.equal(low.state.fighters[1].hp, 88);
});
test("jumping clears the low projectile and low sweep", () => {
  const g = match(),
    enemy = g.state.fighters[1];
  enemy.y = 3;
  enemy.vy = 5;
  enemy.grounded = false;
  tick(g, 0.7, [{ crouch: true, skill: true }, {}]);
  assert.equal(enemy.hp, 100);
  const sweep = match();
  sweep.state.fighters[0].x = -1;
  sweep.state.fighters[1].x = 1;
  sweep.state.fighters[1].y = 2;
  sweep.state.fighters[1].grounded = false;
  sweep.state.fighters[1].vy = 4;
  tick(sweep, 0.3, [{ crouch: true, attack: true }, {}]);
  assert.equal(sweep.state.fighters[1].hp, 100);
});
test("jump plus skill in one press waits through takeoff and selects an air move once", () => {
  for (const p of [0, 1]) {
    const g = match(),
      input = [{}, {}];
    input[p] = { jump: true, skill: true };
    g.step(1 / 120, input);
    const f = g.state.fighters[p];
    assert.ok(f.jumpStartup > 0);
    assert.equal(f.energy, 100);
    tick(g, 0.11);
    assert.ok(f.y > 0);
    assert.equal(f.currentMove.context, "air");
    assert.ok(f.energy < 80);
    const id = f.currentMove.id;
    tick(g, 0.1);
    assert.equal(f.currentMove.id, id);
  }
});
test("direction is captured when buffering a tap during hitstop, not at delayed activation", () => {
  const g = match();
  g.state.hitstop = 0.07;
  g.step(0.01, [{}, { left: true, skill: true }]);
  tick(g, 0.01);
  tick(g, 0.08);
  const f = g.state.fighters[1];
  assert.equal(f.currentMove.move.kind, "dash");
  assert.equal(f.currentMove.context, "forward");
});
test("variants share the skill cooldown and cannot chain by changing direction", () => {
  const g = match(),
    f = g.state.fighters[1];
  g.step(1 / 120, [{}, { skill: true }]);
  tick(g, 1);
  assert.equal(f.currentMove, null);
  const energy = f.energy;
  g.step(1 / 120, [{}, { right: true, skill: true }]);
  assert.equal(f.currentMove, null);
  assert.ok(f.energy >= energy);
  assert.ok(f.cooldowns.skill > 1);
});
test("backward skills create space, and landing cancels an unfinished air cast", () => {
  const g = match(),
    f = g.state.fighters[1];
  g.step(1 / 120, [{}, { right: true, skill: true }]);
  tick(g, 0.5);
  assert.ok(f.x > 4);
  assert.equal(f.cooldownTotals.skill, 2.8);
  const air = match(),
    dora = air.state.fighters[0];
  dora.y = 0.015;
  dora.vy = -3;
  dora.grounded = false;
  air.step(1 / 120, [{ skill: true }, {}]);
  assert.equal(dora.grounded, true);
  assert.equal(dora.currentMove, null);
  assert.equal(air.state.projectiles.length, 0);
  assert.ok(dora.landingTimer > 0);
});
test("interrupting an antenna charge prevents laser release", () => {
  const events = [],
    g = match();
  g.onEvent = (e) => events.push(e);
  g.state.fighters[0].x = -1;
  g.state.fighters[1].x = 1;
  g.step(1 / 120, [{ attack: true }, { skill: true }]);
  tick(g, 0.5);
  assert.equal(g.state.fighters[0].hp, 100);
  assert.equal(
    events.filter((e) => e.type === "release" && e.player === 1).length,
    0,
  );
});
test("swept diagonal collision catches crossing rays and rejects space outside the ray", () => {
  assert.equal(segmentHitsBox(-5, 5, 5, -1, 0.2, 0, 1, 1, 2.5), true);
  assert.equal(segmentHitsBox(-5, 5, 5, -1, 0.2, -4, 1, 0, 1), false);
  assert.equal(segmentHitsBox(0, 4, 0, -1, 0.1, 0, 1, 0, 2), true);
  assert.equal(segmentHitsBox(3, 4, 3, -1, 0.1, 0, 1, 0, 2), false);
});
test("both characters can time a normal jump over the chest-height cannon shot", () => {
  for (const defender of characters) {
    const g = new Game({ characters: [characters[0], defender], map: maps[0] });
    g.state.phase = "fighting";
    g.state.fighters[0].x = -2;
    g.state.fighters[1].x = 2;
    tick(g, 0.1, [{}, { jump: true }]);
    tick(g, 0.65, [{ skill: true }, {}]);
    assert.equal(g.state.fighters[1].hp, 100, defender.name);
  }
});
test("diagonal air cannon reaches ground targets and air spin hits airborne rivals", () => {
  const g = match(),
    dora = g.state.fighters[0];
  dora.y = 2.2;
  dora.vy = 3;
  dora.grounded = false;
  tick(g, 0.7, [{ skill: true }, {}]);
  assert.equal(g.state.fighters[1].hp, 86);
  const air = match();
  air.state.fighters.forEach((f, i) => {
    f.x = i ? 1.5 : -1.5;
    f.y = 2;
    f.vy = 3;
    f.grounded = false;
  });
  tick(air, 0.35, [{}, { skill: true }]);
  assert.equal(air.state.fighters[0].hp, 84);
});
