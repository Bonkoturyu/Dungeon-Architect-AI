import fs from 'node:fs';
import path from 'node:path';
import { createPlayResult, movePlaySession, startPlaySession } from '../packages/play-core/src/play-session.js';
import { defeatEnemy, getEnemyState } from '../packages/play-core/src/enemy-runtime.js';
import { inspectTreasure, openTreasure } from '../packages/play-core/src/interaction-runtime.js';
import { getRuntimeDoorState, isRuntimeHintRevealed } from '../packages/play-core/src/event-runtime.js';

const outputDir = path.resolve('artifacts/event-logic');
const fixturePath = path.resolve('spec/dungeon/fixtures/pce-perspective-combat-20-v1.json');
const spec = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const shortcut = spec.corridors.find((corridor) => corridor.id === 'corridor-10');
if (!shortcut) throw new Error('PCE fixture corridor-10 missing.');
shortcut.initiallyEnabled = false;
spec.entities.push({ id: 'enemy-03-dormant', type: 'enemy', roomId: 'room-09', initiallyActive: false });
spec.events = [
  {
    id: 'event-room02-briefing',
    trigger: { type: 'on_enter_room', roomId: 'room-02' },
    conditions: [{ type: 'one_shot' }],
    actions: [
      { type: 'set_flag', key: 'route-briefed', value: true },
      { type: 'give_reward', itemId: 'map-token', count: 1 },
      { type: 'reveal_hint', hintId: 'split-route-hint' },
      { type: 'unlock_open_door', doorId: 'demo-gold-door' },
    ],
  },
  {
    id: 'event-open-plain-chest',
    trigger: { type: 'on_open_treasure', entityId: 'chest-plain' },
    conditions: [{ type: 'one_shot' }],
    actions: [
      { type: 'enable_shortcut', corridorId: 'corridor-10' },
      { type: 'give_reward', itemId: 'chest-key', count: 1 },
      { type: 'set_flag', key: 'plain-chest-event', value: true },
    ],
  },
  {
    id: 'event-warning-chest-reviewed',
    trigger: { type: 'on_interact_entity', entityId: 'chest-warning' },
    conditions: [
      { type: 'one_shot' },
      { type: 'flag', key: 'route-briefed', value: true },
    ],
    actions: [{ type: 'set_flag', key: 'warning-reviewed', value: true }],
  },
  {
    id: 'event-pce-enemies-cleared',
    trigger: { type: 'on_enemy_group_cleared', enemyIds: ['enemy-01', 'enemy-02'] },
    conditions: [{ type: 'one_shot' }],
    actions: [
      { type: 'give_reward', itemId: 'combat-token', count: 1 },
      { type: 'set_flag', key: 'pce-enemies-cleared', value: true },
    ],
  },
  {
    id: 'event-room09-spawn',
    trigger: { type: 'on_enter_room', roomId: 'room-09' },
    conditions: [
      { type: 'one_shot' },
      { type: 'item_owned', itemId: 'combat-token', minCount: 1 },
      { type: 'enemy_group_state', enemyIds: ['enemy-01', 'enemy-02'], state: 'cleared' },
    ],
    actions: [{ type: 'spawn_enemy_group', enemyIds: ['enemy-03-dormant'] }],
  },
];

const authoringBefore = JSON.stringify(spec);
const started = startPlaySession(spec, { startedAt: 5000 });
if (!started.ok) throw new Error(`START failed: ${JSON.stringify(started)}`);
let session = started.session;
const snapshotBefore = JSON.stringify(session.snapshot);
const trace = [];

function requireOk(result, label) {
  if (!result?.ok) throw new Error(`${label} failed: ${JSON.stringify(result)}`);
  return result.session;
}

function move(roomId, at) {
  const previousSession = session;
  const previous = JSON.stringify(previousSession);
  session = requireOk(movePlaySession(previousSession, roomId, { at }), `move ${roomId}`);
  trace.push({ type: 'move', roomId, at, previousPreserved: JSON.stringify(previousSession) === previous });
}

function mutate(label, eventType, action, at) {
  const previousSession = session;
  const previous = JSON.stringify(previousSession);
  session = requireOk(action(previousSession), label);
  trace.push({ type: eventType, at, previousPreserved: JSON.stringify(previousSession) === previous });
}

move('room-01', 5010);
move('room-02', 5011);
const blockedBeforeOpen = movePlaySession(session, 'room-11', { at: 5012 });

move('room-03', 5013);
mutate('open chest-plain', 'treasure-opened', (value) => openTreasure(value, 'chest-plain', { at: 5014 }), 5014);
move('room-02', 5015);
move('room-11', 5016);
move('room-12', 5017);
move('room-05', 5018);
move('room-04', 5019);
move('room-13', 5020);
move('room-14', 5021);
mutate('inspect chest-warning', 'treasure-inspected', (value) => inspectTreasure(value, 'chest-warning', { at: 5022 }), 5022);
move('room-13', 5023);
move('room-04', 5024);
move('room-05', 5025);
move('room-06', 5026);
move('room-07', 5027);
move('room-08', 5028);
mutate('defeat enemy-01', 'enemy-defeated', (value) => defeatEnemy(value, 'enemy-01', { at: 5029 }), 5029);
const combatTokenAfterFirstEnemy = session.gameplayState.inventory['combat-token'] ?? 0;
move('room-07', 5030);
move('room-17', 5031);
move('room-18', 5032);
mutate('defeat enemy-02', 'enemy-defeated', (value) => defeatEnemy(value, 'enemy-02', { at: 5033 }), 5033);
move('room-09', 5034);
const spawnedEnemyAtRoom09 = getEnemyState(session, 'enemy-03-dormant');
move('room-10', 5035);

const result = createPlayResult(session);
const logicEvents = session.events.filter((event) => event.type === 'logic-event-fired');
const logicEventIds = logicEvents.map((event) => event.eventId);
const expectedEventIds = [
  'event-room02-briefing',
  'event-open-plain-chest',
  'event-warning-chest-reviewed',
  'event-pce-enemies-cleared',
  'event-room09-spawn',
];

const checks = {
  shortcutBlockedBeforeTreasureOpen:
    blockedBeforeOpen.ok === false && blockedBeforeOpen.error?.code === 'ROOM_NOT_ADJACENT',
  roomEnterEventFiredOnce:
    logicEventIds.filter((id) => id === 'event-room02-briefing').length === 1,
  oneShotRewardNotDuplicated: session.gameplayState.inventory['map-token'] === 1,
  roomFlagSet: session.gameplayState.flags['route-briefed'] === true,
  hintRevealed: isRuntimeHintRevealed(session, 'split-route-hint') === true,
  logicalDoorOpened: (() => {
    const state = getRuntimeDoorState(session, 'demo-gold-door');
    return state.unlocked === true && state.open === true;
  })(),
  treasureOpenEventSetFlag: session.gameplayState.flags['plain-chest-event'] === true,
  treasureRewardGranted: session.gameplayState.inventory['chest-key'] === 1,
  shortcutEnabledAfterTreasureOpen: session.visitedRoomIds.includes('room-11'),
  warningInteractFlagConditionPassed: session.gameplayState.flags['warning-reviewed'] === true,
  groupEventNotEarly: combatTokenAfterFirstEnemy === 0,
  enemyGroupRewardAfterSecond: session.gameplayState.inventory['combat-token'] === 1,
  enemyGroupFlagAfterSecond: session.gameplayState.flags['pce-enemies-cleared'] === true,
  dormantEnemyInitiallyDeclared: spec.entities.find((entity) => entity.id === 'enemy-03-dormant')?.initiallyActive === false,
  dormantEnemySpawnedAtRoom09: spawnedEnemyAtRoom09?.state.status === 'active',
  allSupportedTriggersObserved:
    ['on_enter_room', 'on_interact_entity', 'on_open_treasure', 'on_enemy_group_cleared']
      .every((type) => logicEvents.some((event) => event.trigger.type === type)),
  expectedLogicEventsExactlyOnce:
    expectedEventIds.every((id) => logicEventIds.filter((value) => value === id).length === 1),
  allExpectedActionsObserved:
    ['set_flag', 'give_reward', 'reveal_hint', 'unlock_open_door', 'enable_shortcut', 'spawn_enemy_group']
      .every((type) => logicEvents.some((event) => event.actionTypes.includes(type))),
  tracePreviousPreserved: trace.every((entry) => entry.previousPreserved === true),
  authoringUnchanged: JSON.stringify(spec) === authoringBefore,
  snapshotUnchanged: JSON.stringify(session.snapshot) === snapshotBefore,
  sessionCleared: session.status === 'cleared' && session.currentRoomId === 'room-10',
  resultStillValid: result.ok === true && result.result.status === 'cleared',
};

const passed = Object.values(checks).every(Boolean);
fs.mkdirSync(outputDir, { recursive: true });
const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  node: process.version,
  sourceFixture: spec.id,
  passed,
  checks,
  logicEvents,
  trace,
  summary: {
    status: session.status,
    currentRoomId: session.currentRoomId,
    moves: session.moves,
    logicEventIds,
    inventory: session.gameplayState.inventory,
    relevantFlags: {
      routeBriefed: session.gameplayState.flags['route-briefed'] ?? false,
      plainChestEvent: session.gameplayState.flags['plain-chest-event'] ?? false,
      warningReviewed: session.gameplayState.flags['warning-reviewed'] ?? false,
      pceEnemiesCleared: session.gameplayState.flags['pce-enemies-cleared'] ?? false,
    },
    spawnedEnemy: spawnedEnemyAtRoom09,
    eventCount: session.events.length,
  },
};

const outputPath = path.join(outputDir, 'dai-033-event-logic.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ generatedAt, passed, checks, outputPath }, null, 2));
if (!passed) process.exitCode = 1;
