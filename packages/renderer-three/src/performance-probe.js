// 明示的なローカル計測だけで有効化する。永続化・送信・プロンプト記録を行わない。
let enabled = false;
let records = [];
export function startPerformanceProbe() { records = []; enabled = true; }
export function stopPerformanceProbe() { enabled = false; return records.map((entry) => ({ ...entry })); }
export function recordPerformance(name, durationMs) {
  if (enabled && records.length < 20000) records.push({ name, durationMs });
}
export function measurePerformance(name, operation) {
  if (!enabled) return operation();
  const started = performance.now();
  try { return operation(); } finally { recordPerformance(name, performance.now() - started); }
}
export async function measurePerformanceAsync(name, operation) {
  if (!enabled) return operation();
  const started = performance.now();
  try { return await operation(); } finally { recordPerformance(name, performance.now() - started); }
}
