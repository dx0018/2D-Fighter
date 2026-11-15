import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const down = new THREE.Vector3(0, -1, 0);
// A two-bone chain has fixed lengths. Unreachable goals are clamped, never stretched.
export function solveTwoBone(
  origin,
  target,
  pole,
  upper,
  lower,
  joint,
  end,
  work,
) {
  const { axis, bend } = work;
  axis.copy(target).sub(origin);
  const distance = THREE.MathUtils.clamp(
    axis.length(),
    Math.abs(upper - lower) + 0.005,
    upper + lower - 0.003,
  );
  axis.normalize();
  if (axis.lengthSq() < 0.5) axis.copy(down);
  end.copy(origin).addScaledVector(axis, distance);
  bend.copy(pole).addScaledVector(axis, -pole.dot(axis));
  if (bend.lengthSq() < 1e-7) bend.set(0, 0, 1).addScaledVector(axis, -axis.z);
  bend.normalize();
  const along =
    (upper * upper + distance * distance - lower * lower) / (2 * distance);
  joint
    .copy(origin)
    .addScaledVector(axis, along)
    .addScaledVector(
      bend,
      Math.sqrt(Math.max(0, upper * upper - along * along)),
    );
}

export function makeChain(
  model,
  parent,
  origin,
  upperLength,
  lowerLength,
  radius,
  material,
) {
  const upper = new THREE.Bone(),
    lower = new THREE.Bone();
  upper.position.set(...origin);
  lower.position.y = -upperLength;
  upper.add(lower);
  parent.add(upper);
  const first = model.bones.length;
  model.bones.push(upper, lower);
  const length = upperLength + lowerLength,
    positions = [],
    normals = [],
    uv = [],
    indices = [],
    weights = [],
    skinIndices = [];
  const rows = 28,
    sides = 12;
  for (let row = 0; row <= rows; row++) {
    const distance = -radius + (row / rows) * (length + 2 * radius);
    const blend = THREE.MathUtils.smoothstep(
      distance,
      upperLength - 0.075,
      upperLength + 0.075,
    );
    const cap =
      distance < 0 ? distance : distance > length ? distance - length : 0;
    const width = cap
      ? Math.sqrt(Math.max(0, radius * radius - cap * cap))
      : radius * (1 + 0.06 * Math.sin((distance / length) * Math.PI));
    for (let col = 0; col <= sides; col++) {
      const angle = (col / sides) * Math.PI * 2,
        x = Math.cos(angle),
        z = Math.sin(angle);
      positions.push(
        origin[0] + x * width,
        origin[1] - distance,
        origin[2] + z * width,
      );
      normals.push(
        x * (cap ? width / radius : 1),
        cap ? -cap / radius : 0,
        z * (cap ? width / radius : 1),
      );
      uv.push(col / sides, row / rows);
      skinIndices.push(first, first + 1, 0, 0);
      weights.push(1 - blend, blend, 0, 0);
      if (row < rows && col < sides) {
        const a = row * (sides + 1) + col,
          b = a + sides + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(skinIndices, 4),
  );
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  geo.setIndex(indices);
  model.limbGeometries.push({ geometry: geo, material });
  return {
    upper,
    lower,
    origin: new THREE.Vector3(...origin),
    upperLength,
    lowerLength,
    endpoint: new THREE.Vector3(),
    knee: new THREE.Vector3(),
    work: {
      axis: new THREE.Vector3(),
      bend: new THREE.Vector3(),
      rotation: new THREE.Quaternion(),
      direction: new THREE.Vector3(),
    },
  };
}
export function poseChain(chain, origin, target, pole) {
  solveTwoBone(
    origin,
    target,
    pole,
    chain.upperLength,
    chain.lowerLength,
    chain.knee,
    chain.endpoint,
    chain.work,
  );
  chain.upper.position.copy(origin);
  const { direction, rotation } = chain.work;
  direction.copy(chain.knee).sub(origin).normalize();
  chain.upper.quaternion.setFromUnitVectors(down, direction);
  direction.copy(chain.endpoint).sub(chain.knee).normalize();
  rotation.setFromUnitVectors(down, direction);
  chain.lower.quaternion
    .copy(chain.upper.quaternion)
    .invert()
    .multiply(rotation);
}
export function bindLimbs(model) {
  model.root.updateMatrixWorld(true);
  model.skeleton = new THREE.Skeleton(model.bones);
  const groups = new Map();
  for (const part of model.limbGeometries) {
    if (!groups.has(part.material)) groups.set(part.material, []);
    groups.get(part.material).push(part.geometry);
  }
  for (const [material, geos] of groups) {
    const geometry = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    model.root.add(mesh);
    mesh.bind(model.skeleton);
  }
  model.limbGeometries = [];
}
