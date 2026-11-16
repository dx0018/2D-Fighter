import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts/motion", { recursive: true });
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
    viewport: { width: 1536, height: 720 },
  });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404"))
      errors.push(m.text());
  });
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await page.click("[data-action=start]");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { RoomEnvironment } =
        await import("/node_modules/three/examples/jsm/environments/RoomEnvironment.js"),
      { makeFighter } = await import("/src/render/fighters.js"),
      { loadFighterModel } = await import("/src/render/model-loader.js"),
      { animateFighter } = await import("/src/render/animation.js"),
      { characters } = await import("/src/config/content.js"),
      { softShadow, disposeTree } = await import("/src/render/primitives.js");
    document.body.innerHTML = "";
    document.body.style.cssText = "margin:0;background:#182927";
    const r = new T.WebGLRenderer({ antialias: true });
    r.setSize(1536, characters.length * 360);
    r.setClearColor("#233735");
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    document.body.append(r.domElement);
    r.setScissorTest(true);
    const s = new T.Scene();
    s.add(new T.HemisphereLight("#dbedfa", "#65736a", 1.2));
    const key = new T.DirectionalLight("#fff0d8", 2.8);
    key.position.set(-4, 7, 6);
    s.add(key);
    const rim = new T.DirectionalLight("#91d4ee", 1);
    rim.position.set(4, 5, -3);
    s.add(rim);
    const pm = new T.PMREMGenerator(r),
      room = new RoomEnvironment(),
      env = pm.fromScene(room, 0.04);
    s.environment = env.texture;
    s.environmentIntensity = 0.3;
    const cam = new T.PerspectiveCamera(34, 256 / 360, 0.1, 100);
    cam.position.set(0, 1.68, 6.9);
    cam.lookAt(0, 1.68, 0);
    const labels = [
      "待机",
      "踏步 · 支撑",
      "踏步 · 摆腿",
      "下蹲",
      "空中收腿",
      "普攻",
    ];
    for (const [row, c] of characters.entries()) {
      const model = (await loadFighterModel(c).catch(() => null)) || makeFighter(c),
        shadow = softShadow();
      s.add(model.root, shadow);
      const neutral = () => ({
        character: c,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        walkDistance: 0,
        grounded: true,
        facing: 1,
        action: "idle",
        flash: 0,
      });
      for (let col = 0; col < 6; col++) {
        let f = neutral();
        for (let i = 0; i < 60; i++)
          animateFighter(model, f, 1 / 60, i / 60, row);
        if (col === 1 || col === 2)
          Object.assign(f, {
            action: "walk",
            vx: c.speed,
            walkDistance: col === 1 ? 0.25 : 0.95,
          });
        if (col === 3) Object.assign(f, { action: "crouch", crouching: true });
        if (col === 4)
          Object.assign(f, { action: "jump", grounded: false, y: 0.35, vy: 2 });
        if (col === 5)
          Object.assign(f, {
            action: "attack",
            currentMove: {
              key: "attack",
              move: c.moves.attack,
              elapsed: c.moves.attack.windup + 0.035,
            },
          });
        for (let i = 0; i < 45; i++)
          animateFighter(model, f, 1 / 60, i / 60, row);
        s.updateMatrixWorld(true);
        r.setViewport(col * 256, (characters.length - 1 - row) * 360, 256, 360);
        r.setScissor(col * 256, (characters.length - 1 - row) * 360, 256, 360);
        r.render(s, cam);
        const label = document.createElement("div");
        label.style.cssText = `position:absolute;left:${col * 256 + 12}px;top:${row * 360 + 331}px;color:#d8eddc;font:13px sans-serif`;
        label.textContent = labels[col];
        document.body.append(label);
      }
      s.remove(model.root, shadow);
      disposeTree(model.root);
      model.skeleton?.dispose();
      model.root.traverse((node) => node.skeleton?.dispose());
    }
  });
  await page.screenshot({ path: "artifacts/motion/poses.png", fullPage: true });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Rendered rigid proportions, fixed-length skinning and six poses per character.",
  );
} finally {
  await browser.close();
}
