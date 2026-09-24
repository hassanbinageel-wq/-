// End-to-end: scripted Claude (fake SSE) -> agent loop -> real tools ->
// SIMULATED Premiere. Verifies the full cycle the panel runs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMockPpro } from "../src/host/mock/ppro-mock.js";
import { PremiereHost } from "../src/host/premiere/adapter.js";
import { ClaudeClient } from "../src/claude/client.js";
import { Agent } from "../src/agent/agent.js";
import { createRegistry } from "../src/agent/tools/index.js";
import { makeContextFactory } from "../src/agent/context.js";
import { createNodeFs } from "../src/storage/fsio-node.js";
import { SettingsStore, ProjectMemory, SecretStore } from "../src/storage/store.js";
import { FootageIndex } from "../src/editing/footage-index.js";
import { Analyzer } from "../src/editing/analyzer.js";
import { fakeFetch, sse, messageEvents } from "./fake-claude.js";

const KEY = "sk-ant-api03-SECRET-agenttest-0123456789";

async function setup(script, { mode = "direct", confirm = true, transcriptText } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hsn-agent-"));
  const fsio = await createNodeFs(root);
  const mock = createMockPpro({
    writeFile: (p, b) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, b);
    },
    media: [
      { path: "/f/interview.mp4", name: "interview.mp4", duration: 60, transcript: { language: "en-us", speakers: [{ id: "a", name: "Sara" }], segments: [{ start: 2, duration: 5, speaker: "a", words: [{ start: 2, duration: 5, text: transcriptText || "We build everything by hand." }] }] } },
      { path: "/f/hands.mp4", name: "hands.mp4", duration: 20 },
      { path: "/f/music.wav", name: "music.wav", duration: 60, hasVideo: false },
    ],
    timeline: [
      { path: "/f/interview.mp4", track: 0, start: 0, in: 0, out: 20 },
      { path: "/f/hands.mp4", track: 0, start: 20, in: 0, out: 10 },
    ],
  });
  const host = new PremiereHost(mock.ppro);
  await host.init();
  const settings = await SettingsStore.open(fsio);
  await settings.set({ executionMode: mode, consent: { frames: true, transcripts: true, audioFeatures: true, reference: true, attachments: true } });
  const memory = await ProjectMemory.open(fsio, "Demo");
  const index = await FootageIndex.open(fsio, memory.dir);
  const helper = { available: false, status: { state: "offline", tools: {} } };
  const analyzer = new Analyzer({ host, index, helper, fsio, settings: settings.data });
  const shown = [];
  const confirms = [];
  const ui = { confirm: async (c) => (confirms.push(c), confirm), showPlan: (p) => shown.push(p), askConsent: async () => true, progress: () => {} };
  const secrets = SecretStore.memory();
  await secrets.setApiKey(KEY);
  const f = fakeFetch(script);
  const client = new ClaudeClient({ getApiKey: () => secrets.getApiKey(), fetchImpl: f });
  const agent = new Agent({ client, registry: createRegistry(), settings, makeContext: makeContextFactory({ host, analyzer, index, memory, settings, helper, fsio, ui }) });
  const events = [];
  for (const e of ["text", "tool_start", "tool_end", "notice", "usage"]) agent.on(e, (x) => events.push([e, x]));
  return { root, host, mock, agent, f, memory, settings, shown, confirms, events, index };
}

const reply = (blocks, opts) => ({ sse: sse(messageEvents(blocks, opts)) });

function plan(idInterview, idHands) {
  return {
    title: "Handmade — doc cut",
    intent: { goal: "short documentary", target_duration_s: 8 },
    style_id: "documentary",
    assumptions: ["16:9 web", "≈8 s"],
    events: [
      { id: "e1", role: "b_roll", section: "open", source: idHands, src_in: 1, src_out: 3 },
      { id: "e2", role: "a_roll", section: "voice", source: idInterview, src_in: 2, src_out: 7, quote: "We build everything by hand.", audio_lead_s: 0.5 },
      { id: "e3", role: "b_roll", source: idHands, src_in: 12, src_out: 14, with: "e2", offset_s: 1 },
    ],
  };
}

test("full cycle: read timeline → analyze → plan → execute into a new sequence → verify", async () => {
  const s = await setup([]);
  const items = await s.host.projectItems({ includeSequences: false });
  const idI = items.find((i) => i.name === "interview.mp4").id;
  const idH = items.find((i) => i.name === "hands.mp4").id;
  const script = [
    reply([{ type: "thinking", thinking: "look first" }, { type: "tool_use", id: "t1", name: "get_timeline_state", input: {} }]),
    reply([{ type: "tool_use", id: "t2", name: "analyze_footage", input: { frames_per_clip: 2 } }]),
    reply([{ type: "tool_use", id: "t3", name: "record_shot_notes", input: { media_id: idH, notes: [{ start: 0, end: 10, description: "close-up of hands holding the product", shot_type: "CU", tags: ["يد", "منتج", "hands"], confidence: 0.8 }] } }]),
    reply([{ type: "tool_use", id: "t4", name: "search_footage", input: { query: "اليد وهي تمسك المنتج" } }]),
    reply([{ type: "tool_use", id: "t5", name: "propose_edit_plan", input: { plan: plan(idI, idH) } }]),
    reply([{ type: "text", text: "تم إنشاء نسخة وثائقية جديدة." }]),
  ];
  const f = fakeFetch(script);
  s.agent.client.fetch = f;
  await s.agent.send("هذه كل الخامات الموجودة على التايم لاين أبغاك تشوفها وتمنتجها بأسلوب وثائقي");
  const ends = s.events.filter(([e]) => e === "tool_end").map(([, x]) => x);
  assert.deepEqual(ends.map((e) => [e.name, e.ok]), [["get_timeline_state", true], ["analyze_footage", true], ["record_shot_notes", true], ["search_footage", true], ["propose_edit_plan", true]]);
  assert.ok(ends[1].images >= 2, "frames were sent as images");
  assert.match(ends[3].text, /hands holding the product/);
  const seqs = await s.host.listSequences();
  const v = seqs.find((x) => /HSN v1/.test(x.name));
  assert.ok(v, "new version sequence created");
  const tl = await s.host.readTimeline(v.id);
  assert.equal(tl.tracks.video.flatMap((t) => t.items).length, 3);
  assert.ok(/Verified \d+ placed clip\(s\): all at the planned frames/.test(ends[4].text), ends[4].text);
  // History is valid: alternating roles, tool results answer tool uses
  const h = s.agent.history;
  for (let i = 1; i < h.length; i++) assert.notEqual(h[i].role, h[i - 1].role);
  assert.equal(h[1].content[0].type, "thinking", "thinking block echoed unchanged");
  // Request 2 carried tool_result for t1 with untrusted wrapper
  const r2 = f.calls[1].body.messages.at(-1).content[0];
  assert.equal(r2.type, "tool_result");
  assert.match(r2.content[0].text, /<untrusted_media_data>/);
  assert.equal(s.memory.data.versions.length, 1);
  // no secret on disk
  const dump = fs.readdirSync(s.root, { recursive: true }).filter((p) => p.endsWith(".json")).map((p) => fs.readFileSync(path.join(s.root, p), "utf8")).join("");
  assert.ok(!dump.includes("SECRET"), "API key never written to plain files");
});

test("preview mode: plan card waits for approval; re-execution never duplicates", async () => {
  const s = await setup([], { mode: "preview" });
  const items = await s.host.projectItems({ includeSequences: false });
  const p = plan(items.find((i) => i.name === "interview.mp4").id, items.find((i) => i.name === "hands.mp4").id);
  s.agent.client.fetch = fakeFetch([
    reply([{ type: "tool_use", id: "a1", name: "propose_edit_plan", input: { plan: p } }]),
    reply([{ type: "text", text: "Here is the plan." }]),
  ]);
  const before = (await s.host.listSequences()).length;
  await s.agent.send("make a documentary");
  assert.equal(s.shown.length, 1, "plan card shown");
  assert.equal((await s.host.listSequences()).length, before, "nothing executed yet");
  const planId = s.shown[0].id;
  s.agent.client.fetch = fakeFetch([
    reply([{ type: "tool_use", id: "b1", name: "execute_plan", input: { plan_id: planId } }]),
    reply([{ type: "tool_use", id: "b2", name: "execute_plan", input: { plan_id: planId } }]),
    reply([{ type: "text", text: "Done." }]),
  ]);
  await s.agent.send("نفذ");
  assert.equal(s.confirms.length, 1, "asked once, approval remembered");
  assert.equal((await s.host.listSequences()).length, before + 1, "exactly one new sequence");
  const last = s.events.filter(([e]) => e === "tool_end").at(-1)[1];
  assert.match(last.text, /Already executed/);
});

test("fabricated quote is rejected before anything is executed", async () => {
  const s = await setup([], { transcriptText: "We buy parts from suppliers." });
  const items = await s.host.projectItems({ includeSequences: false });
  const p = plan(items.find((i) => i.name === "interview.mp4").id, items.find((i) => i.name === "hands.mp4").id);
  s.agent.client.fetch = fakeFetch([reply([{ type: "tool_use", id: "q", name: "propose_edit_plan", input: { plan: p } }]), reply([{ type: "text", text: "fixing" }])]);
  const n = (await s.host.listSequences()).length;
  await s.agent.send("go");
  const end = s.events.find(([e, x]) => e === "tool_end" && x.name === "propose_edit_plan")[1];
  assert.equal(end.ok, false);
  assert.match(end.text, /not spoken/);
  assert.equal((await s.host.listSequences()).length, n);
});

test("direct edits make a restore point; stop halts remaining tools", async () => {
  const s = await setup([]);
  s.agent.client.fetch = fakeFetch([
    reply([{ type: "tool_use", id: "e1", name: "edit_timeline", input: { operations: [{ op: "trim", key: "V1:0.000", end: 12 }, { op: "move", key: "V1:20.000", to: 12 }] } }, { type: "tool_use", id: "e2", name: "check_timeline", input: {} }]),
    reply([{ type: "text", text: "Trimmed." }]),
  ]);
  s.agent.on("tool_end", (x) => x.name === "edit_timeline" && s.agent.stop());
  await s.agent.send("خل أول لقطة أقصر");
  const tl = await s.host.readTimeline();
  assert.equal(tl.tracks.video[0].items[1].start, 12 * 254016000000);
  assert.equal(s.memory.data.restorePoints.length, 1);
  assert.ok((await s.host.listSequences()).some((x) => /HSN restore/.test(x.name)));
  const ends = s.events.filter(([e]) => e === "tool_end").map(([, x]) => x.name);
  assert.deepEqual(ends, ["edit_timeline"], "second tool not run after Stop");
  assert.equal(s.agent.history.at(-1).content.length, 2, "both tool_use ids answered");
});

test("timeline changed by the user between turns is flagged to Claude", async () => {
  const s = await setup([]);
  s.agent.client.fetch = fakeFetch([reply([{ type: "text", text: "ok" }]), reply([{ type: "text", text: "ok" }])]);
  await s.agent.send("hello");
  // user edits in Premiere
  const seq = await s.mock.project.getActiveSequence();
  seq.video[0].items[0].end -= 254016000000;
  seq.video[0].items[0].outPoint -= 254016000000;
  await s.agent.send("again");
  const lastUser = s.agent.history.filter((m) => m.role === "user").at(-1);
  assert.match(lastUser.content[0].text, /timeline changed since you last saw it/);
});

test("invalid tool input is returned as an error, not executed", async () => {
  const s = await setup([]);
  s.agent.client.fetch = fakeFetch([reply([{ type: "tool_use", id: "z", name: "edit_timeline", input: { operations: [{ op: "explode" }] } }]), reply([{ type: "text", text: "sorry" }])]);
  await s.agent.send("x");
  const end = s.events.find(([e]) => e === "tool_end")[1];
  assert.equal(end.ok, false);
  assert.match(end.text, /must be one of/);
});
