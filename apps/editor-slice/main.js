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
const entitySelect = document.querySelector('#entitySelect');
const entityRoom = document.querySelector('#entityRoom');
const entityType = document.querySelector('#entityType');
const addEntityButton = document.querySelector('#addEntity');
const moveEntityButton = document.querySelector('#moveEntity');
const removeEntityButton = document.querySelector('#removeEntity');
const generationPrompt = document.querySelector('#generationPrompt');
const generateDungeonButton = document.querySelector('#generateDungeon');
const generationStatus = document.querySelector('#generationStatus');
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resize() {
  if (!adapter) return;
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
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
    moves: playSession.moves,
    visitedRoomIds: [...playSession.visitedRoomIds],
    map: clone(derivePlayMap(playSession)),
    source: playSource,
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
    naturalEditBusy,
    lastNaturalEditCommand: lastNaturalEditCommand ? { ...lastNaturalEditCommand } : null,
    play: currentPlayState(),
    playSource,
    result: lastPlayResult ? clone(lastPlayResult) : null,
    rooms: spec?.rooms.map((room) => ({ id: room.id, x: room.x, z: room.z })) ?? [],
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

function ensureRoomOptions() {
  const current = entityRoom.value;
  const rooms = authoringSpec().rooms;
  entityRoom.replaceChildren(...rooms.map((room) => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = room.id;
    return option;
  }));

  if (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)) {
    entityRoom.value = selectedRoomId;
  } else if (current && rooms.some((room) => room.id === current)) {
    entityRoom.value = current;
  }
}

function ensureEntityOptions() {
  const entities = authoringSpec().entities;
  entitySelect.replaceChildren(...entities.map((entity) => {
    const option = document.createElement('option');
    option.value = entity.id;
    option.textContent = `[${entity.type}] ${entity.id} @ ${entity.roomId}`;
    return option;
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
  workflowTab = nextTab;
  document.body.dataset.workflowTab = nextTab;
  for (const button of workflowTabButtons) {
    const active = button.dataset.workflowTab === nextTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  }
  return true;
}

function updateUi() {
  const room = selectedRoom();
  const entity = selectedEntity();
  const editing = mode === 'edit';

  document.body.dataset.mode = mode;
  document.body.dataset.workflowTab = workflowTab;
  if (hint) hint.hidden = true;
  if (viewportTitle) {
    viewportTitle.textContent = editing ? '3D Dungeon' : mode === 'play' ? 'Explore' : 'Cleared';
  }
  if (viewportHelp) {
    viewportHelp.textContent = editing
      ? 'Select · Arrow keys move'
      : mode === 'play'
        ? 'Auto-map'
        : 'Run complete';
  }

  selectedLabel.textContent = room
    ? `room: ${room.id} @ (${room.x.toFixed(1)}, ${room.z.toFixed(1)})`
    : '';
  selectedLabel.hidden = !room;
  entitySelectedLabel.textContent = entity
    ? `entity: ${entity.id} [${entity.type}] @ ${entity.roomId}`
    : '';
  entitySelectedLabel.hidden = !entity;

  undoButton.disabled = !editing || !session?.canUndo;
  redoButton.disabled = !editing || !session?.canRedo;
  entitySelect.disabled = !editing;
  entityRoom.disabled = !editing;
  entityType.disabled = !editing;
  moveEntityButton.disabled = !editing || !entity || !entityRoom.value;
  removeEntityButton.disabled = !editing || !entity || entity.type === 'start' || entity.type === 'goal';
  addEntityButton.disabled = !editing || !entityRoom.value;
  generationPrompt.disabled = !editing || generationBusy;
  generateDungeonButton.disabled = !editing || generationBusy || !generationPrompt.value.trim();
  naturalEditInput.disabled = !editing || naturalEditBusy;
  applyNaturalEditButton.disabled = !editing || naturalEditBusy || !naturalEditInput.value.trim();
  startButton.disabled = !editing || !gate.allowed;
  mysteryPlayButton.disabled = !editing || !lastDesignIntent;
  mysteryPlayButton.title = lastDesignIntent ? 'Generate a fresh hidden dungeon from the same design intent.' : 'Generate a dungeon first to unlock Mystery Play.';
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
  const at = playSession.moves + playSession.gameplayState.counters.interactions + 1;
  let current = playSession;
  const enemyState = listRoomEnemies(current, current.currentRoomId, { includeDefeated: true })
    .find((entry) => entry.enemy.id === enemyId)?.state;
  if ((enemyState?.encounters ?? 0) === 0) {
    const encountered = recordEnemyEncounter(current, enemyId, { at });
    if (!encountered.ok) return applyPlayRuntimeResult(encountered, 'Encounter failed');
    current = encountered.session;
  }
  return applyPlayRuntimeResult(defeatEnemy(current, enemyId, { at: at + 1 }), 'Clear failed');
}

function interactWithRoomEntity(action, entityId) {
  if (!playSession || mode !== 'play') return false;
  const at = playSession.moves + playSession.gameplayState.counters.interactions + 1;
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
      button.addEventListener('click', () => movePlayToRoom(exit.targetRoomId));
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

  const highlightId = mode === 'edit' ? selectedRoomId : playSession?.currentRoomId ?? null;
  if (highlightId && spec.rooms.some((room) => room.id === highlightId)) {
    adapter.setSelectedSpecId(highlightId);
  } else {
    adapter.setSelectedSpecId(null);
  }

  renderRoomEvents();
  renderPlayExits();
  refreshGate();
  updateUi();
}

function selectRoom(roomId) {
  if (mode !== 'edit') return false;
  if (roomId == null) {
    selectedRoomId = null;
    adapter.setSelectedSpecId(null);
    updateUi();
    return false;
  }

  if (!authoringSpec().rooms.some((room) => room.id === roomId)) return false;
  selectedRoomId = roomId;
  entityRoom.value = roomId;
  setWorkflowTab('edit');
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
    updateUi();
    return false;
  }

  selectedEntityId = entity.id;
  entitySelect.value = entity.id;
  setWorkflowTab('edit');
  updateUi();
  return true;
}

function applyCommand(command, successMessage) {
  if (mode !== 'edit') return false;
  const result = session.apply(command);
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
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

function nextEntityId(type) {
  const used = new Set(authoringSpec().entities.map((entity) => entity.id));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${type}-editor-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Unable to allocate ${type} entity ID`);
}

function addEntity() {
  if (mode !== 'edit') return false;
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
  renderActiveSpec();
  setEditStatus(`added ${id}`);
  return true;
}

function moveEntityToTargetRoom() {
  if (mode !== 'edit') return false;
  const entity = selectedEntity();
  const roomId = entityRoom.value;
  if (!entity || !roomId) return false;
  return applyCommand({ type: 'move-entity', entityId: entity.id, roomId }, `moved ${entity.id} to ${roomId}`);
}

function removeEntity() {
  if (mode !== 'edit') return false;
  const entity = selectedEntity();
  if (!entity || entity.type === 'start' || entity.type === 'goal') return false;

  const removedId = entity.id;
  const result = session.apply({ type: 'remove-entity', entityId: removedId });
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
  selectedEntityId = null;
  renderActiveSpec();
  setEditStatus(`removed ${removedId}`);
  return true;
}

async function generateDungeonFromPrompt() {
  const prompt = generationPrompt.value.trim();
  if (!prompt || generationBusy || mode !== 'edit') return false;

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
    setWorkflowTab('play');
    generationPrompt.value = '';
    if (moveCount) moveCount.textContent = '0';
    if (mappedCount) mappedCount.textContent = '0';
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    renderActiveSpec();
    setGenerationStatus(`✓ Generated · ${lastGeneration.roomCount} rooms`);
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
  if (!prompt || naturalEditBusy || mode !== 'edit') return false;

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
  if (!session.canUndo || mode !== 'edit') return false;
  const result = session.undo();
  if (!result.ok) throw new Error(`undo failed: ${JSON.stringify(result.error)}`);
  renderActiveSpec();
  setEditStatus('undo');
  return true;
}

function redo() {
  if (!session.canRedo || mode !== 'edit') return false;
  const result = session.redo();
  if (!result.ok) throw new Error(`redo failed: ${JSON.stringify(result.error)}`);
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
  if (mode !== 'edit') return false;
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
  if (mode !== 'edit' || !lastDesignIntent) return false;

  const seed = freshMysterySeed();
  const generated = generateDungeonFromDesignIntent(lastDesignIntent, {
    prompt: 'mystery-play',
    seed,
    id: `mystery-${seed}`,
  });
  return beginPlay(generated.spec, 'mystery');
}

function movePlayToRoom(roomId) {
  if (mode !== 'play' || !playSession) return false;
  if (roomBlocksExit()) {
    setEditStatus('Resolve room event before leaving');
    return false;
  }
  const result = movePlaySession(playSession, roomId, { at: playSession.moves + 1 });
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

  const roomId = hit.kind === 'room' ? hit.specId : hit.roomId;
  if (!roomId) return;
  if (mode === 'edit') selectRoom(roomId);
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
  };
  const move = moves[event.key];
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

    canvas.addEventListener('pointerdown', handleCanvasPointer);
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
    entitySelect.addEventListener('change', () => selectEntity(entitySelect.value));
    entityRoom.addEventListener('change', updateUi);
    entityType.addEventListener('change', updateUi);
    addEntityButton.addEventListener('click', addEntity);
    moveEntityButton.addEventListener('click', moveEntityToTargetRoom);
    removeEntityButton.addEventListener('click', removeEntity);
    generationPrompt.addEventListener('input', updateUi);
    generateDungeonButton.addEventListener('click', generateDungeonFromPrompt);
    naturalEditInput.addEventListener('input', updateUi);
    applyNaturalEditButton.addEventListener('click', applyNaturalEdit);

    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: false,
      getState: snapshotState,
      getScreenPositionForSpecId: (id) => adapter.getScreenPositionForSpecId(id),
      selectRoom,
      selectEntity,
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
