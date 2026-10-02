import {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V3,
  normalizeGeneratorVersion,
} from './generator-versions.js';
import { generateDungeonSpecV1 } from './versions/v1/dungeon-generator.js';
import { generateDungeonSpecV2 } from './versions/v2/dungeon-generator.js';
import { generateDungeonSpecV3 } from './versions/v3/dungeon-generator.js';

export {
  DEFAULT_GENERATOR_VERSION,
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V3,
  SUPPORTED_GENERATOR_VERSIONS,
} from './generator-versions.js';
export { generateDungeonSpecV1 } from './versions/v1/dungeon-generator.js';
export { generateDungeonSpecV2 } from './versions/v2/dungeon-generator.js';
export { generateDungeonSpecV3 } from './versions/v3/dungeon-generator.js';
export { DEFAULT_SPECIAL_ROOM_ENTITY_LIMIT, MAX_SPECIAL_ROOM_ENTITY_LIMIT } from './versions/v3/special-rooms.js';

export function generateDungeonSpec(options = {}) {
  const { version = DEFAULT_GENERATOR_VERSION, ...generationOptions } = options;
  switch (normalizeGeneratorVersion(version)) {
    case GENERATOR_VERSION_V1:
      return generateDungeonSpecV1(generationOptions);
    case GENERATOR_VERSION_V2:
      return generateDungeonSpecV2(generationOptions);
    case GENERATOR_VERSION_V3:
      return generateDungeonSpecV3(generationOptions);
    default:
      throw new RangeError(`Unsupported generator version: ${version}`);
  }
}
