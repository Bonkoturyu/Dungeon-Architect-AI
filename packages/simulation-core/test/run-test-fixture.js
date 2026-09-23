import { createDungeonRunSpec } from '../../run-core/src/dungeon-run.js';

function floorDungeon(index) {
  const prefix = `f${index + 1}`;
  return {
    schemaVersion: '1.0',
    id: `dai-098-${prefix}`,
    seed: 98000 + index,
    rooms: [
      { id: `${prefix}-start`, x: 0, z: 0, width: 8, depth: 8 },
      { id: `${prefix}-middle`, x: 12, z: 0, width: 8, depth: 8 },
      { id: `${prefix}-goal`, x: 24, z: 0, width: 8, depth: 8 },
    ],
    corridors: [
      {
        id: `${prefix}-corridor-1`,
        fromRoomId: `${prefix}-start`,
        toRoomId: `${prefix}-middle`,
        width: 3,
      },
      {
        id: `${prefix}-corridor-2`,
        fromRoomId: `${prefix}-middle`,
        toRoomId: `${prefix}-goal`,
        width: 3,
      },
    ],
    entities: [
      { id: `${prefix}-start-entity`, type: 'start', roomId: `${prefix}-start` },
      {
        id: `${prefix}-enemy`,
        type: 'enemy',
        roomId: `${prefix}-middle`,
        damage: 4,
      },
      {
        id: `${prefix}-treasure`,
        type: 'treasure',
        roomId: `${prefix}-middle`,
        warning: 'optional reward',
      },
      {
        id: `${prefix}-trap`,
        type: 'trap',
        roomId: `${prefix}-middle`,
        warning: 'pressure plate',
        damage: 8,
      },
      {
        id: `${prefix}-recovery`,
        type: 'recovery',
        roomId: `${prefix}-middle`,
        healing: 8,
      },
      { id: `${prefix}-goal-entity`, type: 'goal', roomId: `${prefix}-goal` },
    ],
    events: [],
  };
}

export function runFixture() {
  const created = createDungeonRunSpec(
    [floorDungeon(0), floorDungeon(1), floorDungeon(2)],
    { id: 'dai-098-run-fixture' },
  );
  if (!created.ok) throw new Error(JSON.stringify(created.errors));
  return created.spec;
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
