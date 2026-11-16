import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  ball,
  box,
  stageRoundBox as roundBox,
  tube,
  curve,
  ring,
  sign,
  surface,
  batchStatic,
  label,
  batchRigid,
} from "./primitives.js";
function paving(theme) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  const colors =
    theme === "moon"
      ? ["#6a7c88", "#72838e", "#7b8d93"]
      : theme === "sunset"
        ? ["#b6a6a5", "#bdabaa", "#ac9fa4"]
        : ["#d1c2ac", "#dacaaf", "#cabba5"];
  x.fillStyle = theme === "moon" ? "#4e636b" : "#a89985";
  x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++)
    for (let col = -1; col < 5; col++) {
      const px = col * 128 + (row % 2) * 64,
        py = row * 64;
      x.fillStyle = colors[(row * 3 + col + 9) % 3];
      x.fillRect(px + 2, py + 2, 124, 60);
      x.fillStyle = "rgba(255,255,255,.10)";
      x.fillRect(px + 3, py + 3, 122, 2);
      x.fillStyle = "rgba(17,28,36,.09)";
      x.fillRect(px + 3, py + 60, 122, 2);
    }
  let seed = 12;
  for (let i = 0; i < 12000; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const px = seed % 512;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    x.fillStyle = i % 2 ? "rgba(255,255,255,.045)" : "rgba(20,30,40,.04)";
    x.fillRect(px, seed % 512, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(25, theme === "sunset" ? 2.75 : 25);
  t.anisotropy = 4;
  return t;
}
function foliage(g, x, y, z, size, color) {
  const source = new THREE.IcosahedronGeometry(1, 2);
  source.deleteAttribute("normal");
  source.deleteAttribute("uv");
  const geo = mergeVertices(source);
  source.dispose();
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i),
      b = p.getY(i),
      c = p.getZ(i),
      n = 1 + 0.055 * Math.sin(a * 12 + b * 9) * Math.sin(c * 13 + b * 5);
    p.setXYZ(i, a * n, b * n, c * n);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, surface(color, { roughness: 0.92 }));
  m.position.set(x, y, z);
  m.scale.set(...size);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
}
function tree(g, x, z, size = 1, theme = "town") {
  const t = new THREE.Group();
  t.position.set(x, 0, z);
  t.scale.setScalar(size);
  g.add(t);
  const wood = surface("#7c6351");
  tube(t, wood, [0, 1.5, 0], 0.14, 0.25, 3, 12);
  for (const s of [-1, 1]) {
    const b = tube(t, wood, [s * 0.35, 2.3, 0], 0.07, 0.12, 1.5, 8);
    b.rotation.z = -s * 0.55;
  }
  const cs =
    theme === "moon"
      ? ["#bd8ba7", "#d3a0b5", "#9b779c"]
      : ["#4e7b69", "#82a980", "#6a956f"];
  foliage(t, 0, 3.6, 0, [1.55, 1.7, 1.4], cs[0]);
  foliage(t, -0.9, 3.1, 0.25, [1.1, 1.17, 1.1], cs[1]);
  foliage(t, 0.95, 3.25, 0.1, [1.15, 1.3, 1.12], cs[2]);
}
function planter(g, x, z, w = 2.6, theme = "town") {
  roundBox(
    g,
    surface(theme === "moon" ? "#70828a" : "#ae9179"),
    [x, 0.28, z],
    [w, 0.55, 1.05],
  );
  for (let i = 0; i < 3; i++)
    foliage(
      g,
      x + (i - 1) * w * 0.27,
      0.75,
      z,
      [w * 0.25, 0.5, 0.55],
      theme === "moon" ? "#779895" : "#6e9979",
    );
  for (let i = 0; i < 5; i++)
    ball(
      g,
      surface(i % 2 ? "#f4d17c" : "#eaa9ac"),
      [x + (i - 2) * w * 0.15, 0.95 + Math.sin(i) * 0.12, z + 0.2],
      [0.08, 0.08, 0.08],
    );
}
function lamp(g, x, z, night = false) {
  const dark = surface("#354b52", { metalness: 0.45, roughness: 0.45 }),
    glow = surface("#ffdd9d", {
      emissive: "#ffc67d",
      emissiveIntensity: night ? 1.4 : 0.5,
    });
  tube(g, dark, [x, 1.9, z], 0.055, 0.075, 3.8);
  tube(g, dark, [x, 0.18, z], 0.17, 0.25, 0.36);
  roundBox(g, glow, [x, 3.8, z], [0.38, 0.55, 0.38]);
  for (const dx of [-0.22, 0.22])
    for (const dz of [-0.22, 0.22])
      box(g, dark, [x + dx, 3.8, z + dz], [0.035, 0.65, 0.035]);
  const roof = tube(g, dark, [x, 4.15, z], 0, 0.39, 0.33, 4);
  roof.rotation.y = Math.PI / 4;
  roundBox(g, dark, [x, 3.47, z], [0.54, 0.08, 0.54]);
}
function bench(g, x, z) {
  const wood = surface("#966f57"),
    metal = surface("#425b5c", { metalness: 0.35 });
  for (let i = 0; i < 3; i++)
    roundBox(g, wood, [x, 0.6, z + (i - 1) * 0.18], [2.8, 0.12, 0.15]);
  for (let i = 0; i < 3; i++)
    roundBox(g, wood, [x, 0.85 + i * 0.17, z - 0.37], [2.8, 0.12, 0.12]);
  for (const s of [-1, 1]) {
    box(g, metal, [x + s * 0.95, 0.3, z], [0.09, 0.6, 0.5]);
    box(g, metal, [x + s * 0.95, 0.94, z - 0.4], [0.07, 0.7, 0.07]);
  }
}
function roof(g, x, y, z, width, depth, color) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, 1.55);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }),
    surface(color),
  );
  mesh.position.set(x, y, z - depth / 2);
  mesh.castShadow = true;
  g.add(mesh);
  for (let i = 0; i < 4; i++) {
    const b = box(
      g,
      surface(color),
      [x + ((i - 1.5) * width) / 4, y + 0.02, z + depth / 2 + 0.04],
      [0.035, 0.11, 0.08],
    );
  }
  box(
    g,
    surface("#edddc2"),
    [x, y - 0.06, z],
    [width + 0.14, 0.16, depth + 0.15],
  );
}
function house(g, x, z, w, h, color, roofColor, shop, index) {
  const wall = surface(color),
    trim = surface("#e8dbc5"),
    dark = surface("#466773", { roughness: 0.27, metalness: 0.18 });
  roundBox(g, wall, [x, h / 2, z], [w, h, 4.5]);
  box(g, surface("#b4a395"), [x, 0.3, z + 0.02], [w + 0.12, 0.6, 4.55]);
  roof(g, x, h, z, w + 0.55, 5, roofColor);
  for (let y = 2.8; y < h - 0.4; y += 1.65)
    for (let dx = -w / 2 + 1; dx < w / 2 - 0.5; dx += 1.8) {
      const front = z + 2.27;
      roundBox(g, trim, [x + dx, y, front], [0.96, 1.19, 0.12]);
      roundBox(g, dark, [x + dx, y + 0.03, front + 0.085], [0.76, 0.97, 0.045]);
      box(g, trim, [x + dx, y + 0.03, front + 0.13], [0.035, 1, 0.04]);
      box(g, trim, [x + dx, y + 0.03, front + 0.14], [0.78, 0.035, 0.04]);
      box(g, trim, [x + dx, y - 0.61, front + 0.16], [1.13, 0.14, 0.32]);
      if (index % 2 === 0) {
        box(
          g,
          surface("#73857c"),
          [x + dx - 0.61, y, front],
          [0.16, 1.08, 0.1],
        );
        box(
          g,
          surface("#73857c"),
          [x + dx + 0.61, y, front],
          [0.16, 1.08, 0.1],
        );
      }
    }
  const doorX = x - w * 0.22,
    front = z + 2.31;
  roundBox(
    g,
    surface("#507779", { metalness: 0.2, roughness: 0.35 }),
    [doorX, 1.15, front],
    [1, 2.05, 0.1],
  );
  roundBox(g, trim, [doorX, 2.25, front], [1.16, 0.12, 0.15]);
  ball(
    g,
    surface("#d9b571", { metalness: 0.7, roughness: 0.3 }),
    [doorX + 0.32, 0.99, front + 0.08],
    [0.045, 0.045, 0.04],
  );
  for (let i = 0; i < 4; i++)
    box(
      g,
      surface("#7c908d"),
      [x + w * 0.13 + i * 0.32, 1.3, front],
      [0.29, 1.6, 0.06],
    );
  if (shop) {
    sign(g, shop, [x, 2.67, front + 0.11], [w * 0.85, 0.64, 0.16], {
      background: roofColor,
      subtext: "NEIGHBORHOOD • EST. 2026",
    });
    for (let i = 0; i < 10; i++) {
      const aw = box(
        g,
        surface(i % 2 ? "#f3dfb8" : roofColor),
        [x - w * 0.46 + i * w * 0.1, 2.12, front + 0.68],
        [w * 0.1, 0.12, 1.35],
      );
      aw.rotation.x = 0.13;
      roundBox(
        g,
        surface(i % 2 ? "#f3dfb8" : roofColor),
        [x - w * 0.46 + i * w * 0.1, 1.97, front + 1.3],
        [w * 0.1, 0.25, 0.1],
      );
    }
  }
  // Roof chimney, gutters and end walls are visible from the perspective camera.
  box(
    g,
    surface("#a08d80"),
    [x + w * 0.29, h + 0.65, z - 0.2],
    [0.55, 1.9, 0.65],
  );
  box(g, trim, [x + w * 0.29, h + 1.63, z - 0.2], [0.72, 0.16, 0.8]);
  tube(
    g,
    surface("#9baaa3", { metalness: 0.3 }),
    [x + w / 2 - 0.12, h / 2, z + 2.36],
    0.045,
    0.045,
    h,
  );
}
function bunting(g, a, b, z) {
  const lineMat = surface("#5c7270");
  curve(
    g,
    lineMat,
    [
      [a, 5.7, z],
      [(a + b) / 2, 4.7, z],
      [b, 5.7, z],
    ],
    0.017,
  );
  for (let i = 1; i < 15; i++) {
    const t = i / 15,
      x = a + (b - a) * t,
      y = 5.7 - Math.sin(Math.PI * t);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [x - 0.16, y, z, x + 0.16, y, z, x, y - 0.38, z],
        3,
      ),
    );
    geo.computeVertexNormals();
    const m = new THREE.Mesh(
      geo,
      surface(["#d38e7c", "#e6c76f", "#7ba89c"][i % 3], {
        side: THREE.DoubleSide,
      }),
    );
    g.add(m);
  }
}
function skyline(g, theme) {
  if (theme === "moon") {
    for (let layer = 0; layer < 2; layer++)
      for (let i = 0; i < 11; i++) {
        const m = ball(
          g,
          surface(layer ? "#23364f" : "#36536b"),
          [-80 + i * 16, -4 + ((i * 3) % 4), -58 - layer * 20],
          [15, 5 + (i % 3) * 2, 9],
        );
        m.castShadow = false;
      }
    return;
  }
  for (let i = 0; i < 18; i++) {
    const x = (i - 8.5) * 4.8,
      h = theme === "sunset" ? 8 + ((i * 7) % 17) : 3 + ((i * 7) % 9),
      base = theme === "sunset" ? -9 : 0,
      z = -34 - (i % 3) * 5;
    box(
      g,
      surface(
        theme === "sunset"
          ? ["#64677d", "#858092", "#727389"][i % 3]
          : "#a3b6b5",
      ),
      [x, base + h / 2, z],
      [3.8, h, 3],
    );
    if (theme === "sunset") {
      box(g, surface("#636d83"), [x, base + h + 0.2, z], [2.8, 0.4, 2.2]);
      for (let y = 1; y < h; y += 1.6)
        for (let j = 0; j < 2; j++)
          if ((i + j + Math.floor(y)) % 4 !== 0)
            box(
              g,
              surface("#edc899", {
                emissive: "#ffb85f",
                emissiveIntensity: 0.45,
              }),
              [x - 0.8 + j * 1.5, base + y, z + 1.51],
              [0.4, 0.65, 0.02],
            );
    }
  }
}
function sky(scene, map) {
  const moon = map.theme === "moon",
    sunset = map.theme === "sunset";
  const top = moon ? "#101c3c" : sunset ? "#647baf" : "#68b9d0",
    bottom = moon ? "#344d68" : sunset ? "#ffc9a1" : "#c5e2df";
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader:
      "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec3 v;uniform vec3 top;uniform vec3 bottom;void main(){float h=smoothstep(-.10,.4,normalize(v).y);gl_FragColor=vec4(mix(bottom,top,h),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
  }); // chunks must start on a new line
  mat.fragmentShader = mat.fragmentShader.replace(";#include", ";\n#include");
  const dome = new THREE.Mesh(new THREE.SphereGeometry(230, 32, 20), mat);
  scene.add(dome);
  scene.fog = new THREE.Fog(bottom, 55, 155);
  const g = new THREE.Group();
  scene.add(g);
  for (let i = 0; i < 5; i++) {
    const x = -44 + i * 23,
      z = -48 - (i % 2) * 8;
    for (let j = 0; j < 3; j++)
      ball(
        g,
        surface(moon ? "#65748b" : "#fff1df", { roughness: 1 }),
        [x + j * 2, 12 + (i % 3) * 3, z],
        [3, 1.1 + j * 0.3, 1.7],
      );
  }
  if (moon)
    for (let i = 0; i < 48; i++) {
      const star = ball(
        g,
        surface("#d5ebff", { emissive: "#c7e8ff", emissiveIntensity: 2 }),
        [Math.sin(i * 41) * 90, 8 + ((i * 7) % 25), -75],
        [0.035 + (i % 3) * 0.012, 0.035 + (i % 3) * 0.012, 0.035],
      );
      star.castShadow = false;
    }
  const sun = ball(
    g,
    surface(moon ? "#fff7cf" : "#ffedb7", {
      emissive: moon ? "#e9e6bb" : "#ffd899",
      emissiveIntensity: 1.4,
    }),
    [moon ? 15 : 20, moon ? 19 : 13, -66],
    [moon ? 2.6 : 4, moon ? 2.6 : 4, 0.6],
  );
  sun.castShadow = false;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  scene.remove(g);
  scene.add(batchStatic(g));
  return { dome };
}
export function buildStage(scene, map) {
  sky(scene, map);
  const g = new THREE.Group(),
    theme = map.theme,
    left = map.bounds.left,
    right = map.bounds.right,
    width = right - left;
  const floorMat = surface("#ffffff", { map: paving(theme), roughness: 0.94 });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, theme === "sunset" ? 22 : 200),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  if (theme === "sunset") floor.position.z = 3;
  g.add(floor);
  if (theme === "sunset") {
    box(g, surface("#6e7787"), [0, -0.65, 3], [width + 22, 1.25, 22]);
    box(g, surface("#6d7387"), [0, -9.1, -37], [180, 0.3, 110]);
  }
  // A broad central boulevard, curbs and side streets expose real floor depth.
  for (const z of [-4.6, 4.4]) {
    roundBox(
      g,
      surface(theme === "moon" ? "#b0b8b3" : "#dfcba8"),
      [0, 0.09, z],
      [width + 24, 0.18, 0.45],
    );
    box(g, surface("#847b75"), [0, 0.03, z + 0.3], [width + 24, 0.06, 0.12]);
  }
  const inlay = surface(theme === "moon" ? "#a1b8b0" : "#b4a183");
  for (let x = left; x < right; x += 3.4) {
    box(g, inlay, [x, 0.012, -2.8], [1.6, 0.018, 0.06]);
    box(g, inlay, [x, 0.012, 2.8], [1.6, 0.018, 0.06]);
  }
  for (const x of [left, right]) {
    roundBox(
      g,
      surface("#d8bb7b", { emissive: "#a77d33", emissiveIntensity: 0.15 }),
      [x, 0.025, 0],
      [0.13, 0.05, 8],
    );
    for (const z of [-4.4, 4.2]) {
      tube(g, surface("#687e7d"), [x, 0.5, z], 0.18, 0.24, 1);
      ring(
        g,
        surface("#efc77b", { emissive: "#f9bf5e", emissiveIntensity: 0.3 }),
        0.19,
        0.035,
        [x, 0.7, z],
      ).rotation.x = Math.PI / 2;
    }
  }
  skyline(g, theme);
  if (theme === "town") {
    house(g, -22, -12, 7, 7, "#e7c7a7", "#c77561", "FLOWER HOUSE", 0);
    house(g, -12, -13.5, 8.2, 8.4, "#eee0bc", "#588484", "POCKET ARCADE", 1);
    house(g, 4, -14, 9, 7, "#e5c4ae", "#b76c60", "DORAYAKI", 2);
    house(g, 16, -15, 8, 9, "#c6d5c5", "#5b7b7c", "HAPPY DAYS", 3);
    house(g, 28, -13, 7, 7.6, "#e3caa4", "#b18868", "TOY SHOP", 4);
    bunting(g, -10, 10, -9);
    for (const x of [-28, -5, 24, 34]) tree(g, x, -8.5, 1.25);
    for (const x of [-20, 0, 20]) lamp(g, x, -4.8);
    for (const x of [-16, 13]) {
      bench(g, x, -6);
      planter(g, x + 3, -6, 2.5);
    }
    // An alley running away from the arena gives a strong vanishing point.
    for (let i = 0; i < 6; i++)
      box(g, surface("#e4daca"), [-3, 0.018, -9 - i * 2.2], [3, 0.025, 0.55]);
  } else if (theme === "sunset") {
    for (const z of [-7, 7]) {
      box(g, surface("#6e778a"), [0, 0.7, z], [width + 20, 0.18, 0.25]);
      for (let x = left - 6; x < right + 8; x += 3.2) {
        box(g, surface("#6e778a"), [x, 0.35, z], [0.09, 0.7, 0.1]);
      }
      if (z < 0)
        box(
          g,
          surface("#a3bac1", {
            metalness: 0.2,
            roughness: 0.24,
            transparent: true,
            opacity: 0.28,
          }),
          [0, 0.4, z],
          [width + 16, 0.6, 0.06],
        );
    }
    for (const x of [-24, -13, 14, 25]) {
      planter(g, x, -6, 3.2);
      bench(g, x + 4, -6);
    }
    for (const x of [-28, 28]) {
      box(g, surface("#8e929b"), [x, 1.5, -9], [4, 3, 3]);
      for (let j = 0; j < 9; j++)
        box(g, surface("#515e73"), [x, 1 + j * 0.15, -7.45], [3.1, 0.06, 0.03]);
    }
    for (const x of [-23, 23]) {
      lamp(g, x, -5.2, true);
      tree(g, x + 4, -10, 0.9);
    }
    bunting(g, -20, 20, -7.2);
    sign(g, "SUNSET SOCIAL", [0, 1.25, -7.6], [5, 1, 0.2], {
      background: "#55546b",
      ink: "#ffe5b3",
      subtext: "ON TOP OF THE WORLD",
    });
  } else {
    // A planted garden behind the paved fight lane breaks up the distant floor.
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 90),
      surface("#456e68", { roughness: 1 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(0, 0.022, -50);
    lawn.receiveShadow = true;
    g.add(lawn);
    for (const x of [-22, 22]) {
      roundBox(g, surface("#859a93"), [x, 0.12, -15], [17, 0.24, 13]);
      roundBox(g, surface("#53746d"), [x, 0.26, -15], [16.5, 0.18, 12.5]);
      for (let i = 0; i < 7; i++) {
        const xx = x - 7 + i * 2.3;
        foliage(
          g,
          xx,
          0.65,
          -9,
          [1.1, 0.6, 0.7],
          i % 2 ? "#829890" : "#688d83",
        );
      }
    }
    for (const x of [-18, 18]) tree(g, x, -10, 1.75, "moon");
    for (const x of [-30, -7, 27]) tree(g, x, -17, 1.25, "moon");
    for (let i = 0; i < 13; i++) {
      const x = (i - 6) * 0.55,
        y = 0.5 + Math.sin((i / 12) * Math.PI) * 1.15;
      box(g, surface("#8f6465"), [x, y, -12], [0.56, 0.13, 3.3]);
      for (const z of [-13.7, -10.3]) {
        tube(g, surface("#ae8375"), [x, y + 0.38, z], 0.045, 0.045, 0.8);
      }
    }
    for (const z of [-13.7, -10.3])
      curve(
        g,
        surface("#b78e79"),
        [
          [-3.4, 1.35, z],
          [-1.8, 2.1, z],
          [0, 2.4, z],
          [1.8, 2.1, z],
          [3.4, 1.35, z],
        ],
        0.08,
      );
    for (const x of [-10, 10]) {
      tube(g, surface("#7d5b62"), [x, 2, -19], 0.23, 0.3, 4);
      roof(g, x, 4, -19, 4, 4, "#3a5367");
      sign(g, "月", [x, 3, -16.9], [0.65, 0.8, 0.05], {
        background: "#d5bc9b",
        ink: "#5a545b",
      });
    }
    for (const x of [-25, -12, 0, 12, 25]) {
      lamp(g, x, -5.2, true);
      planter(g, x + 2, -6, 2.4, "moon");
    }
    for (let i = 0; i < 16; i++)
      ball(
        g,
        surface("#758c8d"),
        [-11 + i * 1.5, 0.25, -7.5 + Math.sin(i) * 0.4],
        [0.7, 0.34, 0.5],
      );
  }
  // Low foreground details at the edges: depth without obscuring the combat lane.
  for (const x of [-31, -21, 24, 34]) planter(g, x, 7, 3.4, theme);
  const batched = batchStatic(g);
  scene.add(batched);
  let water;
  if (theme === "moon") {
    water = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader:
        "varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec2 v;uniform float time;void main(){float wave=sin(v.x*110.+time*.7+sin(v.y*26.+time)*2.);float stripe=pow(max(0.,wave),18.);float reflection=exp(-pow((v.x-.65+sin(v.y*30.+time)*.012)*8.,2.))*.25;vec3 c=mix(vec3(.07,.19,.26),vec3(.22,.40,.48),v.y)+stripe*.055+reflection;gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    });
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), water);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(1, 0.035, -12);
    scene.add(pond);
  }

  const positions = new Float32Array(22 * 3),
    bases = [];
  for (let i = 0; i < 22; i++) {
    const base = [Math.sin(i * 24) * 35, 1.5 + (i % 7), -5 - (i % 13)];
    bases.push(base);
    positions.set(base, i * 3);
  }
  const dot = document.createElement("canvas");
  dot.width = dot.height = 32;
  const ctx = dot.getContext("2d"),
    gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.3, "#fff9");
  gradient.addColorStop(1, "#fff0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  const motes = new THREE.Points(
    moteGeometry,
    new THREE.PointsMaterial({
      color: theme === "moon" ? "#c7ffcc" : "#f3dfaa",
      map: new THREE.CanvasTexture(dot),
      size: 0.1,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  scene.add(motes);

  return {
    update(time) {
      if (water) water.uniforms.time.value = time;
      bases.forEach((base, i) => {
        positions[i * 3] = base[0] + Math.sin(time * 0.3 + i) * 0.5;
        positions[i * 3 + 1] = base[1] + Math.sin(time * 0.6 + i) * 0.25;
      });
      moteGeometry.attributes.position.needsUpdate = true;
    },
  };
}
export function makeObject(data) {
  const root = new THREE.Group(),
    shape = new THREE.Group();
  root.position.set(data.x, 0, data.type === "sign" ? -0.9 : 0);
  root.add(shape);
  const w = data.width || 1.2,
    h = data.height || 1.2,
    wood = surface(data.color || "#aa7044", { roughness: 0.84 });
  if (data.type === "crate") {
    const solid = roundBox(shape, wood, [0, h / 2, 0], [w, h, 0.85]);
    solid.userData.silhouette = true;
    const brace = surface("#d7aa73");
    for (let i = 0; i < 4; i++)
      box(
        shape,
        surface("#795439"),
        [0, (h * (i + 1)) / 5, 0.435],
        [w, 0.012, 0.01],
      );
    for (const x of [-w / 2 + 0.065, w / 2 - 0.065])
      roundBox(shape, brace, [x, h / 2, 0.46], [0.12, h, 0.07]);
    for (const y of [0.07, h - 0.07])
      roundBox(shape, brace, [0, y, 0.46], [w, 0.12, 0.07]);
    const diag = box(
      shape,
      brace,
      [0, h / 2, 0.51],
      [0.12, Math.hypot(w * 0.85, h * 0.85), 0.065],
    );
    diag.rotation.z = -Math.atan2(w, h);
    for (const x of [-w / 2 + 0.07, w / 2 - 0.07])
      for (const y of [0.07, h - 0.07])
        ball(
          shape,
          surface("#5d5753", { metalness: 0.6 }),
          [x, y, 0.515],
          [0.023, 0.023, 0.015],
        );
  } else {
    const post = surface("#6e6559", { metalness: 0.12 });
    tube(shape, post, [0, h / 2 - 0.2, 0], 0.055, 0.09, h - 0.4);
    const pivot = new THREE.Group();
    pivot.position.y = h - 0.3;
    shape.add(pivot);
    sign(pivot, data.label || "POCKET", [0, 0, 0.025], [w, 0.6, 0.13], {
      background: data.color || "#e6b467",
      ink: "#3f5054",
    });
    for (const x of [-w * 0.28, w * 0.28])
      ring(pivot, post, 0.045, 0.012, [x, 0.3, 0]);
    shape.userData.signPivot = pivot;
  }
  batchRigid(shape, [shape.userData.signPivot].filter(Boolean));
  return { root, shape };
}
