import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_BSP_LAB_ID,
  generatorStrategyBspLab,
} from '../src/strategies/bsp-lab.js';

const request = {
  seed: 20260927,
  id: 'bsp-lab-test',
  prompt: 'structured underground facility',
  intent: {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.8,
    targetDuration: 600,
    routeChoice: 0.65,
    exploration: 0.75,
  },
};

test('BSP Algorithm Lab adapter produces a valid DungeonSpec', async () => {
  const result =
    await generatorStrategyBspLab.generate(request);
  const validation = validateDungeonSpec(result.spec);

  assert.equal(validation.valid, true);
  assert.equal(result.spec.rooms.length, 10);
  assert.equal(
    result.provenance.strategyId,
    GENERATOR_STRATEGY_BSP_LAB_ID,
  );
  assert.equal(
    result.provenance.algorithmVersion,
    '1',
  );
  assert.equal(result.provenance.algorithm, 'bsp');
  assert.equal(
    result.diagnostics.core.treeEdgeCount,
    result.spec.rooms.length - 1,
  );
});

test('BSP Algorithm Lab adapter is deterministic', async () => {
  const left =
    await generatorStrategyBspLab.generate(request);
  const right =
    await generatorStrategyBspLab.generate(request);
  assert.deepEqual(left, right);
});

test('BSP adapter preserves DesignIntent content counts', async () => {
  const result =
    await generatorStrategyBspLab.generate(request);

  for (const [type, expected] of [
    ['enemy', result.diagnostics.profile.enemyCount],
    ['treasure', result.diagnostics.profile.treasureCount],
    ['trap', result.diagnostics.profile.trapCount],
    ['recovery', result.diagnostics.profile.recoveryCount],
  ]) {
    assert.equal(
      result.spec.entities.filter(
        (entity) => entity.type === type,
      ).length,
      expected,
    );
  }

  assert.equal(
    result.spec.entities.filter(
      (entity) => entity.type === 'start',
    ).length,
    1,
  );
  assert.equal(
    result.spec.entities.filter(
      (entity) => entity.type === 'goal',
    ).length,
    1,
  );
  assert.ok(result.spec.events.length >= 1);
});

test('BSP-specific options stay behind request.options', async () => {
  const result =
    await generatorStrategyBspLab.generate({
      ...request,
      options: {
        bsp: {
          roomSizeMin: 8,
          roomSizeMax: 8,
          roomMargin: 4,
          splitJitter: 0,
        },
      },
    });

  assert.ok(
    result.spec.rooms.every(
      (room) =>
        room.width === 8 &&
        room.depth === 8,
    ),
  );
});


test('BSP adapter emits deterministic directional corridor side hints', async () => {
  const result =
    await generatorStrategyBspLab.generate(request);

  const roomById = new Map(
    result.spec.rooms.map((room) => [room.id, room]),
  );
  const opposite = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };

  for (const corridor of result.spec.corridors) {
    assert.ok(
      ['north', 'south', 'east', 'west'].includes(
        corridor.fromSide,
      ),
    );
    assert.equal(
      corridor.toSide,
      opposite[corridor.fromSide],
    );

    const fromRoom = roomById.get(corridor.fromRoomId);
    const toRoom = roomById.get(corridor.toRoomId);
    const dx = toRoom.x - fromRoom.x;
    const dz = toRoom.z - fromRoom.z;

    if (Math.abs(dx) >= Math.abs(dz)) {
      assert.equal(
        corridor.fromSide,
        dx >= 0 ? 'east' : 'west',
      );
    } else {
      assert.equal(
        corridor.fromSide,
        dz >= 0 ? 'south' : 'north',
      );
    }
  }
});
