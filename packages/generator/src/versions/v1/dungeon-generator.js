import { generateRoomGraph } from "./room-graph.js";
import { layoutRoomGraph } from "./layout.js";

export const GENERATOR_VERSION = "1";

export function generateDungeonSpecV1({
  seed,
  roomCount = 8,
  routeChoice = 0.5,
  id = `dungeon-${seed}`
} = {}) {
  const graph = generateRoomGraph({ seed, roomCount, routeChoice });
  const layout = layoutRoomGraph(graph);

  return {
    schemaVersion: "1.0",
    id,
    seed,
    rooms: layout.rooms,
    corridors: layout.corridors,
    entities: [
      { id: "start-1", type: "start", roomId: graph.startRoomId },
      { id: "goal-1", type: "goal", roomId: graph.goalRoomId }
    ],
    events: []
  };
}
