import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { validateDungeonSpec } from '../packages/core/src/dungeon-spec.js';
import { createDungeonScenePlan } from '../packages/renderer-three/src/index.js';
import {
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  createBuiltinGeneratorStrategyRegistry,
} from '../packages/generator/src/strategy-catalog.js';

const seeds = [
  1,
  7,
  42,
  20260926,
  0xdeadbeef,
  0xffffffff,
];
const roomCounts = [5, 8, 12, 16, 20];
const routeChoices = [0, 0.25, 0.5, 0.75, 1];

const registry = createBuiltinGeneratorStrategyRegistry();
const failures = [];
const layoutSignatures = new Set();
const fallbackModes = new Map();
let cases = 0;
let totalLoops = 0;

for (const seed of seeds) {
  for (const roomCount of roomCounts) {
    for (const routeChoice of routeChoices) {
      cases += 1;
      const intent = {
        ...DEFAULT_DESIGN_INTENT,
        targetDuration: roomCount * 60,
        routeChoice,
        exploration: 0.8,
        fairness: 0.8,
      };

      try {
        const result = await registry.generate(
          GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
          {
            seed,
            id: `delaunay-matrix-${seed}-${roomCount}-${String(routeChoice).replace('.', '_')}`,
            prompt: 'Delaunay renderer matrix fixture',
            intent,
          },
        );

        const validation = validateDungeonSpec(result.spec);
        if (!validation.valid) {
          throw new Error(
            `DungeonSpec invalid: ${validation.errors
              .map((entry) => entry.code)
              .join(',')}`,
          );
        }

        if (result.spec.rooms.length !== roomCount) {
          throw new Error(
            `roomCount mismatch: expected ${roomCount}, got ${result.spec.rooms.length}`,
          );
        }

        if (
          result.diagnostics?.core?.mstEdgeCount !==
          roomCount - 1
        ) {
          throw new Error(
            `MST edge count mismatch: expected ${roomCount - 1}, got ${result.diagnostics?.core?.mstEdgeCount}`,
          );
        }

        const plan = createDungeonScenePlan(result.spec);
        const mode = plan.routingFallbackMode ?? 'unknown';
        fallbackModes.set(mode, (fallbackModes.get(mode) ?? 0) + 1);
        totalLoops += result.diagnostics?.core?.loopEdgeCount ?? 0;

        layoutSignatures.add(
          JSON.stringify(
            result.spec.rooms.map(
              ({ x, z, width, depth }) => ({
                x,
                z,
                width,
                depth,
              }),
            ),
          ),
        );
      } catch (error) {
        failures.push({
          seed,
          roomCount,
          routeChoice,
          error: String(error?.stack || error),
        });
      }
    }
  }
}

const evidence = {
  passed: failures.length === 0,
  cases,
  seeds: seeds.length,
  roomCounts,
  routeChoices,
  uniqueSpatialLayouts: layoutSignatures.size,
  totalLoops,
  routingFallbackModes: Object.fromEntries(
    [...fallbackModes.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  ),
  failures,
};

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  process.exit(1);
}
