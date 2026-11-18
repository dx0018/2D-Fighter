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
const gripAxis = new THREE.Vector3(0, 0, 1);
const palmAxis = new THREE.Vector3(1, 0, 0);

function turnWrist(m, hand, axis, direction, weight) {
  hand.getWorldQuaternion(m.worldQuaternion);
  const from = target.copy(axis).applyQuaternion(m.worldQuaternion);
  m.deltaQuaternion.setFromUnitVectors(from, direction);
  m.worldQuaternion.premultiply(m.deltaQuaternion);
  hand.parent.getWorldQuaternion(m.parentQuaternion).invert();
  const rotation = m.parentQuaternion.multiply(m.worldQuaternion);
  hand.quaternion.rotateTowards(rotation, Math.min(hand.quaternion.angleTo(rotation) * weight, .95));
}

const poses = {
  "sword-slash": { lead: [[.61, 2.24, .28], [.22, 1.89, 1.06]], support: [[.28, 1.82, .33], [.65, 1.61, .08]], lean: .13, twist: .38 },
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
  if (pose) {
    const turn = face * (pose.twist ?? .10) * motion.weight;
    hips.rotation.y += turn * (.48 - motion.strike);
    m.bones.Spine.rotation.y += turn * (.38 - motion.sweep * .8);
    if (m.bones.Neck) m.bones.Neck.rotation.y -= turn * (.35 - motion.sweep * .65);
    for (const label of ["L", "R"]) {
      const clavicle = m.bones["Clavicle_" + label];
      if (clavicle) clavicle.rotation.y += (label === front ? 1 : -.55) * face * motion.weight * (.06 - .21 * motion.strike);
    }
  }
  m.root.updateMatrixWorld(true);
  for(const [i,side,label] of [[0,1,'L'],[1,-1,'R']]) {
    const t=phase+i*Math.PI;
    const ankle=[side*.26,.18+Math.max(0,Math.sin(t))*.18*m.sasukeWalk,Math.cos(t)*.34*m.sasukeWalk];
    if (!f.grounded) {
      const tuck = smooth(-5, 5, f.vy || 0);
      ankle[1] += .10 + tuck * (label === front ? .32 : .44);
      ankle[2] += label === front ? .18 + .14 * tuck : -.18 - .12 * tuck;
    }
    ankle[2] += (label === front ? .35 : -.44) * lunge;
    if (label !== front) ankle[1] += .07 * lunge;
    aimChain(m,m.visual,m.bones,['Thigh_'+label,'Shin_'+label,'Foot_'+label],ankle,[0,0,1],true);
  }
  const attack=cast?.key==='attack';
  const workingHand = attack ? "R" : front;
  for(const [side,label] of [[1,'L'],[-1,'R']]){
    let target=[side*.50,1.95-m.sasukeCrouch*.22,.33-Math.cos(phase+(side>0?0:Math.PI))*.20*m.sasukeWalk];
    target[1]-=m.sasukeDefeat*.65;
    if(f.action==='victory'&&label==='R')target=[-.30,2.8,.3];
    if(!f.grounded)target=[side*.64,2.0,.25];
    if (f.guarding && !cast) target = [side * .2, 2.2, .5];
    if (pose) {
      const [prepare, release] = label === workingHand ? pose.lead : pose.support;
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
    const swing = motion.sweep;
    const guarding = visual === "susanoo-guard";
    for (const [i, arm] of fx.skeleton.arms.entries()) {
      const side = i ? 1 : -1;
      const drive = guarding ? motion.strike : i ? swing : .25 * swing;
      arm.shoulder.rotation.set(-.5 - .35 * motion.weight, side * (1.1 - drive * 2.25), side * (.24 + drive * .42));
      arm.forearm.rotation.x = -.72 + drive * .63;
      arm.wrist.rotation.set(.12 - drive * .26, side * (.3 - drive * .57), side * motion.recoil * .13);
    }
    fx.skeleton.blade.visible = !guarding;
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
  const hand = m.bones["Hand_" + workingHand];
  if (pose) {
    for (const label of ["L", "R"]) {
      const grip = attack && label === workingHand;
      const seal = visual === "fireball";
      const open = visual === "chidori" && label === front;
      const side = label === "L" ? 1 : -1;
      const wrist = m.bones["Hand_" + label];
      wrist.rotateY(side * motion.weight * (grip ? .38 : seal ? -.55 : open ? -.78 : 0));
      for (const [i, digit] of ["Thumb", "Index", "Middle", "Ring", "Little"].entries()) {
        const bone = m.bones[digit + "_" + label];
        if (!bone) continue;
        const curl = grip ? (i === 0 ? -.46 : .59 + i * .04) : seal && (i === 0 || i > 2) ? .48 : .055;
        bone.rotateZ(side * motion.weight * curl);
        const tip = m.bones[digit + "Tip_" + label];
        if (tip) tip.rotateZ(side * motion.weight * (grip ? (i === 0 ? -.32 : .84) : curl * .64));
        if (open) bone.rotateX((i - 2) * .11 * motion.weight);
      }
    }
  }
  m.skillOriginActive = false;
  fx.sword.visible = !!attack;
  if (fx.sword.visible) {
    const draw = motion.sweep;
    const blade = right.set(face * (-.55 + draw * 1.5), .82 - draw * 1.15, .28 + draw * .35).normalize();
    turnWrist(m, hand, gripAxis, blade, motion.weight);
    hand.localToWorld(pos.set(.008, .185, -.007));
    m.root.worldToLocal(pos);
    hand.getWorldQuaternion(m.worldQuaternion);
    blade.copy(gripAxis).applyQuaternion(m.worldQuaternion);
    fx.sword.position.copy(pos).addScaledVector(blade, .49);
    fx.sword.quaternion.setFromUnitVectors(bladeAxis, blade);
  }
  fx.lightning.visible = visual === "chidori" && elapsed < windup + active;
  if (fx.lightning.visible) {
    const palmDirection = right.set(face * .38, .30, .87).normalize();
    palmAxis.set(front === "L" ? -1 : 1, 0, 0);
    turnWrist(m, hand, palmAxis, palmDirection, motion.weight);
    hand.localToWorld(m.skillOrigin.set(-face * .045, .17, -.01));
    m.skillOrigin.x += face * .065;
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
  if (fx.slash.visible) {
    const weapon = attack ? fx.sword : fx.skeleton.blade;
    pos.set(0, attack ? .38 : 2.05, 0);
    weapon.localToWorld(pos);
    fx.slash.position.copy(m.root.worldToLocal(pos));
    fx.slash.scale.setScalar(attack ? .30 : .54);
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
