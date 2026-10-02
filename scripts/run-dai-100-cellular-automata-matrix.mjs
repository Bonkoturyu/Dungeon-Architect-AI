import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { validateDungeonSpec } from '../packages/core/src/dungeon-spec.js';
import { createDungeonScenePlan } from '../packages/renderer-three/src/index.js';
import {
  GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  createBuiltinGeneratorStrategyRegistry,
} from '../packages/generator/src/strategy-catalog.js';

function parseNumericList(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const values = raw
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    throw new Error(name + ' did not contain any numeric values');
  }
  return values;
}

const seeds = parseNumericList(
  'DAI_CELLULAR_AUTOMATA_MATRIX_SEEDS',
  [1, 7, 42, 20260929, 0xdeadbeef, 0xffffffff],
);
const roomCounts = parseNumericList(
  'DAI_CELLULAR_AUTOMATA_MATRIX_ROOM_COUNTS',
  [5, 8, 12, 16, 20],
);
const routeChoices = parseNumericList(
  'DAI_CELLULAR_AUTOMATA_MATRIX_ROUTE_CHOICES',
  [0, 0.25, 0.5, 0.75, 1],
);

const registry = createBuiltinGeneratorStrategyRegistry();
const failures = [];
const layoutSignatures = new Set();
const fallbackModes = new Map();
let cases = 0;
let totalExtraEdges = 0;
let totalRepairCarves = 0;
let totalSmoothedOpen = 0;

const totalCases =
  seeds.length * roomCounts.length * routeChoices.length;
const startedAt = Date.now();

for (const seed of seeds) {
  for (const roomCount of roomCounts) {
    for (const routeChoice of routeChoices) {
      cases += 1;
      const caseStartedAt = Date.now();
      console.log(
        '[DAI-100 CELLULAR AUTOMATA MATRIX] case ' +
          cases + '/' + totalCases +
          ' seed=' + seed +
          ' rooms=' + roomCount +
          ' routeChoice=' + routeChoice,
      );

      const intent = {
        ...DEFAULT_DESIGN_INTENT,
        targetDuration: roomCount * 60,
        routeChoice,
        exploration: 0.82,
        fairness: 0.8,
      };

      try {
        const result = await registry.generate(
          GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
          {
            seed,
            id:
              'cellular-automata-matrix-' +
              seed + '-' +
              roomCount + '-' +
              String(routeChoice).replace('.', '_'),
            prompt: 'Cellular Automata renderer matrix fixture',
            intent,
          },
        );

        const validation = validateDungeonSpec(result.spec);
        if (!validation.valid) {
          throw new Error(
            'DungeonSpec invalid: ' +
              validation.errors.map((entry) => entry.code).join(','),
          );
        }

        if (result.spec.rooms.length !== roomCount) {
          throw new Error(
            'roomCount mismatch: expected ' +
              roomCount +
              ', got ' +
              result.spec.rooms.length,
          );
        }

        if (
          result.diagnostics?.core?.treeEdgeCount !==
          roomCount - 1
        ) {
          throw new Error(
            'Cellular Automata tree edge count mismatch: expected ' +
              (roomCount - 1) +
              ', got ' +
              result.diagnostics?.core?.treeEdgeCount,
          );
        }

        const plan = createDungeonScenePlan(result.spec);
        const mode = plan.routingFallbackMode ?? 'unknown';
        fallbackModes.set(
          mode,
          (fallbackModes.get(mode) ?? 0) + 1,
        );

        totalExtraEdges +=
          result.diagnostics?.core?.extraEdgeCount ?? 0;
        totalRepairCarves +=
          result.diagnostics?.core?.repairCarveCount ?? 0;
        totalSmoothedOpen +=
          result.diagnostics?.core?.smoothedOpenCount ?? 0;

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

        console.log(
          '[DAI-100 CELLULAR AUTOMATA MATRIX] PASS case ' +
            cases + '/' + totalCases +
            ' ' + (Date.now() - caseStartedAt) +
            'ms routing=' + mode,
        );
      } catch (error) {
        failures.push({
          seed,
          roomCount,
          routeChoice,
          error: String(error?.stack || error),
        });
        console.error(
          '[DAI-100 CELLULAR AUTOMATA MATRIX] FAIL case ' +
            cases + '/' + totalCases +
            ' ' + (Date.now() - caseStartedAt) +
            'ms: ' + String(error?.message ?? error),
        );
      }
    }
  }
}

const evidence = {
  passed: failures.length === 0,
  cases,
  seeds: seeds.length,
  seedValues: seeds,
  roomCounts,
  routeChoices,
  uniqueSpatialLayouts: layoutSignatures.size,
  totalExtraEdges,
  totalRepairCarves,
  totalSmoothedOpen,
  durationMs: Date.now() - startedAt,
  routingFallbackModes: Object.fromEntries(
    [...fallbackModes.entries()].sort(
      ([left], [right]) => left.localeCompare(right),
    ),
  ),
  failures,
};

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) process.exit(1);
