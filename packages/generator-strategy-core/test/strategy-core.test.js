import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GENERATOR_STRATEGY_API_VERSION,
  createGeneratorStrategy,
  createGeneratorStrategyRegistry,
} from '../src/index.js';

test('strategy core normalizes JSON-compatible request and stamps provenance', async () => {
  const strategy = createGeneratorStrategy({
    id: 'fixture',
    displayName: 'Fixture',
    family: 'test',
    algorithmVersion: '7',
    capabilities: { designIntent: true },
    generate(request) {
      return {
        spec: {
          schemaVersion: '1.0',
          id: request.id,
          seed: request.seed,
          rooms: [],
          corridors: [],
          entities: [],
          events: [],
        },
        diagnostics: {
          promptLength: request.prompt.length,
        },
      };
    },
  });

  const result = await strategy.generate({
    seed: 42,
    prompt: 'fixture prompt',
    intent: { exploration: 0.5 },
  });

  assert.equal(result.provenance.apiVersion, GENERATOR_STRATEGY_API_VERSION);
  assert.equal(result.provenance.strategyId, 'fixture');
  assert.equal(result.provenance.algorithmVersion, '7');
  assert.equal(result.provenance.seed, 42);
  assert.equal(result.spec.id, 'generated-42');
  assert.equal(result.diagnostics.promptLength, 14);
});

test('registry keeps strategies isolated and fails closed for unknown ids', async () => {
  const a = createGeneratorStrategy({
    id: 'a',
    displayName: 'A',
    generate: ({ seed }) => ({
      spec: { id: `a-${seed}` },
    }),
  });
  const b = createGeneratorStrategy({
    id: 'b',
    displayName: 'B',
    generate: ({ seed }) => ({
      spec: { id: `b-${seed}` },
    }),
  });

  const registry = createGeneratorStrategyRegistry([a, b]);
  assert.deepEqual(
    registry.list().map((entry) => entry.id),
    ['a', 'b'],
  );
  assert.equal((await registry.generate('a', { seed: 1 })).spec.id, 'a-1');
  assert.equal((await registry.generate('b', { seed: 1 })).spec.id, 'b-1');
  assert.throws(() => registry.get('missing'), /Unknown generator strategy/);
  assert.throws(() => registry.register(a), /already registered/);
});

test('strategy request requires an explicit deterministic seed', async () => {
  const strategy = createGeneratorStrategy({
    id: 'seeded',
    displayName: 'Seeded',
    generate: () => ({ spec: { id: 'never' } }),
  });

  await assert.rejects(
    () => strategy.generate({}),
    /request.seed must be a non-negative safe integer/,
  );
});
