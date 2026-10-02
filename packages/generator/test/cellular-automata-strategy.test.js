import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDungeonSpec } from '../../core/src/dungeon-spec.js';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  generatorStrategyCellularAutomataLab,
} from '../src/strategies/cellular-automata-lab.js';

const request = {
  seed: 20260929,
  id: 'cellular-automata-lab-test',
  prompt: 'organic cave cells with connected exploration choices',
  intent: {
    ...DEFAULT_DESIGN_INTENT,
    fairness: 0.8,
    targetDuration: 600,
    routeChoice: 0.65,
    exploration: 0.85,
  },
};

test('Cellular Automata Algorithm Lab adapter produces a valid DungeonSpec', async () => {
  const result = await generatorStrategyCellularAutomataLab.generate(request);
  const validation = validateDungeonSpec(result.spec);
  assert.equal(validation.valid, true);
  assert.equal(result.spec.rooms.length, 10);
  assert.equal(
    result.provenance.strategyId,
    GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  );
  assert.equal(result.provenance.algorithmVersion, '1');
  assert.equal(result.provenance.algorithm, 'cellular-automata');
  assert.equal(result.diagnostics.core.treeEdgeCount, result.spec.rooms.length - 1);
});

test('Cellular Automata Algorithm Lab adapter is deterministic', async () => {
  const left = await generatorStrategyCellularAutomataLab.generate(request);
  const right = await generatorStrategyCellularAutomataLab.generate(request);
  assert.deepEqual(left, right);
});

test('Cellular Automata adapter preserves DesignIntent content counts', async () => {
  const result = await generatorStrategyCellularAutomataLab.generate(request);
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

test('Cellular Automata adapter emits exact cardinal corridor side hints', async () => {
  const result = await generatorStrategyCellularAutomataLab.generate(request);
  const roomById = new Map(result.spec.rooms.map((room) => [room.id, room]));
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

test('Cellular Automata-specific options stay behind request.options', async () => {
  const result = await generatorStrategyCellularAutomataLab.generate({
    ...request,
    options: {
      cellularAutomata: {
        roomSizeMin: 8,
        roomSizeMax: 8,
        cellSpacing: 16,
        smoothingIterations: 2,
        initialWallProbability: 0.5,
      },
    },
  });
  assert.ok(result.spec.rooms.every((room) => room.width === 8 && room.depth === 8));
});
