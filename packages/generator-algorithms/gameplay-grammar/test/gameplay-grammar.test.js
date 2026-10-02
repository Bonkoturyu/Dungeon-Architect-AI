import assert from 'node:assert/strict';
import test from 'node:test';
import { generateGameplayGrammarCore } from '../src/index.js';

test('Gameplay Grammar Core is deterministic for the same Seed',()=>{
  const input={seed:20260929,roomCount:16,routeChoice:0.7,exploration:0.8};
  assert.deepEqual(generateGameplayGrammarCore(input),generateGameplayGrammarCore(input));
});

test('Gameplay Grammar emits exactly requested nodes and Rooms',()=>{
  for(const roomCount of [3,5,8,12,20,32,64]){
    const generated=generateGameplayGrammarCore({seed:1000+roomCount,roomCount});
    assert.equal(generated.nodes.length,roomCount);
    assert.equal(generated.rooms.length,roomCount);
    assert.equal(generated.nodes[0].role,'start');
    assert.equal(generated.nodes[generated.diagnostics.spineCount-1].role,'goal');
  }
});

test('Gameplay Grammar graph stays connected and all edges are cardinal',()=>{
  const generated=generateGameplayGrammarCore({
    seed:424242,roomCount:28,routeChoice:1,exploration:0.9,
  });
  for(const edge of generated.edges){
    const a=generated.rooms[edge.a];
    const b=generated.rooms[edge.b];
    assert.equal(Math.abs(a.cellX-b.cellX)+Math.abs(a.cellZ-b.cellZ),1);
  }
});

test('high routeChoice converts available 3-node detours into bypass loops',()=>{
  const low=generateGameplayGrammarCore({seed:5555,roomCount:20,routeChoice:0,exploration:0.9});
  const high=generateGameplayGrammarCore({seed:5555,roomCount:20,routeChoice:1,exploration:0.9});
  assert.equal(low.diagnostics.bypassBranchCount,0);
  assert.ok(high.diagnostics.bypassBranchCount>=1);
  assert.ok(high.diagnostics.cycleRank>low.diagnostics.cycleRank);
});

test('Gameplay Grammar exposes explicit derivation trace',()=>{
  const generated=generateGameplayGrammarCore({seed:7654,roomCount:14,routeChoice:0.6,exploration:0.7});
  assert.equal(generated.derivation[0].rule,'MISSION→SPINE');
  assert.equal(generated.derivation.length,generated.diagnostics.derivationStepCount);
  assert.ok(generated.derivation.some((step)=>step.rule.startsWith('CHOICE→')));
});

test('semantic weights influence generated gameplay roles',()=>{
  const challenge=generateGameplayGrammarCore({
    seed:9090,roomCount:24,combatWeight:1,hazardWeight:0,rewardWeight:0,recoveryWeight:0,exploration:0,
  });
  const reward=generateGameplayGrammarCore({
    seed:9090,roomCount:24,combatWeight:0,hazardWeight:0,rewardWeight:1,recoveryWeight:0,exploration:0,
  });
  assert.notDeepEqual(challenge.diagnostics.roleCounts,reward.diagnostics.roleCounts);
});

test('Gameplay Grammar Rooms do not overlap at default spacing',()=>{
  const generated=generateGameplayGrammarCore({seed:3333,roomCount:40,routeChoice:1,exploration:1});
  for(let left=0;left<generated.rooms.length;left+=1){
    for(let right=left+1;right<generated.rooms.length;right+=1){
      const a=generated.rooms[left];
      const b=generated.rooms[right];
      const overlapX=Math.min(a.x+a.width/2,b.x+b.width/2)-Math.max(a.x-a.width/2,b.x-b.width/2);
      const overlapZ=Math.min(a.z+a.depth/2,b.z+b.depth/2)-Math.max(a.z-a.depth/2,b.z-b.depth/2);
      assert.equal(overlapX>1e-9&&overlapZ>1e-9,false);
    }
  }
});

test('different Seeds can change roles or branch placement',()=>{
  const left=generateGameplayGrammarCore({seed:1,roomCount:18,routeChoice:0.7,exploration:0.8});
  const right=generateGameplayGrammarCore({seed:2,roomCount:18,routeChoice:0.7,exploration:0.8});
  assert.notEqual(JSON.stringify({nodes:left.nodes,rooms:left.rooms}),JSON.stringify({nodes:right.nodes,rooms:right.rooms}));
});

test('Gameplay Grammar embeds Start and Goal on distinct spine endpoints',()=>{
  const generated=generateGameplayGrammarCore({seed:1212,roomCount:12});
  const start=generated.nodes[0];
  const goal=generated.nodes[generated.diagnostics.spineCount-1];
  assert.equal(start.role,'start');
  assert.equal(goal.role,'goal');
  assert.notEqual(start.cellX,goal.cellX);
});

test('invalid Gameplay Grammar options fail closed',()=>{
  assert.throws(()=>generateGameplayGrammarCore({seed:-1}),/seed/);
  assert.throws(()=>generateGameplayGrammarCore({seed:1,roomCount:2}),/roomCount/);
  assert.throws(()=>generateGameplayGrammarCore({seed:1,routeChoice:1.1}),/routeChoice/);
  assert.throws(()=>generateGameplayGrammarCore({seed:1,combatWeight:-0.1}),/combatWeight/);
});
