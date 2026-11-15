import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function vertexSurface(side) {
  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    vertexColors: true,
    roughness: 1,
    metalness: 1,
    emissive: "#ffffff",
    emissiveIntensity: 1,
    side,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute vec2 pcSurface; attribute vec3 pcEmission; varying vec2 pcSurfaceV; varying vec3 pcEmissionV;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\npcSurfaceV=pcSurface;pcEmissionV=pcEmission;",
    );
    shader.fragmentShader =
      "varying vec2 pcSurfaceV; varying vec3 pcEmissionV;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor*=pcSurfaceV.x;",
      )
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor*=pcSurfaceV.y;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance*=pcEmissionV;",
      );
  };
  material.customProgramCacheKey = () => "pc-vertex-surface-v1";
  return material;
}

// Keep each surface's color, roughness, metalness and emission in vertex data.
// Whole opaque scenery shares a draw instead of paying one call per paint color.
export function mergeScenery(group, shared) {
  group.updateMatrixWorld(true);
  const buckets = new Map(),
    originals = [];
  group.traverse((object) => {
    if (!object.isMesh || Array.isArray(object.material)) return;
    const mat = object.material,
      plain =
        mat.isMeshStandardMaterial &&
        !mat.isMeshPhysicalMaterial &&
        !mat.map &&
        !mat.bumpMap &&
        !mat.normalMap &&
        !mat.alphaMap &&
        !mat.transparent;
    const key = plain
      ? `solid:${mat.side}:${object.castShadow}`
      : `mapped:${mat.uuid}:${object.castShadow}`;
    if (!buckets.has(key))
      buckets.set(key, {
        material: plain ? vertexSurface(mat.side) : mat,
        geometries: [],
        shadow: object.castShadow,
      });
    const geo = (
      object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone()
    ).applyMatrix4(object.matrixWorld);
    if (plain) {
      for (const key of Object.keys(geo.attributes))
        if (!["position", "normal"].includes(key)) geo.deleteAttribute(key);
      const n = geo.attributes.position.count,
        color = new Float32Array(n * 3),
        surface = new Float32Array(n * 2),
        emission = new Float32Array(n * 3),
        e = mat.emissive;
      for (let i = 0; i < n; i++) {
        color.set([mat.color.r, mat.color.g, mat.color.b], i * 3);
        surface.set([mat.roughness, mat.metalness], i * 2);
        emission.set(
          [
            e.r * mat.emissiveIntensity,
            e.g * mat.emissiveIntensity,
            e.b * mat.emissiveIntensity,
          ],
          i * 3,
        );
      }
      geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
      geo.setAttribute("pcSurface", new THREE.BufferAttribute(surface, 2));
      geo.setAttribute("pcEmission", new THREE.BufferAttribute(emission, 3));
    }
    buckets.get(key).geometries.push(geo);
    originals.push(object);
  });
  const result = new THREE.Group();
  for (const { material, geometries, shadow } of buckets.values()) {
    const geometry = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (geometry) {
      const m = new THREE.Mesh(geometry, material);
      m.castShadow = shadow;
      m.receiveShadow = true;
      result.add(m);
    }
  }
  const used = new Set([...buckets.values()].map((b) => b.material));
  for (const o of originals) {
    if (!shared.includes(o.geometry)) o.geometry.dispose();
    if (!used.has(o.material)) o.material.dispose();
  }
  return result;
}
