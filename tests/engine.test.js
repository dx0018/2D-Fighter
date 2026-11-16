import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/engine.js";
import { characters, maps } from "../src/config/content.js";
const create = (options = {}) =>
  new Game({ characters: characters.slice(0, 2), map: maps[0], ...options });
function advance(game, seconds, inputs = [{}, {}]) {
  for (let elapsed = 0; elapsed < seconds - 1e-7; elapsed += 1 / 60)
    game.step(Math.min(1 / 60, seconds - elapsed), inputs);
}
function ready(game) {
  advance(game, 3.1);
  assert.equal(game.state.phase, "fighting");
}
function close(game, distance = 1.7) {
  game.state.fighters[0].x = -distance / 2;
  game.state.fighters[1].x = distance / 2;
}

test("configuration exposes distinct kits and three complete maps", () => {
  assert.ok(characters.length >= 3);
  assert.notEqual(
    characters[0].moves.skill.kind,
    characters[1].moves.skill.kind,
  );
  assert.notEqual(
    characters[0].moves.ultimate.kind,
    characters[1].moves.ultimate.kind,
  );
  for (const map of maps) {
    assert.ok(
      map.bounds.left < map.spawns[0].x && map.bounds.right > map.spawns[1].x,
    );
    assert.ok(map.camera.minWidth > 20);
    assert.ok(map.objects.some((o) => o.type === "crate"));
    assert.ok(map.objects.some((o) => o.type === "sign"));
  }
});
test("countdown gates combat; held input does not trigger when countdown finishes", () => {
  const game = create();
  close(game);
  advance(game, 3.5, [{ attack: true }, {}]);
  assert.equal(game.state.fighters[1].hp, 100);
  advance(game, 0.05);
  advance(game, 0.3, [{ attack: true }, {}]);
  assert.equal(game.state.fighters[1].hp, 92);
});
test("attacks miss outside range and only hit once per cast while held", () => {
  const game = create();
  ready(game);
  advance(game, 0.7, [{ attack: true }, {}]);
  assert.equal(game.state.fighters[1].hp, 100);
  advance(game, 0.05);
  close(game);
  advance(game, 2, [{ attack: true }, {}]);
  assert.equal(game.state.fighters[1].hp, 92);
});
test("simultaneous attacks can trade and never repeatedly damage within an active window", () => {
  const equal = [characters[0], characters[0]];
  const game = create({ characters: equal });
  ready(game);
  close(game);
  advance(game, 0.4, [{ attack: true }, { attack: true }]);
  assert.deepEqual(
    game.state.fighters.map((f) => f.hp),
    [92, 92],
  );
  advance(game, 2);
  assert.equal(game.state.fighters[0].stun, 0);
  assert.equal(game.state.fighters[0].currentMove, null);
});
test("movement respects both arena bounds and jump returns to the ground", () => {
  const game = create();
  ready(game);
  advance(game, 12, [{ left: true }, { right: true }]);
  assert.equal(game.state.fighters[0].x, maps[0].bounds.left + 0.6);
  assert.equal(game.state.fighters[1].x, maps[0].bounds.right - 0.6);
  game.step(1 / 60, [{ jump: true }, {}]);
  assert.ok(game.state.fighters[0].jumpStartup > 0);
  advance(game, 0.1);
  assert.ok(game.state.fighters[0].y > 0);
  advance(game, 2);
  assert.equal(game.state.fighters[0].y, 0);
  assert.equal(game.state.fighters[0].grounded, true);
});
test("chest-height air cannon hits a crouching fighter and jump timing avoids it", () => {
  const game = create();
  ready(game);
  advance(game, 1, [{ skill: true }, { crouch: true }]);
  assert.equal(game.state.fighters[1].hp, 85);
  game.reset();
  ready(game);
  advance(game, 0.1, [{}, { jump: true }]);
  advance(game, 0.65, [{ skill: true }, {}]);
  assert.equal(game.state.fighters[1].hp, 100);
});
test("skill requires energy and cooldown, while energy regenerates", () => {
  const game = create();
  ready(game);
  const f = game.state.fighters[0];
  f.energy = 0;
  advance(game, 0.1, [{ ultimate: true }, {}]);
  assert.equal(f.currentMove, null);
  f.energy = 100;
  advance(game, 0.05);
  game.step(1 / 60, [{ skill: true }, {}]);
  assert.ok(f.energy < 80);
  assert.ok(f.cooldowns.skill > 2.5);
  advance(game, 1);
  const energy = f.energy;
  game.step(1 / 60, [{ skill: true }, {}]);
  assert.equal(f.currentMove, null);
  assert.ok(f.energy > energy);
});
test("Po dash advances toward and damages its opponent", () => {
  const game = create();
  ready(game);
  game.state.fighters[0].x = -1;
  game.state.fighters[1].x = 4;
  advance(game, 0.9, [{}, { left: true, skill: true }]);
  assert.equal(game.state.fighters[0].hp, 82);
  assert.ok(game.state.fighters[1].x < 4);
});
test("ultimates have preparation and distinct directional / radial hit coverage", () => {
  const game = create();
  ready(game);
  close(game, 5);
  advance(game, 0.5, [{ ultimate: true }, {}]);
  assert.equal(game.state.fighters[1].hp, 100);
  advance(game, 0.5);
  assert.equal(game.state.fighters[1].hp, 66);
  game.reset();
  ready(game);
  close(game, 5);
  advance(game, 1.1, [{}, { ultimate: true }]);
  assert.equal(game.state.fighters[0].hp, 62);
});
test("crate breaks after configured damage; sign shakes and recovers without destruction", () => {
  const game = create();
  ready(game);
  const f = game.state.fighters[0];
  const other = game.state.fighters[1];
  const crate = game.state.objects[0];
  f.x = crate.x - 1.5;
  other.x = 12;
  for (let i = 0; i < 3; i++) {
    advance(game, 0.3, [{ attack: true }, {}]);
    advance(game, 0.3);
  }
  assert.equal(crate.hp, 0);
  assert.equal(crate.destroyed, true);
  assert.ok(game.state.effects.some((e) => e.type === "break"));
  const sign = game.state.objects.find((o) => o.type === "sign");
  f.x = sign.x - 1.5;
  advance(game, 0.2, [{ attack: true }, {}]);
  assert.ok(sign.shake > 0);
  assert.equal(sign.destroyed, false);
  advance(game, 1);
  assert.equal(sign.shake, 0);
});
test("pause freezes physics and timers; reset restores full match and objects", () => {
  const game = create();
  ready(game);
  const { x } = game.state.fighters[0];
  const time = game.state.time;
  game.paused = true;
  advance(game, 1, [{ right: true, attack: true }, {}]);
  assert.equal(game.state.fighters[0].x, x);
  assert.equal(game.state.time, time);
  game.reset();
  assert.equal(game.state.phase, "countdown");
  assert.ok(game.state.objects.every((o) => !o.destroyed));
  assert.ok(game.state.fighters.every((f) => f.hp === 100 && f.energy === 100));
});
test("KO ends combat, suppresses input, and correctly detects double KO", () => {
  const game = create({ characters: [characters[0], characters[0]] });
  ready(game);
  close(game);
  game.state.fighters.forEach((f) => {
    f.hp = 8;
  });
  advance(game, 0.3, [{ attack: true }, { attack: true }]);
  assert.equal(game.state.phase, "finished");
  assert.equal(game.state.winner, "draw");
  const positions = game.state.fighters.map((f) => f.x);
  advance(game, 1, [
    { right: true, ultimate: true },
    { left: true, skill: true },
  ]);
  assert.deepEqual(
    game.state.fighters.map((f) => f.x),
    positions,
  );
  assert.equal(game.state.projectiles.length, 0);
});
test("timer decides winner by health and handles equal-health draws", () => {
  const game = create();
  ready(game);
  game.state.time = 0.05;
  game.state.fighters[0].hp = 50;
  advance(game, 0.1);
  assert.equal(game.state.winner, 1);
  game.reset();
  ready(game);
  game.state.time = 0.01;
  advance(game, 0.1);
  assert.equal(game.state.winner, "draw");
});

test("holding jump does not auto-repeat or permit a double jump", () => {
  const game = create();
  ready(game);
  advance(game, 2.4, [{ jump: true }, {}]);
  assert.equal(game.state.fighters[0].y, 0);
  assert.equal(game.state.fighters[0].grounded, true);
  advance(game, 0.05);
  game.step(1 / 60, [{ jump: true }, {}]);
  advance(game, 0.1);
  assert.ok(game.state.fighters[0].y > 0);
  advance(game, 0.1);
  const vy = game.state.fighters[0].vy;
  game.step(1 / 60, [{ jump: true }, {}]);
  assert.ok(game.state.fighters[0].vy < vy);
});
test("beam direction is committed during windup and hits configured objects exactly once", () => {
  const game = create();
  ready(game);
  const [f, target] = game.state.fighters;
  f.x = -12;
  target.x = -7;
  game.step(1 / 60, [{ ultimate: true }, {}]);
  target.x = -15; // Cross behind a committed beam during preparation.
  advance(game, 1.1);
  assert.equal(target.hp, 100);
  assert.equal(game.state.objects[0].destroyed, true);
  const sign = game.state.objects.find((object) => object.type === "sign");
  assert.ok(sign.shake > 0);
  assert.equal(sign.destroyed, false);
});
test("timeout compares remaining health proportions for future unequal max-health characters", () => {
  const tank = { ...characters[1], maxHp: 200 };
  const game = create({ characters: [characters[0], tank] });
  ready(game);
  game.state.fighters[0].hp = 75;
  game.state.fighters[1].hp = 100;
  game.state.time = 0.01;
  advance(game, 0.1);
  assert.equal(game.state.winner, 0);
});

test("KO presentation lands airborne fighters and lets hit flashes fade", () => {
  const game = create();
  ready(game);
  game.state.fighters[0].y = 2;
  game.state.fighters[0].grounded = false;
  game.state.fighters[0].flash = 0.16;
  game.state.fighters[1].hp = 0;
  game.step(1 / 60);
  assert.equal(game.state.fighters[0].grounded, true);
  assert.equal(game.state.fighters[0].action, "victory");
  advance(game, 0.3);
  assert.equal(game.state.fighters[0].flash, 0);
});

test("a real hit freezes combat briefly without repeating damage or freezing effects", () => {
  const game = create();
  ready(game);
  const [a, b] = game.state.fighters;
  a.x = -1;
  b.x = 1;
  game.step(1 / 120, [{ attack: true }, {}]);
  for (let i = 0; i < 30 && game.state.hitstop === 0; i++) game.step(1 / 120);
  assert.ok(game.state.hitstop > 0);
  const health = b.hp,
    x = b.x,
    time = game.state.time;
  const life = game.state.effects.find((e) => e.type === "hit").life;
  game.step(0.02, [{ right: true }, { left: true }]);
  assert.equal(b.hp, health);
  assert.equal(b.x, x);
  assert.equal(game.state.time, time);
  assert.ok(game.state.effects.find((e) => e.type === "hit").life < life);
  advance(game, 0.2);
  assert.equal(game.state.hitstop, 0);
  assert.equal(b.hp, health);
});

test("a projectile is consumed when dodged through a short invulnerability window", () => {
  const game = create();
  ready(game);
  const target = game.state.fighters[1];
  target.x = 0;
  target.invulnerable = 0.02;
  game.state.projectiles.push({
    id: game.nextId++,
    x: -0.65,
    y: 1.75,
    vx: 16,
    vy: 0,
    direction: 1,
    owner: 0,
    radius: 0.22,
    speed: 16,
    distance: 0,
    move: { range: 18, damage: 15, cost: 24, kind: "projectile" },
    hit: new Set(),
    alive: true,
  });

  advance(game, 0.15);
  assert.equal(target.hp, 100);
  assert.equal(game.state.projectiles.length, 0);
});
test("a tapped move during hitstop is buffered once and expires when unusable", () => {
  const game = create();
  ready(game);
  const f = game.state.fighters[0];
  game.state.hitstop = 0.08;
  game.step(0.01, [{ skill: true }, {}]);
  game.step(0.01);
  assert.equal(f.currentMove, null);
  advance(game, 0.1);
  assert.equal(f.currentMove?.key, "skill");
  const cost = f.energy;
  advance(game, 0.7);
  assert.equal(f.currentMove, null);
  assert.ok(f.energy >= cost);
  game.reset();
  ready(game);
  game.state.fighters[0].energy = 0;
  game.step(0.01, [{ ultimate: true }, {}]);
  game.state.fighters[0].energy = 100;
  advance(game, 0.2);
  assert.equal(game.state.fighters[0].currentMove, null);
});
test("short recovery input is accepted without turning held attacks into autofire", () => {
  const game = create();
  ready(game);
  const f = game.state.fighters[0];
  f.x = -20;
  game.step(1 / 120, [{ attack: true }, {}]);
  advance(game, 0.36);
  game.step(1 / 120, [{ attack: true }, {}]);
  advance(game, 0.15, [{ attack: true }, {}]);
  assert.equal(f.currentMove?.key, "attack");
  advance(game, 1, [{ attack: true }, {}]);
  assert.equal(f.currentMove, null);
});

test("a normal attack tapped 180ms before cooldown ends chains once without cancelling recovery", () => {
  for (const character of characters) {
    const events = [],
      game = create({
        characters: [character, character],
        onEvent: (event) => events.push(event),
      });
    game.state.phase = "fighting";
    const f = game.state.fighters[0];
    f.x = -20;
    game.state.fighters[1].x = 20;
    game.step(1 / 120, [{ attack: true }, {}]);
    const first = f.currentMove.id;
    advance(game, f.cooldowns.attack - 0.18);
    game.step(1 / 120, [{ attack: true }, {}]);
    assert.equal(
      f.currentMove.id,
      first,
      "the first recovery completes normally",
    );
    advance(game, 0.2, [{ attack: true }, {}]);
    assert.ok(f.currentMove && f.currentMove.id !== first, character.name);
    advance(game, 1, [{ attack: true }, {}]);
    assert.equal(events.filter((e) => e.type === "cast").length, 2);
    assert.equal(f.currentMove, null, "holding the button never auto-repeats");
  }
});
