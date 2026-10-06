// 呼出側が所有する、live sceneに接続していないstagingだけを書き出す。
// Core/JSONへThree.js型を持ち込まず、追加依存なしで固定版の公式addonを使う。
export const GLB_EXPORT_TIMEOUT_MS = 60_000;

export async function exportStagedGlb(root) {
  if (!root?.isObject3D || root.parent) {
    throw new TypeError('GLB export requires a detached staging root.');
  }
  const materials = new Map();
  try {
    root.traverse((object) => {
      // motion時刻などのrenderer内部情報をglTF extrasへ漏らさない。
      object.userData = {};
      if (!object.material) return;
      const snapshot = (material) => {
        if (!materials.has(material)) {
          const cloned = material.clone();
          cloned.userData = {};
          materials.set(material, cloned);
        }
        return materials.get(material);
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(snapshot)
        : snapshot(object.material);
    });
    root.updateMatrixWorld(true);
    // 初期描画のbundleからexporterを分離。await前に材質もsnapshot済み。
    let timeout;
    let data;
    try {
      data = await Promise.race([
        (async () => {
          const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
          return new GLTFExporter().parseAsync(root, {
            binary: true,
            onlyVisible: true,
            trs: false,
            animations: [],
            includeCustomExtensions: false,
          });
        })(),
        // addon内部の非同期callbackが完了しない場合もUIのbusyを解除する。
        // serializer自体のabortではない。遅い完了結果はdownloadに使わない。
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('GLB export timed out.')), GLB_EXPORT_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    if (!(data instanceof ArrayBuffer) || data.byteLength < 20) {
      throw new Error('GLB exporter returned no binary scene.');
    }
    return data;
  } finally {
    for (const material of materials.values()) material.dispose();
  }
}
