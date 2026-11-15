import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.TEST_URL || "http://localhost:5173", {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
  await click("help");
  await page.getByRole("dialog").waitFor();
  await click("close-help");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await click("start");
  assert.equal(
    await page.locator('[data-action="choose-character"]').count(),
    4,
  );
  assert.equal(
    await page.locator('[data-action="to-maps"]').isDisabled(),
    true,
  );
  await page.locator('[data-action="ready"][data-player="0"]').click();
  await page.locator('[data-action="ready"][data-player="1"]').click();
  await page.screenshot({
    path: "artifacts/characters-desktop.png",
    fullPage: true,
  });
  await click("to-maps");
  await page.screenshot({ path: "artifacts/maps-desktop.png", fullPage: true });
  const before = await page
    .locator(".map-card.selected")
    .getAttribute("data-index");
  await click("random");
  assert.notEqual(
    await page.locator(".map-card.selected").getAttribute("data-index"),
    before,
  );
  await page.locator('[data-action="choose-map"][data-index="0"]').click();
  await click("fight");
  await page.waitForFunction(
    () => window.__POCKET__.game?.state.phase === "fighting",
  );
  await page.screenshot({
    path: "artifacts/fight-desktop.png",
    fullPage: true,
  });
  const x = await page.evaluate(() =>
    window.__POCKET__.game.state.fighters.map((f) => f.x),
  );
  await page.keyboard.down("d");
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction(([a, b]) => {
    const fs = __POCKET__.game.state.fighters;
    return fs[0].x > a + 0.2 && fs[1].x < b - 0.2;
  }, x);
  await page.keyboard.up("d");
  await page.keyboard.up("ArrowLeft");
  const moved = await page.evaluate(() =>
    window.__POCKET__.game.state.fighters.map((f) => f.x),
  );
  assert.ok(moved[0] > x[0] && moved[1] < x[1], "simultaneous movement");
  await page.keyboard.down("w");
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(() =>
    __POCKET__.game.state.fighters.every((f) => f.y > 0),
  );
  await page.keyboard.up("w");
  await page.keyboard.up("ArrowUp");
  assert.ok(
    await page.evaluate(() =>
      window.__POCKET__.game.state.fighters.every((f) => f.y > 0),
    ),
    "both jump",
  );
  await page.waitForFunction(() =>
    __POCKET__.game.state.fighters.every((f) => f.grounded),
  );
  await page.keyboard.down("s");
  await page.keyboard.down("ArrowDown");
  await page.waitForFunction(() =>
    __POCKET__.game.state.fighters.every((f) => f.crouching),
  );
  assert.ok(
    await page.evaluate(() =>
      window.__POCKET__.game.state.fighters.every((f) => f.crouching),
    ),
    "both crouch",
  );
  await page.keyboard.up("s");
  await page.keyboard.up("ArrowDown");
  await page.keyboard.press("Escape");
  await page.locator(".pause-card").waitFor();
  const t = await page.evaluate(() => window.__POCKET__.game.state.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__POCKET__.game.state.time), t);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".pause-card").count(), 0);
  await click("help");
  await page.getByRole("dialog").waitFor();
  const helpTime = await page.evaluate(() => window.__POCKET__.game.state.time);
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.__POCKET__.game.state.time),
    helpTime,
  );
  await page.keyboard.press("Escape");
  // Position a real combat hit to make the end-to-end KO check short and deterministic.
  await page.evaluate(() => {
    const fs = window.__POCKET__.game.state.fighters;
    fs[0].x = -1;
    fs[1].x = 1;
    fs[1].hp = 1;
  });
  await page.keyboard.press("f", { delay: 80 });
  try {
    await page.locator(".result-card").waitFor();
  } catch (e) {
    console.log(
      "KO diagnostic",
      await page.evaluate(() => ({
        page: __POCKET__.page,
        paused: __POCKET__.game.paused,
        previous: __POCKET__.game.previous,
        state: __POCKET__.game.state,
      })),
    );
    throw e;
  }
  assert.match(await page.locator(".result-card h2").textContent(), /P1/);
  await page.screenshot({
    path: "artifacts/result-desktop.png",
    fullPage: true,
  });
  await page.keyboard.down("d");
  await page.waitForTimeout(100);
  await page.keyboard.up("d");
  assert.equal(
    await page.evaluate(() => window.__POCKET__.game.state.phase),
    "finished",
  );
  await click("rematch");
  assert.equal(
    await page.evaluate(() => window.__POCKET__.game.state.fighters[1].hp),
    100,
  );
  assert.equal(
    await page.evaluate(() => window.__POCKET__.game.state.phase),
    "countdown",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/fight-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "no mobile horizontal overflow",
  );
  await click("pause");
  await click("reselect");
  await page.screenshot({
    path: "artifacts/characters-mobile.png",
    fullPage: true,
  });
  await page.locator('[data-action="ready"][data-player="0"]').click();
  await page.locator('[data-action="ready"][data-player="1"]').click();
  await click("to-maps");
  await page.screenshot({ path: "artifacts/maps-mobile.png", fullPage: true });
  await click("home");
  await page.screenshot({ path: "artifacts/home-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "home fits mobile",
  );
  assert.deepEqual(errors, [], "no runtime exceptions");
  console.log(
    "PASS: home/help → selection → maps/random → fight; dual movement/jump/crouch; pause/help/KO/results/rematch; desktop/mobile layouts.",
  );
} finally {
  await browser.close();
}
