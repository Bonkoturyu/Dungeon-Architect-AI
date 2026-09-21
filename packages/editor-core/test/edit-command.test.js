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


test("move-entity rejects placing Start and Goal in the same room", () => {
  const original = fixture();
  const start = original.entities.find((entity) => entity.type === "start");
  const goal = original.entities.find((entity) => entity.type === "goal");
  const result = applyEditCommand(original, {
    type: "move-entity",
    entityId: start.id,
    roomId: goal.roomId,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "START_GOAL_SAME_ROOM");
});

test("resize-room changes any room dimensions and supports inverse", () => {
  const original = fixture();
  const room = original.rooms.at(-1);
  const result = applyEditCommand(original, {
    type: "resize-room",
    roomId: room.id,
    width: 13,
    depth: 9,
  });
  assert.equal(result.ok, true);
  assert.equal(result.spec.rooms.at(-1).width, 13);
  assert.equal(result.spec.rooms.at(-1).depth, 9);
  assert.deepEqual(result.inverse, {
    type: "resize-room",
    roomId: room.id,
    width: room.width,
    depth: room.depth,
  });

  const restored = applyEditCommand(result.spec, result.inverse);
  assert.equal(restored.ok, true);
  assert.equal(restored.spec.rooms.at(-1).width, room.width);
  assert.equal(restored.spec.rooms.at(-1).depth, room.depth);
});


test("resize-room rejects a size that overlaps another room", () => {
  const original = fixture();
  const middle = original.rooms[1];
  const result = applyEditCommand(original, {
    type: "resize-room",
    roomId: middle.id,
    width: 100,
    depth: 100,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "EDIT_RESULT_INVALID");
  assert.match(result.error.message, /ROOM_OVERLAP/);
});


test("room add/remove commands are undoable and preserve valid topology", () => {
  const original = fixture();
  const session = new EditSession(original);
  const room = { id: "room-editor-test", x: 72, z: 0, width: 8, depth: 8 };

  assert.equal(session.apply({ type: "add-room", room }).ok, true);
  assert.ok(session.spec.rooms.some((entry) => entry.id === room.id));

  assert.equal(session.undo().ok, true);
  assert.ok(!session.spec.rooms.some((entry) => entry.id === room.id));

  assert.equal(session.redo().ok, true);
  assert.ok(session.spec.rooms.some((entry) => entry.id === room.id));
});

test("remove-room removes non-protected contents and incident corridors when remaining Start→Goal stays valid", () => {
  const original = fixture();
  const removableRoom = {
    id: "side-room",
    x: 72,
    z: 12,
    width: 8,
    depth: 8,
  };
  original.rooms.push(removableRoom);
  original.corridors.push({
    id: "side-corridor",
    fromRoomId: original.rooms[1].id,
    toRoomId: removableRoom.id,
    width: 3,
    kind: "manual",
  });
  original.entities.push({
    id: "side-treasure",
    type: "treasure",
    roomId: removableRoom.id,
  });
  original.events.push({
    id: "side-event",
    trigger: { type: "on_open_treasure", entityId: "side-treasure" },
    conditions: [{ type: "one_shot" }],
    actions: [{ type: "reveal_hint", hintId: "side-hint" }],
  });

  const session = new EditSession(original);
  const removed = session.apply({ type: "remove-room", roomId: removableRoom.id });
  assert.equal(removed.ok, true);
  assert.ok(!session.spec.rooms.some((room) => room.id === removableRoom.id));
  assert.ok(!session.spec.corridors.some((corridor) => corridor.id === "side-corridor"));
  assert.ok(!session.spec.entities.some((entity) => entity.id === "side-treasure"));
  assert.ok(!session.spec.events.some((event) => event.id === "side-event"));

  assert.equal(session.undo().ok, true);
  assert.ok(session.spec.rooms.some((room) => room.id === removableRoom.id));
  assert.ok(session.spec.corridors.some((corridor) => corridor.id === "side-corridor"));
  assert.ok(session.spec.entities.some((entity) => entity.id === "side-treasure"));
  assert.ok(session.spec.events.some((event) => event.id === "side-event"));
});

test("remove-room refuses Start/Goal rooms", () => {
  const original = fixture();
  const startRoomId = original.entities.find((entity) => entity.type === "start").roomId;
  const result = applyEditCommand(original, { type: "remove-room", roomId: startRoomId });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PROTECTED_ROOM");
});

test("corridor add/remove and explicit doorway sides are undoable", () => {
  const original = fixture();
  const session = new EditSession(original);
  const corridor = {
    id: "manual-corridor",
    fromRoomId: original.rooms[0].id,
    toRoomId: original.rooms[2].id,
    width: 3,
    kind: "manual",
  };

  assert.equal(session.apply({ type: "add-corridor", corridor }).ok, true);
  assert.ok(session.spec.corridors.some((entry) => entry.id === corridor.id));

  assert.equal(session.apply({
    type: "set-corridor-doors",
    corridorId: corridor.id,
    fromSide: "north",
    toSide: "west",
  }).ok, true);
  let edited = session.spec.corridors.find((entry) => entry.id === corridor.id);
  assert.equal(edited.fromSide, "north");
  assert.equal(edited.toSide, "west");

  assert.equal(session.undo().ok, true);
  edited = session.spec.corridors.find((entry) => entry.id === corridor.id);
  assert.equal(edited.fromSide, undefined);
  assert.equal(edited.toSide, undefined);

  assert.equal(session.apply({
    type: "set-corridor-doors",
    corridorId: corridor.id,
    fromSide: "auto",
    toSide: "south",
  }).ok, true);
  edited = session.spec.corridors.find((entry) => entry.id === corridor.id);
  assert.equal(edited.fromSide, undefined);
  assert.equal(edited.toSide, "south");
});

test("corridor side edit rejects unsupported side identifiers", () => {
  const original = fixture();
  const corridorId = original.corridors[0].id;
  const result = applyEditCommand(original, {
    type: "set-corridor-doors",
    corridorId,
    fromSide: "up-left",
    toSide: "auto",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CORRIDOR_SIDE_INVALID");
});


test("reconnect-corridor changes endpoints atomically and supports undo/redo", () => {
  const original = fixture();
  const session = new EditSession(original);
  const corridor = {
    id: "rewire-test",
    fromRoomId: original.rooms[0].id,
    toRoomId: original.rooms[2].id,
    width: 3,
    kind: "manual",
  };
  assert.equal(session.apply({ type: "add-corridor", corridor }).ok, true);

  const targetRoom = original.rooms.at(-1);
  const result = session.apply({
    type: "reconnect-corridor",
    corridorId: corridor.id,
    fromRoomId: corridor.fromRoomId,
    toRoomId: targetRoom.id,
    fromSide: "east",
    toSide: "west",
  });

  assert.equal(result.ok, true);
  let edited = session.spec.corridors.find((entry) => entry.id === corridor.id);
  assert.equal(edited.fromRoomId, corridor.fromRoomId);
  assert.equal(edited.toRoomId, targetRoom.id);
  assert.equal(edited.fromSide, "east");
  assert.equal(edited.toSide, "west");

  assert.equal(session.undo().ok, true);
  edited = session.spec.corridors.find((entry) => entry.id === corridor.id);
  assert.equal(edited.fromRoomId, corridor.fromRoomId);
  assert.equal(edited.toRoomId, corridor.toRoomId);
  assert.equal(edited.fromSide, undefined);
  assert.equal(edited.toSide, undefined);

  assert.equal(session.redo().ok, true);
  edited = session.spec.corridors.find((entry) => entry.id === corridor.id);
  assert.equal(edited.toRoomId, targetRoom.id);
  assert.equal(edited.fromSide, "east");
  assert.equal(edited.toSide, "west");
});

test("reconnect-corridor rejects identical endpoint rooms", () => {
  const original = fixture();
  const corridor = original.corridors[0];
  const result = applyEditCommand(original, {
    type: "reconnect-corridor",
    corridorId: corridor.id,
    fromRoomId: corridor.fromRoomId,
    toRoomId: corridor.fromRoomId,
    fromSide: "east",
    toSide: "west",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CORRIDOR_ROOMS_INVALID");
});
