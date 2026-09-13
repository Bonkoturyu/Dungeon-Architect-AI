export const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

function assertApiKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new TypeError("OpenAI API key is required by the backend transport");
  }
}

function assertFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
}

export function createOpenAIHttpTransport({
  apiKey,
  endpoint = OPENAI_RESPONSES_ENDPOINT,
  fetchImpl = globalThis.fetch
} = {}) {
  assertApiKey(apiKey);
  assertFetch(fetchImpl);
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    throw new TypeError("OpenAI endpoint must be an https:// URL");
  }

  const secret = apiKey.trim();

  return async function openAIHttpTransport(request, { signal } = {}) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`
      },
      body: JSON.stringify(request),
      signal
    });

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return {
      ok: response.ok === true,
      status: Number.isInteger(response.status) ? response.status : 0,
      retryAfter: response.headers?.get?.("retry-after") ?? null,
      body
    };
  };
}
