export function layoutRoomGraph(graph, { columns = 4, spacing = 12, roomSize = 8 } = {}) {
  if (!graph || !Array.isArray(graph.rooms) || !Array.isArray(graph.edges)) {
    throw new TypeError("graph must contain rooms and edges arrays");
  }
  if (!Number.isInteger(columns) || columns < 2) {
    throw new RangeError("columns must be an integer >= 2");
  }

  const rooms = graph.rooms.map((room, index) => {
    const row = Math.floor(index / columns);
    const columnInRow = index % columns;
    const column = row % 2 === 0 ? columnInRow : columns - 1 - columnInRow;

    return {
      id: room.id,
      x: column * spacing,
      z: row * spacing,
      width: roomSize,
      depth: roomSize
    };
  });

  const corridors = graph.edges.map((edge, index) => ({
    id: `corridor-${String(index + 1).padStart(3, "0")}`,
    fromRoomId: edge.from,
    toRoomId: edge.to,
    width: 3,
    kind: edge.kind
  }));

  return { rooms, corridors };
}
