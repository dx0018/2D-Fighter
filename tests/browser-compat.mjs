import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise the supported asset/renderer failure path, preserving native Canvas2D.
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/i.test(type) ? null : native.call(this, type, ...args);
    };
  });
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
  await click("start");
  for (const p of [0, 1])
    await page.locator(`[data-action="ready"][data-player="${p}"]`).click();
  await click("to-maps");
  await click("fight");
  await page.waitForFunction(() => __POCKET__.game.state.phase === "fighting");
  assert.ok(
    await page.evaluate(() => __POCKET__.arena.fallback),
    "WebGL failure selects working Canvas renderer",
  );
  const neutral = () =>
    page.waitForFunction(() =>
      __POCKET__.game.state.fighters.every((f) => !f.currentMove && !f.stun),
    );
  await page.evaluate(() => {
    const fs = __POCKET__.game.state.fighters;
    fs[0].x = -1;
    fs[1].x = 1;
  });
  await page.keyboard.press("f", { delay: 30 });
  await page.waitForFunction(() => __POCKET__.game.state.fighters[1].hp < 100);
  await neutral();
  await page.evaluate(() => {
    const fs = __POCKET__.game.state.fighters;
    fs[0].x = -1;
    fs[1].x = 1;
  });
  await page.keyboard.press("j", { delay: 30 });
  await page.waitForFunction(() => __POCKET__.game.state.fighters[0].hp < 100);
  await neutral();
  await page.evaluate(() => {
    const fs = __POCKET__.game.state.fighters;
    fs[0].x = -6;
    fs[1].x = 6;
  });
  await page.keyboard.down("g");
  await page.keyboard.down("k");
  await page.waitForFunction(() =>
    __POCKET__.game.state.fighters.every(
      (f) => f.cooldowns.skill > 0 && f.energy < 100,
    ),
  );
  await page.keyboard.up("g");
  await page.keyboard.up("k");
  await neutral();
  await page.evaluate(() => {
    const fs = __POCKET__.game.state.fighters;
    for (const f of fs) {
      f.hp = 100;
      f.energy = 100;
    }
    fs[0].x = -2;
    fs[1].x = 2;
  });
  await page.keyboard.down("h");
  await page.keyboard.down("l");
  await page.waitForFunction(() =>
    __POCKET__.game.state.fighters.every(
      (f) => f.cooldowns.ultimate > 0 && f.energy < 40,
    ),
  );
  await page.keyboard.up("h");
  await page.keyboard.up("l");
  await neutral();
  assert.ok(
    await page.evaluate(() =>
      __POCKET__.game.state.fighters.some((f) => f.hp < 100),
    ),
    "ultimate causes actual damage",
  );
  await page.evaluate(() => {
    const g = __POCKET__.game,
      fs = g.state.fighters;
    fs[0].x = -7.5;
    fs[1].x = -15;
  });
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(
      () => __POCKET__.game.state.fighters[0].cooldowns.attack === 0,
    );
    await page.keyboard.press("f", { delay: 30 });
    await page.waitForFunction(
      () => __POCKET__.game.state.fighters[0].cooldowns.attack > 0,
    );
    await neutral();
  }
  await page.waitForFunction(
    () =>
      __POCKET__.game.state.objects.find((o) => o.type === "crate").destroyed,
  );
  await page.evaluate(() => {
    const g = __POCKET__.game,
      sign = g.state.objects.find((o) => o.type === "sign");
    g.state.fighters[0].x = sign.x + 1.5;
  });
  await page.waitForFunction(
    () => __POCKET__.game.state.fighters[0].cooldowns.attack === 0,
  );
  await page.keyboard.press("f", { delay: 30 });
  await page.waitForFunction(
    () =>
      __POCKET__.game.state.objects.find((o) => o.type === "sign").shake > 0,
  );
  await neutral();
  await page.locator(".touch-controls summary").click();
  await page.locator('[data-touch="0:jump"]').click();
  await page.waitForFunction(() => __POCKET__.game.state.fighters[0].y > 0);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Canvas fallback fits narrow screen",
  );
  await page.screenshot({
    path: "artifacts/fight-canvas-fallback.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Canvas fallback, all F/G/H + J/K/L attacks, damage/energy/cooldowns, configured crate break/sign hit, touch jump, narrow layout.",
  );
} finally {
  await browser.close();
}
