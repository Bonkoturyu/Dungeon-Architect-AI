import fs from 'node:fs';
import path from 'node:path';
import { generateDungeonSpec } from '../packages/generator/src/dungeon-generator.js';
import {
  applyPlaySessionStateCommand,
  movePlaySession,
  startPlaySession,
} from '../packages/play-core/src/play-session.js';

const outputDir = path.resolve('artifacts/session-state');
const spec = generateDungeonSpec({
  seed: 3030,
  roomCount: 6,
  routeChoice: 0.5,
  id: 'dai-030-session-state-evidence',
});
spec.entities.push(
  { id: 'enemy-evidence', type: 'enemy', roomId: 'room-003' },
  { id: 'treasure-evidence', type: 'treasure', roomId: 'room-004' },
  { id: 'trap-evidence', type: 'trap', roomId: 'room-005' },
  { id: 'recovery-evidence', type: 'recovery', roomId: 'room-006' },
);

const authoringBefore = JSON.stringify(spec);
const started = startPlaySession(spec, { startedAt: 1000 });
if (!started.ok) throw new Error(`START failed: ${JSON.stringify(started)}`);
const startSession = started.session;
const snapshotBefore = JSON.stringify(startSession.snapshot);

let current = startSession;
const operations = [];

function stateCommand(command, at) {
  const previous = current;
  const result = applyPlaySessionStateCommand(previous, command, { at });
  if (!result.ok) throw new Error(`state command failed: ${JSON.stringify(result)}`);
  current = result.session;
  operations.push({
    kind: 'state-command',
    command,
    previousUnchanged: JSON.stringify(previous) !== JSON.stringify(current),
    snapshotStillFixed: JSON.stringify(current.snapshot) === snapshotBefore,
  });
}

stateCommand({ type: 'set-flag', key: 'gate-a-open', value: true }, 1001);
stateCommand({ type: 'set-inventory-count', itemId: 'key-a', count: 1 }, 1002);
stateCommand({
  type: 'set-entity-state',
  entityId: 'treasure-evidence',
  state: { opened: true },
}, 1003);
stateCommand({ type: 'increment-counter', counter: 'interactions', delta: 1 }, 1004);
stateCommand({ type: 'increment-counter', counter: 'treasuresOpened', delta: 1 }, 1005);

const beforeMove = current;
const moved = movePlaySession(beforeMove, 'room-002', { at: 1006 });
if (!moved.ok) throw new Error(`move failed: ${JSON.stringify(moved)}`);
current = moved.session;

const invalidEntity = applyPlaySessionStateCommand(current, {
  type: 'set-entity-state',
  entityId: 'missing-entity',
  state: { active: false },
}, { at: 1007 });

const checks = {
  startRoomEntriesIsOne: startSession.gameplayState.counters.roomEntries === 1,
  stateContainersInitialized:
    Object.keys(startSession.gameplayState.flags).length === 0 &&
    Object.keys(startSession.gameplayState.inventory).length === 0 &&
    Object.keys(startSession.gameplayState.entityStates).length === 0,
  flagStored: current.gameplayState.flags['gate-a-open'] === true,
  inventoryStored: current.gameplayState.inventory['key-a'] === 1,
  entityStateStored: current.gameplayState.entityStates['treasure-evidence']?.opened === true,
  interactionCounter: current.gameplayState.counters.interactions === 1,
  treasureCounter: current.gameplayState.counters.treasuresOpened === 1,
  moveIncrementedRoomEntries: current.gameplayState.counters.roomEntries === 2,
  previousMoveSessionUnchanged: beforeMove.gameplayState.counters.roomEntries === 1,
  invalidEntityRejected:
    invalidEntity.ok === false && invalidEntity.error?.code === 'INVALID_STATE_COMMAND',
  authoringUnchanged: JSON.stringify(spec) === authoringBefore,
  snapshotUnchanged: JSON.stringify(current.snapshot) === snapshotBefore,
  stateEventsRecorded: current.events.filter((event) => event.type === 'state-command').length === 5,
  moveEventRecorded: current.events.filter((event) => event.type === 'move').length === 1,
};

const passed = Object.values(checks).every(Boolean) && operations.every(
  (operation) => operation.previousUnchanged && operation.snapshotStillFixed,
);

fs.mkdirSync(outputDir, { recursive: true });
const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  node: process.version,
  passed,
  checks,
  operations,
  summary: {
    dungeonId: current.dungeonId,
    currentRoomId: current.currentRoomId,
    moves: current.moves,
    gameplayState: current.gameplayState,
    eventCount: current.events.length,
  },
};

const outputPath = path.join(outputDir, 'dai-030-session-state.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ generatedAt, passed, checks, outputPath }, null, 2));

if (!passed) process.exitCode = 1;
