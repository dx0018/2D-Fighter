import test from 'node:test';
import assert from 'node:assert/strict';
import { susanooArchery, SUSANOO_ARCHERY as C } from '../src/game/susanoo-archery.js';
import { Game } from '../src/game/engine.js';
import { sasuke } from '../src/config/sasuke.js';
import { characters, maps } from '../src/config/content.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} vs ${b}`);
for(const facing of [-1,1])for(const height of [0,2.5]){
 test(`Susanoo bow, arrow and shot share the same aiming line (${facing}, target height ${height})`,()=>{
  const f={id:0,x:-facing*3,y:2,facing},other={x:facing*3,y:height,crouching:false};
  const s=susanooArchery(f,other,sasuke.moves.ultimate);
  assert.ok(s.root.z<0);assert.ok((s.root.x-f.x)*facing<0);near(s.root.y,C.ground);
  near(s.grip.x,s.root.x+facing*C.grip[2]);near(s.grip.z,s.root.z-facing*C.grip[0]);
  const t=(s.target.x-s.origin.x)/s.vx;
  near(s.origin.y+s.vy*t,s.target.y);near(s.origin.z+s.vz*t,0);
  near(Math.hypot(s.vx,s.vy,s.vz),sasuke.moves.ultimate.projectileSpeed);
  near(s.direction.x*s.up.x+s.direction.y*s.up.y+s.direction.z*s.up.z,0);
  assert.ok(s.drawEnd>=C.drawStart&&s.drawEnd<=C.drawEnd);
 });
}
test('Arrow is aimed at release and keeps its direction once airborne',()=>{
 const g=new Game({characters:[sasuke,characters[0]],map:maps[0]});g.state.objects=[];g.state.phase='fighting';
 const f=g.state.fighters[0],rival=g.state.fighters[1];f.x=-5;rival.x=5;
 g.beginMove(f,'ultimate');for(let t=0;t<.9;t+=1/120)g.step(1/120);
 rival.x=7;rival.y=2;rival.grounded=false;
 const s=susanooArchery(f,rival,sasuke.moves.ultimate);
 g.release(f,f.currentMove);const p=g.state.projectiles[0];
 near(p.x,s.origin.x);near(p.y,s.origin.y);near(p.z,s.origin.z);
 near(p.vx,s.vx);near(p.vy,s.vy);near(p.vz,s.vz);
 assert.deepEqual(f.currentMove.archery.target,s.target);
 rival.x=-5;rival.y=0;
 const velocity=[p.vx,p.vy,p.vz];g.updateProjectiles(1/120,[]);
 assert.deepEqual([p.vx,p.vy,p.vz],velocity);
});
