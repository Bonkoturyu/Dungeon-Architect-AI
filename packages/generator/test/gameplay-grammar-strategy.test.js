import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID,
  generatorStrategyGameplayGrammarLab,
} from '../src/strategies/gameplay-grammar-lab.js';

const request={
  seed:20260929,
  id:'gameplay-grammar-lab-test',
  prompt:'semantic challenge reward grammar with route choices',
  intent:{
    ...DEFAULT_DESIGN_INTENT,
    fairness:0.8,
    targetDuration:600,
    routeChoice:0.75,
    exploration:0.82,
    combatDensity:0.7,
    trapDensity:0.55,
    rewardDensity:0.7,
    deception:0.5,
  },
};

test('Gameplay Grammar Algorithm Lab adapter produces a valid DungeonSpec',async()=>{
  const result=await generatorStrategyGameplayGrammarLab.generate(request);
  const validation=validateDungeonSpec(result.spec);
  assert.equal(validation.valid,true);
  assert.equal(result.spec.rooms.length,10);
  assert.equal(result.provenance.strategyId,GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID);
  assert.equal(result.provenance.algorithmVersion,'1');
  assert.equal(result.provenance.algorithm,'gameplay-grammar');
  assert.ok(result.diagnostics.core.derivationStepCount>=1);
});

test('Gameplay Grammar Algorithm Lab adapter is deterministic',async()=>{
  const left=await generatorStrategyGameplayGrammarLab.generate(request);
  const right=await generatorStrategyGameplayGrammarLab.generate(request);
  assert.deepEqual(left,right);
});

test('Gameplay Grammar adapter maps Start and Goal to grammar roles',async()=>{
  const result=await generatorStrategyGameplayGrammarLab.generate(request);
  const roleByRoom=new Map(result.diagnostics.roomRoles.map((entry)=>[entry.roomId,entry.role]));
  const start=result.spec.entities.find((entity)=>entity.type==='start');
  const goal=result.spec.entities.find((entity)=>entity.type==='goal');
  assert.equal(roleByRoom.get(start.roomId),'start');
  assert.equal(roleByRoom.get(goal.roomId),'goal');
});

test('Gameplay Grammar adapter places content by semantic role priority',async()=>{
  const result=await generatorStrategyGameplayGrammarLab.generate(request);
  const roleByRoom=new Map(result.diagnostics.roomRoles.map((entry)=>[entry.roomId,entry.role]));
  const allowed={
    enemy:new Set(['challenge','climax','hazard','traversal','reward','recovery']),
    treasure:new Set(['reward','hazard','challenge','traversal','recovery','climax']),
    trap:new Set(['hazard','challenge','traversal','reward','climax','recovery']),
    recovery:new Set(['recovery','reward','traversal','challenge','hazard','climax']),
  };
  for(const entity of result.spec.entities){
    if(!allowed[entity.type]) continue;
    assert.equal(allowed[entity.type].has(roleByRoom.get(entity.roomId)),true);
  }
});

test('Gameplay Grammar preserves V1 content counts and entity-referenced Events',async()=>{
  const result=await generatorStrategyGameplayGrammarLab.generate(request);
  for(const [type,expected] of [
    ['enemy',result.diagnostics.profile.enemyCount],
    ['treasure',result.diagnostics.profile.treasureCount],
    ['trap',result.diagnostics.profile.trapCount],
    ['recovery',result.diagnostics.profile.recoveryCount],
  ]){
    assert.equal(result.spec.entities.filter((entity)=>entity.type===type).length,expected);
  }
  const firstTreasure=result.spec.entities.find((entity)=>entity.type==='treasure');
  if(firstTreasure){
    assert.equal(result.spec.events[0]?.trigger?.entityId,firstTreasure.id);
  }
});

test('Gameplay Grammar adapter emits exact cardinal corridor side hints',async()=>{
  const result=await generatorStrategyGameplayGrammarLab.generate(request);
  const roomById=new Map(result.spec.rooms.map((room)=>[room.id,room]));
  for(const corridor of result.spec.corridors){
    const from=roomById.get(corridor.fromRoomId);
    const to=roomById.get(corridor.toRoomId);
    const dx=to.x-from.x;
    const dz=to.z-from.z;
    if(dx>0){
      assert.equal(corridor.fromSide,'east');
      assert.equal(corridor.toSide,'west');
    }else if(dx<0){
      assert.equal(corridor.fromSide,'west');
      assert.equal(corridor.toSide,'east');
    }else if(dz>0){
      assert.equal(corridor.fromSide,'south');
      assert.equal(corridor.toSide,'north');
    }else{
      assert.equal(corridor.fromSide,'north');
      assert.equal(corridor.toSide,'south');
    }
  }
});

test('Gameplay Grammar-specific options stay behind request.options',async()=>{
  const result=await generatorStrategyGameplayGrammarLab.generate({
    ...request,
    options:{gameplayGrammar:{roomSizeMin:8,roomSizeMax:8,cellSpacing:16}},
  });
  assert.ok(result.spec.rooms.every((room)=>room.width===8&&room.depth===8));
});
