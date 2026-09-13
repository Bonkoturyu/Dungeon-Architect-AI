import { EditSession } from '../../packages/editor-core/src/edit-session.js';
import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const selectedLabel = document.querySelector('#selected');
const undoButton = document.querySelector('#undo');
const redoButton = document.querySelector('#redo');

let adapter;
let session;
let selectedRoomId = null;

function resize() {
  if (!adapter) return;
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

function selectedRoom() {
  return selectedRoomId ? session.spec.rooms.find((room) => room.id === selectedRoomId) ?? null : null;
}

function snapshotState() {
  const spec = session?.spec ?? null;
  return {
    selectedRoomId,
    canUndo: Boolean(session?.canUndo),
    canRedo: Boolean(session?.canRedo),
    rooms: spec?.rooms.map((room) => ({ id: room.id, x: room.x, z: room.z })) ?? [],
  };
}

function updateUi() {
  const room = selectedRoom();
  selectedLabel.textContent = room
    ? `selected: ${room.id} @ (${room.x.toFixed(1)}, ${room.z.toFixed(1)})`
    : 'selected: none';
  undoButton.disabled = !session?.canUndo;
  redoButton.disabled = !session?.canRedo;
}

function renderCurrentSpec() {
  const spec = session.spec;
  adapter.render(spec);
  if (selectedRoomId && spec.rooms.some((room) => room.id === selectedRoomId)) {
    adapter.setSelectedSpecId(selectedRoomId);
  } else {
    selectedRoomId = null;
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
  adapter.setSelectedSpecId(roomId);
  updateUi();
  return true;
}

function moveSelected(dx, dz) {
  const room = selectedRoom();
  if (!room) return false;

  const result = session.apply({
    type: 'move-room',
    roomId: room.id,
    x: room.x + dx,
    z: room.z + dz,
  });
  if (!result.ok) throw new Error(`move-room failed: ${JSON.stringify(result.error)}`);
  renderCurrentSpec();
  return true;
}

function undo() {
  if (!session.canUndo) return false;
  const result = session.undo();
  if (!result.ok) throw new Error(`undo failed: ${JSON.stringify(result.error)}`);
  renderCurrentSpec();
  return true;
}

function redo() {
  if (!session.canRedo) return false;
  const result = session.redo();
  if (!result.ok) throw new Error(`redo failed: ${JSON.stringify(result.error)}`);
  renderCurrentSpec();
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

    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: false,
      getState: snapshotState,
      getScreenPositionForSpecId: (id) => adapter.getScreenPositionForSpecId(id),
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
