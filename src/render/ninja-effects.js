import * as THREE from "three";

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
  group.userData.orbKind = kind;
  return group;
}

export function spinChakraOrb(orb, time, size = 1) {
  orb.scale.setScalar(size);
  orb.rotation.set(time * 1.7, time * -2.3, time * 2.8);
  for (let i = 2; i < orb.children.length; i++) {
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
