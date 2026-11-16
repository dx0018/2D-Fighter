import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { characters, maps } from "../src/config/content.js";
import { Game } from "../src/game/engine.js";
import { makeFighter } from "../src/render/fighters.js";
import { animateFighter } from "../src/render/animation.js";
import { disposeTree } from "../src/render/primitives.js";
import { english } from "../src/i18n/en.js";
const naruto = characters.find((c) => c.id === "naruto"),
  dora = characters.find((c) => c.id === "doraemon");
function match(distance = 3.6, p = 0) {
  const g = new Game({
    characters: p ? [dora, naruto] : [naruto, dora],
    map: maps[0],
  });
  g.state.phase = "fighting";
  g.state.objects = [];
  g.state.fighters[0].x = -distance / 2;
  g.state.fighters[1].x = distance / 2;
  return g;
}
function advance(g, seconds, inputs = [{}, {}]) {
  for (let t = 0; t < seconds - 1e-7; t += 1 / 120)
    g.step(Math.min(1 / 120, seconds - t), inputs);
}
test("Naruto Rasengan hits once within reach on either player side and misses at distance", () => {
  for (const p of [0, 1]) {
    const g = match(3.6, p),
      input = [{}, {}];
    input[p] = { skill: true };
    advance(g, 1.1, input);
    assert.equal(g.state.fighters[1 - p].hp, 82);
    assert.equal(g.state.fighters[p].currentMove, null);
    assert.ok(g.state.fighters[p].cooldowns.skill > 0);
    const far = match(12, p);
    advance(far, 1.1, input);
    assert.equal(far.state.fighters[1 - p].hp, 100);
  }
});
test("Rasengan directional variants rush, substitute, sweep low and dive until landing", () => {
  const rush = match(6.4);
  advance(rush, 1, [{ right: true, skill: true }, {}]);
  assert.equal(rush.state.fighters[1].hp, 80);
  const back = match(6),
    f = back.state.fighters[0],
    start = f.x;
  back.step(1 / 120, [{ left: true, skill: true }, {}]);
  assert.equal(f.currentMove.context, "backward");
  advance(back, 0.19);
  assert.ok(f.x < start && f.invulnerable > 0);
  assert.ok(back.state.effects.some((e) => e.type === "substitution"));
  assert.equal(back.state.projectiles[0].move.visual, "kunai");
  const low = match(3);
  advance(low, 0.8, [{ crouch: true, skill: true }, { jump: true }]);
  assert.equal(low.state.fighters[1].hp, 100);
  const air = match(4),
    a = air.state.fighters[0];
  a.grounded = false;
  a.y = 2;
  a.vy = 1;
  air.step(1 / 120, [{ skill: true }, {}]);
  assert.equal(a.currentMove.context, "air");
  advance(air, 0.2);
  assert.ok(a.vy <= -8);
  advance(air, 0.8);
  assert.equal(a.grounded, true);
  assert.equal(a.currentMove, null);
});
test("Tailed Beast Bomb has a full interruptible charge and a single damaging projectile in both directions", () => {
  for (const p of [0, 1]) {
    const g = match(8, p),
      caster = g.state.fighters[p],
      input = [{}, {}];
    input[p] = { ultimate: true };
    advance(g, 0.8, input);
    assert.equal(g.state.projectiles.length, 0);
    assert.ok(caster.energy < 35);
    advance(g, 0.2, input);
    assert.equal(g.state.projectiles.length, 1);
    const projectile = g.state.projectiles[0];
    assert.equal(projectile.move.visual, "bijuu");
    assert.equal(projectile.radius, 0.65);
    assert.equal(projectile.direction, p ? -1 : 1);
    advance(g, 1, input);
    assert.equal(g.state.fighters[1 - p].hp, 62);
    assert.equal(g.state.projectiles.length, 0);
  }
  const interrupted = match(1.8);
  interrupted.step(1 / 120, [{ ultimate: true }, {}]);
  advance(interrupted, 0.04);
  interrupted.step(1 / 120, [{}, { attack: true }]);
  advance(interrupted, 1.4);
  assert.equal(interrupted.state.fighters[0].currentMove, null);
  assert.equal(interrupted.state.projectiles.length, 0);
  assert.equal(interrupted.state.fighters[1].hp, 100);
  const empty = match();
  empty.state.fighters[0].energy = 69;
  empty.step(1 / 120, [{ ultimate: true }, {}]);
  assert.equal(empty.state.fighters[0].currentMove, null);
});
test("Naruto can mirror match, keeps normal jump/attack input edges, and has complete English content", () => {
  const g = new Game({ characters: [naruto, naruto], map: maps[1] });
  g.state.phase = "fighting";
  advance(g, 0.8, [{ attack: true }, { attack: true }]);
  assert.equal(g.state.fighters[0].cooldowns.attack, 0);
  advance(g, 0.9, [
    { jump: true, skill: true },
    { jump: true, skill: true },
  ]);
  assert.ok(g.state.fighters.every((f) => f.cooldowns.skill > 0));
  const walk = (obj) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === "object") walk(value);
      else if (["name", "description", "tagline"].includes(key))
        assert.ok(english[value], value);
    }
  };
  walk(naruto);
});
test("Naruto has distinct human proportions, fixed bones, grounded crouch and hand-aligned chakra that pauses and cancels", () => {
  const m = makeFighter(naruto),
    reference = makeFighter(dora),
    g = match(),
    f = g.state.fighters[0];
  f.x = 0;
  const pose = (count = 60) => {
    for (let i = 0; i < count; i++) animateFighter(m, f, 1 / 60, i / 60);
    m.root.updateMatrixWorld(true);
  };
  pose();
  animateFighter(reference, { ...f, character: dora }, 1 / 60, 1);
  reference.root.updateMatrixWorld(true);
  m.root.rotation.y = reference.root.rotation.y = 0;
  m.head.rotation.y = reference.head.rotation.y = 0;
  m.root.updateMatrixWorld(true);
  reference.root.updateMatrixWorld(true);
  const head = new THREE.Box3().setFromObject(m.head),
    other = new THREE.Box3().setFromObject(reference.head);
  assert.ok(head.max.y < other.max.y * 1.2);
  assert.ok(
    head.getSize(new THREE.Vector3()).x <
      other.getSize(new THREE.Vector3()).x * 0.9,
  );
  const standing = head.max.y;
  f.crouching = true;
  f.action = "crouch";
  pose();
  assert.ok(new THREE.Box3().setFromObject(m.head).max.y < standing - 0.5);
  for (const leg of m.legs)
    assert.ok(Math.abs(new THREE.Box3().setFromObject(leg.foot).min.y) < 0.04);
  f.crouching = false;
  f.action = "skill";
  f.currentMove = {
    key: "skill",
    move: naruto.moves.skill,
    elapsed: 0.18,
    facing: 1,
  };
  pose();
  assert.equal(m.rasengan.visible, true);
  assert.equal(m.rasengan.parent, m.arms[1].hand);
  const rotation = m.rasengan.rotation.toArray();
  animateFighter(m, f, 0, 100);
  assert.deepEqual(m.rasengan.rotation.toArray(), rotation);
  f.currentMove = null;
  f.action = "hurt";
  pose(1);
  assert.equal(m.rasengan.visible, false);
  assert.equal(m.bijuu.visible, false);
  for (const limb of [...m.arms, ...m.legs])
    assert.ok(
      Math.abs(limb.knee.distanceTo(limb.upper.position) - limb.upperLength) <
        1e-5,
    );
  for (const model of [m, reference]) {
    model.skeleton.dispose();
    disposeTree(model.root);
  }
});
