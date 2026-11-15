import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts/performance", { recursive: true });
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
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404"))
      errors.push(m.text());
  });
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await page.click("[data-action=start]");
  for (const p of [0, 1])
    await page.click(`[data-action=ready][data-player="${p}"]`);
  await page.click("[data-action=to-maps]");
  await page.click("[data-action=fight]");
  await page.waitForFunction(() => __POCKET__.arena?.clock > 0.05);
  const result = await page.evaluate(async () => {
    const a = __POCKET__.arena,
      g = __POCKET__.game;
    g.paused = true;
    g.state.phase = "fighting";
    const next = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
    await new Promise(next);
    const samples = [];
    for (let i = 0; i < 42; i++) {
      const start = performance.now();
      a.update(g.state, 1 / 60);
      await new Promise(next);
      if (i >= 12) samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return {
      renderer: "Chromium SwiftShader",
      viewport: [1280, 800],
      canvas: [a.canvas.width, a.canvas.height],
      profile: a.quality.profile,
      calls: a.renderer.info.render.calls,
      triangles: a.renderer.info.render.triangles,
      median: samples[15],
      p95: samples[28],
      samples,
    };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    process.env.PROFILE_OUTPUT || "artifacts/performance/after.json",
    JSON.stringify(result, null, 2),
  );
  console.log({ ...result, samples: undefined });
} finally {
  await browser.close();
}
