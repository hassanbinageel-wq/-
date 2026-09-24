// Plan validation + execution against the SIMULATED Premiere module.
import test from "node:test";
import assert from "node:assert/strict";
import { demoProject, sec } from "./fixtures.js";
import { resolvePlan, compilePlan, summarizeResolved } from "../src/editing/plan.js";
import { getStyle } from "../src/editing/styles.js";
import { Executor, StopToken, memoryJournal } from "../src/executor/executor.js";
import { normalizePremiereTranscript } from "../src/host/premiere/adapter.js";

async function ctxFor(host) {
  const items = await host.projectItems({ includeSequences: false });
  const media = new Map();
  for (const e of items.filter((i) => i.kind === "clip")) {
    const d = await host.clipDetails(e);
    const hasVideo = !/\.wav$/.test(e.path);
    media.set(e.id, { id: e.id, path: e.path, name: e.name, duration_s: d.durationTicks / 254016000000, hasVideo, hasAudio: !/\.mogrt$/.test(e.path) });
  }
  const interview = [...media.values()].find((m) => m.name.startsWith("interview"));
  const tr = await host.transcript(interview.path);
  return { media, fps: 25, transcripts: new Map([[interview.id, tr]]), availableTransitions: await host.listTransitions(), idOf: (n) => [...media.values()].find((m) => m.name.startsWith(n)).id };
}

function docPlan(idOf) {
  return {
    title: "Craft — documentary cut",
    intent: { goal: "short doc", target_duration_s: 16, aspect: "16:9" },
    style_id: "documentary",
    events: [
      { id: "e1", role: "b_roll", section: "cold open", source: idOf("workshop"), src_in: 1, src_out: 4, reason: "atmosphere" },
      { id: "e2", role: "a_roll", section: "context", source: idOf("interview"), src_in: 2, src_out: 8, audio_lead_s: 1, quote: "We started with nothing.", transition_in: { name: "dissolve", duration_s: 0.5 } },
      { id: "e3", role: "b_roll", source: idOf("hands"), src_in: 3, src_out: 6, with: "e2", offset_s: 2 },
      { id: "e4", role: "a_roll", section: "idea", source: idOf("interview"), src_in: 40, src_out: 47, quote: "Craft is patience.", audio_tail_s: 1 },
      { id: "m1", role: "music", source: idOf("music"), src_in: 0, src_out: 16, gain_db: -6, fade_in_s: 1, fade_out_s: 2, duck_under: ["e2", "e4"], duck_db: 14 },
      { id: "t1", role: "title", title_text: "Craft", at: 0.5, duration_s: 2 },
    ],
  };
}

test("documentary plan validates, lays out J/L cuts and checkerboards overlapping dialogue", async () => {
  const { host } = demoProject();
  const ctx = await ctxFor(host);
  const r = resolvePlan(docPlan(ctx.idOf), { ...ctx, style: getStyle("documentary") });
  assert.deepEqual(r.errors, []);
  const e2 = r.events.find((e) => e.id === "e2");
  assert.equal(e2.start, sec(3));
  assert.equal(e2.audioStart, sec(2)); // J-cut: sound 1s before picture
  const e4 = r.events.find((e) => e.id === "e4");
  assert.equal(e4.start, sec(9));
  assert.equal(r.stats.duration_s, 17); // e4 L-cut tail ends at 17s
  assert.ok(summarizeResolved(r).includes("J-1.0s"));
  assert.ok(r.events.find((e) => e.id === "e2").transition, "dissolve kept (handles available)");
});

test("validator rejects fabricated quotes, bad ranges, overlaps and protected tracks", async () => {
  const { host } = demoProject();
  const ctx = await ctxFor(host);
  const plan = docPlan(ctx.idOf);
  plan.events[1].quote = "We were funded by a big company.";
  plan.events.push({ id: "bad1", role: "b_roll", source: ctx.idOf("hands"), src_in: 18, src_out: 25, at: 30 });
  plan.events.push({ id: "bad2", role: "b_roll", source: ctx.idOf("street"), src_in: 1, src_out: 3, at: 1, video_track: 2 });
  const r = resolvePlan(plan, { ...ctx, style: getStyle("documentary"), protected: { video: [], audio: [2] } });
  const all = r.errors.join("\n");
  assert.match(all, /not spoken/);
  assert.match(all, /beyond the media length/);
  assert.match(all, /overlaps/);
  assert.match(all, /A3 is protected/);
});

test("documentary ethics: reordered speech needs a splice note", async () => {
  const { host } = demoProject();
  const ctx = await ctxFor(host);
  const plan = { title: "x", events: [
    { id: "a", role: "a_roll", source: ctx.idOf("interview"), src_in: 40, src_out: 47 },
    { id: "b", role: "a_roll", source: ctx.idOf("interview"), src_in: 2, src_out: 8 },
  ] };
  assert.match(resolvePlan(plan, { ...ctx, style: getStyle("documentary") }).errors.join(), /out of its original order/);
  plan.events[1].splice_note = "Ending on the origin story is chronological context; meaning unchanged.";
  assert.equal(resolvePlan(plan, { ...ctx, style: getStyle("documentary") }).errors.length, 0);
});

test("pins and constraints are enforced", async () => {
  const { host } = demoProject();
  const ctx = await ctxFor(host);
  const plan = docPlan(ctx.idOf);
  const r = resolvePlan(plan, {
    ...ctx,
    pins: [{ label: "opening shot", eventId: "e1", source: ctx.idOf("workshop"), srcIn: sec(1), srcOut: sec(1.5), start: 0, keepPosition: true }],
    constraints: [{ kind: "no_speech_before", seconds: 10, label: "first 10 s without speech" }],
  });
  assert.match(r.errors.join(), /pinned part "opening shot" must keep its source range/);
  assert.match(r.errors.join(), /first 10 s without speech/);
});

test("execution builds a new sequence, verifies it, and never duplicates on re-request", async () => {
  const { host, world } = demoProject();
  await host.init();
  const ctx = await ctxFor(host);
  const r = resolvePlan(docPlan(ctx.idOf), { ...ctx, style: getStyle("documentary") });
  const src = (await host.listSequences())[0];
  const ops = compilePlan(r, { sequenceName: "Craft v1 — documentary", likeSeqId: src.id });
  const journal = memoryJournal();
  const progress = [];
  const ex = new Executor(host, { journal, onProgress: (p) => progress.push(p.status) });
  const rep = await ex.run({ ops, planHash: r.hash, resolved: r });
  assert.equal(rep.status, "done");
  assert.deepEqual(rep.verification.mismatches, []);
  assert.ok(rep.verification.checked >= 6);
  const tl = await host.readTimeline(rep.sequence.id);
  const music = tl.tracks.audio[2].items[0];
  assert.equal(music.end, sec(16));
  const vol = await host.findParam(music.key, { component: "Volume", param: "Level" });
  assert.ok(vol.param.getKeyframeListAsTickTimes().length >= 6, "fades + ducking keyframes");
  assert.ok(tl.markers.some((m) => m.name === "§ context"));
  assert.ok(tl.markers.some((m) => m.name.startsWith("TITLE:")));
  // original rough assembly untouched
  const orig = await host.readTimeline(src.id);
  assert.equal(orig.tracks.video[0].items.length, 2);
  const nSeq = (await host.listSequences()).length;
  const again = await ex.run({ ops, planHash: r.hash, resolved: r });
  assert.ok(again.alreadyExecuted || again.resumed);
  assert.equal((await host.listSequences()).length, nSeq, "no duplicate sequence");
  assert.ok(world.transactions.every((t) => t.label.startsWith("HSN AI:")), "every edit is a named undoable transaction");
});

test("stop at a safe boundary, resume later without redoing finished steps", async () => {
  const { host } = demoProject();
  const ctx = await ctxFor(host);
  const r = resolvePlan(docPlan(ctx.idOf), ctx);
  const src = (await host.listSequences())[0];
  const ops = compilePlan(r, { sequenceName: "Stop test", likeSeqId: src.id });
  const stop = new StopToken();
  let n = 0;
  const journal = memoryJournal();
  const ex = new Executor(host, { journal, onProgress: (p) => p.status === "done" && ++n === 3 && stop.stop() });
  const rep = await ex.run({ ops, planHash: r.hash, stop, resolved: r });
  assert.equal(rep.status, "stopped");
  assert.equal(rep.counts.done, 3);
  const ex2 = new Executor(host, { journal });
  const rep2 = await ex2.run({ ops, planHash: r.hash, resolved: r });
  assert.ok(rep2.resumed);
  assert.equal((await host.listSequences()).filter((s) => s.name === "Stop test").length, 1);
});

test("a failed step skips only what depends on it", async () => {
  const { host, world } = demoProject();
  const ctx = await ctxFor(host);
  const r = resolvePlan(docPlan(ctx.idOf), ctx);
  const src = (await host.listSequences())[0];
  const ops = compilePlan(r, { sequenceName: "Fail test", likeSeqId: src.id });
  world.failNext = (label) => /overwrite hands_product/.test(label);
  const rep = await new Executor(host).run({ ops, planHash: r.hash, resolved: r });
  assert.equal(rep.status, "partial");
  assert.ok(rep.failures.some((f) => f.status === "failed" && /e3/.test(f.step)));
  assert.ok(rep.counts.done > 10, "independent steps still ran");
});

test("premiere transcript normalizer", () => {
  const n = normalizePremiereTranscript({ language: "en-us", speakers: [{ id: "a", name: "Ali" }], segments: [{ start: 1, duration: 2, speaker: "a", words: [{ start: 1, duration: 1, text: "Hello" }, { start: 2, duration: 1, text: "," }, { start: 2.5, duration: 0.5, text: "world" }] }] });
  assert.equal(n.segments[0].text, "Hello, world");
  assert.equal(n.segments[0].speaker, "Ali");
});
