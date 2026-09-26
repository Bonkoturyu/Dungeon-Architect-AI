import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  generatorStrategyDelaunayMstLab,
} from '../src/strategies/delaunay-mst-lab.js';

const request = {
  seed: 20260926,
  id: 'delaunay-lab-test',
  prompt: 'exploration-heavy dungeon',
  intent: {
    ...DEFAULT_DESIGN_INTENT,
    targetDuration: 600,
    routeChoice: 0.75,
    exploration: 0.85,
  },
};

test('Delaunay Algorithm Lab adapter produces a valid DungeonSpec', async () => {
  const result = await generatorStrategyDelaunayMstLab.generate(
    request,
  );
  const validation = validateDungeonSpec(result.spec);

  assert.equal(validation.valid, true);
  assert.equal(result.spec.rooms.length, 10);
  assert.equal(
    result.provenance.strategyId,
    GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  );
  assert.equal(result.provenance.algorithmVersion, '1');
  assert.equal(
    result.provenance.algorithm,
    'delaunay-mst-loops',
  );
  assert.equal(
    result.diagnostics.core.mstEdgeCount,
    result.spec.rooms.length - 1,
  );
});

test('Delaunay Algorithm Lab adapter is deterministic', async () => {
  const left = await generatorStrategyDelaunayMstLab.generate(
    request,
  );
  const right = await generatorStrategyDelaunayMstLab.generate(
    request,
  );
  assert.deepEqual(left, right);
});

test('Delaunay adapter preserves DesignIntent-driven MVP content semantics', async () => {
  const result = await generatorStrategyDelaunayMstLab.generate(
    request,
  );

  const counts = Object.fromEntries(
    ['start', 'goal', 'enemy', 'treasure', 'trap', 'recovery'].map(
      (type) => [
        type,
        result.spec.entities.filter((entity) => entity.type === type)
          .length,
      ],
    ),
  );

  assert.equal(counts.start, 1);
  assert.equal(counts.goal, 1);
  assert.equal(counts.enemy, result.diagnostics.profile.enemyCount);
  assert.equal(
    counts.treasure,
    result.diagnostics.profile.treasureCount,
  );
  assert.equal(counts.trap, result.diagnostics.profile.trapCount);
  assert.equal(
    counts.recovery,
    result.diagnostics.profile.recoveryCount,
  );

  assert.ok(result.spec.events.length >= 1);
  assert.equal(
    result.spec.entities.find((entity) => entity.type === 'start')
      ?.roomId,
    'room-001',
  );
  assert.equal(
    result.spec.entities.find((entity) => entity.type === 'goal')
      ?.roomId,
    'room-010',
  );
});

test('Delaunay adapter preserves conditional recovery placement', async () => {
  const result = await generatorStrategyDelaunayMstLab.generate({
    ...request,
    intent: {
      ...request.intent,
      fairness: 0.8,
    },
  });

  assert.equal(result.diagnostics.profile.recoveryCount, 1);
  assert.equal(
    result.spec.entities.filter(
      (entity) => entity.type === 'recovery',
    ).length,
    1,
  );
});

test('Algorithm-specific options stay behind request.options', async () => {
  const result = await generatorStrategyDelaunayMstLab.generate({
    ...request,
    options: {
      delaunayMst: {
        roomSizeMin: 8,
        roomSizeMax: 8,
        minCenterDistance: 16,
      },
    },
  });

  assert.ok(
    result.spec.rooms.every(
      (room) => room.width === 8 && room.depth === 8,
    ),
  );
});
