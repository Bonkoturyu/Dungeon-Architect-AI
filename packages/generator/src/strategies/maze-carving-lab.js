import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateMazeCarvingCore } from '../../../generator-algorithms/maze-carving/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID =
  'algorithm-lab.maze-carving';

function corridorSides(fromRoom, toRoom) {
  const dx = toRoom.cellX - fromRoom.cellX;
  const dz = toRoom.cellZ - fromRoom.cellZ;
  if (Math.abs(dx - 1) < 1e-9 && Math.abs(dz) < 1e-9) return { fromSide: 'east', toSide: 'west' };
  if (Math.abs(dx + 1) < 1e-9 && Math.abs(dz) < 1e-9) return { fromSide: 'west', toSide: 'east' };
  if (Math.abs(dz - 1) < 1e-9 && Math.abs(dx) < 1e-9) return { fromSide: 'south', toSide: 'north' };
  if (Math.abs(dz + 1) < 1e-9 && Math.abs(dx) < 1e-9) return { fromSide: 'north', toSide: 'south' };
  throw new Error(
    'Maze Carving edge is not cardinally adjacent: ' +
      fromRoom.id + '/' + toRoom.id,
  );
}

function mapCoreToDungeonSpec(baseSpec, coreResult) {
  const rooms = coreResult.rooms.map((room) => ({
    id: room.id,
    x: room.x,
    z: room.z,
    width: room.width,
    depth: room.depth,
  }));

  const corridors = coreResult.finalEdges.map((edge,index) => {
    const fromRoom=coreResult.rooms[edge.a];
    const toRoom=coreResult.rooms[edge.b];
    return {
      id:'corridor-' + String(index+1).padStart(3,'0'),
      fromRoomId:fromRoom.id,
      toRoomId:toRoom.id,
      width:3,
      kind: edge.kind === 'maze-carving-loop' ? 'alternate' : 'backbone',
      ...corridorSides(fromRoom,toRoom),
    };
  });

  return { ...baseSpec, rooms, corridors };
}

export const generatorStrategyMazeCarvingLab = createGeneratorStrategy({
  id: GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
  displayName: 'Algorithm Lab — Maze Carving',
  description:
    'Build a compact fixed Room lattice, shuffle all adjacent walls by Seed, carve a perfect maze with randomized Kruskal, then restore bounded unused walls as route-choice loops.',
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
      throw new TypeError('Maze Carving strategy requires request.intent');
    }

    const baseline=generateDungeonFromDesignIntentV1(
      request.intent,
      { prompt:request.prompt, seed:request.seed, id:request.id },
    );

    const options=
      request.options?.mazeCarving &&
      typeof request.options.mazeCarving === 'object' &&
      !Array.isArray(request.options.mazeCarving)
        ? request.options.mazeCarving
        : {};

    const coreResult=generateMazeCarvingCore({
      ...options,
      seed:request.seed,
      roomCount:baseline.profile.roomCount,
      extraConnectionRatio:baseline.profile.routeChoice,
    });

    const spec=mapCoreToDungeonSpec(baseline.spec,coreResult);
    const validation=validateDungeonSpec(spec);
    if(!validation.valid){
      throw new Error(
        'Maze Carving DungeonSpec failed validation: ' +
          validation.errors.map((entry)=>entry.code).join(','),
      );
    }

    return {
      spec,
      provenance:{
        algorithm:'maze-carving',
        implementation:'generator-algorithms/maze-carving',
      },
      diagnostics:{
        profile:baseline.profile,
        core:coreResult.diagnostics,
      },
    };
  },
});
