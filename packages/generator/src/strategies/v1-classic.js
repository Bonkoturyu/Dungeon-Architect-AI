import { createGeneratorStrategy } from '../../../generator-strategy-core/src/index.js';
import {
  generateDungeonFromDesignIntentV1,
} from '../versions/v1/design-intent-generator.js';

export const GENERATOR_STRATEGY_V1_CLASSIC_ID = 'version-1-classic';

export const generatorStrategyV1Classic = createGeneratorStrategy({
  id: GENERATOR_STRATEGY_V1_CLASSIC_ID,
  displayName: 'Version 1 — Classic',
  description:
    'Frozen graph-first constructive generator with sequential backbone and serpentine spatial embedding.',
  family: 'versioned',
  algorithmVersion: '1',
  capabilities: {
    designIntent: true,
    directParameters: false,
    multiFloor: true,
    roomGraphOutput: true,
    deterministic: true,
  },
  generate(request) {
    if (!request.intent) {
      throw new TypeError('Version 1 strategy requires request.intent');
    }
    const result = generateDungeonFromDesignIntentV1(
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
        generatorVersion: '1',
        implementation: 'generator/versions/v1',
      },
      diagnostics: {
        profile: result.profile,
      },
    };
  },
});
