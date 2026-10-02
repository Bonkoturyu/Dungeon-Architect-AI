import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { createBuiltinGeneratorStrategyRegistry } from '../packages/generator/src/strategy-catalog.js';
import { generateDungeonSpecV3 } from '../packages/generator/src/dungeon-generator.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';
import { getMessage } from '../apps/editor-slice/i18n.js';
const output=path.resolve(process.env.ROOM_CONTENT_ARTIFACT_DIR || 'artifacts/room-content-ui'); fs.mkdirSync(output,{recursive:true});
const port=4194; const url=process.env.DAI_SMOKE_URL || `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
const vite=process.env.DAI_SMOKE_URL ? null : spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'});
let browser; const errors=[],checks=[];
const excluded=['monster-house','trap-house','shop'].map(kind=>({kind,presence:'exclude',roomCount:null,entityCount:null,floorNumber:null,roomId:null,offers:[]}));
const endpoint=(targetRole,kind)=>({kind,presence:'include',roomCount:1,entityCount:null,floorNumber:null,roomId:null,targetRole,offers:[]});
let requests=[...excluded,endpoint('start','normal'),endpoint('goal','shop')];
try {
 if(!process.env.DAI_SMOKE_URL) for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:false});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 if(process.env.EXPECTED_DEPLOY_SHA) {
  await page.goto(new URL('build-info.json',url).href);
  const info=JSON.parse(await page.locator('body').innerText()); assert.equal(info.commitSha,process.env.EXPECTED_DEPLOY_SHA);
  fs.writeFileSync(path.join(output,'build-info.json'),JSON.stringify(info,null,2));
 }
 const changeLanguage=async(language)=>{
  const switcher=page.locator('[data-language-cycle]').first();
  for(let attempt=0;attempt<5&&await switcher.getAttribute('data-current-language')!==language;attempt++)await switcher.click();
  assert.equal(await switcher.getAttribute('data-current-language'),language);
 };
 page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/design-intent',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,selectedProvider:'fixture',intent:{...DEFAULT_DESIGN_INTENT,targetDuration:480},roomRequests:requests,difficulty:'easy',warnings:[]})}));
 await page.goto(url); await page.waitForFunction(()=>window.__DAI_EDITOR_SLICE__?.ready); await page.evaluate(()=>window.__DAI_ONBOARDING__?.close());
 await page.fill('#generationPrompt','Beginner dungeon. Normal Start. Shop at Goal.');
 await page.selectOption('#generatorStrategy','algorithm-lab.bsp');
 const before=await page.evaluate(()=>JSON.stringify(window.__DAI_EDITOR_SLICE__.getFullDungeonExport()));
 const begin=async()=>{await page.evaluate(()=>{window.__pendingGeneration=window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt();});await page.locator('dialog.special-room-review').waitFor();};
 await begin();
 assert.match(await page.locator('dialog').innerText(),/Algorithm Lab — BSP/);
 assert.doesNotMatch(await page.locator('dialog').innerText(),/Generate with Generator V3/);
 const header=page.locator('.special-room-review-header'); const body=page.locator('.special-room-review-body');
 await page.screenshot({path:path.join(output,'bsp-review-top.png')});
 const rectBefore=await header.boundingBox(); await body.evaluate(e=>{e.scrollTop=e.scrollHeight;}); assert.deepEqual(await header.boundingBox(),rectBefore);
 await page.screenshot({path:path.join(output,'bsp-review-desktop.png')});
 await page.locator('dialog').getByRole('button',{name:'Cancel',exact:true}).click(); assert.equal(await page.evaluate(()=>window.__pendingGeneration),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__DAI_EDITOR_SLICE__.getFullDungeonExport())),before); assert.equal(await page.inputValue('#generatorStrategy'),'algorithm-lab.bsp'); checks.push('BSP-label-sticky-header-cancel-atomic');
 for(const language of ['en','ja','zh-Hans','zh-Hant','ko']) {
  await changeLanguage(language);
  await begin(); assert.equal(await page.locator('#roomReviewHeading').textContent(),getMessage(language,'roomReview.heading'));
  assert.equal(await page.locator('select[name="endpoint-goal"]').inputValue(),'shop');
  await page.locator('dialog').getByRole('button',{name:getMessage(language,'roomReview.cancel'),exact:true}).focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(()=>window.__pendingGeneration),false);
 }
 checks.push('five-locales-and-keyboard-cancel');
 await changeLanguage('ja');
 await page.setViewportSize({width:820,height:540}); await begin();
 const rect=await header.boundingBox(); assert.ok(rect.y>=0&&rect.y+rect.height<=540);
 for(const caption of ['キャンセル','この仕様で生成']) {const b=await page.locator('dialog').getByRole('button',{name:caption,exact:true}).boundingBox();assert.ok(b.x>=0&&b.x+b.width<=820&&b.y>=0&&b.y+b.height<=540);}
 await body.evaluate(e=>{e.scrollTop=e.scrollHeight;}); assert.deepEqual(await header.boundingBox(),rect); await page.screenshot({path:path.join(output,'review-short-viewport.png')});
 await page.locator('dialog').getByRole('button',{name:'キャンセル',exact:true}).click();await page.evaluate(()=>window.__pendingGeneration); checks.push('short-viewport-actions-visible');
 await page.setViewportSize({width:1440,height:900});await changeLanguage('en');
 await begin();await page.locator('dialog').getByRole('button',{name:'Generate this plan',exact:true}).click();assert.equal(await page.evaluate(()=>window.__pendingGeneration),true);
 const manual=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getFullDungeonExport());
 await page.locator('button[data-workflow-tab="create"]').click();await page.check('#generationAuto');
 let actual=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt());assert.equal(actual,true);assert.equal(await page.locator('dialog.special-room-review').count(),0);
 assert.deepEqual(await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getFullDungeonExport()),manual);checks.push('Auto-skips-dialog-identical-defaults');
 for(const metadata of createBuiltinGeneratorStrategyRegistry().list()) {
  await page.locator('button[data-workflow-tab="create"]').click();await page.selectOption('#generatorStrategy',metadata.id);
  assert.equal(await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.generateDungeonFromPrompt()),true,metadata.id);
  const state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.lastGeneration.generatorStrategyId,metadata.id);assert.equal(state.lastGeneration.contentLayerVersion,'special-rooms-1');assert.equal(await page.inputValue('#generatorStrategy'),metadata.id);
  const exported=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getLayoutExport());assert.equal(exported.source.generatorStrategyId,metadata.id);assert.equal(exported.source.contentLayerVersion,'special-rooms-1');
 }
 checks.push('all-11-strategies-Auto-selection-and-provenance');
 const goalShopPlan={id:'goal-shop',targetRole:'goal',kind:'shop',floorNumber:1,roomId:null,entityCount:null,offers:[{id:'free-armor',type:'armor',tier:1,price:0,stock:1}]};
 const goalShop=generateDungeonSpecV3({seed:25,id:'goal-shop-fixture',roomCount:3,routeChoice:0,enemyCount:0,trapCount:0,treasureCount:0,roomPlans:[goalShopPlan]});
 const load=async(specs)=>{const imported=await page.evaluate(text=>window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(text),JSON.stringify(createFullDungeonExport(specs)));assert.equal(imported.ok,true);assert.equal(await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.startDungeon()),true);};
 const reachGoal=async()=>{for(const id of ['room-002','room-003'])assert.equal(await page.evaluate(id=>window.__DAI_EDITOR_SLICE__.movePlayToRoom(id),id),true);};
 await load([goalShop]);await reachGoal();
 let state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.mode,'play');assert.equal(state.play.playerState.gold,0);assert.equal(await page.locator('[data-action="complete-goal"]').isEnabled(),true);
 await page.waitForFunction(()=>!document.querySelector('#roomEventBar').classList.contains('is-event-intro'));
 await page.screenshot({path:path.join(output,'goal-shop-optional-finish.png')});
 await page.locator('[data-action="complete-goal"]').click();assert.equal((await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState())).mode,'result');checks.push('Goal-shop-0G-no-purchase-finish');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());await load([goalShop]);await reachGoal();
 await page.locator('[data-action="buy-offer"]').click();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.play.playerState.equipment.armor.tier,1);await page.locator('[data-action="complete-goal"]').click();checks.push('Goal-shop-buy-then-finish');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());await load([goalShop,{...structuredClone(goalShop),id:'goal-shop-floor2',seed:26}]);await reachGoal();
 await page.locator('[data-action="complete-goal"]').click();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.mode,'play');assert.equal(state.play.floorIndex,1);await reachGoal();await page.locator('[data-action="complete-goal"]').click();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.run.status,'cleared');assert.equal(state.run.floorsCompleted,2);checks.push('Goal-shop-next-floor-then-run-clear');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'smoke.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
} finally {if(browser)await browser.close();vite?.kill();}
