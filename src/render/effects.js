import { SUSANOO_ARCHERY } from "../game/susanoo-archery.js";
import { makeSasukeProjectile } from "./sasuke-effects.js";
import * as THREE from "three";
import { clamp } from "./primitives.js";
import {
  makeChakraOrb,
  spinChakraOrb,
  makeKunai,
  rememberGeometry,
} from "./ninja-effects.js";
const rnd = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,.8)");
  g.addColorStop(0.4, "rgba(255,255,255,.22)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      r = i % 2 ? 0.17 : i % 4 === 0 ? 1 : 0.65;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
}
export class CombatEffects {
  constructor(scene) {
    this.scene = scene;
    this.effects = new Map();
    this.pool = new Map();
    this.pooledCount = 0;
    this.projectiles = [];
    this.launchOffsets = new WeakMap();
    this.texture = glowTexture();
    this.geo = {
      ring: new THREE.TorusGeometry(1, 0.024, 6, 64),
      arc: new THREE.TorusGeometry(1, 0.07, 7, 48, Math.PI * 1.1),
      ball: new THREE.SphereGeometry(1, 14, 10),
      beam: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
      spark: new THREE.ConeGeometry(0.08, 1, 5),
      star: starGeometry(),
      chip: new THREE.BoxGeometry(0.12, 0.32, 0.07),
    };
    this.light = new THREE.PointLight("#86efff", 0, 10, 2);
    scene.add(this.light);
  }
  mat(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }
  mesh(g, key, color, opacity = 1) {
    const m = new THREE.Mesh(this.geo[key], this.mat(color, opacity));
    g.add(m);
    return m;
  }
  particle(g, key, color, opacity = 1, wood = false) {
    const pools = (g.userData.particles ??= new Map()),
      id = `${key}:${wood}`;
    if (!pools.has(id))
      pools.set(id, { key, wood, opacity, proxies: [], colors: [] });
    const pool = pools.get(id),
      proxy = new THREE.Object3D();
    proxy.material = { opacity };
    pool.proxies.push(proxy);
    pool.colors.push(color);
    return proxy;
  }
  flushParticles(g) {
    for (const pool of g.userData.particles?.values() || []) {
      if (!pool.mesh) {
        const material = pool.wood
          ? new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 })
          : this.mat("#ffffff", pool.opacity);
        pool.mesh = new THREE.InstancedMesh(
          this.geo[pool.key],
          material,
          pool.proxies.length,
        );
        pool.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        pool.mesh.frustumCulled = false;
        pool.proxies.forEach((p, i) =>
          pool.mesh.setColorAt(i, new THREE.Color(pool.colors[i])),
        );
        g.add(pool.mesh);
      }
      pool.proxies.forEach((p, i) => {
        p.updateMatrix();
        pool.mesh.setMatrixAt(i, p.matrix);
      });
      pool.mesh.instanceMatrix.needsUpdate = true;
      pool.mesh.material.opacity = pool.proxies[0].material.opacity;
    }
  }
  glow(g, color, size, opacity = 0.6) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.texture,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    s.scale.setScalar(size);
    g.add(s);
    return s;
  }
  create(e) {
    const poolKey = `${e.type}:${e.color}:${!!e.heavy}:${e.visual || ""}`;
    const cached = this.pool.get(poolKey)?.pop();
    if (cached) {
      this.pooledCount--;
      cached.group.position.set(0, 0, 0);
      cached.group.rotation.set(0, 0, 0);
      cached.group.scale.setScalar(1);
      cached.beamEvent = undefined;
      this.scene.add(cached.group);
      this.effects.set(e.id, cached);
      return cached;
    }
    const g = new THREE.Group(),
      color = e.color || "#d6eeff",
      data = { group: g, parts: [], sparks: [], rings: [], poolKey };
    this.scene.add(g);
    if (e.type === "hit" || e.type === "guard") {
      data.core = this.mesh(g, "star", "#fff6da");
      data.halo = this.glow(g, color, e.heavy ? 4.5 : 2.5, 0.55);
      data.ring = this.mesh(g, "ring", color, 0.8);
      for (let i = 0; i < (e.heavy ? 28 : 16); i++)
        data.sparks.push(this.particle(g, "spark", i % 3 ? color : "#fff4c9"));
      if (["bijuu", "rasengan"].includes(e.visual)) {
        data.chakra = makeChakraOrb(e.visual);
        g.add(data.chakra);
        rememberGeometry(data, data.chakra);
      }
    } else if (e.type === "cast") {
      data.halo = this.glow(g, color, 2, 0.35);
      for (let i = 0; i < 3; i++) {
        const m = this.mesh(g, "ring", color, 0.8);
        data.rings.push(m);
      }
      for (let i = 0; i < 18; i++)
        data.sparks.push(this.particle(g, "ball", color));
    } else if (e.type === "beam") {
      data.halo = this.glow(g, color, 4, 0.7);
      for (let i = 0; i < 3; i++) {
        const m = this.mesh(
          g,
          "beam",
          i === 0 ? "#e8ffff" : color,
          i === 0 ? 0.95 : i === 1 ? 0.34 : 0.12,
        );
        m.rotation.z = Math.PI / 2;
        data.parts.push(m);
      }
      for (let i = 0; i < 7; i++)
        data.rings.push(this.mesh(g, "ring", i % 2 ? color : "#d6ffff", 0.7));
      for (let i = 0; i < 22; i++)
        data.sparks.push(this.particle(g, "spark", color));
    } else if (e.type === "pulse") {
      data.halo = this.glow(g, color, 5, 0.5);
      for (let i = 0; i < 4; i++) {
        const m = this.mesh(g, "ring", i % 2 ? "#ff8fb2" : color, 0.8);
        data.rings.push(m);
      }
      data.core = this.mesh(g, "ball", color, 0.13);
      for (let i = 0; i < 30; i++)
        data.sparks.push(
          this.particle(g, i % 3 ? "spark" : "star", i % 2 ? "#ffb7c7" : color),
        );
    } else if (e.type === "slash" || e.type === "dash") {
      if (e.type === "slash") {
        for (let i = 0; i < 3; i++) {
          data.rings.push(this.mesh(g, "arc", i === 0 ? "#fff7df" : color));
        }
      }
      data.halo = this.glow(g, color, 1.4, 0.2);
      for (let i = 0; i < 8; i++)
        data.sparks.push(this.particle(g, "spark", color));
    } else {
      if (e.type === "substitution") {
        const log = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.26, 0.95, 12),
          new THREE.MeshStandardMaterial({ color: "#a77e50", roughness: 0.9 }),
        );
        g.add(log);
        data.log = log;
        rememberGeometry(data, log);
      }
      data.ring = this.mesh(
        g,
        "ring",
        e.type === "break" ? "#e9bb85" : "#e7dbbd",
        0.35,
      );
      data.ring.rotation.x = -Math.PI / 2;
      for (let i = 0; i < (e.type === "break" ? 18 : 12); i++) {
        let m;
        if (e.type === "break") {
          m = this.particle(g, "chip", i % 2 ? "#e9bb85" : color, 1, true);
        } else m = this.particle(g, "ball", color, 0.15);
        data.sparks.push(m);
      }
    }
    this.effects.set(e.id, data);
    return data;
  }
  remove(d, recycle = false) {
    this.scene.remove(d.group);
    // Keep a bounded set of effects alive between attacks. Repeated punches
    // reuse GPU buffers/materials instead of disposing and recompiling them.
    if (recycle && this.pooledCount < 24) {
      if (!this.pool.has(d.poolKey)) this.pool.set(d.poolKey, []);
      this.pool.get(d.poolKey).push(d);
      this.pooledCount++;
      return;
    }
    d.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.material) o.material.dispose();
    });
    d.extraGeometries?.forEach((geometry) => geometry.dispose());
  }
  update(state, clock, actors = []) {
    const originFor = (owner, castId) => {
      const m = actors[owner];
      return castId != null && m?.skillOriginActive && state.fighters[owner]?.currentMove?.id === castId
        ? m.skillOrigin
        : null;
    };
    const alive = new Set();
    let light = 0;
    for (const e of state.effects) {
      const actor = actors[e.owner];
      if (actor?.external && e.type === "slash" &&
          ["rasengan", "sword-slash", "susanoo-slash"].includes(e.visual)) continue;
      if (
        e.type === "cast" &&
        e.castId &&
        state.fighters[e.owner]?.currentMove?.id !== e.castId
      )
        continue;
      alive.add(e.id);
      const expectedKey = `${e.type}:${e.color}:${!!e.heavy}:${e.visual || ""}`;
      let cached = this.effects.get(e.id);
      if (cached && cached.poolKey !== expectedKey) {
        this.remove(cached, true);
        this.effects.delete(e.id);
        cached = null;
      }
      const d = cached || this.create(e),
        a = clamp(1 - e.life / e.maxLife, 0, 1),
        fade = Math.pow(1 - a, 0.8);
      d.group.position.set(e.x, e.y, 0.35);
      if (e.type === "hit" || e.type === "guard") {
        if (d.chakra) {
          spinChakraOrb(
            d.chakra,
            clock,
            (e.visual === "bijuu" ? 1.25 : 0.6) * fade,
          );
          d.ring.scale.setScalar(0.5 + a * (e.visual === "bijuu" ? 5 : 2));
        }
        d.core.scale.setScalar((e.heavy ? 1.4 : 0.85) * (1 - a * 0.75));
        d.core.rotation.z = a * 0.6;
        d.core.material.opacity = Math.max(0, 1 - a * 2.2);
        d.halo.material.opacity = fade * 0.6;
        if (!d.chakra) d.ring.scale.setScalar(0.3 + a * (e.heavy ? 2.1 : 1.3));
        d.ring.material.opacity = fade * 0.7;
        d.sparks.forEach((p, i) => {
          const angle =
              (i / d.sparks.length) * Math.PI * 2 + rnd(i + e.id) * 0.3,
            r = (0.2 + a * (e.heavy ? 4 : 2.5)) * (0.4 + rnd(i * 3));
          p.position.set(
            Math.cos(angle) * r,
            Math.sin(angle) * r * 0.7 - a * a * 0.35,
            (rnd(i) - 0.5) * a * 2,
          );
          p.rotation.z = angle - Math.PI / 2;
          p.scale.set(0.6, fade * (0.3 + rnd(i) * 0.9), 0.6);
          p.material.opacity = fade;
        });
      } else if (e.type === "cast") {
        const f = state.fighters[e.owner];
        if (f)
          d.group.position.set(
            f.x + f.facing * (e.originX ?? (e.kind === "pulse" ? 0 : 0.9)),
            f.y +
              (e.height ??
                (f.crouching ? 0.55 : e.kind === "pulse" ? 1.0 : 1.7)),
            0.25,
          );
        const origin = originFor(e.owner, e.castId);
        if (origin) d.group.position.copy(origin);
        const big = e.ultimate;
        const compact = origin && !big ? .58 : 1;
        d.halo.scale.setScalar((big ? 3.2 : 1.5) * (.4 + a) * compact);
        d.halo.material.opacity = 0.25 + a * 0.4;
        d.rings.forEach((r, i) => {
          r.scale.setScalar(((big ? 1.3 : .55) * (1 - a * .6) + i * .12) * compact);
          r.rotation.set(clock * (i % 2 ? 2 : -2), clock * 1.5 + i, clock * 2);
          r.material.opacity = 0.25 + a * 0.55;
        });
        d.sparks.forEach((p, i) => {
          const angle = i * 2.4 + clock * 2,
            r = ((1 - a) * (big ? 2.2 : 1) + .1) * compact;
          p.position.set(
            Math.cos(angle) * r,
            Math.sin(angle) * r * 0.8,
            Math.sin(angle * 1.3) * r * 0.5,
          );
          p.scale.setScalar(0.035 + a * 0.025);
          p.material.opacity = 0.4 + a * 0.6;
        });
        if (big) {
          light = Math.max(light, a * 5);
          this.light.position.copy(d.group.position);
          this.light.color.set(e.color);
        }
      } else if (e.type === "beam") {
        const sign = e.direction || 1;
        const range = e.range || 14;
        const angle = e.angle || 0;
        if (d.beamEvent !== e) {
          d.beamEvent = e;
          const origin = originFor(e.owner, e.castId);
          d.beamOrigin = origin?.clone() ?? new THREE.Vector3(e.x, e.y, .35);
          const direction = new THREE.Vector3(
            e.x + sign * Math.cos(angle) * range,
            e.y + Math.sin(angle) * range,
            d.beamOrigin.z,
          ).sub(d.beamOrigin);
          d.beamSpan = direction.length();
          d.group.quaternion.setFromUnitVectors(new THREE.Vector3(sign, 0, 0), direction.normalize());
        }
        d.group.position.copy(d.beamOrigin);
        const span = d.beamSpan;
        const strength = THREE.MathUtils.smoothstep(a, 0, .12);
        const width = (e.radius ?? .7) * (.18 + strength * fade * .95);
        d.halo.scale.setScalar(e.ultimate ? 4 : 1.65);
        d.parts.forEach((p, i) => {
          p.position.x = (sign * span) / 2;
          p.scale.set(
            width * (i === 0 ? 0.23 : i === 1 ? 0.65 : 1.1),
            span,
            width * (i === 0 ? 0.23 : i === 1 ? 0.65 : 1.1),
          );
          p.material.opacity = (i === 0 ? 0.95 : i === 1 ? 0.35 : 0.13) * fade;
        });
        d.halo.material.opacity = fade * 0.75;
        d.rings.forEach((r, i) => {
          r.position.x = sign * (0.2 + (i / 7) * span);
          r.rotation.y = Math.PI / 2;
          r.rotation.z = clock * 6;
          r.scale.setScalar(width * (1 + (i % 3) * 0.28));
          r.material.opacity = fade * 0.9;
        });
        d.sparks.forEach((p, i) => {
          p.position.set(
            sign * (((rnd(i * 7) + a) * span) % span),
            Math.sin(i * 3.2 + clock * 6) * width * 1.4,
            Math.cos(i * 3.2 + clock * 6) * width,
          );
          p.rotation.z = Math.PI / 2;
          p.scale.set(0.45, 0.6 + rnd(i) * 1.4, 0.45);
          p.material.opacity = fade * 0.7;
        });
        light = Math.max(light, 4 * fade);
        this.light.position.copy(d.group.position);
        this.light.color.set(e.color);
      } else if (e.type === "pulse") {
        const airborne = e.visual === "air-spin";
        const owner = state.fighters[e.owner];
        if (airborne && e.castId != null && owner?.currentMove?.id === e.castId) {
          d.group.position.set(owner.x, owner.y + .77, 0);
        }
        const radius = (e.radius || 6.8) * Math.min(1, a * (airborne ? 3.6 : 1.8));
        const intensity = airborne ? (1 - a) ** 2.4 : fade;
        d.halo.scale.setScalar(airborne ? 1 + a * 2 : e.visual === "supply" ? 1.3 + a * 1.5 : 3 + a * 5);
        d.halo.material.opacity = intensity * (airborne ? .22 : .5);
        d.core.scale.set(radius, Math.max(.1, 1 - a) * (airborne ? .42 : 2.2), radius * .5);
        d.core.material.opacity = intensity * .1;
        d.rings.forEach((r, i) => {
          r.rotation.set(
            airborne || i < 2 ? -Math.PI / 2 : .1,
            !airborne && i > 1 ? i * .65 : 0,
            clock * (i % 2 ? -1 : 1),
          );
          r.position.y = i < 2 ? -0.5 : i * 0.16;
          r.scale.setScalar(Math.max(0.02, radius * (1 - i * 0.14)));
          r.material.opacity = intensity * (airborne ? .64 : .9);
        });
        d.sparks.forEach((p, i) => {
          const theta = (i / d.sparks.length) * Math.PI * 2,
            r = radius * (0.65 + rnd(i) * 0.4);
          p.position.set(
            Math.cos(theta) * r,
            Math.sin(theta) * r * (airborne ? .12 : .45) + Math.sin(a * Math.PI) * .55,
            Math.sin(theta * 2) * r * (airborne ? .46 : .25),
          );
          p.rotation.z = theta - Math.PI / 2;
          p.scale.setScalar((i % 3 ? .6 : .3) * intensity);
          p.material.opacity = intensity;
        });
        light = Math.max(light, (e.visual==='supply'?.6:5) * fade);
        this.light.position.copy(d.group.position);
        this.light.color.set(e.color);
      } else if (e.type === "slash" || e.type === "dash") {
        const dash = e.type === "dash";
        const direction = e.direction || 1;
        const owner = state.fighters[e.owner];
        if (dash && e.castId != null && owner?.currentMove?.id === e.castId) {
          const socket = originFor(e.owner, e.castId);
          d.group.position.set(owner.x - direction * .25, socket?.y ?? owner.y + (owner.crouching ? .5 : 1.25), 0);
        }
        d.group.rotation.y = direction < 0 ? Math.PI : 0;
        d.rings.forEach((r, i) => {
          r.position.x = i * -.16;
          r.rotation.set(.18, .25, -Math.PI * .55 + a * .8);
          r.scale.set(.85 + i * .14, 1.1 + i * .14, 1);
          r.material.opacity = fade * (i === 0 ? .75 : .26);
        });
        d.halo.material.opacity = fade * (dash ? .12 : .25);
        d.sparks.forEach((p, i) => {
          p.position.set(-a * (1 + i * .17) - (dash ? .34 : 0), Math.sin(i * 5) * (dash ? .46 : .7), (rnd(i) - .5) * .6);
          p.rotation.z = Math.PI / 2;
          p.scale.set(dash ? .16 : .3, fade * (dash ? .65 + .4 * rnd(i) : .5), dash ? .16 : .3);
          p.material.opacity = fade * (dash ? .54 : .6);
        });
      } else {
        if (d.log) {
          d.log.rotation.set(a * 0.6, clock * 0.7, a * 0.8);
          d.log.position.y = -0.1 - a * 0.5;
          d.log.scale.setScalar(1 - Math.max(0, a - 0.65) * 2);
        }
        d.ring.scale.setScalar(0.25 + a * (e.type === "break" ? 2.2 : 1.7));
        d.ring.position.y = -e.y + 0.04;
        d.ring.material.opacity = fade * 0.35;
        d.sparks.forEach((p, i) => {
          const theta = i * 2.4,
            r = (0.15 + a * 2) * (rnd(i + e.id) + 0.3);
          p.position.set(
            Math.cos(theta) * r,
            Math.max(
              -e.y + 0.05,
              e.type === "break" ? a * 3.6 - a * a * 5 : a * 0.35,
            ),
            Math.sin(theta) * r * 0.7,
          );
          p.rotation.set(a * 9 + i, a * 8, i);
          p.scale.setScalar(
            e.type === "break"
              ? ((i % 3) + 0.6) * fade
              : 0.07 + Math.sin(a * Math.PI) * 0.16,
          );
          if (e.type !== "break") p.material.opacity = fade * 0.18;
        });
      }
    }
    for (const [id, d] of this.effects)
      if (!alive.has(id)) {
        this.remove(d, true);
        this.effects.delete(id);
      }
    for (const d of this.effects.values()) this.flushParticles(d.group);
    this.light.intensity = light;
    while (this.projectiles.length < state.projectiles.length) {
      const g = new THREE.Group(),
        d = { group: g, rings: [] };
      d.core = this.mesh(g, "ball", "#e9ffff");
      d.shell = this.mesh(g, "ball", "#3dd9ff", 0.18);
      d.glow = this.glow(g, "#3ad6ff", 2.2, 0.8);
      for (let i = 0; i < 4; i++)
        d.rings.push(this.mesh(g, "ring", i % 2 ? "#d2ffff" : "#62dbff", 0.7));
      this.scene.add(g);
      this.projectiles.push(d);
    }
    this.projectiles.forEach((d, i) => {
      const p = state.projectiles[i];
      d.group.visible = !!p;
      if (!p) return;
      d.group.position.set(p.x, p.y, p.z || 0);
      if (!this.launchOffsets.has(p)) {
        const origin = p.move?.aim === "susanoo-bow" ? null : originFor(p.owner, p.castId);
        const owner = state.fighters[p.owner];
        const offset = origin && origin.clone().sub(new THREE.Vector3(
          owner.x + p.direction * (p.move.originX ?? 1),
          owner.y + p.move.height,
          0,
        ));
        this.launchOffsets.set(p, offset);
      }
      const offset = this.launchOffsets.get(p);
      if (offset) {
        const blend = 1 - THREE.MathUtils.smoothstep(p.distance, 0, 1.6);
        d.group.position.addScaledVector(offset, blend);
      }
      if (p.move?.visual === "susanoo-arrow") {
        d.aimDirection ||= new THREE.Vector3();
        d.aimAxis ||= new THREE.Vector3(1, 0, 0);
        d.aimDirection.set(p.vx, p.vy, p.vz || 0).normalize();
        d.group.quaternion.setFromUnitVectors(d.aimAxis, d.aimDirection);
      } else
      d.group.rotation.set(0, 0, Math.atan2(p.vy || 0, p.vx ?? p.direction));
      const special = ["bijuu", "kunai", "fireball", "susanoo-arrow"].includes(p.move?.visual)
        ? p.move.visual
        : null;
      const normalParts = [d.core, d.shell, d.glow, ...d.rings];
      normalParts.forEach((object) => {
        object.visible = !special;
      });
      d.specials ??= new Map();
      if (special && !d.specials.has(special)) {
        const object =
          special === "bijuu" ? makeChakraOrb("bijuu") : special === "kunai" ? makeKunai() : makeSasukeProjectile(special);
        d.specials.set(special, object);
        d.group.add(object);
        rememberGeometry(d, object);
      }
      for (const [kind, object] of d.specials)
        object.visible = special === kind;
      if (special) {
        const object = d.specials.get(special);
        if (special === "susanoo-arrow") object.scale.setScalar(SUSANOO_ARCHERY.arrowScale);
        else if (special === "bijuu") spinChakraOrb(object, clock, p.radius);
        else if (special === "fireball") {
          object.scale.setScalar(p.radius / .5);
          object.rotation.x = clock * 7;
        }
        return;
      }
      d.shell.material.color.set(p.color);
      d.glow.material.color.set(p.color);
      const r = p.radius;
      d.core.scale.set(r * 1.5, r * 0.6, r * 0.6);
      d.shell.scale.set(r * 2, r, r);
      d.rings.forEach((m, j) => {
        m.material.color.set(j % 2 ? "#e5ffff" : p.color);
        m.rotation.set(clock * 8 + j * 0.5, Math.PI / 2, 0);
        m.position.x = -j * 0.28;
        const launch = 1 - THREE.MathUtils.smoothstep(p.distance, 0, 2);
        m.scale.setScalar(r * (1.2 + j * 0.25 + launch * (j + 1) * .22));
        m.material.opacity = .7 - j * .14 + launch * .16;
      });
    });
  }
  dispose() {
    for (const d of this.effects.values()) this.remove(d);
    for (const entries of this.pool.values())
      for (const d of entries) this.remove(d);
    this.pool.clear();
    this.effects.clear();
    this.pooledCount = 0;
    for (const d of this.projectiles) this.remove(d);
    Object.values(this.geo).forEach((g) => g.dispose());
    this.texture.dispose();
    this.scene.remove(this.light);
  }
}
