import test from "node:test";
import assert from "node:assert/strict";
import { generateDungeonSpec } from "../../generator/src/dungeon-generator.js";
import { applyEditCommand } from "../src/edit-command.js";
import { EditSession } from "../src/edit-session.js";

function fixture() {
  return generateDungeonSpec({ seed: 55, roomCount: 6, routeChoice: 0.5, id: "edit-fixture" });
}

test("move-room returns a new valid spec and inverse command", () => {
  const original = fixture();
  const oldX = original.rooms[0].x;
  const result = applyEditCommand(original, { type: "move-room", roomId: original.rooms[0].id, x: 99, z: 88 });
  assert.equal(result.ok, true);
  assert.equal(result.spec.rooms[0].x, 99);
  assert.equal(original.rooms[0].x, oldX);
  assert.deepEqual(result.inverse, { type: "move-room", roomId: original.rooms[0].id, x: oldX, z: original.rooms[0].z });
});

test("move-entity rejects an unknown room", () => {
  const original = fixture();
  const result = applyEditCommand(original, { type: "move-entity", entityId: "start-1", roomId: "missing" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "ROOM_NOT_FOUND");
});

test("add/remove entity round trip is supported", () => {
  const original = fixture();
  const add = applyEditCommand(original, {
    type: "add-entity",
    entity: { id: "treasure-new", type: "treasure", roomId: original.rooms[1].id }
  });
  assert.equal(add.ok, true);
  assert.ok(add.spec.entities.some((entity) => entity.id === "treasure-new"));

  const remove = applyEditCommand(add.spec, add.inverse);
  assert.equal(remove.ok, true);
  assert.ok(!remove.spec.entities.some((entity) => entity.id === "treasure-new"));
});

test("generic remove cannot delete Start or Goal", () => {
  const original = fixture();
  const result = applyEditCommand(original, { type: "remove-entity", entityId: "start-1" });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROTECTED_ENTITY_TYPE");
});

test("EditSession supports deterministic undo and redo", () => {
  const original = fixture();
  const session = new EditSession(original);
  const roomId = original.rooms[0].id;
  const old = { x: original.rooms[0].x, z: original.rooms[0].z };

  assert.equal(session.apply({ type: "move-room", roomId, x: 25, z: 30 }).ok, true);
  assert.equal(session.spec.rooms[0].x, 25);
  assert.equal(session.canUndo, true);

  assert.equal(session.undo().ok, true);
  assert.equal(session.spec.rooms[0].x, old.x);
  assert.equal(session.spec.rooms[0].z, old.z);
  assert.equal(session.canRedo, true);

  assert.equal(session.redo().ok, true);
  assert.equal(session.spec.rooms[0].x, 25);
  assert.equal(session.spec.rooms[0].z, 30);
});
