import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { generateDungeonSpecV2 } from '../packages/generator/src/versions/v2/dungeon-generator.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';
const label=process.env.CAPACITY_LABEL==='repeat'?'capacity-repeat':'capacity';
const counts=process.env.CAPACITY_COUNTS?process.env.CAPACITY_COUNTS.split(',').map(Number):[10,100,250,500,1000];
if(counts.some(n=>!Number.isInteger(n)||n<1||n>1000))throw new Error('Invalid benchmark counts');
const output=path.resolve('artifacts/special-rooms'); fs.mkdirSync(output,{recursive:true});
const port=4194; const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'});
let browser; const results=[];
try {
 const url=`http://127.0.0.1:${port}/apps/editor-slice/index.html`;
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:false});
 for(const count of counts) {
  const page=await browser.newPage({viewport:{width:1440,height:900}}); const errors=[]; page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url); await page.waitForFunction(()=>window.__DAI_EDITOR_SLICE__?.ready); await page.evaluate(()=>window.__DAI_ONBOARDING__?.close());
  const spec=generateDungeonSpecV2({seed:42,roomCount:6,routeChoice:0}); spec.rooms.find(r=>r.id==='room-002').kind='monster-house';
  spec.entities.push(...Array.from({length:count},(_,i)=>({id:`load-enemy-${i}`,type:'enemy',roomId:'room-002',initiallyActive:true})));
  const json=JSON.stringify(createFullDungeonExport([spec]));
  const record=await page.evaluate(async ({json,count})=>{
   const api=window.__DAI_EDITOR_SLICE__; const now=()=>performance.now(); let time=now(); const imported=api.importDungeonJsonTextForTest(json); const importMs=now()-time;
   time=now(); api.startDungeon(); const startMs=now()-time; time=now(); api.movePlayToRoom('room-002'); const enterMs=now()-time;
   const frames=[]; let previous=now(); const deadline=previous+3000;
   while(now()<deadline){await new Promise(requestAnimationFrame); const next=now(); frames.push(next-previous);previous=next;}
   time=now(); api.clearEnemy('load-enemy-0'); const actionMs=now()-time;
   const sorted=frames.toSorted((a,b)=>a-b); const canvas=document.querySelector('canvas'); const gl=canvas.getContext('webgl2'); const ext=gl?.getExtension('WEBGL_debug_renderer_info');
   return {count,importOk:imported.ok,importMs,startMs,enterMs,actionMs,frames:frames.length,frameMedianMs:sorted[Math.floor(sorted.length/2)],frameP95Ms:sorted[Math.floor(sorted.length*.95)],usedJSHeapBytes:performance.memory?.usedJSHeapSize??null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,eventCards:document.querySelectorAll('#roomEventItems .room-event').length};
  },{json,count});
  results.push({...record,errors}); console.log(JSON.stringify(results.at(-1)));
  await page.screenshot({path:path.join(output,`${label}-${count}.png`)});
  fs.writeFileSync(path.join(output,`${label}.json`),JSON.stringify({environment:'Native Chromium, cloud Linux desktop, 1440x900',results},null,2));
  await page.close();
 }
} finally {if(browser)await browser.close();vite.kill();}
