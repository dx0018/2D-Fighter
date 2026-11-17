import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>release=r);
 await page.route('**/models/*.glb',async route=>{await gate;await route.continue();});
 await page.goto(process.env.TEST_URL||'http://localhost:5173');await page.click('[data-action="start"]');
 for(const p of [0,1])await page.click(`[data-action="ready"][data-player="${p}"]`);
 await page.click('[data-action="to-maps"]');await page.click('[data-action="fight"]');
 await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>__POCKET__.arena.modelsReady),false);
 assert.equal(await page.evaluate(()=>__POCKET__.arena.fighters.some(f=>f.root.visible)),false);
 assert.equal(await page.evaluate(()=>__POCKET__.game.state.countdown),3);
 assert.match(await page.locator('#battle-overlay').textContent(),/正在准备角色模型/);
 release();await page.waitForFunction(()=>__POCKET__.arena.modelsReady&&__POCKET__.arena.clock>0);
 assert.equal(await page.evaluate(()=>__POCKET__.arena.fighters.every(f=>f.external&&f.root.visible)),true);
 const metrics=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {characters}=await import('/src/config/content.js');const {loadFighterModel}=await import('/src/render/model-loader.js');const {animateFighter}=await import('/src/render/animation.js');
  const result=[];
  for(const c of characters){
   const m=await loadFighterModel(c);const f={character:c,x:0,y:0,vx:0,vy:0,facing:1,grounded:true,action:'idle',walkDistance:0};
   const tick=(n)=>{for(let i=0;i<n;i++)animateFighter(m,f,1/60,i/60);};
   tick(30);const idle=new T.Box3().setFromObject(m.model,true);let skinned=0,bones=0;
   m.model.traverse(n=>{if(n.isSkinnedMesh){skinned++;bones+=n.skeleton.bones.length;}});
   f.action='walk';f.vx=c.speed;for(let i=0;i<60;i++){f.walkDistance+=c.speed/60;animateFighter(m,f,1/60,i/60);}
   const walking=new T.Box3().setFromObject(m.model,true);
   f.action='crouch';f.vx=0;f.crouching=true;tick(45);const crouch=new T.Box3().setFromObject(m.model,true);
   f.crouching=false;f.action='jump';f.grounded=false;f.y=2;f.vy=4;tick(30);
   const jump=new T.Box3().setFromObject(m.model,true);
   result.push({id:c.id,skinned,bones,idle:idle.min.y,walk:walking.min.y,crouch:crouch.min.y,drop:idle.max.y-crouch.max.y,jump:jump.min.y,scale:m.visual.scale.toArray(),rootScale:m.root.scale.toArray()});
  }
  return result;
 });
 console.log(metrics);
 for(const m of metrics){assert.ok(m.skinned>0&&m.bones>=16);assert.deepEqual(m.scale,[1,1,1]);assert.deepEqual(m.rootScale,[1,1,1]);assert.ok(m.drop>.08,JSON.stringify(m));assert.ok(m.crouch>-.12&&m.crouch<.15,JSON.stringify(m));assert.ok(m.jump>1,JSON.stringify(m));}
 assert.deepEqual(errors,[]);console.log('PASS: delayed loading never displays legacy models or starts countdown; all four actors use skinned skeletal locomotion without scaling.');
}finally{await browser.close();}
