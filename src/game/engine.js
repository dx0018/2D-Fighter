/** Deterministic combat core. No DOM, timers or renderer dependency. */
import { moveContext, selectMove, recoveryMovement } from "./moves.js";
import { segmentHitsBox, fighterHeight } from "./collision.js";
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const EPS = 1e-7;
const KEYS = ["jump", "attack", "skill", "ultimate"];
export class Game {
  constructor({ characters, map, onEvent = () => {} }) {
    if (characters?.length !== 2 || !map?.spawns?.[1])
      throw new Error("A match requires two characters and a valid map");
    this.characters = characters;
    this.map = map;
    this.onEvent = onEvent;
    this.reset();
  }
  reset() {
    this.paused = false;
    this.previous = [{}, {}];
    this.nextId = 1;
    this.state = {
      fighters: this.characters.map((character, id) => ({
        id,
        character,
        x: this.map.spawns[id].x,
        y: 0,
        vx: 0,
        vy: 0,
        facing: this.map.spawns[id].facing,
        hp: character.maxHp,
        energy: character.maxEnergy,
        cooldowns: { attack: 0, skill: 0, ultimate: 0 },
        cooldownTotals: { attack: 1, skill: 1, ultimate: 1 },
        action: "idle",
        actionTime: 0,
        stun: 0,
        flash: 0,
        invulnerable: 0,
        crouching: false,
        grounded: true,
        currentMove: null,
        moveProgress: 0,
        bufferedMove: null,
        jumpBuffer: 0,
        combo: 0,
        comboDamage: 0,
        comboWindow: 0,
        hitDirection: 0,
        inputContext: "neutral",
        moveDirection: 0,
        walkDistance: 0,
        jumpStartup: 0,
        landingTimer: 0,
        landingImpact: 0,
        hitLevel: "mid",
      })),
      objects: this.map.objects.map((object) => ({
        ...object,
        maxHp: object.hp,
        destroyed: false,
        shake: 0,
        flash: 0,
      })),
      projectiles: [],
      effects: [],
      time: 99,
      phase: "countdown",
      countdown: 3,
      winner: null,
      shake: 0,
      hitstop: 0,
      impactPulse: 0,
    };
    this.lastCountdown = 3;
  }
  event(type, detail = {}) {
    this.onEvent({ type, ...detail });
  }
  effect(type, x, y, color, life = 0.4, detail = {}) {
    this.state.effects.push({
      id: this.nextId++,
      type,
      x,
      y,
      color,
      life,
      maxLife: life,
      ...detail,
    });
  }
  step(dt, inputs = [{}, {}]) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const safeInputs = [inputs[0] || {}, inputs[1] || {}];
    const pressed = safeInputs.map((input, i) =>
      Object.fromEntries(
        KEYS.map((key) => [key, !!input[key] && !this.previous[i][key]]),
      ),
    );
    this.previous = safeInputs.map((input) => ({ ...input }));
    if (this.paused) return;
    // Frame stalls do not teleport fighters or silently expire a round.
    let remaining = Math.min(dt, 0.1);
    let first = true;
    while (remaining > EPS) {
      const tick = Math.min(remaining, 1 / 120);
      this.tick(tick, safeInputs, first ? pressed : [{}, {}]);
      remaining -= tick;
      first = false;
    }
  }
  tick(dt, inputs, pressed) {
    const s = this.state;
    for (const effect of s.effects) {
      if (effect.type === "cast") {
        const cast = s.fighters[effect.owner]?.currentMove;
        effect.life =
          cast?.id === effect.castId
            ? Math.max(0, cast.move.windup - cast.elapsed)
            : 0;
      } else effect.life -= dt;
    }
    s.effects = s.effects.filter((effect) => effect.life > 0);
    s.shake = Math.max(0, s.shake - dt * 2.5);
    s.impactPulse = Math.max(0, s.impactPulse - dt * 5);
    for (const object of s.objects) {
      object.shake = Math.max(0, object.shake - dt * 2);
      object.flash = Math.max(0, object.flash - dt);
    }
    if (s.phase === "finished") {
      for (const f of s.fighters) {
        f.actionTime += dt;
        f.flash = Math.max(0, f.flash - dt);
      }
      return;
    }
    if (s.phase === "countdown") {
      s.countdown = Math.max(0, s.countdown - dt);
      const next = Math.ceil(s.countdown);
      if (next !== this.lastCountdown) {
        this.lastCountdown = next;
        this.event("countdown", { value: next });
      }
      if (s.countdown <= EPS) {
        s.countdown = 0;
        s.phase = "fighting";
        this.event("start");
      }
      return;
    }
    // Preserve brief button taps through impact freeze and the end of recovery.
    s.fighters.forEach((f, id) => {
      const other = s.fighters[1 - id];
      f.moveDirection = Number(!!inputs[id].right) - Number(!!inputs[id].left);
      f.inputContext = moveContext(
        f,
        inputs[id],
        other,
        (pressed[id].jump || f.jumpBuffer > 0) &&
          f.grounded &&
          !inputs[id].crouch,
      );
      const key = ["ultimate", "skill", "attack"].find((key) => {
        if (!pressed[id][key]) return false;
        const move = selectMove(f.character, key, f.inputContext);
        return (
          f.energy >= move.cost &&
          f.cooldowns[key] <= (move.inputBuffer ?? 0.12) + EPS
        );
      });
      if (key)
        f.bufferedMove = {
          key,
          context: key === "ultimate" ? "neutral" : f.inputContext,
          facing: Math.sign(other.x - f.x) || f.facing,
          remaining:
            selectMove(f.character, key, f.inputContext).inputBuffer ?? 0.12,
        };
      if (pressed[id].jump) f.jumpBuffer = 0.12;
    });
    if (s.hitstop > EPS) {
      s.hitstop = Math.max(0, s.hitstop - dt);
      return;
    }
    s.time = Math.max(0, s.time - dt);
    const strikes = [];
    s.fighters.forEach((f, id) => {
      f.actionTime += dt;
      if (f.bufferedMove) {
        if (f.bufferedMove.remaining < -EPS) f.bufferedMove = null;
        else f.bufferedMove.remaining -= dt;
      }
      f.jumpBuffer = Math.max(0, f.jumpBuffer - dt);
      f.comboWindow = Math.max(0, f.comboWindow - dt);
      if (f.comboWindow <= 0) {
        f.combo = 0;
        f.comboDamage = 0;
      }
      f.flash = Math.max(0, f.flash - dt);
      f.invulnerable = Math.max(0, f.invulnerable - dt);
      f.stun = Math.max(0, f.stun - dt);
      f.landingTimer = Math.max(0, f.landingTimer - dt);
      f.energy = Math.min(f.character.maxEnergy, f.energy + dt * 5);
      for (const key of ["attack", "skill", "ultimate"])
        f.cooldowns[key] = Math.max(0, f.cooldowns[key] - dt);
      const other = s.fighters[1 - id];
      if (!f.currentMove && !f.stun && Math.abs(other.x - f.x) > 0.1)
        f.facing = other.x >= f.x ? 1 : -1;
      if (!f.currentMove && f.stun <= EPS) {
        f.crouching = !!inputs[id].crouch && f.grounded;
        if (f.jumpBuffer > 0 && f.grounded && !f.crouching) {
          f.jumpBuffer = 0;
          if (!f.jumpStartup) f.jumpStartup = 0.025;
        }
        if (f.jumpStartup > 0) {
          f.jumpStartup = Math.max(0, f.jumpStartup - dt);
          this.setAction(f, "takeoff");
          if (f.jumpStartup <= EPS) {
            f.jumpStartup = 0;
            f.vy = f.character.jump;
            f.grounded = false;
            f.crouching = false;
            f.landingTimer = 0;
            this.effect("dust", f.x, 0.15, "#e5d8c4", 0.3);
          }
        }
        let chosen = ["ultimate", "skill", "attack"].find(
          (key) =>
            f.bufferedMove?.key === key &&
            !f.jumpStartup &&
            (key === "ultimate" ||
              (f.bufferedMove.context === "air") === !f.grounded) &&
            f.cooldowns[key] <= EPS &&
            f.energy >=
              selectMove(f.character, key, f.bufferedMove.context).cost,
        );
        if (chosen) {
          const buffered = f.bufferedMove;
          f.bufferedMove = null;
          this.beginMove(f, chosen, buffered.context, buffered.facing);
        }
      }
      if (f.currentMove) {
        const cast = f.currentMove;
        const move = cast.move;
        const oldTime = cast.elapsed;
        cast.elapsed += dt;
        f.moveProgress = clamp(
          cast.elapsed / (move.windup + move.active + move.recovery),
          0,
          1,
        );
        f.vx *= Math.exp(-16 * dt);
        if (f.grounded && !f.crouching && recoveryMovement(cast)) {
          const direction =
            Number(!!inputs[id].right) - Number(!!inputs[id].left);
          f.vx = direction * f.character.speed;
        }
        if (
          move.kind === "dash" &&
          cast.elapsed >= move.windup &&
          cast.elapsed < move.windup + move.active
        ) {
          f.vx = cast.facing * move.dashSpeed;
          if (!f.grounded && move.diveSpeed)
            f.vy = Math.min(f.vy, -move.diveSpeed);
        }
        if (
          move.movement &&
          cast.elapsed >= move.windup &&
          cast.elapsed < move.windup + move.active
        )
          f.vx = cast.facing * move.movement;
        // Cast exactly once; active melee may acquire a target throughout its window.
        if (!cast.released && cast.elapsed >= move.windup) {
          cast.released = true;
          this.release(f, cast);
        }
        if (
          cast.elapsed >= move.windup &&
          oldTime < move.windup + move.active &&
          move.kind !== "projectile"
        )
          strikes.push({ attacker: f, cast });
        if (cast.elapsed >= move.windup + move.active + move.recovery) {
          f.currentMove = null;
          f.moveProgress = 0;
          if (f.grounded && !f.crouching && recoveryMovement(cast))
            this.setAction(f, Math.abs(f.vx) > 0.12 ? "walk" : "idle");
        }
      } else if (f.stun > EPS) {
        f.vx *= Math.exp(-5 * dt);
        this.setAction(f, "hurt");
      } else if (!f.jumpStartup) {
        const direction =
          Number(!!inputs[id].right) - Number(!!inputs[id].left);
        const targetSpeed = f.crouching ? 0 : direction * f.character.speed;
        f.vx = f.grounded
          ? targetSpeed
          : f.vx + (targetSpeed - f.vx) * (1 - Math.exp(-dt * 18));
        if (Math.abs(f.vx) < 0.015) f.vx = 0;
        this.setAction(
          f,
          !f.grounded
            ? "jump"
            : f.crouching
              ? "crouch"
              : Math.abs(f.vx) > 0.12
                ? "walk"
                : "idle",
        );
      }
      const oldX = f.x;
      f.x = clamp(
        f.x + f.vx * dt,
        this.map.bounds.left + 0.6,
        this.map.bounds.right - 0.6,
      );
      if (
        f.grounded &&
        (f.action === "walk" ||
          (!f.crouching && recoveryMovement(f.currentMove)))
      )
        f.walkDistance += Math.abs(f.x - oldX);
      if (f.grounded && f.action === "walk" && Math.abs(f.x - oldX) < EPS) {
        f.vx = 0;
        this.setAction(f, "idle");
      }
      if (!f.grounded) {
        f.vy -= 25 * (f.currentMove?.move.gravityScale ?? 1) * dt;
        f.y += f.vy * dt;
        if (f.y <= 0) {
          f.landingImpact = Math.min(1, Math.abs(f.vy) / 12);
          f.landingTimer = 0.16;
          f.y = 0;
          f.vy = 0;
          f.grounded = true;
          if (f.currentMove?.context === "air") {
            f.currentMove.cancelled = true;
            f.currentMove = null;
            f.moveProgress = 0;
          }
          this.effect("dust", f.x, 0.1, "#e5d8c4", 0.3);
        }
      }
    });
    this.separateFighters();
    // Collect both players' contacts before applying damage, allowing honest trades.
    const contacts = [];
    for (const strike of strikes)
      this.collectStrike(strike.attacker, strike.cast, contacts);
    this.updateProjectiles(dt, contacts);
    for (const contact of contacts) this.applyContact(contact);
    this.checkEnd();
  }
  setAction(f, action) {
    if (f.action !== action) {
      f.action = action;
      f.actionTime = 0;
    }
  }
  beginMove(f, key, context = "neutral", facing = f.facing) {
    const move = selectMove(f.character, key, context);
    f.energy -= move.cost;
    f.cooldowns[key] = move.cooldown;
    f.cooldownTotals[key] = move.cooldown;
    f.crouching = move.posture === "crouch" && f.grounded;
    f.jumpStartup = 0;
    f.facing = facing;
    f.currentMove = {
      id: this.nextId++,
      key,
      move,
      context: move.context,
      visual: move.visual,
      elapsed: 0,
      facing,
      released: false,
      hit: new Set(),
    };
    this.setAction(f, key);
    f.actionTime = 0;
    this.event("cast", {
      player: f.id,
      move: key,
      kind: move.kind,
      color: move.color,
      name: move.name,
      duration: move.windup,
      visual: move.visual,
      ultimate: key === "ultimate",
      context: move.context,
    });
    const chargeHeight =
      move.kind === "beam"
        ? (move.height ?? 1.3)
        : move.kind === "projectile"
          ? (move.height ?? 1.7)
          : f.crouching
            ? 0.55
            : (move.hitY ?? 1.4);
    if (!move.visual || !["rasengan", "bijuu"].includes(move.visual))
      this.effect("cast", f.x, f.y + chargeHeight, move.color, move.windup, {
        owner: f.id,
        kind: move.kind,
        castId: f.currentMove.id,
        height: chargeHeight,
        originX: move.kind === "beam" ? (move.originX ?? 0.8) : undefined,
        ultimate: key === "ultimate",
      });
  }
  release(f, cast) {
    const move = cast.move;
    this.event("release", {
      player: f.id,
      kind: move.kind,
      move: cast.key,
      ultimate: cast.key === "ultimate",
      context: cast.context,
      visual: move.visual,
    });
    if (move.evade) f.invulnerable = Math.max(f.invulnerable, move.evade);
    if (move.substitution)
      this.effect("substitution", f.x, f.y + 0.75, "#e9e1d3", 0.6, {
        direction: cast.facing,
      });
    if (move.kind === "projectile") {
      this.state.projectiles.push({
        id: this.nextId++,
        x: f.x + cast.facing * (move.originX ?? 1),
        y: f.y + move.height,
        direction: cast.facing,
        owner: f.id,
        color: move.color,
        radius: move.radius,
        speed: move.projectileSpeed,
        vx: cast.facing * move.projectileSpeed * Math.cos(move.angle || 0),
        vy: move.projectileSpeed * Math.sin(move.angle || 0),
        angle: move.angle || 0,
        distance: 0,
        move,
        hit: new Set(),
        alive: true,
      });
    } else if (move.kind === "beam") {
      cast.ray = {
        x: f.x + cast.facing * (move.originX ?? 0.8),
        y: f.y + (move.height ?? 1.3),
        dx: cast.facing * Math.cos(move.angle || 0) * move.range,
        dy: Math.sin(move.angle || 0) * move.range,
      };
      this.effect("beam", cast.ray.x, cast.ray.y, move.color, 0.56, {
        direction: cast.facing,
        range: move.range,
        owner: f.id,
        angle: move.angle || 0,
        radius: move.beamRadius ?? 0.7,
        ultimate: cast.key === "ultimate",
      });
      this.state.shake = Math.max(this.state.shake, 0.25);
    } else if (move.kind === "pulse") {
      this.effect(
        "pulse",
        f.x,
        f.y + (move.hitY ?? 0.6),
        move.color,
        cast.key === "ultimate" ? 0.82 : 0.48,
        {
          radius: move.range,
          owner: f.id,
        },
      );
      this.state.shake = Math.max(this.state.shake, 0.35);
    } else
      this.effect(
        move.kind === "dash" ? "dash" : "slash",
        f.x + cast.facing * 1.2,
        f.y + (move.hitY ?? 1.2),
        move.color,
        0.32,
        { direction: cast.facing, owner: f.id, visual: move.visual },
      );
  }
  collectStrike(f, cast, contacts) {
    if (cast.cancelled) return;
    const move = cast.move;
    const radial = move.kind === "pulse";
    const centerY = f.y + (move.hitY ?? 1.15);
    const height = move.hitHeight ?? (radial ? 4.8 : 1.55);
    const overlaps = (x, width, y, h) => {
      if (move.kind === "beam") {
        const r = cast.ray;
        return (
          r &&
          segmentHitsBox(
            r.x,
            r.y,
            r.x + r.dx,
            r.y + r.dy,
            move.beamRadius ?? 0.7,
            x,
            width,
            y,
            h,
          )
        );
      }
      const dx = x - f.x;
      const horizontal = radial
        ? Math.abs(dx) <= move.range + width / 2
        : dx * cast.facing >= -0.25 &&
          dx * cast.facing <= move.range + width / 2;
      return horizontal && Math.abs(centerY - (y + h / 2)) <= (height + h) / 2;
    };
    const target = this.state.fighters[1 - f.id];
    if (
      !cast.hit.has(`f${target.id}`) &&
      target.invulnerable <= EPS &&
      overlaps(target.x, 1, target.y, fighterHeight(target))
    ) {
      cast.hit.add(`f${target.id}`);
      contacts.push({
        attacker: f,
        target,
        move,
        direction: radial
          ? Math.sign(target.x - f.x) || cast.facing
          : cast.facing,
      });
    }
    for (const object of this.state.objects) {
      if (object.destroyed || cast.hit.has(object.id)) continue;
      if (overlaps(object.x, object.width, 0, object.height)) {
        cast.hit.add(object.id);
        contacts.push({ attacker: f, object, move, direction: cast.facing });
      }
    }
  }
  updateProjectiles(dt, contacts) {
    for (const p of this.state.projectiles) {
      const oldX = p.x,
        oldY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.distance += p.speed * dt;
      const overlaps = (x, width, y, height) =>
        segmentHitsBox(oldX, oldY, p.x, p.y, p.radius, x, width, y, height);
      const target = this.state.fighters[1 - p.owner];
      if (overlaps(target.x, 1, target.y, fighterHeight(target))) {
        // A projectile that crosses an invulnerable fighter is dodged. Consume
        // it at the crossing so it cannot linger inside and hit when invuln ends.
        p.alive = false;
        if (target.invulnerable <= EPS)
          contacts.push({
            attacker: this.state.fighters[p.owner],
            target,
            move: p.move,
            direction: p.direction,
          });
      }
      if (!p.alive) continue;
      for (const object of this.state.objects) {
        if (
          !object.destroyed &&
          !p.hit.has(object.id) &&
          overlaps(object.x, object.width, 0, object.height)
        ) {
          p.hit.add(object.id);
          contacts.push({
            attacker: this.state.fighters[p.owner],
            object,
            move: p.move,
            direction: p.direction,
          });
        }
      }
      if (
        p.distance > p.move.range ||
        p.x < this.map.bounds.left - 2 ||
        p.x > this.map.bounds.right + 2 ||
        p.y < p.radius * 0.5
      )
        p.alive = false;
    }
    this.state.projectiles = this.state.projectiles.filter((p) => p.alive);
  }
  applyContact({ attacker, target, object, move, direction }) {
    if (object) {
      object.flash = 0.18;
      object.shake = 1;
      this.effect("hit", object.x, object.height * 0.7, move.color, 0.25, {
        object: object.id,
      });
      if (object.type === "crate") {
        object.hp = Math.max(0, object.hp - move.damage);
        if (object.hp <= 0 && !object.destroyed) {
          object.destroyed = true;
          this.effect(
            "break",
            object.x,
            object.height / 2,
            object.color || "#bc895b",
            0.9,
            { direction },
          );
          this.event("break", { object: object.id, player: attacker.id });
        } else
          this.event("objectHit", { object: object.id, player: attacker.id });
      } else
        this.event("objectHit", { object: object.id, player: attacker.id });
      return;
    }
    // Contacts were validated together; do not reject a second hit in a fair trade.
    target.hp = Math.max(0, target.hp - move.damage);
    target.energy = Math.min(target.character.maxEnergy, target.energy + 7);
    if (move.cost === 0)
      attacker.energy = Math.min(
        attacker.character.maxEnergy,
        attacker.energy + 12,
      );
    attacker.combo += 1;
    attacker.comboDamage += move.damage;
    attacker.comboWindow = 1.35;
    target.hitDirection = direction;
    target.hitLevel = (move.hitY ?? 1.35) < 0.9 ? "low" : "mid";
    this.state.hitstop = Math.max(
      this.state.hitstop,
      move.impact?.stop ?? 0.055,
    );
    this.state.impactPulse = move.damage >= 30 ? 0.65 : 0.24;
    target.stun = move.stun;
    target.invulnerable = 0.12;
    target.flash = 0.16;
    target.vx = direction * move.knockback;
    target.currentMove = null;
    target.moveProgress = 0;
    target.crouching = false;
    target.jumpStartup = 0;
    this.setAction(target, "hurt");
    this.state.shake = Math.max(
      this.state.shake,
      move.impact?.shake ?? (move.damage >= 30 ? 0.7 : 0.3),
    );
    this.effect(
      "hit",
      target.x - direction * 0.35,
      target.y + Math.min(fighterHeight(target) - 0.2, move.hitY ?? 1.35),
      move.color,
      0.32,
      {
        damage: move.damage,
        heavy: move.damage >= 30,
        direction,
        visual: move.visual,
      },
    );
    this.event("hit", {
      player: attacker.id,
      target: target.id,
      damage: move.damage,
      heavy: move.damage >= 30,
      color: move.color,
      combo: attacker.combo,
      visual: move.visual,
      kind: move.kind,
    });
  }
  separateFighters() {
    const [a, b] = this.state.fighters;
    if (Math.abs(a.y - b.y) > 2.1) return;
    const dx = b.x - a.x;
    const distance = Math.abs(dx);
    if (distance >= 1.15) return;
    const sign = Math.sign(dx) || 1;
    const overlap = (1.15 - distance) / 2;
    a.x = clamp(
      a.x - sign * overlap,
      this.map.bounds.left + 0.6,
      this.map.bounds.right - 0.6,
    );
    b.x = clamp(
      b.x + sign * overlap,
      this.map.bounds.left + 0.6,
      this.map.bounds.right - 0.6,
    );
  }
  checkEnd() {
    const s = this.state;
    if (s.fighters.every((f) => f.hp > 0) && s.time > EPS) return;
    const [a, b] = s.fighters;
    const healthA = a.hp / a.character.maxHp;
    const healthB = b.hp / b.character.maxHp;
    s.winner =
      Math.abs(healthA - healthB) <= EPS ? "draw" : healthA > healthB ? 0 : 1;
    s.phase = "finished";
    s.projectiles = [];
    s.hitstop = 0;
    for (const f of s.fighters) {
      f.currentMove = null;
      f.bufferedMove = null;
      f.jumpBuffer = 0;
      f.jumpStartup = 0;
      f.landingTimer = 0;
      f.vx = 0;
      f.vy = 0;
      f.y = 0;
      f.grounded = true;
      f.stun = 0;
      f.crouching = false;
      this.setAction(
        f,
        s.winner === "draw" ? "idle" : s.winner === f.id ? "victory" : "defeat",
      );
    }
    this.event("end", {
      winner: s.winner,
      reason: s.time <= EPS ? "time" : "ko",
    });
  }
}
