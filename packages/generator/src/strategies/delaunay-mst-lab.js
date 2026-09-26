import { validateDungeonSpec } from '../../../core/src/dungeon-spec.js';
import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateDelaunayMstCore } from '../../generator-algorithms/delaunay-mst/src/index.js';
import { generateDungeonFromDesignIntentV1 } from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID =
  'algorithm-lab.delaunay-mst-loops';

function mapCoreToDungeonSpec(baseSpec, coreResult) {
  const rooms = coreResult.rooms.map((room) => ({ ...room }));
  const corridors = coreResult.finalEdges.map((edge, index) => ({
    id: `corridor-${String(index + 1).padStart(3, '0')}`,
    fromRoomId: rooms[edge.a].id,
    toRoomId: rooms[edge.b].id,
    width: 3,
    kind: edge.kind === 'loop' ? 'alternate' : 'backbone',
  }));

  return {
    ...baseSpec,
    rooms,
    corridors,
  };
}

export const generatorStrategyDelaunayMstLab = createGeneratorStrategy({
  id: GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  displayName: 'Algorithm Lab — Delaunay + MST + Loops',
  description:
    'Scatter rooms, derive Delaunay adjacency, keep an MST for guaranteed connectivity, then restore a bounded deterministic subset of non-MST edges as loops.',
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
        'Delaunay + MST strategy requires request.intent',
      );
    }

    // The reusable Core owns only spatial/topology generation.
    // This application adapter intentionally reuses the frozen V1
    // DesignIntent content/profile mapping so entity/event semantics stay
    // stable while the Algorithm Lab topology changes independently.
    const baseline = generateDungeonFromDesignIntentV1(
      request.intent,
      {
        prompt: request.prompt,
        seed: request.seed,
        id: request.id,
      },
    );

    const options =
      request.options?.delaunayMst &&
      typeof request.options.delaunayMst === 'object' &&
      !Array.isArray(request.options.delaunayMst)
        ? request.options.delaunayMst
        : {};

    const coreResult = generateDelaunayMstCore({
      seed: request.seed,
      roomCount: baseline.profile.roomCount,
      loopRatio: baseline.profile.routeChoice,
      ...options,
    });

    const spec = mapCoreToDungeonSpec(
      baseline.spec,
      coreResult,
    );
    const validation = validateDungeonSpec(spec);
    if (!validation.valid) {
      throw new Error(
        `Delaunay + MST DungeonSpec failed validation: ${validation.errors
          .map((entry) => entry.code)
          .join(',')}`,
      );
    }

    return {
      spec,
      provenance: {
        algorithm: 'delaunay-mst-loops',
        implementation:
          'generator-algorithms/delaunay-mst',
      },
      diagnostics: {
        profile: baseline.profile,
        core: coreResult.diagnostics,
      },
    };
  },
});
