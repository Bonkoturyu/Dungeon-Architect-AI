import { EditSession } from '../../packages/editor-core/src/edit-session.js';
import { evaluateStartGate } from '../../packages/editor-core/src/start-gate.js';
import { startPlaySession, movePlaySession, createPlayResult } from '../../packages/play-core/src/play-session.js';
import { createRendererVisibilityFromPlaySession, derivePlayMap } from '../../packages/play-core/src/play-map.js';
import { listRoomEnemies, recordEnemyEncounter, defeatEnemy } from '../../packages/play-core/src/enemy-runtime.js';
import {
  listRoomInteractables,
  openTreasure,
  avoidTrap,
  triggerTrap,
  useRecovery,
} from '../../packages/play-core/src/interaction-runtime.js';
import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';
import { generateDungeonFromDesignIntent } from '../../packages/generator/src/design-intent-generator.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const selectedLabel = document.querySelector('#selected');
const entitySelectedLabel = document.querySelector('#entitySelected');
const editStatus = document.querySelector('#editStatus');
const validationStatus = document.querySelector('#validationStatus');
const playStatus = document.querySelector('#playStatus');
const resultStatus = document.querySelector('#resultStatus');
const resultMetrics = document.querySelector('#resultMetrics');
const undoButton = document.querySelector('#undo');
const redoButton = document.querySelector('#redo');
const startButton = document.querySelector('#start');
const mysteryPlayButton = document.querySelector('#mysteryPlay');
const returnEditButton = document.querySelector('#returnEdit');
const playExitBar = document.querySelector('#playExitBar');
const playExitButtons = document.querySelector('#playExitButtons');
const roomEventBar = document.querySelector('#roomEventBar');
const roomEventItems = document.querySelector('#roomEventItems');
const playModeLabel = document.querySelector('#playModeLabel');
const moveCount = document.querySelector('#moveCount');
const mappedCount = document.querySelector('#mappedCount');
const roomSelect = document.querySelector('#roomSelect');
const roomWidth = document.querySelector('#roomWidth');
const roomDepth = document.querySelector('#roomDepth');
const resizeRoomButton = document.querySelector('#resizeRoom');
const checkPathButton = document.querySelector('#checkPath');
const pathStatus = document.querySelector('#pathStatus');
const entityCards = document.querySelector('#entityCards');
const entitySelect = document.querySelector('#entitySelect');
const entityRoom = document.querySelector('#entityRoom');
const entityType = document.querySelector('#entityType');
const addEntityButton = document.querySelector('#addEntity');
const moveEntityButton = document.querySelector('#moveEntity');
const removeEntityButton = document.querySelector('#removeEntity');
const generationPrompt = document.querySelector('#generationPrompt');
const generateDungeonButton = document.querySelector('#generateDungeon');
const generationStatus = document.querySelector('#generationStatus');
const generationHistory = document.querySelector('#generationHistory');
const authoringPreviewCover = document.querySelector('#authoringPreviewCover');
const naturalEditInput = document.querySelector('#naturalEditInput');
const applyNaturalEditButton = document.querySelector('#applyNaturalEdit');
const naturalEditStatus = document.querySelector('#naturalEditStatus');
const hint = document.querySelector('#hint');
const viewportHelp = document.querySelector('#viewportHelp');
const viewportTitle = document.querySelector('#viewportTitle');
const workflowTabButtons = [...document.querySelectorAll('.workflow-tab[data-workflow-tab]')];

let adapter;
let session;
let selectedRoomId = null;
let selectedEntityId = null;
let generationBusy = false;
let lastDesignIntent = null;
let lastGeneration = null;
let naturalEditBusy = false;
let lastNaturalEditCommand = null;
let mode = 'edit';
let gate = { allowed: false, criticalCount: 0, errors: [] };
let playSession = null;
let playSource = null;
let lastPlayResult = null;
let workflowTab = 'create';
let playActionClock = 0;
let canvasResizeObserver = null;
let promptHistory = [];
let authoringPreviewConcealed = false;
let pathCheckResult = null;
let canvasPointerOrigin = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resize() {
  if (!adapter) return;
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

function nextPlayActionAt() {
  playActionClock += 1;
  return playActionClock;
}

function authoringSpec() {
  return session.spec;
}

function activeRenderSpec() {
  return mode === 'edit' || !playSession ? authoringSpec() : playSession.snapshot;
}

function selectedRoom() {
  return selectedRoomId ? authoringSpec().rooms.find((room) => room.id === selectedRoomId) ?? null : null;
}

function selectedEntity() {
  return selectedEntityId ? authoringSpec().entities.find((entity) => entity.id === selectedEntityId) ?? null : null;
}

function currentPlayState() {
  if (!playSession) return null;
  return {
    status: playSession.status,
    currentRoomId: playSession.currentRoomId,
    goalRoomId: playSession.goalRoomId,
    startedAt: playSession.startedAt,
    completedAt: playSession.completedAt,
    moves: playSession.moves,
    visitedRoomIds: [...playSession.visitedRoomIds],
    map: clone(derivePlayMap(playSession)),
    source: playSource,
    events: clone(playSession.events ?? []),
    snapshot: clone(playSession.snapshot),
  };
}

function snapshotState() {
  const spec = session?.spec ?? null;
  return {
    mode,
    workflowTab,
    selectedRoomId,
    selectedEntityId,
    targetRoomId: entityRoom?.value || null,
    canUndo: Boolean(session?.canUndo),
    canRedo: Boolean(session?.canRedo),
    startAllowed: gate.allowed,
    validationCriticalCount: gate.criticalCount,
    validationErrors: gate.errors.map((entry) => ({ ...entry })),
    generationBusy,
    lastDesignIntent: lastDesignIntent ? clone(lastDesignIntent) : null,
    lastGeneration: lastGeneration ? clone(lastGeneration) : null,
    promptHistory: [...promptHistory],
    authoringPreviewConcealed,
    pathCheckResult: pathCheckResult ? clone(pathCheckResult) : null,
    naturalEditBusy,
    lastNaturalEditCommand: lastNaturalEditCommand ? { ...lastNaturalEditCommand } : null,
    play: currentPlayState(),
    playSource,
    result: lastPlayResult ? clone(lastPlayResult) : null,
    rooms: spec?.rooms.map((room) => ({
      id: room.id,
      x: room.x,
      z: room.z,
      width: room.width,
      depth: room.depth,
    })) ?? [],
    entities: spec?.entities.map((entity) => ({ id: entity.id, type: entity.type, roomId: entity.roomId })) ?? [],
  };
}

function setEditStatus(message) {
  editStatus.textContent = message;
  editStatus.hidden = !/error|blocked|failed/i.test(String(message));
}

function setGenerationStatus(message) {
  generationStatus.textContent = message;
}

function setNaturalEditStatus(message) {
  naturalEditStatus.textContent = message;
}

function refreshGate() {
  gate = evaluateStartGate(authoringSpec());
  if (gate.allowed) {
    validationStatus.dataset.state = 'pass';
    validationStatus.textContent = '✓ Valid';
  } else {
    validationStatus.dataset.state = 'blocked';
    const codes = gate.errors.slice(0, 3).map((entry) => entry.code).join(', ');
    validationStatus.textContent = `! Fix ${gate.criticalCount}${codes ? ` · ${codes}` : ''}`;
  }
}

function roomRole(roomId) {
  const entities = authoringSpec().entities;
  if (entities.some((entity) => entity.type === 'start' && entity.roomId === roomId)) return 'start';
  if (entities.some((entity) => entity.type === 'goal' && entity.roomId === roomId)) return 'goal';
  return null;
}

function roomLabel(roomId) {
  const role = roomRole(roomId);
  if (role === 'start') return `◆ START · ${roomId}`;
  if (role === 'goal') return `★ GOAL · ${roomId}`;
  return `▦ ${roomId}`;
}

function entityDisplay(entity) {
  const table = {
    start: { icon: '◆', label: 'Start' },
    goal: { icon: '★', label: 'Goal' },
    enemy: { icon: '⚔', label: 'Enemy' },
    treasure: { icon: '▣', label: 'Chest' },
    trap: { icon: '⚠', label: 'Trap' },
    recovery: { icon: '✚', label: 'Recovery' },
  };
  return table[entity.type] ?? { icon: '◇', label: entity.type };
}

function renderPromptHistory() {
  if (!generationHistory) return;
  if (promptHistory.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = 'No prompts yet.';
    generationHistory.replaceChildren(empty);
    return;
  }

  generationHistory.replaceChildren(...promptHistory.map((entry, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prompt-history-item';
    button.title = entry.prompt;
    const meta = document.createElement('strong');
    meta.textContent = `#${promptHistory.length - index} · ${entry.roomCount} rooms`;
    const text = document.createElement('span');
    text.textContent = entry.prompt;
    button.append(meta, document.createElement('br'), text);
    button.addEventListener('click', () => {
      generationPrompt.value = entry.prompt;
      updateUi();
      generationPrompt.focus();
    });
    return button;
  }));
}

function ensureRoomOptions() {
  const currentTarget = entityRoom.value;
  const rooms = authoringSpec().rooms;
  const entity = selectedEntity();
  const start = authoringSpec().entities.find((item) => item.type === 'start');
  const goal = authoringSpec().entities.find((item) => item.type === 'goal');

  entityRoom.replaceChildren(...rooms.map((room) => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = roomLabel(room.id);
    if (entity?.type === 'start' && goal?.roomId === room.id) option.disabled = true;
    if (entity?.type === 'goal' && start?.roomId === room.id) option.disabled = true;
    return option;
  }));

  roomSelect.replaceChildren(...rooms.map((room) => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = roomLabel(room.id);
    return option;
  }));

  if (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)) {
    roomSelect.value = selectedRoomId;
  } else {
    roomSelect.selectedIndex = -1;
  }

  if (entity && rooms.some((room) => room.id === entity.roomId)) {
    entityRoom.value = entity.roomId;
  } else if (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)) {
    entityRoom.value = selectedRoomId;
  } else if (currentTarget && rooms.some((room) => room.id === currentTarget)) {
    entityRoom.value = currentTarget;
  }
}

function ensureEntityOptions() {
  const entities = authoringSpec().entities;
  entitySelect.replaceChildren(...entities.map((entity) => {
    const presentation = entityDisplay(entity);
    const option = document.createElement('option');
    option.value = entity.id;
    option.textContent = `${presentation.icon} ${presentation.label} · ${roomLabel(entity.roomId)}`;
    return option;
  }));

  entityCards.replaceChildren(...entities.map((entity) => {
    const presentation = entityDisplay(entity);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `entity-card${selectedEntityId === entity.id ? ' is-selected' : ''}`;
    button.dataset.entityId = entity.id;

    const icon = document.createElement('span');
    icon.className = 'entity-icon';
    icon.textContent = presentation.icon;

    const main = document.createElement('span');
    main.className = 'entity-main';
    const name = document.createElement('span');
    name.className = 'entity-name';
    name.textContent = presentation.label;
    const room = document.createElement('span');
    room.className = 'entity-room';
    room.textContent = roomLabel(entity.roomId);
    main.append(name, room);

    const kind = document.createElement('span');
    kind.className = 'entity-kind';
    kind.textContent = entity.type.toUpperCase();

    button.append(icon, main, kind);
    button.addEventListener('click', () => selectEntity(entity.id));
    return button;
  }));

  if (selectedEntityId && entities.some((entity) => entity.id === selectedEntityId)) {
    entitySelect.value = selectedEntityId;
  } else {
    selectedEntityId = null;
    entitySelect.selectedIndex = -1;
  }
}

function setWorkflowTab(nextTab) {
  if (!['create', 'edit', 'play'].includes(nextTab)) return false;
  const revealsAuthoring = nextTab === 'edit' && authoringPreviewConcealed;
  workflowTab = nextTab;
  if (revealsAuthoring) authoringPreviewConcealed = false;
  document.body.dataset.workflowTab = nextTab;
  for (const button of workflowTabButtons) {
    const active = button.dataset.workflowTab === nextTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  }
  if (revealsAuthoring && adapter) renderActiveSpec();
  else updateUi();
  return true;
}

function updateUi() {
  const room = selectedRoom();
  const entity = selectedEntity();
  const editing = mode === 'edit';
  const authoringBusy = generationBusy || naturalEditBusy;
  const concealed = editing && authoringPreviewConcealed;

  document.body.dataset.mode = mode;
  document.body.dataset.workflowTab = workflowTab;
  if (hint) hint.hidden = true;

  if (authoringPreviewCover) authoringPreviewCover.hidden = !concealed;
  canvas.style.visibility = concealed ? 'hidden' : 'visible';

  if (viewportTitle) {
    viewportTitle.textContent = concealed
      ? 'Dungeon Ready'
      : editing
        ? '3D Dungeon'
        : mode === 'play'
          ? 'Explore'
          : 'Cleared';
  }
  if (viewportHelp) {
    viewportHelp.textContent = concealed
      ? 'Layout hidden · choose Edit, Test, or Mystery'
      : editing
        ? 'Drag orbit · Wheel zoom · WASD / Arrow keys move'
        : mode === 'play'
          ? 'Auto-map'
          : 'Run complete';
  }

  selectedLabel.textContent = room
    ? `${roomLabel(room.id)} @ (${room.x.toFixed(1)}, ${room.z.toFixed(1)}) · ${room.width}×${room.depth}`
    : '';
  selectedLabel.hidden = !room;
  entitySelectedLabel.textContent = entity
    ? `${entityDisplay(entity).icon} ${entityDisplay(entity).label} · ${roomLabel(entity.roomId)}`
    : '';
  entitySelectedLabel.hidden = !entity;

  if (room) {
    if (document.activeElement !== roomWidth) roomWidth.value = String(room.width);
    if (document.activeElement !== roomDepth) roomDepth.value = String(room.depth);
  } else {
    roomWidth.value = '';
    roomDepth.value = '';
  }

  const start = authoringSpec().entities.find((item) => item.type === 'start');
  const goal = authoringSpec().entities.find((item) => item.type === 'goal');
  const targetForbidden =
    (entity?.type === 'start' && entityRoom.value === goal?.roomId) ||
    (entity?.type === 'goal' && entityRoom.value === start?.roomId);

  undoButton.disabled = !editing || authoringBusy || !session?.canUndo;
  redoButton.disabled = !editing || authoringBusy || !session?.canRedo;
  roomSelect.disabled = !editing || authoringBusy;
  roomWidth.disabled = !editing || authoringBusy || !room;
  roomDepth.disabled = !editing || authoringBusy || !room;
  resizeRoomButton.disabled = !editing || authoringBusy || !room;
  checkPathButton.disabled = !editing || authoringBusy;
  entitySelect.disabled = !editing || authoringBusy;
  entityRoom.disabled = !editing || authoringBusy;
  entityType.disabled = !editing || authoringBusy;
  moveEntityButton.disabled = !editing || authoringBusy || !entity || !entityRoom.value || targetForbidden;
  moveEntityButton.title = targetForbidden ? 'Start and Goal must be in different rooms.' : '';
  removeEntityButton.disabled = !editing || authoringBusy || !entity || entity.type === 'start' || entity.type === 'goal';
  addEntityButton.disabled = !editing || authoringBusy || !entityRoom.value;
  generationPrompt.disabled = !editing || authoringBusy;
  generateDungeonButton.disabled = !editing || authoringBusy || !generationPrompt.value.trim();
  naturalEditInput.disabled = !editing || authoringBusy;
  applyNaturalEditButton.disabled = !editing || authoringBusy || !naturalEditInput.value.trim();
  startButton.disabled = !editing || authoringBusy || !gate.allowed;
  mysteryPlayButton.disabled = !editing || authoringBusy || !lastDesignIntent;
  mysteryPlayButton.title = authoringBusy
    ? 'Wait for the current AI request to finish.'
    : lastDesignIntent
      ? 'Generate a fresh hidden dungeon from the same design intent.'
      : 'Generate a dungeon first to unlock Mystery Play.';
  returnEditButton.disabled = editing;
}

function roomContents() {
  if (!playSession || mode !== 'play') return { enemies: [], interactables: [] };
  return {
    enemies: listRoomEnemies(playSession),
    interactables: listRoomInteractables(playSession),
  };
}

function roomBlocksExit() {
  const { enemies, interactables } = roomContents();
  return enemies.length > 0 ||
    interactables.some((entry) => entry.entity.type === 'trap' && entry.state.status === 'armed');
}

function applyPlayRuntimeResult(result, failurePrefix) {
  if (!result?.ok) {
    setEditStatus(`${failurePrefix}: ${result?.error?.code ?? 'UNKNOWN'}`);
    return false;
  }
  playSession = result.session;
  updatePlayReadout();
  renderActiveSpec();
  return true;
}

function clearEnemy(enemyId) {
  if (!playSession || mode !== 'play') return false;
  let current = playSession;
  const enemyState = listRoomEnemies(current, current.currentRoomId, { includeDefeated: true })
    .find((entry) => entry.enemy.id === enemyId)?.state;
  if ((enemyState?.encounters ?? 0) === 0) {
    const encountered = recordEnemyEncounter(current, enemyId, { at: nextPlayActionAt() });
    if (!encountered.ok) return applyPlayRuntimeResult(encountered, 'Encounter failed');
    current = encountered.session;
  }
  return applyPlayRuntimeResult(
    defeatEnemy(current, enemyId, { at: nextPlayActionAt() }),
    'Clear failed',
  );
}

function interactWithRoomEntity(action, entityId) {
  if (!playSession || mode !== 'play') return false;
  const at = nextPlayActionAt();
  const handlers = {
    'open-treasure': () => openTreasure(playSession, entityId, { at }),
    'avoid-trap': () => avoidTrap(playSession, entityId, { at }),
    'trigger-trap': () => triggerTrap(playSession, entityId, { at }),
    'use-recovery': () => useRecovery(playSession, entityId, { at }),
  };
  const handler = handlers[action];
  if (!handler) return false;
  return applyPlayRuntimeResult(handler(), 'Interaction failed');
}

function renderRoomEvents() {
  if (!roomEventBar || !roomEventItems || !playSession || mode !== 'play') {
    if (roomEventBar) roomEventBar.hidden = true;
    if (roomEventItems) roomEventItems.replaceChildren();
    return;
  }

  const { enemies, interactables } = roomContents();
  const cards = [];

  for (const { enemy } of enemies) {
    const card = document.createElement('div');
    card.className = 'room-event is-blocking';
    card.dataset.entityId = enemy.id;
    card.dataset.kind = 'enemy';

    const type = document.createElement('span');
    type.className = 'room-event-type';
    type.textContent = 'ENEMY';

    const note = document.createElement('span');
    note.className = 'room-event-note';
    note.textContent = 'blocks exits';

    const actions = document.createElement('div');
    actions.className = 'room-event-actions';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'safe-action';
    clear.dataset.action = 'clear-enemy';
    clear.textContent = 'CLEAR';
    clear.addEventListener('click', () => clearEnemy(enemy.id));
    actions.append(clear);

    card.append(type, note, actions);
    cards.push(card);
  }

  for (const entry of interactables) {
    const { entity, warning, state } = entry;
    const card = document.createElement('div');
    const blocking = entity.type === 'trap' && state.status === 'armed';
    card.className = `room-event${blocking ? ' is-blocking' : ''}`;
    card.dataset.entityId = entity.id;
    card.dataset.kind = entity.type;

    const type = document.createElement('span');
    type.className = 'room-event-type';
    type.textContent = entity.type === 'treasure'
      ? 'CHEST'
      : entity.type === 'trap'
        ? 'TRAP'
        : 'REST';

    const note = document.createElement('span');
    note.className = 'room-event-note';
    if (entity.type === 'trap') note.textContent = warning === 'floor-cracks' ? 'cracked floor' : 'something feels off';
    else if (entity.type === 'treasure') note.textContent = warning === 'suspicious-glow' ? 'suspicious glow' : 'optional';
    else note.textContent = 'optional';

    const actions = document.createElement('div');
    actions.className = 'room-event-actions';

    if (entity.type === 'treasure') {
      const open = document.createElement('button');
      open.type = 'button';
      open.dataset.action = 'open-treasure';
      open.textContent = 'OPEN';
      open.addEventListener('click', () => interactWithRoomEntity('open-treasure', entity.id));
      actions.append(open);
    } else if (entity.type === 'trap') {
      const avoid = document.createElement('button');
      avoid.type = 'button';
      avoid.className = 'safe-action';
      avoid.dataset.action = 'avoid-trap';
      avoid.textContent = 'AVOID';
      avoid.addEventListener('click', () => interactWithRoomEntity('avoid-trap', entity.id));

      const risk = document.createElement('button');
      risk.type = 'button';
      risk.className = 'risk-action';
      risk.dataset.action = 'trigger-trap';
      risk.textContent = 'RISK';
      risk.addEventListener('click', () => interactWithRoomEntity('trigger-trap', entity.id));
      actions.append(avoid, risk);
    } else if (entity.type === 'recovery') {
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'safe-action';
      use.dataset.action = 'use-recovery';
      use.textContent = 'USE';
      use.addEventListener('click', () => interactWithRoomEntity('use-recovery', entity.id));
      actions.append(use);
    }

    card.append(type, note, actions);
    cards.push(card);
  }

  roomEventItems.replaceChildren(...cards);
  roomEventBar.hidden = cards.length === 0;
}

function sideIcon(side) {
  return ({ north: '↑', east: '→', south: '↓', west: '←' })[side] ?? '◇';
}

function renderPlayExits() {
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
  const roomPlan = adapter.plan?.roomGroups.find((group) => group.specId === map.currentRoomId);
  const openingByCorridor = new Map(
    (roomPlan?.doorOpenings ?? []).map((opening) => [opening.corridorId, opening])
  );

  const exits = map.currentExits
    .map((exit) => ({
      ...exit,
      side: openingByCorridor.get(exit.corridorId)?.side ?? null,
    }))
    .sort((a, b) => {
      const order = { north: 0, east: 1, south: 2, west: 3 };
      return (order[a.side] ?? 9) - (order[b.side] ?? 9) || a.corridorId.localeCompare(b.corridorId);
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
  for (const [side, sideExits] of grouped) {
    const slot = document.createElement('div');
    slot.className = `exit-slot side-${side}`;

    sideExits.forEach((exit, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `exit-button ${exit.explored ? 'is-known' : 'is-unknown'}`;
      button.dataset.corridorId = exit.corridorId;
      button.dataset.explored = String(exit.explored);
      const icon = sideIcon(exit.side);
      button.textContent = sideExits.length > 1 ? `${icon}${index + 1}` : icon;
      const direction = exit.side ?? 'unknown';
      button.setAttribute('aria-label', exit.explored ? `Return through ${direction} exit` : `Explore ${direction} exit`);
      button.title = exit.explored ? `Known ${direction} passage` : `Explore ${direction}`;
      button.addEventListener('click', () => movePlayToRoom(exit.targetRoomId, exit.corridorId));
      slot.append(button);
    });
    slots.push(slot);
  }

  playExitButtons.replaceChildren(center, ...slots);
  playExitBar.hidden = exits.length === 0;
}

function renderActiveSpec() {
  const spec = activeRenderSpec();
  const visibility = mode === 'edit' || !playSession
    ? null
    : createRendererVisibilityFromPlaySession(playSession);
  adapter.render(spec, {
    visibility,
    resultMode: mode === 'result',
    entityStates: mode === 'edit' ? null : playSession?.gameplayState?.entityStates ?? null,
  });
  ensureRoomOptions();
  ensureEntityOptions();

  const highlightId = mode === 'edit'
    ? (selectedEntityId ?? selectedRoomId)
    : playSession?.currentRoomId ?? null;
  if (highlightId && (
    spec.rooms.some((room) => room.id === highlightId) ||
    spec.entities.some((entity) => entity.id === highlightId)
  )) {
    adapter.setSelectedSpecId(highlightId);
  } else {
    adapter.setSelectedSpecId(null);
  }

  adapter.setHighlightedSpecIds(pathCheckResult?.highlightIds ?? []);

  renderRoomEvents();
  renderPlayExits();
  refreshGate();
  updateUi();
}

function selectRoom(roomId) {
  if (mode !== 'edit') return false;
  if (roomId == null) {
    selectedRoomId = null;
    selectedEntityId = null;
    adapter.setSelectedSpecId(null);
    ensureEntityOptions();
    updateUi();
    return false;
  }

  if (!authoringSpec().rooms.some((room) => room.id === roomId)) return false;
  selectedRoomId = roomId;
  selectedEntityId = null;
  entityRoom.value = roomId;
  setWorkflowTab('edit');
  ensureRoomOptions();
  ensureEntityOptions();
  adapter.setSelectedSpecId(roomId);
  updateUi();
  return true;
}

function selectEntity(entityId) {
  if (mode !== 'edit') return false;
  const entity = entityId ? authoringSpec().entities.find((item) => item.id === entityId) : null;
  if (!entity) {
    selectedEntityId = null;
    entitySelect.selectedIndex = -1;
    ensureEntityOptions();
    updateUi();
    return false;
  }

  selectedEntityId = entity.id;
  selectedRoomId = null;
  entitySelect.value = entity.id;
  entityRoom.value = entity.roomId;
  setWorkflowTab('edit');
  ensureRoomOptions();
  ensureEntityOptions();
  adapter.setSelectedSpecId(entity.id);
  updateUi();
  return true;
}

function clearPathCheck() {
  pathCheckResult = null;
  if (pathStatus) pathStatus.textContent = 'Path not checked.';
  adapter?.setHighlightedSpecIds([]);
}

function applyCommand(command, successMessage) {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const result = session.apply(command);
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
  clearPathCheck();
  renderActiveSpec();
  setEditStatus(successMessage);
  return true;
}

function moveSelected(dx, dz) {
  const room = selectedRoom();
  if (!room || mode !== 'edit') return false;
  return applyCommand({
    type: 'move-room',
    roomId: room.id,
    x: room.x + dx,
    z: room.z + dz,
  }, `moved ${room.id}`);
}

function resizeSelectedRoom() {
  const room = selectedRoom();
  if (!room || mode !== 'edit') return false;
  const width = Number(roomWidth.value);
  const depth = Number(roomDepth.value);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(depth) || depth <= 0) {
    setEditStatus('error: ROOM_DIMENSION_INVALID');
    return false;
  }
  return applyCommand({
    type: 'resize-room',
    roomId: room.id,
    width,
    depth,
  }, `resized ${room.id} to ${width}×${depth}`);
}

function shortestStartGoalPath(spec) {
  const start = spec.entities.find((entity) => entity.type === 'start');
  const goal = spec.entities.find((entity) => entity.type === 'goal');
  if (!start || !goal || start.roomId === goal.roomId) return null;

  const adjacency = new Map(spec.rooms.map((room) => [room.id, []]));
  for (const corridor of spec.corridors) {
    if (corridor.initiallyEnabled === false) continue;
    adjacency.get(corridor.fromRoomId)?.push({ roomId: corridor.toRoomId, corridorId: corridor.id });
    adjacency.get(corridor.toRoomId)?.push({ roomId: corridor.fromRoomId, corridorId: corridor.id });
  }
  for (const exits of adjacency.values()) exits.sort((a, b) => a.corridorId.localeCompare(b.corridorId));

  const queue = [start.roomId];
  const previous = new Map([[start.roomId, null]]);
  while (queue.length) {
    const current = queue.shift();
    if (current === goal.roomId) break;
    for (const edge of adjacency.get(current) ?? []) {
      if (previous.has(edge.roomId)) continue;
      previous.set(edge.roomId, { roomId: current, corridorId: edge.corridorId });
      queue.push(edge.roomId);
    }
  }
  if (!previous.has(goal.roomId)) return null;

  const roomIds = [];
  const corridorIds = [];
  let current = goal.roomId;
  while (current != null) {
    roomIds.push(current);
    const prev = previous.get(current);
    if (!prev) break;
    corridorIds.push(prev.corridorId);
    current = prev.roomId;
  }
  roomIds.reverse();
  corridorIds.reverse();
  return {
    roomIds,
    corridorIds,
    moves: corridorIds.length,
  };
}

function checkStartGoalPath() {
  if (mode !== 'edit') return false;
  const spec = authoringSpec();
  const path = shortestStartGoalPath(spec);
  if (!path) {
    pathCheckResult = {
      reachable: false,
      roomIds: [],
      corridorIds: [],
      highlightIds: [],
    };
    pathStatus.textContent = '✕ Unreachable\nStart cannot reach Goal using initially enabled corridors.';
    adapter.setHighlightedSpecIds([]);
    return false;
  }

  const routeText = path.roomIds.map((roomId) => {
    const role = roomRole(roomId);
    if (role === 'start') return 'START';
    if (role === 'goal') return 'GOAL';
    return roomId;
  }).join(' → ');

  pathCheckResult = {
    reachable: true,
    ...path,
    highlightIds: [...path.roomIds, ...path.corridorIds],
  };
  pathStatus.textContent = `✓ Reachable · ${path.moves} move${path.moves === 1 ? '' : 's'}\n${routeText}`;
  adapter.setHighlightedSpecIds(pathCheckResult.highlightIds);
  return true;
}

function nextEntityId(type) {
  const used = new Set(authoringSpec().entities.map((entity) => entity.id));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${type}-editor-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Unable to allocate ${type} entity ID`);
}

function addEntity() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const roomId = entityRoom.value;
  const type = entityType.value;
  if (!roomId || !['enemy', 'treasure', 'trap', 'recovery'].includes(type)) return false;

  const id = nextEntityId(type);
  const result = session.apply({ type: 'add-entity', entity: { id, type, roomId } });
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
  selectedEntityId = id;
  selectedRoomId = null;
  clearPathCheck();
  renderActiveSpec();
  setEditStatus(`added ${id}`);
  return true;
}

function moveEntityToTargetRoom() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const entity = selectedEntity();
  const roomId = entityRoom.value;
  if (!entity || !roomId) return false;
  return applyCommand({ type: 'move-entity', entityId: entity.id, roomId }, `moved ${entity.id} to ${roomId}`);
}

function removeEntity() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const entity = selectedEntity();
  if (!entity || entity.type === 'start' || entity.type === 'goal') return false;

  const removedId = entity.id;
  const result = session.apply({ type: 'remove-entity', entityId: removedId });
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
  selectedEntityId = null;
  clearPathCheck();
  renderActiveSpec();
  setEditStatus(`removed ${removedId}`);
  return true;
}

async function generateDungeonFromPrompt() {
  const prompt = generationPrompt.value.trim();
  if (!prompt || generationBusy || naturalEditBusy || mode !== 'edit') return false;

  generationBusy = true;
  setGenerationStatus('translating intent…');
  updateUi();

  try {
    const endpoint = window.__DAI_DESIGN_INTENT_ENDPOINT__ || '/api/design-intent';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.ok !== true || !payload.intent) {
      const code = payload?.error?.code || `HTTP_${response.status}`;
      setGenerationStatus(`error: ${code}`);
      return false;
    }

    const generated = generateDungeonFromDesignIntent(payload.intent, { prompt });
    session = new EditSession(generated.spec);
    selectedRoomId = null;
    selectedEntityId = null;
    playSession = null;
    playSource = null;
    lastPlayResult = null;
    lastNaturalEditCommand = null;
    lastDesignIntent = clone(payload.intent);
    lastGeneration = {
      selectedProvider: payload.selectedProvider ?? 'unknown',
      seed: generated.profile.seed,
      roomCount: generated.profile.roomCount,
      routeChoice: generated.profile.routeChoice,
      entityCount: generated.spec.entities.length,
      eventCount: generated.spec.events.length,
    };
    mode = 'edit';
    authoringPreviewConcealed = true;
    pathCheckResult = null;
    promptHistory = [
      { prompt, roomCount: lastGeneration.roomCount },
      ...promptHistory,
    ].slice(0, 8);
    renderPromptHistory();
    setWorkflowTab('play');
    if (moveCount) moveCount.textContent = '0';
    if (mappedCount) mappedCount.textContent = '0';
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    renderActiveSpec();
    setGenerationStatus(`✓ Generated · ${lastGeneration.roomCount} rooms · layout hidden`);
    setEditStatus('generated new dungeon');
    return true;
  } catch {
    setGenerationStatus('error: GENERATION_UNAVAILABLE');
    return false;
  } finally {
    generationBusy = false;
    updateUi();
  }
}

function naturalEditContext() {
  return {
    rooms: authoringSpec().rooms.map((room) => ({ id: room.id })),
    entities: authoringSpec().entities.map((entity) => ({ id: entity.id, type: entity.type, roomId: entity.roomId })),
  };
}

async function applyNaturalEdit() {
  const prompt = naturalEditInput.value.trim();
  if (!prompt || naturalEditBusy || generationBusy || mode !== 'edit') return false;

  naturalEditBusy = true;
  lastNaturalEditCommand = null;
  setNaturalEditStatus('translating…');
  updateUi();

  try {
    const endpoint = window.__DAI_NATURAL_EDIT_ENDPOINT__ || '/api/natural-edit';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, context: naturalEditContext() }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.ok !== true || !payload.command) {
      const code = payload?.error?.code || `HTTP_${response.status}`;
      setNaturalEditStatus(`error: ${code}`);
      return false;
    }

    const command = payload.command;
    const result = session.apply(command);
    if (!result.ok) {
      setNaturalEditStatus(`rejected: ${result.error.code}`);
      return false;
    }

    lastNaturalEditCommand = { ...command };
    if (command.type === 'move-entity') {
      selectedEntityId = command.entityId;
      selectedRoomId = command.roomId;
    }
    naturalEditInput.value = '';
    clearPathCheck();
    renderActiveSpec();
    setNaturalEditStatus(`applied: ${command.type}`);
    setEditStatus(`natural edit: ${command.type}`);
    return true;
  } catch {
    setNaturalEditStatus('error: NATURAL_EDIT_UNAVAILABLE');
    return false;
  } finally {
    naturalEditBusy = false;
    updateUi();
  }
}

function undo() {
  if (!session.canUndo || mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const result = session.undo();
  if (!result.ok) throw new Error(`undo failed: ${JSON.stringify(result.error)}`);
  clearPathCheck();
  renderActiveSpec();
  setEditStatus('undo');
  return true;
}

function redo() {
  if (!session.canRedo || mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const result = session.redo();
  if (!result.ok) throw new Error(`redo failed: ${JSON.stringify(result.error)}`);
  clearPathCheck();
  renderActiveSpec();
  setEditStatus('redo');
  return true;
}

function updatePlayReadout() {
  if (!playSession) {
    if (moveCount) moveCount.textContent = '0';
    if (mappedCount) mappedCount.textContent = '0';
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    if (playModeLabel) {
      playModeLabel.textContent = '';
      playModeLabel.hidden = true;
    }
    return;
  }
  const map = derivePlayMap(playSession);
  const modeName = playSource === 'mystery' ? 'MYSTERY' : 'TEST';
  if (playModeLabel) {
    playModeLabel.textContent = modeName;
    playModeLabel.hidden = false;
  }
  if (moveCount) moveCount.textContent = String(playSession.moves);
  if (mappedCount) mappedCount.textContent = String(map.exploredRoomIds.length);
}

function renderResultMetrics(result) {
  if (!resultMetrics) return;
  const metrics = result?.metrics ?? {};
  const items = [
    ['ENEMY', metrics.enemiesCleared ?? 0],
    ['CHEST', metrics.treasuresOpened ?? 0],
    ['TRAP', metrics.trapsTriggered ?? 0],
  ];
  resultMetrics.replaceChildren(...items.map(([label, value]) => {
    const item = document.createElement('span');
    item.className = 'result-metric';
    const strong = document.createElement('strong');
    strong.textContent = label;
    item.append(strong, document.createTextNode(` ${value}`));
    return item;
  }));
  resultMetrics.hidden = false;
}

function finalizePlayIfNeeded() {
  if (!playSession || !['cleared', 'failed'].includes(playSession.status)) return false;
  const result = createPlayResult(playSession);
  if (!result.ok) throw new Error(`createPlayResult failed: ${JSON.stringify(result.error)}`);
  lastPlayResult = result.result;
  mode = 'result';
  if (moveCount) moveCount.textContent = String(lastPlayResult.moves);
  if (mappedCount) mappedCount.textContent = String(lastPlayResult.visitedRoomIds.length);
  resultStatus.textContent = lastPlayResult.status === 'cleared' ? '✓ CLEARED' : 'RUN ENDED';
  resultStatus.hidden = false;
  renderResultMetrics(lastPlayResult);
  renderActiveSpec();
  return true;
}

function beginPlay(spec, source) {
  const result = startPlaySession(spec, { startedAt: 0 });
  if (!result.ok) {
    setEditStatus(`Play blocked: ${result.errors?.[0]?.code ?? 'VALIDATION'}`);
    return false;
  }

  playSession = result.session;
  playActionClock = Number.isFinite(playSession.startedAt) ? playSession.startedAt : 0;
  playSource = source;
  lastPlayResult = null;
  mode = playSession.status === 'playing' ? 'play' : 'result';
  selectedRoomId = playSession.currentRoomId;
  selectedEntityId = null;
  resultStatus.textContent = '';
  resultStatus.hidden = true;
  if (resultMetrics) {
    resultMetrics.replaceChildren();
    resultMetrics.hidden = true;
  }
  updatePlayReadout();
  setEditStatus(source === 'mystery' ? 'mystery play started' : 'test play started');
  renderActiveSpec();
  finalizePlayIfNeeded();
  return true;
}

function startDungeon() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  refreshGate();
  if (!gate.allowed) {
    setEditStatus(`Play blocked: ${gate.criticalCount} Critical`);
    updateUi();
    return false;
  }
  return beginPlay(authoringSpec(), 'test');
}

function freshMysterySeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  let seed = values[0] >>> 0;
  const blocked = new Set([authoringSpec().seed, lastGeneration?.seed].filter(Number.isSafeInteger));
  while (blocked.has(seed)) seed = (seed + 0x9e3779b9) >>> 0;
  return seed;
}

function startMysteryDungeon() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy || !lastDesignIntent) return false;

  const seed = freshMysterySeed();
  const generated = generateDungeonFromDesignIntent(lastDesignIntent, {
    prompt: 'mystery-play',
    seed,
    id: `mystery-${seed}`,
  });
  return beginPlay(generated.spec, 'mystery');
}

function movePlayToRoom(roomId, corridorId = null) {
  if (mode !== 'play' || !playSession) return false;
  if (roomBlocksExit()) {
    setEditStatus('Resolve room event before leaving');
    return false;
  }
  const result = movePlaySession(playSession, roomId, {
    at: nextPlayActionAt(),
    corridorId,
  });
  if (!result.ok) {
    setEditStatus(`Move blocked: ${result.error.code}`);
    return false;
  }

  playSession = result.session;
  selectedRoomId = playSession.currentRoomId;
  updatePlayReadout();
  renderActiveSpec();
  finalizePlayIfNeeded();
  return true;
}

function returnToEdit() {
  if (mode === 'edit') return false;
  mode = 'edit';
  playSession = null;
  playSource = null;
  playActionClock = 0;
  setWorkflowTab('edit');
  selectedRoomId = null;
  selectedEntityId = null;
  if (moveCount) moveCount.textContent = '0';
  if (mappedCount) mappedCount.textContent = '0';
  resultStatus.textContent = '';
  resultStatus.hidden = true;
  if (resultMetrics) {
    resultMetrics.replaceChildren();
    resultMetrics.hidden = true;
  }
  if (playModeLabel) {
    playModeLabel.textContent = '';
    playModeLabel.hidden = true;
  }
  setEditStatus('returned to edit');
  renderActiveSpec();
  canvas.focus();
  return true;
}

function handleCanvasPointer(event) {
  const hit = adapter.pickSpecAt(event.clientX, event.clientY);
  if (!hit) {
    if (mode === 'edit') selectRoom(null);
    return;
  }

  if (mode !== 'edit') return;

  if (['start', 'goal', 'enemy', 'treasure', 'trap', 'recovery'].includes(hit.kind)) {
    selectEntity(hit.specId);
    return;
  }

  const roomId = hit.kind === 'room' ? hit.specId : hit.roomId;
  if (roomId) selectRoom(roomId);
}

function handleCanvasPointerDown(event) {
  canvasPointerOrigin = { x: event.clientX, y: event.clientY };
}

function handleCanvasPointerUp(event) {
  const origin = canvasPointerOrigin;
  canvasPointerOrigin = null;
  if (!origin) return;
  const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
  if (distance <= 5) handleCanvasPointer(event);
}

function isFormControl(target) {
  return target instanceof HTMLElement && ['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName);
}

function handleKeyboard(event) {
  if (mode !== 'edit') return;
  const commandKey = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (commandKey && key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (commandKey && key === 'y') {
    event.preventDefault();
    redo();
    return;
  }

  if (isFormControl(event.target)) return;

  const moves = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    w: [0, -1],
    s: [0, 1],
  };
  const move = moves[event.key] ?? moves[key];
  if (!move) return;
  event.preventDefault();
  moveSelected(move[0], move[1]);
}

async function run() {
  try {
    const response = await fetch('/spec/dungeon/fixtures/minimal-valid-v1.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`fixture fetch failed: HTTP ${response.status}`);
    session = new EditSession(await response.json());
    adapter = createThreeRendererAdapter({ canvas });
    resize();
    renderActiveSpec();

    canvasResizeObserver = new ResizeObserver(() => resize());
    canvasResizeObserver.observe(canvas);

    canvas.addEventListener('pointerdown', handleCanvasPointerDown);
    canvas.addEventListener('pointerup', handleCanvasPointerUp);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', handleKeyboard);
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    for (const button of workflowTabButtons) {
      button.addEventListener('click', () => setWorkflowTab(button.dataset.workflowTab));
    }
    startButton.addEventListener('click', startDungeon);
    mysteryPlayButton.addEventListener('click', startMysteryDungeon);
    returnEditButton.addEventListener('click', returnToEdit);
    roomSelect.addEventListener('change', () => selectRoom(roomSelect.value));
    resizeRoomButton.addEventListener('click', resizeSelectedRoom);
    checkPathButton.addEventListener('click', checkStartGoalPath);
    entitySelect.addEventListener('change', () => selectEntity(entitySelect.value));
    entityRoom.addEventListener('change', () => {
      ensureRoomOptions();
      updateUi();
    });
    entityType.addEventListener('change', updateUi);
    addEntityButton.addEventListener('click', addEntity);
    moveEntityButton.addEventListener('click', moveEntityToTargetRoom);
    removeEntityButton.addEventListener('click', removeEntity);
    generationPrompt.addEventListener('input', updateUi);
    generateDungeonButton.addEventListener('click', generateDungeonFromPrompt);
    naturalEditInput.addEventListener('input', updateUi);
    applyNaturalEditButton.addEventListener('click', applyNaturalEdit);
    renderPromptHistory();

    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: false,
      getState: snapshotState,
      getScreenPositionForSpecId: (id) => adapter.getScreenPositionForSpecId(id),
      selectRoom,
      selectEntity,
      resizeSelectedRoom,
      checkStartGoalPath,
      generateDungeonFromPrompt,
      applyNaturalEdit,
      evaluateStartGateForSpec: (spec) => evaluateStartGate(spec),
      startDungeon,
      startMysteryDungeon,
      movePlayToRoom,
      clearEnemy,
      interactWithRoomEntity,
      returnToEdit,
    };
    status.textContent = '';
    status.hidden = true;
    canvas.focus();
  } catch (error) {
    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: true,
      message: String(error?.stack || error),
    };
    status.textContent = 'failed';
    status.hidden = false;
    console.error(error);
  }
}

run();
