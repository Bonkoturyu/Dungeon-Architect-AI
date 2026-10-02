import { validateDungeonSpec } from "../../../../core/src/dungeon-spec.js";
import { validateDesignIntent } from "../../../../intent/src/design-intent.js";
import {
  deriveGenerationProfileV1,
  seedFromPromptV1,
} from "../v1/design-intent-generator.js";
import { createPrng, pickIndex } from "../v1/prng.js";
import { generateDungeonSpecV2 } from "./dungeon-generator.js";
import { deriveLayoutProfileV2 } from "./layout.js";

export function seedFromPromptV2(prompt) {
  return seedFromPromptV1(prompt);
}

export function deriveGenerationProfileV2(
  intent,
  { seed } = {},
) {
  const validation = validateDesignIntent(intent);
  if (!validation.valid) {
    throw new TypeError(
      `invalid DesignIntent: ${validation.errors
        .map((entry) => entry.code)
        .join(",")}`,
    );
  }

  const base = deriveGenerationProfileV1(intent, { seed });
  return Object.freeze({
    ...base,
    layout: deriveLayoutProfileV2({
      seed: base.seed,
      roomCount: base.roomCount,
    }),
  });
}

function pickInteriorRoomIds(spec, count, seed) {
  const candidates = spec.rooms
    .slice(1, -1)
    .map((room) => room.id);
  if (candidates.length === 0) {
    throw new Error("generated dungeon has no interior rooms");
  }
  const prng = createPrng(seed >>> 0);
  return Array.from(
    { length: count },
    () => candidates[pickIndex(prng, candidates.length)],
  );
}

function appendEntities(
  spec,
  type,
  count,
  seed,
  decorate = () => ({}),
) {
  const roomIds = pickInteriorRoomIds(spec, count, seed);
  for (let index = 0; index < roomIds.length; index += 1) {
    spec.entities.push({
      id: `${type}-${index + 1}`,
      type,
      roomId: roomIds[index],
      ...decorate(index),
    });
  }
}

export function generateDungeonFromDesignIntentV2(
  intent,
  {
    prompt,
    seed = seedFromPromptV2(prompt),
    id = `generated-${seed}`,
  } = {},
) {
  const profile = deriveGenerationProfileV2(intent, { seed });
  const spec = generateDungeonSpecV2({
    seed: profile.seed,
    roomCount: profile.roomCount,
    routeChoice: profile.routeChoice,
    id,
  });

  appendEntities(
    spec,
    "enemy",
    profile.enemyCount,
    seed ^ 0x11ee11ee,
    () => ({ initiallyActive: true }),
  );
  appendEntities(
    spec,
    "treasure",
    profile.treasureCount,
    seed ^ 0x22ee22ee,
    () => ({
      warning:
        intent.greedPunishment >= 0.6 ||
        intent.deception >= 0.6
          ? "suspicious-glow"
          : "none",
    }),
  );
  appendEntities(
    spec,
    "trap",
    profile.trapCount,
    seed ^ 0x33ee33ee,
    () => ({
      warning:
        intent.telegraphStrength >= 0.5
          ? "floor-cracks"
          : "subtle-draft",
    }),
  );
  if (profile.recoveryCount > 0) {
    appendEntities(
      spec,
      "recovery",
      profile.recoveryCount,
      seed ^ 0x44ee44ee,
    );
  }

  const firstTreasure = spec.entities.find(
    (entity) => entity.type === "treasure",
  );
  if (firstTreasure) {
    spec.events.push({
      id: "event-treasure-hint-1",
      trigger: {
        type: "on_open_treasure",
        entityId: firstTreasure.id,
      },
      conditions: [{ type: "one_shot" }],
      actions: [
        {
          type: "reveal_hint",
          hintId: "generated-treasure-hint",
        },
      ],
    });
  }

  const validation = validateDungeonSpec(spec);
  if (!validation.valid) {
    throw new Error(
      `generated DungeonSpec failed validation: ${validation.errors
        .map((entry) => entry.code)
        .join(",")}`,
    );
  }

  return {
    spec,
    profile: {
      ...profile,
      layout: { ...profile.layout },
    },
  };
}
