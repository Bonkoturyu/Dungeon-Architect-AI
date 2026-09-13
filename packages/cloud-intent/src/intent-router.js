import { parseFallbackIntent } from "../../intent/src/fallback-parser.js";
import { validateDesignIntent } from "../../intent/src/design-intent.js";

export const ROUTING_OUTCOMES = Object.freeze([
  "valid",
  "invalid",
  "timeout",
  "unavailable",
  "cancelled"
]);

export const DEFAULT_INTENT_ATTEMPT_TIMEOUT_MS = 15000;
export const DEFAULT_MAX_RETRY_DELAY_MS = 5000;
export const MAX_LLM_ATTEMPTS = 2;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nonEmptyPrompt(prompt) {
  const value = String(prompt ?? "").trim();
  if (!value) throw new TypeError("prompt must be a non-empty string");
  return value;
}

function normalizeCapabilities(input = {}) {
  return {
    cloudConfigured: input.cloudConfigured === true,
    cloudProxyHealthy: input.cloudProxyHealthy === true,
    localModelCached: input.localModelCached === true,
    webgpuAvailable: input.webgpuAvailable === true
  };
}

function normalizePositiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function errorResult(code, message, extra = {}) {
  return { ok: false, error: { code, message, ...extra } };
}

function normalizeSuccessfulResult(result) {
  if (!result?.ok) return result;
  const validation = validateDesignIntent(result.intent);
  if (!validation.valid) {
    return errorResult(
      "ROUTER_INTENT_INVALID",
      "Intent source returned a value that failed the independent DesignIntent validator.",
      { category: "invalid" }
    );
  }
  return {
    ok: true,
    intent: clone(result.intent),
    meta: result.meta && typeof result.meta === "object" ? clone(result.meta) : null
  };
}

export function classifyIntentAttempt(result, { timedOut = false, externallyCancelled = false } = {}) {
  if (externallyCancelled) return { outcome: "cancelled", retryable: false };
  if (timedOut) return { outcome: "timeout", retryable: true };
  if (result?.ok === true) return { outcome: "valid", retryable: false };

  const code = result?.error?.code ?? "UNKNOWN_ATTEMPT_FAILURE";
  const category = result?.error?.category;
  if (ROUTING_OUTCOMES.includes(category)) {
    return {
      outcome: category,
      retryable: category === "invalid" || category === "timeout" || category === "unavailable"
    };
  }

  if (["PROVIDER_ABORTED", "LOCAL_CANCELLED", "ROUTER_CANCELLED"].includes(code)) {
    return { outcome: "cancelled", retryable: false };
  }

  if ([
    "PROVIDER_INTENT_INVALID",
    "PROVIDER_OUTPUT_NOT_JSON",
    "PROVIDER_OUTPUT_MISSING",
    "PROVIDER_RESPONSE_INVALID",
    "PROVIDER_RESPONSE_INCOMPLETE",
    "ROUTER_INTENT_INVALID",
    "LOCAL_INTENT_INVALID"
  ].includes(code)) {
    return { outcome: "invalid", retryable: true };
  }

  if (code === "PROVIDER_REFUSAL") {
    return { outcome: "unavailable", retryable: false };
  }

  if (code === "PROVIDER_RATE_LIMITED") {
    return { outcome: "unavailable", retryable: true };
  }

  if (["PROVIDER_TRANSPORT_ERROR", "PROVIDER_TRANSPORT_INVALID", "LOCAL_UNAVAILABLE"].includes(code)) {
    return { outcome: "unavailable", retryable: true };
  }

  if (code === "PROVIDER_HTTP_ERROR") {
    const status = result?.error?.status;
    return {
      outcome: "unavailable",
      retryable: Number.isInteger(status) && status >= 500 && status <= 599
    };
  }

  if (code === "LOCAL_TIMEOUT") return { outcome: "timeout", retryable: true };
  return { outcome: "unavailable", retryable: false };
}

export function parseRetryAfterMs(value, { nowMs = Date.now() } = {}) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const milliseconds = Math.ceil(Number(trimmed) * 1000);
    return Number.isSafeInteger(milliseconds) && milliseconds >= 0 ? milliseconds : null;
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil(timestamp - nowMs));
}

function defaultWait(ms, { signal } = {}) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const abortError = new Error("wait aborted");
      abortError.name = "AbortError";
      reject(abortError);
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const abortError = new Error("wait aborted");
      abortError.name = "AbortError";
      reject(abortError);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function invokeAttempt(attemptFn, prompt, {
  attempt,
  provider,
  parentSignal,
  timeoutMs,
  now
}) {
  const controller = new AbortController();
  let timedOut = false;
  let externalAbort = false;
  const startedAt = now();

  const onParentAbort = () => {
    externalAbort = true;
    controller.abort(parentSignal?.reason);
  };
  if (parentSignal?.aborted) onParentAbort();
  else parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`${provider} attempt timed out`));
  }, timeoutMs);

  let raw;
  try {
    raw = await attemptFn(prompt, { attempt, signal: controller.signal });
  } catch (cause) {
    raw = errorResult(
      cause?.name === "AbortError" ? "PROVIDER_ABORTED" : "ROUTER_ATTEMPT_THROWN",
      cause?.name === "AbortError" ? "Intent attempt aborted." : "Intent attempt threw.",
      { category: cause?.name === "AbortError" ? undefined : "unavailable" }
    );
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }

  const result = normalizeSuccessfulResult(raw);
  return {
    result,
    timedOut,
    externallyCancelled: externalAbort || parentSignal?.aborted === true,
    durationMs: Math.max(0, now() - startedAt)
  };
}

function attemptTraceEntry(provider, attempt, invocation, classification) {
  const entry = {
    provider,
    attempt,
    outcome: classification.outcome,
    durationMs: invocation.durationMs,
    errorCode: invocation.result?.ok ? null : invocation.result?.error?.code ?? "UNKNOWN_ATTEMPT_FAILURE"
  };
  if (provider === "cloud" && invocation.result?.error?.retryAfter) {
    entry.retryAfter = String(invocation.result.error.retryAfter);
  }
  return entry;
}

function cancelledResult(attempts) {
  return { status: "cancelled", selectedProvider: null, intent: null, attempts: clone(attempts) };
}

async function runProvider(provider, attemptFn, prompt, {
  attempts,
  signal,
  timeoutMs,
  maxRetryDelayMs,
  wait,
  now
}) {
  for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) return { terminal: cancelledResult(attempts) };

    const invocation = await invokeAttempt(attemptFn, prompt, {
      attempt,
      provider,
      parentSignal: signal,
      timeoutMs,
      now
    });
    const classification = classifyIntentAttempt(invocation.result, invocation);
    const traceEntry = attemptTraceEntry(provider, attempt, invocation, classification);
    attempts.push(traceEntry);

    if (classification.outcome === "valid") {
      return {
        terminal: {
          status: "success",
          selectedProvider: provider,
          intent: clone(invocation.result.intent),
          meta: invocation.result.meta ? clone(invocation.result.meta) : null,
          attempts: clone(attempts)
        }
      };
    }

    if (classification.outcome === "cancelled") return { terminal: cancelledResult(attempts) };
    if (!classification.retryable || attempt >= MAX_LLM_ATTEMPTS) return { terminal: null };

    if (provider === "cloud" && invocation.result?.error?.code === "PROVIDER_RATE_LIMITED") {
      const retryDelayMs = parseRetryAfterMs(invocation.result.error.retryAfter, { nowMs: now() });
      if (retryDelayMs !== null) {
        traceEntry.retryDelayMs = retryDelayMs;
        if (retryDelayMs > maxRetryDelayMs) {
          traceEntry.retrySuppressed = "retry-after-exceeds-budget";
          return { terminal: null };
        }
        try {
          await wait(retryDelayMs, { signal });
        } catch (cause) {
          if (cause?.name === "AbortError" || signal?.aborted) return { terminal: cancelledResult(attempts) };
          traceEntry.retrySuppressed = "retry-wait-failed";
          return { terminal: null };
        }
      }
    }
  }

  return { terminal: null };
}

function defaultFallbackAttempt(prompt) {
  return { ok: true, intent: parseFallbackIntent(prompt), meta: { provider: "fallback" } };
}

export async function routeDesignIntent(prompt, {
  cloudAttempt,
  localAttempt,
  fallbackAttempt = defaultFallbackAttempt,
  capabilities,
  signal,
  attemptTimeoutMs = DEFAULT_INTENT_ATTEMPT_TIMEOUT_MS,
  maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
  wait = defaultWait,
  now = Date.now
} = {}) {
  const normalizedPrompt = nonEmptyPrompt(prompt);
  const normalizedCapabilities = normalizeCapabilities(capabilities);
  const timeoutMs = normalizePositiveInteger(
    attemptTimeoutMs,
    DEFAULT_INTENT_ATTEMPT_TIMEOUT_MS,
    "attemptTimeoutMs"
  );
  const retryBudgetMs = normalizePositiveInteger(
    maxRetryDelayMs,
    DEFAULT_MAX_RETRY_DELAY_MS,
    "maxRetryDelayMs"
  );
  if (typeof wait !== "function") throw new TypeError("wait must be a function");
  if (typeof now !== "function") throw new TypeError("now must be a function");

  const attempts = [];
  if (signal?.aborted) return cancelledResult(attempts);

  const canCloud =
    normalizedCapabilities.cloudConfigured &&
    normalizedCapabilities.cloudProxyHealthy &&
    typeof cloudAttempt === "function";

  if (canCloud) {
    const cloud = await runProvider("cloud", cloudAttempt, normalizedPrompt, {
      attempts,
      signal,
      timeoutMs,
      maxRetryDelayMs: retryBudgetMs,
      wait,
      now
    });
    if (cloud.terminal) return cloud.terminal;
  }

  const canLocal =
    normalizedCapabilities.localModelCached &&
    normalizedCapabilities.webgpuAvailable &&
    typeof localAttempt === "function";

  if (canLocal) {
    const local = await runProvider("local", localAttempt, normalizedPrompt, {
      attempts,
      signal,
      timeoutMs,
      maxRetryDelayMs: retryBudgetMs,
      wait,
      now
    });
    if (local.terminal) return local.terminal;
  }

  if (signal?.aborted) return cancelledResult(attempts);
  if (typeof fallbackAttempt !== "function") {
    return {
      status: "failed",
      selectedProvider: null,
      intent: null,
      attempts: clone(attempts),
      error: { code: "FALLBACK_UNAVAILABLE", message: "No deterministic fallback is available." }
    };
  }

  const fallbackInvocation = await invokeAttempt(fallbackAttempt, normalizedPrompt, {
    attempt: 1,
    provider: "fallback",
    parentSignal: signal,
    timeoutMs,
    now
  });
  const fallbackClassification = classifyIntentAttempt(fallbackInvocation.result, fallbackInvocation);
  attempts.push(attemptTraceEntry("fallback", 1, fallbackInvocation, fallbackClassification));

  if (fallbackClassification.outcome === "cancelled") return cancelledResult(attempts);
  if (fallbackClassification.outcome === "valid") {
    return {
      status: "success",
      selectedProvider: "fallback",
      intent: clone(fallbackInvocation.result.intent),
      meta: fallbackInvocation.result.meta ? clone(fallbackInvocation.result.meta) : null,
      attempts: clone(attempts)
    };
  }

  return {
    status: "failed",
    selectedProvider: null,
    intent: null,
    attempts: clone(attempts),
    error: {
      code: "FALLBACK_FAILED",
      message: "Deterministic fallback did not produce a valid DesignIntent."
    }
  };
}
