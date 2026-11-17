import test from 'node:test';
import assert from 'node:assert/strict';
import { ComputerPlayer } from '../src/game/computer.js';
import { Game } from '../src/game/engine.js';
import { characters, maps } from '../src/config/content.js';
function random() {
  let seed = 12345;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
for (const character of characters) {
  test(`CPU ${character.id} approaches, attacks and can win a real match`, () => {
    const events = [];
    const g = new Game({ characters: [characters[0], character], map: maps[0], onEvent: e => events.push(e) });
    const ai = new ComputerPlayer(random());
    for (let i = 0; i < 60 * 120 && g.state.phase !== 'finished'; i++) {
      g.step(1 / 60, [{}, ai.read(g, 1 / 60)]);
      const f = g.state.fighters[1];
      assert.ok(Number.isFinite(f.x));
      assert.ok(f.energy >= 0 && f.energy <= character.maxEnergy);
      assert.ok(f.x >= maps[0].bounds.left && f.x <= maps[0].bounds.right);
    }
    assert.ok(g.state.fighters[0].hp < 100);
    assert.equal(g.state.winner, 1);
    assert.ok(events.some(e => e.type === 'cast' && e.player === 1 && e.move === 'skill'));
  });
}
test('CPU freezes during countdown, pause, impact freeze and results', () => {
  const g = new Game({characters: characters.slice(0,2),map: maps[0]});
  const ai = new ComputerPlayer(random());
  assert.deepEqual(ai.read(g,1),{});
  g.state.phase='fighting'; g.paused=true;
  assert.deepEqual(ai.read(g,1),{});
  g.paused=false;g.state.hitstop=.1;
  assert.deepEqual(ai.read(g,1),{});
  g.state.hitstop=1e-17;
  const resumed = new ComputerPlayer(()=>0.99);
  assert.equal(resumed.read(g,1/60).left,true);
  g.state.hitstop=0;g.state.phase='finished';
  assert.deepEqual(ai.read(g,1),{});
});
test('CPU emits separate button presses and changes direction after swapping sides', () => {
  const g = new Game({characters: characters.slice(0,2),map: maps[0]});g.state.phase='fighting';
  const ai=new ComputerPlayer(()=>0.99);
  const a=ai.read(g,1/60);
  assert.equal(a.left,true);
  const next=ai.read(g,1/60);
  assert.equal(next.attack,undefined);assert.equal(next.skill,undefined);assert.equal(next.ultimate,undefined);
  g.state.fighters[0].x=12;g.state.fighters[1].x=-12;
  ai.timer=0;
  assert.equal(ai.read(g,1/60).right,true);
});

test('CPU seeks active supplies when low and stands to guard aerial melee',()=>{
 const g=new Game({characters:characters.slice(0,2),map:maps[0]});g.state.phase='fighting';
 const [rival,self]=g.state.fighters;self.energy=20;rival.x=-10;self.x=10;
 g.state.supplies=[{x:20,active:true,contested:false}];
 assert.equal(new ComputerPlayer(()=>.2).read(g,1/60).right,true);
 rival.x=self.x-2;rival.grounded=false;g.beginMove(rival,'attack','air');
 const defense=new ComputerPlayer(()=>.2).read(g,1/60);
 assert.equal(defense.right,true);assert.equal(defense.crouch,undefined);assert.equal(defense.jump,undefined);assert.equal(defense.attack,undefined);
});
