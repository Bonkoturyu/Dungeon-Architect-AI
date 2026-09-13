import fs from 'node:fs';
import path from 'node:path';
import {
  PLAY_FAILURE_REASONS,
  applyPlaySessionStateCommand,
  createPlayResult,
  failPlaySession,
  movePlaySession,
  startPlaySession,
} from '../packages/play-core/src/play-session.js';

const outputDir = path.resolve('artifacts/result-runtime');
const fixturePath = path.resolve('spec/dungeon/fixtures/pce-perspective-combat-20-v1.json');
const spec = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const authoringBefore = JSON.stringify(spec);

function requireOk(result, label) {
  if (!result?.ok) throw new Error(`${label} failed: ${JSON.stringify(result)}`);
  return result.session;
}

function move(session, roomId, at, trace) {
  const previous = JSON.stringify(session);
  const next = requireOk(movePlaySession(session, roomId, { at }), `move ${roomId}`);
  trace.push({ type: 'move', roomId, at, previousPreserved: JSON.stringify(session) === previous });
  return next;
}

function increment(session, counter, delta, at) {
  return requireOk(applyPlaySessionStateCommand(session, {
    type: 'increment-counter',
    counter,
    delta,
  }, { at }), `increment ${counter}`);
}

let clearedSession = startPlaySession(spec, { startedAt: 6000 }).session;
const clearSnapshotBefore = JSON.stringify(clearedSession.snapshot);
const clearTrace = [];
clearedSession = increment(clearedSession, 'damageTaken', 7, 6001);
clearedSession = increment(clearedSession, 'healingReceived', 3, 6002);
clearedSession = increment(clearedSession, 'interactions', 4, 6003);
clearedSession = increment(clearedSession, 'treasuresOpened', 1, 6004);
clearedSession = increment(clearedSession, 'trapsTriggered', 1, 6005);
clearedSession = increment(clearedSession, 'enemiesCleared', 2, 6006);
clearedSession = increment(clearedSession, 'recoveryUsed', 1, 6007);
for (let index = 1; index <= 10; index += 1) {
  const roomId = `room-${String(index).padStart(2, '0')}`;
  clearedSession = move(clearedSession, roomId, 6010 + index, clearTrace);
}
const clearResult = createPlayResult(clearedSession);

let failedSession = startPlaySession(spec, { startedAt: 7000 }).session;
const failSnapshotBefore = JSON.stringify(failedSession.snapshot);
const failTrace = [];
failedSession = move(failedSession, 'room-01', 7010, failTrace);
failedSession = move(failedSession, 'room-02', 7020, failTrace);
failedSession = increment(failedSession, 'damageTaken', 12, 7021);
const beforeFailure = JSON.stringify(failedSession);
const failedTransition = failPlaySession(failedSession, 'timeout', { at: 7060 });
failedSession = requireOk(failedTransition, 'fail timeout session');
const failedResult = createPlayResult(failedSession);
const moveAfterFailure = movePlaySession(failedSession, 'room-03', { at: 7070 });
const stateAfterFailure = applyPlaySessionStateCommand(failedSession, {
  type: 'set-flag', key: 'should-not-apply', value: true,
}, { at: 7071 });

const invalidFailureBase = startPlaySession(spec, { startedAt: 8000 }).session;
const invalidFailureBefore = JSON.stringify(invalidFailureBase);
const invalidFailure = failPlaySession(invalidFailureBase, 'not-supported', { at: 8010 });

const deathBase = startPlaySession(spec, { startedAt: 9000 }).session;
const deathSession = requireOk(failPlaySession(deathBase, 'player-defeated', { at: 9015 }), 'player defeat');
const deathResult = createPlayResult(deathSession);

const unfinishedSession = startPlaySession(spec, { startedAt: 10000 }).session;
const unfinishedResult = createPlayResult(unfinishedSession);

const checks = {
  failureReasonsFixed:
    JSON.stringify(PLAY_FAILURE_REASONS) === JSON.stringify([
      'player-defeated', 'timeout', 'progression-blocked', 'stopped',
    ]),
  clearSessionCleared: clearedSession.status === 'cleared' && clearedSession.currentRoomId === 'room-10',
  clearResultValid: clearResult.ok === true && clearResult.result.status === 'cleared',
  clearFailureReasonNull: clearResult.ok === true && clearResult.result.failureReason === null,
  clearRouteCaptured:
    clearResult.ok === true && clearResult.result.routeRoomIds.length === 11 &&
    clearResult.result.routeRoomIds[0] === 'room-00' && clearResult.result.routeRoomIds.at(-1) === 'room-10',
  clearVisitedCount: clearResult.ok === true && clearResult.result.metrics.roomsVisited === 11,
  clearRoomEntries: clearResult.ok === true && clearResult.result.metrics.roomEntries === 11,
  clearCountersProjected:
    clearResult.ok === true &&
    clearResult.result.metrics.interactions === 4 &&
    clearResult.result.metrics.enemiesCleared === 2 &&
    clearResult.result.metrics.treasuresOpened === 1 &&
    clearResult.result.metrics.trapsTriggered === 1 &&
    clearResult.result.metrics.recoveryUsed === 1 &&
    clearResult.result.metrics.damageTaken === 7 &&
    clearResult.result.metrics.healingReceived === 3 &&
    clearResult.result.metrics.deaths === 0,
  clearElapsed: clearResult.ok === true && clearResult.result.elapsed === 20,
  clearTracePreviousPreserved: clearTrace.every((entry) => entry.previousPreserved === true),
  clearSnapshotUnchanged: JSON.stringify(clearedSession.snapshot) === clearSnapshotBefore,
  timeoutFailureTransition:
    failedSession.status === 'failed' && failedSession.failureReason === 'timeout' && failedSession.completedAt === 7060,
  timeoutFailurePreviousPreserved: JSON.stringify(JSON.parse(beforeFailure)) === beforeFailure,
  timeoutResultValid:
    failedResult.ok === true && failedResult.result.status === 'failed' && failedResult.result.failureReason === 'timeout',
  timeoutRouteCaptured:
    failedResult.ok === true &&
    JSON.stringify(failedResult.result.routeRoomIds) === JSON.stringify(['room-00', 'room-01', 'room-02']),
  timeoutMetrics:
    failedResult.ok === true &&
    failedResult.result.metrics.roomsVisited === 3 &&
    failedResult.result.metrics.roomEntries === 3 &&
    failedResult.result.metrics.damageTaken === 12 &&
    failedResult.result.metrics.deaths === 0,
  timeoutElapsed: failedResult.ok === true && failedResult.result.elapsed === 60,
  failedSessionTerminal:
    moveAfterFailure.ok === false && moveAfterFailure.error?.code === 'SESSION_NOT_PLAYING' &&
    stateAfterFailure.ok === false && stateAfterFailure.error?.code === 'SESSION_NOT_PLAYING',
  failSnapshotUnchanged: JSON.stringify(failedSession.snapshot) === failSnapshotBefore,
  invalidFailureRejected:
    invalidFailure.ok === false && invalidFailure.error?.code === 'FAILURE_REASON_UNSUPPORTED',
  invalidFailurePreserved: JSON.stringify(invalidFailureBase) === invalidFailureBefore,
  deathResultReportsOne:
    deathResult.ok === true &&
    deathResult.result.failureReason === 'player-defeated' &&
    deathResult.result.metrics.deaths === 1,
  unfinishedResultRejected:
    unfinishedResult.ok === false && unfinishedResult.error?.code === 'SESSION_NOT_FINISHED',
  authoringUnchanged: JSON.stringify(spec) === authoringBefore,
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
  clearTrace,
  failTrace,
  clearResult: clearResult.ok ? clearResult.result : clearResult,
  failedResult: failedResult.ok ? failedResult.result : failedResult,
  deathResult: deathResult.ok ? deathResult.result : deathResult,
};

const outputPath = path.join(outputDir, 'dai-034-clear-failure-result.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ generatedAt, passed, checks, outputPath }, null, 2));
if (!passed) process.exitCode = 1;
