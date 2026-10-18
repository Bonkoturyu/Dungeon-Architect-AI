import {
  createDungeonLayoutExchange,
  createFullDungeonExport,
  serializeJsonExport,
} from '../../../packages/export-core/src/layout-exchange.js';
import { t } from '../i18n.js';

// JSON書き出しの補助（ファイル名・来歴・Exportデータの作成・ダウンロード）。
// 状態は引数で受け取り、main.js は import しない（循環防止）。
// GLB書き出し（exportGlb）は busy 状態を main.js の updateUi と共有するため main.js に残す。

export function exportBaseName(floorSpecs) {
  const id = floorSpecs[0]?.id ?? 'dungeon';
  const normalized = String(id)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'dungeon';
}

export function exportProvenance(lastGeneration) {
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

export function createLayoutExport(floorSpecs, lastGeneration) {
  const base = exportBaseName(floorSpecs);
  return createDungeonLayoutExchange(
    floorSpecs,
    {
      id: `${base}-layout`,
      provenance: exportProvenance(lastGeneration),
    },
  );
}

export function createFullExport(floorSpecs) {
  const base = exportBaseName(floorSpecs);
  return createFullDungeonExport(
    floorSpecs,
    { id: `${base}-run` },
  );
}

export function downloadJsonExport(value, filename, { setGenerationStatus }) {
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
