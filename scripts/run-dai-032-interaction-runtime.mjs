import fs from 'node:fs';
import path from 'node:path';
import { createPlayResult, movePlaySession, startPlaySession } from '../packages/play-core/src/play-session.js';
import {
  avoidTrap,
  getRecoveryState,
  getTrapState,
  getTreasureState,
  inspectTrap,
  inspectTreasure,
  listRoomInteractables,
  openTreasure,
  triggerTrap,
  useRecovery,
} from '../packages/play-core/src/interaction-runtime.js';

const outputDir = path.resolve('artifacts/interaction-runtime');
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

function applyInteraction(session, action, label, traceEntry, trace) {
  const previous = JSON.stringify(session);
  const next = requireOk(action(session), label);
  trace.push({ ...traceEntry, previousPreserved: JSON.stringify(session) === previous });
  return next;
}

const started = startPlaySession(spec, { startedAt: 3000 });
if (!started.ok) throw new Error(`START failed: ${JSON.stringify(started)}`);
let session = started.session;
const snapshotBefore = JSON.stringify(session.snapshot);
const trace = [];

session = move(session, 'room-01', 3010, trace);
session = move(session, 'room-02', 3011, trace);
session = move(session, 'room-03', 3012, trace);
session = applyInteraction(
  session,
  (value) => openTreasure(value, 'chest-plain', { at: 3013 }),
  'open chest-plain',
  { type: 'treasure-opened', entityId: 'chest-plain', at: 3013 },
  trace,
);

session = move(session, 'room-04', 3014, trace);
session = move(session, 'room-13', 3015, trace);
session = move(session, 'room-14', 3016, trace);
const warningBefore = getTreasureState(session, 'chest-warning');
session = applyInteraction(
  session,
  (value) => inspectTreasure(value, 'chest-warning', { at: 3017 }),
  'inspect chest-warning',
  { type: 'treasure-inspected', entityId: 'chest-warning', at: 3017 },
  trace,
);
const warningAfter = getTreasureState(session, 'chest-warning');

session = move(session, 'room-13', 3018, trace);
session = move(session, 'room-04', 3019, trace);
session = move(session, 'room-05', 3020, trace);
session = move(session, 'room-19', 3021, trace);
session = applyInteraction(
  session,
  (value) => useRecovery(value, 'recovery-01', { at: 3022 }),
  'use recovery-01',
  { type: 'recovery-used', entityId: 'recovery-01', at: 3022 },
  trace,
);

session = move(session, 'room-05', 3023, trace);
session = move(session, 'room-06', 3024, trace);
session = move(session, 'room-15', 3025, trace);
session = move(session, 'room-16', 3026, trace);
const trapBefore = getTrapState(session, 'trap-01');
session = applyInteraction(
  session,
  (value) => inspectTrap(value, 'trap-01', { at: 3027 }),
  'inspect trap-01',
  { type: 'trap-inspected', entityId: 'trap-01', at: 3027 },
  trace,
);
session = applyInteraction(
  session,
  (value) => avoidTrap(value, 'trap-01', { at: 3028 }),
  'avoid trap-01',
  { type: 'trap-avoided', entityId: 'trap-01', at: 3028 },
  trace,
);

session = move(session, 'room-08', 3029, trace);
session = move(session, 'room-09', 3030, trace);
session = move(session, 'room-10', 3031, trace);
const result = createPlayResult(session);

let triggerSession = startPlaySession(spec, { startedAt: 4000 }).session;
for (const [roomId, at] of [
  ['room-01', 4010], ['room-02', 4011], ['room-03', 4012], ['room-04', 4013],
  ['room-05', 4014], ['room-06', 4015], ['room-15', 4016], ['room-16', 4017],
]) {
  triggerSession = requireOk(movePlaySession(triggerSession, roomId, { at }), `trigger-run move ${roomId}`);
}
const triggerPrevious = JSON.stringify(triggerSession);
triggerSession = requireOk(triggerTrap(triggerSession, 'trap-01', { at: 4018 }), 'trigger trap-01');
const triggerPreviousPreserved = JSON.stringify(startPlaySession(spec, { startedAt: 4000 }).session.snapshot) === JSON.stringify(triggerSession.snapshot) && triggerPrevious.length > 0;

const checks = {
  pceTreasureCount: spec.entities.filter((entity) => entity.type === 'treasure').length === 2,
  pceTrapCount: spec.entities.filter((entity) => entity.type === 'trap').length === 1,
  pceRecoveryCount: spec.entities.filter((entity) => entity.type === 'recovery').length === 1,
  chestPlainOpened: getTreasureState(session, 'chest-plain')?.state.status === 'opened',
  chestPlainCounterOne: session.gameplayState.counters.treasuresOpened === 1,
  warningChestMetadataVisible: warningBefore?.warning === 'floor-scratches',
  warningChestStayedClosed: warningAfter?.state.status === 'closed',
  warningChestInspected: warningAfter?.state.inspections === 1,
  recoveryUsed: getRecoveryState(session, 'recovery-01')?.state.status === 'used',
  recoveryCounterOne: session.gameplayState.counters.recoveryUsed === 1,
  trapWarningVisible: trapBefore?.warning === 'floor-cracks',
  trapAvoided: getTrapState(session, 'trap-01')?.state.status === 'avoided',
  avoidedTrapNotTriggered: session.gameplayState.counters.trapsTriggered === 0,
  triggeredTrapCounterOne: triggerSession.gameplayState.counters.trapsTriggered === 1,
  triggeredTrapState: getTrapState(triggerSession, 'trap-01')?.state.status === 'triggered',
  triggerSnapshotStillFixed: triggerPreviousPreserved,
  resolvedEntitiesHiddenByDefault:
    listRoomInteractables(session, 'room-03').length === 0 &&
    listRoomInteractables(session, 'room-19').length === 0 &&
    listRoomInteractables(session, 'room-16').length === 0,
  warningChestStillActive: listRoomInteractables(session, 'room-14').some((entry) => entry.entity.id === 'chest-warning'),
  interactionCounterFive: session.gameplayState.counters.interactions === 5,
  sessionCleared: session.status === 'cleared' && session.currentRoomId === 'room-10',
  resultStillValid: result.ok === true && result.result.status === 'cleared',
  authoringUnchanged: JSON.stringify(spec) === authoringBefore,
  snapshotUnchanged: JSON.stringify(session.snapshot) === snapshotBefore,
  tracePreviousPreserved: trace.every((entry) => entry.previousPreserved === true),
  expectedInteractionEvents:
    ['treasure-opened', 'treasure-inspected', 'recovery-used', 'trap-inspected', 'trap-avoided']
      .every((type) => session.events.some((event) => event.type === type)),
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
  trace,
  summary: {
    status: session.status,
    currentRoomId: session.currentRoomId,
    moves: session.moves,
    interactions: session.gameplayState.counters.interactions,
    treasuresOpened: session.gameplayState.counters.treasuresOpened,
    trapsTriggered: session.gameplayState.counters.trapsTriggered,
    recoveryUsed: session.gameplayState.counters.recoveryUsed,
    chestPlain: getTreasureState(session, 'chest-plain'),
    chestWarning: getTreasureState(session, 'chest-warning'),
    trapAvoidedState: getTrapState(session, 'trap-01'),
    recoveryState: getRecoveryState(session, 'recovery-01'),
    triggerRunTrapState: getTrapState(triggerSession, 'trap-01'),
    eventCount: session.events.length,
  },
};

const outputPath = path.join(outputDir, 'dai-032-interaction-runtime.json');
fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ generatedAt, passed, checks, outputPath }, null, 2));
if (!passed) process.exitCode = 1;
