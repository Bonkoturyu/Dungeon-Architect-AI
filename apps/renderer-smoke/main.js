import { createThreeRendererAdapter } from '../../packages/renderer-three/src/index.js';

const canvas = document.querySelector('#renderCanvas');
const status = document.querySelector('#status');

function resize(adapter) {
  const rect = canvas.getBoundingClientRect();
  adapter.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
}

async function run() {
  try {
    const response = await fetch('/spec/dungeon/fixtures/minimal-valid-v1.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`fixture fetch failed: HTTP ${response.status}`);
    const spec = await response.json();

    const adapter = createThreeRendererAdapter({ canvas });
    resize(adapter);

    const first = adapter.render(spec);
    const firstMiddle = adapter.getObjectBySpecId('room-middle');
    const second = adapter.render(structuredClone(spec));
    const secondMiddle = adapter.getObjectBySpecId('room-middle');

    const result = {
      ready: true,
      failed: false,
      first,
      second,
      replacedOnRerender: Boolean(firstMiddle && secondMiddle && firstMiddle !== secondMiddle),
      startFound: Boolean(adapter.getObjectBySpecId('start-1')),
      goalFound: Boolean(adapter.getObjectBySpecId('goal-1')),
    };

    if (!result.replacedOnRerender || !result.startFound || !result.goalFound) {
      throw new Error(`renderer smoke invariant failed: ${JSON.stringify(result)}`);
    }

    window.__DAI_RENDERER_SMOKE__ = result;
    status.textContent = 'ready';
    window.addEventListener('resize', () => resize(adapter));
  } catch (error) {
    const failure = { ready: true, failed: true, message: String(error?.stack || error) };
    window.__DAI_RENDERER_SMOKE__ = failure;
    status.textContent = 'failed';
    console.error(error);
  }
}

run();
