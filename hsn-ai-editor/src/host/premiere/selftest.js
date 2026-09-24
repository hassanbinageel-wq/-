// On-device self-test: runs inside the user's Premiere on a TEMPORARY
// sequence (deleted afterwards), exercising every host operation the
// assistant relies on and recording how this Premiere build behaves where
// Adobe's documentation leaves details open (trim semantics, volume units,
// keyframe time base, position normalization). Nothing in the user's
// sequences or media is modified.

import { secondsToTicks, ticksToSeconds } from "../../core/time.js";

export async function runSelfTest(host, { onStep = () => {}, sourceId } = {}) {
  const results = [];
  const findings = {};
  const step = async (name, fn) => {
    onStep({ name, status: "running" });
    const t0 = Date.now();
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail: detail ?? "", ms: Date.now() - t0 });
      onStep({ name, status: "pass", detail });
    } catch (e) {
      results.push({ name, ok: false, detail: e.message, ms: Date.now() - t0 });
      onStep({ name, status: "fail", detail: e.message });
    }
  };

  const caps = await host.init();
  results.push({ name: "Premiere version / API", ok: true, detail: `${caps.version}; transcribe API ${caps.transcribe ? "yes" : "no"}, frame export ${caps.frameExport ? "yes" : "no"}` });
  const items = (await host.projectItems({ includeSequences: false })).filter((i) => i.kind === "clip");
  let src = sourceId ? items.find((i) => i.id === sourceId) : null;
  if (!src) {
    for (const i of items) {
      const d = await host.clipDetails(i);
      if (d.durationTicks > secondsToTicks(6) && !d.offline && !/\.(wav|mp3|aif|aiff|m4a)$/i.test(i.path)) {
        src = i;
        break;
      }
    }
  }
  if (!src) return { ok: false, results: [...results, { name: "source clip", ok: false, detail: "Import at least one video clip longer than 6 s, then run the self-test." }], findings };

  let tmp = null;
  await step("create temporary sequence", async () => {
    tmp = await host.tempSequenceFor(src.id);
    return tmp.id;
  });
  if (!tmp) return { ok: false, results, findings };
  const seqId = tmp.id;
  const S = secondsToTicks;
  try {
    let tl;
    await step("read timeline", async () => {
      tl = await host.readTimeline(seqId);
      const n = [...tl.tracks.video, ...tl.tracks.audio].reduce((a, t) => a + t.items.length, 0);
      if (!n) throw new Error("no clips read");
      return `${n} clip(s), ${tl.sequence.fps} fps`;
    });
    const first = () => tl.tracks.video[0].items[0];

    await step("place exact source range (overwrite, frame-accurate)", async () => {
      const r = await host.placeSegment({ source: src.id, srcIn: S(1), srcOut: S(3), time: S(20), videoTrack: 1, audioTrack: 1, seqId });
      const v = r.find((x) => x.kind === "video");
      if (!v || v.start !== S(20) || v.end - v.start !== S(2) || v.in !== S(1)) throw new Error(`got ${JSON.stringify(v)}`);
      return "V2 @20s, 2.00s, src 1.00 ✓";
    });

    await step("video-only placement keeps audio tracks untouched", async () => {
      tl = await host.readTimeline(seqId);
      const beforeA = JSON.stringify(tl.tracks.audio.map((t) => t.items.map((i) => i.fp)));
      await host.placeSegment({ source: src.id, srcIn: S(0), srcOut: S(1), time: S(0.5), videoTrack: 2, audioTrack: 0, audio: false, seqId });
      tl = await host.readTimeline(seqId);
      const afterA = JSON.stringify(tl.tracks.audio.slice(0, beforeA.length ? JSON.parse(beforeA).length : 0).map((t) => t.items.map((i) => i.fp)));
      if (afterA !== beforeA) throw new Error("audio changed");
      return "✓";
    });

    await step("trim semantics (set start / end / in point)", async () => {
      tl = await host.readTimeline(seqId);
      const it = tl.tracks.video[1].items.find((x) => x.start === S(20));
      const r = await host.setItemRange(it.key, { start: S(20.5), end: S(21.5), in: S(1.5) }, { seqId, linked: true });
      if (r.start !== S(20.5) || r.end !== S(21.5) || r.in !== S(1.5)) throw new Error(JSON.stringify(r));
      return "exact after verification ✓";
    });

    await step("move keeps linked audio in sync", async () => {
      tl = await host.readTimeline(seqId);
      const it = tl.tracks.video[1].items.find((x) => x.start === S(20.5));
      const m = await host.moveItem(it.key, S(25), { seqId });
      tl = await host.readTimeline(seqId);
      const a = tl.tracks.audio.flatMap((t) => t.items).find((x) => x.link && x.link === tl.tracks.video[1].items.find((y) => y.key === m.key)?.link);
      if (!a || a.start !== S(25)) throw new Error("audio did not follow");
      return "✓";
    });

    await step("split (emulated razor)", async () => {
      tl = await host.readTimeline(seqId);
      const r = await host.splitItem(first().key, first().start + S(2), { seqId });
      return `right part ${r.right.join(", ")}`;
    });

    await step("markers", async () => {
      const m = await host.addMarker({ time: S(1), name: "HSN self-test", comments: "temporary", seqId });
      const n = await host.removeMarkers({ namePrefix: "HSN self-test" }, { seqId });
      return `added @${ticksToSeconds(m.start)}s, removed ${n}`;
    });

    await step("transition (cross dissolve)", async () => {
      tl = await host.readTimeline(seqId);
      const names = await host.listTransitions();
      const mn = names.find((n) => /Cross Dissolve/i.test(n)) || names[0];
      await host.addTransition(first().key, { matchName: mn, durationTicks: S(0.5), position: "end", seqId });
      return mn;
    });

    await step("Motion scale keyframes + position normalization", async () => {
      tl = await host.readTimeline(seqId);
      const key = first().key;
      const { pInfo } = await host.findParam(key, { component: "Motion", param: "Position", seqId });
      findings.positionNormalized = !!(pInfo.value && pInfo.value.x <= 1.5);
      const r = await host.setParam(key, { component: "Motion", param: "Scale", keyframes: [{ t: 0, value: 100 }, { t: S(1), value: 120 }], seqId });
      return `position default ${JSON.stringify(pInfo.value)} → ${findings.positionNormalized ? "normalized (0–1)" : "pixels"}; ${r.keyframes} keyframes`;
    });

    await step("audio level units", async () => {
      tl = await host.readTimeline(seqId);
      const a = tl.tracks.audio.flatMap((t) => t.items)[0];
      if (!a) return "no audio in the test clip — skipped";
      const saved = host.settings.volumeUnits;
      host.settings.volumeUnits = "auto";
      const mode = await host.volumeMode(a.key, seqId);
      findings.volumeUnits = mode;
      const r = await host.setVolume(a.key, { db: -6, seqId });
      host.settings.volumeUnits = saved;
      return `default level reads as ${mode === "linear" ? "linear gain (0 dB ≈ 0.178)" : "dB"}; set −6 dB → stored ${r.startValue}. Listen/check in Effect Controls that it shows −6 dB.`;
    });

    await step("video effect (Gaussian Blur) + parameter", async () => {
      tl = await host.readTimeline(seqId);
      const fx = await host.listEffects();
      const blur = fx.video.find((v) => /Gaussian Blur/i.test(v.displayName) || /Gaussian Blur/i.test(v.matchName));
      if (!blur) return "Gaussian Blur not installed — skipped";
      await host.addEffect(first().key, { matchName: blur.matchName, seqId });
      const r = await host.setParam(first().key, { component: blur.displayName, param: "Blurriness", value: 5, seqId });
      return `${blur.matchName} → Blurriness ${r.startValue}`;
    });

    await step("frame export", async () => {
      tl = await host.readTimeline(seqId);
      if (!host.capabilities.frameExport) throw new Error("Exporter.exportSequenceFrame not available");
      return "available (used for analysis)";
    });

    await step("remove clips (ripple)", async () => {
      tl = await host.readTimeline(seqId);
      const k = tl.tracks.video[2]?.items[0]?.key;
      if (!k) return "nothing to remove";
      await host.removeItems([k], { ripple: true, seqId });
      return "✓";
    });
  } finally {
    await step("delete temporary sequence", async () => {
      await host.deleteSequence(seqId);
      return "✓";
    });
  }
  return { ok: results.every((r) => r.ok), results, findings, source: src.name };
}
