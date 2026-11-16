import * as THREE from "three";
import { softShadow } from "./primitives.js";

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);

/** Preallocated summon layers. The fox itself never changes size or elevation. */
export function makeKuramaSummon() {
  const root = new THREE.Group();
  const shadow = softShadow();
  shadow.position.set(0, 0.006, -3.3);
  shadow.scale.set(0.95, 4.2, 1);
  root.add(shadow);
  const seal = new THREE.Group();
  seal.position.set(0, 0.055, -3.3);
  root.add(seal);
  const gold = new THREE.MeshBasicMaterial({
    color: "#cb6925", transparent: true, opacity: 0,
    depthWrite: false, toneMapped: false,
  });
  for (const radius of [2.65, 3.05]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.065, 64), gold);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.y = 1.35;
    seal.add(ring);
  }
  const markGeometry = new THREE.PlaneGeometry(0.09, 0.38);
  for (let i = 0; i < 18; i++) {
    const angle = i * Math.PI / 9;
    const mark = new THREE.Mesh(markGeometry, gold);
    mark.position.set(Math.cos(angle) * 2.85, 0.003, Math.sin(angle) * 3.85);
    mark.rotation.set(-Math.PI / 2, 0, -angle);
    seal.add(mark);
  }
  const smokeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { opacity: { value: 0 } },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec2 vUv; uniform float opacity;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p);
        float cloud = exp(-d*d*3.8) * (1.0-smoothstep(0.65, 1.0, d));
        gl_FragColor = vec4(mix(vec3(0.42,0.34,0.28), vec3(0.83,0.70,0.55), vUv.y), cloud * opacity);
      }`,
  });
  const smoke = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), smokeMaterial, 18);
  smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smoke.frustumCulled = false;
  smoke.renderOrder = 3;
  root.add(smoke);
  const sparksGeometry = new THREE.BufferGeometry();
  sparksGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(28 * 3), 3));
  const sparksMaterial = new THREE.PointsMaterial({
    color: "#ffc36d", size: 0.065, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const sparks = new THREE.Points(sparksGeometry, sparksMaterial);
  sparks.frustumCulled = false;
  root.add(sparks);
  root.visible = false;
  return { root, shadow, seal, gold, smoke, smokeMaterial, sparks, sparksMaterial, dummy: new THREE.Object3D() };
}

export function updateKuramaSummon(effect, elapsed, windup, active, fade, yaw) {
  const intro = 1 - smooth(0.25, 0.75, elapsed);
  const outro = smooth(windup + active - 0.04, windup + active + 0.25, elapsed);
  effect.root.visible = fade > 0.001;
  effect.shadow.material.opacity = 0.55 * fade * smooth(0.1, 0.38, elapsed);
  effect.gold.opacity = (0.42 + 0.4 * intro) * fade;
  effect.seal.rotation.y = elapsed * 0.12;
  effect.smokeMaterial.uniforms.opacity.value = (intro * 0.52 + outro * 0.25) * fade;
  effect.smoke.visible = effect.smokeMaterial.uniforms.opacity.value > 0.005;
  const dummy = effect.dummy;
  for (let i = 0; i < 18; i++) {
    const phase = i * 2.39996;
    const age = clamp(elapsed * 1.5 - (i % 4) * 0.045, 0, 1.5);
    dummy.position.set(Math.cos(phase) * (0.8 + age * 0.85), 0.35 + age * (0.8 + (i % 3) * 0.45), -6.5 + (i / 17) * 7.2);
    dummy.rotation.set(-0.3, -yaw, 0, "YXZ");
    dummy.scale.setScalar(1.4 + age * 1.2 + (i % 3) * 0.2);
    dummy.updateMatrix();
    effect.smoke.setMatrixAt(i, dummy.matrix);
  }
  effect.smoke.instanceMatrix.needsUpdate = true;
  const points = effect.sparks.geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const angle = i * 2.39996;
    const rise = (elapsed * 1.6 + i * 0.11) % 2.8;
    points.setXYZ(i, Math.cos(angle) * (1.1 + rise * 0.2), rise + 0.05, -3.3 + Math.sin(angle) * 3.6);
  }
  points.needsUpdate = true;
  effect.sparksMaterial.opacity = (0.3 + intro * 0.5) * fade;
}
