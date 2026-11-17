import * as THREE from 'three';
/** Small persistent supply pedestals; no dynamic lights or per-frame allocations. */
export function makeSupply(data) {
  const root=new THREE.Group();root.position.set(data.x,0,-.1);
  const material=new THREE.MeshBasicMaterial({color:'#69d6ef',transparent:true,opacity:.55,toneMapped:false,depthWrite:false});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.035,5,32),material);ring.rotation.x=-Math.PI/2;ring.position.y=.045;root.add(ring);
  const coreMaterial=new THREE.MeshStandardMaterial({color:'#a5efff',emissive:'#2989b8',emissiveIntensity:.8,roughness:.25,metalness:.18});
  const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.32),coreMaterial);crystal.position.y=.85;root.add(crystal);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(.46,.018,4,24),material);inner.position.y=.85;root.add(inner);
  return {root,ring,material,crystal,inner,update(state,time){
    crystal.visible=state.active;inner.visible=state.active;
    crystal.position.y=.85+Math.sin(time*2+data.x)*.07;crystal.rotation.y=time;
    inner.rotation.set(time*.5,time*.8,0);
    material.color.set(state.contested?'#ffb26d':state.active?'#8beaff':'#5298ad');
    material.opacity=state.active ? .7 : .2;
    ring.scale.setScalar(state.active?1:.65+.35*(1-state.remaining/state.cycle));
  }};
}
