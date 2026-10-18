import {
  GENERATOR_STRATEGY_BSP_LAB_ID,
  GENERATOR_STRATEGY_CELLULAR_AUTOMATA_LAB_ID,
  GENERATOR_STRATEGY_DELAUNAY_MST_LAB_ID,
  GENERATOR_STRATEGY_GAMEPLAY_GRAMMAR_LAB_ID,
  GENERATOR_STRATEGY_MAZE_CARVING_LAB_ID,
  GENERATOR_STRATEGY_RANDOM_WALK_LAB_ID,
  GENERATOR_STRATEGY_ROOMS_MAZES_LAB_ID,
  GENERATOR_STRATEGY_V1_CLASSIC_ID,
  GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
  GENERATOR_STRATEGY_WFC_LAB_ID,
  RECOMMENDED_GENERATOR_STRATEGY_ID,
} from '../../../packages/generator/src/strategy-catalog.js';
import { t } from '../i18n.js';

// 生成方式の表示名と選択肢、生成履歴の描画。
// main.js の状態・DOM・操作は引数で受け取り、main.js は import しない（循環防止）。

export function generatorStrategyLabel(metadata) {
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

export function renderGeneratorStrategyOptions({ generatorStrategySelect, generatorStrategyRegistry }) {
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

export function renderPromptHistory({ generationHistory, promptHistory, generationPrompt, updateUi }) {
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
