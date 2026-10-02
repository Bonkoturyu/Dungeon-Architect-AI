// 同じ同期UI更新の途中描画をまとめる。最終描画・戻り値・例外は保持する。
export function createDrawBatcher(render) {
  let depth = 0;
  let pending = false;
  const draw = () => { if (depth > 0) { pending = true; return; } return render(); };
  const run = (operation) => {
    depth += 1;
    try { return operation(); }
    finally {
      depth -= 1;
      if (depth === 0 && pending) { pending = false; render(); }
    }
  };
  return { draw, run };
}
