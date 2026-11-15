import * as THREE from "three";
import { clamp, damp } from "./primitives.js";
// A perspective camera frames the actual combat plane. Padding includes fists,
// head height, knockback and the slight change of scale caused by perspective.
export class ArenaCamera {
  constructor(map) {
    this.map = map;
    this.camera = new THREE.PerspectiveCamera(36, 2, 0.1, 400);
    this.center = map.camera.initialX || 0;
    this.width = map.camera.minWidth;
    this.targetY = 1.65;
    this.distance = 30;
  }
  update(fighters, aspect, dt, shake = 0, clock = 0) {
    const minX = Math.min(...fighters.map((f) => f.x)),
      maxX = Math.max(...fighters.map((f) => f.x)),
      cfg = this.map.camera;
    const narrow = aspect < 1.2,
      minWidth = narrow ? Math.min(23, cfg.minWidth) : cfg.minWidth;
    const required = maxX - minX + 8,
      targetWidth = clamp(
        Math.max(minWidth, required),
        minWidth,
        Math.max(cfg.maxWidth, required),
      );
    this.width = damp(this.width, targetWidth, dt, 4.5); // Smooth zoom; immediate safety bound prevents clipping during fast separation.
    this.width = Math.max(this.width, maxX - minX + 5.4);
    const half = this.width / 2,
      lo = cfg.left + half,
      hi = cfg.right - half;
    let desired = (minX + maxX) / 2;
    desired = lo <= hi ? clamp(desired, lo, hi) : (cfg.left + cfg.right) / 2;
    this.center = damp(this.center, desired, dt, 5);
    if (lo <= hi) this.center = clamp(this.center, lo, hi);
    this.center = clamp(this.center, maxX + 2.1 - half, minX - 2.1 + half);
    const tallest = Math.max(...fighters.map((f) => f.y + 3.3));
    const visibleHeight = this.width / aspect;
    const yTarget = Math.max(
      narrow ? 0.9 : 1.75,
      tallest - visibleHeight * 0.37,
    );
    this.targetY = damp(this.targetY, yTarget, dt, 5);
    this.camera.aspect = aspect;
    const z =
      this.width /
      (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    this.distance = z;
    const pitch = 0.18,
      dx = Math.sin(clock * 93) * shake * 0.16,
      dy = Math.cos(clock * 77) * shake * 0.07;
    this.camera.position.set(
      this.center + dx,
      this.targetY + z * pitch + dy,
      z,
    );
    this.camera.lookAt(this.center, this.targetY, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    return this.camera;
  }
}
