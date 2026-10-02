import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawBatcher} from '../src/draw-batch.js';
test('synchronous scene updates draw once with final state and preserve return values',()=>{
 let state=0;const frames=[];const batch=createDrawBatcher(()=>frames.push(state));
 assert.equal(batch.run(()=>{state=1;batch.draw();state=2;batch.draw();return 7;}),7);
 assert.deepEqual(frames,[2]);batch.draw();assert.deepEqual(frames,[2,2]);
});
test('nested batches and thrown operations do not leak suppression to future draws',()=>{
 let draws=0;const batch=createDrawBatcher(()=>draws++);
 batch.run(()=>{batch.draw();batch.run(()=>{batch.draw();batch.draw();});});assert.equal(draws,1);
 assert.throws(()=>batch.run(()=>{batch.draw();throw new Error('expected');}),/expected/);assert.equal(draws,2);
 batch.draw();assert.equal(draws,3);batch.run(()=>{});assert.equal(draws,3);
});
