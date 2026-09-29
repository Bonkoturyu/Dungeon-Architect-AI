import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateRandomWalkCore } from '../../../generator-algorithms/random-walk/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID =
  'algorithm-lab.random-walk';

function corridorSides(fromRoom, toRoom) {
  const dx = toRoom.cellX - fromRoom.cellX;
  const dz = toRoom.cellZ - fromRoom.cellZ;
  if (dx === 1 && dz === 0) return { fromSide: 'east', toSide: 'west' };
  if (dx === -1 && dz === 0) return { fromSide: 'west', toSide: 'east' };
  if (dx === 0 && dz === 1) return { fromSide: 'south', toSide: 'north' };
  if (dx === 0 && dz === -1) return { fromSide: 'north', toSide: 'south' };
  throw new Error(
    'Random Walk edge is not cardinally adjacent: ' +
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

  const corridors = coreResult.finalEdges.map((edge, index) => {
    const fromRoom = coreResult.rooms[edge.a];
    const toRoom = coreResult.rooms[edge.b];
    return {
      id: 'corridor-' + String(index + 1).padStart(3, '0'),
      fromRoomId: fromRoom.id,
      toRoomId: toRoom.id,
      width: 3,
      kind:
        edge.kind === 'random-walk-loop'
          ? 'alternate'
          : 'backbone',
      ...corridorSides(fromRoom, toRoom),
    };
  });

  return {
    ...baseSpec,
    rooms,
    corridors,
  };
}

export const generatorStrategyRandomWalkLab =
  createGeneratorStrategy({
    id: GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
    displayName: 'Algorithm Lab — Random Walk',
    description:
      'Discover Room cells through a deterministic drunkard walk, preserve first-discovery edges as a guaranteed spanning tree, then add bounded loops from adjacent visited cells.',
    family: 'algorithm-lab',
    algorithmVersion: '1',
    capabilities: {
      designIntent: true,
      directParameters: true,
      multiFloor: true,
      roomGraphOutput: true,
      deterministic: true,
    },
    generate(request) {
      if (!request.intent) {
        throw new TypeError('Random Walk strategy requires request.intent');
      }

      const baseline = generateDungeonFromDesignIntentV1(
        request.intent,
        {
          prompt: request.prompt,
          seed: request.seed,
          id: request.id,
        },
      );

      const options =
        request.options?.randomWalk &&
        typeof request.options.randomWalk === 'object' &&
        !Array.isArray(request.options.randomWalk)
          ? request.options.randomWalk
          : {};

      const coreResult = generateRandomWalkCore({
        ...options,
        seed: request.seed,
        roomCount: baseline.profile.roomCount,
        extraConnectionRatio: baseline.profile.routeChoice,
      });

      const spec = mapCoreToDungeonSpec(baseline.spec, coreResult);
      const validation = validateDungeonSpec(spec);
      if (!validation.valid) {
        throw new Error(
          'Random Walk DungeonSpec failed validation: ' +
            validation.errors.map((entry) => entry.code).join(','),
        );
      }

      return {
        spec,
        provenance: {
          algorithm: 'random-walk',
          implementation: 'generator-algorithms/random-walk',
        },
        diagnostics: {
          profile: baseline.profile,
          core: coreResult.diagnostics,
        },
      };
    },
  });
