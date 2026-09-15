import { EditSession } from '../../packages/editor-core/src/edit-session.js';
import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const selectedLabel = document.querySelector('#selected');
const entitySelectedLabel = document.querySelector('#entitySelected');
const editStatus = document.querySelector('#editStatus');
const undoButton = document.querySelector('#undo');
const redoButton = document.querySelector('#redo');
const entitySelect = document.querySelector('#entitySelect');
const entityRoom = document.querySelector('#entityRoom');
const entityType = document.querySelector('#entityType');
const addEntityButton = document.querySelector('#addEntity');
const moveEntityButton = document.querySelector('#moveEntity');
const removeEntityButton = document.querySelector('#removeEntity');
const naturalEditInput = document.querySelector('#naturalEditInput');
const applyNaturalEditButton = document.querySelector('#applyNaturalEdit');
const naturalEditStatus = document.querySelector('#naturalEditStatus');

let adapter;
let session;
let selectedRoomId = null;
let selectedEntityId = null;
let naturalEditBusy = false;
let lastNaturalEditCommand = null;

function resize() {
  if (!adapter) return;
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

function selectedRoom() {
  return selectedRoomId ? session.spec.rooms.find((room) => room.id === selectedRoomId) ?? null : null;
}

function selectedEntity() {
  return selectedEntityId ? session.spec.entities.find((entity) => entity.id === selectedEntityId) ?? null : null;
}

function snapshotState() {
  const spec = session?.spec ?? null;
  return {
    selectedRoomId,
    selectedEntityId,
    targetRoomId: entityRoom?.value || null,
    canUndo: Boolean(session?.canUndo),
    canRedo: Boolean(session?.canRedo),
    naturalEditBusy,
    lastNaturalEditCommand: lastNaturalEditCommand ? { ...lastNaturalEditCommand } : null,
    rooms: spec?.rooms.map((room) => ({ id: room.id, x: room.x, z: room.z })) ?? [],
    entities: spec?.entities.map((entity) => ({ id: entity.id, type: entity.type, roomId: entity.roomId })) ?? [],
  };
}

function setEditStatus(message) {
  editStatus.textContent = message;
}

function setNaturalEditStatus(message) {
  naturalEditStatus.textContent = message;
}

function ensureRoomOptions() {
  const current = entityRoom.value;
  const rooms = session.spec.rooms;
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
  const entities = session.spec.entities;
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

function updateUi() {
  const room = selectedRoom();
  const entity = selectedEntity();

  selectedLabel.textContent = room
    ? `room: ${room.id} @ (${room.x.toFixed(1)}, ${room.z.toFixed(1)})`
    : 'room: none';
  entitySelectedLabel.textContent = entity
    ? `entity: ${entity.id} [${entity.type}] @ ${entity.roomId}`
    : 'entity: none';

  undoButton.disabled = !session?.canUndo;
  redoButton.disabled = !session?.canRedo;
  moveEntityButton.disabled = !entity || !entityRoom.value;
  removeEntityButton.disabled = !entity || entity.type === 'start' || entity.type === 'goal';
  addEntityButton.disabled = !entityRoom.value;
  applyNaturalEditButton.disabled = naturalEditBusy || !naturalEditInput.value.trim();
}

function renderCurrentSpec() {
  const spec = session.spec;
  adapter.render(spec);
  ensureRoomOptions();
  ensureEntityOptions();

  if (selectedRoomId && spec.rooms.some((room) => room.id === selectedRoomId)) {
    adapter.setSelectedSpecId(selectedRoomId);
  } else {
    selectedRoomId = null;
    adapter.setSelectedSpecId(null);
  }
  updateUi();
}

function selectRoom(roomId) {
  if (roomId == null) {
    selectedRoomId = null;
    adapter.setSelectedSpecId(null);
    updateUi();
    return false;
  }

  if (!session.spec.rooms.some((room) => room.id === roomId)) return false;
  selectedRoomId = roomId;
  entityRoom.value = roomId;
  adapter.setSelectedSpecId(roomId);
  updateUi();
  return true;
}

function selectEntity(entityId) {
  const entity = entityId ? session.spec.entities.find((item) => item.id === entityId) : null;
  if (!entity) {
    selectedEntityId = null;
    entitySelect.selectedIndex = -1;
    updateUi();
    return false;
  }

  selectedEntityId = entity.id;
  entitySelect.value = entity.id;
  updateUi();
  return true;
}

function applyCommand(command, successMessage) {
  const result = session.apply(command);
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
  renderCurrentSpec();
  setEditStatus(successMessage);
  return true;
}

function moveSelected(dx, dz) {
  const room = selectedRoom();
  if (!room) return false;
  return applyCommand({
    type: 'move-room',
    roomId: room.id,
    x: room.x + dx,
    z: room.z + dz,
  }, `moved ${room.id}`);
}

function nextEntityId(type) {
  const used = new Set(session.spec.entities.map((entity) => entity.id));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${type}-editor-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`Unable to allocate ${type} entity ID`);
}

function addEntity() {
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
  renderCurrentSpec();
  setEditStatus(`added ${id}`);
  return true;
}

function moveEntityToTargetRoom() {
  const entity = selectedEntity();
  const roomId = entityRoom.value;
  if (!entity || !roomId) return false;
  return applyCommand({ type: 'move-entity', entityId: entity.id, roomId }, `moved ${entity.id} to ${roomId}`);
}

function removeEntity() {
  const entity = selectedEntity();
  if (!entity || entity.type === 'start' || entity.type === 'goal') return false;

  const removedId = entity.id;
  const result = session.apply({ type: 'remove-entity', entityId: removedId });
  if (!result.ok) {
    setEditStatus(`error: ${result.error.code}`);
    return false;
  }
  selectedEntityId = null;
  renderCurrentSpec();
  setEditStatus(`removed ${removedId}`);
  return true;
}

function naturalEditContext() {
  return {
    rooms: session.spec.rooms.map((room) => ({ id: room.id })),
    entities: session.spec.entities.map((entity) => ({ id: entity.id, type: entity.type, roomId: entity.roomId })),
  };
}

async function applyNaturalEdit() {
  const prompt = naturalEditInput.value.trim();
  if (!prompt || naturalEditBusy) return false;

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
    renderCurrentSpec();
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
  if (!session.canUndo) return false;
  const result = session.undo();
  if (!result.ok) throw new Error(`undo failed: ${JSON.stringify(result.error)}`);
  renderCurrentSpec();
  setEditStatus('undo');
  return true;
}

function redo() {
  if (!session.canRedo) return false;
  const result = session.redo();
  if (!result.ok) throw new Error(`redo failed: ${JSON.stringify(result.error)}`);
  renderCurrentSpec();
  setEditStatus('redo');
  return true;
}

function handleCanvasPointer(event) {
  const hit = adapter.pickSpecAt(event.clientX, event.clientY);
  if (!hit) {
    selectRoom(null);
    return;
  }

  if (hit.kind === 'room') {
    selectRoom(hit.specId);
    return;
  }

  if (hit.roomId) selectRoom(hit.roomId);
}

function isFormControl(target) {
  return target instanceof HTMLElement && ['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName);
}

function handleKeyboard(event) {
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
    renderCurrentSpec();

    canvas.addEventListener('pointerdown', handleCanvasPointer);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', handleKeyboard);
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    entitySelect.addEventListener('change', () => selectEntity(entitySelect.value));
    entityRoom.addEventListener('change', updateUi);
    entityType.addEventListener('change', updateUi);
    addEntityButton.addEventListener('click', addEntity);
    moveEntityButton.addEventListener('click', moveEntityToTargetRoom);
    removeEntityButton.addEventListener('click', removeEntity);
    naturalEditInput.addEventListener('input', updateUi);
    applyNaturalEditButton.addEventListener('click', applyNaturalEdit);

    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: false,
      getState: snapshotState,
      getScreenPositionForSpecId: (id) => adapter.getScreenPositionForSpecId(id),
      selectRoom,
      selectEntity,
      applyNaturalEdit,
    };
    status.textContent = 'ready';
    canvas.focus();
  } catch (error) {
    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: true,
      message: String(error?.stack || error),
    };
    status.textContent = 'failed';
    console.error(error);
  }
}

run();
