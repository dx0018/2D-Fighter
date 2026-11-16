import test from "node:test";
import assert from "node:assert/strict";
import { RenderQuality } from "../src/render/quality.js";
test("automatic quality responds to sustained slow frames, with no oscillation or blur after a single hitch", () => {
  const q = new RenderQuality("auto");
  q.sample(0.3);
  for (let i = 0; i < 90; i++) q.sample(1 / 60);
  assert.equal(q.profile.level, "balanced");
  assert.equal(q.profile.shadowSamples, 4);
  for (let i = 0; i < 90; i++) q.sample(1 / 25);
  assert.equal(q.profile.level, "performance");
  assert.equal(q.profile.shadowSamples, 1);
  for (let i = 0; i < 600; i++) q.sample(1 / 120);
  assert.equal(q.profile.level, "performance");
});
test("automatic quality reacts to persistent 45fps instead of waiting for 30fps", () => {
  const q = new RenderQuality("auto");
  for (let i = 0; i < 90; i++) q.sample(1 / 45);
  assert.equal(q.profile.level, "performance");
});
test("explicit quality stays chosen; software rendering defaults to the lighter profile", () => {
  const high = new RenderQuality("high");
  assert.equal(high.profile.shadowSamples, 4);
  for (let i = 0; i < 120; i++) high.sample(1 / 15);
  assert.equal(high.profile.level, "high");
  const auto = new RenderQuality("auto", true);
  assert.equal(auto.profile.shadows, false);
  auto.setMode("high");
  assert.equal(auto.profile.shadows, true);
  auto.setMode("auto");
  assert.equal(auto.profile.level, "performance");
});
