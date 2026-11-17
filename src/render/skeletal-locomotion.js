import * as THREE from 'three';
import { captureBones, aimChain } from './articulated-pose.js';
import { sampleStep } from './locomotion.js';

export function prepareLocomotion(m) {
  const bones=captureBones(m.model);
  const names=Object.keys(bones);
  const find=(suffix)=>names.find(n=>n===suffix||n.replaceAll(':','').includes(suffix));
  const mix=m.character.model.rig==='mixamo';
  const hips=find(mix?'mixamorigHips':m.character.model.rig==='teletubby'?'Pelvis':'Hips');
  m.root.updateMatrixWorld(true);
  const legs=['L','R'].map((side,index)=>{
    const leg=mix
      ? [find(`mixamorig${index?'Right':'Left'}UpLeg`),find(`mixamorig${index?'Right':'Left'}Leg`),find(`mixamorig${index?'Right':'Left'}Foot`)]
      : [`Thigh_${side}`,`Shin_${side}`,`Foot_${side}`];
    if(leg.some(n=>!bones[n]))throw new Error(`Missing leg chain: ${m.character.id}`);
    const points=leg.map(n=>bones[n].getWorldPosition(new THREE.Vector3()));
    const reach=points[0].distanceTo(points[1])+points[1].distanceTo(points[2]);
    return {names:leg,ankle:m.visual.worldToLocal(points[2].clone()),reach};
  });
  m.locomotion={bones,hips,legs,walk:0,phase:0,lastDistance:0,scratch:new THREE.Vector3()};
}

export function poseLocomotion(m,f,dt,walking) {
  const rig=m.locomotion;if(!rig)return;
  const hip=rig.bones[rig.hips];
  hip.position.copy(hip.userData.bindPose.position);
  for(const leg of rig.legs)for(const name of leg.names){
    const bone=rig.bones[name],rest=bone.userData.bindPose;
    bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);
  }
  rig.walk=THREE.MathUtils.damp(rig.walk,walking?Math.min(1,Math.abs(f.vx)/f.character.speed):0,18,dt);
  const reach=Math.min(...rig.legs.map(l=>l.reach));
  const stride=Math.min(f.character.locomotion?.stride||2.3,reach*2);
  const distance=f.walkDistance||0,delta=distance-rig.lastDistance;
  if(dt>0){
    if(delta>=0&&delta<3)rig.phase+=Math.min(delta/stride,dt*3.5)*Math.PI*2;
    else rig.phase=0;
    rig.lastDistance=distance;
  }
  const crouch=m.crouchBlend||0;
  const takeoff=Math.min(1,(f.jumpStartup||0)/.025);
  const landing=Math.min(1,(f.landingTimer||0)/.16)*(f.landingImpact||0);
  const drop=(m.character.id==='doraemon'?.06:Math.min(.43,reach*.37))*crouch+Math.min(.06,reach*.1)*(takeoff+landing)+Math.min(.018,reach*.015)*(1-Math.cos(rig.phase*2))*rig.walk+Math.min(.09,reach*.1)*rig.walk;
  m.root.updateMatrixWorld(true);
  hip.getWorldPosition(rig.scratch);rig.scratch.y-=drop;
  hip.parent.worldToLocal(rig.scratch);hip.position.copy(rig.scratch);
  for(const [i,leg] of rig.legs.entries()){
    const step=sampleStep(rig.phase+i*Math.PI,stride,Math.min(.17,reach*.16));
    rig.scratch.copy(leg.ankle);m.visual.localToWorld(rig.scratch);
    rig.scratch.x+=step.x*rig.walk*(Math.sign(f.vx)||f.facing||1);
    rig.scratch.y+=step.lift*rig.walk;
    if(!f.grounded){rig.scratch.y+=reach*(i?.25:.18);rig.scratch.x+=(f.facing||1)*reach*(i?-.12:.15);}
    m.visual.worldToLocal(rig.scratch);
    aimChain(m,m.visual,rig.bones,leg.names,[rig.scratch.x,rig.scratch.y,rig.scratch.z],[0,0,m.frontAxis],true);
  }
}
