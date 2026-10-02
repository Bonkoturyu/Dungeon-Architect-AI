import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import {
  generateDungeonFromDesignIntentV2,
} from '../versions/v2/design-intent-generator.js';

export const GENERATOR_STRATEGY_V2_RECOMMENDED_ID =
  'version-2-spatial';

export const generatorStrategyV2Recommended =
  createGeneratorStrategy({
    id: GENERATOR_STRATEGY_V2_RECOMMENDED_ID,
    displayName: 'Version 2 — Recommended',
    description:
      'Current recommended candidate: V1 gameplay graph semantics with seed-driven spatial composition and room-size variation.',
    family: 'versioned',
    algorithmVersion: '2',
    capabilities: {
      designIntent: true,
      directParameters: false,
      multiFloor: true,
      roomGraphOutput: true,
      deterministic: true,
    },
    generate(request) {
      if (!request.intent) {
        throw new TypeError('Version 2 strategy requires request.intent');
      }
      const result = generateDungeonFromDesignIntentV2(
        request.intent,
        {
          prompt: request.prompt,
          seed: request.seed,
          id: request.id,
        },
      );
      return {
        spec: result.spec,
        provenance: {
          generatorVersion: '2',
          implementation: 'generator/versions/v2',
        },
        diagnostics: {
          profile: result.profile,
        },
      };
    },
  });
