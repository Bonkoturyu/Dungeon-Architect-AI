import {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  normalizeGeneratorVersion,
} from './generator-versions.js';
import {
  deriveGenerationProfileV1,
  generateDungeonFromDesignIntentV1,
  seedFromPromptV1,
} from './versions/v1/design-intent-generator.js';

export {
  deriveGenerationProfileV1,
  generateDungeonFromDesignIntentV1,
  seedFromPromptV1,
} from './versions/v1/design-intent-generator.js';

export function seedFromPrompt(prompt, { version = DEFAULT_GENERATOR_VERSION } = {}) {
  switch (normalizeGeneratorVersion(version)) {
    case GENERATOR_VERSION_V1:
      return seedFromPromptV1(prompt);
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
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}

export function generateDungeonFromDesignIntent(intent, {
  version = DEFAULT_GENERATOR_VERSION,
  ...options
} = {}) {
  switch (normalizeGeneratorVersion(version)) {
    case GENERATOR_VERSION_V1:
      return generateDungeonFromDesignIntentV1(intent, options);
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}
