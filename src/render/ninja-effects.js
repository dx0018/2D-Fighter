import * as THREE from "three";

let bijuuModel = null;
export function setBijuuModel(scene) {
  bijuuModel = scene;
  scene.traverse((node) => {
    if (node.geometry) node.geometry.userData.sharedAsset = true;
    for (const material of (Array.isArray(node.material) ? node.material : [node.material]))
      if (material) material.userData.sharedTextures = true;
  });
}
export function attachBijuuModel(orb) {
  if (!bijuuModel || orb.getObjectByName("user-bijuu")) return;
  orb.children[0].visible = false;
  const visual = bijuuModel.clone(true);
  visual.name = "user-bijuu";
  orb.add(visual);
}

// Small reusable meshes: no extra shadow lights, postprocessing or model copies.
export function makeChakraOrb(kind = "rasengan") {
  const group = new THREE.Group(),
    dark = kind === "bijuu";
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const material = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity === 1,
      toneMapped: false,
      blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  const core = new THREE.Mesh(
    sphere,
    material(dark ? "#180e29" : "#a1efff", dark ? 1 : 0.75),
  );
  group.add(core);
  const shell = new THREE.Mesh(
    sphere,
    material(dark ? "#ab58ed" : "#1bb9ff", 0.13),
  );
  shell.scale.setScalar(1.13);
  group.add(shell);
  const ringGeo = new THREE.TorusGeometry(1, 0.022, 4, 40);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      ringGeo,
      material(
        dark ? (i % 2 ? "#ff719e" : "#c1a0ff") : i % 2 ? "#efffff" : "#40caff",
        0.85,
      ),
    );
    ring.rotation.set(i * 1.1, i * 0.9, i * 0.7);
    ring.scale.set(1.03, 0.66 + i * 0.12, 1);
    group.add(ring);
  }
  if (dark) attachBijuuModel(group);
  group.userData.orbKind = kind;
  return group;
}

export function makeKuramaAura() {
  const group = new THREE.Group(),
    headFallback = new THREE.Group(),
    opacityTargets = [],
    tails = [],
    aura = new THREE.MeshStandardMaterial({
      color: "#ff8a32",
      emissive: "#ff5419",
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    tailAura = new THREE.MeshStandardMaterial({
      color: "#ffb34f",
      emissive: "#ff6a21",
      emissiveIntensity: 1.25,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    gold = new THREE.MeshStandardMaterial({
      color: "#ffe18c",
      emissive: "#ff9b3c",
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
    red = new THREE.MeshBasicMaterial({
      color: "#ff3d3d",
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      toneMapped: false,
    }),
    ink = new THREE.MeshBasicMaterial({
      color: "#53203b",
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      toneMapped: false,
    });
  for (const material of [aura, tailAura, gold, red, ink])
    opacityTargets.push({ material, opacity: material.opacity });

  const add = (geometry, material, position, scale, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.renderOrder = 2;
    parent.add(mesh);
    return mesh;
  };
  const sphere = new THREE.SphereGeometry(1, 16, 12),
    cone = new THREE.ConeGeometry(1, 1, 7);
  group.add(headFallback);
  add(sphere, aura, [0, 2.23, 0.18], [0.58, 0.52, 0.4], headFallback);
  add(sphere, gold, [0, 2.12, 0.53], [0.32, 0.19, 0.2], headFallback);
  add(sphere, ink, [0, 2.2, 0.695], [0.085, 0.065, 0.045], headFallback);
  for (const side of [-1, 1]) {
    const ear = add(
      cone,
      aura,
      [side * 0.36, 2.62, 0.1],
      [0.23, 0.58, 0.19],
      headFallback,
    );
    ear.rotation.z = -side * 0.32;
    add(sphere, red, [side * 0.2, 2.34, 0.51], [0.105, 0.062, 0.035], headFallback);
    add(sphere, ink, [side * 0.2, 2.35, 0.54], [0.032, 0.046, 0.018], headFallback);
    const cheek = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.26, 2.11, 0.58),
      new THREE.Vector3(side * 0.42, 2.1, 0.55),
      new THREE.Vector3(side * 0.49, 2.05, 0.48),
    ]);
    add(
      new THREE.TubeGeometry(cheek, 8, 0.018, 5, false),
      ink,
      [0, 0, 0],
      [1, 1, 1],
      headFallback,
    );
  }

  const up = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index < 9; index++) {
    const spread = (index - 4) / 4,
      tail = new THREE.Group(),
      fanHeight = (index - 4) * 0.18,
      curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(spread * 0.12, 1.02, -0.12),
        new THREE.Vector3(spread * 0.32, 1.16 + fanHeight * 0.2, -0.46),
        new THREE.Vector3(spread * 0.82, 1.38 + fanHeight * 0.62, -0.92),
        new THREE.Vector3(spread * 1.42, 1.72 + fanHeight, -1.38 - Math.abs(spread) * 0.2),
      ]),
      tip = curve.getPoint(1),
      tangent = curve.getTangent(1).normalize();
    tail.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 18, 0.085 + (1 - Math.abs(spread)) * 0.025, 7, false),
        tailAura,
      ),
    );
    const point = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.34, 7),
      gold,
    );
    point.position.copy(tip).addScaledVector(tangent, 0.1);
    point.quaternion.setFromUnitVectors(up, tangent);
    tail.add(point);
    tail.renderOrder = 1;
    group.add(tail);
    tails.push(tail);
  }
  headFallback.visible = true;
  group.userData.headFallback = headFallback;
  group.userData.opacityTargets = opacityTargets;
  group.userData.tails = tails;
  return group;
}

export function spinChakraOrb(orb, time, size = 1) {
  orb.scale.setScalar(size);
  orb.rotation.set(time * 1.7, time * -2.3, time * 2.8);
  for (let i = 2; i < Math.min(5, orb.children.length); i++) {
    orb.children[i].rotation.x = i * 1.1 + time * (i % 2 ? 4 : -3);
    orb.children[i].rotation.y = i * 0.9 + time * 2;
  }
}

export function makeKunai() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: "#b6d3dc",
    metalness: 0.65,
    roughness: 0.3,
  });
  const blade = new THREE.Mesh(new THREE.OctahedronGeometry(0.19), steel);
  blade.scale.set(2.2, 0.65, 0.3);
  blade.position.x = 0.15;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6),
    new THREE.MeshBasicMaterial({ color: "#303b51" }),
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.x = -0.2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.018, 4, 12),
    steel,
  );
  ring.position.x = -0.4;
  group.add(blade, handle, ring);
  return group;
}

export function rememberGeometry(data, object) {
  data.extraGeometries ??= new Set();
  object.traverse((node) => {
    if (node.geometry) data.extraGeometries.add(node.geometry);
  });
}
