// Model catalog. Prices are USD per million tokens from Anthropic's
// published price list (cached 2026-06-24 in the Claude API reference);
// they are used only for the on-screen *estimate* — the Anthropic Console
// is the source of truth for billing. The panel can also refresh the list
// of available model IDs live from GET /v1/models.

export const DEFAULT_MODEL = "claude-opus-5";

export const MODELS = [
  {
    id: "claude-opus-5",
    label: "Claude Opus 5 (default)",
    input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25,
    thinking: "adaptive", effort: true, fallbacks: true, vision: true, maxOutput: 128000,
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5,
    thinking: "adaptive", effort: true, fallbacks: false, vision: true, maxOutput: 128000,
    note: "Effort default is medium on this model; the panel sends the chosen effort explicitly.",
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1 (most capable, premium price)",
    input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5,
    thinking: "always", effort: true, fallbacks: true, vision: true, maxOutput: 128000,
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5 (faster, cheaper)",
    input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5,
    thinking: "adaptive", effort: true, fallbacks: false, vision: true, maxOutput: 128000,
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 (fastest, lowest cost)",
    input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25,
    thinking: "none", effort: false, fallbacks: false, vision: true, maxOutput: 64000,
  },
];

export function getModel(id) {
  return (
    MODELS.find((m) => m.id === id) || {
      id,
      label: id,
      input: null, output: null, cacheRead: null, cacheWrite: null,
      thinking: "adaptive", effort: true, fallbacks: false, vision: true, maxOutput: 32000,
      unknown: true,
    }
  );
}

/**
 * Build model-specific request fields: thinking/effort/fallbacks.
 * Rules (Claude API reference): Opus 5 / Sonnet 5 / Opus 5.5 use
 * adaptive thinking; Fable 5.1 has thinking always on (omit the param);
 * Haiku 4.5 runs without thinking here. budget_tokens is not used.
 */
export function modelRequestFields(modelId, { effort = "high", showThinking = true, fallbacks = true } = {}) {
  const m = getModel(modelId);
  const body = {};
  const betas = [];
  if (m.thinking === "adaptive") {
    body.thinking = { type: "adaptive", ...(showThinking ? { display: "summarized" } : {}) };
  } else if (m.thinking === "always" && showThinking) {
    body.thinking = { type: "adaptive", display: "summarized" };
  }
  if (m.effort && effort) body.output_config = { effort };
  if (m.fallbacks && fallbacks) {
    body.fallbacks = "default";
    betas.push("server-side-fallback-2026-07-01");
  }
  return { body, betas };
}

/** Estimated cost in USD for a usage object, or null when prices are unknown. */
export function estimateCost(modelId, usage) {
  const m = getModel(modelId);
  if (!usage || m.input == null) return null;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cr = usage.cache_read_input_tokens || 0;
  const cw = usage.cache_creation_input_tokens || 0;
  return (inTok * m.input + outTok * m.output + cr * m.cacheRead + cw * m.cacheWrite) / 1e6;
}

export function addUsage(total, u) {
  const t = total || { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cost: 0 };
  if (!u) return t;
  t.input_tokens += u.input_tokens || 0;
  t.output_tokens += u.output_tokens || 0;
  t.cache_read_input_tokens += u.cache_read_input_tokens || 0;
  t.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
  if (u.cost != null) t.cost += u.cost;
  return t;
}
