import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateBspCore } from '../../../generator-algorithms/bsp/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_BSP_LAB_ID =
  'algorithm-lab.bsp';

function preferredCorridorSides(fromRoom, toRoom) {
  const dx = toRoom.x - fromRoom.x;
  const dz = toRoom.z - fromRoom.z;

  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0
      ? { fromSide: 'east', toSide: 'west' }
      : { fromSide: 'west', toSide: 'east' };
  }

  return dz >= 0
    ? { fromSide: 'south', toSide: 'north' }
    : { fromSide: 'north', toSide: 'south' };
}

function mapCoreToDungeonSpec(baseSpec, coreResult) {
  const rooms = coreResult.rooms.map((room) => ({
    id: room.id,
    x: room.x,
    z: room.z,
    width: room.width,
    depth: room.depth,
  }));
  const corridors = coreResult.finalEdges.map(
    (edge, index) => {
      const fromRoom = rooms[edge.a];
      const toRoom = rooms[edge.b];
      const sides = preferredCorridorSides(
        fromRoom,
        toRoom,
      );

      return {
        id: `corridor-${String(index + 1).padStart(3, '0')}`,
        fromRoomId: fromRoom.id,
        toRoomId: toRoom.id,
        width: 3,
        kind:
          edge.kind === 'bsp-extra'
            ? 'alternate'
            : 'backbone',
        ...sides,
      };
    },
  );

  return {
    ...baseSpec,
    rooms,
    corridors,
  };
}

export const generatorStrategyBspLab =
  createGeneratorStrategy({
    id: GENERATOR_STRATEGY_BSP_LAB_ID,
    displayName: 'Algorithm Lab — BSP',
    description:
      'Recursively split a rectangular region into binary partitions, place one Room in each leaf, connect sibling subtrees, then add a bounded deterministic set of extra links.',
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
          'BSP strategy requires request.intent',
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
        request.options?.bsp &&
        typeof request.options.bsp === 'object' &&
        !Array.isArray(request.options.bsp)
          ? request.options.bsp
          : {};

      const coreResult = generateBspCore({
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
          `BSP DungeonSpec failed validation: ${validation.errors
            .map((entry) => entry.code)
            .join(',')}`,
        );
      }

      return {
        spec,
        provenance: {
          algorithm: 'bsp',
          implementation:
            'generator-algorithms/bsp',
        },
        diagnostics: {
          profile: baseline.profile,
          core: coreResult.diagnostics,
        },
      };
    },
  });
