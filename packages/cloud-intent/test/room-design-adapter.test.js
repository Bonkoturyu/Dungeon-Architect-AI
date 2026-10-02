import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { generateOpenAIRoomDesign } from '../src/room-design-adapter.js';
import { routeDesignIntent } from '../src/intent-router.js';
import { handleDesignIntentRequest } from '../../../functions/api/design-intent.js';
const room = {kind:'monster-house',presence:'include',roomCount:null,entityCount:5,floorNumber:null,roomId:null,offers:[]};
const value = { intent:DEFAULT_DESIGN_INTENT, roomRequests:[room], difficulty:'hard', warnings:[] };
test('structured room design preserves explicit counts and null unspecified values through router', async () => {
  let request;
  const generate = (prompt) => generateOpenAIRoomDesign(prompt, { transport: async (body) => {request=body;return {ok:true,body:{status:'completed',output_text:JSON.stringify(value)}};} });
  const result=await routeDesignIntent('敵5体のモンスターハウス',{cloudAttempt:generate,capabilities:{cloudConfigured:true,cloudProxyHealthy:true}});
  assert.equal(result.status,'success'); assert.deepEqual(result.roomRequests,[room]); assert.equal(result.difficulty,'hard');
  assert.equal(request.store,false); assert.equal(request.text.format.strict,true); assert.equal(request.text.format.schema.additionalProperties,false);
});
test('room design rejects unsafe provider output and refusal', async () => {
  const bad={...value,roomRequests:[{...room,entityCount:-1}]};
  const invalid=await generateOpenAIRoomDesign('house',{transport:async()=>({ok:true,body:{output_text:JSON.stringify(bad)}})});
  assert.equal(invalid.ok,false);
  const refusal=await generateOpenAIRoomDesign('house',{transport:async()=>({ok:true,body:{output:[{content:[{type:'refusal',refusal:'no'}]}]}})});
  assert.equal(refusal.error.code,'PROVIDER_REFUSAL');
});
test('endpoint fallback exposes room proposals only to opted-in clients and never invents numbers', async () => {
  const request=()=>new Request('https://example.test/api/design-intent',{method:'POST',body:JSON.stringify({prompt:'モンスターハウスと店',includeRoomRequests:true})});
  const response=await handleDesignIntentRequest(request(),{}); const body=await response.json();
  assert.equal(body.ok,true); assert.equal(body.roomRequests.length,2); assert.equal(body.roomRequests[0].entityCount,null); assert.ok(body.warnings.length);
  const old=await handleDesignIntentRequest(new Request('https://example.test/api/design-intent',{method:'POST',body:JSON.stringify({prompt:'shop'})}),{});
  assert.equal('roomRequests' in await old.json(),false);
});
test('room adapter retains bounded provider retry semantics', async () => {
  for (const failure of [{ok:false,status:429,retryAfter:'0'},{ok:false,status:503},{ok:true,body:{output_text:'invalid'}}]) {
    let calls=0;
    const result=await routeDesignIntent('house',{cloudAttempt:(prompt)=>generateOpenAIRoomDesign(prompt,{transport:async()=>++calls===1?failure:{ok:true,body:{output_text:JSON.stringify(value)}}}),capabilities:{cloudConfigured:true,cloudProxyHealthy:true},wait:async()=>{}});
    assert.equal(calls,2); assert.equal(result.selectedProvider,'cloud');
  }
});
test('invalid fallback count returns a controlled client error', async () => {
  const response=await handleDesignIntentRequest(new Request('https://example.test/api/design-intent',{method:'POST',body:JSON.stringify({prompt:'monster house with -5 enemies',includeRoomRequests:true})}),{});
  assert.equal(response.status,422); assert.equal((await response.json()).error.code,'ROOM_REQUEST_INVALID');
});

test('real unmocked fallback endpoint accepts separated normal/special endpoint sentences', async () => {
  for (const prompt of [
    '初心者向けダンジョン。スタートは通常の部屋。ゴールに店。',
    'A beginner dungeon. The start is a normal room. A shop at the goal.',
    '店はなし。スタートに敵2体のモンスターハウス。ゴールは通常の部屋。',
  ]) {
    const response = await handleDesignIntentRequest(new Request('https://example.test/api/design-intent', {
      method: 'POST', body: JSON.stringify({ prompt, includeRoomRequests: true }),
    }), {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true); assert.equal(body.selectedProvider, 'fallback');
    assert.ok(body.roomRequests.some(({ targetRole }) => targetRole === 'start'));
    assert.ok(body.roomRequests.some(({ targetRole }) => targetRole === 'goal'));
    if (prompt.startsWith('店はなし')) {
      assert.equal(body.roomRequests.find(({ kind, targetRole }) => kind === 'shop' && !targetRole).presence, 'exclude');
      assert.equal(body.roomRequests.find(({ targetRole }) => targetRole === 'start').entityCount, 2);
    }
  }
});

test('real fallback preserves compound roles and different endpoint kinds on different floors', async () => {
  for(const prompt of ['Start in a normal room and make the Goal random','スタートは通常の部屋、ゴールはランダム','1階のゴールに店。2階のゴールに敵3体のモンスターハウス。']) {
    const response=await handleDesignIntentRequest(new Request('https://example.test/api/design-intent',{method:'POST',body:JSON.stringify({prompt,includeRoomRequests:true})}),{});
    assert.equal(response.status,200); const body=await response.json(); assert.equal(body.selectedProvider,'fallback');
    assert.equal(body.roomRequests.length,2);
    if(prompt.startsWith('1階'))assert.deepEqual(body.roomRequests.map(({floorNumber,kind})=>[floorNumber,kind]),[[1,'shop'],[2,'monster-house']]);
    else {assert.equal(body.roomRequests.find(({targetRole})=>targetRole==='start').presence,'include');assert.equal(body.roomRequests.find(({targetRole})=>targetRole==='goal').presence,'random');}
  }
});


test('real fallback keeps integer floor sentence boundaries and rejects fractional floors', async () => {
  for (const kind of ['normal room', 'shop']) {
    const response = await handleDesignIntentRequest(new Request('https://example.test/api/design-intent', {
      method: 'POST', body: JSON.stringify({ prompt: `A ${kind} at the start on floor 2. The goal is random.`, includeRoomRequests: true }),
    }), {});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.selectedProvider, 'fallback');
    assert.deepEqual(body.roomRequests.map(({ targetRole, presence, floorNumber }) => [targetRole, presence, floorNumber]), [['start', 'include', 2], ['goal', 'random', null]]);
  }
  const invalid = await handleDesignIntentRequest(new Request('https://example.test/api/design-intent', {
    method: 'POST', body: JSON.stringify({ prompt: 'A normal room at the start on floor 2.5. The goal is random.', includeRoomRequests: true }),
  }), {});
  assert.equal(invalid.status, 422);
});
