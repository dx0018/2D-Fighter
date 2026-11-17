import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function batch(raw) {
  raw.updateMatrixWorld(true);
  const groups = new Map(), originals = new Set();
  raw.traverse(node => {
    if (!node.isMesh) return;
    const parts = groups.get(node.material) || [];
    const transformed = node.geometry.clone().applyMatrix4(node.matrixWorld);
    if (transformed.index) {
      parts.push(transformed.toNonIndexed());transformed.dispose();
    } else parts.push(transformed);
    groups.set(node.material, parts);originals.add(node.geometry);
  });
  const root = new THREE.Group();
  for (const [material, parts] of groups) {
    root.add(new THREE.Mesh(mergeGeometries(parts, false), material));
    parts.forEach(part => part.dispose());
  }
  originals.forEach(geometry => geometry.dispose());
  return root;
}

/** Sculpted skeletal guardian: a horned skull, open ribs and articulated claw arms. */
export function makeSusanooSkeleton() {
  const bone = new THREE.MeshStandardMaterial({
    color:"#8e62c9", emissive:"#4f247c", emissiveIntensity:0.55,
    roughness:0.48, metalness:0.05, transparent:true, opacity:0.7, depthWrite:true,
  });
  const edge = new THREE.MeshStandardMaterial({
    color:"#d7b9ff", emissive:"#9460d2", emissiveIntensity:0.45,
    roughness:0.4, transparent:true, opacity:0.7, depthWrite:false,
  });
  const dark = new THREE.MeshBasicMaterial({color:"#250b3c",transparent:true,opacity:0.95,depthWrite:false});
  const eye = new THREE.MeshBasicMaterial({color:"#ffd7a2",transparent:true,opacity:1,depthWrite:false,toneMapped:false});
  const energy = new THREE.MeshBasicMaterial({color:"#cda2ff",transparent:true,opacity:0.3,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const materials=[bone,edge,dark,eye,energy];
  const root=new THREE.Group(), torso=new THREE.Group();
  const sphere=(g,p,s,mat=bone)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),mat);
    mesh.position.set(...p);mesh.scale.set(...s);g.add(mesh);return mesh;
  };
  const curve=(g,points,r=.065,mat=bone)=>{
    const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),22,r,8,false);
    const mesh=new THREE.Mesh(geometry,mat);g.add(mesh);return mesh;
  };
  const spike=(g,points,r,mat=bone)=>{
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const positions=[],indices=[],n=20,sides=8;
    const frames=path.computeFrenetFrames(n,false);
    for(let i=0;i<=n;i++){
      const p=path.getPointAt(i/n),radius=Math.max(.001,r*(1-i/n)**.75);
      for(let j=0;j<sides;j++){
        const a=j/sides*Math.PI*2;
        const v=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*radius).addScaledVector(frames.binormals[i],Math.sin(a)*radius);
        positions.push(v.x,v.y,v.z);
        if(i<n){const k=i*sides+j,next=i*sides+(j+1)%sides;indices.push(k,next,k+sides,next,next+sides,k+sides);}
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    // Match the other sculpt pieces so rigid batches can retain their UV layout.
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
    g.add(new THREE.Mesh(geometry,mat));
  };
  const link=(g,a,b,r=.085,mat=bone)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),length=start.distanceTo(end);
    const profile=[[r*.7,0],[r*1.25,.06],[r,.14],[r*.7,length*.45],[r*.78,length*.8],[r*1.22,length-.05],[r*.8,length]];
    const geometry=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),10);
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.copy(start);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());g.add(mesh);
  };
  const plate=(g,points,z,mat=bone,depth=.055)=>{
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.015,bevelSize:.018,bevelSegments:2,steps:1});
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.z=z;g.add(mesh);return mesh;
  };
  // Tapered spine and broad, open ribs frame Sasuke rather than filling his silhouette.
  for(let i=0;i<12;i++){
    sphere(torso,[0,1.85+i*.17,-.2],[.115,.085,.14]);
    spike(torso,[[0,1.88+i*.17,-.24],[0,1.92+i*.17,-.43],[0,1.98+i*.17,-.48]],.07);
  }
  for(let i=0;i<6;i++)for(const side of [-1,1]){
    const y=3.77-i*.24,w=1.02-i*.065;
    const points=[[0,y,-.22],[side*w*.72,y+.04,-.17],[side*w,y-.08,.16],[side*w*.86,y-.24,.5],[side*.16,y-.23,.66]];
    curve(torso,points,.077+(5-i)*.004);
    curve(torso,points.map(([x,y,z])=>[x,y+.035,z+.018]),.018,edge);
  }
  for(const side of [-1,1]){
    link(torso,[side*1.12,3.83,0],[side*.36,4.02,-.07],.105);
    link(torso,[side*.36,4.02,-.07],[0,3.85,.42],.075,edge);
    plate(torso,[[side*.22,3.96],[side*.5,3.62],[side*.26,3.35],[0,3.75]],-.27);
  }
  link(torso,[0,3.85,-.14],[0,4.23,-.14],.13);
  // Brow, cheek blades, a narrow jaw and fangs replace the round toy-like skull.
  sphere(torso,[0,4.65,-.04],[.39,.39,.31]);
  sphere(torso,[0,4.30,.03],[.255,.19,.23]);
  plate(torso,[[-.28,4.48],[-.33,4.32],[-.19,4.14],[.19,4.14],[.33,4.32],[.28,4.48]],.08);
  plate(torso,[[-.19,4.37],[-.17,4.22],[.17,4.22],[.19,4.37]],.27,dark,.01);
  for(const side of [-1,1]){
    spike(torso,[[side*.29,4.83,-.05],[side*.46,4.99,-.12],[side*.61,5.28,-.2]],.12);
    plate(torso,[[side*.035,4.72],[side*.34,4.83],[side*.39,4.65],[side*.14,4.59]],.20,bone);
    plate(torso,[[side*.065,4.64],[side*.32,4.71],[side*.28,4.53],[side*.11,4.51]],.289,dark,.012);
    plate(torso,[[side*.10,4.60],[side*.285,4.66],[side*.25,4.595],[side*.13,4.565]],.319,eye,.006);
    spike(torso,[[side*.32,4.55,.18],[side*.40,4.37,.18],[side*.28,4.25,.28]],.08,edge);
    for(let i=0;i<3;i++){
      link(torso,[side*(.045+i*.065),4.35,.31],[side*(.045+i*.065),4.25,.31],.022,edge);
    }
    spike(torso,[[side*.20,4.35,.32],[side*.22,4.22,.34],[side*.19,4.16,.35]],.035,edge);
  }
  plate(torso,[[0,4.57],[-.055,4.42],[.055,4.42]],.32,dark,.008);
  root.add(batch(torso));
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=new THREE.Group();shoulder.position.set(side*1.15,3.84,0);root.add(shoulder);
    const upper=new THREE.Group();
    sphere(upper,[0,0,0],[.24,.22,.23]);
    link(upper,[0,-.08,0],[side*.12,-1.04,0],.11);
    plate(upper,[[-.26,.02],[0,.23],[.27,.06],[.24,-.27],[.08,-.40],[-.20,-.24]],-.08,edge);
    spike(upper,[[side*.12,.03,-.1],[side*.38,.12,-.15],[side*.48,.32,-.17]],.095);
    sphere(upper,[side*.12,-1.05,0],[.15,.15,.16],edge);
    shoulder.add(batch(upper));
    const forearm=new THREE.Group();forearm.position.set(side*.12,-1.05,0);shoulder.add(forearm);
    const lower=new THREE.Group();
    link(lower,[-.07,-.04,0],[-.10,-.86,0],.065);
    link(lower,[.07,-.04,0],[.10,-.86,0],.065);
    spike(lower,[[side*.12,-.3,-.04],[side*.29,-.55,-.06],[side*.15,-.86,-.04]],.09,edge);
    sphere(lower,[0,-.94,0],[.18,.10,.11]);
    for(let i=0;i<5;i++){
      const x=(i-2)*.085;
      link(lower,[x*.65,-.96,0],[x*1.15,-1.15,.015],.035);
      spike(lower,[[x*1.15,-1.14,.015],[x*1.55,-1.35,.06],[x*1.48,-1.54,.19],[x*1.2,-1.58,.28]],.038,edge);
    }
    forearm.add(batch(lower));arms.push({shoulder,forearm});
  }
  const bladeRaw=new THREE.Group();
  plate(bladeRaw,[[-.11,0],[-.18,2.35],[0,2.90],[.18,2.35],[.11,0]],-.035,edge,.07);
  plate(bladeRaw,[[-.035,.1],[-.065,2.37],[0,2.76],[.065,2.37],[.035,.1]],.045,energy,.008);
  link(bladeRaw,[0,-.33,0],[0,.06,0],.065);
  link(bladeRaw,[-.27,.02,0],[.27,.02,0],.035,edge);
  const blade=batch(bladeRaw);blade.position.set(0,-1.15,.15);blade.rotation.x=Math.PI/2;
  arms[1].forearm.add(blade);
  root.visible=false;
  return {root,arms,materials};
}
