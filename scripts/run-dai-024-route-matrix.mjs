import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeRoomGraphRoutes,
  generateRoomGraph,
  getAlternateRouteTarget,
} from '../packages/generator/src/room-graph.js';

const seeds = [0, 1, 2, 42, 777, 18342];
const roomCounts = [3, 4, 5, 8, 12, 20, 32, 64];
const routeChoices = [0, 0.25, 0.5, 0.75, 1];
const outputDir = path.resolve('artifacts/route-matrix');
const rows = [];
const failures = [];

function alternateKeys(graph) {
  return graph.edges
    .filter((edge) => edge.kind === 'alternate')
    .map((edge) => `${edge.from}|${edge.to}`);
}

for (const seed of seeds) {
  for (const roomCount of roomCounts) {
    let previousAlternates = [];

    for (const routeChoice of routeChoices) {
      const graph = generateRoomGraph({ seed, roomCount, routeChoice });
      const metrics = analyzeRoomGraphRoutes(graph);
      const expectedAlternateEdges = getAlternateRouteTarget(roomCount, routeChoice);
      const alternates = alternateKeys(graph);
      const prefixPreserved = alternates.slice(0, previousAlternates.length).every(
        (edge, index) => edge === previousAlternates[index],
      );

      const row = {
        seed,
        roomCount,
        routeChoice,
        expectedAlternateEdges,
        actualAlternateEdges: metrics.alternateEdgeCount,
        cycleRank: metrics.cycleRank,
        allEdgesUnique: metrics.allEdgesUnique,
        alternatesRejoinBackbone: metrics.alternatesRejoinBackbone,
        hasMultipleStartGoalRoutes: metrics.hasMultipleStartGoalRoutes,
        prefixPreserved,
        alternateBackboneSpans: metrics.alternateBackboneSpans,
      };
      rows.push(row);

      const problems = [];
      if (row.actualAlternateEdges !== row.expectedAlternateEdges) problems.push('alternate-count');
      if (row.cycleRank !== row.actualAlternateEdges) problems.push('cycle-rank');
      if (!row.allEdgesUnique) problems.push('duplicate-edge');
      if (!row.alternatesRejoinBackbone) problems.push('alternate-span');
      if (!row.prefixPreserved) problems.push('non-monotonic-prefix');
      if ((row.actualAlternateEdges > 0) !== row.hasMultipleStartGoalRoutes) problems.push('multi-route-flag');
      if (problems.length) failures.push({ ...row, problems });

      previousAlternates = alternates;
    }
  }
}

fs.mkdirSync(outputDir, { recursive: true });
const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  node: process.version,
  matrix: {
    seeds,
    roomCounts,
    routeChoices,
    cases: rows.length,
  },
  passed: failures.length === 0,
  failures,
  rows,
};

const outputPath = path.join(outputDir, 'dai-024-route-matrix.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));

console.log(JSON.stringify({
  generatedAt,
  passed: evidence.passed,
  cases: rows.length,
  failures: failures.length,
  outputPath,
}, null, 2));

if (!evidence.passed) process.exitCode = 1;
