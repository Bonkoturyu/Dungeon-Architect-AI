import fs from 'node:fs';
import path from 'node:path';
import {
  defeatEnemy,
  getEnemyState,
  listRoomEnemies,
  recordEnemyEncounter,
} from '../packages/play-core/src/enemy-runtime.js';
import {
  createPlayResult,
  movePlaySession,
  startPlaySession,
} from '../packages/play-core/src/play-session.js';

const fixturePath = path.resolve('spec/dungeon/fixtures/pce-perspective-combat-20-v1.json');
const outputDir = path.resolve('artifacts/enemy-runtime');
const spec = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const authoringBefore = JSON.stringify(spec);

const started = startPlaySession(spec, { startedAt: 2000 });
if (!started.ok) throw new Error(`START failed: ${JSON.stringify(started)}`);
let session = started.session;
const snapshotBefore = JSON.stringify(session.snapshot);
const checks = {};
const trace = [];

function move(roomId, at) {
  const before = session;
  const moved = movePlaySession(before, roomId, { at });
  if (!moved.ok) throw new Error(`move ${roomId} failed: ${JSON.stringify(moved)}`);
  session = moved.session;
  trace.push({ type: 'move', roomId, at, previousPreserved: JSON.stringify(before) !== JSON.stringify(session) });
}

function encounter(enemyId, at) {
  const before = session;
  const result = recordEnemyEncounter(before, enemyId, { at });
  if (!result.ok) throw new Error(`encounter ${enemyId} failed: ${JSON.stringify(result)}`);
  session = result.session;
  trace.push({ type: 'enemy-encounter', enemyId, at, previousPreserved: JSON.stringify(before) !== JSON.stringify(session) });
}

function defeat(enemyId, at) {
  const before = session;
  const result = defeatEnemy(before, enemyId, { at });
  if (!result.ok) throw new Error(`defeat ${enemyId} failed: ${JSON.stringify(result)}`);
  session = result.session;
  trace.push({ type: 'enemy-defeated', enemyId, at, previousPreserved: JSON.stringify(before) !== JSON.stringify(session) });
}

checks.pceEnemyCount = spec.entities.filter((entity) => entity.type === 'enemy').length === 2;
checks.enemy01InitiallyActive = listRoomEnemies(session, 'room-08').some(
  (entry) => entry.enemy.id === 'enemy-01' && entry.state.status === 'active' && entry.state.encounters === 0,
);
checks.enemy02InitiallyActive = listRoomEnemies(session, 'room-18').some(
  (entry) => entry.enemy.id === 'enemy-02' && entry.state.status === 'active' && entry.state.encounters === 0,
);

const remoteDefeat = defeatEnemy(session, 'enemy-01', { at: 2001 });
checks.remoteDefeatRejected = remoteDefeat.ok === false && remoteDefeat.error?.code === 'ENEMY_NOT_IN_CURRENT_ROOM';

let at = 2010;
for (const roomId of ['room-01', 'room-02', 'room-03', 'room-04', 'room-05', 'room-06', 'room-07', 'room-08']) {
  move(roomId, at++);
}
encounter('enemy-01', at++);
const enemy01AfterEncounter = getEnemyState(session, 'enemy-01');
checks.enemy01EncounterRecorded = enemy01AfterEncounter?.state.encounters === 1 && enemy01AfterEncounter?.state.status === 'active';
defeat('enemy-01', at++);
checks.enemy01Defeated = getEnemyState(session, 'enemy-01')?.state.status === 'defeated';
checks.enemyCounterOne = session.gameplayState.counters.enemiesCleared === 1;
checks.enemy01HiddenFromActiveList = listRoomEnemies(session, 'room-08').length === 0;
checks.enemy01VisibleWhenIncludingDefeated = listRoomEnemies(session, 'room-08', { includeDefeated: true }).length === 1;

const duplicateDefeat = defeatEnemy(session, 'enemy-01', { at: at++ });
checks.duplicateDefeatRejected = duplicateDefeat.ok === false && duplicateDefeat.error?.code === 'ENEMY_ALREADY_DEFEATED';
checks.duplicateDidNotIncrement = session.gameplayState.counters.enemiesCleared === 1;

for (const roomId of ['room-07', 'room-17', 'room-18']) move(roomId, at++);
encounter('enemy-02', at++);
defeat('enemy-02', at++);
checks.enemy02Defeated = getEnemyState(session, 'enemy-02')?.state.status === 'defeated';
checks.enemyCounterTwo = session.gameplayState.counters.enemiesCleared === 2;

for (const roomId of ['room-09', 'room-10']) move(roomId, at++);
checks.sessionCleared = session.status === 'cleared';
checks.finishedEnemyActionRejected = defeatEnemy(session, 'enemy-02', { at: at++ }).error?.code === 'SESSION_NOT_PLAYING';
checks.authoringUnchanged = JSON.stringify(spec) === authoringBefore;
checks.snapshotUnchanged = JSON.stringify(session.snapshot) === snapshotBefore;
checks.encounterEvents = session.events.filter((event) => event.type === 'enemy-encounter').length === 2;
checks.defeatEvents = session.events.filter((event) => event.type === 'enemy-defeated').length === 2;

const result = createPlayResult(session);
checks.resultStillValid = result.ok === true && result.result.status === 'cleared';

const passed = Object.values(checks).every(Boolean) && trace.every((entry) => entry.previousPreserved);
const generatedAt = new Date().toISOString();
const evidence = {
  generatedAt,
  node: process.version,
  sourceFixture: spec.id,
  passed,
  checks,
  trace,
  summary: {
    status: session.status,
    currentRoomId: session.currentRoomId,
    moves: session.moves,
    enemiesCleared: session.gameplayState.counters.enemiesCleared,
    enemy01: getEnemyState(session, 'enemy-01'),
    enemy02: getEnemyState(session, 'enemy-02'),
    eventCount: session.events.length,
  },
};

fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'dai-031-enemy-minimum.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ generatedAt, passed, checks, outputPath }, null, 2));

if (!passed) process.exitCode = 1;
