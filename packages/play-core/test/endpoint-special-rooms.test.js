import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDungeonSpecV3 } from '../../generator/src/dungeon-generator.js';
import { startPlaySession, movePlaySession, completePlayGoal, getGoalCompletionState } from '../src/play-session.js';
import { listRoomEnemies, resolveEnemyCombat } from '../src/enemy-runtime.js';
import { avoidTrap } from '../src/interaction-runtime.js';
import { purchaseShopOffer } from '../src/shop-runtime.js';
const plan = (targetRole, kind) => ({ id: targetRole, targetRole, kind, roomId: null, floorNumber: 1, entityCount: kind === 'shop' ? null : 1, offers: kind === 'shop' ? [{id:'armor', type:'armor', tier:1, price:0, stock:1}] : [] });
const spec = (roomPlans) => generateDungeonSpecV3({ seed:25, roomCount:3, routeChoice:0, enemyCount:0, trapCount:0, treasureCount:0, roomPlans });
function moveToGoal(session) { for (const id of ['room-002','room-003']) { const result=movePlaySession(session,id); assert.equal(result.ok,true); session=result.session; } return session; }

test('Start house activates immediately and blocks exit until resolved', () => {
  let session=startPlaySession(spec([plan('start','monster-house')])).session;
  assert.equal(listRoomEnemies(session).length,1); assert.equal(movePlaySession(session,'room-002').error.code,'SPECIAL_ROOM_BLOCKED');
  session=resolveEnemyCombat(session,listRoomEnemies(session)[0].enemy.id).session;
  assert.equal(movePlaySession(session,'room-002').ok,true);
});
test('Goal house cannot bypass enemies or traps through arrival or Finish', () => {
  for(const kind of ['monster-house','trap-house']) {
    let session=moveToGoal(startPlaySession(spec([plan('goal',kind)])).session);
    assert.equal(session.status,'playing'); assert.equal(getGoalCompletionState(session).blocked,true);
    assert.equal(completePlayGoal(session).error.code,'SPECIAL_ROOM_BLOCKED');
    const e=session.snapshot.entities.find(e=>e.roomId===session.goalRoomId&&e.type===(kind==='monster-house'?'enemy':'trap'));
    session=kind==='monster-house'?resolveEnemyCombat(session,e.id).session:avoidTrap(session,e.id).session;
    assert.equal(completePlayGoal(session).session.status,'cleared');
  }
});
test('Goal shop supports both no-purchase and purchase-then-finish; other shops never gate exit', () => {
  let session=moveToGoal(startPlaySession(spec([plan('goal','shop')])).session);
  assert.equal(session.playerState.gold,0); assert.equal(session.status,'playing'); assert.equal(completePlayGoal(session).session.status,'cleared');
  const shop=session.snapshot.entities.find(e=>e.type==='shop'); session=purchaseShopOffer(session,shop.id,'armor').session;
  assert.equal(session.playerState.equipment.armor.tier,1); assert.equal(completePlayGoal(session).session.status,'cleared');
  session=startPlaySession(spec([plan('start','shop')])).session; assert.equal(session.playerState.gold,0); assert.equal(movePlaySession(session,'room-002').ok,true);
  const ordinary=plan('goal','shop'); delete ordinary.targetRole; ordinary.roomId='room-002';
  session=startPlaySession(spec([ordinary])).session; session=movePlaySession(session,'room-002').session;
  assert.equal(movePlaySession(session,'room-003').session.status,'cleared');
});
