import { selectMove, moveContext } from "./moves.js";

/** P2 uses the same inputs, energy, cooldowns and hit rules as a human. */
export class ComputerPlayer {
  constructor(random = Math.random) {
    this.random = random;
    this.timer = 0;
    this.movement = {};
  }
  read(game, dt) {
    const state = game.state;
    if (game.paused || state.phase !== "fighting" || state.hitstop > 1e-7) {
      this.movement = {};
      return {};
    }
    const self = state.fighters[1], rival = state.fighters[0];
    if (self.hp <= 0 || rival.hp <= 0) return {};
    this.timer -= Math.max(0, Math.min(dt, 0.1));
    if (this.timer > 0) return { ...this.movement };
    // A human-scale reaction interval, with no per-frame dice rolls.
    this.timer = 0.14 + this.random() * 0.1;
    const distance = Math.abs(rival.x - self.x);
    const toward = rival.x >= self.x ? "right" : "left";
    const away = toward === "right" ? "left" : "right";
    const ranged = ["projectile", "beam"].includes(self.character.moves.skill.kind);
    const comfortable = ranged ? 4.8 : 1.8;
    const input = {};
    if (self.currentMove && self.cancelWindow > 0) {
      if (
        self.cancelTargets.includes("ultimate") &&
        self.cooldowns.ultimate <= 0 &&
        self.energy >= self.character.moves.ultimate.cost &&
        this.random() < 0.22
      ) input.ultimate = true;
      else if (
        self.cancelTargets.includes("skill") &&
        self.cooldowns.skill <= 0 &&
        this.random() < 0.58
      ) input.skill = true;
    }
    const supplies=(state.supplies||[]).filter(s=>s.active&&!s.contested);
    if(self.energy<45&&distance>5&&supplies.length){
      const closest=supplies.reduce((a,b)=>Math.abs(a.x-self.x)<Math.abs(b.x-self.x)?a:b);
      input[closest.x>self.x?'right':'left']=true;
    }
    if (distance > comfortable + 0.5&&!Object.keys(input).length) input[toward] = true;
    else if (ranged && distance < 2.8 && self.x > game.map.bounds.left + 1 && self.x < game.map.bounds.right - 1)
      input[away] = true;
    const threat = state.projectiles.find(p => p.owner !== self.id &&
      Math.abs(p.x - self.x) < 7 && (self.x - p.x) * p.vx > 0);
    if (self.grounded && threat && this.random() < 0.7) {
      if (threat.y > 2.4) { input.crouch = true; delete input[toward]; delete input[away]; }
      else input.jump = true;
    } else if (self.grounded && distance < 5 && this.random() < 0.09) input.jump = true;

    const defending=self.grounded&&rival.currentMove&&distance<6&&this.random()<.4;
    if(defending){delete input[toward];delete input.jump;delete input.crouch;input[away]=true;
      const move=rival.currentMove.move;
      const overhead=!rival.grounded&&move.kind!=='projectile';
      if(!overhead&&(move.hitY??move.height??1.35)<.9)input.crouch=true;
    }
    const usable = (key, context) => {
      const move = selectMove(self.character, key, context);
      return self.cooldowns[key] <= 0 && self.energy >= move.cost;
    };
    const context = moveContext(self, input, rival, !!input.jump);
    const ultimate = selectMove(self.character, "ultimate", context);
    const ultimateRange = ultimate.kind === "projectile" ? 16 : ultimate.range * 0.85;
    if (!defending && !self.currentMove && self.stun <= 0) {
      if (distance < ultimateRange && distance > 1.2 && usable("ultimate", context) && this.random() < 0.32) {
        input.ultimate = true;
      } else if (distance < selectMove(self.character, "attack", context).range * 0.95 && usable("attack", context) && this.random() < 0.8) {
        input.attack = true;
      } else if (usable("skill", context) && distance < 14 && this.random() < 0.65) {
        // Select a forward dash at middle distance; use standing ranged moves from afar.
        if (distance > 7 && ranged) { delete input[toward]; delete input[away]; }
        const skill = selectMove(self.character, "skill", moveContext(self, input, rival, !!input.jump));
        const reach = skill.kind === "dash" ? 8 : skill.range;
        if (distance < reach) input.skill = true;
      }
    }
    this.movement = Object.fromEntries(Object.entries(input).filter(([key]) => ["left", "right", "crouch"].includes(key)));
    return input;
  }
}
