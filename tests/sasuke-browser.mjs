import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/sasuke',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(120000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 await page.goto(process.env.TEST_URL||'http://localhost:5173');await click('start');
 assert.equal(await page.locator('[data-action="choose-character"]').count(),8);
 for(const p of [0,1]){await page.click(`[data-action="choose-character"][data-player="${p}"][data-index="3"]`);await page.click(`[data-action="ready"][data-player="${p}"]`);}
 await page.selectOption('[data-setting="language"]','en');
 assert.match(await page.locator('.player-1 .fighter-detail').textContent(),/Sasuke Uchiha/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'artifacts/sasuke/selection-mobile.png',fullPage:true});await page.setViewportSize({width:1100,height:900});
 await click('to-maps');await click('fight');await page.waitForFunction(()=>__POCKET__.arena?.fighters.every(f=>f.external&&f.type==='sasuke'));
 for(const [p,skill,ultimate,left,right,jump,crouch] of [[0,'g','h','a','d','w','s'],[1,'k','l','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']]){
  for(const [context,keys] of [['neutral',[]],['forward',[p?left:right]],['backward',[p?right:left]],['crouch',[crouch]],['air',[jump]]]){
   await page.evaluate(()=>{const g=__POCKET__.game;g.reset();g.state.phase='fighting';g.state.objects=[];g.state.fighters[0].x=-8;g.state.fighters[1].x=8;window.casts=[];const old=g.onEvent;g.onEvent=e=>{old(e);if(e.type==='cast')casts.push(e);};});
   for(const key of keys)await page.keyboard.down(key);await page.keyboard.press(skill);
   await page.waitForFunction(({p,context})=>casts.some(e=>e.player===p&&e.context===context),{p,context});
   for(const key of keys)await page.keyboard.up(key);
  }
  await page.evaluate(()=>{const g=__POCKET__.game;g.reset();g.state.phase='fighting';g.state.objects=[];});
  await page.keyboard.press(ultimate);await page.waitForFunction(p=>__POCKET__.game.state.fighters[p].currentMove?.move.visual==='susanoo-arrow',p);
 }
 const snap=async(name,key,context,elapsed,facing=1)=>{
  const info=await page.evaluate(async({key,context,elapsed,facing})=>{
   const g=__POCKET__.game,a=__POCKET__.arena;g.reset();g.state.phase='fighting';g.state.objects=[];
   const f=g.state.fighters[0];f.x=-facing*2.5;f.facing=facing;g.state.fighters[1].x=facing*2.5;g.state.fighters[1].facing=-facing;
   if(context==='crouch'){f.crouching=true;f.action='crouch';}
   if(context==='air'){f.y=2;f.grounded=false;f.action='jump';}
   if(key){g.beginMove(f,key,context);for(let t=0;t<elapsed;t+=1/120)g.step(1/120);}
   g.paused=true;const draw=a.renderer.render;a.renderer.render=()=>{};for(let i=0;i<40;i++)a.update(g.state,1/60);a.renderer.render=draw;a.update(g.state,0);
   const T=await import('/node_modules/three/build/three.module.js');const m=a.fighters[0];
   return {feet:new T.Box3().setFromObject(m.model,true).min.y,half:m.sasukeFx.skeleton.root.visible,full:m.fullSusanoo?.visible,charge:m.sasukeFx.charge.visible,lightning:m.sasukeFx.lightning.visible,projectiles:g.state.projectiles.map(p=>p.move.visual),calls:a.renderer.info.render.calls,headY:m.bones.Head.getWorldPosition(new T.Vector3()).y,bones:Object.keys(m.bones).length,triangles:a.renderer.info.render.triangles};
  },{key,context,elapsed,facing});
  await page.locator('#battle-shell').screenshot({path:`artifacts/sasuke/${name}.png`});return info;
 };
 const idle=await snap('idle',null,'neutral',0);const crouch=await snap('crouch',null,'crouch',0);
 assert.ok(Math.abs(idle.feet)<.06);assert.ok(Math.abs(crouch.feet)<.06);assert.ok(crouch.headY<idle.headY-.25);assert.ok(idle.bones>=16);
 await snap('jump',null,'air',0);
 const slash=await snap('skeletal-cleave','skill','neutral',.36);assert.equal(slash.half,true);assert.equal(slash.full,false);
 assert.ok(slash.calls<150);
 const chidori=await snap('chidori','skill','forward',.25);assert.equal(chidori.lightning,true);
 const fire=await snap('fireball','skill','backward',.42);assert.ok(fire.projectiles.includes('fireball'));
 const full=await snap('perfect-susanoo-charge','ultimate','neutral',.9);assert.equal(full.full,true);assert.equal(full.charge,true);assert.equal(full.half,false);assert.ok(!full.projectiles.includes('susanoo-arrow'));
 const mirrored=await snap('perfect-susanoo-mirrored','ultimate','neutral',.9,-1);assert.equal(mirrored.full,true);assert.equal(mirrored.charge,true);
 const shot=await snap('heavenly-arrow','ultimate','neutral',1.28);assert.ok(shot.projectiles.includes('susanoo-arrow'));assert.equal(shot.charge,false);
 const stopped=await snap('cancelled',null,'neutral',0);assert.equal(stopped.half,false);assert.equal(stopped.full,false);assert.equal(stopped.charge,false);
 // Normal keyboard attack, KO, and rematch work with the new character.
 await page.evaluate(()=>{const g=__POCKET__.game;g.reset();g.state.phase='fighting';g.state.objects=[];g.state.fighters[0].x=-.9;g.state.fighters[1].x=.9;g.state.fighters[1].hp=1;});
 await page.keyboard.press('f');await page.locator('.result-card').waitFor();assert.match(await page.locator('.result-card').textContent(),/Sasuke Uchiha/);
 await click('rematch');assert.equal(await page.evaluate(()=>__POCKET__.game.state.fighters[1].hp),100);
 // Missing full-body summon retains Sasuke and falls back to the modeled skeleton.
 const fallback=await browser.newPage({viewport:{width:390,height:844}});fallback.setDefaultTimeout(120000);fallback.on('pageerror',e=>errors.push(e.message));
 await fallback.route('**/models/susanoo.glb',r=>r.abort());await fallback.goto(process.env.TEST_URL||'http://localhost:5173');await fallback.click('[data-action="start"]');
 await fallback.click('[data-action="choose-character"][data-player="0"][data-index="3"]');
 for(const p of [0,1])await fallback.click(`[data-action="ready"][data-player="${p}"]`);
 await fallback.click('[data-action="to-maps"]');await fallback.click('[data-action="fight"]');await fallback.waitForFunction(()=>__POCKET__.arena?.fighters[0]?.external);
 assert.equal(await fallback.evaluate(()=>__POCKET__.arena.fighters[0].type),'sasuke');assert.equal(await fallback.evaluate(()=>!!__POCKET__.arena.fighters[0].fullSusanoo),false);
 const fallbackVisible=await fallback.evaluate(()=>{
   const a=__POCKET__.arena,g=__POCKET__.game,m=a.fighters[0];
   m.sasukeFx.skeleton.materials.forEach(mat=>{mat.userData.baseOpacity=mat.opacity;mat.opacity=0;});
   g.reset();g.state.phase='fighting';g.beginMove(g.state.fighters[0],'ultimate');
   for(let t=0;t<.5;t+=1/120)g.step(1/120);
   g.paused=true;a.update(g.state,.016);
   return m.sasukeFx.skeleton.root.visible&&m.sasukeFx.skeleton.materials[0].opacity>.4;
 });
 assert.equal(fallbackVisible,true);
 await fallback.close();
 const canvas=await browser.newPage({viewport:{width:390,height:844}});canvas.setDefaultTimeout(120000);canvas.on('pageerror',e=>errors.push(e.message));
 await canvas.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:native.call(this,type,...args);};});
 await canvas.route('**/previews/sasuke.webp',r=>r.abort());await canvas.goto(process.env.TEST_URL||'http://localhost:5173');await canvas.click('[data-action="start"]');
 await canvas.click('[data-action="choose-character"][data-player="0"][data-index="3"]');await canvas.locator('.player-1 .fighter-card.selected svg').waitFor();
 for(const p of [0,1])await canvas.click(`[data-action="ready"][data-player="${p}"]`);
 await canvas.click('[data-action="to-maps"]');await canvas.click('[data-action="fight"]');
 assert.equal(await canvas.evaluate(()=>__POCKET__.arena.fallback),true);
 await canvas.evaluate(()=>{__POCKET__.game.state.phase='fighting';});await canvas.keyboard.press('g');
 await canvas.waitForFunction(()=>__POCKET__.game.state.fighters[0].cooldowns.skill>0);
 await canvas.screenshot({path:'artifacts/sasuke/canvas-fallback.png',fullPage:true});await canvas.close();
 assert.deepEqual(errors,[]);console.log('PASS: Sasuke keyboard variants for both players, rigged model, skeletal cleave, full Susanoo charge/arrow, mirrored cast, KO/rematch, English narrow selection and missing summon fallback.',{idle,slash,full,shot});
}finally{await browser.close();}
