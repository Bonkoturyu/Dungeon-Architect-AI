import { resolveRoomConfigurationPresence } from '../../packages/intent/src/endpoint-room-plans.js';
import { measurePerformance, measurePerformanceAsync, startPerformanceProbe, stopPerformanceProbe } from '../../packages/renderer-three/src/performance-probe.js';
import { reviewRoomPlan, createRoomPlanConfig, resolveGenerationDifficulty } from './room-plan-review.js';
import { TRAP_RULES_V1 } from '../../packages/core/src/trap-rules.js';
import { applyRoomContentLayer } from '../../packages/generator/src/room-content-layer.js';
import { parseFallbackRoomRequests } from '../../packages/intent/src/room-requests.js';
import { listRoomShops, purchaseShopOffer } from '../../packages/play-core/src/shop-runtime.js';
import { getEffectiveDamage } from '../../packages/play-core/src/equipment-runtime.js';
import { EditSession } from '../../packages/editor-core/src/edit-session.js';
import { applyEditCommand } from '../../packages/editor-core/src/edit-command.js';
import {
  buildCorridorDragPreview,
  corridorSideForRoom,
  findCorridorOpeningAtWall,
  wallSideFromPart,
} from '../../packages/editor-core/src/corridor-drag.js';
import { evaluateStartGate } from '../../packages/editor-core/src/start-gate.js';
import { movePlaySession, createPlayResult, completePlayGoal, getGoalCompletionState } from '../../packages/play-core/src/play-session.js';
import { createRendererVisibilityFromPlaySession, derivePlayMap } from '../../packages/play-core/src/play-map.js';
import {
  DEFAULT_ENEMY_DAMAGE,
  listRoomEnemies,
  resolveEnemyCombat,
} from '../../packages/play-core/src/enemy-runtime.js';
import {
  DEFAULT_RECOVERY_HEALING,
  DEFAULT_TRAP_DAMAGE,
  listRoomInteractables,
  openTreasure,
  avoidTrap,
  getTrapAvoidanceChance,
  useRecovery,
} from '../../packages/play-core/src/interaction-runtime.js';
import {
  deterministicEnemyReward,
  deterministicTreasureReward,
  xpRequiredForNextLevel,
} from '../../packages/play-core/src/progression-runtime.js';
import { createDungeonScenePlan, createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';
import {
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  GENERATOR_STRATEGY_BSP_LAB_ID,
  GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
  GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
  GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID,
  GENERATOR_STRATEGY_WFC_LAB_ID,
  RECOMMENDED_GENERATOR_STRATEGY_ID,
  createBuiltinGeneratorStrategyRegistry,
  deriveGeneratorSeedFromPrompt,
} from '../../packages/generator/src/strategy-catalog.js';
import {
  createDungeonRunResult,
  createDungeonRunSpec,
  startDungeonRun,
  syncDungeonRunFloor,
} from '../../packages/run-core/src/dungeon-run.js';
import {
  createProgrammaticAudio,
  deriveReactiveAudioIntensity,
} from '../../packages/audio-presentation/src/programmatic-audio.js';
import {
  createDungeonLayoutExchange,
  createFullDungeonExport,
  importDungeonJson,
  serializeJsonExport,
} from '../../packages/export-core/src/layout-exchange.js';
import {
  bindLanguageSwitchers,
  getLanguage,
  subscribeLanguage,
  t,
} from './i18n.js';

const canvas = document.querySelector('#renderCanvas');
const viewportShell = document.querySelector('.viewport-shell');
const status = document.querySelector('#status');
const modeBadge = document.querySelector('#modeBadge');
const selectionOverlay = document.querySelector('#selectionOverlay');
const selectedLabel = document.querySelector('#selected');
const entitySelectedLabel = document.querySelector('#entitySelected');
const entityLegend = document.querySelector('#entityLegend');
const roomContentsOverlay = document.querySelector('#roomContentsOverlay');
const roomContentsRoom = document.querySelector('#roomContentsRoom');
const roomContentsItems = document.querySelector('#roomContentsItems');
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
const audioToggle = document.querySelector('#audioToggle');
const bgmVolumeInput = document.querySelector('#bgmVolume');
const seVolumeInput = document.querySelector('#seVolume');
const bgmVolumeValue = document.querySelector('#bgmVolumeValue');
const seVolumeValue = document.querySelector('#seVolumeValue');
const playExitBar = document.querySelector('#playExitBar');
const playExitButtons = document.querySelector('#playExitButtons');
const roomEventBar = document.querySelector('#roomEventBar');
const roomEventItems = document.querySelector('#roomEventItems');
const playModeLabel = document.querySelector('#playModeLabel');
const moveCount = document.querySelector('#moveCount');
const mappedCount = document.querySelector('#mappedCount');
const playFloorCount = document.querySelector('#playFloorCount');
const hpCount = document.querySelector('#hpCount');
const levelCount = document.querySelector('#levelCount');
const xpCount = document.querySelector('#xpCount');
const goldCount = document.querySelector('#goldCount');
const weaponTierCount = document.querySelector('#weaponTierCount');
const armorTierCount = document.querySelector('#armorTierCount');
const roomSelect = document.querySelector('#roomSelect');
const roomWidth = document.querySelector('#roomWidth');
const roomDepth = document.querySelector('#roomDepth');
const roomWidthMinus = document.querySelector('#roomWidthMinus');
const roomWidthPlus = document.querySelector('#roomWidthPlus');
const roomDepthMinus = document.querySelector('#roomDepthMinus');
const roomDepthPlus = document.querySelector('#roomDepthPlus');
const resizeRoomButton = document.querySelector('#resizeRoom');
const roomAddDirection = document.querySelector('#roomAddDirection');
const addRoomButton = document.querySelector('#addRoom');
const roomDirectionAddButtons = [...document.querySelectorAll('[data-room-add-direction]')];
const roomAddFromSelection = document.querySelector('#roomAddFromSelection');
const roomAddWithoutSelection = document.querySelector('#roomAddWithoutSelection');
const addRoomAtViewCenterButton = document.querySelector('#addRoomAtViewCenter');
const removeRoomButton = document.querySelector('#removeRoom');
const corridorSelect = document.querySelector('#corridorSelect');
const corridorFromSide = document.querySelector('#corridorFromSide');
const corridorToSide = document.querySelector('#corridorToSide');
const applyCorridorSidesButton = document.querySelector('#applyCorridorSides');
const removeCorridorButton = document.querySelector('#removeCorridor');
const corridorFromRoom = document.querySelector('#corridorFromRoom');
const corridorToRoom = document.querySelector('#corridorToRoom');
const addCorridorButton = document.querySelector('#addCorridor');
const checkPathButton = document.querySelector('#checkPath');
const pathStatus = document.querySelector('#pathStatus');
const entitySelect = document.querySelector('#entitySelect');
const entityRoom = document.querySelector('#entityRoom');
const entityType = document.querySelector('#entityType');
const addEntityButton = document.querySelector('#addEntity');
const moveEntityButton = document.querySelector('#moveEntity');
const removeEntityButton = document.querySelector('#removeEntity');
const generationPrompt = document.querySelector('#generationPrompt');
const generatorStrategySelect = document.querySelector('#generatorStrategy');
const generationAutoInput = document.querySelector('#generationAuto');
const generationManualInput = document.querySelector('#generationManual');
const generationDifficultySelect = document.querySelector('#generationDifficulty');
const generationModeHint = document.querySelector('#generationAutoHint');
const floorCountInput = document.querySelector('#floorCount');
const floorSelect = document.querySelector('#floorSelect');
const floorSummary = document.querySelector('#floorSummary');
const generateDungeonButton = document.querySelector('#generateDungeon');
const generationStatus = document.querySelector('#generationStatus');
const exportLayoutJsonButton = document.querySelector('#exportLayoutJson');
const exportFullJsonButton = document.querySelector('#exportFullJson');
const importJsonButton = document.querySelector('#importJson');
const importJsonInput = document.querySelector('#importJsonInput');
const generationHistory = document.querySelector('#generationHistory');
const authoringPreviewCover = document.querySelector('#authoringPreviewCover');
const viewportNotice = document.querySelector('#viewportNotice');
const actionFeedback = document.querySelector('#actionFeedback');
const playReticle = document.querySelector('#playReticle');
const naturalEditInput = document.querySelector('#naturalEditInput');
const applyNaturalEditButton = document.querySelector('#applyNaturalEdit');
const naturalEditStatus = document.querySelector('#naturalEditStatus');
const hint = document.querySelector('#hint');
const viewportHelp = document.querySelector('#viewportHelp');
const viewportTitle = document.querySelector('#viewportTitle');
const workflowTabButtons = [...document.querySelectorAll('.workflow-tab[data-workflow-tab]')];
const inspectorShell = document.querySelector('#editInspector');
const inspectorTabButtons = [...document.querySelectorAll('.inspector-tab[data-inspector-tab-target]')];

let adapter;
let session;
let floorSessions = [];
let currentFloorIndex = 0;
let dungeonRunSession = null;
let lastDungeonRunResult = null;
let selectedRoomId = null;
let selectedEntityId = null;
let selectedCorridorId = null;
let generationBusy = false;
let lastDesignIntent = null;
let lastSpecialRoomConfig = null;
let lastGeneration = null;
let naturalEditBusy = false;
let lastNaturalEditCommand = null;
let mode = 'edit';
let gate = { allowed: false, criticalCount: 0, errors: [] };
let playSession = null;
let playSource = null;
let lastPlayResult = null;
let mysteryGeneration = null;
let workflowTab = 'create';
let inspectorTab = 'entities';
let playActionClock = 0;
let canvasResizeObserver = null;
let promptHistory = [];
let authoringPreviewConcealed = false;
let pathCheckResult = null;
let canvasPointerOrigin = null;
let corridorDraft = null;
let roomDrag = null;
let viewportNoticeTimer = null;
let actionFeedbackTimer = null;
let roomEventIntroTimer = null;
let lastRoomEventSignature = '';
let shopUiRoomKey = null;
let shopUiDismissed = false;

const generatorStrategyRegistry = createBuiltinGeneratorStrategyRegistry();
const audioPresentation = createProgrammaticAudio();

function audioModeForUi() {
  if (mode === 'play') return 'play';
  if (mode === 'result') {
    const resultState = lastDungeonRunResult?.status ?? lastPlayResult?.status ?? 'failed';
    return resultState === 'cleared' ? 'result-cleared' : 'result-failed';
  }
  return 'edit';
}

function syncAudioMode() {
  audioPresentation.setMode(audioModeForUi());
}

function syncReactiveAudioIntensity() {
  const { enemies, interactables } = roomContents();
  const armedTrapCount = interactables.filter(
    (entry) =>
      entry.entity.type === 'trap' &&
      entry.state.status === 'armed',
  ).length;
  const maxHp = playSession?.playerState?.maxHp ?? 1;
  const hp = playSession?.playerState?.hp ?? maxHp;
  const hpRatio = maxHp > 0 ? hp / maxHp : 1;

  const profile = deriveReactiveAudioIntensity({
    mode: audioModeForUi(),
    designIntent: lastDesignIntent,
    enemyCount: enemies.length,
    armedTrapCount,
    hpRatio,
  });
  return audioPresentation.setReactiveIntensity(profile);
}

function renderAudioToggle() {
  const audio = audioPresentation.getState();
  if (audioToggle) {
    const label = audio.muted ? t('audio.unmute') : t('audio.mute');
    audioToggle.disabled = !audio.available;
    audioToggle.textContent = audio.muted ? '🔇' : '🔊';
    audioToggle.dataset.audioState = !audio.available
      ? 'unavailable'
      : audio.muted
        ? 'muted'
        : audio.unlocked
          ? 'ready'
          : 'locked';
    audioToggle.title = label;
    audioToggle.setAttribute('aria-label', label);
    audioToggle.setAttribute('aria-pressed', String(audio.muted));
  }

  if (bgmVolumeInput) {
    const value = String(Math.round(audio.bgmVolume * 100));
    if (bgmVolumeInput.value !== value) bgmVolumeInput.value = value;
    bgmVolumeInput.disabled = !audio.available;
    if (bgmVolumeValue) bgmVolumeValue.textContent = `${value}%`;
  }

  if (seVolumeInput) {
    const value = String(Math.round(audio.seVolume * 100));
    if (seVolumeInput.value !== value) seVolumeInput.value = value;
    seVolumeInput.disabled = !audio.available;
    if (seVolumeValue) seVolumeValue.textContent = `${value}%`;
  }
}

function emitAudioCue(cue) {
  audioPresentation.playCue(cue);
  renderAudioToggle();
}

async function unlockAudioFromGesture() {
  const unlocked = await audioPresentation.unlock();
  syncAudioMode();
  syncReactiveAudioIntensity();
  renderAudioToggle();

  if (unlocked || !audioPresentation.getState().available) {
    document.removeEventListener('pointerdown', unlockAudioFromGesture, true);
    window.removeEventListener('keydown', unlockAudioFromGesture, true);
  }

  return unlocked;
}

function toggleAudioMuted() {
  const muted = audioPresentation.toggleMuted();
  renderAudioToggle();
  return muted;
}

function setBgmVolumeFromControl() {
  if (!bgmVolumeInput) return audioPresentation.getState().bgmVolume;
  const value = Number(bgmVolumeInput.value) / 100;
  const level = audioPresentation.setBgmVolume(value);
  renderAudioToggle();
  return level;
}

function setSeVolumeFromControl() {
  if (!seVolumeInput) return audioPresentation.getState().seVolume;
  const value = Number(seVolumeInput.value) / 100;
  const level = audioPresentation.setSeVolume(value);
  renderAudioToggle();
  return level;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setAuthoringFloors(specs, selectedIndex = 0) {
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new TypeError('setAuthoringFloors requires at least one DungeonSpec');
  }
  floorSessions = specs.map((spec) => new EditSession(spec));
  currentFloorIndex = Math.max(0, Math.min(floorSessions.length - 1, selectedIndex));
  session = floorSessions[currentFloorIndex];
}

function authoringFloorSpecs() {
  if (floorSessions.length > 0) return floorSessions.map((entry) => entry.spec);
  return session ? [session.spec] : [];
}

function authoringRunSpec(id = 'editor-run') {
  return createDungeonRunSpec(authoringFloorSpecs(), { id });
}

function exportBaseName() {
  const id = authoringFloorSpecs()[0]?.id ?? 'dungeon';
  const normalized = String(id)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'dungeon';
}

function exportProvenance() {
  return lastGeneration
    ? {
        generatorStrategyId:
          lastGeneration.generatorStrategyId ?? null,
        generatorVersion:
          lastGeneration.generatorVersion ?? null,
        algorithmVersion:
          lastGeneration.algorithmVersion ?? null,
        contentLayerVersion: lastGeneration.contentLayerVersion ?? null,
      }
    : null;
}

function currentLayoutExport(...args) { return measurePerformance('ui.currentLayoutExport', () => currentLayoutExportImplementation(...args)); }

function currentLayoutExportImplementation() {
  const base = exportBaseName();
  return createDungeonLayoutExchange(
    authoringFloorSpecs(),
    {
      id: `${base}-layout`,
      provenance: exportProvenance(),
    },
  );
}

function currentFullDungeonExport(...args) { return measurePerformance('ui.currentFullDungeonExport', () => currentFullDungeonExportImplementation(...args)); }

function currentFullDungeonExportImplementation() {
  const base = exportBaseName();
  return createFullDungeonExport(
    authoringFloorSpecs(),
    { id: `${base}-run` },
  );
}

function downloadJsonExport(value, filename) {
  const text = serializeJsonExport(value);
  const blob = new Blob([text], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setGenerationStatus(t('export.saved', { name: filename }));
  return { filename, text };
}

function exportLayoutJson() {
  const base = exportBaseName();
  return downloadJsonExport(
    currentLayoutExport(),
    `${base}.layout.v1.json`,
  );
}

function exportFullJson() {
  const base = exportBaseName();
  return downloadJsonExport(
    currentFullDungeonExport(),
    `${base}.dungeon-run.v1.json`,
  );
}

function applyImportedDungeonJson(...args) { return measurePerformance('ui.applyImportedDungeonJson', () => applyImportedDungeonJsonImplementation(...args)); }

function applyImportedDungeonJsonImplementation(input, { filename = null } = {}) {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) {
    return {
      ok: false,
      format: null,
      errors: [{ code: 'IMPORT_EDITOR_BUSY' }],
    };
  }

  const imported = importDungeonJson(input);
  if (!imported.ok) {
    const code = imported.errors?.[0]?.code ?? 'IMPORT_FAILED';
    setGenerationStatus(t('import.failed', { code }));
    showViewportNotice(t('import.failed', { code }), { timeoutMs: 5200 });
    return imported;
  }

  try {
    for (const dungeon of imported.dungeons) {
      createDungeonScenePlan(dungeon);
    }
  } catch {
    const failed = {
      ok: false,
      format: imported.format,
      dungeons: null,
      provenance: imported.provenance ?? null,
      errors: [{
        code: 'IMPORT_RENDER_ROUTE_INVALID',
        path: '$',
        message: 'Imported dungeon cannot be routed by the renderer.',
      }],
    };
    setGenerationStatus(
      t('import.failed', { code: 'IMPORT_RENDER_ROUTE_INVALID' }),
    );
    showViewportNotice(
      t('import.failed', { code: 'IMPORT_RENDER_ROUTE_INVALID' }),
      { timeoutMs: 5200 },
    );
    return failed;
  }

  setAuthoringFloors(imported.dungeons, 0);
  mode = 'edit';
  playSession = null;
  playSource = null;
  dungeonRunSession = null;
  lastDungeonRunResult = null;
  lastPlayResult = null;
  mysteryGeneration = null;
  playActionClock = 0;
  selectedRoomId = null;
  selectedEntityId = null;
  selectedCorridorId = null;
  pathCheckResult = null;
  lastNaturalEditCommand = null;
  corridorDraft = null;
  roomDrag = null;
  authoringPreviewConcealed = false;
  lastDesignIntent = null;
  lastSpecialRoomConfig = null;

  const provenance = imported.provenance ?? null;
  lastGeneration = provenance
    ? {
        generatorStrategyId: provenance.generatorStrategyId ?? null,
        generatorVersion: provenance.generatorVersion ?? null,
        algorithmVersion: provenance.algorithmVersion ?? null,
        contentLayerVersion: provenance.contentLayerVersion ?? null,
        selectedProvider: 'import',
        floorCount: imported.dungeons.length,
        importedFormat: imported.format,
      }
    : {
        generatorStrategyId: null,
        generatorVersion: null,
        algorithmVersion: null,
        selectedProvider: 'import',
        floorCount: imported.dungeons.length,
        importedFormat: imported.format,
      };

  if (floorCountInput) {
    floorCountInput.value = String(imported.dungeons.length);
  }
  if (resultStatus) {
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    resultStatus.classList.remove('is-result-reveal');
  }
  if (resultMetrics) {
    resultMetrics.replaceChildren();
    resultMetrics.hidden = true;
    resultMetrics.classList.remove('is-result-reveal');
  }

  setWorkflowTab('edit');
  setInspectorTab('rooms');
  renderPathStatus();
  renderActiveSpec();
  triggerViewportTransition('generation');
  setGenerationStatus(
    t('import.loaded', {
      format: imported.format === 'layout' ? 'Layout' : 'Full',
      count: imported.dungeons.length,
      name: filename ?? 'JSON',
    }),
  );

  return {
    ok: true,
    format: imported.format,
    floorCount: imported.dungeons.length,
    filename,
    errors: [],
  };
}

async function importJsonFile(file) {
  if (!file) {
    return {
      ok: false,
      format: null,
      errors: [{ code: 'IMPORT_FILE_REQUIRED' }],
    };
  }

  if (file.size > 2 * 1024 * 1024) {
    const result = {
      ok: false,
      format: null,
      errors: [{ code: 'IMPORT_FILE_TOO_LARGE' }],
    };
    setGenerationStatus(
      t('import.failed', { code: 'IMPORT_FILE_TOO_LARGE' }),
    );
    return result;
  }

  let text;
  try {
    text = await file.text();
  } catch {
    const result = {
      ok: false,
      format: null,
      errors: [{ code: 'IMPORT_FILE_READ_FAILED' }],
    };
    setGenerationStatus(
      t('import.failed', { code: 'IMPORT_FILE_READ_FAILED' }),
    );
    return result;
  }

  return applyImportedDungeonJson(text, { filename: file.name });
}

function requestedFloorCount() {
  const parsed = Number.parseInt(floorCountInput?.value ?? '1', 10);
  if (!Number.isInteger(parsed)) return 1;
  return Math.max(1, Math.min(10, parsed));
}

function derivedFloorSeed(baseSeed, floorIndex) {
  if (floorIndex === 0) return baseSeed >>> 0;
  return (baseSeed + Math.imul(floorIndex, 0x9e3779b9)) >>> 0;
}

function generatorStrategyLabel(metadata) {
  if (metadata.id === 'version-3-special-rooms') return t('create.generatorV3');
  if (metadata.id === GENERATOR_STRATEGY_V2_RECOMMENDED_ID) {
    return t('create.generatorV2');
  }
  if (metadata.id === GENERATOR_STRATEGY_V1_CLASSIC_ID) {
    return t('create.generatorClassic');
  }
  if (metadata.id === GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID) {
    return t('create.generatorDelaunayMst');
  }
  if (metadata.id === GENERATOR_STRATEGY_BSP_LAB_ID) {
    return t('create.generatorBsp');
  }
  if (metadata.id === GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID) {
    return t('create.generatorRoomsMazes');
  }
  if (metadata.id === GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID) {
    return t('create.generatorRandomWalk');
  }
  if (metadata.id === GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID) {
    return t('create.generatorCellularAutomata');
  }
  if (metadata.id === GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID) {
    return t('create.generatorMazeCarving');
  }
  if (metadata.id === GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID) {
    return t('create.generatorGameplayGrammar');
  }
  if (metadata.id === GENERATOR_STRATEGY_WFC_LAB_ID) {
    return t('create.generatorWfc');
  }
  return metadata.displayName;
}

function renderGeneratorStrategyOptions() {
  if (!generatorStrategySelect) return;
  const available = generatorStrategyRegistry.list();
  const previous =
    generatorStrategyRegistry.has(generatorStrategySelect.value)
      ? generatorStrategySelect.value
      : RECOMMENDED_GENERATOR_STRATEGY_ID;

  generatorStrategySelect.replaceChildren(...available.map((metadata) => {
    const option = document.createElement('option');
    option.value = metadata.id;
    option.textContent = generatorStrategyLabel(metadata);
    option.dataset.family = metadata.family;
    option.dataset.algorithmVersion = metadata.algorithmVersion;
    return option;
  }));
  generatorStrategySelect.value =
    generatorStrategyRegistry.has(previous)
      ? previous
      : RECOMMENDED_GENERATOR_STRATEGY_ID;
}

function selectedGeneratorStrategyId() {
  const selected = generatorStrategySelect?.value;
  return generatorStrategyRegistry.has(selected)
    ? selected
    : RECOMMENDED_GENERATOR_STRATEGY_ID;
}

async function generateFloorSet(
  intent,
  {
    prompt,
    count,
    baseSeed = null,
    idPrefix = null,
    strategyId = selectedGeneratorStrategyId(),
    specialRoomConfig = null,
  } = {},
) {
  const total = Math.max(1, Math.min(10, Number.isInteger(count) ? count : 1));
  const rootSeed =
    baseSeed === null
      ? deriveGeneratorSeedFromPrompt(prompt)
      : baseSeed >>> 0;
  const rootId = idPrefix ?? `generated-${rootSeed}`;
  if (specialRoomConfig?.presenceSpec) {
    const resolved = resolveRoomConfigurationPresence({ ...specialRoomConfig.presenceSpec, seed: rootSeed, floorCount: total, specialRoomEntityLimit: specialRoomConfig.specialRoomEntityLimit });
    specialRoomConfig = { ...specialRoomConfig, roomPlans: resolved.roomPlans };
  }

  let carriedWitnessState = null;
  async function generateFloor(seed, id, floorNumber = 1) {
    const floorConfig = specialRoomConfig ? { ...specialRoomConfig, trapRules: { ...TRAP_RULES_V1 }, initialPlayerState: carriedWitnessState, roomPlans: specialRoomConfig.roomPlans.filter((plan) => plan.floorNumber === floorNumber) } : null;
    const baseResult = await measurePerformanceAsync('generation.strategy', () => generatorStrategyRegistry.generate(strategyId, {
      seed,
      id,
      prompt,
      intent,
      options: floorConfig ?? {},
    }));
    const result = applyRoomContentLayer(baseResult, intent, floorConfig);
    const profile = result.diagnostics?.profile ?? {};
    if (specialRoomConfig) {
      if (!profile.routeViability?.witness?.playerState) throw new Error('ROUTE_VIABILITY_WITNESS_MISSING');
      carriedWitnessState = clone(profile.routeViability.witness.playerState);
    }
    return {
      spec: result.spec,
      profile: {
        ...profile,
        seed: result.provenance.seed,
        roomCount: result.spec.rooms.length,
        routeChoice:
          profile.routeChoice ??
          intent?.routeChoice ??
          null,
      },
      generatorVersion: result.provenance.generatorVersion ?? null,
      generatorStrategyId: result.provenance.strategyId,
      algorithmVersion: result.provenance.algorithmVersion,
      contentLayerVersion: result.provenance.contentLayerVersion ?? null,
      provenance: result.provenance,
      diagnostics: result.diagnostics,
    };
  }

  const first = await generateFloor(rootSeed, rootId);
  const generated = [first];

  for (let floorIndex = 1; floorIndex < total; floorIndex += 1) {
    const seed = derivedFloorSeed(rootSeed, floorIndex);
    generated.push(await generateFloor(
      seed,
      `${rootId}-floor-${String(floorIndex + 1).padStart(2, '0')}`,
      floorIndex + 1,
    ));
  }

  return generated;
}

function renderFloorControls() {
  const count = Math.max(1, floorSessions.length || 1);
  if (floorSelect) {
    const currentOptions = [...floorSelect.options].map((option) => option.value);
    const expectedOptions = Array.from({ length: count }, (_, index) => String(index));
    if (JSON.stringify(currentOptions) !== JSON.stringify(expectedOptions)) {
      floorSelect.replaceChildren(...expectedOptions.map((value, index) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${t('run.floor')} ${index + 1}`;
        return option;
      }));
    } else {
      [...floorSelect.options].forEach((option, index) => {
        option.textContent = `${t('run.floor')} ${index + 1}`;
      });
    }
    floorSelect.value = String(Math.max(0, Math.min(count - 1, currentFloorIndex)));
    floorSelect.disabled = mode !== 'edit' || generationBusy || naturalEditBusy || count <= 1;
  }
  if (floorSummary) floorSummary.textContent = `${currentFloorIndex + 1}/${count}`;
  if (floorCountInput) floorCountInput.disabled = mode !== 'edit' || generationBusy || naturalEditBusy;

  const playIndex = dungeonRunSession?.currentFloorIndex ?? 0;
  const playCount = dungeonRunSession?.floorCount ?? count;
  if (playFloorCount) playFloorCount.textContent = `${playIndex + 1}/${playCount}`;
}

function selectFloor(index) {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const next = Number.parseInt(index, 10);
  if (!Number.isInteger(next) || next < 0 || next >= floorSessions.length || next === currentFloorIndex) {
    renderFloorControls();
    return false;
  }

  currentFloorIndex = next;
  session = floorSessions[currentFloorIndex];
  selectedRoomId = null;
  selectedEntityId = null;
  selectedCorridorId = null;
  pathCheckResult = null;
  corridorDraft = null;
  roomDrag = null;
  adapter.setHighlightedSpecIds([]);
  renderPathStatus();
  renderActiveSpec();
  setEditStatus(`${t('run.floor')} ${currentFloorIndex + 1}`);
  return true;
}

function resize() {
  if (!adapter) return;
  const rect = canvas.getBoundingClientRect();
  const width = canvas.clientWidth || rect.width;
  const height = canvas.clientHeight || rect.height;
  adapter.resize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
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

function selectedCorridor() {
  return selectedCorridorId
    ? authoringSpec().corridors.find((corridor) => corridor.id === selectedCorridorId) ?? null
    : null;
}

function oppositeSide(side) {
  return { north: 'south', south: 'north', east: 'west', west: 'east' }[side] ?? 'west';
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
    floorIndex: dungeonRunSession?.currentFloorIndex ?? 0,
    floorCount: dungeonRunSession?.floorCount ?? 1,
    visitedRoomIds: [...playSession.visitedRoomIds],
    map: clone(derivePlayMap(playSession)),
    playerState: clone(playSession.playerState),
    gameplayCounters: clone(playSession.gameplayState?.counters ?? {}),
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
    inspectorTab,
    language: getLanguage(),
    audio: audioPresentation.getState(),
    floorCount: Math.max(1, floorSessions.length || 1),
    currentFloorIndex,
    floorSummaries: floorSessions.map((entry, index) => {
      const floorSpec = entry.spec;
      return {
        floorIndex: index,
        dungeonId: floorSpec.id,
        seed: floorSpec.seed,
        roomCount: floorSpec.rooms.length,
        entityCount: floorSpec.entities.length,
      };
    }),
    run: dungeonRunSession ? {
      status: dungeonRunSession.status,
      failureReason: dungeonRunSession.failureReason,
      currentFloorIndex: dungeonRunSession.currentFloorIndex,
      floorCount: dungeonRunSession.floorCount,
      floorsCompleted: dungeonRunSession.floorResults?.length ?? 0,
      floorDungeonIds: dungeonRunSession.snapshot.floors.map((floor) => floor.dungeon.id),
      playerState: clone(dungeonRunSession.playerState),
      events: clone(dungeonRunSession.events ?? []),
    } : null,
    selectedRoomId,
    selectedEntityId,
    selectedCorridorId,
    targetRoomId: entityRoom?.value || null,
    canUndo: Boolean(session?.canUndo),
    canRedo: Boolean(session?.canRedo),
    startAllowed: gate.allowed && authoringRunSpec().ok,
    validationCriticalCount: gate.criticalCount,
    validationErrors: gate.errors.map((entry) => ({ ...entry })),
    generationBusy,
    generatorStrategyId: selectedGeneratorStrategyId(),
    availableGeneratorStrategies: generatorStrategyRegistry.list().map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      family: entry.family,
      algorithmVersion: entry.algorithmVersion,
    })),
    lastDesignIntent: lastDesignIntent ? clone(lastDesignIntent) : null,
    lastGeneration: lastGeneration ? clone(lastGeneration) : null,
    promptHistory: [...promptHistory],
    authoringPreviewConcealed,
    pathCheckResult: pathCheckResult ? clone(pathCheckResult) : null,
    naturalEditBusy,
    lastNaturalEditCommand: lastNaturalEditCommand ? { ...lastNaturalEditCommand } : null,
    corridorDraftPreview: corridorDraft?.preview
      ? {
          state: corridorDraft.preview.state,
          targetRoomId: corridorDraft.preview.targetRoomId ?? null,
          targetSide: corridorDraft.preview.targetSide ?? null,
          previewTargetSide: corridorDraft.preview.previewTargetSide ?? null,
          routedFromSide: corridorDraft.preview.routedFromSide ?? null,
          routedToSide: corridorDraft.preview.routedToSide ?? null,
          commitCorridorId: corridorDraft.preview.commitCorridorId ?? null,
          hasCommitCommand: Boolean(corridorDraft.preview.commitCommand),
          blockedCode: corridorDraft.preview.blockedCode ?? null,
        }
      : null,
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
    corridors: spec?.corridors.map((corridor) => ({
      id: corridor.id,
      fromRoomId: corridor.fromRoomId,
      toRoomId: corridor.toRoomId,
      width: corridor.width,
      kind: corridor.kind ?? null,
      fromSide: corridor.fromSide ?? null,
      toSide: corridor.toSide ?? null,
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

function showViewportNotice(message, { timeoutMs = 2200 } = {}) {
  if (!viewportNotice) return;
  if (viewportNoticeTimer) clearTimeout(viewportNoticeTimer);
  viewportNotice.textContent = String(message);
  viewportNotice.hidden = false;
  viewportNoticeTimer = setTimeout(() => {
    viewportNotice.hidden = true;
    viewportNotice.textContent = '';
    viewportNoticeTimer = null;
  }, timeoutMs);
}

function showActionFeedback(message, kind = 'result') {
  if (!actionFeedback) return false;
  if (actionFeedbackTimer) clearTimeout(actionFeedbackTimer);
  actionFeedback.hidden = true;
  actionFeedback.textContent = String(message);
  actionFeedback.dataset.kind = kind;
  void actionFeedback.offsetWidth;
  actionFeedback.hidden = false;
  actionFeedbackTimer = setTimeout(() => {
    actionFeedback.hidden = true;
    actionFeedback.textContent = '';
    delete actionFeedback.dataset.kind;
    actionFeedbackTimer = null;
  }, 780);
  return true;
}

let viewportTransitionTimer = null;
let resultRevealTimer = null;

function triggerResultReveal() {
  if (!resultStatus || !resultMetrics) return false;
  if (resultRevealTimer) clearTimeout(resultRevealTimer);
  resultStatus.classList.remove('is-result-reveal');
  resultMetrics.classList.remove('is-result-reveal');
  void resultStatus.offsetWidth;
  resultStatus.classList.add('is-result-reveal');
  resultMetrics.classList.add('is-result-reveal');
  resultRevealTimer = setTimeout(() => {
    resultStatus.classList.remove('is-result-reveal');
    resultMetrics.classList.remove('is-result-reveal');
    resultRevealTimer = null;
  }, 980);
  return true;
}

function triggerViewportTransition(kind) {
  if (!viewportShell) return false;
  const className = {
    generation: 'is-generation-reveal',
    mode: 'is-mode-transition',
    event: 'is-event-focus',
    floor: 'is-floor-transition',
    result: 'is-result-transition',
  }[kind] ?? 'is-mode-transition';
  viewportShell.classList.remove(
    'is-generation-reveal',
    'is-mode-transition',
    'is-event-focus',
    'is-floor-transition',
    'is-result-transition',
  );
  if (viewportTransitionTimer) {
    clearTimeout(viewportTransitionTimer);
    viewportTransitionTimer = null;
  }

  // Force a new animation cycle even when the same transition repeats.
  void viewportShell.offsetWidth;
  viewportShell.classList.add(className);

  const timeoutMs = {
    generation: 620,
    mode: 480,
    event: 520,
    floor: 640,
    result: 820,
  }[kind] ?? 480;
  viewportTransitionTimer = setTimeout(() => {
    viewportShell.classList.remove(className);
    viewportTransitionTimer = null;
  }, timeoutMs);
  return true;
}

function friendlyEditError(error) {
  const code = error?.code ?? 'EDIT_FAILED';
  const message = String(error?.message ?? '');
  if (code === 'START_GOAL_SAME_ROOM') return t('notice.sameRoom');
  if (code === 'PROTECTED_ROOM') return t('notice.protectedRoom');
  if (code === 'CORRIDOR_SIDE_INVALID') return t('notice.route');
  if (code === 'EDIT_RESULT_INVALID' && message.includes('ROOM_OVERLAP')) return t('notice.overlap');
  if (code === 'EDIT_RESULT_INVALID' && message.includes('GOAL_UNREACHABLE')) return t('goal.unreachableDetail');
  if (code === 'ROOM_DIMENSION_INVALID') return t('notice.dimension');
  return `Blocked: ${code}`;
}

function refreshGate(...args) { return measurePerformance('ui.refreshGate', () => refreshGateImplementation(...args)); }

function refreshGateImplementation() {
  const currentGate = evaluateStartGate(authoringSpec());
  const runValidation = authoringRunSpec();

  if (runValidation.ok) {
    gate = currentGate;
  } else {
    gate = {
      allowed: false,
      criticalCount: runValidation.errors.length,
      errors: runValidation.errors.map((entry) => ({
        severity: 'critical',
        ...clone(entry),
      })),
    };
  }

  if (gate.allowed) {
    validationStatus.dataset.state = 'pass';
    validationStatus.textContent = t('validation.valid');
  } else {
    validationStatus.dataset.state = 'blocked';
    const codes = gate.errors.slice(0, 3).map((entry) => entry.code).join(', ');
    validationStatus.textContent = t('validation.fix', {
      count: gate.criticalCount,
      codes: codes ? ` · ${codes}` : '',
    });
  }
}

function roomRole(roomId) {
  const entities = mode === 'play' && playSession ? playSession.snapshot.entities : authoringSpec().entities;
  if (entities.some((entity) => entity.type === 'start' && entity.roomId === roomId)) return 'start';
  if (entities.some((entity) => entity.type === 'goal' && entity.roomId === roomId)) return 'goal';
  return null;
}

function roomKindLabel(roomId) {
  const rooms = mode === 'play' && playSession ? playSession.snapshot.rooms : authoringSpec().rooms;
  const kind = rooms.find(({ id }) => id === roomId)?.kind;
  const keys = { 'monster-house': 'monsterHouse', 'trap-house': 'trapHouse', shop: 'shop' };
  return keys[kind] ? t(`roomReview.${keys[kind]}`) : '';
}

function roomLabel(roomId) {
  const role = roomRole(roomId);
  const base = role === 'start' ? `◆ ${t('entity.start')} · ${roomId}` : role === 'goal' ? `★ ${t('entity.goal')} · ${roomId}` : `▦ ${roomId}`;
  const kind = roomKindLabel(roomId);
  return `${base}${kind ? ` · ${kind}` : ''}`;
}

function entityDisplay(entity) {
  const table = {
    start: { icon: '◆', label: t('entity.start') },
    goal: { icon: '★', label: t('entity.goal') },
    enemy: { icon: '⚔', label: t('entity.enemy') },
    treasure: { icon: '▣', label: t('entity.treasure') },
    trap: { icon: '⚠', label: t('entity.trap') },
    recovery: { icon: '✚', label: t('entity.recovery') },
    shop: { icon: '¤', label: t('roomReview.shop') },
  };
  return table[entity.type] ?? { icon: '◇', label: entity.type };
}

function renderPromptHistory() {
  if (!generationHistory) return;
  if (promptHistory.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = t('create.historyEmpty');
    generationHistory.replaceChildren(empty);
    return;
  }

  generationHistory.replaceChildren(...promptHistory.map((entry, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prompt-history-item';
    button.title = entry.prompt;
    const meta = document.createElement('strong');
    meta.textContent = `#${promptHistory.length - index} · ${t('create.historyRooms', { count: entry.roomCount })}`;
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

function ensureRoomOptions(...args) { return measurePerformance('ui.ensureRoomOptions', () => ensureRoomOptionsImplementation(...args)); }

function ensureRoomOptionsImplementation() {
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
  } else if (entity && rooms.some((room) => room.id === entity.roomId)) {
    roomSelect.value = entity.roomId;
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

function ensureEntityOptions(...args) { return measurePerformance('ui.ensureEntityOptions', () => ensureEntityOptionsImplementation(...args)); }

function ensureEntityOptionsImplementation() {
  const entities = authoringSpec().entities;
  entitySelect.replaceChildren(...entities.map((entity) => {
    const presentation = entityDisplay(entity);
    const option = document.createElement('option');
    option.value = entity.id;
    option.textContent = `${presentation.icon} ${presentation.label} · ${roomLabel(entity.roomId)}`;
    return option;
  }));

  if (selectedEntityId && entities.some((entity) => entity.id === selectedEntityId)) {
    entitySelect.value = selectedEntityId;
  } else {
    selectedEntityId = null;
    entitySelect.selectedIndex = -1;
  }
}

function corridorLabel(corridor) {
  const from = corridor.fromSide ? corridor.fromSide.toUpperCase() : 'AUTO';
  const to = corridor.toSide ? corridor.toSide.toUpperCase() : 'AUTO';
  return `${corridor.id} · ${corridor.fromRoomId} [${from}] → ${corridor.toRoomId} [${to}]`;
}

function ensureCorridorOptions(...args) { return measurePerformance('ui.ensureCorridorOptions', () => ensureCorridorOptionsImplementation(...args)); }

function ensureCorridorOptionsImplementation() {
  const spec = authoringSpec();
  const rooms = spec.rooms;
  const corridors = spec.corridors;

  corridorSelect.replaceChildren(...corridors.map((corridor) => {
    const option = document.createElement('option');
    option.value = corridor.id;
    option.textContent = corridorLabel(corridor);
    return option;
  }));

  const roomOptions = rooms.map((room) => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = roomLabel(room.id);
    return option;
  });
  corridorFromRoom.replaceChildren(...roomOptions.map((option) => option.cloneNode(true)));
  corridorToRoom.replaceChildren(...roomOptions.map((option) => option.cloneNode(true)));

  const corridor = selectedCorridor();
  if (corridor) {
    corridorSelect.value = corridor.id;
    corridorFromSide.value = corridor.fromSide ?? 'auto';
    corridorToSide.value = corridor.toSide ?? 'auto';
  } else {
    corridorSelect.selectedIndex = -1;
    corridorFromSide.value = 'auto';
    corridorToSide.value = 'auto';
  }

  if (corridor) {
    corridorFromRoom.value = corridor.fromRoomId;
    corridorToRoom.value = corridor.toRoomId;
  } else if (selectedRoomId && rooms.some((room) => room.id === selectedRoomId)) {
    corridorFromRoom.value = selectedRoomId;
    const alternative = rooms.find((room) => room.id !== selectedRoomId);
    corridorToRoom.value = alternative?.id ?? selectedRoomId;
  } else if (rooms.length > 0) {
    corridorFromRoom.value = rooms[0].id;
    corridorToRoom.value = rooms.find((room) => room.id !== rooms[0].id)?.id ?? rooms[0].id;
  }
}

function selectCorridor(corridorId) {
  if (mode !== 'edit') return false;
  const corridor = corridorId
    ? authoringSpec().corridors.find((item) => item.id === corridorId)
    : null;

  if (!corridor) {
    selectedCorridorId = null;
    corridorSelect.selectedIndex = -1;
    adapter.setSelectedSpecId(null);
    updateUi();
    return false;
  }

  selectedCorridorId = corridor.id;
  selectedRoomId = null;
  selectedEntityId = null;
  setWorkflowTab('edit');
  setInspectorTab('corridors');
  ensureRoomOptions();
  ensureEntityOptions();
  ensureCorridorOptions();
  adapter.setSelectedSpecId(corridor.id);
  adapter.setContextSpecId(null);
  updateUi();
  return true;
}

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

function roomRoleLabel(roomId) {
  const role = roomRole(roomId);
  const kind = roomKindLabel(roomId);
  const roleLabel = role === 'start' ? t('entity.start') : role === 'goal' ? t('entity.goal') : '';
  return [roleLabel, kind].filter(Boolean).join(' · ') || t('details.roleNormal');
}

function roomConnectionDetails(room) {
  const roomPlan = adapter.plan?.roomGroups.find(
    (group) => group.specId === room.id,
  );
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
}) {
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

function renderEditContextHud() {
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
            roomRoleLabel(room.id),
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
      roomConnectionDetails(room);
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
          createConnectionItem,
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

function setInspectorTab(nextTab) {
  if (!['entities', 'rooms', 'corridors'].includes(nextTab)) return false;
  inspectorTab = nextTab;
  if (inspectorShell) inspectorShell.dataset.inspectorTab = nextTab;
  for (const button of inspectorTabButtons) {
    const active = button.dataset.inspectorTabTarget === nextTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  }
  return true;
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

function updateUi(...args) { return measurePerformance('ui.updateUi', () => updateUiImplementation(...args)); }

function updateUiImplementation() {
  const room = selectedRoom();
  const entity = selectedEntity();
  const corridor = selectedCorridor();
  const editing = mode === 'edit';
  const authoringBusy = generationBusy || naturalEditBusy;
  const concealed = editing && authoringPreviewConcealed;

  document.body.dataset.mode = mode;
  document.body.dataset.workflowTab = workflowTab;
  syncAudioMode();
  syncReactiveAudioIntensity();
  renderAudioToggle();
  if (inspectorShell) inspectorShell.dataset.inspectorTab = inspectorTab;
  if (hint) hint.hidden = true;

  if (authoringPreviewCover) authoringPreviewCover.hidden = !concealed;
  if (playReticle) playReticle.hidden = mode !== 'play';
  canvas.style.visibility = concealed ? 'hidden' : 'visible';

  if (modeBadge) {
    modeBadge.textContent = mode === 'play'
      ? t('mode.play')
      : mode === 'result'
        ? t('mode.result')
        : t('mode.edit');
  }
  if (viewportTitle) {
    viewportTitle.textContent = concealed
      ? t('viewport.hiddenTitle')
      : editing
        ? t('viewport.editTitle')
        : mode === 'play'
          ? t('viewport.playTitle')
          : t('viewport.resultTitle');
  }
  if (viewportHelp) {
    let helpText = concealed
      ? t('viewport.hiddenHelp')
      : editing
        ? t('viewport.editHelp')
        : mode === 'play'
          ? t('viewport.playHelp')
          : t('viewport.resultHelp');
    if (
      editing &&
      !concealed &&
      room &&
      !authoringSpec().corridors.some((corridor) =>
        corridor.fromRoomId === room.id || corridor.toRoomId === room.id)
    ) {
      helpText += ` · ${t('viewport.isolatedRoomDragHelp')}`;
    }
    viewportHelp.textContent = helpText;
  }

  renderEditContextHud();
  renderFloorControls();

  if (room) {
    if (document.activeElement !== roomWidth) roomWidth.value = String(room.width);
    if (document.activeElement !== roomDepth) roomDepth.value = String(room.depth);
  } else {
    roomWidth.value = '';
    roomDepth.value = '';
  }

  const start = authoringSpec().entities.find((item) => item.type === 'start');
  const goal = authoringSpec().entities.find((item) => item.type === 'goal');

  for (const option of entityRoom.options) {
    option.disabled =
      (entity?.type === 'start' && option.value === goal?.roomId) ||
      (entity?.type === 'goal' && option.value === start?.roomId);
  }

  const targetForbidden =
    (entity?.type === 'start' && entityRoom.value === goal?.roomId) ||
    (entity?.type === 'goal' && entityRoom.value === start?.roomId);

  undoButton.disabled = !editing || authoringBusy || !session?.canUndo;
  redoButton.disabled = !editing || authoringBusy || !session?.canRedo;
  roomSelect.disabled = !editing || authoringBusy;
  roomWidth.disabled = !editing || authoringBusy || !room;
  roomDepth.disabled = !editing || authoringBusy || !room;
  resizeRoomButton.disabled = !editing || authoringBusy || !room;
  roomWidthMinus.disabled = !editing || authoringBusy || !room;
  roomWidthPlus.disabled = !editing || authoringBusy || !room;
  roomDepthMinus.disabled = !editing || authoringBusy || !room;
  roomDepthPlus.disabled = !editing || authoringBusy || !room;
  roomAddDirection.disabled = !editing || authoringBusy;
  addRoomButton.disabled = !editing || authoringBusy;
  if (roomAddFromSelection) roomAddFromSelection.hidden = !room;
  if (roomAddWithoutSelection) roomAddWithoutSelection.hidden = Boolean(room);
  if (addRoomAtViewCenterButton) addRoomAtViewCenterButton.disabled = !editing || authoringBusy || Boolean(room);
  for (const button of roomDirectionAddButtons) {
    button.disabled = !editing || authoringBusy || !room;
  }
  const protectedRoom = room && authoringSpec().entities.some((item) =>
    item.roomId === room.id && ['start', 'goal'].includes(item.type));
  removeRoomButton.hidden = !room;
  removeRoomButton.disabled = !editing || authoringBusy || !room || protectedRoom;
  corridorSelect.disabled = !editing || authoringBusy;
  corridorFromSide.disabled = !editing || authoringBusy || !corridor;
  corridorToSide.disabled = !editing || authoringBusy || !corridor;
  applyCorridorSidesButton.disabled = !editing || authoringBusy || !corridor;
  removeCorridorButton.disabled = !editing || authoringBusy || !corridor;
  corridorFromRoom.disabled = !editing || authoringBusy;
  corridorToRoom.disabled = !editing || authoringBusy;
  addCorridorButton.disabled =
    !editing ||
    authoringBusy ||
    !corridorFromRoom.value ||
    !corridorToRoom.value ||
    corridorFromRoom.value === corridorToRoom.value;
  checkPathButton.disabled = !editing || authoringBusy;
  entitySelect.disabled = !editing || authoringBusy;
  entityRoom.disabled = !editing || authoringBusy;
  entityType.disabled = !editing || authoringBusy;
  moveEntityButton.disabled = !editing || authoringBusy || !entity || !entityRoom.value || targetForbidden;
  moveEntityButton.title = targetForbidden ? t('notice.sameRoom') : '';
  removeEntityButton.disabled = !editing || authoringBusy || !entity || entity.type === 'start' || entity.type === 'goal';
  addEntityButton.disabled = !editing || authoringBusy || !entityRoom.value;
  generationPrompt.disabled = !editing || authoringBusy;
  if (generatorStrategySelect) {
    generatorStrategySelect.disabled = !editing || authoringBusy;
  }
  if (floorCountInput) floorCountInput.disabled = !editing || authoringBusy;
  if (generationAutoInput) generationAutoInput.disabled = !editing || authoringBusy;
  if (generationManualInput) generationManualInput.disabled = !editing || authoringBusy;
  if (generationDifficultySelect) generationDifficultySelect.disabled = !editing || authoringBusy;
  if (generationModeHint) {
    generationModeHint.dataset.i18n = generationAutoInput?.checked ? 'create.autoHint' : 'create.manualHint';
    generationModeHint.textContent = t(generationModeHint.dataset.i18n);
  }
  const runValidation = authoringRunSpec();
  const exportBlocked = !editing || authoringBusy || !runValidation.ok;
  if (exportLayoutJsonButton) exportLayoutJsonButton.disabled = exportBlocked;
  if (exportFullJsonButton) exportFullJsonButton.disabled = exportBlocked;
  if (importJsonButton) importJsonButton.disabled = !editing || authoringBusy;
  if (importJsonInput) importJsonInput.disabled = !editing || authoringBusy;
  generateDungeonButton.disabled = !editing || authoringBusy || !generationPrompt.value.trim();
  naturalEditInput.disabled = !editing || authoringBusy;
  applyNaturalEditButton.disabled = !editing || authoringBusy || !naturalEditInput.value.trim();
  startButton.disabled = !editing || authoringBusy || !gate.allowed || !runValidation.ok;
  mysteryPlayButton.disabled = !editing || authoringBusy || !lastDesignIntent;
  mysteryPlayButton.title = authoringBusy
    ? t('play.mysteryTitleBusy')
    : lastDesignIntent
      ? t('play.mysteryTitleReady')
      : t('play.mysteryTitleLocked');
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
    const message = `${failurePrefix}: ${result?.error?.code ?? 'UNKNOWN'}`;
    setEditStatus(message);
    showViewportNotice(message);
    return false;
  }
  playSession = result.session;
  selectedRoomId = playSession.currentRoomId;
  if (dungeonRunSession && playSession.status === 'playing') {
    const synced = syncDungeonRunFloor(dungeonRunSession, playSession, {
      at: playActionClock,
    });
    if (!synced.ok) {
      const message = `Run sync failed: ${synced.error?.code ?? 'UNKNOWN'}`;
      setEditStatus(message);
      showViewportNotice(message);
      return false;
    }
    dungeonRunSession = synced.run;
  }
  updatePlayReadout();
  if (finalizePlayIfNeeded()) return true;
  renderActiveSpec();
  return true;
}

function finishCurrentGoal() {
  if (!playSession || mode !== 'play') return false;
  return applyPlayRuntimeResult(completePlayGoal(playSession, { at: nextPlayActionAt() }), 'Goal completion failed');
}

function clearEnemy(enemyId) {
  if (!playSession || mode !== 'play') return false;
  const resolved = measurePerformance('play.combatCore', () => resolveEnemyCombat(playSession, enemyId, { at: nextPlayActionAt() }));
  if (resolved?.ok) {
    emitAudioCue('combat');
    showActionFeedback(`${t('entity.enemy').toUpperCase()} ✓`, 'combat');
  }
  return applyPlayRuntimeResult(resolved, 'Combat failed');
}

function interactWithRoomEntity(action, entityId) {
  if (!playSession || mode !== 'play') return false;
  const at = nextPlayActionAt();
  const handlers = {
    'open-treasure': () => openTreasure(playSession, entityId, { at }),
    'avoid-trap': () => avoidTrap(playSession, entityId, { at }),
    'use-recovery': () => useRecovery(playSession, entityId, { at }),
  };
  const handler = handlers[action];
  if (!handler) return false;

  const result = handler();
  if (result?.ok) {
    const cueByAction = {
      'open-treasure': 'treasure',
      'avoid-trap': result.avoidance?.outcome === 'triggered' ? 'trap-trigger' : 'trap-avoid',
      'use-recovery': 'recovery',
    };
    emitAudioCue(cueByAction[action]);
    const feedbackByAction = {
      'open-treasure': [`${t('entity.treasure').toUpperCase()} ✓`, 'treasure'],
      'avoid-trap': [`${t('entity.trap').toUpperCase()} · ${result.avoidance?.outcome === 'triggered'
        ? t('trap.triggered', { damage: result.applied ?? 0 }) : t('trap.avoided')}`, 'trap'],
      'use-recovery': [`${t('roomEvent.rest').toUpperCase()} ✓`, 'recovery'],
    };
    const [message, kind] = feedbackByAction[action] ?? ['', 'result'];
    if (message) showActionFeedback(message, kind);
  }
  return applyPlayRuntimeResult(result, 'Interaction failed');
}

function renderRoomEvents(...args) { return measurePerformance('ui.renderRoomEvents', () => renderRoomEventsImplementation(...args)); }

function renderRoomEventsImplementation() {
  if (!roomEventBar || !roomEventItems || !playSession || mode !== 'play') {
    shopUiRoomKey = null; shopUiDismissed = false;
    if (roomEventBar) roomEventBar.hidden = true;
    if (roomEventItems) roomEventItems.replaceChildren();
    return;
  }

  const roomKey = `${playSession.snapshot.id}:${playSession.currentRoomId}`;
  if (shopUiRoomKey !== roomKey) { shopUiRoomKey = roomKey; shopUiDismissed = false; }
  const { enemies, interactables } = roomContents();
  const heading = roomEventBar.querySelector('.room-event-heading');
  if (heading) heading.textContent = roomLabel(playSession.currentRoomId);
  const cards = [];

  for (const { enemy } of enemies) {
    const card = document.createElement('div');
    card.className = 'room-event is-blocking';
    card.dataset.entityId = enemy.id;
    card.dataset.kind = 'enemy';
    card.setAttribute('role', 'dialog');

    const type = document.createElement('span');
    type.className = 'room-event-type';
    type.textContent = t('entity.enemy').toUpperCase();

    const note = document.createElement('span');
    note.className = 'room-event-note';
    const reward = deterministicEnemyReward(playSession, enemy.id);
    note.textContent = `${t('roomEvent.blocks')} · -${getEffectiveDamage(playSession, enemy.damage ?? DEFAULT_ENEMY_DAMAGE, 'enemy')} HP · +${reward.xp} XP · +${reward.gold}G`;

    const actions = document.createElement('div');
    actions.className = 'room-event-actions';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'safe-action';
    clear.dataset.action = 'clear-enemy';
    clear.textContent = t('action.clear');
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
    card.setAttribute('role', 'dialog');

    const type = document.createElement('span');
    type.className = 'room-event-type';
    type.textContent = entity.type === 'treasure'
      ? t('entity.treasure').toUpperCase()
      : entity.type === 'trap'
        ? t('entity.trap').toUpperCase()
        : t('roomEvent.rest').toUpperCase();

    const note = document.createElement('span');
    note.className = 'room-event-note';
    if (entity.type === 'trap') {
      const base = warning === 'floor-cracks' ? t('roomEvent.cracked') : t('roomEvent.off');
      const chance = Math.round(getTrapAvoidanceChance(playSession) * 100);
      const damage = getEffectiveDamage(playSession, entity.damage ?? DEFAULT_TRAP_DAMAGE, 'trap');
      note.textContent = `${base} · ${t('trap.chance', { chance })}${chance < 100 ? ` · ${t('trap.failureDamage', { damage })}` : ''}`;
    } else if (entity.type === 'treasure') {
      const reward = deterministicTreasureReward(playSession, entity.id);
      const rewardIcon = reward.item?.slot === 'weapon' ? '⚔' : '▰';
      const base = warning === 'suspicious-glow' ? t('roomEvent.suspicious') : t('roomEvent.optional');
      note.textContent = `${base} · +${reward.gold}G${reward.item ? ` · ${rewardIcon} T${reward.item.tier}` : ''}`;
    } else {
      note.textContent = `${t('roomEvent.optional')} · +${entity.healing ?? DEFAULT_RECOVERY_HEALING} HP`;
    }

    const actions = document.createElement('div');
    actions.className = 'room-event-actions';

    if (entity.type === 'treasure') {
      const open = document.createElement('button');
      open.type = 'button';
      open.dataset.action = 'open-treasure';
      open.textContent = t('action.open');
      open.addEventListener('click', () => interactWithRoomEntity('open-treasure', entity.id));
      actions.append(open);
    } else if (entity.type === 'trap') {
      const avoid = document.createElement('button');
      avoid.type = 'button';
      avoid.className = 'safe-action';
      avoid.dataset.action = 'avoid-trap';
      avoid.textContent = t('action.avoid');
      avoid.addEventListener('click', () => interactWithRoomEntity('avoid-trap', entity.id));

      actions.append(avoid);
    } else if (entity.type === 'recovery') {
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'safe-action';
      use.dataset.action = 'use-recovery';
      use.textContent = t('action.use');
      use.addEventListener('click', () => interactWithRoomEntity('use-recovery', entity.id));
      actions.append(use);
    }

    card.append(type, note, actions);
    cards.push(card);
  }

  const shops = listRoomShops(playSession);
  const shopOfferList = document.createElement('div'); shopOfferList.id = 'shopOfferList'; shopOfferList.style.cssText = 'display:grid;gap:8px;'; shopOfferList.hidden = shopUiDismissed;
  if (shopUiDismissed) shopOfferList.style.display = 'none';
  if (shops.length && heading) {
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.action = shopUiDismissed ? 'open-shop' : 'leave-shop';
    toggle.textContent = t(shopUiDismissed ? 'play.openShop' : 'play.leaveShop'); toggle.setAttribute('aria-expanded', String(!shopUiDismissed)); toggle.setAttribute('aria-controls', 'shopOfferList');
    toggle.addEventListener('click', () => {
      if (mode !== 'play') return;
      shopUiDismissed = !shopUiDismissed; renderRoomEvents();
      roomEventBar.querySelector('[data-action="open-shop"], [data-action="leave-shop"]')?.focus();
    });
    heading.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;'; heading.append(toggle);
  }
  for (const shop of shops) {
    for (const offer of shop.offers) {
      const card = document.createElement('div'); card.className = 'room-event'; card.dataset.entityId = shop.entity.id; card.dataset.kind = 'shop';
      const label = document.createElement('span'); label.className = 'room-event-type';
      label.textContent = `${t('roomReview.shop')} · ${offer.type === 'healing' ? `+${offer.healing} HP` : `${offer.type === 'weapon' ? t('result.weapon') : t('result.armor')} T${offer.tier}`}`;
      const note = document.createElement('span'); note.className = 'room-event-note'; note.textContent = `${offer.price}G · ${t('roomReview.stock')} ${offer.remaining}`;
      const buy = document.createElement('button'); buy.type = 'button'; buy.dataset.action = 'buy-offer'; buy.dataset.offerId = offer.id;
      const player = playSession.playerState;
      const reason = offer.remaining <= 0 ? (t('roomReview.soldOut')) : player.gold < offer.price ? (t('roomReview.needGold')) : offer.type === 'healing' && player.hp >= player.maxHp ? (t('roomReview.fullHp')) : ['weapon', 'armor'].includes(offer.type) && (player.equipment[offer.type]?.tier ?? 0) >= offer.tier ? (t('roomReview.noUpgrade')) : null;
      buy.disabled = reason !== null; buy.textContent = reason ?? (t('roomReview.buy'));
      buy.addEventListener('click', () => { if (mode !== 'play') return; const result = measurePerformance('play.purchaseCore', () => purchaseShopOffer(playSession, shop.entity.id, offer.id, { at: nextPlayActionAt() })); if (result.ok) emitAudioCue('treasure'); applyPlayRuntimeResult(result, 'Purchase failed'); });
      card.append(label, note, buy); shopOfferList.append(card);
    }
  }

  if (shops.length) { shopOfferList.dataset.kind = 'shop'; shopOfferList.dataset.entityId = shops[0].entity.id; cards.push(shopOfferList); }

  const entityOrder = new Map(
    (playSession.snapshot?.entities ?? []).map((entity, index) => [entity.id, index]),
  );
  cards.sort((left, right) => {
    const leftOrder = entityOrder.get(left.dataset.entityId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = entityOrder.get(right.dataset.entityId) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || String(left.dataset.entityId).localeCompare(String(right.dataset.entityId));
  });

  const goalCompletion = getGoalCompletionState(playSession);
  if (goalCompletion.available) {
    const card = document.createElement('div'); card.className = 'room-event'; card.dataset.kind = 'goal';
    const note = document.createElement('span'); note.textContent = goalCompletion.blocked ? t('roomReview.goalBlocked') : playSession.snapshot.rooms.find(({ id }) => id === playSession.goalRoomId)?.kind === 'shop' ? t('roomReview.goalOptional') : t('roomReview.goalReady');
    const finish = document.createElement('button'); finish.type = 'button'; finish.dataset.action = 'complete-goal'; finish.className = 'primary-action';
    finish.disabled = goalCompletion.blocked; finish.textContent = t('roomReview.finishGoal'); finish.addEventListener('click', finishCurrentGoal);
    card.append(note, finish); cards.unshift(card);
  }
  roomEventItems.replaceChildren(...cards);
  roomEventBar.hidden = cards.length === 0;

  const signature = cards
    .map((card) => `${card.dataset.kind}:${card.dataset.entityId}`)
    .join('|');
  if (signature && signature !== lastRoomEventSignature) {
    if (roomEventIntroTimer) clearTimeout(roomEventIntroTimer);
    roomEventBar.classList.remove('is-event-intro');
    void roomEventBar.offsetWidth;
    roomEventBar.classList.add('is-event-intro');
    roomEventIntroTimer = setTimeout(() => {
      roomEventBar.classList.remove('is-event-intro');
      roomEventIntroTimer = null;
    }, 520);
  }
  lastRoomEventSignature = signature;
}

function sideIcon(side) {
  return ({ north: '▲', east: '▶', south: '▼', west: '◀' })[side] ?? '◇';
}

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

function previewPlayExit(corridorId = null) {
  if (mode !== 'play' || !adapter) return;
  adapter.setHighlightedSpecIds(
    corridorId ? [corridorId] : [],
  );
}

function renderPlayExits(...args) { return measurePerformance('ui.renderPlayExits', () => renderPlayExitsImplementation(...args)); }

function renderPlayExitsImplementation() {
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

function renderActiveSpec(...args) { return measurePerformance('ui.renderActiveSpec', () => adapter.withDeferredDraws(() => renderActiveSpecImplementation(...args))); }

function renderActiveSpecImplementation() {
  const spec = activeRenderSpec();
  const visibility = mode === 'edit' || !playSession
    ? null
    : createRendererVisibilityFromPlaySession(playSession);
  adapter.render(spec, {
    visibility,
    resultMode: mode === 'result',
    entityStates: mode === 'edit' ? null : playSession?.gameplayState?.entityStates ?? null,
    showPlayer: mode !== 'edit' && Boolean(playSession),
    playerState: mode === 'edit' ? null : playSession?.playerState ?? null,
    designIntent: lastDesignIntent,
    presentationMode: mode,
  });
  ensureRoomOptions();
  ensureEntityOptions();
  ensureCorridorOptions();

  const highlightId = mode === 'edit'
    ? (selectedEntityId ?? selectedRoomId ?? selectedCorridorId)
    : playSession?.currentRoomId ?? null;
  if (highlightId && (
    spec.rooms.some((room) => room.id === highlightId) ||
    spec.entities.some((entity) => entity.id === highlightId) ||
    spec.corridors.some((corridor) => corridor.id === highlightId)
  )) {
    adapter.setSelectedSpecId(highlightId);
  } else {
    adapter.setSelectedSpecId(null);
  }

  const contextRoomId = mode === 'edit' && selectedEntityId
    ? selectedEntity()?.roomId ?? null
    : null;
  adapter.setContextSpecId(contextRoomId);
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
    selectedCorridorId = null;
    adapter.setSelectedSpecId(null);
    ensureEntityOptions();
    updateUi();
    return false;
  }

  if (!authoringSpec().rooms.some((room) => room.id === roomId)) return false;
  selectedRoomId = roomId;
  selectedEntityId = null;
  selectedCorridorId = null;
  entityRoom.value = roomId;
  setWorkflowTab('edit');
  setInspectorTab('rooms');
  ensureRoomOptions();
  ensureEntityOptions();
  ensureCorridorOptions();
  adapter.setSelectedSpecId(roomId);
  adapter.setContextSpecId(null);
  updateUi();
  return true;
}

function selectEntity(entityId) {
  if (mode !== 'edit') return false;
  const entity = entityId ? authoringSpec().entities.find((item) => item.id === entityId) : null;
  if (!entity) {
    selectedEntityId = null;
    selectedCorridorId = null;
    entitySelect.selectedIndex = -1;
    ensureEntityOptions();
    updateUi();
    return false;
  }

  selectedEntityId = entity.id;
  selectedRoomId = null;
  selectedCorridorId = null;
  entitySelect.value = entity.id;
  entityRoom.value = entity.roomId;
  setWorkflowTab('edit');
  setInspectorTab('entities');
  ensureRoomOptions();
  ensureEntityOptions();
  adapter.setSelectedSpecId(entity.id);
  adapter.setContextSpecId(entity.roomId);
  updateUi();
  return true;
}

function renderPathStatus() {
  if (!pathStatus) return;
  if (!pathCheckResult) {
    pathStatus.textContent = t('goal.none');
    return;
  }
  if (!pathCheckResult.reachable) {
    pathStatus.textContent = pathCheckResult.routeVisible
      ? `${t('goal.unreachable')}\n${t('goal.unreachableDetail')}`
      : t('goal.unreachable');
    return;
  }
  if (!pathCheckResult.routeVisible) {
    pathStatus.textContent = t('goal.reachable');
    return;
  }

  const routeText = pathCheckResult.roomIds.map((roomId) => {
    const role = roomRole(roomId);
    if (role === 'start') return t('entity.start').toUpperCase();
    if (role === 'goal') return t('entity.goal').toUpperCase();
    return roomId;
  }).join(' → ');
  const moveText = t('goal.moves', {
    count: pathCheckResult.moves,
    s: pathCheckResult.moves === 1 ? '' : 's',
  });
  pathStatus.textContent = `${t('goal.reachable')} · ${moveText}\n${routeText}`;
}

function clearPathCheck() {
  pathCheckResult = null;
  renderPathStatus();
  adapter?.setHighlightedSpecIds([]);
}

function applyCommand(command, successMessage, { allowNaturalBusy = false } = {}) {
  if (
    mode !== 'edit' ||
    generationBusy ||
    (naturalEditBusy && !allowNaturalBusy)
  ) return false;

  const preview = applyEditCommand(authoringSpec(), command);
  if (!preview.ok) {
    const message = friendlyEditError(preview.error);
    setEditStatus(`error: ${preview.error.code}`);
    showViewportNotice(message);
    return false;
  }

  if ([
    'move-room',
    'resize-room',
    'add-room',
    'remove-room',
    'restore-room',
    'add-corridor',
    'remove-corridor',
    'restore-corridor',
    'set-corridor-doors',
    'reconnect-corridor',
  ].includes(command.type)) {
    try {
      createDungeonScenePlan(preview.spec);
    } catch {
      if (command.type === 'move-room') {
        setEditStatus(t('notice.routeMoveShort'));
        showViewportNotice(t('notice.routeMove'), { timeoutMs: 5200 });
      } else if ([
        'add-corridor',
        'reconnect-corridor',
        'set-corridor-doors',
      ].includes(command.type)) {
        setEditStatus(t('notice.corridorBlockedShort'));
        showViewportNotice(t('notice.corridorRouteUnavailable'), { timeoutMs: 4200 });
      } else {
        setEditStatus(t('notice.routeShort'));
        showViewportNotice(t('notice.route'), { timeoutMs: 4200 });
      }
      return false;
    }
  }

  const result = session.apply(command);
  if (!result.ok) {
    const message = friendlyEditError(result.error);
    setEditStatus(`error: ${result.error.code}`);
    showViewportNotice(message);
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
  const revealRoute = workflowTab === 'edit' && !authoringPreviewConcealed;

  if (!path) {
    pathCheckResult = {
      reachable: false,
      routeVisible: revealRoute,
      roomIds: [],
      corridorIds: [],
      highlightIds: [],
    };
    renderPathStatus();
    adapter.setHighlightedSpecIds([]);
    return false;
  }

  if (!revealRoute) {
    pathCheckResult = {
      reachable: true,
      routeVisible: false,
      roomIds: [],
      corridorIds: [],
      highlightIds: [],
    };
    renderPathStatus();
    adapter.setHighlightedSpecIds([]);
    return true;
  }

  const startEntity = spec.entities.find((entity) => entity.type === 'start');
  const goalEntity = spec.entities.find((entity) => entity.type === 'goal');
  pathCheckResult = {
    reachable: true,
    routeVisible: true,
    ...path,
    highlightIds: [
      ...path.roomIds,
      ...path.corridorIds,
      startEntity?.id,
      goalEntity?.id,
    ].filter(Boolean),
  };
  renderPathStatus();
  adapter.setHighlightedSpecIds(pathCheckResult.highlightIds);
  return true;
}

function stepRoomSize(axis, delta) {
  const room = selectedRoom();
  if (!room || !['width', 'depth'].includes(axis) || !Number.isFinite(delta)) return false;
  const input = axis === 'width' ? roomWidth : roomDepth;
  const current = Number(input.value || room[axis]);
  const next = Math.max(1, current + delta);
  input.value = String(next);
  return resizeSelectedRoom();
}

function nextRoomId() {
  const used = new Set(authoringSpec().rooms.map((room) => room.id));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `room-editor-${String(index).padStart(3, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('Unable to allocate room ID');
}

function nextCorridorId() {
  const used = new Set(authoringSpec().corridors.map((corridor) => corridor.id));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `corridor-editor-${String(index).padStart(3, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error('Unable to allocate corridor ID');
}

function roomInteriorsOverlap(left, right) {
  const overlapX =
    Math.min(left.x + left.width / 2, right.x + right.width / 2) -
    Math.max(left.x - left.width / 2, right.x - right.width / 2);
  const overlapZ =
    Math.min(left.z + left.depth / 2, right.z + right.depth / 2) -
    Math.max(left.z - left.depth / 2, right.z - right.depth / 2);
  return overlapX > 1e-9 && overlapZ > 1e-9;
}

function findFreeRoomNearViewCenter(size = 8) {
  const rooms = authoringSpec().rooms;
  const rect = canvas.getBoundingClientRect();
  const ground = adapter.getGroundPointAt(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );

  const fallbackCenter = rooms.length > 0
    ? {
        x: rooms.reduce((sum, room) => sum + room.x, 0) / rooms.length,
        z: rooms.reduce((sum, room) => sum + room.z, 0) / rooms.length,
      }
    : { x: 0, z: 0 };

  const base = {
    x: Math.round((ground?.x ?? fallbackCenter.x) * 2) / 2,
    z: Math.round((ground?.z ?? fallbackCenter.z) * 2) / 2,
  };
  const step = size + 4;

  for (let ring = 0; ring <= 12; ring += 1) {
    const offsets = ring === 0
      ? [[0, 0]]
      : [];
    if (ring > 0) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        offsets.push([dx, -ring], [dx, ring]);
      }
      for (let dz = -ring + 1; dz <= ring - 1; dz += 1) {
        offsets.push([-ring, dz], [ring, dz]);
      }
    }

    for (const [dx, dz] of offsets) {
      const candidate = {
        id: nextRoomId(),
        x: base.x + dx * step,
        z: base.z + dz * step,
        width: size,
        depth: size,
      };
      if (!rooms.some((other) => roomInteriorsOverlap(candidate, other))) {
        return candidate;
      }
    }
  }

  return null;
}

function addRoom(requestedDirection = null) {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;

  const rooms = authoringSpec().rooms;
  const anchor = selectedRoom();
  const size = 8;
  let room = null;

  if (!anchor) {
    room = findFreeRoomNearViewCenter(size);
  } else {
    const direction = ['north', 'east', 'south', 'west'].includes(requestedDirection)
      ? requestedDirection
      : roomAddDirection.value || 'east';
    const gap = 4;
    const vector = {
      north: [0, -1],
      east: [1, 0],
      south: [0, 1],
      west: [-1, 0],
    }[direction] ?? [1, 0];

    const axisDistance = vector[0] !== 0
      ? anchor.width / 2 + gap + size / 2
      : anchor.depth / 2 + gap + size / 2;

    room = {
      id: nextRoomId(),
      x: anchor.x + vector[0] * axisDistance,
      z: anchor.z + vector[1] * axisDistance,
      width: size,
      depth: size,
    };

    for (let step = 0; step < 50 && rooms.some((other) => roomInteriorsOverlap(room, other)); step += 1) {
      room = {
        ...room,
        x: room.x + vector[0] * (size + gap),
        z: room.z + vector[1] * (size + gap),
      };
    }
  }

  if (!room || rooms.some((other) => roomInteriorsOverlap(room, other))) {
    showViewportNotice(t('notice.noRoomSpace'));
    return false;
  }

  const added = applyCommand({ type: 'add-room', room }, `added ${room.id}`);
  if (!added) return false;
  selectedRoomId = room.id;
  selectedEntityId = null;
  selectedCorridorId = null;
  setInspectorTab('rooms');
  renderActiveSpec();
  return true;
}

function removeSelectedRoom() {
  const room = selectedRoom();
  if (!room || mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const removed = applyCommand({ type: 'remove-room', roomId: room.id }, `removed ${room.id}`);
  if (!removed) return false;
  selectedRoomId = null;
  selectedEntityId = null;
  selectedCorridorId = null;
  renderActiveSpec();
  return true;
}

function addCorridor() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const fromRoomId = corridorFromRoom.value;
  const toRoomId = corridorToRoom.value;
  if (!fromRoomId || !toRoomId || fromRoomId === toRoomId) {
    showViewportNotice(t('notice.corridorRooms'));
    return false;
  }

  const corridor = {
    id: nextCorridorId(),
    fromRoomId,
    toRoomId,
    width: 3,
    kind: 'manual',
  };

  const added = applyCommand({ type: 'add-corridor', corridor }, `added ${corridor.id}`);
  if (!added) return false;
  selectedCorridorId = corridor.id;
  selectedRoomId = null;
  selectedEntityId = null;
  setInspectorTab('corridors');
  renderActiveSpec();
  return true;
}

function applyCorridorSides() {
  const corridor = selectedCorridor();
  if (!corridor || mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const changed = applyCommand({
    type: 'set-corridor-doors',
    corridorId: corridor.id,
    fromSide: corridorFromSide.value,
    toSide: corridorToSide.value,
  }, `door sides ${corridor.id}`);
  if (!changed) return false;
  selectedCorridorId = corridor.id;
  renderActiveSpec();
  return true;
}

function removeSelectedCorridor() {
  const corridor = selectedCorridor();
  if (!corridor || mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const removed = applyCommand(
    { type: 'remove-corridor', corridorId: corridor.id },
    `removed ${corridor.id}`,
  );
  if (!removed) return false;
  selectedCorridorId = null;
  renderActiveSpec();
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
  setGenerationStatus(t('generation.translating'));
  updateUi();

  try {
    const endpoint = window.__DAI_DESIGN_INTENT_ENDPOINT__ || '/api/design-intent';
    const response = await measurePerformanceAsync('generation.intentRequest', () => fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, includeRoomRequests: true }),
    }));

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.ok !== true || !payload.intent) {
      const code = payload?.error?.code || `HTTP_${response.status}`;
      setGenerationStatus(`error: ${code}${payload?.error?.message ? ` · ${payload.error.message}` : ''}`);
      return false;
    }

    const floorCount = requestedFloorCount();
    const generatorStrategyId = selectedGeneratorStrategyId();
    const requests = payload.roomRequests ?? parseFallbackRoomRequests(prompt);
    const requestedDifficulty = resolveGenerationDifficulty(generationDifficultySelect?.value, payload.difficulty);
    let specialRoomConfig = null;
    {
      const reviewOptions = { requests, floorCount, seed: deriveGeneratorSeedFromPrompt(prompt), difficulty: requestedDifficulty, roomsPerFloor: Math.min(20, Math.max(5, Math.round(payload.intent.targetDuration / 60))), warnings: payload.warnings ?? [], language: getLanguage(), strategyLabel: generatorStrategyLabel(generatorStrategyRegistry.list().find(({ id }) => id === generatorStrategyId)) };
      if (generationAutoInput?.checked && reviewOptions.warnings.length) {
        throw new Error(t('roomReview.autoWarnings', { warnings: reviewOptions.warnings.join(' ') }));
      }
      specialRoomConfig = generationAutoInput?.checked ? createRoomPlanConfig(reviewOptions) : await reviewRoomPlan(reviewOptions);
      if (!specialRoomConfig) { setGenerationStatus(t('roomReview.cancelled')); return false; }
    }
    const generatedFloors = await generateFloorSet(payload.intent, {
      prompt,
      count: floorCount,
      strategyId: generatorStrategyId,
      specialRoomConfig,
    });
    const generated = generatedFloors[0];
    setAuthoringFloors(generatedFloors.map((entry) => entry.spec), 0);
    selectedRoomId = null;
    selectedEntityId = null;
    selectedCorridorId = null;
    playSession = null;
    playSource = null;
    dungeonRunSession = null;
    lastDungeonRunResult = null;
    mysteryGeneration = null;
    lastPlayResult = null;
    lastNaturalEditCommand = null;
    lastDesignIntent = clone(payload.intent);
    lastSpecialRoomConfig = specialRoomConfig ? clone(specialRoomConfig) : null;
    if (generatorStrategySelect) generatorStrategySelect.value = generatorStrategyId;
    lastGeneration = {
      generatorVersion: generated.generatorVersion,
      generatorStrategyId: generated.generatorStrategyId,
      algorithmVersion: generated.algorithmVersion,
      contentLayerVersion: generated.contentLayerVersion,
      selectedProvider: payload.selectedProvider ?? 'unknown',
      seed: generated.profile.seed,
      roomCount: generated.profile.roomCount,
      routeChoice: generated.profile.routeChoice,
      entityCount: generated.spec.entities.length,
      eventCount: generated.spec.events.length,
      floorCount: generatedFloors.length,
      floors: generatedFloors.map((entry, index) => ({
        floorIndex: index,
        seed: entry.profile.seed,
        dungeonId: entry.spec.id,
        roomCount: entry.profile.roomCount,
        entityCount: entry.spec.entities.length,
        eventCount: entry.spec.events.length,
      })),
    };
    mode = 'edit';
    authoringPreviewConcealed = true;
    pathCheckResult = null;
    renderPathStatus();
    adapter.setHighlightedSpecIds([]);
    promptHistory = [
      { prompt, roomCount: lastGeneration.roomCount, floorCount: lastGeneration.floorCount },
      ...promptHistory,
    ].slice(0, 8);
    renderPromptHistory();
    setWorkflowTab('play');
    if (moveCount) moveCount.textContent = '0';
    if (mappedCount) mappedCount.textContent = '0';
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    renderActiveSpec();
    triggerViewportTransition('generation');
    emitAudioCue('generated');
    setGenerationStatus(floorCount > 1
      ? t('generation.generatedRun', { floors: floorCount, count: lastGeneration.roomCount })
      : t('generation.generated', { count: lastGeneration.roomCount }));
    setEditStatus(floorCount > 1 ? `generated ${floorCount}-floor run` : 'generated new dungeon');
    return true;
  } catch (error) {
    const conflict = /FIRST_SHOP_SURVIVAL_CONFLICT|ROUTE_VIABILITY_CONFLICT|NORMAL_ROOM_CAPACITY_CONFLICT|NORMAL_ROOM_EXPLICIT_CONTENT_CONFLICT/.test(error.message ?? '');
    setGenerationStatus(conflict ? t('roomReview.viabilityConflict') : `${t('generation.unavailable')} · ${error.message ?? 'UNKNOWN'}`);
    return false;
  } finally {
    generationBusy = false;
    updateUi();
  }
}

function naturalEditContext() {
  return {
    rooms: authoringSpec().rooms.map((room) => ({
      id: room.id,
      x: room.x,
      z: room.z,
      width: room.width,
      depth: room.depth,
    })),
    entities: authoringSpec().entities.map((entity) => ({
      id: entity.id,
      type: entity.type,
      roomId: entity.roomId,
    })),
    corridors: authoringSpec().corridors.map((corridor) => ({
      id: corridor.id,
      fromRoomId: corridor.fromRoomId,
      toRoomId: corridor.toRoomId,
      width: corridor.width,
      kind: corridor.kind ?? null,
      fromSide: corridor.fromSide ?? null,
      toSide: corridor.toSide ?? null,
    })),
  };
}

async function applyNaturalEdit() {
  const prompt = naturalEditInput.value.trim();
  if (!prompt || naturalEditBusy || generationBusy || mode !== 'edit') return false;

  naturalEditBusy = true;
  lastNaturalEditCommand = null;
  setNaturalEditStatus(t('natural.translating'));
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
    const applied = applyCommand(
      command,
      `natural edit: ${command.type}`,
      { allowNaturalBusy: true },
    );
    if (!applied) {
      setNaturalEditStatus(
        t('natural.rejected', { code: 'EDIT_COMMAND_REJECTED' }),
      );
      return false;
    }

    lastNaturalEditCommand = clone(command);
    if (command.type === 'move-entity') {
      selectedEntityId = command.entityId;
      selectedRoomId = null;
      selectedCorridorId = null;
      setInspectorTab('entities');
    } else if (command.type === 'move-room' || command.type === 'resize-room') {
      selectedRoomId = command.roomId;
      selectedEntityId = null;
      selectedCorridorId = null;
      setInspectorTab('rooms');
    } else if (command.type === 'add-entity') {
      selectedEntityId = command.entity?.id ?? null;
      selectedRoomId = null;
      selectedCorridorId = null;
      setInspectorTab('entities');
    } else if (command.type === 'remove-entity') {
      if (selectedEntityId === command.entityId) selectedEntityId = null;
      selectedRoomId = null;
      selectedCorridorId = null;
      setInspectorTab('entities');
    } else if (command.type === 'add-room') {
      selectedRoomId = command.room?.id ?? null;
      selectedEntityId = null;
      selectedCorridorId = null;
      setInspectorTab('rooms');
    } else if (command.type === 'remove-room') {
      if (selectedRoomId === command.roomId) selectedRoomId = null;
      selectedEntityId = null;
      selectedCorridorId = null;
      setInspectorTab('rooms');
    } else if (command.type === 'add-corridor') {
      selectedCorridorId = command.corridor?.id ?? null;
      selectedRoomId = null;
      selectedEntityId = null;
      setInspectorTab('corridors');
    } else if (
      command.type === 'reconnect-corridor' ||
      command.type === 'set-corridor-doors'
    ) {
      selectedCorridorId = command.corridorId;
      selectedRoomId = null;
      selectedEntityId = null;
      setInspectorTab('corridors');
    } else if (command.type === 'remove-corridor') {
      if (selectedCorridorId === command.corridorId) selectedCorridorId = null;
      selectedRoomId = null;
      selectedEntityId = null;
      setInspectorTab('corridors');
    }
    renderActiveSpec();
    naturalEditInput.value = '';
    setNaturalEditStatus(t('natural.applied', { command: command.type }));
    return true;
  } catch {
    setNaturalEditStatus(t('natural.unavailable'));
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

function renderResultMetrics(result) {
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

function finalizePlayIfNeeded() {
  if (!playSession || !['cleared', 'failed'].includes(playSession.status)) return false;

  if (!dungeonRunSession) {
    const fallback = createPlayResult(playSession);
    if (!fallback.ok) throw new Error(`createPlayResult failed: ${JSON.stringify(fallback.error)}`);
    lastPlayResult = fallback.result;
    lastDungeonRunResult = null;
    mode = 'result';
    resultStatus.textContent = lastPlayResult.status === 'cleared' ? t('result.cleared') : t('result.ended');
    resultStatus.hidden = false;
    renderResultMetrics(lastPlayResult);
    syncAudioMode();
    emitAudioCue(lastPlayResult.status === 'cleared' ? 'run-clear' : 'run-fail');
    renderActiveSpec();
    adapter.focusSpecId(playSession.currentRoomId, { preserveDistance: true });
    triggerViewportTransition('result');
    triggerResultReveal();
    showActionFeedback(
      lastPlayResult.status === 'cleared' ? t('result.cleared') : t('result.ended'),
      'result',
    );
    return true;
  }

  const synced = syncDungeonRunFloor(dungeonRunSession, playSession, {
    at: playSession.completedAt ?? playActionClock,
  });
  if (!synced.ok) {
    throw new Error(`syncDungeonRunFloor failed: ${JSON.stringify(synced.error)}`);
  }
  dungeonRunSession = synced.run;
  currentFloorIndex = dungeonRunSession.currentFloorIndex;

  if (synced.advanced) {
    playSession = dungeonRunSession.currentFloorSession;
    if (playSource === 'test' && floorSessions[currentFloorIndex]) {
      session = floorSessions[currentFloorIndex];
    }
    selectedRoomId = playSession.currentRoomId;
    selectedEntityId = null;
    selectedCorridorId = null;
    playActionClock = Math.max(playActionClock, Number(playSession.startedAt) || 0);
    mode = 'play';
    resultStatus.textContent = '';
    resultStatus.hidden = true;
    updatePlayReadout();
    setEditStatus(`${t('run.floor')} ${currentFloorIndex + 1}/${dungeonRunSession.floorCount}`);
    syncAudioMode();
    emitAudioCue('floor-advance');
    renderActiveSpec();
    adapter.focusSpecId(playSession.currentRoomId, { preserveDistance: true });
    triggerViewportTransition('floor');
    showActionFeedback(`✓ ${t('run.floor')} ${currentFloorIndex}`, 'floor');
    return true;
  }

  const runResult = createDungeonRunResult(dungeonRunSession);
  if (!runResult.ok) throw new Error(`createDungeonRunResult failed: ${JSON.stringify(runResult.error)}`);
  lastDungeonRunResult = runResult.result;

  const floorResult = dungeonRunSession.floorResults.at(-1)?.result ?? createPlayResult(playSession).result;
  lastPlayResult = clone(floorResult);
  mode = 'result';
  if (moveCount) moveCount.textContent = String(lastPlayResult.moves);
  if (mappedCount) mappedCount.textContent = String(lastPlayResult.visitedRoomIds.length);
  if (playFloorCount) playFloorCount.textContent =
    `${lastDungeonRunResult.floorsCompleted}/${lastDungeonRunResult.floorCount}`;
  resultStatus.textContent = lastDungeonRunResult.status === 'cleared' ? t('result.cleared') : t('result.ended');
  resultStatus.hidden = false;
  renderResultMetrics(lastPlayResult);
  syncAudioMode();
  emitAudioCue(lastDungeonRunResult.status === 'cleared' ? 'run-clear' : 'run-fail');
  renderActiveSpec();
  adapter.focusSpecId(playSession.currentRoomId, { preserveDistance: true });
  triggerViewportTransition('result');
  triggerResultReveal();
  showActionFeedback(
    lastDungeonRunResult.status === 'cleared' ? t('result.cleared') : t('result.ended'),
    'result',
  );
  return true;
}

function beginDungeonRun(runSpec, source) {
  shopUiRoomKey = null; shopUiDismissed = false;
  const result = startDungeonRun(runSpec, { startedAt: 0 });
  if (!result.ok) {
    setEditStatus(`Play blocked: ${result.errors?.[0]?.code ?? 'VALIDATION'}`);
    return false;
  }

  pathCheckResult = null;
  renderPathStatus();
  adapter.setHighlightedSpecIds([]);

  dungeonRunSession = result.run;
  lastDungeonRunResult = null;
  currentFloorIndex = dungeonRunSession.currentFloorIndex;
  if (source === 'test' && floorSessions[currentFloorIndex]) {
    session = floorSessions[currentFloorIndex];
  }
  playSession = dungeonRunSession.currentFloorSession;
  playActionClock = Number.isFinite(playSession.startedAt) ? playSession.startedAt : 0;
  playSource = source;
  lastPlayResult = null;
  mode = 'play';
  selectedRoomId = playSession.currentRoomId;
  selectedEntityId = null;
  selectedCorridorId = null;
  resultStatus.textContent = '';
  resultStatus.hidden = true;
  resultStatus.classList.remove('is-result-reveal');
  if (resultMetrics) {
    resultMetrics.classList.remove('is-result-reveal');
    resultMetrics.replaceChildren();
    resultMetrics.hidden = true;
  }
  updatePlayReadout();
  setEditStatus(source === 'mystery'
    ? `mystery run started · ${dungeonRunSession.floorCount} floor(s)`
    : `test run started · ${dungeonRunSession.floorCount} floor(s)`);
  syncAudioMode();
  emitAudioCue(source === 'mystery' ? 'mystery-start' : 'play-start');
  renderActiveSpec();
  triggerViewportTransition('mode');
  finalizePlayIfNeeded();
  return true;
}

function startDungeon() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy) return false;
  const runSpec = authoringRunSpec('editor-test-run');
  if (!runSpec.ok) {
    setEditStatus(`Play blocked: ${runSpec.errors?.[0]?.code ?? 'VALIDATION'}`);
    updateUi();
    return false;
  }
  mysteryGeneration = null;
  return beginDungeonRun(runSpec.spec, 'test');
}

function freshMysterySeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  let seed = values[0] >>> 0;
  const blocked = new Set([
    ...authoringFloorSpecs().map((spec) => spec.seed),
    lastGeneration?.seed,
  ].filter(Number.isSafeInteger));
  while (blocked.has(seed)) seed = (seed + 0x9e3779b9) >>> 0;
  return seed;
}

async function startMysteryDungeon() {
  try { return await startMysteryDungeonImplementation(); }
  catch (error) {
    const message = `Mystery blocked: ${error.message ?? 'GENERATION_FAILED'}`;
    setEditStatus(message); setGenerationStatus(message); showViewportNotice(message, { timeoutMs: 5200 });
    return false;
  }
}

async function startMysteryDungeonImplementation() {
  if (mode !== 'edit' || generationBusy || naturalEditBusy || !lastDesignIntent) return false;

  const seed = freshMysterySeed();
  const generatorStrategyId =
    lastGeneration?.generatorStrategyId ??
    selectedGeneratorStrategyId();
  const generatedFloors = await generateFloorSet(lastDesignIntent, {
    prompt: 'mystery-play',
    count: Math.max(1, floorSessions.length),
    baseSeed: seed,
    idPrefix: `mystery-${seed}`,
    strategyId: generatorStrategyId,
    specialRoomConfig: lastSpecialRoomConfig,
  });
  const generated = generatedFloors[0];
  mysteryGeneration = {
    generatorVersion: generated.generatorVersion,
    generatorStrategyId: generated.generatorStrategyId,
    algorithmVersion: generated.algorithmVersion,
    contentLayerVersion: generated.contentLayerVersion,
    seed: generated.profile.seed,
    roomCount: generated.profile.roomCount,
    routeChoice: generated.profile.routeChoice,
    entityCount: generated.spec.entities.length,
    eventCount: generated.spec.events.length,
    floorCount: generatedFloors.length,
    floors: generatedFloors.map((entry, index) => ({
      floorIndex: index,
      seed: entry.profile.seed,
      dungeonId: entry.spec.id,
      roomCount: entry.profile.roomCount,
      entityCount: entry.spec.entities.length,
      eventCount: entry.spec.events.length,
    })),
  };

  const runSpec = createDungeonRunSpec(
    generatedFloors.map((entry) => entry.spec),
    { id: `mystery-run-${seed}` }
  );
  if (!runSpec.ok) {
    setEditStatus(`Mystery blocked: ${runSpec.errors?.[0]?.code ?? 'VALIDATION'}`);
    return false;
  }
  return beginDungeonRun(runSpec.spec, 'mystery');
}

function movePlayToRoom(roomId, corridorId = null) {
  if (mode !== 'play' || !playSession) return false;
  if (roomBlocksExit()) {
    setEditStatus('Resolve room event before leaving');
    return false;
  }

  const beforeFloorIndex = dungeonRunSession?.currentFloorIndex ?? currentFloorIndex;
  const moved = movePlaySession(playSession, roomId, {
    at: nextPlayActionAt(),
    corridorId,
  });
  if (moved?.ok) emitAudioCue('move');

  const applied = applyPlayRuntimeResult(moved, 'Move blocked');
  if (!applied || mode !== 'play' || !playSession) return applied;

  const afterFloorIndex = dungeonRunSession?.currentFloorIndex ?? currentFloorIndex;
  if (afterFloorIndex !== beforeFloorIndex) return applied;

  const { enemies, interactables } = roomContents();
  const hasBlockingEvent =
    enemies.length > 0 ||
    interactables.some(
      (entry) => entry.entity.type === 'trap' && entry.state.status === 'armed',
    );

  if (hasBlockingEvent) {
    adapter.focusSpecId(playSession.currentRoomId, { preserveDistance: true });
    triggerViewportTransition('event');
  }

  return applied;
}

function returnToEdit() {
  if (mode === 'edit') return false;

  const runtimeFloorIndex = dungeonRunSession?.currentFloorIndex ?? currentFloorIndex;
  const returningFromMystery =
    playSource === 'mystery' &&
    Array.isArray(dungeonRunSession?.snapshot?.floors) &&
    dungeonRunSession.snapshot.floors.length > 0;

  if (returningFromMystery) {
    setAuthoringFloors(
      dungeonRunSession.snapshot.floors.map((floor) => floor.dungeon),
      runtimeFloorIndex,
    );
    authoringPreviewConcealed = false;
    pathCheckResult = null;
    lastNaturalEditCommand = null;
    adapter.setHighlightedSpecIds([]);
    if (floorCountInput) floorCountInput.value = String(floorSessions.length);

    if (mysteryGeneration) {
      lastGeneration = {
        ...lastGeneration,
        ...clone(mysteryGeneration),
      };
    }
  } else if (floorSessions.length > 0) {
    currentFloorIndex = Math.max(0, Math.min(floorSessions.length - 1, runtimeFloorIndex));
    session = floorSessions[currentFloorIndex];
  }

  mode = 'edit';
  syncAudioMode();
  emitAudioCue('return-edit');
  playSession = null;
  playSource = null;
  dungeonRunSession = null;
  lastDungeonRunResult = null;
  lastPlayResult = null;
  mysteryGeneration = null;
  playActionClock = 0;
  setWorkflowTab('edit');
  selectedRoomId = null;
  selectedEntityId = null;
  selectedCorridorId = null;
  if (moveCount) moveCount.textContent = '0';
  if (mappedCount) mappedCount.textContent = '0';
  if (playFloorCount) playFloorCount.textContent = `${currentFloorIndex + 1}/${Math.max(1, floorSessions.length)}`;
  if (hpCount) hpCount.textContent = '0/0';
  if (levelCount) levelCount.textContent = '1';
  if (xpCount) xpCount.textContent = '0/20';
  if (goldCount) goldCount.textContent = '0';
  resultStatus.textContent = '';
  resultStatus.hidden = true;
  resultStatus.classList.remove('is-result-reveal');
  if (resultMetrics) {
    resultMetrics.classList.remove('is-result-reveal');
    resultMetrics.replaceChildren();
    resultMetrics.hidden = true;
  }
  if (playModeLabel) {
    playModeLabel.textContent = '';
    playModeLabel.hidden = true;
  }
  setEditStatus(returningFromMystery ? 'mystery adopted into edit' : 'returned to edit');
  renderPathStatus();
  renderActiveSpec();
  triggerViewportTransition('mode');
  canvas.focus();
  return true;
}

function roomHasIncidentCorridor(roomId) {
  return authoringSpec().corridors.some((corridor) =>
    corridor.fromRoomId === roomId || corridor.toRoomId === roomId);
}

function beginRoomDrag(event) {
  if (
    event.button !== 0 ||
    mode !== 'edit' ||
    workflowTab !== 'edit' ||
    generationBusy ||
    naturalEditBusy
  ) return false;

  const room = selectedRoom();
  if (!room || roomHasIncidentCorridor(room.id)) return false;

  const hit = adapter.pickDetailedAt(event.clientX, event.clientY);
  if (!hit || hit.kind !== 'room' || hit.specId !== room.id) return false;
  if (wallSideFromPart(hit.part)) return false;

  const ground = adapter.getGroundPointAt(event.clientX, event.clientY);
  if (!ground) return false;

  roomDrag = {
    pointerId: event.pointerId,
    roomId: room.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: room.x,
    startZ: room.z,
    offsetX: room.x - ground.x,
    offsetZ: room.z - ground.z,
    x: room.x,
    z: room.z,
    valid: true,
    moved: false,
  };

  adapter.setCameraControlsEnabled(false);
  canvas.setPointerCapture?.(event.pointerId);
  canvas.classList.add('is-room-dragging');
  adapter.setRoomDraftPreview({ roomId: room.id, x: room.x, z: room.z, state: 'ready' });
  return true;
}

function updateRoomDrag(event) {
  if (!roomDrag || event.pointerId !== roomDrag.pointerId) return false;
  const ground = adapter.getGroundPointAt(event.clientX, event.clientY);
  if (!ground) return false;

  const x = Math.round((ground.x + roomDrag.offsetX) * 10) / 10;
  const z = Math.round((ground.z + roomDrag.offsetZ) * 10) / 10;
  const room = authoringSpec().rooms.find((entry) => entry.id === roomDrag.roomId);
  if (!room) return false;

  const candidate = { ...room, x, z };
  const valid = !authoringSpec().rooms.some((other) =>
    other.id !== room.id && roomInteriorsOverlap(candidate, other));

  roomDrag.x = x;
  roomDrag.z = z;
  roomDrag.valid = valid;
  roomDrag.moved =
    roomDrag.moved ||
    Math.hypot(event.clientX - roomDrag.startClientX, event.clientY - roomDrag.startClientY) > 5;

  adapter.setRoomDraftPreview({
    roomId: room.id,
    x,
    z,
    state: valid ? 'ready' : 'blocked',
  });
  return true;
}

function finishRoomDrag({ cancelled = false } = {}) {
  const draft = roomDrag;
  if (!draft) return false;

  roomDrag = null;
  canvas.classList.remove('is-room-dragging');
  adapter.clearRoomDraftPreview();
  adapter.setCameraControlsEnabled(true);
  if (canvas.hasPointerCapture?.(draft.pointerId)) {
    canvas.releasePointerCapture?.(draft.pointerId);
  }

  if (cancelled || !draft.moved) {
    updateUi();
    return false;
  }

  if (!draft.valid) {
    showViewportNotice(t('notice.roomDragOverlap'), { timeoutMs: 3800 });
    setEditStatus(t('notice.roomDragBlockedShort'));
    updateUi();
    return false;
  }

  const moved = applyCommand({
    type: 'move-room',
    roomId: draft.roomId,
    x: draft.x,
    z: draft.z,
  }, `moved ${draft.roomId}`);
  if (!moved) return false;
  selectRoom(draft.roomId);
  return true;
}

function corridorRoutesForDraft() {
  return (adapter?.plan?.corridorGroups ?? []).map((group) => ({
    corridorId: group.specId,
    points: (group.route ?? []).map((point) => ({ x: point.x, z: point.z })),
  }));
}

function corridorDraftErrorMessage(preview) {
  if (preview?.blockedCode === 'DUPLICATE_CORRIDOR') return t('notice.corridorDuplicate');
  if (preview?.blockedCode === 'CORRIDOR_COLLISION') return t('notice.corridorCollision');
  if (preview?.blockedCode === 'ROUTE_UNAVAILABLE') return t('notice.corridorRouteUnavailable');
  return t('notice.corridorRouteUnavailable');
}

function beginCorridorDraft(event) {
  if (
    event.button !== 0 ||
    mode !== 'edit' ||
    workflowTab !== 'edit' ||
    generationBusy ||
    naturalEditBusy
  ) return false;

  const sourceRoom = selectedRoom();
  if (!sourceRoom) return false;

  const hit = adapter.pickDetailedAt(event.clientX, event.clientY);
  if (!hit) return false;

  let sourceSide = null;
  let existingCorridorId = null;

  if (hit.kind === 'room' && hit.specId === sourceRoom.id) {
    sourceSide = wallSideFromPart(hit.part);
    if (!sourceSide) return false;

    const opening = findCorridorOpeningAtWall(adapter.plan, {
      roomId: sourceRoom.id,
      side: sourceSide,
      point: hit.point,
      room: sourceRoom,
    });
    existingCorridorId = opening?.corridorId ?? null;
  } else if (hit.kind === 'corridor') {
    const corridor = authoringSpec().corridors.find((entry) => entry.id === hit.specId);
    if (!corridor || ![corridor.fromRoomId, corridor.toRoomId].includes(sourceRoom.id)) return false;

    const rendered = adapter.plan?.corridorGroups?.find((group) => group.specId === corridor.id);
    const sourceIsFrom = rendered?.fromDoor?.roomId === sourceRoom.id;
    const doorPoint = sourceIsFrom ? rendered?.route?.[0] : rendered?.route?.at(-1);
    const nearSelectedRoomEndpoint = doorPoint && hit.point
      ? Math.hypot(hit.point.x - doorPoint.x, hit.point.z - doorPoint.z) <= Math.max(3.5, corridor.width * 1.5)
      : false;
    if (!nearSelectedRoomEndpoint) return false;

    sourceSide = corridorSideForRoom(adapter.plan, corridor.id, sourceRoom.id);
    existingCorridorId = corridor.id;
  } else {
    return false;
  }

  if (!sourceSide) return false;

  const existingCorridor = existingCorridorId
    ? authoringSpec().corridors.find((entry) => entry.id === existingCorridorId) ?? null
    : null;

  corridorDraft = {
    pointerId: event.pointerId,
    sourceRoomId: sourceRoom.id,
    sourceSide,
    existingCorridorId,
    sourceEndpoint: existingCorridor
      ? existingCorridor.fromRoomId === sourceRoom.id ? 'from' : 'to'
      : null,
    width: existingCorridor?.width ?? 3,
    candidateCorridorId: existingCorridor?.id ?? nextCorridorId(),
    preview: null,
  };

  if (existingCorridor) {
    selectedCorridorId = existingCorridor.id;
    selectedRoomId = null;
    selectedEntityId = null;
    setInspectorTab('corridors');
    ensureCorridorOptions();
    adapter.setSelectedSpecId(existingCorridor.id);

    const rendered = adapter.plan?.corridorGroups?.find((group) => group.specId === existingCorridor.id);
    if (rendered?.route?.length >= 2) {
      const points = rendered.fromDoor?.roomId === sourceRoom.id
        ? rendered.route
        : [...rendered.route].reverse();
      adapter.setCorridorDraftPreview({
        points,
        width: corridorDraft.width,
        state: 'open',
        existingCorridorId,
      });
    }
  }

  adapter.setCameraControlsEnabled(false);
  canvas.setPointerCapture?.(event.pointerId);
  canvas.classList.add('is-corridor-drafting');
  updateCorridorDraft(event);
  updateUi();
  return true;
}

function corridorDraftCommand(draft, preview) {
  if (!draft || !preview?.targetRoomId) return null;
  const targetSide = preview.targetSide ?? null;

  if (!draft.existingCorridorId) {
    const corridor = {
      id: draft.candidateCorridorId,
      fromRoomId: draft.sourceRoomId,
      toRoomId: preview.targetRoomId,
      width: draft.width,
      kind: 'manual',
      fromSide: draft.sourceSide,
    };
    if (targetSide) corridor.toSide = targetSide;
    return {
      corridorId: corridor.id,
      command: { type: 'add-corridor', corridor },
    };
  }

  const existing = authoringSpec().corridors.find(
    (entry) => entry.id === draft.existingCorridorId,
  );
  if (!existing) return null;

  const command = draft.sourceEndpoint === 'from'
    ? {
        type: 'reconnect-corridor',
        corridorId: existing.id,
        fromRoomId: draft.sourceRoomId,
        toRoomId: preview.targetRoomId,
        fromSide: draft.sourceSide,
        toSide: targetSide,
      }
    : {
        type: 'reconnect-corridor',
        corridorId: existing.id,
        fromRoomId: preview.targetRoomId,
        toRoomId: draft.sourceRoomId,
        fromSide: targetSide,
        toSide: draft.sourceSide,
      };

  return { corridorId: existing.id, command };
}

function preflightCorridorDraft(draft, preview) {
  const candidate = corridorDraftCommand(draft, preview);
  if (!candidate) {
    return {
      ok: false,
      blockedCode: 'ROUTE_UNAVAILABLE',
      errorMessage: 'Unable to build corridor edit command.',
    };
  }

  const edited = applyEditCommand(authoringSpec(), candidate.command);
  if (!edited.ok) {
    return {
      ok: false,
      blockedCode: edited.error?.code ?? 'EDIT_RESULT_INVALID',
      errorMessage: edited.error?.message ?? null,
    };
  }

  try {
    const plan = createDungeonScenePlan(edited.spec);
    const group = plan.corridorGroups.find(
      (entry) => entry.specId === candidate.corridorId,
    );
    if (!group) {
      return {
        ok: false,
        blockedCode: 'ROUTE_UNAVAILABLE',
        errorMessage: 'The routed corridor was not present in the scene plan.',
      };
    }

    const route = Array.isArray(group.route)
      ? group.route.map((point) => ({ x: point.x, z: point.z }))
      : [];

    return {
      ok: true,
      corridorId: candidate.corridorId,
      command: candidate.command,
      points: route.length > 0 ? route : preview.points,
      routedFromSide: group.fromDoor?.side ?? null,
      routedToSide: group.toDoor?.side ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      blockedCode: 'ROUTE_UNAVAILABLE',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function updateCorridorDraft(event) {
  if (!corridorDraft || event.pointerId !== corridorDraft.pointerId) return false;
  const point = adapter.getGroundPointAt(event.clientX, event.clientY);
  if (!point) return false;

  const hit = adapter.pickDetailedAt(event.clientX, event.clientY);
  let targetRoomId = null;
  let targetSide = null;
  if (hit?.kind === 'room' && hit.specId !== corridorDraft.sourceRoomId) {
    targetRoomId = hit.specId;
    // Direct drag fixes only the source wall. The destination stays Auto so
    // camera perspective cannot accidentally pin an unintended target wall.
    // Users can explicitly pin the destination side afterward in the Corridor inspector.
    targetSide = null;
  } else if (hit?.roomId && hit.roomId !== corridorDraft.sourceRoomId) {
    targetRoomId = hit.roomId;
  }

  let preview = buildCorridorDragPreview(authoringSpec(), {
    sourceRoomId: corridorDraft.sourceRoomId,
    sourceSide: corridorDraft.sourceSide,
    pointer: point,
    width: corridorDraft.width,
    existingCorridorId: corridorDraft.existingCorridorId,
    corridorRoutes: corridorRoutesForDraft(),
    targetRoomId,
    targetSide,
  });

  if (preview.state === 'ready' && preview.targetRoomId) {
    const routed = preflightCorridorDraft(corridorDraft, preview);
    if (routed.ok) {
      preview = {
        ...preview,
        state: 'ready',
        points: routed.points,
        commitCommand: routed.command,
        commitCorridorId: routed.corridorId,
        routedFromSide: routed.routedFromSide,
        routedToSide: routed.routedToSide,
        blockedCode: null,
        routeErrorMessage: null,
      };
    } else {
      preview = {
        ...preview,
        state: 'blocked',
        blockedCode: routed.blockedCode ?? 'ROUTE_UNAVAILABLE',
        routeErrorMessage: routed.errorMessage ?? null,
      };
    }
  }

  corridorDraft.preview = preview;
  adapter.setCorridorDraftPreview({
    points: preview.points,
    width: corridorDraft.width,
    state: preview.state,
    existingCorridorId: corridorDraft.existingCorridorId,
    targetRoomId: preview.targetRoomId,
  });
  return true;
}

function finishCorridorDraft({ cancelled = false } = {}) {
  const draft = corridorDraft;
  if (!draft) return false;

  corridorDraft = null;
  canvas.classList.remove('is-corridor-drafting');
  adapter.clearCorridorDraftPreview();
  adapter.setCameraControlsEnabled(true);
  if (canvas.hasPointerCapture?.(draft.pointerId)) {
    canvas.releasePointerCapture?.(draft.pointerId);
  }

  if (cancelled || !draft.preview || draft.preview.state === 'open') {
    setEditStatus('corridor draft cancelled');
    updateUi();
    return false;
  }

  if (draft.preview.state === 'blocked') {
    showViewportNotice(corridorDraftErrorMessage(draft.preview), { timeoutMs: 4200 });
    setEditStatus(t('notice.corridorBlockedShort'));
    updateUi();
    return false;
  }

  const command = draft.preview.commitCommand;
  const corridorId = draft.preview.commitCorridorId;
  if (!command || !corridorId) {
    showViewportNotice(t('notice.corridorRouteUnavailable'), { timeoutMs: 4200 });
    setEditStatus(t('notice.corridorBlockedShort'));
    updateUi();
    return false;
  }

  const committed = applyCommand(
    command,
    draft.existingCorridorId
      ? `reconnected ${corridorId}`
      : `added ${corridorId}`,
  );
  if (!committed) return false;

  selectCorridor(corridorId);
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

  if (hit.kind === 'corridor') {
    selectCorridor(hit.specId);
    return;
  }

  const roomId = hit.kind === 'room' ? hit.specId : hit.roomId;
  if (roomId) selectRoom(roomId);
}

function handleCanvasPointerDown(event) {
  if (event.button === 0 && beginCorridorDraft(event)) {
    canvasPointerOrigin = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (event.button === 0 && beginRoomDrag(event)) {
    canvasPointerOrigin = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  canvasPointerOrigin = event.button === 0
    ? { x: event.clientX, y: event.clientY }
    : null;
}

function handleCanvasPointerMove(event) {
  if (corridorDraft && event.pointerId === corridorDraft.pointerId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    updateCorridorDraft(event);
    return;
  }
  if (roomDrag && event.pointerId === roomDrag.pointerId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    updateRoomDrag(event);
  }
}

function handleCanvasPointerUp(event) {
  if (corridorDraft && event.pointerId === corridorDraft.pointerId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishCorridorDraft();
    return;
  }

  if (roomDrag && event.pointerId === roomDrag.pointerId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishRoomDrag();
    return;
  }

  if (event.button !== 0) return;
  const origin = canvasPointerOrigin;
  canvasPointerOrigin = null;
  if (!origin) return;
  const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
  if (distance <= 5) handleCanvasPointer(event);
}

function handleCanvasPointerCancel(event) {
  if (corridorDraft && event.pointerId === corridorDraft.pointerId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishCorridorDraft({ cancelled: true });
    return;
  }
  if (roomDrag && event.pointerId === roomDrag.pointerId) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishRoomDrag({ cancelled: true });
  }
}

function refreshLocalizedUi() {
  if (!session || !adapter) return;
  renderGeneratorStrategyOptions();
  renderPromptHistory();
  ensureRoomOptions();
  ensureEntityOptions();
  ensureCorridorOptions();
  renderPathStatus();
  refreshGate();
  updatePlayReadout();
  renderRoomEvents();
  renderPlayExits();
  if (lastPlayResult) {
    renderResultMetrics(lastPlayResult);
    if (mode === 'result') {
      resultStatus.textContent = (lastDungeonRunResult ?? lastPlayResult).status === 'cleared'
        ? t('result.cleared') : t('result.ended');
    }
  }
  renderEditContextHud();
  updateUi();
}

function isFormControl(target) {
  return target instanceof HTMLElement && ['SELECT', 'INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName);
}

function handleKeyboard(event) {
  const commandKey = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();

  if (isFormControl(event.target)) return;

  if (mode === 'play') {
    const directionByKey = {
      ArrowUp: 'north',
      ArrowRight: 'east',
      ArrowDown: 'south',
      ArrowLeft: 'west',
      w: 'north',
      d: 'east',
      s: 'south',
      a: 'west',
    };
    const direction = directionByKey[event.key] ?? directionByKey[key];
    if (!direction) return;
    event.preventDefault();

    if (roomBlocksExit()) {
      showViewportNotice(t('notice.resolveRoomEvent'));
      return;
    }

    const map = derivePlayMap(playSession);
    const roomPlan = adapter.plan?.roomGroups.find((group) => group.specId === map.currentRoomId);
    const sideByCorridor = new Map(
      (roomPlan?.doorOpenings ?? []).map((opening) => [opening.corridorId, opening.side])
    );
    const matches = map.currentExits.filter((exit) => sideByCorridor.get(exit.corridorId) === direction);
    if (matches.length === 1) {
      movePlayToRoom(matches[0].targetRoomId, matches[0].corridorId);
    } else if (matches.length > 1) {
      showViewportNotice(t('notice.multipleExits', { direction: t(`direction.${direction}`) }));
    } else {
      showViewportNotice(t('notice.noExit', { direction: t(`direction.${direction}`) }));
    }
    return;
  }

  if (mode !== 'edit') return;

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
    bindLanguageSwitchers(document);
    const response = await fetch('/spec/dungeon/fixtures/minimal-valid-v1.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`fixture fetch failed: HTTP ${response.status}`);
    setAuthoringFloors([await response.json()]);
    adapter = createThreeRendererAdapter({ canvas });
    resize();
    renderActiveSpec();
    subscribeLanguage(() => refreshLocalizedUi());

    canvasResizeObserver = new ResizeObserver(() => resize());
    canvasResizeObserver.observe(canvas);

    canvas.addEventListener('pointerdown', handleCanvasPointerDown, true);
    canvas.addEventListener('pointermove', handleCanvasPointerMove, true);
    canvas.addEventListener('pointerup', handleCanvasPointerUp, true);
    canvas.addEventListener('pointercancel', handleCanvasPointerCancel, true);
    window.addEventListener('resize', resize);
    document.addEventListener('pointerdown', unlockAudioFromGesture, true);
    window.addEventListener('keydown', unlockAudioFromGesture, true);
    window.addEventListener('keydown', handleKeyboard);
    window.addEventListener('beforeunload', () => audioPresentation.dispose(), { once: true });
    audioToggle?.addEventListener('click', toggleAudioMuted);
    bgmVolumeInput?.addEventListener('input', setBgmVolumeFromControl);
    seVolumeInput?.addEventListener('input', setSeVolumeFromControl);
    renderAudioToggle();
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    for (const button of workflowTabButtons) {
      button.addEventListener('click', () => setWorkflowTab(button.dataset.workflowTab));
    }
    for (const button of inspectorTabButtons) {
      button.addEventListener('click', () => setInspectorTab(button.dataset.inspectorTabTarget));
    }
    setInspectorTab(inspectorTab);
    renderGeneratorStrategyOptions();
    startButton.addEventListener('click', startDungeon);
    mysteryPlayButton.addEventListener('click', startMysteryDungeon);
    returnEditButton.addEventListener('click', returnToEdit);
    roomSelect.addEventListener('change', () => selectRoom(roomSelect.value));
    roomWidthMinus.addEventListener('click', () => stepRoomSize('width', -1));
    roomWidthPlus.addEventListener('click', () => stepRoomSize('width', 1));
    roomDepthMinus.addEventListener('click', () => stepRoomSize('depth', -1));
    roomDepthPlus.addEventListener('click', () => stepRoomSize('depth', 1));
    resizeRoomButton.addEventListener('click', resizeSelectedRoom);
    addRoomButton.addEventListener('click', () => addRoom());
    addRoomAtViewCenterButton?.addEventListener('click', () => addRoom());
    for (const button of roomDirectionAddButtons) {
      button.addEventListener('click', () => addRoom(button.dataset.roomAddDirection));
    }
    removeRoomButton.addEventListener('click', removeSelectedRoom);
    corridorSelect.addEventListener('change', () => selectCorridor(corridorSelect.value));
    corridorFromSide.addEventListener('change', updateUi);
    corridorToSide.addEventListener('change', updateUi);
    corridorFromRoom.addEventListener('change', updateUi);
    corridorToRoom.addEventListener('change', updateUi);
    applyCorridorSidesButton.addEventListener('click', applyCorridorSides);
    addCorridorButton.addEventListener('click', addCorridor);
    removeCorridorButton.addEventListener('click', removeSelectedCorridor);
    checkPathButton.addEventListener('click', checkStartGoalPath);
    entitySelect.addEventListener('change', () => selectEntity(entitySelect.value));
    entityRoom.addEventListener('change', updateUi);
    entityType.addEventListener('change', updateUi);
    addEntityButton.addEventListener('click', addEntity);
    moveEntityButton.addEventListener('click', moveEntityToTargetRoom);
    removeEntityButton.addEventListener('click', removeEntity);
    generationPrompt.addEventListener('input', updateUi);
    generatorStrategySelect?.addEventListener('change', updateUi);
    generationAutoInput?.addEventListener('change', updateUi);
    generationManualInput?.addEventListener('change', updateUi);
    floorCountInput?.addEventListener('input', updateUi);
    floorCountInput?.addEventListener('change', () => {
      floorCountInput.value = String(requestedFloorCount());
      updateUi();
    });
    floorSelect?.addEventListener('change', () => selectFloor(floorSelect.value));
    generateDungeonButton.addEventListener('click', generateDungeonFromPrompt);
    exportLayoutJsonButton?.addEventListener('click', exportLayoutJson);
    exportFullJsonButton?.addEventListener('click', exportFullJson);
    importJsonButton?.addEventListener('click', () => importJsonInput?.click());
    importJsonInput?.addEventListener('change', async () => {
      const file = importJsonInput.files?.[0] ?? null;
      await importJsonFile(file);
      importJsonInput.value = '';
    });
    naturalEditInput.addEventListener('input', updateUi);
    applyNaturalEditButton.addEventListener('click', applyNaturalEdit);
    renderPromptHistory();

    window.__DAI_EDITOR_SLICE__ = {
      ready: true,
      failed: false,
      startPerformanceProbe,
      stopPerformanceProbe,
      getState: snapshotState,
      getScreenPositionForSpecId: (id) => adapter.getScreenPositionForSpecId(id),
      getScreenPositionForRoomWall: (roomId, side) => adapter.getScreenPositionForRoomWall(roomId, side),
      getScreenPositionForWorldPoint: (point) => adapter.getScreenPositionForWorldPoint(point),
      probePointerAt: (clientX, clientY) => ({
        hit: adapter.pickDetailedAt(clientX, clientY),
        ground: adapter.getGroundPointAt(clientX, clientY),
      }),
      getCameraState: () => adapter.getCameraState(),
      getRenderedSelection: () => adapter.selectedSpecId,
      getCharacterPresentation: () => adapter.getCharacterPresentationSummary(),
      getAtmospherePresentation: () => adapter.getAtmospherePresentationSummary(),
      setAtmosphereForTest: (intent, presentationMode = mode) =>
        adapter.applyAtmosphere(intent, { mode: presentationMode }),
      getAudioPresentation: () => audioPresentation.getState(),
      syncReactiveAudioForTest: () => syncReactiveAudioIntensity(),
      unlockAudioForTest: async () => {
        const unlocked = await audioPresentation.unlock();
        syncAudioMode();
        renderAudioToggle();
        return unlocked;
      },
      showViewportNoticeForTest: (message, options) => showViewportNotice(message, options),
      showActionFeedbackForTest: (message, kind) => showActionFeedback(message, kind),
      triggerViewportTransitionForTest: (kind) => triggerViewportTransition(kind),
      triggerResultRevealForTest: () => triggerResultReveal(),
      getCurrentRoomPlan: () => {
        const roomId = playSession?.currentRoomId ?? selectedRoomId;
        const group = adapter.plan?.roomGroups.find((room) => room.specId === roomId) ?? null;
        return group ? clone(group) : null;
      },
      selectRoom,
      selectFloor,
      selectEntity,
      selectCorridor,
      setInspectorTab,
      beginCorridorDraft,
      updateCorridorDraft,
      finishCorridorDraft,
      beginRoomDrag,
      updateRoomDrag,
      finishRoomDrag,
      addRoom,
      removeSelectedRoom,
      addCorridor,
      applyCorridorSides,
      removeSelectedCorridor,
      resizeSelectedRoom,
      checkStartGoalPath,
      getGeneratorStrategies: () => generatorStrategyRegistry.list().map((entry) => ({ ...entry })),
      setGeneratorStrategy: (id) => {
        if (!generatorStrategyRegistry.has(id) || !generatorStrategySelect) return false;
        generatorStrategySelect.value = id;
        updateUi();
        return true;
      },
      generateDungeonFromPrompt,
      getLayoutExport: currentLayoutExport,
      getFullDungeonExport: currentFullDungeonExport,
      exportLayoutJson,
      exportFullJson,
      importDungeonJsonTextForTest: (input, options) =>
        applyImportedDungeonJson(input, options),
      applyNaturalEdit,
      evaluateStartGateForSpec: (spec) => evaluateStartGate(spec),
      startDungeon,
      startMysteryDungeon,
      movePlayToRoom,
      clearEnemy,
      finishCurrentGoal,
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
