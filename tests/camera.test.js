import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ArenaCamera } from "../src/render/camera.js";
import { maps, characters } from "../src/config/content.js";
import { Game } from "../src/game/engine.js";
for (const map of maps)
  for (const aspect of [2, 0.94, 2.8]) {
    test(`${map.id} perspective framing keeps both fighters visible at aspect ${aspect}`, () => {
      const rig = new ArenaCamera(map),
        left = map.bounds.left + 0.6,
        right = map.bounds.right - 0.6;
      const cases = [
        [left, right],
        [left, left + 1.2],
        [right - 1.2, right],
        [-3, 3],
      ];
      for (const [a, b] of cases) {
        const fs = [
          { x: a, y: 0 },
          { x: b, y: 2.5 },
        ];
        for (let i = 0; i < 180; i++) rig.update(fs, aspect, 1 / 60);
        assert.equal(rig.camera.isPerspectiveCamera, true);
        for (const f of fs)
          for (const dx of [-1, 1])
            for (const y of [f.y, f.y + 3.3]) {
              const p = new THREE.Vector3(f.x + dx, y, 0.5).project(rig.camera);
              assert.ok(Math.abs(p.x) < 0.98, `horizontal ${p.x}`);
              assert.ok(p.y > -0.98 && p.y < 0.85, `vertical ${p.y}`);
            }
        assert.ok(rig.center - rig.width / 2 >= map.camera.left - 0.01);
        assert.ok(rig.center + rig.width / 2 <= map.camera.right + 0.01);
      }
    });
  }
test("fast separation never clips fighters while zoom is catching up", () => {
  const rig = new ArenaCamera(maps[0]);
  for (let i = 0; i < 100; i++) {
    const fs = [
      { x: -2 - i * 0.26, y: 0 },
      { x: 2 + i * 0.26, y: 0 },
    ];
    rig.update(fs, 2, 1 / 60);
    for (const f of fs) {
      const p = new THREE.Vector3(f.x, 1.5, 0.5).project(rig.camera);
      assert.ok(Math.abs(p.x) < 0.98);
    }
  }
});
test("air-skill trajectories stay below the HUD while a grounded rival stays on screen", () => {
  for (const aspect of [2, 0.94, 2.8])
    for (const p of [0, 1]) {
      const g = new Game({ characters: characters.slice(0, 2), map: maps[0] }),
        rig = new ArenaCamera(maps[0]);
      g.state.phase = "fighting";
      for (let i = 0; i < 240; i++) {
        g.step(
          1 / 120,
          i === 0
            ? [
                p === 0 ? { jump: true, skill: true } : {},
                p === 1 ? { jump: true, skill: true } : {},
              ]
            : [{}, {}],
        );
        rig.update(g.state.fighters, aspect, 1 / 120);
        for (const f of g.state.fighters)
          for (const y of [f.y, f.y + 3.3]) {
            const point = new THREE.Vector3(f.x, y, 0.5).project(rig.camera);
            assert.ok(
              point.y < 0.85 && point.y > -0.98,
              `framing ${aspect}: ${point.y}`,
            );
          }
      }
    }
});
