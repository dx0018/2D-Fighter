import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts/experience", { recursive: true });
// The real application loop and UI also run in Canvas compatibility mode.
// Use it here to measure cadence without software WebGL dominating timestamps.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-webgl"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const click = (action) =>
    page.locator(`[data-action="${action}"]`).first().click();
  const language = (value) =>
    page.selectOption('[data-setting="language"]', value);
  const englishOnly = async () => {
    const remaining = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const result = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (
          !node.parentElement.closest("script,style,option") &&
          /[\u3400-\u9fff]/.test(node.textContent)
        )
          result.push(node.textContent.trim());
      }
      return result;
    });
    assert.deepEqual(remaining, [], "English UI has no untranslated game copy");
  };
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await language("en");
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.match(await page.locator("h1").textContent(), /Little heroes/);
  await click("sound");
  assert.equal(
    await page.locator(".sound").getAttribute("aria-label"),
    "Enable sound",
  );
  await language("zh");
  assert.equal(
    await page.locator(".sound").getAttribute("aria-label"),
    "开启音效",
  );
  await language("en");
  await englishOnly();
  await click("help");
  assert.match(await page.locator(".help-modal").textContent(), /Antenna Beam/);
  await englishOnly();
  await click("close-help");
  await click("start");
  for (const p of [0, 1])
    await page.click(`[data-action="ready"][data-player="${p}"]`);
  await language("zh");
  assert.match(await page.locator(".status").first().textContent(), /已准备/);
  assert.equal(await page.locator('[data-action="to-maps"]').isEnabled(), true);
  await language("en");
  await englishOnly();
  await click("to-maps");
  for (let i = 0; i < 3; i++) {
    await page.click(`[data-action="choose-map"][data-index="${i}"]`);
    await englishOnly();
  }
  await click("fight");
  await page.waitForFunction(() => __POCKET__.game.state.phase === "fighting");
  await englishOnly();
  assert.equal(
    await page.locator("#move-name-0-attack").textContent(),
    "Round Jab",
  );
  await page.keyboard.down("d");
  await page.waitForFunction(() => __POCKET__.game.state.fighters[0].vx > 0);
  await page.keyboard.press("g");
  await page.keyboard.up("d");
  await page.waitForFunction(
    () => __POCKET__.game.state.fighters[0].cooldowns.skill > 0,
  );
  await click("pause");
  const saved = await page.evaluate(() => {
    window.savedGame = __POCKET__.game;
    window.savedCanvas = __POCKET__.arena.canvas;
    return JSON.stringify(__POCKET__.game.state);
  });
  await language("zh");
  assert.match(await page.locator(".pause-card").textContent(), /继续对战/);
  assert.equal(
    await page.evaluate(
      () =>
        __POCKET__.game === window.savedGame &&
        __POCKET__.arena.canvas === window.savedCanvas,
    ),
    true,
  );
  assert.equal(
    await page.evaluate(() => JSON.stringify(__POCKET__.game.state)),
    saved,
  );
  assert.match(await page.locator("#feedback").textContent(), /兼容画面/);
  await language("en");
  assert.match(await page.locator("#feedback").textContent(), /Compatibility/);
  await englishOnly();
  await click("pause");

  const cadence = await page.evaluate(async () => {
    const native = window.requestAnimationFrame.bind(window);
    let pending;
    window.requestAnimationFrame = (callback) => {
      pending = callback;
      return 0;
    };
    await new Promise(native);
    if (pending?.name !== "frame")
      throw new Error("Application frame was not captured");
    const arena = __POCKET__.arena,
      game = __POCKET__.game;
    game.reset();
    game.state.phase = "fighting";
    game.state.fighters[0].x = -15;
    game.state.fighters[1].x = 15;
    const update = arena.update,
      sample = arena.sampleFrame;
    let draws = 0,
      now = performance.now();
    arena.update = () => {
      draws++;
    };
    arena.sampleFrame = () => {};
    pending(now);
    const results = [];
    for (const hz of [60, 90, 120, 144]) {
      draws = 0;
      const before = game.state.time;
      for (let i = 0; i < hz; i++) pending((now += 1000 / hz));
      results.push({ hz, draws, simulated: before - game.state.time });
    }
    window.requestAnimationFrame = native;
    arena.update = update;
    arena.sampleFrame = sample;
    pending(performance.now());
    return results;
  });
  for (const result of cadence) {
    assert.equal(
      result.draws,
      result.hz,
      `${result.hz}Hz draws every display frame`,
    );
    assert.ok(
      Math.abs(result.simulated - 1) < 0.001,
      "simulation keeps real speed",
    );
  }
  console.log("Native frame cadence:", cadence);

  const reuse = await page.evaluate(async () => {
    const { CombatEffects } = await import("/src/render/effects.js");
    const { Scene } = await import("/node_modules/.vite/deps/three.js");
    const scene = new Scene(),
      fx = new CombatEffects(scene);
    const state = { fighters: [], projectiles: [], effects: [] };
    let first,
      reused = true,
      disposed = 0;
    for (let i = 0; i < 10; i++) {
      state.effects = [
        {
          id: i,
          type: "hit",
          x: 0,
          y: 1,
          life: 0.2,
          maxLife: 0.25,
          color: "#c5f6ff",
        },
      ];
      fx.update(state, i);
      const effect = fx.effects.get(i);
      if (!first) {
        first = effect;
        first.core.material.addEventListener("dispose", () => {
          disposed++;
        });
      } else if (first !== effect) reused = false;
      state.effects = [];
      fx.update(state, i);
    }
    const beforeDispose = disposed;
    fx.dispose();
    return {
      reused,
      beforeDispose,
      afterDispose: disposed,
      children: scene.children.length,
    };
  });
  assert.deepEqual(reuse, {
    reused: true,
    beforeDispose: 0,
    afterDispose: 1,
    children: 0,
  });

  await page.evaluate(() => {
    const [a, b] = __POCKET__.game.state.fighters;
    a.x = -1;
    b.x = 1;
    b.hp = 1;
    a.currentMove = b.currentMove = null;
    a.stun = b.stun = 0;
    a.cooldowns.attack = 0;
    __POCKET__.game.state.hitstop = 0;
  });
  await page.keyboard.press("f");
  await page.locator(".result-card").waitFor();
  assert.match(await page.locator(".result-card h2").textContent(), /P1 WINS/);
  await englishOnly();
  await language("zh");
  assert.match(await page.locator(".result-card h2").textContent(), /P1 获胜/);
  await language("en");
  await click("rematch");
  assert.equal(
    await page.evaluate(() => __POCKET__.game.state.fighters[1].hp),
    100,
  );
  await click("pause");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `English fight fits ${width}px`,
    );
    assert.ok(await page.locator('[data-setting="language"]').isVisible());
  }
  await page.screenshot({
    path: "artifacts/experience/english-fight-narrow.png",
    fullPage: true,
  });
  await click("home");
  await page.reload();
  assert.equal(
    await page.locator('[data-setting="language"]').inputValue(),
    "en",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/experience/english-home-narrow.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await englishOnly();
  assert.deepEqual(errors, []);
  console.log(
    "Language switching, match preservation, effect reuse, native cadence and narrow layouts passed.",
  );
} finally {
  await browser.close();
}
