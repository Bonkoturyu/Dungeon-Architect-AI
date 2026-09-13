import {
  createPlayResult,
  movePlaySession,
  startPlaySession,
} from '../../packages/play-core/src/play-session.js';
import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');
const roomLabel = document.querySelector('#room');
const message = document.querySelector('#message');
const startButton = document.querySelector('#start');
const resultLabel = document.querySelector('#result');

let adapter;
let authoringSpec;
let authoringDigest;
let playSession = null;
let playResult = null;
let mode = 'loading';
let snapshotDetached = false;

function resize() {
  if (!adapter) return;
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

function digest(value) {
  return JSON.stringify(value);
}

function currentRoomId() {
  return playSession?.currentRoomId ?? null;
}

function snapshotState() {
  return {
    mode,
    authoringSpecId: authoringSpec?.id ?? null,
    authoringUnchanged: authoringSpec ? digest(authoringSpec) === authoringDigest : false,
    snapshotDetached,
    sessionStatus: playSession?.status ?? null,
    currentRoomId: currentRoomId(),
    goalRoomId: playSession?.goalRoomId ?? null,
    moves: playSession?.moves ?? 0,
    visitedRoomIds: playSession ? [...playSession.visitedRoomIds] : [],
    result: playResult ? structuredClone(playResult) : null,
    startDisabled: startButton.disabled,
  };
}

function updateUi() {
  status.textContent = mode;
  roomLabel.textContent = playSession ? `room: ${playSession.currentRoomId}` : 'room: -';
  startButton.disabled = mode !== 'authoring';

  if (playResult) {
    resultLabel.classList.add('visible');
    resultLabel.textContent = `RESULT: ${playResult.status} · moves ${playResult.moves} · visited ${playResult.visitedRoomIds.length}`;
  } else {
    resultLabel.classList.remove('visible');
    resultLabel.textContent = '';
  }
}

function showMessage(text) {
  message.textContent = text;
}

function highlightCurrentRoom() {
  if (!adapter || !playSession) return;
  adapter.setSelectedSpecId(playSession.currentRoomId);
}

function start() {
  if (mode !== 'authoring') return false;

  const started = startPlaySession(authoringSpec, { startedAt: performance.now() });
  if (!started.ok) {
    mode = 'blocked';
    showMessage(`START blocked: ${started.errors.map((error) => error.code).join(', ')}`);
    updateUi();
    return false;
  }

  playSession = started.session;
  snapshotDetached = (
    playSession.snapshot !== authoringSpec &&
    playSession.snapshot.rooms !== authoringSpec.rooms &&
    digest(playSession.snapshot) === authoringDigest
  );

  adapter.render(playSession.snapshot);
  mode = playSession.status === 'cleared' ? 'result' : 'playing';
  showMessage('');
  highlightCurrentRoom();

  if (playSession.status === 'cleared') finish();
  else updateUi();
  return true;
}

function finish() {
  const created = createPlayResult(playSession);
  if (!created.ok) throw new Error(`createPlayResult failed: ${JSON.stringify(created.error)}`);
  playResult = created.result;
  mode = 'result';
  highlightCurrentRoom();
  showMessage('Goal reached.');
  updateUi();
}

function moveToRoom(targetRoomId) {
  if (mode !== 'playing' || !targetRoomId) return false;
  if (targetRoomId === playSession.currentRoomId) return false;

  const moved = movePlaySession(playSession, targetRoomId, { at: performance.now() });
  if (!moved.ok) {
    showMessage(moved.error.code);
    return false;
  }

  playSession = moved.session;
  showMessage('');
  highlightCurrentRoom();

  if (playSession.status === 'cleared') finish();
  else updateUi();
  return true;
}

function handleCanvasPointer(event) {
  if (mode !== 'playing') return;
  const hit = adapter.pickSpecAt(event.clientX, event.clientY);
  if (!hit) return;

  const targetRoomId = hit.kind === 'room' ? hit.specId : hit.roomId;
  if (targetRoomId) moveToRoom(targetRoomId);
}

async function run() {
  try {
    const response = await fetch('/spec/dungeon/fixtures/minimal-valid-v1.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`fixture fetch failed: HTTP ${response.status}`);

    authoringSpec = await response.json();
    authoringDigest = digest(authoringSpec);
    adapter = createThreeRendererAdapter({ canvas });
    resize();
    adapter.render(authoringSpec);

    startButton.addEventListener('click', start);
    canvas.addEventListener('pointerdown', handleCanvasPointer);
    window.addEventListener('resize', resize);

    mode = 'authoring';
    updateUi();
    canvas.focus();

    window.__DAI_PLAY_SLICE__ = {
      ready: true,
      failed: false,
      getState: snapshotState,
      getScreenPositionForSpecId: (id) => adapter.getScreenPositionForSpecId(id),
    };
  } catch (error) {
    mode = 'failed';
    window.__DAI_PLAY_SLICE__ = {
      ready: true,
      failed: true,
      message: String(error?.stack || error),
    };
    updateUi();
    console.error(error);
  }
}

run();
