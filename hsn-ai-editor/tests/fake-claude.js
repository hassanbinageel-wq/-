// A scripted fake of the Claude Messages API streaming endpoint (SSE), used
// to test the client and the agent loop without network access or cost.
import { encodeUtf8 } from "../src/core/utf8.js";

export function sse(events) {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

/** Build SSE events for an assistant message made of blocks. */
export function messageEvents(blocks, { stop = null, usage = { input_tokens: 1200, output_tokens: 300 }, model = "claude-opus-5" } = {}) {
  const ev = [{ type: "message_start", message: { id: `msg_${Math.random().toString(36).slice(2)}`, model, usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } }];
  blocks.forEach((b, i) => {
    if (b.type === "text") {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "text", text: "" } });
      for (const part of chunk(b.text, 7)) ev.push({ type: "content_block_delta", index: i, delta: { type: "text_delta", text: part } });
    } else if (b.type === "thinking") {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "thinking", thinking: "" } });
      ev.push({ type: "content_block_delta", index: i, delta: { type: "thinking_delta", thinking: b.thinking } });
      ev.push({ type: "content_block_delta", index: i, delta: { type: "signature_delta", signature: "sig123" } });
    } else if (b.type === "tool_use") {
      ev.push({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
      const json = b.rawJson ?? JSON.stringify(b.input);
      for (const part of chunk(json, 23)) ev.push({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: part } });
    }
    ev.push({ type: "content_block_stop", index: i });
  });
  const stopReason = stop || (blocks.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn");
  ev.push({ type: "message_delta", delta: { stop_reason: stopReason }, usage: { output_tokens: usage.output_tokens } });
  ev.push({ type: "message_stop" });
  return ev;
}

function chunk(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out.length ? out : [""];
}

/**
 * fetch() replacement. `script` is an array of responders; each gets the
 * parsed request body and returns {status, sse?, json?, headers?, breakAfter?}.
 */
export function fakeFetch(script) {
  const calls = [];
  let i = 0;
  const fn = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, headers: init.headers, body });
    const responder = script[Math.min(i++, script.length - 1)];
    const r = typeof responder === "function" ? responder(body, calls.length) : responder;
    const status = r.status || 200;
    const headers = new Map(Object.entries(r.headers || {}));
    const text = r.sse != null ? r.sse : JSON.stringify(r.json ?? {});
    const bytes = encodeUtf8(text);
    let pos = 0;
    const cut = r.breakAfter ?? Infinity;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
      json: async () => JSON.parse(text),
      text: async () => text,
      body: {
        getReader: () => ({
          read: async () => {
            if (init.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
            if (pos >= Math.min(bytes.length, cut)) {
              if (cut < bytes.length) throw new Error("socket hang up");
              return { done: true };
            }
            const n = Math.min(37, Math.min(bytes.length, cut) - pos);
            const value = bytes.subarray(pos, pos + n);
            pos += n;
            return { done: false, value };
          },
          cancel: () => {},
        }),
      },
    };
  };
  fn.calls = calls;
  return fn;
}
