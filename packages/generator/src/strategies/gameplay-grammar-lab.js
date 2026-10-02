import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateGameplayGrammarCore } from '../../../generator-algorithms/gameplay-grammar/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID =
  'algorithm-lab.gameplay-grammar';

const ROLE_PRIORITY_BY_ENTITY = Object.freeze({
  enemy: ['challenge','climax','hazard','traversal','reward','recovery'],
  treasure: ['reward','hazard','challenge','traversal','recovery','climax'],
  trap: ['hazard','challenge','traversal','reward','climax','recovery'],
  recovery: ['recovery','reward','traversal','challenge','hazard','climax'],
});

function corridorSides(fromRoom,toRoom){
  const dx=toRoom.cellX-fromRoom.cellX;
  const dz=toRoom.cellZ-fromRoom.cellZ;
  if(dx===1&&dz===0) return {fromSide:'east',toSide:'west'};
  if(dx===-1&&dz===0) return {fromSide:'west',toSide:'east'};
  if(dx===0&&dz===1) return {fromSide:'south',toSide:'north'};
  if(dx===0&&dz===-1) return {fromSide:'north',toSide:'south'};
  throw new Error(
    'Gameplay Grammar edge is not cardinally adjacent: '+
      fromRoom.id+'/'+toRoom.id,
  );
}

function orderedCandidateRooms(rooms,type){
  const priorities=ROLE_PRIORITY_BY_ENTITY[type]??['traversal','challenge','reward','hazard','recovery','climax'];
  const candidates=[];
  const seen=new Set();
  for(const role of priorities){
    for(const room of rooms){
      if(room.role!==role||seen.has(room.id)) continue;
      candidates.push(room);
      seen.add(room.id);
    }
  }
  for(const room of rooms){
    if(room.role==='start'||room.role==='goal'||seen.has(room.id)) continue;
    candidates.push(room);
    seen.add(room.id);
  }
  return candidates;
}

function mapEntities(baseEntities,rooms){
  const startRoom=rooms.find((room)=>room.role==='start');
  const goalRoom=rooms.find((room)=>room.role==='goal');
  if(!startRoom||!goalRoom){
    throw new Error('Gameplay Grammar requires start and goal role Rooms');
  }
  const counters=new Map();
  return baseEntities.map((entity)=>{
    if(entity.type==='start') return {...entity,roomId:startRoom.id};
    if(entity.type==='goal') return {...entity,roomId:goalRoom.id};
    const candidates=orderedCandidateRooms(rooms,entity.type);
    if(candidates.length===0){
      throw new Error('Gameplay Grammar has no semantic Room candidate for '+entity.type);
    }
    const index=counters.get(entity.type)??0;
    counters.set(entity.type,index+1);
    return {
      ...entity,
      roomId:candidates[index%candidates.length].id,
    };
  });
}

function mapCoreToDungeonSpec(baseSpec,coreResult){
  const rooms=coreResult.rooms.map((room)=>({
    id:room.id,
    x:room.x,
    z:room.z,
    width:room.width,
    depth:room.depth,
  }));
  const corridors=coreResult.edges.map((edge,index)=>{
    const fromRoom=coreResult.rooms[edge.a];
    const toRoom=coreResult.rooms[edge.b];
    return {
      id:'corridor-'+String(index+1).padStart(3,'0'),
      fromRoomId:fromRoom.id,
      toRoomId:toRoom.id,
      width:3,
      kind:edge.kind==='grammar-bypass'?'alternate':'backbone',
      ...corridorSides(fromRoom,toRoom),
    };
  });
  const entities=mapEntities(baseSpec.entities,coreResult.rooms);
  return {
    ...baseSpec,
    rooms,
    corridors,
    entities,
  };
}

export const generatorStrategyGameplayGrammarLab=createGeneratorStrategy({
  id:GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID,
  displayName:'Algorithm Lab — Gameplay Graph / Grammar',
  description:
    'Expand a deterministic gameplay grammar into a semantic critical spine plus challenge/reward/hazard detours and bypasses, then embed that graph into cardinal Room geometry.',
  family:'algorithm-lab',
  algorithmVersion:'1',
  capabilities:{
    designIntent:true,
    directParameters:true,
    multiFloor:true,
    roomGraphOutput:true,
    deterministic:true,
  },
  generate(request){
    if(!request.intent){
      throw new TypeError('Gameplay Grammar strategy requires request.intent');
    }
    const baseline=generateDungeonFromDesignIntentV1(
      request.intent,
      {prompt:request.prompt,seed:request.seed,id:request.id},
    );
    const options=
      request.options?.gameplayGrammar &&
      typeof request.options.gameplayGrammar==='object' &&
      !Array.isArray(request.options.gameplayGrammar)
        ? request.options.gameplayGrammar
        : {};
    const recoveryWeight=Math.max(
      0,
      Math.min(
        1,
        (request.intent.fairness+(1-request.intent.targetDifficulty))/2,
      ),
    );
    const coreResult=generateGameplayGrammarCore({
      ...options,
      seed:request.seed,
      roomCount:baseline.profile.roomCount,
      routeChoice:request.intent.routeChoice,
      exploration:request.intent.exploration,
      combatWeight:request.intent.combatDensity,
      hazardWeight:request.intent.trapDensity,
      rewardWeight:request.intent.rewardDensity,
      deceptionWeight:request.intent.deception,
      recoveryWeight,
    });
    const spec=mapCoreToDungeonSpec(baseline.spec,coreResult);
    const validation=validateDungeonSpec(spec);
    if(!validation.valid){
      throw new Error(
        'Gameplay Grammar DungeonSpec failed validation: '+
          validation.errors.map((entry)=>entry.code).join(','),
      );
    }
    return {
      spec,
      provenance:{
        algorithm:'gameplay-grammar',
        implementation:'generator-algorithms/gameplay-grammar',
      },
      diagnostics:{
        profile:baseline.profile,
        core:coreResult.diagnostics,
        derivation:coreResult.derivation,
        roomRoles:coreResult.rooms.map((room)=>({
          roomId:room.id,
          nodeId:room.nodeId,
          role:room.role,
          source:room.source,
        })),
      },
    };
  },
});
