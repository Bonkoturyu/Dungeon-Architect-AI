import assert from 'node:assert/strict';
import test from 'node:test';
import { exitLabelsAreSpatialNotOrdinal } from '../../scripts/ui-ux-polish-checks.mjs';

test('出口がない場合や空ラベルの場合は合格しない', () => {
  assert.equal(exitLabelsAreSpatialNotOrdinal([], []), false);
  assert.equal(exitLabelsAreSpatialNotOrdinal([], ['▲←']), false);
  assert.equal(exitLabelsAreSpatialNotOrdinal([''], []), false);
  assert.equal(exitLabelsAreSpatialNotOrdinal(['▲'], ['']), false);
});

test('単一出口では複数出口のラベルを要求しない', () => {
  assert.equal(exitLabelsAreSpatialNotOrdinal(['▲'], []), true);
});

test('空間ラベルは合格し、従来の番号ラベルは不合格になる', () => {
  assert.equal(exitLabelsAreSpatialNotOrdinal(['▲←', '▲→'], ['▲←', '▲→']), true);
  for (const text of ['▲1', '▶2', '▼1', '◀2']) {
    assert.equal(exitLabelsAreSpatialNotOrdinal([text], []), false);
    assert.equal(exitLabelsAreSpatialNotOrdinal(['▲'], [text]), false);
  }
});
