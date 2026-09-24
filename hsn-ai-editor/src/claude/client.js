// Claude Messages API client for the UXP runtime.
//
// Why raw HTTP instead of @anthropic-ai/sdk: the panel runs inside Adobe
// UXP, which is not a browser or Node runtime. Adobe's network recipe
// documents that TextDecoder is unavailable there, and the SDK's streaming
// path depends on it. This client uses only fetch + ReadableStream.getReader
// (both documented UXP globals) plus our own UTF-8 decoder. The local helper
// (Node) is not required for chatting.

import { SSEParser } from "./sse.js";
import { Utf8StreamDecoder } from "../core/utf8.js";
import { sleep, abortError, redactSecrets } from "../core/util.js";
import { modelRequestFields, estimateCost } from "./models.js";

export const API_BASE = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export class ClaudeError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = "ClaudeError";
    this.kind = kind; // auth | permission | not_found | invalid_request | rate_limit | overloaded | server | network | aborted | stream_interrupted | refusal | too_large
    Object.assign(this, extra);
  }
  get retryable() {
    return ["rate_limit", "overloaded", "server", "network", "stream_interrupted"].includes(this.kind);
  }
}

function kindForStatus(status) {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 413) return "too_large";
  if (status === 429) return "rate_limit";
  if (status === 529) return "overloaded";
  if (status >= 500) return "server";
  return "invalid_request";
}

export class ClaudeClient {
  /**
   * @param {object} opts
   * @param {() => Promise<string>} opts.getApiKey
   * @param {typeof fetch} [opts.fetchImpl]
   * @param {string} [opts.baseUrl]
   */
  constructor({ getApiKey, fetchImpl, baseUrl = API_BASE, maxRetries = 3, log = () => {} }) {
    this.getApiKey = getApiKey;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.maxRetries = maxRetries;
    this.log = log;
    this.fallbacksUnsupported = false;
  }

  async headers(betas = []) {
    const key = await this.getApiKey();
    if (!key) throw new ClaudeError("auth", "No Anthropic API key saved. Add one in Settings → Claude connection.");
    const h = {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    };
    if (betas.length) h["anthropic-beta"] = [...new Set(betas)].join(",");
    return h;
  }

  /** Build the request body for a model, adding thinking/effort/fallback fields. */
  buildRequest({ model, system, messages, tools, maxTokens = 32000, effort, showThinking = true, cache = true, betas = [] }) {
    const { body: extra, betas: modelBetas } = modelRequestFields(model, {
      effort,
      showThinking,
      fallbacks: !this.fallbacksUnsupported,
    });
    const body = { model, max_tokens: maxTokens, stream: true, messages, ...extra };
    if (system) body.system = system;
    if (tools && tools.length) body.tools = tools;
    if (cache) body.cache_control = { type: "ephemeral" };
    return { body, betas: [...betas, ...modelBetas] };
  }

  /**
   * Stream one Messages API call. Retries transient failures only while
   * nothing has been received for this attempt, so a retry never
   * duplicates visible output. Tool execution happens in the agent after
   * the message is complete, so a retry never duplicates edits either.
   */
  async stream(params, handlers = {}, signal) {
    let attempt = 0;
    for (;;) {
      if (signal?.aborted) throw new ClaudeError("aborted", "Request cancelled");
      const { body, betas } = this.buildRequest(params);
      try {
        return await this.streamOnce(body, betas, handlers, signal);
      } catch (err) {
        const e = err instanceof ClaudeError ? err : this.wrapNetworkError(err, signal);
        if (e.kind === "invalid_request" && /fallback/i.test(e.message) && !this.fallbacksUnsupported) {
          // Account or model does not accept server-side fallbacks: retry once without them.
          this.fallbacksUnsupported = true;
          this.log("warn", "Server-side fallbacks not accepted for this request; retrying without them.");
          continue;
        }
        if (!e.retryable || attempt >= this.maxRetries || e.partialOutput) throw e;
        attempt++;
        const wait = e.retryAfterMs ?? Math.min(20000, 1000 * 2 ** attempt + Math.random() * 400);
        handlers.onRetry?.({ attempt, wait, reason: e.kind, message: e.message });
        await sleep(wait, signal).catch(() => {
          throw new ClaudeError("aborted", "Request cancelled");
        });
      }
    }
  }

  wrapNetworkError(err, signal) {
    if (signal?.aborted || err?.name === "AbortError") return new ClaudeError("aborted", "Request cancelled");
    return new ClaudeError("network", `Network error: ${redactSecrets(err?.message || err)}`);
  }

  async streamOnce(body, betas, handlers, signal) {
    const res = await this.fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: await this.headers(betas),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await this.httpError(res);

    const asm = new MessageAssembler(handlers);
    const parser = new SSEParser((ev) => asm.handle(ev));
    const decoder = new Utf8StreamDecoder();
    try {
      if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        for (;;) {
          if (signal?.aborted) {
            try { reader.cancel(); } catch { /* ignore */ }
            throw abortError();
          }
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(typeof value === "string" ? value : decoder.decode(value instanceof Uint8Array ? value : new Uint8Array(value)));
        }
        parser.push(decoder.flush());
      } else {
        // Runtime without streaming bodies: still correct, just not incremental.
        parser.push(await res.text());
      }
      parser.end();
    } catch (err) {
      if (err instanceof ClaudeError) throw err;
      if (signal?.aborted || err?.name === "AbortError") throw new ClaudeError("aborted", "Request cancelled", { partialOutput: asm.receivedAny });
      throw new ClaudeError("stream_interrupted", `Connection dropped mid-response: ${err?.message || err}`, {
        partialOutput: false, // nothing was acted on; safe to re-request the whole turn
      });
    }
    const msg = asm.finish();
    msg.usage = msg.usage || {};
    msg.usage.cost = estimateCost(msg.model || body.model, msg.usage);
    return msg;
  }

  async httpError(res) {
    let text = "";
    try {
      text = await res.text();
    } catch { /* ignore */ }
    let message = text;
    try {
      const j = JSON.parse(text);
      message = j?.error?.message || text;
    } catch { /* not json */ }
    const ra = res.headers?.get?.("retry-after");
    const retryAfterMs = ra && !isNaN(Number(ra)) ? Number(ra) * 1000 : undefined;
    return new ClaudeError(kindForStatus(res.status), `HTTP ${res.status}: ${redactSecrets(message).slice(0, 600)}`, {
      status: res.status,
      retryAfterMs,
    });
  }

  /** Cheap round-trip used by the "Test connection" button. */
  async testConnection(model, signal) {
    const t0 = Date.now();
    const res = await this.fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify({ model, max_tokens: 64, messages: [{ role: "user", content: "Reply with the single word OK." }] }),
      signal,
    });
    if (!res.ok) throw await this.httpError(res);
    const j = await res.json();
    return {
      ok: true,
      latencyMs: Date.now() - t0,
      model: j.model,
      stopReason: j.stop_reason,
      text: (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join(""),
      usage: j.usage,
      cost: estimateCost(j.model || model, j.usage),
    };
  }

  async listModels(signal) {
    const res = await this.fetch(`${this.baseUrl}/v1/models?limit=100`, { headers: await this.headers(), signal });
    if (!res.ok) throw await this.httpError(res);
    const j = await res.json();
    return (j.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id, maxInput: m.max_input_tokens, maxOutput: m.max_tokens }));
  }
}

/** Reassembles a streamed message into content blocks. */
export class MessageAssembler {
  constructor(handlers = {}) {
    this.h = handlers;
    this.msg = { id: null, model: null, role: "assistant", content: [], stop_reason: null, stop_details: null, usage: {} };
    this.partial = {};
    this.toolInputErrors = {};
    this.receivedAny = false;
  }
  handle({ event, data }) {
    if (!data) return;
    let d;
    try {
      d = JSON.parse(data);
    } catch {
      return;
    }
    const type = d.type || event;
    this.receivedAny = true;
    switch (type) {
      case "message_start":
        Object.assign(this.msg, { id: d.message.id, model: d.message.model });
        this.msg.usage = { ...(d.message.usage || {}) };
        this.h.onStart?.(this.msg);
        break;
      case "content_block_start": {
        const block = structuredCloneSafe(d.content_block);
        if (block.type === "tool_use") {
          this.partial[d.index] = "";
          block.input = {};
          this.h.onToolStart?.(block);
        }
        if (block.type === "fallback") this.h.onFallback?.(block);
        this.msg.content[d.index] = block;
        break;
      }
      case "content_block_delta": {
        const b = this.msg.content[d.index];
        const delta = d.delta || {};
        if (!b) break;
        if (delta.type === "text_delta") {
          b.text = (b.text || "") + delta.text;
          this.h.onText?.(delta.text, d.index);
        } else if (delta.type === "thinking_delta") {
          b.thinking = (b.thinking || "") + delta.thinking;
          this.h.onThinking?.(delta.thinking, d.index);
        } else if (delta.type === "signature_delta") {
          b.signature = (b.signature || "") + delta.signature;
        } else if (delta.type === "input_json_delta") {
          this.partial[d.index] = (this.partial[d.index] || "") + (delta.partial_json || "");
          this.h.onToolInputDelta?.(b, this.partial[d.index]);
        } else if (delta.type === "citations_delta") {
          (b.citations ||= []).push(delta.citation);
        }
        break;
      }
      case "content_block_stop": {
        const b = this.msg.content[d.index];
        if (b && b.type === "tool_use") {
          const raw = this.partial[d.index] || "";
          try {
            b.input = raw.trim() ? JSON.parse(raw) : {};
          } catch (e) {
            b.input = {};
            this.toolInputErrors[b.id] = `INVALID_JSON: the tool input could not be parsed (${e.message}). Re-issue the call with complete, valid JSON.`;
          }
          delete this.partial[d.index];
          this.h.onToolReady?.(b);
        }
        break;
      }
      case "message_delta":
        if (d.delta?.stop_reason) this.msg.stop_reason = d.delta.stop_reason;
        if (d.delta?.stop_details !== undefined) this.msg.stop_details = d.delta.stop_details;
        if (d.usage) Object.assign(this.msg.usage, d.usage);
        break;
      case "message_stop":
        break;
      case "error": {
        const et = d.error?.type || "server";
        const kind = et === "overloaded_error" ? "overloaded" : et === "rate_limit_error" ? "rate_limit" : et === "invalid_request_error" ? "invalid_request" : "server";
        throw new ClaudeError(kind, `Stream error: ${d.error?.message || et}`, { partialOutput: false });
      }
      default:
        break;
    }
  }
  finish() {
    this.msg.content = this.msg.content.filter(Boolean);
    if (!this.msg.stop_reason) {
      throw new ClaudeError("stream_interrupted", "The response ended before completion.", { partialOutput: false });
    }
    this.msg.toolInputErrors = this.toolInputErrors;
    return this.msg;
  }
}

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}

/**
 * Content to send back as the assistant turn. Blocks are echoed unchanged
 * (thinking blocks must be passed back as produced). After a mid-output
 * server-side fallback, blocks before the last `fallback` marker that the
 * API says to omit (thinking, redacted_thinking, tool_use) are dropped.
 */
export function assistantContentForHistory(content) {
  const lastFb = content.map((b) => b.type).lastIndexOf("fallback");
  return content.filter((b, i) => {
    if (b.type === "fallback") return false;
    if (i < lastFb && ["thinking", "redacted_thinking", "tool_use", "server_tool_use"].includes(b.type)) return false;
    return true;
  });
}
