import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import { generateDungeonFromDesignIntentV3 } from '../versions/v3/design-intent-generator.js';

export const GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID = 'version-3-special-rooms';

export const generatorStrategyV3SpecialRooms = createGeneratorStrategy({
  id: GENERATOR_STRATEGY_V3_SPECIAL_ROOMS_ID,
  displayName: 'Version 3 — Special Rooms',
  description: 'V2 spatial baseline with explicitly configured MonsterHouse, TrapHouse, and shop rooms.',
  family: 'versioned',
  algorithmVersion: '3',
  capabilities: {
    designIntent: true,
    directParameters: false,
    multiFloor: true,
    roomGraphOutput: true,
    deterministic: true,
    specialRooms: true,
  },
  generate(request) {
    if (!request.intent) throw new TypeError('Version 3 strategy requires request.intent');
    const result = generateDungeonFromDesignIntentV3(request.intent, {
      prompt: request.prompt,
      seed: request.seed,
      id: request.id,
      roomPlans: request.options.roomPlans,
      equipmentRules: request.options.equipmentRules,
      difficulty: request.options.difficulty,
      difficultyProfile: request.options.difficultyProfile,
      specialRoomEntityLimit: request.options.specialRoomEntityLimit,
      initialPlayerState: request.options.initialPlayerState,
    });
    return {
      spec: result.spec,
      provenance: { generatorVersion: '3', implementation: 'generator/versions/v3' },
      diagnostics: { profile: result.profile },
    };
  },
});
