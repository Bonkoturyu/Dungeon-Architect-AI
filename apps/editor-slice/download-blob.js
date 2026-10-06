// Chromium/Windowsでも通常のdownloadを使う。File System Access APIは不要。
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  let anchor;
  try {
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor?.remove();
    // download開始直後の失効を避けつつ、成功/失敗のどちらでも解放する。
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
