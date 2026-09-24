import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeClient, ClaudeError, assistantContentForHistory } from "../src/claude/client.js";
import { fakeFetch, sse, messageEvents } from "./fake-claude.js";
import { estimateCost } from "../src/claude/models.js";

const KEY = "sk-ant-api03-TESTKEY-abcdefghijklmnop";
const mk = (script, extra = {}) => {
  const f = fakeFetch(script);
  return { f, c: new ClaudeClient({ getApiKey: async () => KEY, fetchImpl: f, ...extra }) };
};
const req = { model: "claude-opus-5", system: "sys", messages: [{ role: "user", content: "hi" }], tools: [{ name: "t", description: "d", input_schema: { type: "object" }, eager_input_streaming: true }], effort: "high" };

test("streams Arabic text, thinking and tool input; builds a correct request", async () => {
  const { f, c } = mk([{ sse: sse(messageEvents([{ type: "thinking", thinking: "plan" }, { type: "text", text: "سأحلل الخامات أولاً" }, { type: "tool_use", id: "tu1", name: "t", input: { a: "لقطة", n: 2 } }])) }]);
  let text = "";
  const msg = await c.stream(req, { onText: (d) => (text += d) });
  assert.equal(text, "سأحلل الخامات أولاً");
  assert.equal(msg.stop_reason, "tool_use");
  assert.deepEqual(msg.content[2].input, { a: "لقطة", n: 2 });
  assert.equal(msg.content[0].signature, "sig123");
  const call = f.calls[0];
  assert.equal(call.headers["x-api-key"], KEY);
  assert.equal(call.headers["anthropic-version"], "2023-06-01");
  assert.match(call.headers["anthropic-beta"], /server-side-fallback-2026-07-01/);
  assert.deepEqual(call.body.thinking, { type: "adaptive", display: "summarized" });
  assert.deepEqual(call.body.output_config, { effort: "high" });
  assert.equal(call.body.fallbacks, "default");
  assert.equal(call.body.stream, true);
  assert.deepEqual(call.body.cache_control, { type: "ephemeral" });
  assert.equal(call.body.tools[0].eager_input_streaming, true);
  assert.ok(msg.usage.cost > 0);
});

test("haiku gets no thinking/effort; sonnet no fallbacks", () => {
  const { c } = mk([]);
  const h = c.buildRequest({ ...req, model: "claude-haiku-4-5" }).body;
  assert.equal(h.thinking, undefined);
  assert.equal(h.output_config, undefined);
  const s = c.buildRequest({ ...req, model: "claude-sonnet-5" });
  assert.equal(s.body.fallbacks, undefined);
  assert.equal(s.betas.length, 0);
});

test("retries overloaded (529) and honours retry-after; reports retry", async () => {
  const { c } = mk([{ status: 529, json: { error: { type: "overloaded_error", message: "Overloaded" } }, headers: { "retry-after": "0" } }, { sse: sse(messageEvents([{ type: "text", text: "ok" }])) }]);
  const retries = [];
  const msg = await c.stream(req, { onRetry: (r) => retries.push(r) });
  assert.equal(msg.content[0].text, "ok");
  assert.equal(retries.length, 1);
  assert.equal(retries[0].reason, "overloaded");
});

test("auth errors are not retried and never echo the key", async () => {
  const { f, c } = mk([{ status: 401, json: { error: { type: "authentication_error", message: `invalid x-api-key ${KEY}` } } }]);
  await assert.rejects(c.stream(req), (e) => e instanceof ClaudeError && e.kind === "auth" && !e.message.includes("TESTKEY"));
  assert.equal(f.calls.length, 1);
});

test("a dropped stream is re-requested cleanly", async () => {
  const good = sse(messageEvents([{ type: "text", text: "complete answer" }]));
  const { f, c } = mk([{ sse: good, breakAfter: 120 }, { sse: good }]);
  const msg = await c.stream(req, { onRetry: () => {} });
  assert.equal(msg.content[0].text, "complete answer");
  assert.equal(f.calls.length, 2);
});

test("invalid streamed tool JSON is flagged, not executed", async () => {
  const { c } = mk([{ sse: sse(messageEvents([{ type: "tool_use", id: "x", name: "t", rawJson: '{"a": "unterminated' }])) }]);
  const msg = await c.stream(req);
  assert.match(msg.toolInputErrors.x, /INVALID_JSON/);
});

test("fallbacks rejected by the account -> retried without them", async () => {
  const { f, c } = mk([{ status: 400, json: { error: { type: "invalid_request_error", message: "fallbacks: not enabled for this organization" } } }, { sse: sse(messageEvents([{ type: "text", text: "ok" }])) }]);
  await c.stream(req);
  assert.equal(f.calls[1].body.fallbacks, undefined);
});

test("abort cancels", async () => {
  const ac = new AbortController();
  ac.abort();
  const { c } = mk([{ sse: sse(messageEvents([{ type: "text", text: "x" }])) }]);
  await assert.rejects(c.stream(req, {}, ac.signal), (e) => e.kind === "aborted");
});

test("history echo after a mid-output fallback drops pre-fallback thinking/tool_use", () => {
  const out = assistantContentForHistory([{ type: "thinking", thinking: "", signature: "a" }, { type: "text", text: "partial" }, { type: "fallback", from: {}, to: {} }, { type: "thinking", thinking: "", signature: "b" }, { type: "text", text: "rest" }]);
  assert.deepEqual(out.map((b) => b.type), ["text", "thinking", "text"]);
});

test("test connection + cost estimate", async () => {
  const { c } = mk([{ json: { model: "claude-opus-5", stop_reason: "end_turn", content: [{ type: "text", text: "OK" }], usage: { input_tokens: 15, output_tokens: 2 } } }]);
  const r = await c.testConnection("claude-opus-5");
  assert.equal(r.text, "OK");
  assert.ok(Math.abs(estimateCost("claude-opus-5", { input_tokens: 1e6, output_tokens: 1e6 }) - 30) < 1e-9);
});
