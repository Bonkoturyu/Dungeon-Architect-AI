import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { createBuiltinGeneratorStrategyRegistry } from '../packages/generator/src/strategy-catalog.js';
import { generateDungeonSpecV3 } from '../packages/generator/src/dungeon-generator.js';
import { createFullDungeonExport } from '../packages/export-core/src/layout-exchange.js';
import { ROOM_CONTENT_LAYER_VERSION } from '../packages/generator/src/room-content-layer.js';
import { handleDesignIntentRequest } from '../functions/api/design-intent.js';
import { deterministicTreasureReward } from '../packages/play-core/src/progression-runtime.js';
import { getMessage } from '../apps/editor-slice/i18n.js';
const output=path.resolve(process.env.ROOM_CONTENT_ARTIFACT_DIR || 'artifacts/room-content-ui'); fs.mkdirSync(output,{recursive:true});
const port=4194; const url=process.env.DAI_SMOKE_URL || `http://127.0.0.1:${port}/apps/editor-slice/index.html`;
const vite=process.env.DAI_SMOKE_URL ? null : spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'});
let browser; const errors=[],checks=[];
const excluded=['monster-house','trap-house','shop'].map(kind=>({kind,presence:'exclude',roomCount:null,entityCount:null,floorNumber:null,roomId:null,offers:[]}));
const endpoint=(targetRole,kind)=>({kind,presence:'include',roomCount:1,entityCount:null,floorNumber:null,roomId:null,targetRole,offers:[]});
let actualFallbackMode=false;
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
 await page.route('**/api/design-intent',async r=>{
  if(actualFallbackMode) {
   const response=await handleDesignIntentRequest(new Request('https://example.test/api/design-intent',{method:'POST',body:r.request().postData()}),{});
   return r.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  }
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,selectedProvider:'fixture',intent:{...DEFAULT_DESIGN_INTENT,targetDuration:480},roomRequests:requests,difficulty:'easy',warnings:[]})});
 });
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
  assert.equal(await page.locator('.generation-mode-field legend').textContent(),getMessage(language,'create.settings'));
  await page.check('#generationAuto');assert.equal(await page.locator('#generationAutoHint').textContent(),getMessage(language,'create.autoHint'));
  await page.check('#generationManual');assert.equal(await page.locator('#generationAutoHint').textContent(),getMessage(language,'create.manualHint'));
  await begin(); assert.equal(await page.locator('#roomReviewHeading').textContent(),getMessage(language,'roomReview.heading'));
  assert.equal(await page.locator('select[name="endpoint-goal"]').inputValue(),'shop');
  await page.locator('dialog').getByRole('button',{name:getMessage(language,'roomReview.cancel'),exact:true}).focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(()=>window.__pendingGeneration),false);
 }
 checks.push('five-locales-and-keyboard-cancel','clear-Automatic-Manual-choices-in-five-locales');
 await changeLanguage('ja');await page.locator('.generation-mode-field').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'generation-settings-ja.png')});
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
  const state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.lastGeneration.generatorStrategyId,metadata.id);assert.equal(state.lastGeneration.contentLayerVersion,ROOM_CONTENT_LAYER_VERSION);assert.equal(await page.inputValue('#generatorStrategy'),metadata.id);
  const exported=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getLayoutExport());assert.equal(exported.source.generatorStrategyId,metadata.id);assert.equal(exported.source.contentLayerVersion,ROOM_CONTENT_LAYER_VERSION);
 }
 checks.push('all-11-strategies-Auto-selection-and-provenance');
 await page.locator('button[data-workflow-tab="create"]').click();await page.check('#generationManual');await page.selectOption('#generatorStrategy','algorithm-lab.bsp');await page.fill('#floorCount','2');
 await page.fill('#generationPrompt','やさしいダンジョン。モンスターハウスはなし。トラップハウスはなし。店はなし。スタートは通常の部屋。1階のゴールに店。2階のゴールに敵3体のモンスターハウス。');
 actualFallbackMode=true;await begin();
 assert.equal(await page.locator('select[name="endpoint-goal-floor-1"]').inputValue(),'shop');assert.equal(await page.locator('select[name="endpoint-goal-floor-2"]').inputValue(),'monster-house');
 await page.selectOption('select[name="endpoint-goal-floor-2"]','trap-house');
 const scopedCount=page.locator('[data-plan-id="endpoint-goal-trap-house-2"] input[type="number"]').nth(1);await scopedCount.fill('2');
 await page.selectOption('select[name="difficulty"]','normal');assert.equal(await scopedCount.inputValue(),'2');
 await page.screenshot({path:path.join(output,'per-floor-endpoint-review.png')});
 await page.locator('dialog').getByRole('button',{name:'Generate this plan',exact:true}).click();assert.equal(await page.evaluate(()=>window.__pendingGeneration),true);
 const scoped=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getFullDungeonExport());
 for(const [index,kind]of ['shop','trap-house'].entries()){const dungeon=scoped.floors[index].dungeon;const goal=dungeon.entities.find(e=>e.type==='goal').roomId;assert.equal(dungeon.rooms.find(r=>r.id===goal).kind,kind);if(index===1)assert.equal(dungeon.entities.filter(e=>e.roomId===goal&&e.type==='trap').length,2);}
 assert.equal((await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState())).lastGeneration.selectedProvider,'fallback');actualFallbackMode=false;checks.push('real-fallback-per-floor-manual-overrides-preserved');
 const goalShopPlan={id:'goal-shop',targetRole:'goal',kind:'shop',floorNumber:1,roomId:null,entityCount:null,offers:[{id:'free-armor',type:'armor',tier:1,price:0,stock:1}]};
 const goalShop=generateDungeonSpecV3({seed:25,id:'goal-shop-fixture',roomCount:3,routeChoice:0,enemyCount:0,trapCount:0,treasureCount:0,roomPlans:[goalShopPlan]});
 const load=async(specs)=>{const imported=await page.evaluate(text=>window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(text),JSON.stringify(createFullDungeonExport(specs)));assert.equal(imported.ok,true);assert.equal(await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.startDungeon()),true);};
 const reachGoal=async()=>{for(const id of ['room-002','room-003'])assert.equal(await page.evaluate(id=>window.__DAI_EDITOR_SLICE__.movePlayToRoom(id),id),true);};
 await load([goalShop]);await reachGoal();
 let state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.mode,'play');assert.equal(state.play.playerState.gold,0);assert.equal(await page.locator('[data-action="complete-goal"]').isEnabled(),true);
 await page.waitForFunction(()=>!document.querySelector('#roomEventBar').classList.contains('is-event-intro'));
 await page.screenshot({path:path.join(output,'goal-shop-optional-finish.png')});
 await page.locator('[data-action="leave-shop"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#shopOfferList').isVisible(),false);assert.equal(await page.locator('[data-action="complete-goal"]').isEnabled(),true);
 await page.locator('[data-action="complete-goal"]').click();assert.equal((await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState())).mode,'result');checks.push('Goal-shop-0G-no-purchase-finish','Goal-shop-dismiss-keeps-Finish-keyboard-accessible');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());await load([goalShop]);await reachGoal();
 await page.locator('[data-action="buy-offer"]').click();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.play.playerState.equipment.armor.tier,1);await page.locator('[data-action="complete-goal"]').click();checks.push('Goal-shop-buy-then-finish');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());await load([goalShop,{...structuredClone(goalShop),id:'goal-shop-floor2',seed:26}]);await reachGoal();
 await page.locator('[data-action="complete-goal"]').click();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.mode,'play');assert.equal(state.play.floorIndex,1);await reachGoal();await page.locator('[data-action="complete-goal"]').click();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.run.status,'cleared');assert.equal(state.run.floorsCompleted,2);checks.push('Goal-shop-next-floor-then-run-clear');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());
 const startShopPlan={...goalShopPlan,id:'start-shop',targetRole:'start'};
 const startShop=generateDungeonSpecV3({seed:25,id:'start-shop-fixture',roomCount:3,routeChoice:0,enemyCount:0,trapCount:0,treasureCount:0,roomPlans:[startShopPlan]});
 const lootId=Array.from({length:100},(_,i)=>`loot-proof-${i}`).find(id=>{const item=deterministicTreasureReward({dungeonSeed:25},id).item;return item?.slot==='weapon'&&item.tier===2;});assert.ok(lootId);
 startShop.entities.push({id:lootId,type:'treasure',roomId:'room-001'});
 await load([startShop,{...structuredClone(startShop),id:'start-shop-floor2',seed:26}]);
 assert.equal(await page.locator('#weaponTierCount').textContent(),'Unequipped');assert.equal(await page.locator('#armorTierCount').textContent(),'Unequipped');
 const initialShopState=await page.evaluate(()=>JSON.stringify(window.__DAI_EDITOR_SLICE__.getState().play.playerState));
 await page.locator('[data-action="leave-shop"]').click();assert.equal(await page.locator('#shopOfferList').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify(window.__DAI_EDITOR_SLICE__.getState().play.playerState)),initialShopState);
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.movePlayToRoom('room-002'));await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.movePlayToRoom('room-001'));assert.equal(await page.locator('#shopOfferList').isVisible(),true);
 await page.evaluate(id=>window.__DAI_EDITOR_SLICE__.interactWithRoomEntity('open-treasure',id),lootId);assert.equal(await page.locator('#weaponTierCount').textContent(),'T2');
 await page.locator('[data-action="buy-offer"]').click();assert.equal(await page.locator('#armorTierCount').textContent(),'T1');
 await page.locator('[data-action="leave-shop"]').click();await page.locator('[data-action="open-shop"]').focus();await page.keyboard.press('Enter');assert.match(await page.locator('[data-action="buy-offer"]').textContent(),/Sold out/);
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.movePlayToRoom('room-002'));await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.movePlayToRoom('room-001'));assert.match(await page.locator('[data-action="buy-offer"]').textContent(),/Sold out/);
 await changeLanguage('ja');await page.waitForFunction(()=>!document.querySelector('#roomEventBar').classList.contains('is-event-intro'));await page.screenshot({path:path.join(output,'equipment-tiers-and-shop-controls-ja.png')});await changeLanguage('en');
 const boxes=await page.evaluate(()=>({events:document.querySelector('#roomEventBar').getBoundingClientRect().toJSON(),exits:document.querySelector('#playExitBar').getBoundingClientRect().toJSON(),hud:document.querySelector('#playStatus').getBoundingClientRect().toJSON()}));assert.ok(boxes.events.bottom<boxes.exits.top);assert.ok(boxes.exits.bottom<boxes.hud.top);
 await reachGoal();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.play.floorIndex,1);assert.equal(await page.locator('#weaponTierCount').textContent(),'T2');assert.equal(await page.locator('#armorTierCount').textContent(),'T1');assert.equal(await page.locator('#shopOfferList').isVisible(),true);
 await reachGoal();state=await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.getState());assert.equal(state.run.status,'cleared');assert.equal(state.run.playerState.equipment.weapon.tier,2);assert.equal(state.run.playerState.equipment.armor.tier,1);
 const resultTiers=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#resultMetrics .result-metric')].map(e=>[e.querySelector('dt').textContent,e.querySelector('dd').textContent])));assert.equal(resultTiers.Weapon,'T2');assert.equal(resultTiers.Armor,'T1');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.startDungeon());assert.equal(await page.locator('#weaponTierCount').textContent(),'Unequipped');assert.equal(await page.locator('#armorTierCount').textContent(),'Unequipped');assert.equal(await page.locator('#shopOfferList').isVisible(),true);
 checks.push('shop-dismiss-reentry-preserves-stock-and-no-purchase-state','Tier-HUD-loot-purchase-floor-carry-result-and-new-play-reset');
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.returnToEdit());
 const roleFixture=generateDungeonSpecV3({seed:25,id:'role-kind-fixture',roomCount:3,routeChoice:0,enemyCount:0,trapCount:0,treasureCount:0,roomPlans:[{id:'start-traps',kind:'trap-house',targetRole:'start',floorNumber:1,roomId:null,entityCount:3,offers:[]},goalShopPlan]});
 assert.equal((await page.evaluate(text=>window.__DAI_EDITOR_SLICE__.importDungeonJsonTextForTest(text),JSON.stringify(createFullDungeonExport([roleFixture])))).ok,true);
 await page.evaluate(()=>window.__DAI_EDITOR_SLICE__.selectRoom('room-001'));assert.match(await page.locator('#roomContentsRoom').textContent(),/Start.*Trap house/);assert.match(await page.locator('#roomSelect option').first().textContent(),/Start.*Trap house/);
 await changeLanguage('ja');await page.screenshot({path:path.join(output,'start-role-and-trap-house-label-ja.png')});checks.push('endpoint-role-and-room-kind-labels-visible-together');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'smoke.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
} finally {if(browser)await browser.close();vite?.kill();}
