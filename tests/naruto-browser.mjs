import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts/naruto", { recursive: true });
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
    viewport: { width: 1100, height: 900 },
  });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404"))
      errors.push(m.text());
  });
  const click = (a) => page.locator(`[data-action="${a}"]`).first().click();
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await click("start");
  assert.equal(
    await page.locator('[data-action="choose-character"]').count(),
    6,
  );
  await page.click(
    '[data-action="choose-character"][data-player="0"][data-index="2"]',
  );
  await page.click(
    '[data-action="choose-character"][data-player="1"][data-index="0"]',
  );
  await page.selectOption('[data-setting="language"]', "en");
  assert.match(
    await page.locator(".player-1 .fighter-detail").textContent(),
    /Naruto Uzumaki/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "artifacts/naruto/selection-narrow.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1100, height: 900 });
  for (const p of [0, 1])
    await page.click(`[data-action="ready"][data-player="${p}"]`);
  await click("to-maps");
  await click("fight");
  await page.waitForFunction(() => __POCKET__.arena?.clock > 0);
  assert.equal(
    await page.evaluate(() => __POCKET__.arena.fighters[0].type),
    "naruto",
  );
  assert.equal(
    await page.evaluate(() => __POCKET__.arena.fallback || false),
    false,
  );
  await page.evaluate(() => {
    window.casts = [];
    const g = __POCKET__.game,
      old = g.onEvent;
    g.onEvent = (e) => {
      old(e);
      if (e.type === "cast") casts.push(e);
    };
    g.state.phase = "fighting";
  });
  async function reset() {
    await page.evaluate(() => {
      const g = __POCKET__.game;
      g.reset();
      g.state.phase = "fighting";
      g.state.objects = [];
      g.state.fighters[0].x = -5;
      g.state.fighters[1].x = 5;
      window.casts = [];
    });
  }
  for (const [context, keys] of [
    ["neutral", []],
    ["forward", ["d"]],
    ["backward", ["a"]],
    ["crouch", ["s"]],
    ["air", ["w"]],
  ]) {
    await reset();
    for (const key of keys) await page.keyboard.down(key);
    await page.keyboard.press("g");
    await page.waitForFunction(
      (context) =>
        casts.some((e) => e.move === "skill" && e.context === context),
      context,
    );
    for (const key of keys) await page.keyboard.up(key);
  }
  await reset();
  await page.keyboard.press("h");
  await page.waitForFunction(() =>
    casts.some((e) => e.move === "ultimate" && e.visual === "bijuu"),
  );
  const snap = async (name, kind = "idle", elapsed = 0, facing = 1) => {
    const info = await page.evaluate(
      async ({ kind, elapsed, facing }) => {
        const g = __POCKET__.game,
          a = __POCKET__.arena;
        const actor = a.fighters[0];
        g.reset();
        g.state.phase = "fighting";
        g.state.objects = [];
        g.state.fighters[0].x = -2.5 * facing;
        g.state.fighters[1].x = 2.5 * facing;
        g.state.fighters[0].facing = facing;
        g.state.fighters[1].facing = -facing;
        const f = g.state.fighters[0];
        if (kind === "crouch") {
          f.crouching = true;
          f.action = "crouch";
        } else if (kind === "air") {
          f.grounded = false;
          f.y = 2;
          f.vy = 1;
          f.action = "jump";
        } else if (kind !== "idle") {
          g.beginMove(
            f,
            kind === "bijuu" ? "ultimate" : "skill",
            kind === "substitution" ? "backward" : "neutral",
          );
          for (let t = 0; t < elapsed; t += 1 / 120) g.step(1 / 120);
        }
        g.paused = true;
        const render = a.renderer.render;
        a.renderer.render = () => {};
        for (let i = 0; i < 45; i++) a.update(g.state, 1 / 60);
        a.renderer.render = render;
        a.update(g.state, 0);
        const T = await import("/node_modules/three/build/three.module.js");
        const orb = new T.Vector3();
        actor.bijuu.getWorldPosition(orb);
        const hands = [actor.bones.leftHand, actor.bones.rightHand].map((hand) => {
          const position = hand.getWorldPosition(new T.Vector3());
          return position.distanceTo(orb);
        });
        return {
          calls: a.renderer.info.render.calls,
          triangles: a.renderer.info.render.triangles,
          rasengan: a.fighters[0].rasengan.visible,
          bijuu: a.fighters[0].bijuu.visible,
          kurama: actor.kurama.visible,
          kuramaTails: actor.kurama.userData.tails.length,
          kuramaHead: !!actor.kurama.userData.modelHead,
          userKurama: actor.kurama.userData.userModel,
          foxForward: new T.Vector3(0, 0, 1)
            .applyQuaternion(actor.kurama.quaternion).toArray(),
          userOrb: !!actor.bijuu.getObjectByName("user-bijuu"),
          kuramaHeadHeight: actor.kurama.userData.modelHead
            ? new T.Box3()
                .setFromObject(actor.kurama.userData.modelHead, true)
                .getSize(new T.Vector3()).y
            : 0,
          kuramaHeadFallback: actor.kurama.userData.headFallback.visible,
          handsToBijuu: hands,
          feet: [
            new T.Box3().setFromObject(
              a.fighters[0].model || a.fighters[0].root,
              true,
            ).min.y,
          ],
          projectiles: g.state.projectiles.map((p) => p.move.visual),
          effects: g.state.effects.map((e) => e.type),
          programs: a.renderer.info.programs.length,
        };
      },
      { kind, elapsed, facing },
    );
    await page
      .locator("#battle-shell")
      .screenshot({ path: `artifacts/naruto/${name}.png` });
    return info;
  };
  const idle = await snap("proportions");
  assert.ok(idle.calls < 130);
  const crouch = await snap("crouch", "crouch");
  assert.ok(crouch.feet.every((y) => Math.abs(y) < 0.05));
  await snap("air", "air");
  const r = await snap("rasengan", "rasengan", 0.32);
  assert.equal(r.rasengan, true);
  const b = await snap("bijuu-charge", "bijuu", 0.8);
  assert.equal(b.bijuu, true);
  assert.equal(b.kurama, true);
  assert.equal(b.kuramaTails, 9);
  assert.equal(b.kuramaHead, true);
  assert.ok(b.kuramaHeadHeight > 5.7 && b.kuramaHeadHeight < 7.2);
  assert.equal(b.kuramaHeadFallback, false);
  assert.equal(b.userKurama, true);
  assert.ok(b.foxForward[0] > 0.999 && Math.abs(b.foxForward[2]) < 0.001);
  assert.equal(b.userOrb, true);
  assert.ok(Math.min(...b.handsToBijuu) > 0.4 && Math.min(...b.handsToBijuu) < 0.7);
  const mirrored = await snap("bijuu-charge-mirrored", "bijuu", 0.8, -1);
  assert.ok(Math.abs(Math.min(...mirrored.handsToBijuu) - 0.52) < 0.02);
  assert.equal(mirrored.userKurama, true);
  assert.ok(mirrored.foxForward[0] < -0.999 && Math.abs(mirrored.foxForward[2]) < 0.001);
  const shot = await snap("bijuu-release", "bijuu", 1.02);
  assert.ok(shot.projectiles.includes("bijuu"));
  const sub = await snap("substitution", "substitution", 0.2);
  assert.ok(sub.effects.includes("substitution"));
  assert.ok(sub.projectiles.includes("kunai"));
  await snap("bijuu-impact", "bijuu", 1.2);
  console.log("Naruto render metrics:", { idle, r, charge: b, shot });
  await click("pause");
  await click("reselect");
  for (const p of [0, 1]) {
    await page.click(
      `[data-action="choose-character"][data-player="${p}"][data-index="2"]`,
    );
    await page.click(`[data-action="ready"][data-player="${p}"]`);
  }
  await click("to-maps");
  await click("fight");
  await page.waitForFunction(() => __POCKET__.arena?.clock > 0);
  await page.evaluate(() => {
    const g = __POCKET__.game;
    g.reset();
    g.state.phase = "fighting";
    g.state.objects = [];
    g.state.fighters[0].x = -10;
    g.state.fighters[1].x = 10;
    window.casts = [];
    g.onEvent = (e) => {
      if (e.type === "cast") casts.push(e);
    };
  });
  assert.deepEqual(
    await page.evaluate(() => __POCKET__.arena.fighters.map((f) => f.type)),
    ["naruto", "naruto"],
  );
  await page.keyboard.press("k");
  await page.waitForFunction(() =>
    casts.some((e) => e.player === 1 && e.move === "skill"),
  );
  await page.waitForFunction(
    () => !__POCKET__.game.state.fighters[1].currentMove,
  );
  await page.keyboard.press("l");
  await page.waitForFunction(() =>
    casts.some((e) => e.player === 1 && e.move === "ultimate"),
  );
  await page.evaluate(() => {
    const g = __POCKET__.game;
    g.reset();
    g.state.phase = "fighting";
    g.state.fighters[0].x = -0.9;
    g.state.fighters[1].x = 0.9;
    g.state.fighters[1].hp = 1;
  });
  await page.keyboard.press("f");
  await page.locator(".result-card").waitFor();
  assert.match(
    await page.locator(".result-card").textContent(),
    /Naruto Uzumaki/,
  );
  await click("rematch");
  assert.equal(
    await page.evaluate(() => __POCKET__.game.state.fighters[1].hp),
    100,
  );
  await click("home");
  await click("credits");
  const credits = await page.locator(".model-credits").textContent();
  assert.match(credits, /Kurama/);
  assert.match(credits, /created and provided by dx0018/);
  await click("close-credits");
  const compatible = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  compatible.on("pageerror", (error) => errors.push(error.message));
  await compatible.route("**/previews/*.webp", (route) => route.abort());
  await compatible.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/i.test(type) ? null : native.call(this, type, ...args);
    };
  });
  await compatible.goto(process.env.TEST_URL || "http://localhost:5173");
  await compatible.click('[data-action="start"]');
  await compatible.click(
    '[data-action="choose-character"][data-player="0"][data-index="2"]',
  );
  await compatible.locator(".player-1 .fighter-card.selected svg").waitFor();
  for (const p of [0, 1])
    await compatible.click(`[data-action="ready"][data-player="${p}"]`);
  await compatible.click('[data-action="to-maps"]');
  await compatible.click('[data-action="fight"]');
  assert.equal(
    await compatible.evaluate(() => __POCKET__.arena.fallback),
    true,
  );
  await compatible.evaluate(() => {
    __POCKET__.game.state.phase = "fighting";
  });
  await compatible.keyboard.press("g");
  await compatible.waitForFunction(
    () => __POCKET__.game.state.fighters[0].cooldowns.skill > 0,
  );
  await compatible.evaluate(() => {
    const g = __POCKET__.game;
    g.reset();
    g.state.phase = "fighting";
  });
  await compatible.keyboard.press("h");
  await compatible.waitForFunction(
    () =>
      __POCKET__.game.state.fighters[0].currentMove?.move.visual === "bijuu",
  );
  await compatible.screenshot({
    path: "artifacts/naruto/fallback.png",
    fullPage: true,
  });
  await compatible.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Naruto keyboard skills, WebGL models and effects, grounded crouch, mirror matches, KO/rematch and narrow English selection.",
  );
} finally {
  await browser.close();
}
