export const GENERATOR_VERSION_V1 = "1";
export const GENERATOR_VERSION_V2 = "2";
export const GENERATOR_VERSION_V3 = "3";
export const DEFAULT_GENERATOR_VERSION = GENERATOR_VERSION_V1;
export const SUPPORTED_GENERATOR_VERSIONS = Object.freeze([
  GENERATOR_VERSION_V1,
  GENERATOR_VERSION_V2,
  GENERATOR_VERSION_V3,
]);

export function normalizeGeneratorVersion(version = DEFAULT_GENERATOR_VERSION) {
  const normalized = String(version ?? DEFAULT_GENERATOR_VERSION);
  if (!SUPPORTED_GENERATOR_VERSIONS.includes(normalized)) {
    throw new RangeError(
      `Unsupported generator version: ${normalized}. Supported: ${SUPPORTED_GENERATOR_VERSIONS.join(", ")}`
    );
  }
  return normalized;
}
