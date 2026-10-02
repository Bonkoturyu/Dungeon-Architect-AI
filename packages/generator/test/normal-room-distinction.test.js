import assert from 'node:assert/strict';
import test from 'node:test';
import {applyNormalRoomDistinction,respectsNormalRoomDistinction} from '../src/normal-room-distinction.js';
function fixture(){return {rooms:[{id:'start'},{id:'normal-a'},{id:'normal-b'},{id:'house',kind:'monster-house'},{id:'traps',kind:'trap-house'},{id:'goal'}],entities:[{id:'start',type:'start',roomId:'start'},{id:'goal',type:'goal',roomId:'goal'},...Array.from({length:4},(_,i)=>({id:`enemy-${i}`,type:'enemy',roomId:'normal-a'})),...Array.from({length:5},(_,i)=>({id:`trap-${i}`,type:'trap',roomId:'normal-b'})),...Array.from({length:3},(_,i)=>({id:`v3:enemy-${i}`,type:'enemy',roomId:'house'})),...Array.from({length:4},(_,i)=>({id:`v3:trap-${i}`,type:'trap',roomId:'traps'}))],events:[]};}
const config={roomPlans:[{kind:'monster-house',entityCount:3},{kind:'trap-house',entityCount:4}],presenceSpec:{defaults:{'monster-house':3,'trap-house':4}}};
test('automatic hazards redistribute below house counts while exact house contents stay intact',()=>{
 const spec=fixture(),before=structuredClone(spec); const report=applyNormalRoomDistinction(spec,config);
 assert.deepEqual(report.limits,{enemy:2,trap:3});assert.ok(respectsNormalRoomDistinction(spec,report.limits));
 assert.equal(spec.entities.length,before.entities.length); assert.deepEqual(spec.entities.filter(e=>e.id.startsWith('v3:')),before.entities.filter(e=>e.id.startsWith('v3:')));
 assert.ok(report.changes.length>0);assert.ok(report.changes.every(c=>c.operation==='redistributed'));
});
test('minimum configured same-type house count wins, and only automatic overflow may be removed',()=>{
 const spec=fixture();spec.rooms.push({id:'small-house',kind:'monster-house'});spec.entities.push({id:'v3:small-house-enemy',type:'enemy',roomId:'small-house'});const before=spec.entities.filter(e=>e.id.startsWith('v3:'));
 const report=applyNormalRoomDistinction(spec,{...config,roomPlans:[...config.roomPlans,{kind:'monster-house',entityCount:1}]});
 assert.equal(report.limits.enemy,0);assert.equal(spec.entities.filter(e=>e.type==='enemy'&&!e.id.startsWith('v3:')).length,0);
 assert.deepEqual(spec.entities.filter(e=>e.id.startsWith('v3:')),before);assert.equal(report.changes.filter(c=>c.operation==='removed-automatic-overflow').length,4);
});
test('referenced or explicit content is rejected instead of silently changing it',()=>{
 const spec=fixture();spec.events=[{trigger:{entityId:'enemy-3'},actions:[]}];
 assert.throws(()=>applyNormalRoomDistinction(spec,config),/EXPLICIT_CONTENT_CONFLICT/);
});
