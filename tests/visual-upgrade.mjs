import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("artifacts/upgrade", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404"))
      errors.push(m.text());
  });
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await page.waitForFunction(() => __POCKET__.arena?.clock > 0.1);
  await page.screenshot({ path: "artifacts/upgrade/home.png", fullPage: true });
  const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
  async function match(map = 0) {
    await click("home");
    await click("start");
    await page.click('[data-action=ready][data-player="0"]');
    await page.click('[data-action=ready][data-player="1"]');
    await click("to-maps");
    await page.click(`[data-action=choose-map][data-index="${map}"]`);
    await click("fight");
    await page.waitForFunction(() => __POCKET__.arena?.clock > 0.1);
    await page.evaluate(() => {
      __POCKET__.game.paused = true;
      __POCKET__.game.state.phase = "fighting";
      __POCKET__.game.state.countdown = 0;
    });
  }
  await match();
  const screenshot = (name) =>
    page.screenshot({ path: `artifacts/upgrade/${name}.png`, fullPage: true });
  await screenshot("town");
  let serial = 0;
  async function pose(player, key, seconds, close = false) {
    await page.evaluate(
      async ({ player, key, seconds, serial, close }) => {
        const { animateFighter } = await import("/src/render/animation.js"),
          g = __POCKET__.game,
          a = __POCKET__.arena;
        g.reset();
        g.nextId = serial * 1000;
        g.state.phase = "fighting";
        g.state.countdown = 0;
        const fs = g.state.fighters;
        fs[0].x = close ? -1 : -3;
        fs[1].x = close ? 1 : 3;
        for (let i = 0; i < seconds * 120; i++) {
          g.step(
            1 / 120,
            i === 0
              ? [
                  player === 0 ? { [key]: true } : {},
                  player === 1 ? { [key]: true } : {},
                ]
              : [{}, {}],
          );
          g.state.fighters.forEach((f, j) =>
            animateFighter(
              a.fighters[j],
              f,
              1 / 120,
              i / 120,
              j,
              g.state.hitstop,
            ),
          );
        }
        g.paused = true;
        for (let i = 0; i < 100; i++) a.cameraRig.update(fs, a.aspect, 1 / 60);
        a.update(g.state, 0);
      },
      { player, key, seconds, serial: ++serial, close },
    );
    await page.waitForFunction(() =>
      __POCKET__.game.state.fighters.every(
        (f, p) =>
          document.querySelector(`#hp-text-${p}`).textContent ===
            `${Math.ceil(f.hp)} / ${f.character.maxHp}` &&
          document.querySelector(`#super-${p}`).classList.contains("active") ===
            !!(
              f.currentMove?.key === "ultimate" &&
              f.currentMove.elapsed < f.currentMove.move.windup + 0.2
            ),
      ),
    );
  }
  await pose(0, "attack", 0.13, true);
  await screenshot("punch-impact");
  await pose(0, "skill", 0.4);
  await screenshot("air-cannon");
  await pose(1, "skill", 0.28);
  await screenshot("dash");
  await pose(0, "ultimate", 0.6);
  await screenshot("beam-charge");
  await pose(0, "ultimate", 0.85);
  await screenshot("beam-impact");
  await pose(1, "ultimate", 1.12);
  await screenshot("pulse-impact");
  console.log(
    "town frame:",
    await page.evaluate(() => ({
      drawCalls: __POCKET__.arena.renderer.info.render.calls,
      triangles: __POCKET__.arena.renderer.info.render.triangles,
      perspective: __POCKET__.arena.camera.isPerspectiveCamera,
    })),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await pose(0, "ultimate", 0.85);
  await screenshot("fight-narrow");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await match(1);
  await screenshot("sunset");
  await match(2);
  await screenshot("moon");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Three.js renders three upgraded stages and all move types, desktop/narrow HUD, no shader or runtime errors.",
  );
} finally {
  await browser.close();
}
