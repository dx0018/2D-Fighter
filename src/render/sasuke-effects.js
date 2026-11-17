import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const glow = (color, opacity=1) => new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending});
function mergeGroup(group) {
  const groups = new Map();
  group.updateMatrixWorld(true);
  group.traverse(node => {
    if (!node.isMesh) return;
    const list = groups.get(node.material) || [];
    const geo = node.geometry.clone().applyMatrix4(node.matrixWorld);
    list.push(geo);groups.set(node.material,list);
  });
  const root=new THREE.Group();
  for(const [material,geos] of groups){root.add(new THREE.Mesh(mergeGeometries(geos,false),material));for(const geo of geos)geo.dispose();}
  // Source pieces are temporary; dispose once after merging.
  const source=new Set();group.traverse(n=>{if(n.geometry)source.add(n.geometry);});source.forEach(g=>g.dispose());
  return root;
}
export function makeSusanooSkeleton() {
  const bone = new THREE.MeshStandardMaterial({color:"#a77bff",emissive:"#7934d1",emissiveIntensity:.65,roughness:.55,transparent:true,opacity:.5,depthWrite:false});
  const dark = new THREE.MeshBasicMaterial({color:"#301047",transparent:true,opacity:.8,depthWrite:false});
  const eye = glow("#ffe7ff",.95);
  const root = new THREE.Group(), raw = new THREE.Group();
  function sphere(g,p,s,mat=bone){const m=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat);m.position.set(...p);m.scale.set(...s);g.add(m);return m;}
  function link(g,a,b,r=.065,mat=bone){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.82,r,delta.length(),8),mat);
    m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(m);
  }
  function curve(g,points,r=.055){const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),14,r,6,false),bone);g.add(mesh);}
  for(let i=0;i<11;i++)sphere(raw,[0,1.9+i*.18,-.16],[.105,.10,.13]);
  for(let i=0;i<6;i++)for(const side of [-1,1]){
    const y=3.68-i*.22,w=.88-i*.055;
    curve(raw,[[0,y,-.17],[side*w*.7,y+.10,-.05],[side*w,y-.02,.28],[side*w*.68,y-.18,.62],[side*.10,y-.19,.69]]);
  }
  link(raw,[-1.05,3.78,0],[0,3.9,-.1],.09);link(raw,[1.05,3.78,0],[0,3.9,-.1],.09);
  sphere(raw,[0,4.35,-.05],[.39,.43,.30]);sphere(raw,[0,4.04,.05],[.29,.16,.23]);
  for(const side of [-1,1]){
    sphere(raw,[side*.15,4.38,.215],[.12,.14,.055],dark);
    sphere(raw,[side*.15,4.40,.265],[.055,.043,.022],eye);
    for(let i=0;i<4;i++)link(raw,[side*(.035+i*.058),4.13,.23],[side*(.035+i*.058),4.03,.23],.02);
  }
  sphere(raw,[0,4.22,.25],[.055,.075,.035],dark);
  root.add(mergeGroup(raw));
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=new THREE.Group();shoulder.position.set(side*1.08,3.76,0);root.add(shoulder);
    const upperRaw=new THREE.Group();sphere(upperRaw,[0,0,0],[.22,.22,.2]);
    link(upperRaw,[0,-.13,0],[side*.12,-1.02,0],.105);sphere(upperRaw,[side*.12,-1.05,0],[.15,.14,.14]);shoulder.add(mergeGroup(upperRaw));
    const forearm=new THREE.Group();forearm.position.set(side*.12,-1.05,0);shoulder.add(forearm);
    const lowerRaw=new THREE.Group();
    link(lowerRaw,[-.06,-.06,0],[-.09,-.90,0],.06);link(lowerRaw,[.06,-.06,0],[.09,-.90,0],.06);
    sphere(lowerRaw,[0,-.99,0],[.19,.23,.12]);
    for(let i=0;i<5;i++){
      const x=(i-2)*.085;
      curve(lowerRaw,[[x,-1.08,0],[x*1.5,-1.30,.035],[x*1.55,-1.48,.13],[x*1.4,-1.56,.21]],.026);
    }
    forearm.add(mergeGroup(lowerRaw));arms.push({shoulder,forearm});
  }
  const blade=new THREE.Mesh(new THREE.ConeGeometry(.13,2.8,4),glow("#d4acff",.85));
  blade.position.set(0,-1.1,1.35);blade.rotation.x=Math.PI/2;arms[1].forearm.add(blade);
  root.visible=false;
  return {root,arms,materials:[bone,dark,eye,blade.material]};
}
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
export function makeSasukeEffects() {
  const skeleton=makeSusanooSkeleton();
  const sword=new THREE.Mesh(new THREE.BoxGeometry(.065,1.15,.035),new THREE.MeshStandardMaterial({color:"#dbe1ff",metalness:.6,roughness:.3}));sword.visible=false;
  const slash=new THREE.Mesh(new THREE.TorusGeometry(2.1,.055,5,40,Math.PI*.8),glow("#d6b1ff",.8));slash.visible=false;
  const lightning=new THREE.Group();
  const mat=glow("#b7e1ff");
  for(let i=0;i<7;i++){
    const points=[];for(let j=0;j<5;j++)points.push(new THREE.Vector3((j/4-.5)*.65,Math.sin(i*2+j*3)*.23,Math.cos(i+j*2)*.2));
    lightning.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:"#a5d8ff",transparent:true,opacity:.95,toneMapped:false})));
  }
  const core=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),mat);lightning.add(core);lightning.visible=false;
  const charge=makeSasukeProjectile("susanoo-arrow");charge.visible=false;
  const string=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:"#f0d5ff",transparent:true,opacity:.8,toneMapped:false}));string.visible=false;
  return {skeleton,sword,slash,lightning,charge,string};
}
