import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { generateDungeonSpecV2 } from '../packages/generator/src/versions/v2/dungeon-generator.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
const phase=process.env.PROFILE_PHASE==='after'?'after':'before';
const output=path.resolve('artifacts/performance');fs.mkdirSync(output,{recursive:true});
const warmups=3,repetitions=12,port=4197;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'});
let browser; const results=[];const errors=[];
const summarize=(numbers)=>{const sorted=numbers.toSorted((a,b)=>a-b);return {samples:sorted.length,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],minMs:sorted[0],maxMs:sorted.at(-1)};};
try{
 const url=`http://127.0.0.1:${port}/apps/editor-slice/index.html`;
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:false});
 for(const count of [10,100,250]){
  const page=await browser.newPage({viewport:{width:1440,height:900}}); page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/api/design-intent',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,intent:DEFAULT_DESIGN_INTENT,roomRequests:[],difficulty:null,warnings:[],selectedProvider:'benchmark-stub'})}));
  await page.goto(url);await page.waitForFunction(()=>window.__DAI_EDITOR_SLICE__?.ready);await page.evaluate(()=>window.__DAI_ONBOARDING__?.close());
  const spec=generateDungeonSpecV2({seed:42,roomCount:8,routeChoice:0});
  spec.entities.push({id:'budget',type:'treasure',roomId:'room-001',goldReward:1000,rewardItem:false});
  spec.entities.push({id:'shop',type:'shop',roomId:'room-001',offers:[{id:'weapon',type:'weapon',tier:1,price:10,stock:1}]});
  spec.entities.push(...Array.from({length:count},(_,i)=>({id:`load-enemy-${i}`,type:'enemy',roomId:'room-002',initiallyActive:true,damage:0})));
  const json=JSON.stringify(createFullDungeonExport([spec])); const records=[];
  for(let iteration=-warmups;iteration<repetitions;iteration++){
   const iterationResults=await page.evaluate(async({json,spec})=>{
    const api=window.__DAI_EDITOR_SLICE__;const rows=[];
    async function run(operation,action){api.startPerformanceProbe();const started=performance.now();const value=await action();const wallMs=performance.now()-started;const stages=api.stopPerformanceProbe();rows.push({operation,wallMs,stages});return value;}
    const imported=await run('import.full',()=>api.importDungeonJsonTextForTest(json));if(!imported.ok)throw new Error('Import failed');
    const valid=await run('validate.startGate',()=>api.evaluateStartGateForSpec(spec));if(!valid.allowed)throw new Error('Gate failed');
    await run('export.full.serialize',()=>JSON.stringify(api.getFullDungeonExport()));
    await run('export.layout.serialize',()=>JSON.stringify(api.getLayoutExport()));
    await run('play.start',()=>api.startDungeon());
    await run('play.treasure',()=>api.interactWithRoomEntity('open-treasure','budget'));
    await run('play.purchase',()=>document.querySelector('[data-action="buy-offer"]').click());
    await run('play.move',()=>api.movePlayToRoom('room-002'));
    await run('play.combat',()=>api.clearEnemy('load-enemy-0'));
    await run('play.returnEdit',()=>api.returnToEdit());
    await run('edit.selectRoom',()=>api.selectRoom('room-001'));
    const width=document.querySelector('#roomWidth');width.value=String(spec.rooms[0].width+.25);
    await run('edit.resizeRoom',()=>api.resizeSelectedRoom());
    await run('edit.undo',()=>document.querySelector('#undo').click());
    await run('edit.redo',()=>document.querySelector('#redo').click());
    return rows;
   },{json,spec});
   if(iteration>=0)records.push(...iterationResults);
  }
  // Small deterministic generation flow. The network/provider is stubbed, not measured as live AI latency.
  const generation=[];
  for(let i=-warmups;i<repetitions;i++){
   const measured=await page.evaluate(async()=>{const api=window.__DAI_EDITOR_SLICE__;document.querySelector('#generationPrompt').value='A fair dungeon with exploration';api.setGeneratorStrategy('version-2-spatial');api.startPerformanceProbe();const t=performance.now();const ok=await api.generateDungeonFromPrompt();return {ok,wallMs:performance.now()-t,stages:api.stopPerformanceProbe()};});
   assert.equal(measured.ok,true);if(i>=0)generation.push({operation:'generate.withStubbedAI',...measured});
  }
  records.push(...generation);
  const operations={};
  for(const operation of new Set(records.map(r=>r.operation))){const items=records.filter(r=>r.operation===operation);const names=new Set(items.flatMap(r=>r.stages.map(s=>s.name)));const stages={};for(const name of names){const totals=items.map(r=>r.stages.filter(s=>s.name===name).reduce((sum,s)=>sum+s.durationMs,0));stages[name]={...summarize(totals),meanCalls:items.reduce((sum,r)=>sum+r.stages.filter(s=>s.name===name).length,0)/items.length};}operations[operation]={...summarize(items.map(r=>r.wallMs)),stages};}
  results.push({count,operations});console.log(JSON.stringify({phase,count,combat:operations['play.combat'],import:operations['import.full']}));
  fs.writeFileSync(path.join(output,`ui-${phase}.json`),JSON.stringify({phase,warmups,repetitions,browser:browser.version(),viewport:{width:1440,height:900},provider:'stubbed; live latency unmeasured',results,errors},null,2));
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();vite.kill();}
