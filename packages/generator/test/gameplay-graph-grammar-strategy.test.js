import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import { GENERATOR_STRATEGY_GAMEPLAY_GRAPH_GRAMMAR_LAB_ID,generatorStrategyGameplayGraphGrammarLab } from '../src/strategies/gameplay-graph-grammar-lab.js';

const request={seed:20260929,id:'gameplay-graph-grammar-test',prompt:'meaningful challenge reward progression',intent:{...DEFAULT_DESIGN_INTENT,fairness:0.8,targetDuration:600,routeChoice:0.65,exploration:0.82,greedPunishment:0.72}};

test('Gameplay Graph Grammar adapter produces a valid DungeonSpec',async()=>{
  const result=await generatorStrategyGameplayGraphGrammarLab.generate(request);
  assert.equal(validateDungeonSpec(result.spec).valid,true);
  assert.equal(result.spec.rooms.length,10);
  assert.equal(result.provenance.strategyId,GENERATOR_STRATEGY_GAMEPLAY_GRAPH_GRAMMAR_LAB_ID);
  assert.equal(result.provenance.algorithmVersion,'1');
  assert.equal(result.provenance.algorithm,'gameplay-graph-grammar');
  assert.equal(result.diagnostics.core.treeEdgeCount,result.spec.rooms.length-1);
});

test('Gameplay Graph Grammar adapter is deterministic',async()=>{
  const a=await generatorStrategyGameplayGraphGrammarLab.generate(request);
  const b=await generatorStrategyGameplayGraphGrammarLab.generate(request);
  assert.deepEqual(a,b);
});

test('Gameplay Graph Grammar preserves entity counts while applying semantic Room assignments',async()=>{
  const result=await generatorStrategyGameplayGraphGrammarLab.generate(request);
  for(const [type,expected] of [['enemy',result.diagnostics.profile.enemyCount],['treasure',result.diagnostics.profile.treasureCount],['trap',result.diagnostics.profile.trapCount],['recovery',result.diagnostics.profile.recoveryCount]]){
    const entities=result.spec.entities.filter((entity)=>entity.type===type);
    assert.equal(entities.length,expected);
    assert.ok(entities.every((entity)=>entity.roomId!=='room-001'&&entity.roomId!==result.spec.rooms.at(-1).id));
  }
});

test('Gameplay Graph Grammar adapter emits exact cardinal corridor sides',async()=>{
  const result=await generatorStrategyGameplayGraphGrammarLab.generate(request);
  const roomById=new Map(result.spec.rooms.map((room)=>[room.id,room]));
  for(const corridor of result.spec.corridors){
    const a=roomById.get(corridor.fromRoomId),b=roomById.get(corridor.toRoomId);
    const dx=b.x-a.x,dz=b.z-a.z;
    if(dx>0){assert.equal(corridor.fromSide,'east');assert.equal(corridor.toSide,'west');}
    else if(dx<0){assert.equal(corridor.fromSide,'west');assert.equal(corridor.toSide,'east');}
    else if(dz>0){assert.equal(corridor.fromSide,'south');assert.equal(corridor.toSide,'north');}
    else{assert.equal(corridor.fromSide,'north');assert.equal(corridor.toSide,'south');}
  }
});

test('Gameplay Graph Grammar options remain behind request.options',async()=>{
  const result=await generatorStrategyGameplayGraphGrammarLab.generate({...request,options:{gameplayGraphGrammar:{roomSizeMin:8,roomSizeMax:8,cellSpacing:16}}});
  assert.ok(result.spec.rooms.every((room)=>room.width===8&&room.depth===8));
});
