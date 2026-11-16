import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const directory = "artifacts/motion/flow-frames";
await mkdir(directory, { recursive: true });
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
  const page = await browser.newPage({ viewport: { width: 800, height: 400 } }),
    errors = [];
  page.setDefaultTimeout(90000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.TEST_URL || "http://localhost:5173");
  await page.click("[data-action=start]");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { RoomEnvironment } =
        await import("/node_modules/three/examples/jsm/environments/RoomEnvironment.js"),
      { makeFighter } = await import("/src/render/fighters.js"),
      { animateFighter } = await import("/src/render/animation.js"),
      { Game } = await import("/src/game/engine.js"),
      { characters, maps } = await import("/src/config/content.js"),
      { softShadow } = await import("/src/render/primitives.js");
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(800, 400);
    renderer.setClearColor("#213b36");
    renderer.setScissorTest(true);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(34, 1, 0.1, 300);
    scene.add(new T.HemisphereLight("#e5f4fc", "#496955", 1.2));
    const light = new T.DirectionalLight("#fff0d8", 2.8);
    light.position.set(-5, 7, 6);
    scene.add(light);
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.3;
    room.dispose();
    pmrem.dispose();
    const floor = new T.Mesh(
      new T.PlaneGeometry(100, 40),
      new T.MeshStandardMaterial({ color: "#34554b", roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    scene.add(floor, new T.GridHelper(100, 100, "#60766c", "#446358"));
    const models = characters.map(makeFighter),
      shadows = characters.map(softShadow);
    models.forEach((m, i) => scene.add(m.root, shadows[i]));
    const game = new Game({ characters, map: maps[0] });
    game.state.phase = "fighting";
    game.state.fighters[0].x = -10;
    game.state.fighters[1].x = 10;
    for (let i = 0; i < 60; i++)
      models.forEach((m, j) =>
        animateFighter(m, game.state.fighters[j], 1 / 60, i / 60, j),
      );
    let elapsed = 0;
    window.drawFlow = () => {
      for (let step = 0; step < 4; step++) {
        const moving =
            (elapsed >= 0.3 && elapsed < 1) ||
            (elapsed >= 4.1 && elapsed < 4.35),
          backwards = elapsed >= 1.3 && elapsed < 2,
          attack = [2.3, 3.05, 3.8, 4.35].some(
            (t) => elapsed >= t && elapsed < t + 0.025,
          );
        game.step(1 / 120, [
          { right: moving, left: backwards, attack },
          { left: moving, right: backwards, attack },
        ]);
        models.forEach((m, j) =>
          animateFighter(m, game.state.fighters[j], 1 / 120, elapsed, j),
        );
        elapsed += 1 / 120;
      }
      for (const [j, model] of models.entries()) {
        const f = game.state.fighters[j];
        models.forEach((m, i) => {
          m.root.visible = i === j;
          shadows[i].visible = i === j;
        });
        shadows[j].position.x = f.x;
        camera.position.set(f.x, 1.9, 6.4);
        camera.lookAt(f.x, 1.55, 0);
        renderer.setViewport(j * 400, 0, 400, 400);
        renderer.setScissor(j * 400, 0, 400, 400);
        renderer.render(scene, camera);
        model.root.updateMatrixWorld(true);
        for (const leg of model.legs)
          if (
            leg.planted &&
            new T.Box3().setFromObject(leg.foot, true).min.y > 0.045
          )
            throw new Error(`Floating support foot: ${f.character.id}`);
      }
      return renderer.domElement.toDataURL("image/png").split(",")[1];
    };
  });
  for (let i = 0; i < 156; i++) {
    const frame = await page.evaluate(() => drawFlow());
    await writeFile(
      `${directory}/${String(i).padStart(3, "0")}.png`,
      Buffer.from(frame, "base64"),
    );
    if (i % 30 === 0) console.log(`Motion preview: ${i}/156 frames`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  await promisify(execFile)("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    "30",
    "-i",
    `${directory}/%03d.png`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "20",
    "-movflags",
    "+faststart",
    "artifacts/motion/walk-punch.mp4",
  ]);
  console.log(
    "Rendered both fighters walking, stopping, reversing and punching to artifacts/motion/walk-punch.mp4",
  );
} finally {
  await browser.close();
}
