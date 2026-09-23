export function summarizeFrameTimes(frameTimes) {
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const percentile = (p) => {
    if (sorted.length === 0) return null;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
    return sorted[index];
  };
  const median = percentile(0.5);
  return {
    sampleCount: sorted.length,
    frameMsMedian: median,
    frameMsP95: percentile(0.95),
    frameMsP99: percentile(0.99),
    fpsMedian: median && median > 0 ? 1000 / median : null,
  };
}

export function runFrameSampler({ frames = 180, onFrame = null, onComplete }) {
  const samples = [];
  let previous = performance.now();
  let remaining = frames;

  function tick(now) {
    samples.push(now - previous);
    previous = now;

    if (typeof onFrame === "function") onFrame();
    remaining -= 1;

    if (remaining <= 0) {
      onComplete(summarizeFrameTimes(samples.slice(1)));
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

export function exposeResult(base) {
  window.__DAI_BENCHMARK__ = { ...base, complete: false };
  window.__DAI_BENCHMARK_READY__ = true;
}

export function finishResult(extra) {
  window.__DAI_BENCHMARK__ = {
    ...window.__DAI_BENCHMARK__,
    ...extra,
    complete: true,
  };
}
