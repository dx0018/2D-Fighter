import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/previews", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.setDefaultTimeout(90000);
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await page.click("[data-action=start]");
  const files = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { RoomEnvironment } =
      await import("/node_modules/three/examples/jsm/environments/RoomEnvironment.js");
    const { makeFighter } = await import("/src/render/fighters.js"),
      { animateFighter } = await import("/src/render/animation.js"),
      { softShadow, disposeTree } = await import("/src/render/primitives.js"),
      { characters, maps } = await import("/src/config/content.js"),
      { ArenaRenderer } = await import("/src/render/arena.js"),
      { Game } = await import("/src/game/engine.js");
    const files = [];
    for (const [i, c] of characters.entries()) {
      const r = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      r.setSize(480, 520);
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1;
      const scene = new THREE.Scene(),
        cam = new THREE.PerspectiveCamera(35, 480 / 520, 0.1, 100);
      cam.position.set(0, 1.7, 6.7);
      cam.lookAt(0, 1.65, 0);
      scene.add(new THREE.HemisphereLight("#ddf1ff", "#56545c", 1));
      const light = new THREE.DirectionalLight("#fff1d9", 3);
      light.position.set(-4, 6, 5);
      scene.add(light);
      const rim = new THREE.DirectionalLight("#98d8fa", 2);
      rim.position.set(3, 4, -3);
      scene.add(rim);
      const gen = new THREE.PMREMGenerator(r),
        room = new RoomEnvironment(),
        env = gen.fromScene(room, 0.05);
      scene.environment = env.texture;
      scene.environmentIntensity = 0.3;
      const m = makeFighter(c);
      scene.add(m.root, softShadow());
      const state = {
        character: c,
        x: 0,
        y: 0,
        facing: i === 0 ? 1 : -1,
        grounded: true,
        action: "idle",
        actionTime: 0,
        flash: 0,
      };
      for (let j = 0; j < 40; j++) animateFighter(m, state, 1 / 60, 1, i);
      r.render(scene, cam);
      files.push({
        name: c.id,
        data: r.domElement.toDataURL("image/webp", 0.94).split(",")[1],
      });
      disposeTree(scene);
      env.dispose();
      room.dispose();
      gen.dispose();
      r.dispose();
      r.forceContextLoss();
    }
    for (const map of maps) {
      const host = document.createElement("div");
      host.style.cssText =
        "width:960px;height:540px;position:fixed;left:0;top:0";
      document.body.append(host);
      const arena = new ArenaRenderer(host, {
        map,
        characters,
        quality: "high",
      });
      const game = new Game({ characters, map });
      for (const f of arena.fighters) f.root.visible = false;
      for (const shadow of arena.shadows) shadow.visible = false;
      arena.update(game.state, 1);
      files.push({
        name: map.id,
        data: arena.canvas.toDataURL("image/webp", 0.9).split(",")[1],
      });
      arena.dispose();
      host.remove();
    }
    return files;
  });
  for (const { name, data } of files) {
    await writeFile(
      `public/previews/${name}.webp`,
      Buffer.from(data, "base64"),
    );
    console.log(name);
  }
} finally {
  await browser.close();
}
