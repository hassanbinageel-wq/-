// Tiered footage analysis.
//  Tier 1 (index): metadata, a few representative frames per clip (evenly
//    spaced + scene cuts), transcript if available, cheap audio features.
//  Tier 2 (deep): denser frames around candidate ranges on request.
// Frames come from (a) the helper extracting directly from the source file,
// (b) Premiere's Exporter.exportSequenceFrame on the timeline, or (c) a
// temporary one-clip sequence when the full source must be seen without the
// helper. Every result states what was actually covered.

import { secondsToTicks, ticksToSeconds, TICKS_PER_SECOND } from "../core/time.js";
import { bytesToBase64 } from "../core/utf8.js";
import { joinPath } from "../storage/fsio.js";
import { uid } from "../core/util.js";

export class Analyzer {
  constructor({ host, index, helper, fsio, settings, log = () => {} }) {
    Object.assign(this, { host, index, helper, fsio, settings, log });
  }

  /**
   * Resolve a work scope into media "uses".
   * @returns {{uses: Array<{mediaId, path, name, ranges:[[in,out]], timeline:[]}>, description, seqId}}
   */
  async resolveScope(scope = "timeline", { fullSource = false, mediaIds } = {}) {
    const uses = new Map();
    const add = (entry, range, tlUse) => {
      const u = uses.get(entry.id) || { mediaId: entry.id, path: entry.path, name: entry.name, ranges: [], timeline: [] };
      if (range) u.ranges.push(range);
      if (tlUse) u.timeline.push(tlUse);
      uses.set(entry.id, u);
    };
    let description = "";
    let seqId = null;
    const items = await this.host.projectItems({ includeSequences: false });
    const byId = new Map(items.map((i) => [i.id, i]));

    if (mediaIds?.length) {
      for (const id of mediaIds) {
        const e = byId.get(id) || items.find((i) => i.path === id || i.name === id);
        if (e) add(e, null);
      }
      description = `${uses.size} requested media file(s)`;
    } else if (scope === "bin" || scope === "project") {
      const pool = scope === "project" ? items.filter((i) => i.kind === "clip") : await this.binSelectionClips(items);
      for (const e of pool) add(e, null);
      description = scope === "project" ? `all ${uses.size} clips in the project` : `${uses.size} clip(s) selected in the Project panel`;
      if (!uses.size && scope === "bin") description = "nothing is selected in the Project panel";
    } else {
      const tl = await this.host.readTimeline();
      seqId = tl.sequence.id;
      let tItems = [...tl.tracks.video, ...tl.tracks.audio].flatMap((t) => t.items);
      if (scope === "selection") {
        tItems = tItems.filter((i) => tl.selection.includes(i.key));
        description = `${tItems.length} selected timeline clip(s) in "${tl.sequence.name}"`;
      } else if (scope === "inout") {
        const io = tl.sequence.inOut;
        if (!io) {
          description = `no In/Out range is set on "${tl.sequence.name}" — using the whole timeline`;
        } else {
          tItems = tItems
            .filter((i) => i.end > io.in && i.start < io.out)
            .map((i) => ({ ...i, in: i.in + Math.max(0, io.in - i.start), start: Math.max(i.start, io.in), end: Math.min(i.end, io.out) }));
          description = `clips inside In/Out ${ticksToSeconds(io.in).toFixed(2)}–${ticksToSeconds(io.out).toFixed(2)}s of "${tl.sequence.name}"`;
        }
      } else description = `all clips on the timeline "${tl.sequence.name}"`;
      for (const i of tItems) {
        const e = byId.get(i.projectItemId) || items.find((x) => x.path && x.path === i.path);
        if (!e) continue;
        const srcIn = ticksToSeconds(i.in);
        const srcOut = srcIn + ticksToSeconds(i.end - i.start);
        add(e, [srcIn, srcOut], { key: i.key, start: ticksToSeconds(i.start), end: ticksToSeconds(i.end), in: srcIn, out: srcOut, kind: i.kind });
      }
    }
    for (const u of uses.values()) {
      const e = byId.get(u.mediaId);
      const d = await this.host.clipDetails(e);
      u.duration_s = d.durationTicks != null ? ticksToSeconds(d.durationTicks) : null;
      u.fps = d.fps;
      u.offline = d.offline;
      if (fullSource || !u.ranges.length) u.ranges = u.duration_s ? [[0, u.duration_s]] : u.ranges;
      u.ranges = merge(u.ranges);
    }
    return { uses: [...uses.values()], description: `${description}${fullSource ? " — analyzing the FULL source files" : " — analyzing only the parts in scope"}`, seqId, fullSource };
  }

  async binSelectionClips(items) {
    const sel = await this.host.projectPanelSelection();
    const out = [];
    for (const s of sel) {
      if (s.kind === "clip") out.push(items.find((i) => i.id === s.id));
      if (s.kind === "bin") out.push(...items.filter((i) => i.kind === "clip" && (i.bin === s.name || i.bin?.startsWith(`${s.bin ? s.bin + "/" : ""}${s.name}`))));
    }
    return out.filter(Boolean);
  }

  /** Choose representative sample times (seconds) inside ranges. */
  sampleTimes(ranges, n, scenes = []) {
    const total = ranges.reduce((a, [x, y]) => a + (y - x), 0);
    if (!total || n <= 0) return [];
    const times = [];
    for (const [a, b] of ranges) {
      const k = Math.max(1, Math.round((n * (b - a)) / total));
      for (let i = 0; i < k; i++) times.push(a + ((i + 0.5) * (b - a)) / k);
    }
    // Add just-after-cut frames for scene changes inside ranges (new content).
    for (const s of scenes) if (ranges.some(([a, b]) => s + 0.2 > a && s + 0.2 < b)) times.push(s + 0.2);
    const uniq = [...new Set(times.map((t) => +t.toFixed(2)))].sort((a, b) => a - b);
    return thin(uniq, Math.max(n, Math.min(uniq.length, n + 4)));
  }

  /**
   * Tier-1 index of the given uses. Returns text + images for Claude.
   * @param {object} o { depth, want: {frames, transcript, audio, scenes}, framesPerClip, maxFrames, width, signal, onProgress, consent }
   */
  async indexUses(scopeRes, o = {}) {
    const want = { frames: true, transcript: true, audio: true, scenes: true, ...(o.want || {}) };
    const width = o.width || this.settings.frameWidth || 512;
    const perClip = o.framesPerClip || this.settings.framesPerClip || 6;
    const maxFrames = o.maxFrames || this.settings.maxFramesPerRequest || 24;
    const images = [];
    const notes = [];
    const helperOk = this.helper?.available;
    let budget = maxFrames;
    const uses = scopeRes.uses;
    let i = 0;
    for (const u of uses) {
      i++;
      if (o.signal?.aborted) throw new Error("cancelled");
      o.onProgress?.({ phase: "analyze", index: i, total: uses.length, label: u.name });
      const m = this.index.upsert({ id: u.mediaId, path: u.path, name: u.name, duration_s: u.duration_s, fps: u.fps, hasVideo: !/\.(wav|mp3|aif|aiff|m4a|aac|flac)$/i.test(u.path || ""), hasAudio: true, timelineUses: u.timeline.map((t) => ({ key: t.key, in: t.in, out: t.out })) });
      if (u.offline) {
        notes.push(`${u.name}: media offline — skipped`);
        continue;
      }
      // Probe (helper) for accurate stream info.
      if (helperOk && u.path) {
        try {
          const p = await this.helper.call("probe", { path: u.path });
          Object.assign(m, { hasVideo: p.hasVideo, hasAudio: p.hasAudio, width: p.width, height: p.height, fps: p.fps || m.fps, duration_s: p.duration || m.duration_s, codec: p.videoCodec });
        } catch (e) {
          notes.push(`${u.name}: probe failed (${e.message})`);
        }
      }
      if (want.scenes && helperOk && m.hasVideo && !m.scenes?.length && u.path) {
        try {
          const r = await this.helper.call("scenes", { path: u.path, threshold: 0.3 });
          this.index.setScenes(u.mediaId, r.scenes || []);
        } catch (e) {
          notes.push(`${u.name}: scene detection unavailable (${e.message})`);
        }
      }
      if (want.transcript && m.hasAudio && !m.transcript) {
        const tr = await this.transcriptFor(u, { allowHelper: o.transcribe !== false }).catch((e) => ({ error: e.message }));
        if (tr?.error) notes.push(`${u.name}: no transcript (${tr.error})`);
        else if (tr) this.index.setTranscript(u.mediaId, tr);
      }
      if (want.audio && helperOk && m.hasAudio && !m.audio?.silences && u.path) {
        try {
          const a = await this.helper.call("audio", { path: u.path, silence: true, loudness: true, beats: /music|song|track|beat|موسيق/i.test(u.name) || !m.hasVideo });
          this.index.setAudio(u.mediaId, { ...a, analyzedBy: "helper/ffmpeg" });
        } catch (e) {
          notes.push(`${u.name}: audio analysis failed (${e.message})`);
        }
      }
      if (want.frames && m.hasVideo && budget > 0) {
        const n = Math.min(perClip, budget);
        const times = this.sampleTimes(u.ranges, n, this.index.media[u.mediaId].scenes || []);
        const got = await this.frames(u, times, { width, fullSource: scopeRes.fullSource || !u.timeline.length, signal: o.signal }).catch((e) => {
          notes.push(`${u.name}: frames unavailable (${e.message})`);
          return [];
        });
        budget -= got.length;
        for (const f of got) images.push({ mediaId: u.mediaId, name: u.name, t: f.t, base64: f.base64, mediaType: "image/jpeg" });
        this.index.addFrames(u.mediaId, got.map((f) => ({ t: f.t, scope: f.scope, w: width })));
      }
    }
    await this.index.save();
    const text = [
      `Scope: ${scopeRes.description}.`,
      `Helper: ${helperOk ? "connected (ffmpeg analysis available)" : "offline (frames via Premiere export; no audio measurement / Whisper)"}.`,
      ...notes.map((n) => `Note: ${n}`),
      "",
      ...uses.map((u) => `${this.index.describe(u.mediaId)}\ncoverage: ${JSON.stringify(this.index.coverage(u.mediaId))}`),
      "",
      images.length ? `Attached ${images.length} frame(s), labeled "[media id @ seconds]". Look at them and store what you see with record_shot_notes (with confidence).` : "No frames attached.",
      budget <= 0 ? "Frame budget for this request is exhausted; call analyze_footage again on the remaining media or view_frames for specific moments." : "",
    ].join("\n");
    return { text, images };
  }

  async transcriptFor(u, { allowHelper = true } = {}) {
    // 1. Premiere transcript (Text panel / Speech to Text)
    const pt = await this.host.transcript(u.mediaId).catch(() => null);
    if (pt?.segments?.length) return pt;
    // 2. Local Whisper through the helper (supports Arabic)
    if (allowHelper && this.helper?.available && this.helper.status.tools?.whisper) {
      const r = await this.helper.call("transcribe", { path: u.path, language: this.settings.transcriptLanguage || "auto" }, { timeoutMs: 60 * 60 * 1000 });
      return { source: `whisper (${r.model || "local"})`, language: r.language, segments: r.segments };
    }
    return { error: this.helper?.available ? "no Premiere transcript; Whisper is not configured in the helper" : "no Premiere transcript; start the helper with Whisper for automatic transcription (Arabic supported)" };
  }

  /** Extract frames (seconds in source media time) -> [{t, base64, scope}] */
  async frames(u, times, { width = 512, fullSource = false, signal } = {}) {
    if (!times.length) return [];
    const m = this.index.media[u.mediaId] || {};
    const height = Math.round((width * (m.height || 9)) / (m.width || 16)) || Math.round((width * 9) / 16);
    // (a) helper: exact frames from the file.
    if (this.helper?.available && u.path) {
      const r = await this.helper.call("frames", { path: u.path, times, width }, { signal });
      return r.frames.map((f) => ({ t: f.t, base64: f.jpegBase64, scope: "source" }));
    }
    const dir = joinPath(this.fsio, await this.fsio.tempDir(), "hsn-frames");
    await this.fsio.mkdir(dir);
    const out = [];
    // (b) timeline export: only for times visible on the active timeline.
    if (!fullSource && u.timeline.length) {
      const seqInfo = (await this.host.readTimeline()).sequence;
      const h = Math.round((width * seqInfo.height) / seqInfo.width);
      for (const t of times) {
        const use = u.timeline.find((x) => t >= x.in && t < x.out && x.kind === "video");
        if (!use) continue;
        const seqT = secondsToTicks(use.start + (t - use.in));
        const file = `f_${uid("x")}.jpg`;
        const path = await this.host.exportFrame({ time: seqT, dir, filename: file, width, height: h });
        const bytes = await this.fsio.readBytes(path);
        await this.fsio.remove(path);
        out.push({ t, base64: bytesToBase64(bytes), scope: "timeline (composite of all tracks at that moment)" });
      }
      return out;
    }
    // (c) temporary one-clip sequence.
    const tmp = await this.host.tempSequenceFor(u.mediaId);
    try {
      for (const t of times) {
        if (signal?.aborted) break;
        const file = `f_${uid("x")}.jpg`;
        const path = await this.host.exportFrame({ seqId: tmp.id, time: tmp.map(secondsToTicks(t)), dir, filename: file, width, height });
        const bytes = await this.fsio.readBytes(path);
        await this.fsio.remove(path);
        out.push({ t, base64: bytesToBase64(bytes), scope: "source (temporary sequence)" });
      }
    } finally {
      await this.host.deleteSequence(tmp.id).catch((e) => this.log("warn", `temp sequence not deleted: ${e.message}`));
    }
    return out;
  }
}

function merge(ranges) {
  const r = ranges.map(([a, b]) => [Math.max(0, a), b]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const x of r) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1] + 0.05) last[1] = Math.max(last[1], x[1]);
    else out.push([...x]);
  }
  return out;
}

function thin(arr, n) {
  if (arr.length <= n) return arr;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)]);
  return [...new Set(out)];
}

export { TICKS_PER_SECOND };
