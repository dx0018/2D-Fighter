import * as THREE from "three";
import { makeSusanooSkeleton } from "./susanoo-skeleton.js";
export { makeSusanooSkeleton } from "./susanoo-skeleton.js";

const glow = (color, opacity=1) => new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});
export function makeSasukeProjectile(kind) {
  const root=new THREE.Group();
  if(kind==="susanoo-arrow"){
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,2.7,8),glow("#eddaff"));shaft.rotation.z=-Math.PI/2;root.add(shaft);
    const head=new THREE.Mesh(new THREE.ConeGeometry(.26,.72,4),glow("#c197ff"));head.rotation.z=-Math.PI/2;head.position.x=1.65;root.add(head);
    const aura=new THREE.Mesh(new THREE.CylinderGeometry(.15,.27,3.4,8),glow("#8d45ff",.3));aura.rotation.z=-Math.PI/2;root.add(aura);
    for(const angle of [0,Math.PI/2]){
      const fin=new THREE.Mesh(new THREE.PlaneGeometry(.65,.42),glow("#bb8aff",.8));fin.position.x=-1.15;fin.rotation.x=angle;root.add(fin);
    }
    for (const part of root.children) part.position.x -= 1.5;
  }else{
    const core=new THREE.Mesh(new THREE.SphereGeometry(.48,16,12),glow("#ffd98b"));root.add(core);
    const shell=new THREE.Mesh(new THREE.SphereGeometry(.65,14,10),glow("#ff591d",.5));root.add(shell);
    for(let i=0;i<5;i++){
      const flame=new THREE.Mesh(new THREE.ConeGeometry(.26,.95,7),glow(i%2?"#ff7722":"#ffb347",.6));
      flame.rotation.z=Math.PI/2;flame.position.set(-.55-i*.17,Math.sin(i*2.4)*.26,Math.cos(i*2.4)*.26);root.add(flame);
    }
  }
  return root;
}
function makeSusanooBow() {
  const root = new THREE.Group();
  const points = [[-.25,-1.3,0],[.12,-.8,0],[0,0,0],[.12,.8,0],[-.25,1.3,0]];
  const curve = new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const body = new THREE.Mesh(new THREE.TubeGeometry(curve,32,.075,8),glow("#a579ff",.55));
  const core = new THREE.Mesh(new THREE.TubeGeometry(curve,32,.027,6),glow("#e8d6ff",.85));
  root.add(body,core);
  const top=new THREE.Object3D(), bottom=new THREE.Object3D();
  top.position.set(...points[4]);bottom.position.set(...points[0]);root.add(top,bottom);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(18*3),3));
  const motes=new THREE.Points(geometry,new THREE.PointsMaterial({color:"#bf8dff",size:.055,transparent:true,opacity:.65,depthWrite:false,toneMapped:false}));
  motes.frustumCulled=false;root.add(motes);
  root.userData={top,bottom,motes,materials:[body.material,core.material]};root.visible=false;
  return root;
}

export function makeSasukeEffects() {
  const skeleton=makeSusanooSkeleton();
  const sword=new THREE.Mesh(new THREE.BoxGeometry(.065,1.15,.035),new THREE.MeshStandardMaterial({color:"#dbe1ff",metalness:.6,roughness:.3}));sword.visible=false;
  const gripMaterial = new THREE.MeshStandardMaterial({color:"#292333", roughness:.74});
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.045,.048,.24,10), gripMaterial);
  grip.position.y = -.49;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(.23,.035,.095), gripMaterial);
  guard.position.y = -.36;
  sword.add(grip, guard);
  const slash=new THREE.Mesh(new THREE.TorusGeometry(2.1,.055,5,40,Math.PI*.8),glow("#d6b1ff",.8));slash.visible=false;
  const lightning=new THREE.Group();
  const mat=glow("#b7e1ff");
  for(let i=0;i<7;i++){
    const points=[];for(let j=0;j<5;j++)points.push(new THREE.Vector3((j/4-.5)*.65,Math.sin(i*2+j*3)*.23,Math.cos(i+j*2)*.2));
    lightning.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:"#a5d8ff",transparent:true,opacity:.95,toneMapped:false})));
  }
  const core=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),mat);lightning.add(core);lightning.visible=false;
  const bow=makeSusanooBow();
  const charge=makeSasukeProjectile("susanoo-arrow");charge.visible=false;
  const string=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:"#f0d5ff",transparent:true,opacity:.8,toneMapped:false}));string.visible=false;
  return {skeleton,sword,slash,lightning,charge,string,bow};
}
