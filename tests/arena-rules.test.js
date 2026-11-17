import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/engine.js';
import {characters,maps} from '../src/config/content.js';
import {updateGuard,guardContact} from '../src/game/arena-rules.js';
const run=(g,seconds,inputs=[{},{}])=>{for(let t=0;t<seconds;t+=1/120)g.step(1/120,inputs);};
function setup(){const events=[];const g=new Game({characters:characters.slice(0,2),map:maps[0],onEvent:e=>events.push(e)});g.state.phase='fighting';g.state.objects=[];g.state.supplies=[];g.state.fighters[0].x=maps[0].bounds.right-2;g.state.fighters[1].x=maps[0].bounds.right-.6;return {g,events};}
test('Hold away blocks a frontal strike once with chip and energy cost',()=>{
 const {g,events}=setup();g.beginMove(g.state.fighters[0],'attack');run(g,.3,[{},{right:true}]);
 assert.equal(g.state.fighters[1].hp,98);assert.ok(g.state.fighters[1].energy<93);
 assert.equal(events.filter(e=>e.type==='guard').length,1);assert.equal(g.state.fighters[0].combo,0);
 run(g,.4,[{},{right:true}]);assert.equal(g.state.fighters[1].hp,98);
});
test('Low strikes require crouch guard; holding toward never guards',()=>{
 for(const [input,hp] of [[{right:true},94],[{right:true,crouch:true},98],[{left:true},94]]){
  const {g}=setup();g.beginMove(g.state.fighters[0],'attack','crouch');run(g,.3,[{},input]);assert.equal(g.state.fighters[1].hp,hp);
 }
});
test('Aerial melee bypasses low guard but can be standing-guarded',()=>{
 for(const [input,hp] of [[{right:true,crouch:true},91],[{right:true},98]]){
  const {g}=setup();const f=g.state.fighters[0];f.y=1.2;f.grounded=false;f.vy=1;
  g.beginMove(f,'attack','air');run(g,.16,[{},input]);assert.equal(g.state.fighters[1].hp,hp);
 }
});
test('Guard cannot cover the rear, airborne states, or attacks in progress',()=>{
 const f={x:0,facing:1,grounded:true,stun:0,energy:100,currentMove:null},r={x:2,grounded:true};
 updateGuard(f,r,{left:true});assert.equal(f.guarding,true);assert.equal(guardContact(r,f,{damage:8},1),'none');
 f.currentMove={};updateGuard(f,r,{left:true});assert.equal(f.guarding,false);
 f.currentMove=null;f.grounded=false;updateGuard(f,r,{left:true});assert.equal(f.guarding,false);
});
test('An exhausted guard breaks and takes the full hit with additional stun',()=>{
 const {g,events}=setup();g.state.fighters[1].energy=1;g.beginMove(g.state.fighters[0],'attack');run(g,.16,[{},{right:true}]);
 assert.equal(g.state.fighters[1].hp,92);assert.ok(g.state.fighters[1].energy<8);assert.ok(g.state.fighters[1].guardBreak>0);
 assert.equal(events.filter(e=>e.type==='guardBreak').length,1);
});
function supplyMatch(){
 const events=[];const g=new Game({characters:characters.slice(0,2),map:maps[0],onEvent:e=>events.push(e)});
 g.state.phase='fighting';g.state.objects=[];g.state.supplies=[{...g.state.supplies[1],active:true,remaining:0}];
 g.state.fighters[0].x=0;g.state.fighters[1].x=10;g.state.fighters[0].energy=20;return {g,events};
}
test('Supply is collected once, capped, respawns and resets with the match',()=>{
 const {g,events}=supplyMatch();run(g,.01);assert.ok(g.state.fighters[0].energy>=40&&g.state.fighters[0].energy<41);
 assert.equal(g.state.supplies[0].active,false);assert.equal(events.filter(e=>e.type==='supply').length,1);
 g.state.fighters[0].x=10;run(g,12.1);assert.equal(g.state.supplies[0].active,true);
 g.reset();assert.equal(g.state.supplies.length,3);assert.ok(g.state.supplies.every(s=>!s.active&&s.remaining>0));
});
test('Both fighters contest a supply; full energy cannot waste it',()=>{
 const {g}=supplyMatch();g.state.fighters[0].x=-.6;g.state.fighters[1].x=.6;run(g,.01);
 assert.equal(g.state.supplies[0].contested,true);assert.ok(g.state.fighters[0].energy<21);
 g.state.fighters[1].x=10;g.state.fighters[0].energy=100;run(g,.01);assert.equal(g.state.supplies[0].active,true);
 g.state.fighters[0].energy=95;run(g,.01);assert.equal(g.state.fighters[0].energy,100);assert.equal(g.state.supplies[0].active,false);
});
test('Supply timers freeze in countdown, pause and results',()=>{
 const {g}=supplyMatch();g.state.supplies[0].active=false;g.state.supplies[0].remaining=5;
 g.state.phase='countdown';run(g,.5);assert.equal(g.state.supplies[0].remaining,5);
 g.state.phase='fighting';g.paused=true;run(g,.5);assert.equal(g.state.supplies[0].remaining,5);
 g.paused=false;g.state.phase='finished';run(g,.5);assert.equal(g.state.supplies[0].remaining,5);
});
test('Rewarded crates grant energy only on their first destruction',()=>{
 const {g}=setup();g.reset();g.state.phase='fighting';const attacker=g.state.fighters[0],object=g.state.objects.find(o=>o.type==='crate');attacker.energy=20;
 g.applyContact({attacker,object,move:{damage:100,color:'#fff'},direction:1});assert.equal(attacker.energy,36);
 g.applyContact({attacker,object,move:{damage:100,color:'#fff'},direction:1});assert.equal(attacker.energy,36);
});
test('Expanded arenas retain valid spawns, distinctive supply rules and six rewarded crates',()=>{
 for(const map of maps){assert.ok(map.bounds.right-map.bounds.left>=74);assert.equal(map.supplies.length,3);assert.equal(map.objects.filter(o=>o.type==='crate'&&o.energyReward===16).length,6);}
 assert.equal(new Set(maps.map(m=>m.supplies[0].respawn)).size,3);
});
