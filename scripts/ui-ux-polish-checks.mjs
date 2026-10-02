// 出口が未描画の場合は、空配列の every() で合格させない。
export function exitLabelsAreSpatialNotOrdinal(exitButtonTexts, multiExitButtonTexts) {
  return exitButtonTexts.length > 0 &&
    exitButtonTexts.every((text) => text.length > 0 && !/^[▲▶▼◀][12]$/.test(text)) &&
    (multiExitButtonTexts.length === 0 || multiExitButtonTexts.every(
      (text) => text.length > 0 && (
        /[↑↓←→•]/.test(text) || !/^[▲▶▼◀][12]$/.test(text)
      ),
    ));
}
