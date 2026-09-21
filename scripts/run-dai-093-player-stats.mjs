import fs from "node:fs";
import path from "node:path";
import { generateDungeonSpec } from "../packages/generator/src/dungeon-generator.js";
import {
  applyPlayerDamage,
  createPlayResult,
  movePlaySession,
  startPlaySession
} from "../packages/play-core/src/play-session.js";
import { resolveEnemyCombat } from "../packages/play-core/src/enemy-runtime.js";
import { triggerTrap, useRecovery } from "../packages/play-core/src/interaction-runtime.js";

const outputDir = path.resolve("artifacts/dai-093");
fs.mkdirSync(outputDir, { recursive: true });

function move(session, roomId, at) {
  const moved = movePlaySession(session, roomId, { at });
  if (!moved.ok) throw new Error(`move failed: ${JSON.stringify(moved.error)}`);
  return moved.session;
}

const spec = generateDungeonSpec({
  seed: 93093,
  roomCount: 5,
  routeChoice: 0,
  id: "dai-093-player-stats"
});
spec.entities = spec.entities.filter((entity) => entity.type === "start" || entity.type === "goal");
spec.entities.push(
  { id: "enemy-dai-093", type: "enemy", roomId: "room-002" },
  { id: "trap-dai-093", type: "trap", roomId: "room-003", warning: "floor-cracks" },
  { id: "recovery-dai-093", type: "recovery", roomId: "room-004" }
);

const sourceBefore = JSON.stringify(spec);
const started = startPlaySession(spec, { startedAt: 100, maxHp: 20 });
if (!started.ok) throw new Error(`START failed: ${JSON.stringify(started.errors)}`);

let session = move(started.session, "room-002", 110);
const combat = resolveEnemyCombat(session, "enemy-dai-093", { at: 111 });
if (!combat.ok) throw new Error(`combat failed: ${JSON.stringify(combat.error)}`);
session = combat.session;
const hpAfterEnemy = session.playerState.hp;

session = move(session, "room-003", 120);
const trap = triggerTrap(session, "trap-dai-093", { at: 121 });
if (!trap.ok) throw new Error(`trap failed: ${JSON.stringify(trap.error)}`);
session = trap.session;
const hpAfterTrap = session.playerState.hp;

session = move(session, "room-004", 130);
const recovery = useRecovery(session, "recovery-dai-093", { at: 131 });
if (!recovery.ok) throw new Error(`recovery failed: ${JSON.stringify(recovery.error)}`);
session = recovery.session;
const hpAfterRecovery = session.playerState.hp;

session = move(session, "room-005", 140);
const clearedResult = createPlayResult(session);
if (!clearedResult.ok) throw new Error(`Result failed: ${JSON.stringify(clearedResult.error)}`);

const lethalStarted = startPlaySession(spec, { startedAt: 200, maxHp: 5 });
if (!lethalStarted.ok) throw new Error("lethal START failed");
const lethal = applyPlayerDamage(lethalStarted.session, 99, {
  at: 201,
  sourceType: "validation",
  sourceId: "lethal-probe"
});
if (!lethal.ok) throw new Error(`lethal damage failed: ${JSON.stringify(lethal.error)}`);
const failedResult = createPlayResult(lethal.session);
if (!failedResult.ok) throw new Error(`failed Result failed: ${JSON.stringify(failedResult.error)}`);

const checks = {
  startsAtFullHp:
    started.session.playerState.hp === 20 &&
    started.session.playerState.maxHp === 20,
  enemyCombatDealsDeterministicDamage:
    combat.damageApplied === 4 &&
    hpAfterEnemy === 16 &&
    combat.session.gameplayState.counters.damageTaken === 4 &&
    combat.session.gameplayState.counters.enemiesCleared === 1,
  trapDealsDeterministicDamage:
    hpAfterTrap === 10 &&
    trap.session.gameplayState.counters.damageTaken === 10 &&
    trap.session.gameplayState.counters.trapsTriggered === 1,
  recoveryHealsAndCaps:
    hpAfterRecovery === 18 &&
    recovery.session.gameplayState.counters.healingReceived === 8 &&
    recovery.session.gameplayState.counters.recoveryUsed === 1,
  clearedResultCarriesPlayerState:
    clearedResult.result.status === "cleared" &&
    clearedResult.result.playerState.hp === 18 &&
    clearedResult.result.playerState.maxHp === 20 &&
    clearedResult.result.metrics.damageTaken === 10 &&
    clearedResult.result.metrics.healingReceived === 8,
  lethalDamageFailsRun:
    lethal.session.status === "failed" &&
    lethal.session.failureReason === "player-defeated" &&
    lethal.session.playerState.hp === 0 &&
    failedResult.result.metrics.deaths === 1,
  authoringSpecUnchanged: JSON.stringify(spec) === sourceBefore,
};

const falseChecks = Object.entries(checks)
  .filter(([, value]) => value !== true)
  .map(([name]) => name);

const evidence = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: falseChecks.length === 0,
  checks,
  falseChecks,
  hpAfterEnemy,
  hpAfterTrap,
  hpAfterRecovery,
  clearedResult: clearedResult.result,
  failedResult: failedResult.result,
};

fs.writeFileSync(
  path.join(outputDir, "dai-093-player-stats.json"),
  JSON.stringify(evidence, null, 2) + "\n"
);
console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(`DAI-093 player-stat invariant failed: ${falseChecks.join(", ")}`);
}
