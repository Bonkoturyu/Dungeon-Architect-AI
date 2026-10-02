import {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  normalizeGeneratorVersion,
} from './generator-versions.js';
import { generateDungeonSpecV1 } from './versions/v1/dungeon-generator.js';
import { generateDungeonSpecV2 } from './versions/v2/dungeon-generator.js';

export {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  SUPPORTED_GENERATOR_VERSIONS,
} from './generator-versions.js';
export { generateDungeonSpecV1 } from './versions/v1/dungeon-generator.js';
export { generateDungeonSpecV2 } from './versions/v2/dungeon-generator.js';

export function generateDungeonSpec(options = {}) {
  const { version = DEFAULT_GENERATOR_VERSION, ...generationOptions } = options;
  switch (normalizeGeneratorVersion(version)) {
    case GENERATOR_VERSION_V1:
      return generateDungeonSpecV1(generationOptions);
    case GENERATOR_VERSION_V2:
      return generateDungeonSpecV2(generationOptions);
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}
