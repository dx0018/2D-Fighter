import test from "node:test";
import assert from "node:assert/strict";
import { FramePacer } from "../src/render/frame-pacer.js";

test("throttles UI and previews at the requested rate independently of display refresh", () => {
  for (const fps of [30, 60])
    for (const hz of [90, 120, 144]) {
      const pacer = new FramePacer(fps);
      let draws = 0;
      const frames = hz * 2;
      for (let i = 0; i < frames; i++) if (pacer.ready(1 / hz)) draws++;
      assert.ok(
        Math.abs(draws / 2 - fps) < 1,
        `${hz}Hz requested ${fps}, updated ${draws / 2}`,
      );
    }
});

test("keeps slower displays responsive and forces a resize render immediately", () => {
  const pacer = new FramePacer(60);
  assert.equal(pacer.ready(1 / 30), true);
  assert.equal(pacer.ready(1 / 30), true);
  assert.equal(pacer.ready(1 / 120), false);
  assert.equal(pacer.ready(0, true), true);
  assert.equal(pacer.ready(1 / 120), false);
});

test("normal 60Hz timestamp jitter never halves the drawing rate", () => {
  const pacer = new FramePacer(60);
  let draws = 0;
  for (let i = 0; i < 600; i++)
    if (pacer.ready((i % 2 ? 16.8 : 16.5) / 1000)) draws++;
  assert.ok(draws >= 595, `${draws} draws for 600 normal browser frames`);
});
