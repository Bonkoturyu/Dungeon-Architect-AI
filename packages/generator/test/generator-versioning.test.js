import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DESIGN_INTENT } from '../../intent/src/design-intent.js';
import {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V3,
  SUPPORTED_GENERATOR_VERSIONS,
} from '../src/generator-versions.js';
import {
  generateDungeonSpec,
  generateDungeonSpecV1,
  generateDungeonSpecV2,
} from '../src/dungeon-generator.js';
import {
  generateDungeonFromDesignIntent,
  generateDungeonFromDesignIntentV1,
  generateDungeonFromDesignIntentV2,
} from '../src/design-intent-generator.js';

test('Version 1 remains the frozen library default while Versions 2 and 3 are registered', () => {
  assert.equal(DEFAULT_GENERATOR_VERSION, '1');
  assert.equal(GENERATOR_VERSION_V1, '1');
  assert.equal(GENERATOR_VERSION_V2, '2');
  assert.equal(GENERATOR_VERSION_V3, '3');
  assert.deepEqual(SUPPORTED_GENERATOR_VERSIONS, ['1', '2', '3']);
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


test('Version 2 is deterministic and visibly differs from Version 1 layout', () => {
  const options = {
    seed: 777,
    roomCount: 15,
    routeChoice: 0.6,
    id: 'v2-layout',
  };
  const v1 = generateDungeonSpecV1(options);
  const v2a = generateDungeonSpecV2(options);
  const v2b = generateDungeonSpec({
    ...options,
    version: '2',
  });

  assert.equal(JSON.stringify(v2a), JSON.stringify(v2b));
  assert.notDeepEqual(
    v2a.rooms.map(({ x, z, width, depth }) => ({ x, z, width, depth })),
    v1.rooms.map(({ x, z, width, depth }) => ({ x, z, width, depth })),
  );
});

test('different Version 2 seeds can alter spatial composition for the same room count', () => {
  const a = generateDungeonSpecV2({
    seed: 100,
    roomCount: 12,
    routeChoice: 0.5,
  });
  const b = generateDungeonSpecV2({
    seed: 101,
    roomCount: 12,
    routeChoice: 0.5,
  });

  assert.notDeepEqual(
    a.rooms.map(({ x, z, width, depth }) => ({ x, z, width, depth })),
    b.rooms.map(({ x, z, width, depth }) => ({ x, z, width, depth })),
  );
});

test('DesignIntent Version 2 preserves V1 gameplay profile while changing layout provenance', () => {
  const intent = {
    ...DEFAULT_DESIGN_INTENT,
    targetDuration: 420,
    routeChoice: 0.65,
    combatDensity: 0.5,
    rewardDensity: 0.7,
    trapDensity: 0.4,
  };
  const options = {
    prompt: 'version two layout fixture',
    seed: 123456,
  };

  const v1 = generateDungeonFromDesignIntentV1(intent, options);
  const v2 = generateDungeonFromDesignIntentV2(intent, options);
  const dispatched = generateDungeonFromDesignIntent(intent, {
    ...options,
    version: '2',
  });

  assert.equal(dispatched.generatorVersion, '2');
  assert.deepEqual(dispatched.spec, v2.spec);
  assert.deepEqual(dispatched.profile, v2.profile);
  assert.equal(v2.profile.roomCount, v1.profile.roomCount);
  assert.equal(v2.profile.routeChoice, v1.profile.routeChoice);
  assert.equal(v2.profile.enemyCount, v1.profile.enemyCount);
  assert.equal(v2.profile.treasureCount, v1.profile.treasureCount);
  assert.equal(v2.profile.trapCount, v1.profile.trapCount);
  assert.ok(v2.profile.layout);
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
