import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  SUPPORTED_GENERATOR_VERSIONS,
} from '../src/generator-versions.js';
import { generateDungeonSpec, generateDungeonSpecV1 } from '../src/dungeon-generator.js';
import {
  generateDungeonFromDesignIntent,
  generateDungeonFromDesignIntentV1,
} from '../src/design-intent-generator.js';

test('Version 1 is the frozen default generator version', () => {
  assert.equal(DEFAULT_GENERATOR_VERSION, '1');
  assert.equal(GENERATOR_VERSION_V1, '1');
  assert.deepEqual(SUPPORTED_GENERATOR_VERSIONS, ['1']);
});

test('default DungeonSpec generation is byte-identical to explicit Version 1', () => {
  const options = { seed: 777, roomCount: 15, routeChoice: 0.6, id: 'v1-freeze' };
  const direct = generateDungeonSpecV1(options);
  const explicit = generateDungeonSpec({ ...options, version: '1' });
  const currentDefault = generateDungeonSpec(options);
  assert.equal(JSON.stringify(explicit), JSON.stringify(direct));
  assert.equal(JSON.stringify(currentDefault), JSON.stringify(direct));
});

test('default DesignIntent generation preserves Version 1 output and exposes provenance', () => {
  const intent = {
    ...DEFAULT_DESIGN_INTENT,
    targetDuration: 420,
    routeChoice: 0.65,
    combatDensity: 0.5,
    rewardDensity: 0.7,
    trapDensity: 0.4,
  };
  const options = { prompt: 'version one provenance fixture', seed: 123456 };
  const direct = generateDungeonFromDesignIntentV1(intent, options);
  const explicit = generateDungeonFromDesignIntent(intent, { ...options, version: '1' });
  const currentDefault = generateDungeonFromDesignIntent(intent, options);

  assert.deepEqual(explicit.spec, direct.spec);
  assert.deepEqual(explicit.profile, direct.profile);
  assert.equal(explicit.generatorVersion, '1');
  assert.deepEqual(currentDefault.spec, direct.spec);
  assert.deepEqual(currentDefault.profile, direct.profile);
  assert.equal(currentDefault.generatorVersion, '1');
});

test('unknown generator versions fail closed', () => {
  assert.throws(
    () => generateDungeonSpec({ version: '999', seed: 1, roomCount: 5, routeChoice: 0 }),
    /Unsupported generator version/,
  );
  assert.throws(
    () => generateDungeonFromDesignIntent(DEFAULT_DESIGN_INTENT, {
      version: '999',
      prompt: 'unsupported-version',
      seed: 1,
    }),
    /Unsupported generator version/,
  );
});
