import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game/engine.js";
import { characters, maps } from "../src/config/content.js";
import { frameDelta } from "../src/game/frame-time.js";
const game = () => {
  const g = new Game({ characters, map: maps[0] });
  g.state.phase = "fighting";
  g.state.fighters[0].x = -10;
  g.state.fighters[1].x = 20;
  return g;
};
test("movement starts, reverses and stops on the first input simulation tick", () => {
  const g = game(),
    f = g.state.fighters[0];
  g.step(1 / 120, [{ right: true }, {}]);
  assert.equal(f.vx, characters[0].speed);
  const x = f.x;
  g.step(1 / 120, [{ left: true }, {}]);
  assert.equal(f.vx, -characters[0].speed);
  assert.ok(f.x < x);
  g.step(1 / 120);
  assert.equal(f.vx, 0);
});
test("takeoff starts within 25ms and combined jump/skill remains an air skill", () => {
  const g = game(),
    f = g.state.fighters[0];
  g.step(1 / 120, [{ jump: true, skill: true }, {}]);
  g.step(1 / 120);
  g.step(1 / 120);
  assert.equal(f.grounded, false);
  assert.ok(f.y > 0);
  assert.equal(f.currentMove.context, "air");
});
test("15, 30 and 60 fps advance the same clock and distance without slow motion", () => {
  for (const fps of [15, 30, 60]) {
    const g = game();
    for (let i = 0; i < fps * 2; i++)
      g.step(frameDelta(1 / fps), [{ right: true }, {}]);
    assert.ok(Math.abs(g.state.time - 97) < 1e-6);
    assert.ok(
      Math.abs(g.state.fighters[0].x - (-10 + characters[0].speed * 2)) < 1e-6,
    );
  }
});
test("long stalls are bounded and invalid frame times never corrupt physics", () => {
  assert.equal(frameDelta(4), 0.1);
  assert.equal(frameDelta(-1), 0);
  assert.equal(frameDelta(NaN), 0);
});
