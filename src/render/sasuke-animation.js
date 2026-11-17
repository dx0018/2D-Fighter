import * as THREE from "three";
import { aimChain, resetBones } from "./articulated-pose.js";
import { recoveryMovement } from "../game/moves.js";
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
const pos=new THREE.Vector3();

export function animateSasuke(m,f,dt,clock) {
  const face=f.facing||1, cast=f.currentMove, move=cast?.move, elapsed=cast?.elapsed||0;
  const visual=move?.visual, windup=move?.windup||1, active=move?.active||.1;
  const walking=f.grounded&&!f.crouching&&(f.action==='walk'||recoveryMovement(cast));
  m.sasukeWalk=THREE.MathUtils.damp(m.sasukeWalk||0,walking?1:0,15,dt);
  m.sasukeCrouch=THREE.MathUtils.damp(m.sasukeCrouch||0,f.crouching?1:0,18,dt);
  m.sasukeDefeat=THREE.MathUtils.damp(m.sasukeDefeat||0,f.action==='defeat'?1:0,12,dt);
  resetBones(m.bones);
  m.root.position.set(f.x,Math.max(0,f.y),0);
  m.visual.rotation.y=THREE.MathUtils.damp(m.visual.rotation.y,face*.95,18,dt);
  const hips=m.bones.Hips;
  hips.position.y-=m.sasukeCrouch*.42+m.sasukeDefeat*.35;
  const phase=(f.walkDistance||0)*Math.PI*2/2.6;
  m.bones.Chest.rotation.x+=Math.sin(clock*2.5)*.008+(visual==='chidori'?-.15:0)+m.sasukeDefeat*.3;
  m.root.updateMatrixWorld(true);
  for(const [i,side,label] of [[0,1,'L'],[1,-1,'R']]) {
    const t=phase+i*Math.PI;
    const ankle=[side*.26,.18+Math.max(0,Math.sin(t))*.18*m.sasukeWalk,Math.cos(t)*.34*m.sasukeWalk];
    if(!f.grounded){ankle[1]=.42+i*.12;ankle[2]=i?-.24:.22;}
    aimChain(m,m.visual,m.bones,['Thigh_'+label,'Shin_'+label,'Foot_'+label],ankle,[0,0,1],true);
  }
  const attack=cast?.key==='attack';
  const extension=attack?smooth(0,windup,elapsed)*(1-smooth(windup+active,windup+active+(move.recovery||.2),elapsed)):0;
  const front=face>0?'L':'R';
  for(const [side,label] of [[1,'L'],[-1,'R']]){
    let target=[side*.50,1.95-m.sasukeCrouch*.22,.33-Math.cos(phase+(side>0?0:Math.PI))*.20*m.sasukeWalk];
    target[1]-=m.sasukeDefeat*.65;
    if(f.action==='victory'&&label==='R')target=[-.30,2.8,.3];
    if(!f.grounded)target=[side*.64,2.0,.25];
    if(attack&&label===front)target=[side*.25,1.9-m.sasukeCrouch*.75,.4+extension*.7];
    if(visual==='fireball')target=[side*.12,2.35,.42];
    if(visual==='susanoo-arrow')target=[side*.12,1.95,.5];
    if(visual==='susanoo-slash')target=[side*.30,2.1,.6];
    if(visual==='chidori'&&label===front)target=[side*.18,1.85,.95];
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
  fx.slash.visible=(visual==='susanoo-slash'&&elapsed>windup*.8&&elapsed<windup+active+.1)||(attack&&extension>.45);
  if(fx.slash.visible){
    fx.slash.position.set(face*(attack?1.2:2.1),attack?1.65:1.85,.15);
    fx.slash.scale.setScalar(attack ? .55 : 1);
    fx.slash.rotation.set(0,face<0?Math.PI:0,-1.2+smooth(windup*.8,windup+active,elapsed)*1.5);
    fx.slash.material.opacity=fade*.8;
  }
  const hand=m.bones['Hand_'+front];
  fx.sword.visible=!!attack;
  fx.lightning.visible=visual==='chidori'&&elapsed<windup+active;
  if(fx.sword.visible||fx.lightning.visible){
    hand.getWorldPosition(pos);m.root.worldToLocal(pos);
    fx.sword.position.copy(pos);fx.sword.position.y+=.3;fx.sword.rotation.set(.5,0,-face*(.4+extension));
    fx.lightning.position.copy(pos);fx.lightning.rotation.set(clock*8,clock*11,0);
  }
  const full=visual==='susanoo-arrow';
  const fullRoot=m.fullSusanoo||fx.skeleton.root;
  if(!summon)fx.skeleton.root.visible=full&&!m.fullSusanoo;
  if(m.fullSusanoo)m.fullSusanoo.visible=full;
  fx.charge.visible=full&&elapsed<windup;
  fx.string.visible=full&&!!m.fullSusanoo&&elapsed<windup;
  if(full){
    fullRoot.position.set(-face*.65,.015-Math.max(0,f.y),-1.35);
    fullRoot.rotation.set(0,face*Math.PI/2,0);
    for(const mat of m.fullMaterials||[]){mat.opacity=.8*smooth(0,.22,elapsed)*fade;}
    if(!m.fullSusanoo)for(const mat of fx.skeleton.materials){
      mat.userData.baseOpacity??=mat.opacity;
      mat.opacity=mat.userData.baseOpacity*smooth(0,.22,elapsed)*fade;
    }
    if(m.fullBones){
      resetBones(m.fullBones);
      const draw=smooth(.15,windup,elapsed);
      aimChain(m,fullRoot,m.fullBones,['UpperArm_L','Forearm_L','Hand_L'],[.65,3.25,1.3],[1,0,.5]);
      aimChain(m,fullRoot,m.fullBones,['UpperArm_R','Forearm_R','Hand_R'],[-.35,3.25,.9-draw*.65],[-1,0,.5]);
      // A taut, drawn energy string makes the charging phase readable.
      const vertices=fx.string.geometry.attributes.position;
      for(const [i,p] of [[0,[.65,4.75,1.3]],[1,[-.35,3.25,.9-draw*.65]],[2,[.65,1.75,1.3]]]){
        pos.set(...p);fullRoot.localToWorld(pos);m.root.worldToLocal(pos);vertices.setXYZ(i,pos.x,pos.y,pos.z);
      }
      vertices.needsUpdate=true;
    }
    fx.charge.position.set(face*1.3,3.05,.05);
    fx.charge.rotation.set(0,0,face>0?-.12:Math.PI+.12);
    fx.charge.scale.setScalar(.25+.6*smooth(.1,windup,elapsed));
  }
  const hurt=Math.min(1,(f.flash||0)*5);
  for(const mat of m.materials){if(mat.emissive){mat.emissive.set(hurt?'#ff876e':'#000000');mat.emissiveIntensity=hurt*.7;}}
}
