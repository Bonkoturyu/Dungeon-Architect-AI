import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateCellularAutomataCore } from '../../../generator-algorithms/cellular-automata/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID =
  'algorithm-lab.cellular-automata';

function corridorSides(fromRoom, toRoom) {
  const dx = toRoom.cellX - fromRoom.cellX;
  const dz = toRoom.cellZ - fromRoom.cellZ;
  if (dx === 1 && dz === 0) return { fromSide: 'east', toSide: 'west' };
  if (dx === -1 && dz === 0) return { fromSide: 'west', toSide: 'east' };
  if (dx === 0 && dz === 1) return { fromSide: 'south', toSide: 'north' };
  if (dx === 0 && dz === -1) return { fromSide: 'north', toSide: 'south' };
  throw new Error(
    'Cellular Automata edge is not cardinally adjacent: ' +
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
        edge.kind === 'cellular-automata-loop'
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

export const generatorStrategyCellularAutomataLab =
  createGeneratorStrategy({
    id: GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
    displayName: 'Algorithm Lab — Cellular Automata',
    description:
      'Generate and smooth a seeded cave mask, keep or deterministically repair its largest connected region, select a connected Room subset, then add bounded local loops.',
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
        throw new TypeError('Cellular Automata strategy requires request.intent');
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
        request.options?.cellularAutomata &&
        typeof request.options.cellularAutomata === 'object' &&
        !Array.isArray(request.options.cellularAutomata)
          ? request.options.cellularAutomata
          : {};

      const coreResult = generateCellularAutomataCore({
        ...options,
        seed: request.seed,
        roomCount: baseline.profile.roomCount,
        extraConnectionRatio: baseline.profile.routeChoice,
      });

      const spec = mapCoreToDungeonSpec(baseline.spec, coreResult);
      const validation = validateDungeonSpec(spec);
      if (!validation.valid) {
        throw new Error(
          'Cellular Automata DungeonSpec failed validation: ' +
            validation.errors.map((entry) => entry.code).join(','),
        );
      }

      return {
        spec,
        provenance: {
          algorithm: 'cellular-automata',
          implementation: 'generator-algorithms/cellular-automata',
        },
        diagnostics: {
          profile: baseline.profile,
          core: coreResult.diagnostics,
        },
      };
    },
  });
