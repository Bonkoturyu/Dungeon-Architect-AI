import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFallbackRoomRequests, validateRoomRequests, resolveRoomRequests } from '../src/room-requests.js';
const defaults = { roomCount: 1, 'monster-house': 3, 'trap-house': 4, offers: [{type:'healing',price:10,stock:1,healing:8},{type:'weapon',tier:2,price:20,stock:1}] };
test('room requests keep missing values null and recognize counts independently', () => {
  const requests = parseFallbackRoomRequests('モンスターハウスを2部屋、敵5体。トラップハウスは3階で罠6個。店で回復8HP 12Gと武器T2 25G');
  assert.equal(validateRoomRequests(requests).valid, true);
  assert.equal(requests[0].roomCount, 2); assert.equal(requests[0].entityCount, 5);
  assert.equal(requests[1].floorNumber, 3); assert.equal(requests[1].entityCount, 6);
  assert.equal(requests[2].offers[0].price, 12); assert.equal(requests[2].offers[1].tier, 2);
});
test('fallback honors basic negation and avoids incidental shop substrings', () => {
  assert.deepEqual(parseFallbackRoomRequests('no monster house; トラップハウスはなし。without shops. restore walls').map(r=>[r.kind,r.presence]), [['monster-house','exclude'],['trap-house','exclude'],['shop','exclude']]);
});
test('confirmed proposals preserve explicit values and distribute only requested room count across floors', () => {
  const requests = parseFallbackRoomRequests('monster house with 5 enemies; shop');
  const plans = resolveRoomRequests(requests, defaults, {floorCount:3,seed:42});
  assert.equal(plans.length,2); assert.equal(plans[0].entityCount,5); assert.equal(plans[1].offers[0].price,10);
  assert.deepEqual(plans,resolveRoomRequests(requests,defaults,{floorCount:3,seed:42}));
  assert.throws(()=>resolveRoomRequests(parseFallbackRoomRequests('shop floor 8'),defaults,{floorCount:3,seed:42}),/FLOOR/);
});
test('room schema rejects unsupported fields, unsafe prices, non-applicable effects', () => {
  const requests=parseFallbackRoomRequests('shop'); requests[0].arbitrary=true;
  assert.equal(validateRoomRequests(requests).valid,false);
  const shop=parseFallbackRoomRequests('shop'); shop[0].offers=[{type:'healing',price:Number.MAX_SAFE_INTEGER+1,stock:1,healing:8,tier:null}];
  assert.equal(validateRoomRequests(shop).valid,false);
});
test('fallback scopes multiple floors and rejects fractional or negative content counts', () => {
  const plans=parseFallbackRoomRequests('monster house on floor 1 with 3 enemies and trap house on floor 2 with 4 traps');
  assert.deepEqual(plans.map(p=>p.floorNumber),[1,2]);
  assert.equal(parseFallbackRoomRequests('floor 2 monster house with 5 enemies')[0].roomCount,null);
  for (const prompt of ['monster house with 2.5 enemies','monster house with -5 enemies']) assert.throws(()=>parseFallbackRoomRequests(prompt),/INTEGER/);
  assert.equal(parseFallbackRoomRequests('shop selling healing 8HP 10G stock 2')[0].offers[0].stock,2);
});
test('fully explicit equipment outside proposed tiers remains explicit', () => {
  const requests=[{kind:'shop',roomCount:1,entityCount:null,floorNumber:1,roomId:null,offers:[{type:'weapon',price:50,stock:2,tier:4,healing:null}]}];
  const plans=resolveRoomRequests(requests,defaults,{floorCount:1});
  assert.deepEqual(plans[0].offers,[{id:'offer-1',type:'weapon',price:50,stock:2,tier:4}]);
});
test('difficulty fallback respects whole words, negation and ambiguous requests', async () => {
  const {inferRequestedDifficulty}=await import('../src/room-requests.js');
  for(const [prompt,expected] of [['not hard, normal dungeon','normal'],['not easy, make it hard','hard'],['hardly any enemies',null],['難しいのではなく普通で','normal'],['easy and hard',null]]) assert.equal(inferRequestedDifficulty(prompt),expected);
});
test('request capacity and multiplicative room counts fail before expansion', () => {
  assert.throws(()=>parseFallbackRoomRequests('monster house with 1000000000 enemies'),/CAPACITY/);
  const house={kind:'monster-house',roomCount:2,entityCount:200,floorNumber:1,roomId:null,offers:[]};
  assert.equal(validateRoomRequests([house]).valid,false);
  assert.equal(validateRoomRequests([{...house,roomCount:1,entityCount:250}]).valid,true);
  assert.throws(()=>resolveRoomRequests([{...house,floorNumber:null,entityCount:3,roomCount:20},{...house,floorNumber:null,entityCount:3,roomCount:1}],defaults,{floorCount:1}),/CAPACITY/);
});
test('fallback preserves negation around conjunctions and rejects bad prefix numbers', () => {
  assert.deepEqual(parseFallbackRoomRequests('monster house with 3 enemies but no trap house').filter(p=>p.presence==='include').map(p=>p.kind),['monster-house']);
  for(const prompt of ['shop healing 8HP 10G stock 2.5','shop healing 8HP 10G stock -2','shop weapon T2.5 10G']) assert.throws(()=>parseFallbackRoomRequests(prompt),/INTEGER/);
});
