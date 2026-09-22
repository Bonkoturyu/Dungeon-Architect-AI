import fs from "node:fs";
import path from "node:path";
import { generateDungeonSpec } from "../packages/generator/src/dungeon-generator.js";
import {
  createPlayResult,
  movePlaySession,
  startPlaySession
} from "../packages/play-core/src/play-session.js";
import { defeatEnemy } from "../packages/play-core/src/enemy-runtime.js";
import { openTreasure } from "../packages/play-core/src/interaction-runtime.js";
import { deterministicTreasureReward } from "../packages/play-core/src/progression-runtime.js";
import { simulateDungeon } from "../packages/simulation-core/src/simulator.js";
import { projectSimulationMetrics } from "../packages/simulation-core/src/metrics.js";

const outputDir = path.resolve("artifacts/dai-094");
fs.mkdirSync(outputDir, { recursive: true });

function requireOk(result, label) {
  if (!result?.ok) throw new Error(`${label} failed: ${JSON.stringify(result?.error ?? result)}`);
  return result;
}

function move(session, roomId, at) {
  return requireOk(movePlaySession(session, roomId, { at }), `move ${roomId}`).session;
}

const spec = generateDungeonSpec({
  seed: 94094,
  roomCount: 5,
  routeChoice: 0,
  id: "dai-094-progression-loot"
});
spec.entities = spec.entities.filter((entity) => entity.type === "start" || entity.type === "goal");
spec.events = [];

function treasureIdFor(slot) {
  for (let index = 1; index <= 128; index += 1) {
    const id = `treasure-${slot}-probe-${index}`;
    const reward = deterministicTreasureReward({ dungeonSeed: spec.seed }, id);
    if (reward.item.slot === slot) return id;
  }
  throw new Error(`Could not find deterministic treasure ID for slot ${slot}`);
}

const enemyIds = ["enemy-xp-1", "enemy-xp-2", "enemy-xp-3"];
const weaponTreasureId = treasureIdFor("weapon");
const armorTreasureId = treasureIdFor("armor");

spec.entities.push(
  ...enemyIds.map((id) => ({ id, type: "enemy", roomId: "room-002" })),
  { id: weaponTreasureId, type: "treasure", roomId: "room-003" },
  { id: armorTreasureId, type: "treasure", roomId: "room-004" }
);

const authoringBefore = JSON.stringify(spec);

const started = requireOk(startPlaySession(spec, { startedAt: 100 }), "START");
let session = move(started.session, "room-002", 110);

const enemyRewards = [];
for (let index = 0; index < enemyIds.length; index += 1) {
  const defeated = requireOk(
    defeatEnemy(session, enemyIds[index], { at: 111 + index }),
    `defeat ${enemyIds[index]}`
  );
  session = defeated.session;
  enemyRewards.push(defeated.reward);
}

const afterEnemies = JSON.parse(JSON.stringify(session.playerState));
session = move(session, "room-003", 120);
const weaponOpened = requireOk(
  openTreasure(session, weaponTreasureId, { at: 121 }),
  "open weapon treasure"
);
session = weaponOpened.session;

session = move(session, "room-004", 130);
const armorOpened = requireOk(
  openTreasure(session, armorTreasureId, { at: 131 }),
  "open armor treasure"
);
session = armorOpened.session;

session = move(session, "room-005", 140);
const directResult = requireOk(createPlayResult(session), "direct Result").result;

const scriptedActions = [
  { type: "move", roomId: "room-002" },
  ...enemyIds.map((enemyId) => ({ type: "defeat-enemy", enemyId })),
  { type: "move", roomId: "room-003" },
  { type: "open-treasure", treasureId: weaponTreasureId },
  { type: "move", roomId: "room-004" },
  { type: "open-treasure", treasureId: armorTreasureId },
  { type: "move", roomId: "room-005" }
];

function scriptedPolicy() {
  let index = 0;
  return () => scriptedActions[index++];
}

const simulated = requireOk(
  simulateDungeon(spec, scriptedPolicy(), { policyId: "dai-094-scripted", maxSteps: 32 }),
  "simulation"
).simulation;
const simulationMetrics = projectSimulationMetrics(spec, simulated);

const repeatSimulation = requireOk(
  simulateDungeon(spec, scriptedPolicy(), { policyId: "dai-094-scripted", maxSteps: 32 }),
  "repeat simulation"
).simulation;

const counters = directResult.metrics;
const weapon = directResult.playerState.equipment.weapon;
const armor = directResult.playerState.equipment.armor;

const checks = {
  enemyRewardsDeterministicAndGranted:
    enemyRewards.length === 3 &&
    enemyRewards.every((reward) => reward && reward.xp >= 8 && reward.xp <= 12 && reward.gold >= 3 && reward.gold <= 8) &&
    counters.xpEarned >= 24 &&
    counters.goldEarned > 0,
  levelUpOccurs:
    afterEnemies.level >= 2 &&
    afterEnemies.maxHp >= 22 &&
    counters.levelUps >= 1,
  treasureLootFillsWeaponAndArmor:
    weapon?.slot === "weapon" &&
    armor?.slot === "armor" &&
    weaponOpened.reward.item.slot === "weapon" &&
    armorOpened.reward.item.slot === "armor" &&
    counters.lootCollected === 2,
  lootInventoryRecorded:
    session.gameplayState.inventory[weaponOpened.reward.item.id] >= 1 &&
    session.gameplayState.inventory[armorOpened.reward.item.id] >= 1,
  resultCarriesProgression:
    directResult.playerState.level >= 2 &&
    directResult.playerState.gold === counters.goldEarned &&
    directResult.metrics.xpEarned > 0 &&
    directResult.metrics.goldEarned > 0,
  simulatorCarriesProgression:
    simulationMetrics.xpEarned === directResult.metrics.xpEarned &&
    simulationMetrics.goldEarned === directResult.metrics.goldEarned &&
    simulationMetrics.lootCollected === 2 &&
    simulationMetrics.finalLevel === directResult.playerState.level &&
    simulationMetrics.finalGold === directResult.playerState.gold &&
    simulationMetrics.equippedWeaponTier === weapon.tier &&
    simulationMetrics.equippedArmorTier === armor.tier,
  repeatedSimulationIsDeterministic:
    JSON.stringify(repeatSimulation.result.playerState) === JSON.stringify(simulated.result.playerState) &&
    JSON.stringify(repeatSimulation.result.metrics) === JSON.stringify(simulated.result.metrics),
  authoringSpecUnchanged: JSON.stringify(spec) === authoringBefore
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
  enemyRewards,
  weaponReward: weaponOpened.reward,
  armorReward: armorOpened.reward,
  directResult,
  simulationMetrics
};

fs.writeFileSync(
  path.join(outputDir, "dai-094-progression-loot.json"),
  JSON.stringify(evidence, null, 2) + "\n"
);
console.log(JSON.stringify(evidence, null, 2));

if (!evidence.passed) {
  throw new Error(`DAI-094 progression invariant failed: ${falseChecks.join(", ")}`);
}
