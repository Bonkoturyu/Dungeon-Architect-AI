import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFallbackRoomRequests} from '../src/room-requests.js';
import {requestedPresencePolicies,resolveSpecialRoomPresence} from '../src/special-room-presence.js';
const defaults={roomCount:1,'monster-house':3,'trap-house':4,offers:[{type:'healing',price:10,stock:1,healing:8}]};
const resolve=(seed,requests=[],extra={})=>resolveSpecialRoomPresence({requests,defaults,floorCount:1,roomsPerFloor:8,seed,...extra});
test('unmentioned kinds have reproducible seeded 1/3 presence, with both outcomes',()=>{
 const totals={'monster-house':0,'trap-house':0,shop:0};let empty=0;
 for(let seed=0;seed<300;seed++){const first=resolve(seed);assert.deepEqual(first,resolve(seed));for(const p of first.roomPlans)totals[p.kind]++;if(!first.roomPlans.length)empty++;}
 for(const total of Object.values(totals))assert.ok(total>50&&total<150,JSON.stringify(totals));assert.ok(empty>0);
});
test('explicit include and exclude override random outcomes',()=>{
 const requests=parseFallbackRoomRequests('monster house; no trap house; no shop');
 assert.deepEqual(requestedPresencePolicies(requests),{'monster-house':'include','trap-house':'exclude',shop:'exclude'});
 for(let seed=0;seed<50;seed++)assert.deepEqual(resolve(seed,requests).roomPlans.map(p=>p.kind),['monster-house']);
 assert.deepEqual(resolve(1,parseFallbackRoomRequests('no monster house; no trap house; no shop')).roomPlans,[]);
});
test('explicit capacity wins and random candidates alone are skipped with warning',()=>{
 const requests=parseFallbackRoomRequests('monster house');
 let skipped=false;
 for(let seed=0;seed<50;seed++){
  const result=resolve(seed,requests,{roomsPerFloor:3}); assert.equal(result.roomPlans.length,1);assert.equal(result.roomPlans[0].kind,'monster-house');if(result.warnings.length)skipped=true;
 }
 assert.ok(skipped);
 assert.throws(()=>resolve(1,parseFallbackRoomRequests('monster house; trap house'),{roomsPerFloor:3}),/CAPACITY/);
});
test('manual values and explicit floors survive future random resolutions',()=>{
 const requests=parseFallbackRoomRequests('monster house'); const first=resolve(2,requests);const id=first.roomPlans.find(p=>p.kind==='monster-house').id;
 const second=resolve(55,requests,{floorCount:2,overrides:{[`${id}/entityCount`]:8,[`${id}/floorNumber`]:2}});
 const house=second.roomPlans.find(p=>p.kind==='monster-house');assert.equal(house.entityCount,8);assert.equal(house.floorNumber,2);
});
test('invalid random overrides are errors rather than silent capacity omissions',()=>{
 let seed=0;while(!resolve(seed).roomPlans.some(p=>p.kind==='monster-house'))seed++;
 const id=resolve(seed).roomPlans.find(p=>p.kind==='monster-house').id;
 for(const value of [NaN,Infinity,1000000,-1,1.5])assert.throws(()=>resolve(seed,[],{overrides:{[`${id}/entityCount`]:value}}),/Invalid explicit/);
});
test('common Japanese/English exclusion and random phrases preserve tri-state intent',()=>{
 for(const prompt of ['ショップは置かない','店を配置しない',"don't include shops",'shops are not allowed']) assert.equal(parseFallbackRoomRequests(prompt)[0].presence,'exclude');
 assert.equal(parseFallbackRoomRequests('ランダムでモンスターハウス')[0].presence,'random');
});
