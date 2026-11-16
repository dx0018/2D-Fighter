import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts/directional", { recursive: true });
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
    viewport: { width: 1200, height: 900 },
  });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
  await click("start");
  for (const p of [0, 1])
    await page.click(`[data-action=ready][data-player="${p}"]`);
  await click("to-maps");
  await click("fight");
  await page.waitForFunction(() => __POCKET__.game.state.phase === "fighting");
  let serial = 0;
  async function reset(crossed = false) {
    await page.evaluate(
      ({ serial, crossed }) => {
        const g = __POCKET__.game;
        g.reset();
        g.nextId = serial * 1000;
        g.state.phase = "fighting";
        g.state.countdown = 0;
        g.state.fighters[0].x = crossed ? 3 : -3;
        g.state.fighters[1].x = crossed ? -3 : 3;
      },
      { serial: ++serial, crossed },
    );
  }
  async function skill(p, keys, name, crossed = false) {
    await reset(crossed);
    await page.waitForTimeout(60);
    for (const key of keys) await page.keyboard.down(key);
    if (keys.length) await page.waitForTimeout(60);
    await page.keyboard.down(p ? "k" : "g");
    await page.waitForFunction(
      ({ p, name }) =>
        __POCKET__.game.state.fighters[p].currentMove?.move.name === name,
      { p, name },
    );
    await page.waitForFunction(
      ({ p, name }) =>
        document.querySelector(`#move-name-${p}-skill`).textContent === name,
      { p, name },
    );
    await page.keyboard.up(p ? "k" : "g");
    for (const key of keys) await page.keyboard.up(key);
  }
  await reset();
  await page.selectOption('[data-setting="quality"]', "high");
  await page.waitForFunction(
    () => __POCKET__.arena.quality.profile.level === "high",
  );
  assert.ok(await page.evaluate(() => __POCKET__.arena.sun.castShadow));
  const initialX = await page.evaluate(
    () => __POCKET__.game.state.fighters[0].x,
  );
  await page.keyboard.down("d");
  await page.waitForFunction(
    (x) => __POCKET__.game.state.fighters[0].x > x + 0.15,
    initialX,
  );
  await page.keyboard.up("d");
  await page.selectOption('[data-setting="quality"]', "performance");
  await page.waitForFunction(
    () => __POCKET__.arena.quality.profile.level === "performance",
  );
  await page.evaluate(() => document.activeElement?.blur());
  assert.equal(
    await page.evaluate(() => __POCKET__.arena.sun.castShadow),
    false,
  );
  await reset();
  const heights = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    return __POCKET__.arena.fighters.map((m) =>
      new T.Box3().setFromObject(m.model || m.head, true).max.y,
    );
  });
  await page.keyboard.down("s");
  await page.keyboard.down("ArrowDown");
  await page.waitForFunction(() =>
    __POCKET__.arena.fighters.every((m) => m.crouchBlend > 0.97),
  );
  const crouched = await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js");
    return __POCKET__.arena.fighters.map((m) => ({
      head: new T.Box3().setFromObject(m.model || m.head, true).max.y,
      feet: [new T.Box3().setFromObject(m.model || m.head, true).min.y],
      torsoMin: new T.Box3().setFromObject(m.model || m.body, true).min.y,
    }));
  });
  crouched.forEach((c, i) => {
    assert.ok(c.head < heights[i] - 0.35, "both characters visibly lower");
    assert.ok(
      c.torsoMin > -0.04,
      "crouch keeps torso and screen clear of the floor",
    );
    assert.ok(
      c.feet.every((y) => Math.abs(y) < 0.04),
      "squat feet stay on ground",
    );
  });
  await page.keyboard.up("s");
  await page.keyboard.up("ArrowDown");
  for (const [p, cases] of [
    [
      0,
      [
        [[], "空气炮"],
        [["d"], "推进拳套"],
        [["a"], "后撤空气炮"],
        [["s"], "贴地空气弹"],
        [["w"], "俯冲空气炮"],
      ],
    ],
    [
      1,
      [
        [[], "天线光线"],
        [["ArrowLeft"], "滑步冲撞"],
        [["ArrowRight"], "回旋退步"],
        [["ArrowDown"], "贴地滑踢"],
        [["ArrowUp"], "空中回旋"],
      ],
    ],
  ]) {
    for (const [keys, name] of cases) await skill(p, keys, name);
  }
  await skill(1, ["ArrowRight"], "滑步冲撞", true);
  await page.screenshot({
    path: "artifacts/directional/crouch-both.png",
    fullPage: true,
  });
  await reset();
  await page.locator(".move-guide > summary").click();
  assert.equal(await page.locator(".move-guide-grid article").count(), 10);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "artifacts/directional/guide-narrow.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: visible crouch with grounded feet, all ten skills via real keyboard input, live HUD, relative direction after crossing sides, narrow move guide.",
  );
} finally {
  await browser.close();
}
