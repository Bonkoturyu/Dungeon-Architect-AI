import { DEFAULT_DESIGN_INTENT } from '../packages/intent/src/design-intent.js';
import { validateDungeonSpec } from '../packages/core/src/dungeon-spec.js';
import {
  generateDungeonSpecV1,
  generateDungeonSpecV2,
} from '../packages/generator/src/dungeon-generator.js';
import {
  generateDungeonFromDesignIntent,
} from '../packages/generator/src/design-intent-generator.js';
import { createDungeonScenePlan } from '../packages/renderer-three/src/scene-plan.js';

const seeds = [
  0,
  1,
  2,
  42,
  99,
  777,
  2026,
  18342,
  12092026,
  4294967295,
];
const roomCounts = [5, 6, 8, 12, 16, 20];
const routeChoices = [0, 0.25, 0.5, 0.75, 1];

const failures = [];
const layouts = new Set();
let cases = 0;

for (const seed of seeds) {
  for (const roomCount of roomCounts) {
    for (const routeChoice of routeChoices) {
      cases += 1;
      const spec = generateDungeonSpecV2({
        seed,
        roomCount,
        routeChoice,
        id: `v2-${seed}-${roomCount}-${routeChoice}`,
      });
      const validation = validateDungeonSpec(spec);
      if (!validation.valid) {
        failures.push({
          seed,
          roomCount,
          routeChoice,
          stage: 'core-validation',
          errors: validation.errors.map((entry) => entry.code),
        });
        continue;
      }

      try {
        createDungeonScenePlan(spec);
      } catch (error) {
        failures.push({
          seed,
          roomCount,
          routeChoice,
          stage: 'renderer-route-preflight',
          message: String(error?.message ?? error),
        });
        continue;
      }

      const again = generateDungeonSpecV2({
        seed,
        roomCount,
        routeChoice,
        id: `v2-${seed}-${roomCount}-${routeChoice}`,
      });
      if (JSON.stringify(spec) !== JSON.stringify(again)) {
        failures.push({
          seed,
          roomCount,
          routeChoice,
          stage: 'determinism',
        });
      }

      layouts.add(
        JSON.stringify(
          spec.rooms.map(({ x, z, width, depth }) => ({
            x,
            z,
            width,
            depth,
          })),
        ),
      );
    }
  }
}

const sameRoomCountA = generateDungeonSpecV2({
  seed: 101,
  roomCount: 12,
  routeChoice: 0.5,
});
const sameRoomCountB = generateDungeonSpecV2({
  seed: 102,
  roomCount: 12,
  routeChoice: 0.5,
});
const v1Fixture = generateDungeonSpecV1({
  seed: 101,
  roomCount: 12,
  routeChoice: 0.5,
});

const intent = {
  ...DEFAULT_DESIGN_INTENT,
  targetDuration: 720,
  routeChoice: 0.7,
  combatDensity: 0.5,
  rewardDensity: 0.65,
  trapDensity: 0.45,
};
const intentResult = generateDungeonFromDesignIntent(intent, {
  version: '2',
  prompt: 'DAI-100 Generator V2 acceptance fixture',
  seed: 100100,
});

const intentValidation = validateDungeonSpec(intentResult.spec);
let intentRendererRoutable = true;
try {
  createDungeonScenePlan(intentResult.spec);
} catch {
  intentRendererRoutable = false;
}

const checks = {
  matrixHasExpectedCoverage:
    cases === seeds.length * roomCounts.length * routeChoices.length,
  matrixPassesCoreAndRenderer:
    failures.length === 0,
  seedChangesSameRoomCountLayout:
    JSON.stringify(sameRoomCountA.rooms) !==
    JSON.stringify(sameRoomCountB.rooms),
  v2DiffersFromFrozenV1:
    JSON.stringify(sameRoomCountA.rooms) !==
    JSON.stringify(v1Fixture.rooms),
  layoutVariantsObserved:
    layouts.size >= 20,
  explicitV2DesignIntentDispatch:
    intentResult.generatorVersion === '2' &&
    intentResult.profile?.layout != null,
  explicitV2DesignIntentValid:
    intentValidation.valid === true,
  explicitV2DesignIntentRendererRoutable:
    intentRendererRoutable,
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  coverage: {
    seeds,
    roomCounts,
    routeChoices,
    cases,
    uniqueSpatialLayouts: layouts.size,
  },
  intentProfile: intentResult.profile,
  failures,
};

console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(
    'DAI-100 Generator V2 matrix failed: ' +
      falseChecks.join(', '),
  );
}
