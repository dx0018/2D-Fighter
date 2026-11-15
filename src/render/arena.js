import * as THREE from "three";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = (a, b, dt, speed = 5) =>
  a + (b - a) * (1 - Math.exp(-dt * speed));
const mats = new Map();
function material(color, options = {}) {
  const key = `${color}:${JSON.stringify(options)}`;
  if (!mats.has(key))
    mats.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0.02,
        ...options,
      }),
    );
  return mats.get(key);
}
function mesh(group, geometry, color, pos, scale, opts = {}) {
  const obj = new THREE.Mesh(geometry, material(color, opts));
  if (pos) obj.position.set(...pos);
  if (scale) obj.scale.set(...scale);
  obj.castShadow = true;
  obj.receiveShadow = true;
  group.add(obj);
  return obj;
}
const ballGeo = new THREE.SphereGeometry(1, 28, 20);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sphere = (g, c, p, s, o) => mesh(g, ballGeo, c, p, s, o);
const box = (g, c, p, s, o) => mesh(g, boxGeo, c, p, s, o);
function cylinder(g, color, pos, rt, rb, h, segments = 16) {
  return mesh(g, new THREE.CylinderGeometry(rt, rb, h, segments), color, pos);
}
function line(g, points, color, r = 0.018) {
  const path = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  return mesh(g, new THREE.TubeGeometry(path, 16, r, 6, false), color);
}
function labelTexture(text, bg, fg = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 180;
  const c = canvas.getContext("2d");
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 180);
  c.strokeStyle = fg;
  c.lineWidth = 6;
  c.strokeRect(12, 12, 488, 156);
  c.fillStyle = fg;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "bold 54px sans-serif";
  c.fillText(text, 256, 94, 470);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function plaque(g, text, color, pos, size, ink = "#ffffff") {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({
      map: labelTexture(text, color, ink),
      roughness: 0.8,
    }),
  );
  m.position.set(...pos);
  m.castShadow = true;
  g.add(m);
  return m;
}

function buildDoraemon() {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  sphere(body, "#109ee8", [0, 1.12, 0], [0.77, 0.82, 0.5]);
  sphere(body, "#f3f8f5", [0, 1.13, 0.43], [0.59, 0.63, 0.13]);
  const pocket = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    material("#f5fffc"),
  );
  pocket.rotation.z = Math.PI;
  pocket.position.set(0, 1.15, 0.56);
  pocket.scale.z = 0.12;
  body.add(pocket);
  line(
    body,
    [
      [-0.35, 1.15, 0.59],
      [0, 1.13, 0.62],
      [0.35, 1.15, 0.59],
    ],
    "#a6c5c9",
    0.018,
  );
  cylinder(body, "#e93641", [0, 1.72, 0], 0.62, 0.62, 0.11, 32);
  sphere(body, "#ffcf4b", [0, 1.63, 0.56], [0.115, 0.13, 0.09], {
    metalness: 0.35,
    roughness: 0.35,
  });
  line(
    body,
    [
      [-0.075, 1.65, 0.65],
      [0.075, 1.65, 0.65],
    ],
    "#926b2e",
    0.012,
  );
  sphere(body, "#665128", [0, 1.57, 0.645], [0.018, 0.03, 0.01]);
  const head = new THREE.Group();
  head.position.y = 2.16;
  body.add(head);
  sphere(head, "#139fe7", [0, 0, 0], [0.88, 0.79, 0.63]);
  sphere(head, "#f5faf4", [0, -0.11, 0.47], [0.73, 0.61, 0.25]);
  [-1, 1].forEach((s) => {
    sphere(head, "#ffffff", [s * 0.22, 0.28, 0.57], [0.235, 0.3, 0.13]);
    sphere(head, "#152941", [s * 0.13, 0.26, 0.695], [0.055, 0.097, 0.018]);
    sphere(
      head,
      "#ffffff",
      [s * 0.13 - 0.015, 0.29, 0.714],
      [0.017, 0.026, 0.006],
    );
    line(
      head,
      [
        [s * 0.31, -0.12, 0.695],
        [s * 0.65, -0.08, 0.65],
      ],
      "#233846",
      0.014,
    );
    line(
      head,
      [
        [s * 0.33, -0.22, 0.695],
        [s * 0.67, -0.25, 0.63],
      ],
      "#233846",
      0.014,
    );
    line(
      head,
      [
        [s * 0.31, -0.3, 0.67],
        [s * 0.59, -0.42, 0.6],
      ],
      "#233846",
      0.014,
    );
  });
  sphere(head, "#ed3d43", [0, 0.04, 0.76], [0.13, 0.12, 0.1], {
    roughness: 0.36,
  });
  sphere(head, "#ffb5ac", [-0.035, 0.075, 0.84], [0.035, 0.024, 0.013]);
  line(
    head,
    [
      [0, -0.07, 0.75],
      [0, -0.29, 0.72],
    ],
    "#1f3442",
    0.014,
  );
  line(
    head,
    [
      [-0.42, -0.27, 0.64],
      [-0.25, -0.45, 0.65],
      [0, -0.5, 0.68],
      [0.25, -0.45, 0.65],
      [0.42, -0.27, 0.64],
    ],
    "#253a43",
    0.018,
  );
  const arms = [];
  [-1, 1].forEach((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.67, 1.49, 0);
    body.add(arm);
    const limb = sphere(
      arm,
      "#0e98df",
      [s * 0.18, -0.19, 0],
      [0.28, 0.43, 0.28],
    );
    limb.rotation.z = s * 0.5;
    sphere(arm, "#fafbf4", [s * 0.31, -0.46, 0.07], [0.27, 0.25, 0.28]);
    arms.push(arm);
  });
  const feet = [];
  [-1, 1].forEach((s) =>
    feet.push(
      sphere(body, "#f4f9f6", [s * 0.39, 0.18, 0.18], [0.4, 0.2, 0.46]),
    ),
  );
  return { root, body, head, arms, feet, baseHead: 2.16, type: "doraemon" };
}
function buildPo() {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  sphere(body, "#ec4e53", [0, 1.1, 0], [0.7, 0.88, 0.48]);
  sphere(body, "#d5d6d1", [0, 1.14, 0.45], [0.43, 0.43, 0.075], {
    metalness: 0.2,
    roughness: 0.42,
  });
  box(body, "#b0b8b8", [0, 1.14, 0.5], [0.52, 0.52, 0.045], {
    roughness: 0.3,
    metalness: 0.18,
  });
  box(body, "#c3e3dc", [-0.025, 1.17, 0.53], [0.41, 0.38, 0.015], {
    roughness: 0.3,
  });
  const head = new THREE.Group();
  head.position.y = 2.2;
  body.add(head);
  sphere(head, "#ef5558", [0, 0, 0], [0.73, 0.68, 0.52]);
  [-1, 1].forEach((s) => {
    sphere(head, "#ec5157", [s * 0.71, 0.06, 0], [0.27, 0.2, 0.18]);
    sphere(head, "#d8283d", [s * 0.76, 0.06, 0.13], [0.13, 0.1, 0.05]);
  });
  sphere(head, "#f0c8a5", [0, -0.04, 0.46], [0.53, 0.48, 0.12]);
  [-1, 1].forEach((s) => {
    sphere(head, "#fff9ed", [s * 0.18, 0.06, 0.57], [0.105, 0.115, 0.04]);
    sphere(head, "#352a30", [s * 0.17, 0.055, 0.609], [0.045, 0.066, 0.018]);
    sphere(head, "#e79d91", [s * 0.31, -0.19, 0.57], [0.085, 0.05, 0.018]);
  });
  sphere(head, "#e5b593", [0, -0.11, 0.6], [0.095, 0.075, 0.07]);
  line(
    head,
    [
      [-0.18, -0.24, 0.57],
      [0, -0.32, 0.59],
      [0.18, -0.24, 0.57],
    ],
    "#8c4a49",
    0.022,
  );
  cylinder(head, "#ed4d54", [0, 0.72, 0], 0.07, 0.08, 0.35);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.065, 10, 24),
    material("#ed4d54"),
  );
  ring.position.set(0, 0.98, 0);
  head.add(ring);
  const arms = [],
    feet = [];
  [-1, 1].forEach((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * 0.57, 1.52, 0);
    body.add(arm);
    const limb = sphere(
      arm,
      "#e94a51",
      [s * 0.22, -0.25, 0],
      [0.25, 0.49, 0.25],
    );
    limb.rotation.z = s * 0.48;
    sphere(arm, "#ef5559", [s * 0.4, -0.55, 0.025], [0.24, 0.24, 0.25]);
    arms.push(arm);
    sphere(body, "#df3c48", [s * 0.3, 0.4, 0], [0.3, 0.51, 0.31]);
    feet.push(
      sphere(body, "#e84b52", [s * 0.32, 0.16, 0.13], [0.34, 0.2, 0.43]),
    );
  });
  return { root, body, head, arms, feet, baseHead: 2.2, type: "po" };
}
// Additional procedural models can register a builder without changing match flow.
const fighterBuilders = new Map([
  ["robot-cat", buildDoraemon],
  ["antenna", buildPo],
]);
export function registerFighterModel(bodyStyle, builder) {
  fighterBuilders.set(bodyStyle, builder);
}
function makeFighter(character) {
  const fallback = character.id === "po" ? buildPo : buildDoraemon;
  return (fighterBuilders.get(character.bodyStyle) || fallback)(character);
}

function tree(g, x, z, scale = 1, moon = false) {
  const t = new THREE.Group();
  t.position.set(x, 0, z);
  t.scale.setScalar(scale);
  g.add(t);
  cylinder(t, moon ? "#76778e" : "#8f735d", [0, 1, 0], 0.17, 0.25, 2);
  sphere(t, moon ? "#a4bbad" : "#6c9c79", [0, 2.65, 0], [1.2, 1.4, 1]);
  sphere(t, moon ? "#c9d5c1" : "#96bd8d", [-0.7, 2.55, 0.15], [0.8, 0.9, 0.8]);
  sphere(t, moon ? "#91aaa0" : "#88ac7b", [0.6, 2.45, 0.1], [0.8, 1, 0.8]);
}
function lamp(g, x, z, theme) {
  cylinder(g, "#5e6865", [x, 1.6, z], 0.055, 0.08, 3.2);
  const cap = box(g, "#435a51", [x, 3.25, z], [0.48, 0.12, 0.48]);
  box(
    g,
    theme === "moon" ? "#ffe2a3" : "#fff3c9",
    [x, 3.05, z],
    [0.3, 0.38, 0.3],
    { emissive: "#ffda8a", emissiveIntensity: theme === "moon" ? 0.7 : 0.1 },
  );
}
function house(g, x, z, w, h, color, roof) {
  box(g, color, [x, h / 2, z], [w, h, 2.8]);
  const roofMesh = mesh(
    g,
    new THREE.CylinderGeometry(w * 0.66, w * 0.66, 0.45, 3),
    roof,
    [x, h + 0.1, z],
    [1, 1, 0.83],
  );
  roofMesh.rotation.z = Math.PI / 2;
  roofMesh.rotation.y = Math.PI / 2;
  box(g, roof, [x, h + 0.1, z], [w + 0.4, 0.25, 3.15]);
  for (let y = 1; y < h - 0.5; y += 1.5)
    for (let dx = -w / 2 + 0.6; dx < w / 2 - 0.2; dx += 1.15) {
      box(g, "#576f76", [x + dx, y, z + 1.42], [0.61, 0.82, 0.055]);
      box(g, "#cee3d5", [x + dx, y + 0.04, z + 1.46], [0.49, 0.64, 0.025]);
      box(g, "#f7edcf", [x + dx, y, z + 1.48], [0.035, 0.67, 0.025]);
    }
  box(g, "#826959", [x, h > 4 ? 0.65 : 0.7, z + 1.45], [0.65, 1.3, 0.07]);
}
function buildStage(scene, map) {
  const g = new THREE.Group();
  scene.add(g);
  const theme = map.theme || "town";
  const sky = map.colors?.sky || "#d9e8e3";
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 38, 100);
  const left = map.bounds?.left ?? -17,
    right = map.bounds?.right ?? 17,
    mid = (left + right) / 2,
    width = right - left;
  box(
    g,
    map.colors?.ground || "#d2bb94",
    [mid, -0.18, 12],
    [width + 48, 0.35, 70],
  );
  // Individual paving stripes and inset combat lane give a clear sense of depth.
  box(
    g,
    theme === "moon" ? "#859699" : "#d8c6a7",
    [mid, -0.001, 0],
    [width + 0.4, 0.025, 4.4],
  );
  for (let x = left - 4; x <= right + 4; x += 2.1) {
    box(
      g,
      theme === "moon" ? "#73878a" : "#bba98e",
      [x, 0.015, 0],
      [0.018, 0.016, 7.5],
    );
  }
  for (const z of [-3, -1.4, 1.4, 3])
    box(
      g,
      theme === "moon" ? "#73878a" : "#bba98e",
      [mid, 0.015, z],
      [width + 8, 0.016, 0.018],
    );
  box(g, "#ebe2cd", [mid, 0.08, -3.5], [width + 10, 0.18, 0.65]);
  box(
    g,
    theme === "moon" ? "#798e91" : "#a8b998",
    [mid, 0.14, -5.8],
    [width + 20, 0.35, 4],
  );
  if (theme === "town") {
    house(g, -13, -8, 5, 5.3, "#e4d1ab", "#a67d65");
    house(g, -7, -8.5, 5.7, 6.8, "#eadfc8", "#798c79");
    house(g, 1.2, -9, 7, 5, "#dfbaa4", "#a77866");
    house(g, 10, -9, 7, 6.2, "#d1d8bc", "#829177");
    plaque(g, "POCKET CLUB", "#d5956e", [-7, 3.45, -6.98], [4.7, 0.8, 0.1]);
    for (let i = 0; i < 8; i++) {
      const aw = box(
        g,
        i % 2 ? "#f5e9ce" : "#d57e66",
        [-9.38 + i * 0.68, 2.65, -6.46],
        [0.68, 0.18, 1.2],
      );
      aw.rotation.x = 0.2;
    }
    box(g, "#d0a77d", [-7, 0.7, -5.6], [4.5, 1.35, 0.7]);
    tree(g, -16, -5.4, 1.4);
    tree(g, 16, -5.5, 1.5);
    tree(g, 5, -6.5, 0.95);
    lamp(g, -11, -3.6, theme);
    lamp(g, 11, -3.6, theme);
  } else if (theme === "sunset") {
    const sun = sphere(g, "#ffdfa8", [1, 7, -20], [3.2, 3.2, 0.4], {
      emissive: "#ffc879",
      emissiveIntensity: 0.5,
    });
    sun.castShadow = false;
    for (let i = 0; i < 8; i++) {
      const hill = sphere(
        g,
        i % 2 ? "#be9b91" : "#c8aaa1",
        [-23 + i * 7, -1, -19],
        [7, 4 + (i % 3), 3],
      );
      hill.castShadow = false;
    }
    for (const x of [-16, -11, 12, 17]) {
      tree(g, x, -5.6, 1.25);
    }
    box(g, "#957a70", [mid, 0.9, -4.6], [width + 6, 0.14, 0.15]);
    for (let x = left - 2; x <= right + 2; x += 3)
      box(g, "#957a70", [x, 0.5, -4.6], [0.14, 1.1, 0.14]);
    for (const x of [-8, 8]) {
      box(g, "#b18367", [x, 0.6, -3.8], [2.4, 0.17, 0.5]);
      box(g, "#b18367", [x, 1.06, -4], [2.4, 0.45, 0.1]);
      [-0.8, 0.8].forEach((dx) =>
        box(g, "#6e7467", [x + dx, 0.3, -3.8], [0.1, 0.6, 0.1]),
      );
    }
  } else {
    const moon = sphere(g, "#f4efd7", [5, 8, -21], [2.4, 2.4, 0.4], {
      emissive: "#f1edd1",
      emissiveIntensity: 0.8,
    });
    moon.castShadow = false;
    for (let i = 0; i < 35; i++) {
      const x = (Math.sin(i * 123.4) * 0.5 + 0.5) * 60 - 30,
        y = 5 + (Math.sin(i * 73.2) * 0.5 + 0.5) * 12;
      const star = sphere(g, "#dbe7d7", [x, y, -25], [0.035, 0.035, 0.035], {
        emissive: "#dbe7d7",
        emissiveIntensity: 1,
      });
      star.castShadow = false;
    }
    for (const x of [-16, -10, 12, 18]) tree(g, x, -7, 1.6, true);
    house(g, -4, -10, 6, 3.5, "#96a6a4", "#62777a");
    plaque(g, "MOON STATION", "#648082", [-4, 2.7, -8.53], [4.8, 0.7, 0.12]);
    for (const x of [-12, 0, 12]) lamp(g, x, -3.8, theme);
  }
  // Foreground curbs frame the play area without crossing character silhouettes.
  box(
    g,
    theme === "moon" ? "#657e7c" : "#9fac86",
    [mid, -0.04, 4.1],
    [width + 12, 0.35, 1],
  );
  for (const x of [left - 1, right + 1]) {
    cylinder(g, "#c2b18a", [x, 0.25, 2.7], 0.23, 0.3, 0.5);
    sphere(g, "#88a577", [x, 0.65, 2.7], [0.55, 0.55, 0.5]);
  }
  return g;
}
function makeObject(data) {
  const root = new THREE.Group();
  root.position.x = data.x;
  root.position.z = data.type === "sign" ? -0.75 : 0.1;
  const shape = new THREE.Group(),
    visual = new THREE.Group();
  root.add(shape);
  shape.add(visual);
  const w = Math.max(0.2, data.width || (data.type === "crate" ? 1.1 : 1.6));
  const h = Math.max(0.2, data.height || (data.type === "crate" ? 1.05 : 1.78));
  if (data.type === "crate") {
    box(visual, data.color || "#b78550", [0, h / 2, 0], [w, h, 0.7]);
    for (const ratio of [0.1, 0.5, 0.9])
      box(visual, "#dfb47a", [0, h * ratio, 0.37], [w, 0.075, 0.07]);
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06])
      box(visual, "#e0b67a", [x, h / 2, 0.38], [0.1, h, 0.06]);
    const brace = box(
      visual,
      "#d8aa71",
      [0, h / 2, 0.43],
      [0.1, Math.hypot(w * 0.83, h * 0.83), 0.07],
    );
    brace.rotation.z = -Math.atan(w / h);
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
      for (const y of [h * 0.12, h * 0.88])
        sphere(visual, "#7d654d", [x, y, 0.44], [0.025, 0.025, 0.012]);
  } else {
    const boardHeight = Math.min(h * 0.36, w * 0.4),
      postHeight = h - boardHeight / 2;
    cylinder(
      visual,
      "#847057",
      [0, postHeight / 2, 0],
      0.055,
      0.08,
      postHeight,
    );
    const pivot = new THREE.Group();
    pivot.position.y = h - boardHeight / 2;
    visual.add(pivot);
    const color = data.color || "#769989",
      lightness = new THREE.Color(color).getHSL({}).l;
    plaque(
      pivot,
      data.label || "POCKET PARK",
      color,
      [0, 0, 0.04],
      [w, boardHeight, 0.14],
      lightness > 0.58 ? "#45584e" : "#ffffff",
    );
    shape.userData.signPivot = pivot;
  }
  return { root, shape, type: data.type };
}

export class ArenaRenderer {
  constructor(container, { map, characters, onError } = {}) {
    this.container = container;
    this.map = map;
    this.characters = characters;
    this.clock = 0;
    this.cameraCenter = map.camera?.initialX || 0;
    this.cameraWidth = map.camera?.minWidth || 23;
    this.objects = new Map();
    this.disposed = false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.canvas = this.renderer.domElement;
      container.appendChild(this.canvas);
      this.canvas.setAttribute("aria-label", "2.5D 双人格斗场景");
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-12, 12, 7, -7, 0.1, 400);
      const hemi = new THREE.HemisphereLight(
        map.theme === "moon" ? "#c8dcf0" : "#fff9e5",
        map.theme === "moon" ? "#6c8384" : "#96a88d",
        2.4,
      );
      this.scene.add(hemi);
      const sun = new THREE.DirectionalLight(
        map.theme === "sunset" ? "#ffe0ad" : "#fff2dc",
        3.2,
      );
      sun.position.set(-8, 14, 10);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -25;
      sun.shadow.camera.right = 25;
      sun.shadow.camera.top = 15;
      sun.shadow.camera.bottom = -15;
      sun.shadow.normalBias = 0.025;
      sun.shadow.bias = -0.0002;
      sun.shadow.radius = 4;
      this.scene.add(sun);
      this.scene.add(sun.target);
      const fill = new THREE.DirectionalLight("#b9dcec", 1.3);
      fill.position.set(8, 5, -5);
      this.scene.add(fill);
      buildStage(this.scene, map);
      this.fighters = characters.map((c) => {
        const f = makeFighter(c);
        this.scene.add(f.root);
        return f;
      });
      for (const data of map.objects || []) {
        const obj = makeObject(data);
        this.objects.set(data.id, obj);
        this.scene.add(obj.root);
      }
      this.fxGroup = new THREE.Group();
      this.scene.add(this.fxGroup);
      this.fxPool = [];
      for (let i = 0; i < 80; i++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(1, 8, 6),
          new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true }),
        );
        m.visible = false;
        m.castShadow = false;
        this.fxGroup.add(m);
        this.fxPool.push(m);
      }
      this.projectileGroup = new THREE.Group();
      this.scene.add(this.projectileGroup);
      this.projectileMeshes = [];
      this.specialMeshes = [];
      for (let i = 0; i < 12; i++) {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1, 0.035, 8, 56),
          new THREE.MeshBasicMaterial({
            color: "#ffffff",
            transparent: true,
            depthWrite: false,
          }),
        );
        const beam = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({
            color: "#ffffff",
            transparent: true,
            depthWrite: false,
          }),
        );
        group.add(ring, beam);
        group.visible = false;
        this.fxGroup.add(group);
        group.userData = { ring, beam };
        this.specialMeshes.push(group);
      }
    } catch (error) {
      this.renderer?.dispose();
      this.canvas?.remove();
      this.fallback = true;
      this.canvas = document.createElement("canvas");
      container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      onError?.(error);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  resize() {
    if (this.disposed) return;
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.aspect = this.width / this.height;
    if (this.renderer && !this.fallback)
      this.renderer.setSize(this.width, this.height, false);
    else {
      this.canvas.width = this.width * 1.5;
      this.canvas.height = this.height * 1.5;
    }
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
  }
  update(state, dt = 1 / 60) {
    if (this.disposed || !state) return;
    this.clock += dt;
    const fighters = state.fighters || [];
    if (this.fallback) {
      this.drawFallback(state);
      return;
    }
    const xs = fighters.map((f) => f.x),
      lo = Math.min(...xs),
      hi = Math.max(...xs),
      limits = this.map.camera || {};
    const targetWidth = clamp(
      Math.max(limits.minWidth || 23, hi - lo + 9),
      limits.minWidth || 23,
      Math.max(limits.maxWidth || 40, hi - lo + 7),
    );
    this.cameraWidth = smooth(this.cameraWidth, targetWidth, dt, 4);
    const min = limits.left ?? this.map.bounds.left - 3,
      max = limits.right ?? this.map.bounds.right + 3;
    let targetCenter = (lo + hi) / 2;
    const half = this.cameraWidth / 2;
    targetCenter =
      max - min > this.cameraWidth
        ? clamp(targetCenter, min + half, max - half)
        : (min + max) / 2;
    this.cameraCenter = smooth(this.cameraCenter, targetCenter, dt, 5);
    // Clamp every frame after smoothing to keep arena edges stable.
    if (max - min > this.cameraWidth)
      this.cameraCenter = clamp(this.cameraCenter, min + half, max - half);
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half / this.aspect;
    this.camera.bottom = -half / this.aspect;
    this.camera.updateProjectionMatrix();
    const shake = state.shake || 0,
      offset = Math.sin(this.clock * 93) * shake * 0.12;
    const lookY = this.aspect < 1 ? 1.8 : 2.5;
    // A tall orthographic viewport must keep its lowest ray above the floor.
    // Move the eye back along the same viewing angle, preserving framing.
    const eyeZ = Math.max(28, (half / this.aspect) * 4.5 + 14);
    this.camera.position.set(
      this.cameraCenter + offset,
      lookY + eyeZ * (5.6 / 24),
      eyeZ,
    );
    this.camera.lookAt(this.cameraCenter, lookY, 0);
    this.scene.fog.near = eyeZ + 12;
    this.scene.fog.far = eyeZ + 85;
    fighters.forEach((f, i) => this.animateFighter(this.fighters[i], f, dt, i));
    for (const o of state.objects || []) {
      const m = this.objects.get(o.id);
      if (!m) continue;
      m.root.visible = !o.destroyed;
      m.shape.rotation.z = Math.sin(this.clock * 35) * (o.shake || 0) * 0.15;
      if (m.shape.userData.signPivot)
        m.shape.userData.signPivot.rotation.z =
          Math.sin(this.clock * 24) * (o.shake || 0) * 0.35;
      m.shape.scale.setScalar(1 + (o.flash > 0 ? 0.06 : 0));
    }
    this.drawEffects(state);
    this.renderer.render(this.scene, this.camera);
  }
  animateFighter(model, f, dt, index) {
    if (!model) return;
    const t = this.clock,
      action = f.action || "idle",
      move = action === "walk",
      attack = ["attack", "skill", "ultimate"].includes(action),
      hurt = action === "hurt" || f.stun > 0;
    const grounded = f.grounded ?? f.y <= 0,
      face = f.facing || 1;
    model.root.position.set(f.x, Math.max(0, f.y), 0);
    model.root.rotation.y = smooth(model.root.rotation.y, face * 0.2, dt, 10);
    model.root.rotation.z = smooth(
      model.root.rotation.z,
      hurt ? -face * 0.17 : attack ? -face * 0.08 : move ? -face * 0.05 : 0,
      dt,
      13,
    );
    let squash = f.crouching || action === "crouch" ? 0.68 : 1;
    if (action === "defeat") squash = 0.58;
    model.body.scale.y = smooth(model.body.scale.y, squash, dt, 13);
    model.body.position.y = grounded
      ? move
        ? Math.abs(Math.sin(t * 13)) * 0.075
        : Math.sin(t * 3.1 + index) * 0.035
      : 0.03;
    model.head.rotation.z = hurt
      ? Math.sin(t * 28) * 0.08
      : Math.sin(t * 2.4) * 0.025;
    model.head.rotation.x = action === "victory" ? -0.15 : 0;
    const progress = f.actionTime || 0;
    model.arms.forEach((arm, j) => {
      const side = j === 0 ? -1 : 1,
        isFront = side === face;
      let z = move ? Math.sin(t * 13 + j * Math.PI) * 0.25 : 0.08 * side;
      if (attack)
        z = isFront
          ? -side * (action === "ultimate" ? 2.05 : 1.65)
          : side * 0.55;
      if (action === "victory") z = -side * (1.9 + Math.sin(t * 6) * 0.14);
      if (hurt) z = -side * 0.65;
      if (action === "jump") z = -side * 0.7;
      arm.rotation.z = smooth(arm.rotation.z, z, dt, attack ? 22 : 12);
      arm.rotation.x = attack && isFront ? -0.25 : 0;
    });
    model.feet.forEach((foot, j) => {
      foot.position.y =
        0.18 + (move ? Math.max(0, Math.sin(t * 13 + j * Math.PI)) * 0.14 : 0);
      foot.rotation.x = move ? Math.sin(t * 13 + j * Math.PI) * 0.18 : 0;
    });
    const flash = f.flash > 0;
    model.root.traverse((o) => {
      if (o.isMesh) {
        if (!o.userData.originalMaterial)
          o.userData.originalMaterial = o.material;
        if (flash) {
          if (!o.userData.flashMaterial)
            o.userData.flashMaterial = new THREE.MeshStandardMaterial({
              color: "#fff8dd",
              emissive: "#ffb866",
              emissiveIntensity: 0.5,
            });
          o.material = o.userData.flashMaterial;
        } else o.material = o.userData.originalMaterial;
      }
    });
  }
  drawEffects(state) {
    let n = 0,
      specialIndex = 0;
    for (const e of state.effects || []) {
      const total = e.maxLife || 0.6,
        age = clamp(1 - e.life / total, 0, 1),
        big = ["ultimate", "burst", "break", "pulse", "beam"].includes(e.type),
        count = big ? 12 : 7;
      if (
        ["beam", "pulse", "cast", "slash", "dash"].includes(e.type) &&
        specialIndex < this.specialMeshes.length
      ) {
        const g = this.specialMeshes[specialIndex++],
          { ring, beam } = g.userData;
        g.visible = true;
        g.position.set(e.x || 0, e.y ?? 1, 0.45);
        ring.visible = e.type !== "beam";
        beam.visible = e.type === "beam";
        ring.material.color.set(e.color || "#a2edff");
        beam.material.color.set(e.color || "#a2edff");
        ring.material.opacity = (1 - age) * 0.8;
        beam.material.opacity = Math.sin(age * Math.PI) * 0.65;
        if (e.type === "beam") {
          const range = e.range || 12;
          beam.scale.set(range, 0.35 + Math.sin(age * Math.PI) * 0.75, 0.2);
          beam.position.x = ((e.direction || 1) * range) / 2;
        } else {
          const radius =
            e.type === "pulse"
              ? (e.radius || 6) * age
              : e.type === "cast"
                ? 0.35 + age * 0.65
                : 0.2 + age * 0.65;
          ring.scale.set(radius, radius, 1);
          ring.rotation.z = this.clock * 2;
          ring.rotation.y = e.type === "pulse" ? 0.25 : 0;
          if (e.type === "cast") {
            ring.rotation.x = 0.55;
            g.position.y += Math.sin(this.clock * 16) * 0.03;
          }
        }
      }
      for (let j = 0; j < count && n < this.fxPool.length; j++, n++) {
        const m = this.fxPool[n],
          a = (j / count) * Math.PI * 2,
          dist = age * (big ? 2.1 : 0.9),
          r = (1 - age) * (big ? 0.13 : 0.08) + 0.015;
        m.visible = true;
        m.position.set(
          (e.x || 0) + Math.cos(a) * dist,
          (e.y ?? 1.1) + Math.sin(a) * dist * (e.type === "break" ? 0.7 : 1),
          0.6 + j * 0.005,
        );
        m.scale.set(r * (j % 2 ? 2 : 1), r * (j % 2 ? 0.55 : 1), r);
        m.material.color.set(e.color || "#ffe5a6");
        m.material.opacity = 1 - age;
      }
    }
    for (; n < this.fxPool.length; n++) this.fxPool[n].visible = false;
    for (; specialIndex < this.specialMeshes.length; specialIndex++)
      this.specialMeshes[specialIndex].visible = false;
    const projectiles = state.projectiles || [];
    while (this.projectileMeshes.length < projectiles.length) {
      const group = new THREE.Group(),
        core = sphere(group, "#a2edff", [0, 0, 0], [1, 1, 1], {
          emissive: "#4bcafa",
          emissiveIntensity: 0.8,
          roughness: 0.2,
        });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.045, 8, 28),
        new THREE.MeshBasicMaterial({ color: "#c6f7ff" }),
      );
      group.add(ring);
      group.userData = { core, ring };
      this.projectileGroup.add(group);
      this.projectileMeshes.push(group);
    }
    this.projectileMeshes.forEach((m, i) => {
      const p = projectiles[i];
      m.visible = !!p;
      if (!p) return;
      const r = p.radius || 0.32;
      m.position.set(p.x, p.y ?? 1.2, 0.15);
      m.scale.set(r * 1.5, r * 1.5, r * 1.5);
      m.userData.core.material.color.set(p.color || "#86dbff");
      m.userData.ring.rotation.z = this.clock * 8;
      m.userData.ring.rotation.y = this.clock * 3;
    });
  }
  drawFallback(state) {
    const c = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = this.map.colors?.sky || "#d9e6dc";
    c.fillRect(0, 0, w, h);
    const xs = state.fighters.map((f) => f.x),
      worldW = Math.max(
        this.map.camera?.minWidth || 23,
        Math.max(...xs) - Math.min(...xs) + 8,
      ),
      scale = w / worldW,
      center = (Math.max(...xs) + Math.min(...xs)) / 2,
      base = h * 0.75;
    c.fillStyle = this.map.theme === "moon" ? "#84999b" : "#b3c4aa";
    c.fillRect(0, h * 0.5, w, h * 0.5);
    c.fillStyle = this.map.colors?.ground || "#d4c2a3";
    c.fillRect(0, base, w, h - base);
    for (let i = 0; i < 12; i++) {
      c.fillStyle = i % 2 ? "#d4c4a7" : "#e4d6b8";
      c.fillRect((i * w) / 12, h * 0.27, w / 12 - 5, h * 0.28);
      c.fillStyle = "#789399";
      c.fillRect((i * w) / 12 + 12, h * 0.34, w / 30, h * 0.08);
    }
    const px = (x) => w / 2 + (x - center) * scale;
    for (const o of state.objects || []) {
      if (o.destroyed) continue;
      const ow = (o.width || 1.2) * scale,
        oh = (o.height || 1.2) * scale;
      c.save();
      c.translate(px(o.x), base);
      c.rotate(Math.sin(this.clock * 25) * (o.shake || 0) * 0.2);
      if (o.type === "crate") {
        c.fillStyle = o.color || "#ba8753";
        c.fillRect(-ow / 2, -oh, ow, oh);
        c.strokeStyle = "#e6bd85";
        c.lineWidth = scale * 0.07;
        c.strokeRect(-ow * 0.46, -oh * 0.95, ow * 0.92, oh * 0.9);
        c.beginPath();
        c.moveTo(-ow * 0.4, -oh * 0.1);
        c.lineTo(ow * 0.4, -oh * 0.9);
        c.stroke();
      } else {
        const boardH = Math.min(oh * 0.36, ow * 0.4);
        c.fillStyle = "#806d54";
        c.fillRect(
          -scale * 0.04,
          -oh + boardH / 2,
          scale * 0.08,
          oh - boardH / 2,
        );
        c.fillStyle = o.color || "#6c9686";
        c.fillRect(-ow / 2, -oh, ow, boardH);
      }
      c.restore();
    }
    const ellipse = (x, y, rx, ry, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    };
    state.fighters.forEach((f, i) => {
      const x = px(f.x),
        y = base - f.y * scale,
        s = scale,
        po = f.character?.id === "po" || this.characters[i].id === "po",
        color = po ? "#ee5558" : "#149cdd";
      c.save();
      c.translate(x, y);
      if (f.crouching) c.scale(1, 0.68);
      ellipse(0, 0, s * 0.65, s * 0.12, "#64705b44");
      ellipse(0, -s * 1.05, s * 0.69, s * 0.82, color);
      ellipse(0, -s * 2.1, s * (po ? 0.71 : 0.86), s * 0.72, color);
      ellipse(0, -s * 2.13, s * 0.56, s * 0.49, po ? "#f1c7a6" : "#fff9ef");
      if (po) {
        c.strokeStyle = color;
        c.lineWidth = s * 0.08;
        c.beginPath();
        c.arc(0, -s * 3.0, s * 0.16, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = color;
        c.fillRect(-s * 0.04, -s * 2.95, s * 0.08, s * 0.25);
        ellipse(0, -s * 1.1, s * 0.4, s * 0.4, "#bcd7cd");
      } else {
        ellipse(0, -s * 1.03, s * 0.5, s * 0.53, "#fff9ef");
        c.fillStyle = "#e94343";
        c.fillRect(-s * 0.6, -s * 1.65, s * 1.2, s * 0.09);
        ellipse(0, -s * 1.57, s * 0.11, s * 0.12, "#ffd15b");
        ellipse(0, -s * 2.17, s * 0.11, s * 0.1, "#e83b42");
      }
      [-1, 1].forEach((d) => {
        ellipse(d * s * 0.19, -s * 2.29, s * 0.045, s * 0.07, "#253b46");
        ellipse(
          d * s * 0.38,
          -s * 0.12,
          s * 0.34,
          s * 0.18,
          po ? color : "#faf9ef",
        );
        ellipse(
          d * s * 0.75,
          -s * 1.08,
          s * 0.25,
          s * 0.27,
          po ? color : "#faf9ef",
        );
      });
      c.strokeStyle = "#68474b";
      c.lineWidth = s * 0.025;
      c.beginPath();
      c.arc(0, -s * 2.15, s * 0.26, 0.25, Math.PI - 0.25);
      c.stroke();
      c.restore();
    });
    for (const p of state.projectiles || [])
      ellipse(
        px(p.x),
        base - p.y * scale,
        scale * (p.radius || 0.3),
        scale * (p.radius || 0.3),
        p.color || "#a5eaff",
      );
    for (const e of state.effects || []) {
      const a = 1 - e.life / (e.maxLife || 0.6);
      if (e.type === "beam") {
        c.fillStyle = e.color || "#b2edff";
        c.globalAlpha = (1 - a) * 0.65;
        c.fillRect(
          px(e.x),
          base - (e.y + 0.35) * scale,
          (e.direction || 1) * (e.range || 12) * scale,
          0.7 * scale,
        );
        c.globalAlpha = 1;
      }
      c.strokeStyle = e.color || "#ffe8af";
      c.lineWidth = scale * 0.06 * (1 - a);
      c.beginPath();
      c.arc(
        px(e.x),
        base - (e.y || 1) * scale,
        Math.max(0.02, a) * scale,
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    const sharedMaterials = new Set(mats.values()),
      geometries = new Set(),
      materials = new Set(),
      textures = new Set();
    this.scene?.traverse((o) => {
      if (!o.isMesh) return;
      // Common primitive geometry/materials remain available to other arenas.
      if (o.geometry && o.geometry !== ballGeo && o.geometry !== boxGeo)
        geometries.add(o.geometry);
      const collect = (m) => {
        if (!m || sharedMaterials.has(m)) return;
        materials.add(m);
        for (const value of Object.values(m))
          if (value?.isTexture) textures.add(value);
      };
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(collect);
      collect(o.userData.originalMaterial);
      collect(o.userData.flashMaterial);
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas?.remove();
  }
}
