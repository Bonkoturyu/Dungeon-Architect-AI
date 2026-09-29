import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateGameplayGraphGrammarCore } from '../../../generator-algorithms/gameplay-graph-grammar/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_GAMEPLAY_GRAPH_GRAMMAR_LAB_ID =
  'algorithm-lab.gameplay-graph-grammar';

function corridorSides(fromRoom,toRoom){
  const dx=toRoom.cellX-fromRoom.cellX;
  const dz=toRoom.cellZ-fromRoom.cellZ;
  if(dx===1&&dz===0) return {fromSide:'east',toSide:'west'};
  if(dx===-1&&dz===0) return {fromSide:'west',toSide:'east'};
  if(dx===0&&dz===1) return {fromSide:'south',toSide:'north'};
  if(dx===0&&dz===-1) return {fromSide:'north',toSide:'south'};
  throw new Error('Gameplay Graph Grammar edge is not cardinally adjacent: '+fromRoom.id+'/'+toRoom.id);
}

function remapEntities(baseEntities,coreResult){
  const assignmentCursor={enemy:0,treasure:0,trap:0,recovery:0};
  return baseEntities.map((entity)=>{
    const assignments=coreResult.entityAssignments[entity.type];
    if(!assignments) return {...entity};
    const cursor=assignmentCursor[entity.type]++;
    const roomIndex=assignments[cursor%assignments.length];
    return {...entity,roomId:coreResult.rooms[roomIndex].id};
  });
}

function mapCoreToDungeonSpec(baseSpec,coreResult){
  const rooms=coreResult.rooms.map((room)=>({
    id:room.id,x:room.x,z:room.z,width:room.width,depth:room.depth,
  }));
  const corridors=coreResult.finalEdges.map((edge,index)=>{
    const fromRoom=coreResult.rooms[edge.a];
    const toRoom=coreResult.rooms[edge.b];
    return {
      id:'corridor-'+String(index+1).padStart(3,'0'),
      fromRoomId:fromRoom.id,
      toRoomId:toRoom.id,
      width:3,
      kind:edge.kind==='gameplay-grammar-choice'?'alternate':'backbone',
      ...corridorSides(fromRoom,toRoom),
    };
  });
  return {
    ...baseSpec,
    rooms,
    corridors,
    entities:remapEntities(baseSpec.entities,coreResult),
  };
}

export const generatorStrategyGameplayGraphGrammarLab=createGeneratorStrategy({
  id:GENERATOR_STRATEGY_GAMEPLAY_GRAPH_GRAMMAR_LAB_ID,
  displayName:'Algorithm Lab — Gameplay Graph / Grammar',
  description:
    'Expand seeded gameplay-grammar motifs into semantic Room roles first, assign gameplay entities to those roles, then embed the resulting graph on a safe deterministic lattice.',
  family:'algorithm-lab',
  algorithmVersion:'1',
  capabilities:{designIntent:true,directParameters:true,multiFloor:true,roomGraphOutput:true,deterministic:true},
  generate(request){
    if(!request.intent) throw new TypeError('Gameplay Graph Grammar strategy requires request.intent');
    const baseline=generateDungeonFromDesignIntentV1(request.intent,{prompt:request.prompt,seed:request.seed,id:request.id});
    const options=request.options?.gameplayGraphGrammar&&typeof request.options.gameplayGraphGrammar==='object'&&!Array.isArray(request.options.gameplayGraphGrammar)
      ?request.options.gameplayGraphGrammar:{};
    const coreResult=generateGameplayGraphGrammarCore({
      ...options,
      seed:request.seed,
      roomCount:baseline.profile.roomCount,
      extraConnectionRatio:baseline.profile.routeChoice,
      enemyCount:baseline.profile.enemyCount,
      treasureCount:baseline.profile.treasureCount,
      trapCount:baseline.profile.trapCount,
      recoveryCount:baseline.profile.recoveryCount,
      greedPunishment:request.intent.greedPunishment,
      fairness:request.intent.fairness,
      exploration:request.intent.exploration,
    });
    const spec=mapCoreToDungeonSpec(baseline.spec,coreResult);
    const validation=validateDungeonSpec(spec);
    if(!validation.valid){
      throw new Error('Gameplay Graph Grammar DungeonSpec failed validation: '+validation.errors.map((entry)=>entry.code).join(','));
    }
    return {
      spec,
      provenance:{algorithm:'gameplay-graph-grammar',implementation:'generator-algorithms/gameplay-graph-grammar'},
      diagnostics:{profile:baseline.profile,core:coreResult.diagnostics,grammar:coreResult.grammar,nodes:coreResult.nodes,entityAssignments:coreResult.entityAssignments},
    };
  },
});
