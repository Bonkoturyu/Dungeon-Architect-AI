import {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  normalizeGeneratorVersion,
} from './generator-versions.js';
import {
  deriveGenerationProfileV1,
  generateDungeonFromDesignIntentV1,
  seedFromPromptV1,
} from './versions/v1/design-intent-generator.js';
export {
  deriveGenerationProfileV2,
  generateDungeonFromDesignIntentV2,
  seedFromPromptV2,
} from './versions/v2/design-intent-generator.js';
import {
  deriveGenerationProfileV2,
  generateDungeonFromDesignIntentV2,
  seedFromPromptV2,
} from './versions/v2/design-intent-generator.js';

export {
  deriveGenerationProfileV1,
  generateDungeonFromDesignIntentV1,
  seedFromPromptV1,
} from './versions/v1/design-intent-generator.js';

export function seedFromPrompt(prompt, { version = DEFAULT_GENERATOR_VERSION } = {}) {
  switch (normalizeGeneratorVersion(version)) {
    case GENERATOR_VERSION_V1:
      return seedFromPromptV1(prompt);
    case GENERATOR_VERSION_V2:
      return seedFromPromptV2(prompt);
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}

export function deriveGenerationProfile(intent, {
  version = DEFAULT_GENERATOR_VERSION,
  ...options
} = {}) {
  switch (normalizeGeneratorVersion(version)) {
    case GENERATOR_VERSION_V1:
      return deriveGenerationProfileV1(intent, options);
    case GENERATOR_VERSION_V2:
      return deriveGenerationProfileV2(intent, options);
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}

export function generateDungeonFromDesignIntent(intent, {
  version = DEFAULT_GENERATOR_VERSION,
  ...options
} = {}) {
  const normalizedVersion = normalizeGeneratorVersion(version);
  switch (normalizedVersion) {
    case GENERATOR_VERSION_V1:
      return {
        ...generateDungeonFromDesignIntentV1(intent, options),
        generatorVersion: normalizedVersion,
      };
    case GENERATOR_VERSION_V2:
      return {
        ...generateDungeonFromDesignIntentV2(intent, options),
        generatorVersion: normalizedVersion,
      };
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}
