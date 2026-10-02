const STRATEGY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export const GENERATOR_STRATEGY_API_VERSION = '1.0';

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function freezeJson(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) freezeJson(child);
  return Object.freeze(value);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function normalizeCapabilities(capabilities = {}) {
  assertPlainObject(capabilities, 'capabilities');
  return freezeJson({
    designIntent: capabilities.designIntent === true,
    directParameters: capabilities.directParameters === true,
    multiFloor: capabilities.multiFloor === true,
    tileOutput: capabilities.tileOutput === true,
    roomGraphOutput: capabilities.roomGraphOutput === true,
    deterministic: capabilities.deterministic !== false,
    ...cloneJson(capabilities),
  });
}

export function normalizeGeneratorRequest(request = {}) {
  assertPlainObject(request, 'request');

  const seed = request.seed;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('request.seed must be a non-negative safe integer');
  }

  const prompt =
    request.prompt == null ? '' : String(request.prompt);
  const id =
    request.id == null ? `generated-${seed}` : String(request.id);

  return freezeJson({
    apiVersion: GENERATOR_STRATEGY_API_VERSION,
    seed,
    id,
    prompt,
    intent: cloneJson(request.intent ?? null),
    constraints: cloneJson(request.constraints ?? {}),
    options: cloneJson(request.options ?? {}),
    context: cloneJson(request.context ?? {}),
  });
}

export function createGeneratorStrategy({
  id,
  displayName,
  description = '',
  family = 'custom',
  algorithmVersion = '1',
  capabilities = {},
  generate,
}) {
  if (typeof id !== 'string' || !STRATEGY_ID_PATTERN.test(id)) {
    throw new TypeError(
      'strategy id must match /^[a-z0-9][a-z0-9._-]*$/',
    );
  }
  if (typeof displayName !== 'string' || displayName.trim() === '') {
    throw new TypeError('strategy displayName is required');
  }
  if (typeof generate !== 'function') {
    throw new TypeError('strategy generate must be a function');
  }

  const metadata = freezeJson({
    id,
    displayName,
    description: String(description),
    family: String(family),
    algorithmVersion: String(algorithmVersion),
    apiVersion: GENERATOR_STRATEGY_API_VERSION,
    capabilities: normalizeCapabilities(capabilities),
  });

  return Object.freeze({
    ...metadata,
    async generate(request) {
      const normalizedRequest = normalizeGeneratorRequest(request);
      const raw = await generate(normalizedRequest);
      assertPlainObject(raw, `strategy ${id} result`);
      assertPlainObject(raw.spec, `strategy ${id} result.spec`);

      return freezeJson({
        spec: cloneJson(raw.spec),
        provenance: {
          apiVersion: GENERATOR_STRATEGY_API_VERSION,
          strategyId: id,
          strategyDisplayName: displayName,
          strategyFamily: family,
          algorithmVersion: String(algorithmVersion),
          seed: normalizedRequest.seed,
          ...(cloneJson(raw.provenance ?? {})),
        },
        diagnostics: cloneJson(raw.diagnostics ?? {}),
      });
    },
  });
}

export function createGeneratorStrategyRegistry(
  initialStrategies = [],
) {
  const strategies = new Map();

  function register(strategy) {
    assertPlainObject(strategy, 'strategy');
    if (typeof strategy.id !== 'string' || typeof strategy.generate !== 'function') {
      throw new TypeError('strategy must expose id and generate');
    }
    if (strategies.has(strategy.id)) {
      throw new Error(`generator strategy already registered: ${strategy.id}`);
    }
    strategies.set(strategy.id, strategy);
    return api;
  }

  function get(id) {
    const strategy = strategies.get(String(id));
    if (!strategy) {
      throw new RangeError(`Unknown generator strategy: ${id}`);
    }
    return strategy;
  }

  const api = Object.freeze({
    register,
    get,
    has: (id) => strategies.has(String(id)),
    list: () =>
      [...strategies.values()].map((strategy) =>
        freezeJson({
          id: strategy.id,
          displayName: strategy.displayName,
          description: strategy.description,
          family: strategy.family,
          algorithmVersion: strategy.algorithmVersion,
          apiVersion: strategy.apiVersion,
          capabilities: cloneJson(strategy.capabilities),
        })),
    generate: (id, request) => get(id).generate(request),
  });

  for (const strategy of initialStrategies) register(strategy);
  return api;
}
