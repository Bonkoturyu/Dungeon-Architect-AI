import assert from 'node:assert/strict';
import test from 'node:test';
import { generateGameplayGraphGrammarCore } from '../src/index.js';

test('Gameplay Graph Grammar Core is deterministic',()=>{
  const input={seed:20260929,roomCount:12,extraConnectionRatio:0.6,enemyCount:3,treasureCount:4,trapCount:2,recoveryCount:1,greedPunishment:0.7,fairness:0.8,exploration:0.75};
  assert.deepEqual(generateGameplayGraphGrammarCore(input),generateGameplayGraphGrammarCore(input));
});

test('different Seeds alter grammar expansion, transform, roles, or Room sizes',()=>{
  const a=generateGameplayGraphGrammarCore({seed:1,roomCount:12});
  const b=generateGameplayGraphGrammarCore({seed:2,roomCount:12});
  assert.notEqual(JSON.stringify({g:a.grammar,n:a.nodes,r:a.rooms}),JSON.stringify({g:b.grammar,n:b.nodes,r:b.rooms}));
});

test('grammar always emits Start and Goal terminals with N Rooms',()=>{
  for(const roomCount of [3,5,8,12,20,32,64]){
    const g=generateGameplayGraphGrammarCore({seed:100+roomCount,roomCount});
    assert.equal(g.nodes.length,roomCount);
    assert.deepEqual(g.nodes[0].roles,['start']);
    assert.deepEqual(g.nodes.at(-1).roles,['goal']);
    assert.equal(g.backboneEdges.length,roomCount-1);
  }
});

test('grammar records explicit production applications',()=>{
  const g=generateGameplayGraphGrammarCore({seed:99,roomCount:10});
  assert.equal(g.grammar.rootRule,'DUNGEON -> START PROGRESS GOAL');
  assert.ok(g.grammar.applications.length>0);
  assert.ok(g.grammar.applications.every((entry)=>entry.rule.startsWith('PROGRESS -> ')));
});

test('semantic counts force matching role families to exist',()=>{
  const g=generateGameplayGraphGrammarCore({seed:77,roomCount:10,enemyCount:2,treasureCount:2,trapCount:2,recoveryCount:1});
  assert.ok(g.nodes.some((node)=>node.roles.includes('challenge')));
  assert.ok(g.nodes.some((node)=>node.roles.includes('reward')));
  assert.ok(g.nodes.some((node)=>node.roles.includes('hazard')));
  assert.ok(g.nodes.some((node)=>node.roles.includes('recovery')));
});

test('entity assignments preserve exact requested counts and avoid Start/Goal',()=>{
  const counts={enemyCount:5,treasureCount:6,trapCount:4,recoveryCount:3};
  const g=generateGameplayGraphGrammarCore({seed:123,roomCount:12,...counts});
  assert.equal(g.entityAssignments.enemy.length,counts.enemyCount);
  assert.equal(g.entityAssignments.treasure.length,counts.treasureCount);
  assert.equal(g.entityAssignments.trap.length,counts.trapCount);
  assert.equal(g.entityAssignments.recovery.length,counts.recoveryCount);
  for(const indices of Object.values(g.entityAssignments)){
    assert.ok(indices.every((index)=>index>0&&index<11));
  }
});

test('routeChoice controls only cardinal lattice choice edges',()=>{
  const zero=generateGameplayGraphGrammarCore({seed:98765,roomCount:20,extraConnectionRatio:0});
  const full=generateGameplayGraphGrammarCore({seed:98765,roomCount:20,extraConnectionRatio:1});
  assert.equal(zero.extraEdges.length,0);
  assert.equal(full.extraEdges.length,full.diagnostics.extraCandidateCount);
  for(const edge of full.extraEdges){
    const a=full.nodes[edge.a].cell;
    const b=full.nodes[edge.b].cell;
    assert.equal(Math.abs(a.x-b.x)+Math.abs(a.z-b.z),1);
  }
});

test('logical lattice changes orientation by Seed while staying non-overlapping after embedding',()=>{
  const g=generateGameplayGraphGrammarCore({seed:15,roomCount:20});
  for(let i=0;i<g.rooms.length;i+=1){
    for(let j=i+1;j<g.rooms.length;j+=1){
      const a=g.rooms[i],b=g.rooms[j];
      const overlapX=Math.min(a.x+a.width/2,b.x+b.width/2)-Math.max(a.x-a.width/2,b.x-b.width/2);
      const overlapZ=Math.min(a.z+a.depth/2,b.z+b.depth/2)-Math.max(a.z-a.depth/2,b.z-b.depth/2);
      assert.equal(overlapX>1e-9&&overlapZ>1e-9,false);
    }
  }
});

test('grammar role diagnostics match terminal nodes',()=>{
  const g=generateGameplayGraphGrammarCore({seed:42,roomCount:14});
  for(const [role,count] of Object.entries(g.diagnostics.roleCounts)){
    assert.equal(count,g.nodes.filter((node)=>node.roles.includes(role)).length);
  }
});

test('invalid Gameplay Graph Grammar options fail closed',()=>{
  assert.throws(()=>generateGameplayGraphGrammarCore({seed:-1}),/seed/);
  assert.throws(()=>generateGameplayGraphGrammarCore({seed:1,roomCount:2}),/roomCount/);
  assert.throws(()=>generateGameplayGraphGrammarCore({seed:1,enemyCount:-1}),/enemyCount/);
  assert.throws(()=>generateGameplayGraphGrammarCore({seed:1,exploration:2}),/exploration/);
});
