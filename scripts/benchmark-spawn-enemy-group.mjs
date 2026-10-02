import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { generateDungeonSpecV3 } from '../packages/generator/src/dungeon-generator.js';
import { startPlaySession } from '../packages/play-core/src/play-session.js';
import { dispatchSupportedEvents as after } from '../packages/play-core/src/event-runtime.js';

const baselinePath = 'artifacts/special-rooms/event-runtime-before-batch.js';
const beforeSource = await readFile(baselinePath, 'utf8');
const gameplayModule = pathToFileURL(path.resolve('packages/play-core/src/gameplay-state.js')).href;
const beforeModule = await import(`data:text/javascript;base64,${Buffer.from(beforeSource.replace('"./gameplay-state.js"', JSON.stringify(gameplayModule))).toString('base64')}`);
const before = beforeModule.dispatchSupportedEvents;
const rows = [];
for (const count of [10, 50, 125, 250]) {
  const spec = generateDungeonSpecV3({ seed: 42, roomCount: 3, routeChoice: 0, specialRoomEntityLimit: 250,
    roomPlans: [{ id: 'batch', kind: 'monster-house', floorNumber: 1, roomId: 'room-002', entityCount: count, offers: [] }] });
  const session = startPlaySession(spec).session;
  const original = JSON.stringify(session);
  const timing = { before: [], after: [] };
  let output;
  for (let iteration = -5; iteration < 100; iteration += 1) {
    const compared = {};
    for (const [name, fn] of iteration % 2 === 0 ? [['before', before], ['after', after]] : [['after', after], ['before', before]]) {
      const start = performance.now();
      compared[name] = fn(session, { type: 'on_enter_room', roomId: 'room-002' }, { at: 1 });
      const elapsed = performance.now() - start;
      if (iteration >= 0) timing[name].push(elapsed);
    }
    assert.deepEqual(compared.after, compared.before);
    assert.equal(JSON.stringify(session), original);
    output = compared.after;
  }
  const summarize = (samples) => { const sorted = samples.toSorted((a, b) => a - b); return { medianMs: sorted[49], p95Ms: sorted[94], minMs: sorted[0], maxMs: sorted.at(-1) }; };
  const row = { enemyCount: count, warmup: 5, repeats: 100, before: summarize(timing.before), after: summarize(timing.after), exactDeepEquality: true,
    outputSha256: createHash('sha256').update(JSON.stringify(output)).digest('hex') };
  rows.push(row);
  console.log(JSON.stringify(row));
}
await writeFile('artifacts/special-rooms/spawn-batch-profile.json', JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version,
  methodology: 'Same frozen session per count; old/new invocation order alternated; assertions and comparison excluded from timing; 5warmup +100samples each.',
  baselinePath, baselineSha256: createHash('sha256').update(beforeSource).digest('hex'), rows }, null, 2) + '\n');
