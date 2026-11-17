import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game/engine.js';
import {characters,maps} from '../src/config/content.js';
import {sasuke} from '../src/config/sasuke.js';
import {english} from '../src/i18n/en.js';
const step=(g,seconds,inputs=[{},{}])=>{for(let t=0;t<seconds;t+=1/120)g.step(1/120,inputs);};
function match(distance=4,side=1){
 const g=new Game({characters:[sasuke,characters[0]],map:maps[0]});g.state.phase='fighting';g.state.objects=[];
 g.state.fighters[0].x=-side*distance/2;g.state.fighters[0].facing=side;
 g.state.fighters[1].x=side*distance/2;g.state.fighters[1].facing=-side;return g;
}
for(const side of [-1,1]){
 test(`Sasuke skeletal cleave hits once in front (${side}) and misses outside reach`,()=>{
  const g=match(4,side);g.beginMove(g.state.fighters[0],'skill','neutral');step(g,.85);
  assert.equal(g.state.fighters[1].hp,80);
  assert.equal(g.state.fighters[0].energy<100,true);
  const miss=match(9,side);miss.beginMove(miss.state.fighters[0],'skill','neutral');step(miss,.85);assert.equal(miss.state.fighters[1].hp,100);
 });
 test(`Sasuke arrow charges, launches once and damages a distant rival (${side})`,()=>{
  const g=match(8,side);g.beginMove(g.state.fighters[0],'ultimate');step(g,1.1);
  assert.equal(g.state.projectiles.length,0);assert.equal(g.state.fighters[1].hp,100);
  step(g,.7);assert.equal(g.state.fighters[1].hp,61);
  step(g,1);assert.equal(g.state.fighters[1].hp,61);
 });
 test(`Sasuke fireball follows its own projectile configuration (${side})`,()=>{
  const g=match(7,side);g.beginMove(g.state.fighters[0],'skill','backward');step(g,.4);
  assert.equal(g.state.projectiles[0].move.visual,'fireball');assert.equal(Math.sign(g.state.projectiles[0].vx),side);
  step(g,.8);assert.equal(g.state.fighters[1].hp,84);
 });
}
test('Sasuke directional moves rush, burst low and fire diagonally from air',()=>{
 const g=match(12);g.beginMove(g.state.fighters[0],'skill','forward');const x=g.state.fighters[0].x;step(g,.55);assert.ok(g.state.fighters[0].x>x+2);
 const low=match(2);low.beginMove(low.state.fighters[0],'skill','crouch');step(low,.25);assert.equal(low.state.fighters[0].crouching,true);assert.equal(low.state.fighters[1].hp,86);
 const air=match(7);const f=air.state.fighters[0];f.grounded=false;f.y=3;air.beginMove(f,'skill','air');step(air,.25);
 assert.ok(air.state.projectiles[0].vy<0);assert.equal(air.state.projectiles[0].move.visual,'fireball');
});
test('An interrupted Susanoo charge cannot emit a late arrow',()=>{
 const g=match(2);g.beginMove(g.state.fighters[0],'ultimate');step(g,.15);
 g.beginMove(g.state.fighters[1],'attack');step(g,.2);
 assert.equal(g.state.fighters[0].currentMove,null);step(g,1.5);assert.equal(g.state.projectiles.length,0);
});
test('All Sasuke names and move descriptions have English translations',()=>{
 for(const text of [sasuke.name,sasuke.tagline,sasuke.description,...Object.values(sasuke.moves).flatMap(m=>[m.name,m.description,...Object.values(m.variants||{}).flatMap(v=>[v.name,v.description])])]){
  assert.ok(english[text],text);assert.ok(!/[\u3400-\u9fff]/.test(english[text]),text);
 }
});
