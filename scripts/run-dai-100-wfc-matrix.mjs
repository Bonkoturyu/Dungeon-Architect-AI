import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { validateDungeonSpec } from '../packages/core/src/dungeon-spec.js';
import { createDungeonScenePlan } from '../packages/renderer-three/src/index.js';
import {
  GENERATOR_STRATEGY_WFC_LAB_ID,
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
  'DAI_WFC_MATRIX_SEEDS',
  [1, 7, 42, 20260929, 0xdeadbeef, 0xffffffff],
);
const roomCounts = parseNumericList(
  'DAI_WFC_MATRIX_ROOM_COUNTS',
  [5, 8, 12, 16, 20],
);
const routeChoices = parseNumericList(
  'DAI_WFC_MATRIX_ROUTE_CHOICES',
  [0, 0.25, 0.5, 0.75, 1],
);

const registry = createBuiltinGeneratorStrategyRegistry();
const failures = [];
const layoutSignatures = new Set();
const fallbackModes = new Map();
let cases = 0;
let totalExtraEdges = 0;
let totalCollapseCount = 0;
let totalPropagationRevisions = 0;
let totalOptionalCandidates = 0;

const totalCases =
  seeds.length * roomCounts.length * routeChoices.length;
const startedAt = Date.now();

for (const seed of seeds) {
  for (const roomCount of roomCounts) {
    for (const routeChoice of routeChoices) {
      cases += 1;
      const caseStartedAt = Date.now();

      console.log(
        '[DAI-100 WFC MATRIX] case ' +
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
          GENERATOR_STRATEGY_WFC_LAB_ID,
          {
            seed,
            id:
              'wfc-matrix-' +
              seed + '-' +
              roomCount + '-' +
              String(routeChoice).replace('.', '_'),
            prompt: 'WFC renderer matrix fixture',
            intent,
          },
        );

        const validation =
          validateDungeonSpec(result.spec);
        if (!validation.valid) {
          throw new Error(
            'DungeonSpec invalid: ' +
              validation.errors
                .map((entry) => entry.code)
                .join(','),
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

        const diagnostics = result.diagnostics?.core;
        if (
          diagnostics?.treeEdgeCount !==
          roomCount - 1
        ) {
          throw new Error(
            'WFC tree edge count mismatch: expected ' +
              (roomCount - 1) +
              ', got ' +
              diagnostics?.treeEdgeCount,
          );
        }

        if (diagnostics?.contradictionCount !== 0) {
          throw new Error(
            'WFC contradiction count is not zero: ' +
              diagnostics?.contradictionCount,
          );
        }

        if (
          routeChoice === 0 &&
          diagnostics?.extraEdgeCount !== 0
        ) {
          throw new Error(
            'WFC routeChoice=0 produced extra edges: ' +
              diagnostics?.extraEdgeCount,
          );
        }

        if (
          routeChoice === 1 &&
          diagnostics?.extraEdgeCount !==
            diagnostics?.optionalCandidateCount
        ) {
          throw new Error(
            'WFC routeChoice=1 did not open all optional adjacencies',
          );
        }

        const plan =
          createDungeonScenePlan(result.spec);
        const mode =
          plan.routingFallbackMode ?? 'unknown';
        fallbackModes.set(
          mode,
          (fallbackModes.get(mode) ?? 0) + 1,
        );

        totalExtraEdges +=
          diagnostics?.extraEdgeCount ?? 0;
        totalCollapseCount +=
          diagnostics?.collapseCount ?? 0;
        totalPropagationRevisions +=
          diagnostics?.propagationRevisions ?? 0;
        totalOptionalCandidates +=
          diagnostics?.optionalCandidateCount ?? 0;

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
          '[DAI-100 WFC MATRIX] PASS case ' +
            cases + '/' + totalCases +
            ' ' +
            (Date.now() - caseStartedAt) +
            'ms routing=' + mode +
            ' collapse=' +
            (diagnostics?.collapseCount ?? 0) +
            ' propagate=' +
            (diagnostics?.propagationRevisions ?? 0),
        );
      } catch (error) {
        failures.push({
          seed,
          roomCount,
          routeChoice,
          error: String(error?.stack || error),
        });
        console.error(
          '[DAI-100 WFC MATRIX] FAIL case ' +
            cases + '/' + totalCases +
            ' ' +
            (Date.now() - caseStartedAt) +
            'ms: ' +
            String(error?.message ?? error),
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
  totalOptionalCandidates,
  totalCollapseCount,
  totalPropagationRevisions,
  durationMs: Date.now() - startedAt,
  routingFallbackModes: Object.fromEntries(
    [...fallbackModes.entries()].sort(
      ([left], [right]) =>
        left.localeCompare(right),
    ),
  ),
  failures,
};

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) process.exit(1);
