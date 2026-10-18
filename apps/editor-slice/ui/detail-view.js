import { t } from '../i18n.js';

// 編集モードの詳細HUD（選択中のRoom・Entity・Corridorの詳細表示）。
// main.js の状態・DOM・操作は ctx で受け取り、main.js は import しない（循環防止）。

function createDetailRow(label, value, { mono = false } = {}) {
  const row = document.createElement('div');
  row.className = 'detail-row';

  const key = document.createElement('span');
  key.className = 'detail-key';
  key.textContent = label;

  const content = document.createElement('span');
  content.className = `detail-value${mono ? ' is-mono' : ''}`;
  content.textContent = String(value ?? '—');

  row.append(key, content);
  return row;
}

function createDetailGroup(title, children = []) {
  const group = document.createElement('section');
  group.className = 'detail-group';

  const heading = document.createElement('div');
  heading.className = 'detail-group-title';
  heading.textContent = title;

  const body = document.createElement('div');
  body.className = 'detail-group-body';
  body.append(...children);

  group.append(heading, body);
  return group;
}

function roomRoleLabel(roomId, { roomRole, roomKindLabel }) {
  const role = roomRole(roomId);
  const kind = roomKindLabel(roomId);
  const roleLabel = role === 'start' ? t('entity.start') : role === 'goal' ? t('entity.goal') : '';
  return [roleLabel, kind].filter(Boolean).join(' · ') || t('details.roleNormal');
}

function roomConnectionDetails(room, { authoringSpec, getRoomPlan }) {
  const roomPlan = getRoomPlan(room.id);
  const openingByCorridor = new Map(
    (roomPlan?.doorOpenings ?? []).map(
      (opening) => [opening.corridorId, opening],
    ),
  );

  return authoringSpec().corridors
    .filter(
      (corridor) =>
        corridor.fromRoomId === room.id ||
        corridor.toRoomId === room.id,
    )
    .map((corridor) => {
      const targetRoomId =
        corridor.fromRoomId === room.id
          ? corridor.toRoomId
          : corridor.fromRoomId;
      const opening = openingByCorridor.get(corridor.id);
      const side =
        opening?.side ??
        (corridor.fromRoomId === room.id
          ? corridor.fromSide
          : corridor.toSide) ??
        'unknown';
      return {
        corridor,
        targetRoomId,
        side,
      };
    })
    .sort((left, right) => {
      const order = {
        north: 0,
        east: 1,
        south: 2,
        west: 3,
        unknown: 9,
      };
      return (
        (order[left.side] ?? 9) -
          (order[right.side] ?? 9) ||
        left.corridor.id.localeCompare(
          right.corridor.id,
        )
      );
    });
}

function createConnectionItem({
  corridor,
  targetRoomId,
  side,
}, { sideIcon, selectCorridor }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'detail-connection';
  button.dataset.corridorId = corridor.id;

  const direction = document.createElement('span');
  direction.className = 'detail-connection-direction';
  direction.textContent = `${sideIcon(side)} ${t(
    `direction.${side}`,
  )}`;

  const target = document.createElement('span');
  target.className = 'detail-connection-target';
  target.textContent = targetRoomId;

  const id = document.createElement('span');
  id.className = 'detail-connection-id';
  id.textContent = corridor.id;

  button.append(direction, target, id);
  button.addEventListener('click', () =>
    selectCorridor(corridor.id),
  );
  return button;
}

export function renderEditContextHud(ctx) {
  const {
    selectionOverlay,
    selectedLabel,
    entitySelectedLabel,
    roomContentsOverlay,
    roomContentsRoom,
    roomContentsItems,
    mode,
    workflowTab,
    authoringPreviewConcealed,
    selectedEntityId,
    authoringSpec,
    selectedRoom,
    selectedEntity,
    selectedCorridor,
    entityDisplay,
    roomLabel,
    selectEntity,
  } = ctx;
  if (
    !selectionOverlay ||
    !roomContentsOverlay ||
    !roomContentsRoom ||
    !roomContentsItems
  ) {
    return;
  }

  const entity = selectedEntity();
  const corridor = selectedCorridor();
  const room = entity
    ? authoringSpec().rooms.find(
        (entry) => entry.id === entity.roomId,
      ) ?? null
    : selectedRoom();

  const showHud =
    mode === 'edit' &&
    workflowTab === 'edit' &&
    !authoringPreviewConcealed;

  if (
    !showHud ||
    (!room && !entity && !corridor)
  ) {
    selectionOverlay.hidden = true;
    roomContentsOverlay.hidden = true;
    selectedLabel.hidden = true;
    entitySelectedLabel.hidden = true;
    roomContentsRoom.textContent = '';
    roomContentsItems.replaceChildren();
    return;
  }

  selectionOverlay.hidden = false;

  if (entity) {
    const presentation = entityDisplay(entity);
    selectedLabel.textContent =
      `${presentation.icon} ${presentation.label} · ${entity.id}`;
    selectedLabel.hidden = false;
    entitySelectedLabel.textContent = room
      ? `${t('entities.room')}: ${roomLabel(room.id)}`
      : '';
    entitySelectedLabel.hidden = !room;
  } else if (room) {
    selectedLabel.textContent = roomLabel(room.id);
    selectedLabel.hidden = false;
    entitySelectedLabel.textContent = '';
    entitySelectedLabel.hidden = true;
  } else if (corridor) {
    selectedLabel.textContent =
      `⇄ ${corridor.id}`;
    selectedLabel.hidden = false;
    entitySelectedLabel.textContent = '';
    entitySelectedLabel.hidden = true;
  }

  roomContentsOverlay.hidden = false;

  const groups = [];

  if (entity) {
    const presentation = entityDisplay(entity);
    roomContentsOverlay.dataset.detailKind =
      'entity';
    roomContentsRoom.textContent =
      `${presentation.icon} ${presentation.label}`;

    groups.push(
      createDetailGroup(
        t('details.groupBasic'),
        [
          createDetailRow(
            t('details.type'),
            presentation.label,
          ),
          createDetailRow(
            t('details.id'),
            entity.id,
            { mono: true },
          ),
        ],
      ),
    );

    if (room) {
      groups.push(
        createDetailGroup(
          t('details.groupLocation'),
          [
            createDetailRow(
              t('details.room'),
              room.id,
              { mono: true },
            ),
            createDetailRow(
              t('details.position'),
              `X ${room.x.toFixed(1)} / Z ${room.z.toFixed(1)}`,
              { mono: true },
            ),
            createDetailRow(
              t('details.roomSize'),
              `${room.width} × ${room.depth}`,
              { mono: true },
            ),
          ],
        ),
      );

      const roomEntities =
        authoringSpec().entities.filter(
          (entry) => entry.roomId === room.id,
        );
      const roomEntityList =
        document.createElement('div');
      roomEntityList.className =
        'detail-entity-list';

      roomEntityList.append(
        ...roomEntities.map((entry) => {
          const entryPresentation =
            entityDisplay(entry);
          const button =
            document.createElement('button');
          button.type = 'button';
          button.className =
            `room-content-item${entry.id === selectedEntityId ? ' is-selected' : ''}`;
          button.dataset.entityId = entry.id;
          button.dataset.kind = entry.type;

          const marker =
            document.createElement('span');
          marker.className =
            'entity-marker';
          marker.textContent =
            entryPresentation.icon;

          const label =
            document.createElement('span');
          label.className =
            'room-content-label';
          label.textContent =
            entryPresentation.label;

          const id =
            document.createElement('span');
          id.className =
            'room-content-id';
          id.textContent = entry.id;

          button.append(
            marker,
            label,
            id,
          );
          button.addEventListener(
            'click',
            () => selectEntity(entry.id),
          );
          return button;
        }),
      );

      groups.push(
        createDetailGroup(
          t('details.groupContents'),
          roomEntities.length > 0
            ? [roomEntityList]
            : [
                (() => {
                  const empty =
                    document.createElement('span');
                  empty.className =
                    'room-content-empty';
                  empty.textContent =
                    t('overlay.empty');
                  return empty;
                })(),
              ],
        ),
      );
    }
  } else if (corridor) {
    roomContentsOverlay.dataset.detailKind =
      'corridor';
    roomContentsRoom.textContent =
      `⇄ ${corridor.id}`;

    groups.push(
      createDetailGroup(
        t('details.groupBasic'),
        [
          createDetailRow(
            t('details.id'),
            corridor.id,
            { mono: true },
          ),
          createDetailRow(
            t('details.kind'),
            corridor.kind ?? t('details.kindDefault'),
          ),
          createDetailRow(
            t('details.width'),
            corridor.width,
            { mono: true },
          ),
        ],
      ),
    );

    const fromSide =
      corridor.fromSide ?? 'auto';
    const toSide =
      corridor.toSide ?? 'auto';

    groups.push(
      createDetailGroup(
        t('details.groupConnections'),
        [
          createDetailRow(
            t('details.from'),
            `${corridor.fromRoomId} · ${fromSide === 'auto' ? t('details.auto') : t(
              `direction.${fromSide}`,
            )}`,
            { mono: true },
          ),
          createDetailRow(
            t('details.to'),
            `${corridor.toRoomId} · ${toSide === 'auto' ? t('details.auto') : t(
              `direction.${toSide}`,
            )}`,
            { mono: true },
          ),
        ],
      ),
    );
  } else if (room) {
    roomContentsOverlay.dataset.detailKind =
      'room';
    roomContentsRoom.textContent =
      roomLabel(room.id);

    groups.push(
      createDetailGroup(
        t('details.groupBasic'),
        [
          createDetailRow(
            t('details.id'),
            room.id,
            { mono: true },
          ),
          createDetailRow(
            t('details.role'),
            roomRoleLabel(room.id, ctx),
          ),
        ],
      ),
    );

    groups.push(
      createDetailGroup(
        t('details.groupGeometry'),
        [
          createDetailRow(
            t('details.position'),
            `X ${room.x.toFixed(1)} / Z ${room.z.toFixed(1)}`,
            { mono: true },
          ),
          createDetailRow(
            t('details.roomSize'),
            `${room.width} × ${room.depth}`,
            { mono: true },
          ),
        ],
      ),
    );

    const connections =
      roomConnectionDetails(room, ctx);
    const connectionChildren = [
      createDetailRow(
        t('details.connectionCount'),
        connections.length,
        { mono: true },
      ),
    ];
    if (connections.length > 0) {
      const list = document.createElement('div');
      list.className = 'detail-connection-list';
      list.append(
        ...connections.map(
          (connection) => createConnectionItem(connection, ctx),
        ),
      );
      connectionChildren.push(list);
    }
    groups.push(
      createDetailGroup(
        t('details.groupConnections'),
        connectionChildren,
      ),
    );

    const contents =
      authoringSpec().entities.filter(
        (entry) => entry.roomId === room.id,
      );
    const countByType = new Map();
    for (const entry of contents) {
      countByType.set(
        entry.type,
        (countByType.get(entry.type) ?? 0) + 1,
      );
    }

    const summary = document.createElement('div');
    summary.className = 'detail-content-summary';
    for (const type of [
      'start',
      'goal',
      'enemy',
      'treasure',
      'trap',
      'recovery',
    ]) {
      const count = countByType.get(type) ?? 0;
      if (count === 0) continue;
      const presentation = entityDisplay({
        type,
      });
      const chip =
        document.createElement('span');
      chip.className = 'detail-count-chip';
      chip.dataset.kind = type;
      chip.textContent =
        `${presentation.icon} ${presentation.label} ×${count}`;
      summary.append(chip);
    }

    const contentChildren = [];
    if (contents.length === 0) {
      const empty =
        document.createElement('span');
      empty.className = 'room-content-empty';
      empty.textContent = t('overlay.empty');
      contentChildren.push(empty);
    } else {
      contentChildren.push(summary);

      const list = document.createElement('div');
      list.className =
        'detail-entity-list';
      list.append(
        ...contents.map((entry) => {
          const presentation =
            entityDisplay(entry);
          const button =
            document.createElement('button');
          button.type = 'button';
          button.className =
            `room-content-item${entry.id === selectedEntityId ? ' is-selected' : ''}`;
          button.dataset.entityId = entry.id;
          button.dataset.kind = entry.type;

          const marker =
            document.createElement('span');
          marker.className =
            'entity-marker';
          marker.textContent =
            presentation.icon;

          const label =
            document.createElement('span');
          label.className =
            'room-content-label';
          label.textContent =
            presentation.label;

          const id =
            document.createElement('span');
          id.className =
            'room-content-id';
          id.textContent = entry.id;

          button.append(
            marker,
            label,
            id,
          );
          button.addEventListener(
            'click',
            () => selectEntity(entry.id),
          );
          return button;
        }),
      );
      contentChildren.push(list);
    }

    groups.push(
      createDetailGroup(
        t('details.groupContents'),
        contentChildren,
      ),
    );
  }

  roomContentsItems.replaceChildren(
    ...groups,
  );
}
