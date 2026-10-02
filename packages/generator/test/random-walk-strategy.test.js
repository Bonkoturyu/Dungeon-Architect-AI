import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  generatorStrategyRandomWalkLab,
} from '../src/strategies/random-walk-lab.js';

const request = {
  seed: 20260929,
  id: 'random-walk-lab-test',
  prompt: 'organic cave-like walk with exploration choices',
  intent: {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.8,
    targetDuration: 600,
    routeChoice: 0.65,
    exploration: 0.82,
  },
};

test('Random Walk Algorithm Lab adapter produces a valid DungeonSpec', async () => {
  const result = await generatorStrategyRandomWalkLab.generate(request);
  const validation = validateDungeonSpec(result.spec);
  assert.equal(validation.valid, true);
  assert.equal(result.spec.rooms.length, 10);
  assert.equal(
    result.provenance.strategyId,
    GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  );
  assert.equal(result.provenance.algorithmVersion, '1');
  assert.equal(result.provenance.algorithm, 'random-walk');
  assert.equal(
    result.diagnostics.core.treeEdgeCount,
    result.spec.rooms.length - 1,
  );
});

test('Random Walk Algorithm Lab adapter is deterministic', async () => {
  const left = await generatorStrategyRandomWalkLab.generate(request);
  const right = await generatorStrategyRandomWalkLab.generate(request);
  assert.deepEqual(left, right);
});

test('Random Walk adapter preserves DesignIntent content counts', async () => {
  const result = await generatorStrategyRandomWalkLab.generate(request);
  for (const [type, expected] of [
    ['enemy', result.diagnostics.profile.enemyCount],
    ['treasure', result.diagnostics.profile.treasureCount],
    ['trap', result.diagnostics.profile.trapCount],
    ['recovery', result.diagnostics.profile.recoveryCount],
  ]) {
    assert.equal(
      result.spec.entities.filter((entity) => entity.type === type).length,
      expected,
    );
  }
  assert.equal(result.spec.entities.filter((entity) => entity.type === 'start').length, 1);
  assert.equal(result.spec.entities.filter((entity) => entity.type === 'goal').length, 1);
});

test('Random Walk adapter emits exact cardinal corridor side hints', async () => {
  const result = await generatorStrategyRandomWalkLab.generate(request);
  const roomById = new Map(result.spec.rooms.map((room) => [room.id, room]));
  const spacing = Math.min(
    ...result.spec.corridors.map((corridor) => {
      const a = roomById.get(corridor.fromRoomId);
      const b = roomById.get(corridor.toRoomId);
      return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    }),
  );
  assert.ok(spacing > 0);

  for (const corridor of result.spec.corridors) {
    const from = roomById.get(corridor.fromRoomId);
    const to = roomById.get(corridor.toRoomId);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    if (dx > 0) {
      assert.equal(corridor.fromSide, 'east');
      assert.equal(corridor.toSide, 'west');
    } else if (dx < 0) {
      assert.equal(corridor.fromSide, 'west');
      assert.equal(corridor.toSide, 'east');
    } else if (dz > 0) {
      assert.equal(corridor.fromSide, 'south');
      assert.equal(corridor.toSide, 'north');
    } else {
      assert.equal(corridor.fromSide, 'north');
      assert.equal(corridor.toSide, 'south');
    }
  }
});

test('Random Walk-specific options stay behind request.options', async () => {
  const result = await generatorStrategyRandomWalkLab.generate({
    ...request,
    options: {
      randomWalk: {
        roomSizeMin: 8,
        roomSizeMax: 8,
        cellSpacing: 16,
        directionPersistence: 0.8,
      },
    },
  });
  assert.ok(result.spec.rooms.every((room) => room.width === 8 && room.depth === 8));
});
