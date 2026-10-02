import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomPlanConfig, resolveGenerationDifficulty, visibleRoomPlans } from '../../apps/editor-slice/room-plan-review.js';
import { LANGUAGE_OPTIONS, MESSAGE_CATALOGS, getMessage } from '../../apps/editor-slice/i18n.js';

test('explicit generation difficulty wins over text; prompt mode retains text and Normal fallback', () => {
  for (const selected of ['easy', 'normal', 'hard']) for (const requested of ['easy', 'normal', 'hard', null]) {
    assert.equal(resolveGenerationDifficulty(selected, requested), selected);
  }
  for (const requested of ['easy', 'normal', 'hard']) assert.equal(resolveGenerationDifficulty('prompt', requested), requested);
  assert.equal(resolveGenerationDifficulty('prompt', null), 'normal');
  assert.equal(resolveGenerationDifficulty(undefined, 'hard'), 'hard');
  assert.equal(resolveGenerationDifficulty('prompt', 'unknown'), 'normal');
});

test('random review hides all sampled contents while preserving seeded generation plans', () => {
  let sampledPlans = 0;
  for (let seed = 0; seed < 24; seed++) {
    const config = createRoomPlanConfig({ requests: [], floorCount: 3, seed, difficulty: 'easy' });
    const before = structuredClone(config);
    sampledPlans += config.roomPlans.length;
    assert.deepEqual(visibleRoomPlans(config.roomPlans, config.presenceSpec), []);
    assert.deepEqual(config, before);
    assert.deepEqual(createRoomPlanConfig({ requests: [], floorCount: 3, seed, difficulty: 'easy' }), config);
  }
  assert.ok(sampledPlans > 0);
});

test('explicit kinds and per-floor endpoints remain editable without revealing random endpoints of the same kind', () => {
  const policies = { 'monster-house': 'include', 'trap-house': 'random', shop: 'exclude' };
  const endpointPolicies = { start: 'random', goal: { default: 'random', floors: { 2: 'monster-house' } } };
  const plans = [
    { id: 'explicit', kind: 'monster-house', floorNumber: 1, entityCount: 3 },
    { id: 'random-house', kind: 'trap-house', floorNumber: 2, entityCount: 4 },
    { id: 'random-start', kind: 'monster-house', targetRole: 'start', floorNumber: 1, entityCount: 3 },
    { id: 'random-goal', kind: 'monster-house', targetRole: 'goal', floorNumber: 1, entityCount: 3 },
    { id: 'explicit-goal', kind: 'monster-house', targetRole: 'goal', floorNumber: 2, entityCount: 7 },
  ];
  const before = structuredClone(plans);
  assert.deepEqual(visibleRoomPlans(plans, { policies, endpointPolicies }).map(({ id }) => id), ['explicit', 'explicit-goal']);
  assert.deepEqual(plans, before);
});

test('generation difficulty and hidden-random guidance are complete in all five languages', () => {
  for (const { id } of LANGUAGE_OPTIONS) for (const key of ['create.difficultyPrompt', 'create.difficultyHint', 'roomReview.randomHidden', 'roomReview.selectedDifficulty']) {
    assert.ok(Object.hasOwn(MESSAGE_CATALOGS[id], key), `${id}:${key}`);
    assert.ok(getMessage(id, key, { difficulty: 'Normal' }).length > 0);
  }
});
