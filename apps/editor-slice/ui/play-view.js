import { derivePlayMap } from '../../../packages/play-core/src/play-map.js';
import { xpRequiredForNextLevel } from '../../../packages/play-core/src/progression-runtime.js';
import { t } from '../i18n.js';

// Playモードの表示（出口ボタン、HUDの数値、Resultの指標）。
// main.js の状態・DOM・操作は ctx で受け取り、main.js は import しない（循環防止）。
// 操作（previewPlayExit・movePlayToRoom）はイベント発火時の状態を読むため、関数として受け取る。

function exitLaneInfo(side, index, total) {
  if (total <= 1) {
    return { marker: '', labelKey: null };
  }

  const horizontalWall =
    side === 'north' || side === 'south';
  const markers = horizontalWall
    ? ['←', '•', '→']
    : ['↑', '•', '↓'];
  const keys = horizontalWall
    ? ['exit.laneLeft', 'exit.laneCenter', 'exit.laneRight']
    : ['exit.laneUpper', 'exit.laneCenter', 'exit.laneLower'];

  if (total === 2) {
    return index === 0
      ? { marker: markers[0], labelKey: keys[0] }
      : { marker: markers[2], labelKey: keys[2] };
  }

  if (total === 3) {
    return {
      marker: markers[index] ?? String(index + 1),
      labelKey: keys[index] ?? null,
    };
  }

  return {
    marker: String(index + 1),
    labelKey: null,
  };
}

export function renderPlayExits(ctx) {
  const {
    playExitBar,
    playExitButtons,
    playSession,
    mode,
    roomBlocksExit,
    getRoomPlan,
    sideIcon,
    previewPlayExit,
    movePlayToRoom,
  } = ctx;
  if (!playExitBar || !playExitButtons || !playSession || mode !== 'play') {
    if (playExitBar) playExitBar.hidden = true;
    if (playExitButtons) playExitButtons.replaceChildren();
    return;
  }

  if (roomBlocksExit()) {
    playExitBar.hidden = true;
    playExitButtons.replaceChildren();
    return;
  }

  const map = derivePlayMap(playSession);
  const roomPlan = getRoomPlan(map.currentRoomId);
  const openingByCorridor = new Map(
    (roomPlan?.doorOpenings ?? []).map((opening) => [opening.corridorId, opening])
  );

  const exits = map.currentExits
    .map((exit) => {
      const opening =
        openingByCorridor.get(exit.corridorId) ?? null;
      return {
        ...exit,
        side: opening?.side ?? null,
        openingOffset:
          Number.isFinite(opening?.centerOffset)
            ? opening.centerOffset
            : 0,
      };
    })
    .sort((a, b) => {
      const order = {
        north: 0,
        east: 1,
        south: 2,
        west: 3,
      };
      return (
        (order[a.side] ?? 9) -
          (order[b.side] ?? 9) ||
        a.openingOffset - b.openingOffset ||
        a.corridorId.localeCompare(b.corridorId)
      );
    });

  const center = document.createElement('span');
  center.className = 'exit-center';
  center.setAttribute('aria-hidden', 'true');

  const grouped = new Map();
  for (const exit of exits) {
    const side = exit.side ?? 'unknown';
    if (!grouped.has(side)) grouped.set(side, []);
    grouped.get(side).push(exit);
  }

  const slots = [];
  for (const [side, unsortedSideExits] of grouped) {
    const sideExits = [...unsortedSideExits].sort(
      (left, right) =>
        left.openingOffset - right.openingOffset ||
        left.corridorId.localeCompare(
          right.corridorId,
        ),
    );

    const slot = document.createElement('div');
    slot.className = `exit-slot side-${side}`;
    slot.classList.toggle(
      'has-multiple',
      sideExits.length > 1,
    );

    sideExits.forEach((exit, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        `exit-button ${exit.explored ? 'is-known' : 'is-unknown'}`;
      button.classList.toggle(
        'is-multi',
        sideExits.length > 1,
      );
      button.dataset.corridorId = exit.corridorId;
      button.dataset.explored = String(exit.explored);

      const icon = sideIcon(exit.side);
      const lane = exitLaneInfo(
        side,
        index,
        sideExits.length,
      );
      button.textContent =
        `${icon}${lane.marker}`;

      const directionKey =
        exit.side ?? 'unknown';
      const direction = t(
        `direction.${directionKey}`,
      );
      const laneLabel = lane.labelKey
        ? t(lane.labelKey)
        : '';
      const describedDirection =
        laneLabel
          ? `${direction} · ${laneLabel}`
          : direction;

      button.setAttribute(
        'aria-label',
        exit.explored
          ? t('exit.return', {
              direction:
                describedDirection,
            })
          : t('exit.explore', {
              direction:
                describedDirection,
            }),
      );
      button.title = exit.explored
        ? t('exit.known', {
            direction:
              describedDirection,
          })
        : t('exit.explore', {
            direction:
              describedDirection,
          });

      button.addEventListener(
        'pointerenter',
        () =>
          previewPlayExit(exit.corridorId),
      );
      button.addEventListener(
        'pointerleave',
        () => previewPlayExit(),
      );
      button.addEventListener(
        'focus',
        () =>
          previewPlayExit(exit.corridorId),
      );
      button.addEventListener(
        'blur',
        () => previewPlayExit(),
      );
      button.addEventListener(
        'click',
        () => {
          previewPlayExit();
          movePlayToRoom(
            exit.targetRoomId,
            exit.corridorId,
          );
        },
      );
      slot.append(button);
    });
    slots.push(slot);
  }

  playExitButtons.replaceChildren(center, ...slots);
  playExitBar.hidden = exits.length === 0;
}

export function updatePlayReadout(ctx) {
  const {
    weaponTierCount,
    armorTierCount,
    moveCount,
    mappedCount,
    playFloorCount,
    hpCount,
    levelCount,
    xpCount,
    goldCount,
    resultStatus,
    playModeLabel,
    playSession,
    currentFloorIndex,
    floorSessions,
    playSource,
    dungeonRunSession,
  } = ctx;
  if (weaponTierCount) weaponTierCount.textContent = playSession?.playerState?.equipment?.weapon ? `T${playSession.playerState.equipment.weapon.tier}` : t('play.unequipped');
  if (armorTierCount) armorTierCount.textContent = playSession?.playerState?.equipment?.armor ? `T${playSession.playerState.equipment.armor.tier}` : t('play.unequipped');
  if (!playSession) {
    if (moveCount) moveCount.textContent = '0';
    if (mappedCount) mappedCount.textContent = '0';
    if (playFloorCount) playFloorCount.textContent =
      `${currentFloorIndex + 1}/${Math.max(1, floorSessions.length)}`;
    if (hpCount) hpCount.textContent = '0/0';
    if (levelCount) levelCount.textContent = '1';
    if (xpCount) xpCount.textContent = '0/20';
    if (goldCount) goldCount.textContent = '0';
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    if (playModeLabel) {
      playModeLabel.textContent = '';
      playModeLabel.hidden = true;
    }
    return;
  }
  const map = derivePlayMap(playSession);
  const modeName = playSource === 'mystery' ? t('play.mysteryMode') : t('play.testMode');
  if (playModeLabel) {
    playModeLabel.textContent = modeName;
    playModeLabel.hidden = false;
  }
  if (moveCount) moveCount.textContent = String(playSession.moves);
  if (mappedCount) mappedCount.textContent = String(map.exploredRoomIds.length);
  if (playFloorCount) playFloorCount.textContent =
    `${(dungeonRunSession?.currentFloorIndex ?? 0) + 1}/${dungeonRunSession?.floorCount ?? 1}`;
  if (hpCount) hpCount.textContent = `${playSession.playerState?.hp ?? 0}/${playSession.playerState?.maxHp ?? 0}`;
  const level = playSession.playerState?.level ?? 1;
  if (levelCount) levelCount.textContent = String(level);
  if (xpCount) xpCount.textContent = `${playSession.playerState?.xp ?? 0}/${xpRequiredForNextLevel(level)}`;
  if (goldCount) goldCount.textContent = String(playSession.playerState?.gold ?? 0);
}

export function renderResultMetrics(result, { resultMetrics, lastDungeonRunResult }) {
  if (!resultMetrics) return;
  const metrics = result?.metrics ?? {};
  const player = result?.playerState ?? {};
  const items = [
    [t('result.floor'), `${lastDungeonRunResult?.floorsCompleted ?? 1}/${lastDungeonRunResult?.floorCount ?? 1}`],
    [t('result.hp'), `${player.hp ?? 0}/${player.maxHp ?? 0}`],
    [t('result.level'), player.level ?? 1],
    [t('result.xp'), `${player.xp ?? 0}/${xpRequiredForNextLevel(player.level ?? 1)}`],
    [t('result.gold'), player.gold ?? 0],
    [t('result.loot'), metrics.lootCollected ?? 0],
    [t('result.weapon'), player.equipment?.weapon ? `T${player.equipment.weapon.tier}` : '—'],
    [t('result.armor'), player.equipment?.armor ? `T${player.equipment.armor.tier}` : '—'],
    [t('result.damage'), metrics.damageTaken ?? 0],
    [t('result.healing'), metrics.healingReceived ?? 0],
    [t('result.enemy'), metrics.enemiesCleared ?? 0],
    [t('result.chest'), metrics.treasuresOpened ?? 0],
    [t('result.trap'), metrics.trapsTriggered ?? 0],
  ];
  const groups = [
    ['result.group.player', [['LV', items[2][1]], ['HP', items[1][1]], ['EXP', items[3][1]], ['G', items[4][1]]]],
    ['result.group.equipment', items.slice(6, 8)],
    ['result.group.run', [items[0], items[5], ...items.slice(8)]],
  ];
  resultMetrics.replaceChildren(...groups.map(([heading, metrics]) => {
    const group = document.createElement('section');
    group.className = 'result-metric-group';
    const title = document.createElement('h3');
    title.textContent = t(heading);
    const list = document.createElement('dl');
    list.replaceChildren(...metrics.map(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'result-metric';
      const term = document.createElement('dt');
      term.className = 'metric-label';
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = String(value);
      item.append(term, description);
      return item;
    }));
    group.append(title, list);
    return group;
  }));
  resultMetrics.hidden = false;
}
