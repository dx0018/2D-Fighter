import { poseSusanooArchery } from "./susanoo-archery.js";
import * as THREE from "three";
import { aimChain, resetBones } from "./articulated-pose.js";
import { recoveryMovement } from "../game/moves.js";
import { sampleSkillMotion } from "./skill-motion.js";
const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
const pos = new THREE.Vector3();
const target = new THREE.Vector3();
const bladeAxis = new THREE.Vector3(0, 1, 0);
const right = new THREE.Vector3();

const poses = {
  "sword-slash": { lead: [[.48, 2.32, -.20], [-.25, 1.92, .81]], support: [[.28, 1.82, .33], [.65, 1.61, .08]], lean: .13, twist: .38 },
  "susanoo-slash": { lead: [[.59, 2.35, -.06], [-.15, 1.94, .78]], support: [[.24, 1.80, .34], [.64, 1.63, -.18]], lean: .2, twist: .36 },
  chidori: { lead: [[.37, 1.62, .10], [.19, 1.83, 1.0]], support: [[.07, 1.67, .33], [.68, 1.58, -.22]], lean: .32, twist: .2 },
  fireball: { lead: [[.11, 2.33, .43], [.22, 2.30, .48]], support: [[.12, 2.28, .40], [.66, 1.85, -.1]], lean: .23 },
  "susanoo-guard": { lead: [[.17, 1.65, .35], [.54, 1.65, .4]], support: [[.17, 1.65, .35], [.54, 1.65, .4]], lean: .20 },
  "susanoo-arrow": { lead: [[.16, 2.04, .45], [.27, 1.95, .68]], support: [[.14, 2.04, .43], [.40, 1.82, .31]], lean: .10 },
};

export function animateSasuke(m,f,dt,clock,opponent=null) {
  const cast = f.currentMove, move = cast?.move, elapsed = cast?.elapsed || 0;
  const face = cast?.facing ?? f.facing ?? 1;
  const motion = cast && sampleSkillMotion(cast);
  const pose = poses[move?.visual];
  const visual=move?.visual, windup=move?.windup||1, active=move?.active||.1;
  const front = face > 0 ? "L" : "R";
  const lunge = visual === "chidori" ? motion.weight * (.25 + .75 * motion.strike) : 0;
  const walking=f.grounded&&!f.crouching&&(f.action==='walk'||recoveryMovement(cast));
  m.sasukeWalk=THREE.MathUtils.damp(m.sasukeWalk||0,walking?1:0,15,dt);
  m.sasukeCrouch=THREE.MathUtils.damp(m.sasukeCrouch||0,f.crouching?1:0,18,dt);
  m.sasukeDefeat=THREE.MathUtils.damp(m.sasukeDefeat||0,f.action==='defeat'?1:0,12,dt);
  resetBones(m.bones);
  m.root.position.set(f.x,Math.max(0,f.y),0);
  m.visual.rotation.y=THREE.MathUtils.damp(m.visual.rotation.y,face*.95,18,dt);
  const hips=m.bones.Hips;
  hips.position.y -= m.sasukeCrouch * .42 + m.sasukeDefeat * .35 +
    Math.min(.08, (f.landingTimer || 0) * .5) * (f.landingImpact || 0) + .17 * lunge;
  hips.rotation.x += .24 * lunge;
  const phase=(f.walkDistance||0)*Math.PI*2/2.6;
  m.bones.Chest.rotation.x += Math.sin(clock * 2.5) * .008 + m.sasukeDefeat * .3;
  if (pose) {
    m.bones.Chest.rotation.x += (pose.lean ?? 0) * motion.weight * (visual === "fireball" && !f.grounded ? 1.6 : 1);
    m.bones.Chest.rotation.y += face * (pose.twist ?? 0) * motion.weight * (1 - 2 * motion.sweep);
  }
  m.root.updateMatrixWorld(true);
  for(const [i,side,label] of [[0,1,'L'],[1,-1,'R']]) {
    const t=phase+i*Math.PI;
    const ankle=[side*.26,.18+Math.max(0,Math.sin(t))*.18*m.sasukeWalk,Math.cos(t)*.34*m.sasukeWalk];
    if(!f.grounded){ankle[1]=.42+i*.12;ankle[2]=i?-.24:.22;}
    ankle[2] += (label === front ? .35 : -.44) * lunge;
    if (label !== front) ankle[1] += .07 * lunge;
    aimChain(m,m.visual,m.bones,['Thigh_'+label,'Shin_'+label,'Foot_'+label],ankle,[0,0,1],true);
  }
  const attack=cast?.key==='attack';
  for(const [side,label] of [[1,'L'],[-1,'R']]){
    let target=[side*.50,1.95-m.sasukeCrouch*.22,.33-Math.cos(phase+(side>0?0:Math.PI))*.20*m.sasukeWalk];
    target[1]-=m.sasukeDefeat*.65;
    if(f.action==='victory'&&label==='R')target=[-.30,2.8,.3];
    if(!f.grounded)target=[side*.64,2.0,.25];
    if (f.guarding && !cast) target = [side * .2, 2.2, .5];
    if (pose) {
      const [prepare, release] = label === front ? pose.lead : pose.support;
      const height = attack ? m.sasukeCrouch * .84 : 0;
      const aim = motion.sweep;
      target = target.map((base, i) => {
        const point = THREE.MathUtils.lerp(prepare[i], release[i], aim);
        const adjusted = i === 0 ? point * side : i === 1 ? point - height : point;
        return THREE.MathUtils.lerp(base, adjusted, motion.weight);
      });
    }
    aimChain(m,m.visual,m.bones,['UpperArm_'+label,'Forearm_'+label,'Hand_'+label],target,[side*.7,-.2,.5]);
  }
  const fx=m.sasukeFx;
  const summon=['susanoo-slash','susanoo-guard'].includes(visual);
  const fade=cast?1-smooth(windup+active,windup+active+(move.recovery||.3),elapsed):0;
  fx.skeleton.root.visible=summon;
  if(summon){
    fx.skeleton.root.position.set(-face*.2,visual==='susanoo-guard'?-.5:0,-.65);
    fx.skeleton.root.quaternion.copy(m.visual.quaternion);
    const opacity=smooth(0,.16,elapsed)*fade;
    for(const mat of fx.skeleton.materials){mat.userData.baseOpacity??=mat.opacity;mat.opacity=mat.userData.baseOpacity*opacity;}
    const swing=smooth(windup*.65,windup+active,elapsed);
    fx.skeleton.arms[1].shoulder.rotation.set(-.55,1.25-swing*2.4,-.3);
    fx.skeleton.arms[1].forearm.rotation.x=.3;
    fx.skeleton.arms[0].shoulder.rotation.x=-.25;
  }
  const slashStart = windup * .82;
  const slashEnd = windup + active;
  const slashOpacity = smooth(slashStart, windup, elapsed) * (1 - smooth(windup, slashEnd, elapsed));
  fx.slash.visible = (visual === "susanoo-slash" || attack) && slashOpacity > .015;
  if(fx.slash.visible){
    fx.slash.position.set(face * (attack ? 1.05 : 2.05), attack ? 1.75 - m.sasukeCrouch * .85 : 1.85, .24);
    fx.slash.scale.setScalar(attack ? .55 : 1);
    fx.slash.rotation.set(0,face<0?Math.PI:0,-1.2+smooth(windup*.8,windup+active,elapsed)*1.5);
    fx.slash.material.opacity = slashOpacity * .87;
  }
  const hand = m.bones["Hand_" + front];
  m.skillOriginActive = false;
  fx.sword.visible = !!attack;
  if (fx.sword.visible) {
    hand.getWorldPosition(pos);
    m.root.worldToLocal(pos);
    const draw = motion.sweep;
    const blade = right.set(face * (-.55 + draw * 1.5), .82 - draw * 1.15, .28 + draw * .35).normalize();
    fx.sword.position.copy(pos).addScaledVector(blade, .49);
    fx.sword.quaternion.setFromUnitVectors(bladeAxis, blade);
  }
  fx.lightning.visible = visual === "chidori" && elapsed < windup + active;
  if (fx.lightning.visible) {
    hand.getWorldPosition(m.skillOrigin);
    m.skillOrigin.x += face * .12;
    fx.lightning.position.copy(m.skillOrigin);
    m.root.worldToLocal(fx.lightning.position);
    fx.lightning.rotation.set(clock * 8, clock * 11, 0);
    fx.lightning.scale.setScalar((.22 + .78 * smooth(0, windup, elapsed)) * (1 - .4 * motion.recoil));
    m.skillOriginActive = true;
  }
  if (visual === "fireball") {
    m.bones.Head.getWorldPosition(m.skillOrigin);
    target.set(0, -.12, .18).applyQuaternion(m.visual.quaternion);
    m.skillOrigin.add(target).addScaledVector(right.set(face, move.angle ? -.32 : 0, 0), .27);
    m.skillOriginActive = true;
  }
  const full=visual==='susanoo-arrow';
  if(!summon)fx.skeleton.root.visible=full&&!m.fullSusanoo;
  if(m.fullSusanoo)m.fullSusanoo.visible=full;
  fx.charge.visible=full&&elapsed<windup;
  fx.string.visible=full&&!!m.fullSusanoo&&elapsed<windup;
  fx.bow.visible=false;
  if(full) poseSusanooArchery(m,f,cast,opponent,fade);
  const hurt=Math.min(1,(f.flash||0)*5);
  for(const mat of m.materials){if(mat.emissive){mat.emissive.set(hurt?'#ff876e':'#000000');mat.emissiveIntensity=hurt*.7;}}
}
