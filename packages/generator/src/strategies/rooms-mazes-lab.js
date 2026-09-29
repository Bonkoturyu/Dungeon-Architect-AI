import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateRoomsMazesCore } from '../../../generator-algorithms/rooms-mazes/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID =
  'algorithm-lab.rooms-mazes';

function corridorSides(fromRoom, toRoom) {
  const dx = toRoom.cellX - fromRoom.cellX;
  const dz = toRoom.cellZ - fromRoom.cellZ;

  if (dx === 1 && dz === 0) {
    return { fromSide: 'east', toSide: 'west' };
  }
  if (dx === -1 && dz === 0) {
    return { fromSide: 'west', toSide: 'east' };
  }
  if (dx === 0 && dz === 1) {
    return { fromSide: 'south', toSide: 'north' };
  }
  if (dx === 0 && dz === -1) {
    return { fromSide: 'north', toSide: 'south' };
  }
  throw new Error(
    'Rooms+Mazes edge is not cardinally adjacent: ' +
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
    const fromCoreRoom = coreResult.rooms[edge.a];
    const toCoreRoom = coreResult.rooms[edge.b];
    const sides = corridorSides(fromCoreRoom, toCoreRoom);

    return {
      id: 'corridor-' + String(index + 1).padStart(3, '0'),
      fromRoomId: fromCoreRoom.id,
      toRoomId: toCoreRoom.id,
      width: 3,
      kind:
        edge.kind === 'rooms-mazes-loop'
          ? 'alternate'
          : 'backbone',
      ...sides,
    };
  });

  return {
    ...baseSpec,
    rooms,
    corridors,
  };
}

export const generatorStrategyRoomsMazesLab =
  createGeneratorStrategy({
    id: GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
    displayName: 'Algorithm Lab — Rooms + Mazes',
    description:
      'Place Rooms on a connected coarse grid, carve a deterministic perfect maze across local adjacencies, then add bounded local loops from DesignIntent route choice.',
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
        throw new TypeError(
          'Rooms+Mazes strategy requires request.intent',
        );
      }

      const baseline =
        generateDungeonFromDesignIntentV1(
          request.intent,
          {
            prompt: request.prompt,
            seed: request.seed,
            id: request.id,
          },
        );

      const options =
        request.options?.roomsMazes &&
        typeof request.options.roomsMazes === 'object' &&
        !Array.isArray(request.options.roomsMazes)
          ? request.options.roomsMazes
          : {};

      const coreResult = generateRoomsMazesCore({
        ...options,
        seed: request.seed,
        roomCount: baseline.profile.roomCount,
        extraConnectionRatio:
          baseline.profile.routeChoice,
      });

      const spec = mapCoreToDungeonSpec(
        baseline.spec,
        coreResult,
      );
      const validation = validateDungeonSpec(spec);
      if (!validation.valid) {
        throw new Error(
          'Rooms+Mazes DungeonSpec failed validation: ' +
            validation.errors
              .map((entry) => entry.code)
              .join(','),
        );
      }

      return {
        spec,
        provenance: {
          algorithm: 'rooms-mazes',
          implementation:
            'generator-algorithms/rooms-mazes',
        },
        diagnostics: {
          profile: baseline.profile,
          core: coreResult.diagnostics,
        },
      };
    },
  });
