import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const fixtureUrl = new URL(
  '../../../spec/simulation/fixtures/dai-098-run-balance-v1.json',
  import.meta.url,
);

export function runFixture() {
  return JSON.parse(fs.readFileSync(fileURLToPath(fixtureUrl), 'utf8'));
}

function nextUnvisitedRoom(observation) {
  if (observation.adjacentRoomIds.includes(observation.goalRoomId)) {
    return observation.goalRoomId;
  }
  return (
    observation.adjacentRoomIds.find(
      (roomId) => !observation.visitedRoomIds.includes(roomId),
    ) ??
    observation.adjacentRoomIds[0] ??
    null
  );
}

export function createRunPolicyFactory({
  id,
  trapMode = 'avoid',
  openTreasure = false,
  useRecovery = false,
} = {}) {
  return (_dungeon, context) => {
    const decide = (observation) => {
      const enemy = observation.enemies[0];
      if (enemy) return { type: 'combat-enemy', enemyId: enemy.id };

      const trap = observation.interactables
        .filter((entry) => entry.type === 'trap')
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (trap) {
        return trapMode === 'trigger'
          ? { type: 'trigger-trap', trapId: trap.id }
          : { type: 'avoid-trap', trapId: trap.id };
      }

      const treasure = observation.interactables
        .filter((entry) => entry.type === 'treasure')
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (treasure && openTreasure) {
        return { type: 'open-treasure', treasureId: treasure.id };
      }

      const recovery = observation.interactables
        .filter((entry) => entry.type === 'recovery')
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (
        recovery &&
        useRecovery &&
        observation.playerState.hp < observation.playerState.maxHp
      ) {
        return { type: 'use-recovery', recoveryId: recovery.id };
      }

      const next = nextUnvisitedRoom(observation);
      return next ? { type: 'move', roomId: next } : { type: 'stop' };
    };

    Object.defineProperty(decide, 'policyId', {
      value: `${id}/floor-${context.floorNumber}`,
      enumerable: true,
    });
    return decide;
  };
}

export const SAFE_FACTORY = createRunPolicyFactory({
  id: 'safe',
  trapMode: 'avoid',
});

export const TREASURE_FACTORY = createRunPolicyFactory({
  id: 'treasure',
  trapMode: 'avoid',
  openTreasure: true,
  useRecovery: true,
});

export const RISK_FACTORY = createRunPolicyFactory({
  id: 'risk',
  trapMode: 'trigger',
  openTreasure: true,
  useRecovery: false,
});
