// Per-project footage index: what we actually know about each media file,
// where that knowledge came from, and how much of the file it covers.
// Claude's visual observations are stored as notes with confidence values;
// transcripts and audio features come from Premiere or the local helper.

import { joinPath } from "../storage/fsio.js";
import { tokenize, normalizeText } from "../core/util.js";

export class FootageIndex {
  constructor(fsio, dir) {
    this.fsio = fsio;
    this.path = dir ? joinPath(fsio, dir, "footage-index.json") : null;
    this.media = {};
    this.saving = Promise.resolve();
  }
  static async open(fsio, dir) {
    const ix = new FootageIndex(fsio, dir);
    if (ix.path) {
      try {
        ix.media = JSON.parse(await fsio.readText(ix.path)).media || {};
      } catch { /* new index */ }
    }
    return ix;
  }
  save() {
    if (!this.path) return Promise.resolve();
    const text = JSON.stringify({ version: 1, media: this.media });
    this.saving = this.saving.then(() => this.fsio.writeText(this.path, text)).catch(() => {});
    return this.saving;
  }

  upsert(m) {
    const cur = this.media[m.id] || { frames: [], notes: [], scenes: [], transcript: null, audio: null };
    this.media[m.id] = { ...cur, ...m, frames: cur.frames, notes: cur.notes, scenes: m.scenes || cur.scenes, transcript: cur.transcript, audio: cur.audio };
    return this.media[m.id];
  }
  get(id) {
    return this.media[id] || Object.values(this.media).find((m) => m.path === id || m.name === id) || null;
  }
  addFrames(id, frames) {
    const m = this.media[id];
    if (!m) return;
    for (const f of frames) if (!m.frames.some((x) => Math.abs(x.t - f.t) < 0.02)) m.frames.push(f);
    m.frames.sort((a, b) => a.t - b.t);
  }
  addNotes(id, notes) {
    const m = this.media[id];
    if (!m) throw new Error(`Unknown media ${id}`);
    for (const n of notes) {
      // Replace notes for the same range (re-analysis), keep others.
      m.notes = m.notes.filter((x) => !(Math.abs(x.start - n.start) < 0.05 && Math.abs(x.end - n.end) < 0.05));
      m.notes.push({ ...n, at: Date.now() });
    }
    m.notes.sort((a, b) => a.start - b.start);
    this.save();
    return m.notes.length;
  }
  setTranscript(id, tr) {
    if (this.media[id]) this.media[id].transcript = tr;
    this.save();
  }
  setAudio(id, audio) {
    if (this.media[id]) this.media[id].audio = { ...(this.media[id].audio || {}), ...audio };
    this.save();
  }
  setScenes(id, scenes) {
    if (this.media[id]) this.media[id].scenes = scenes;
  }

  /** How much of each file has been looked at, honestly. */
  coverage(id) {
    const m = this.media[id];
    if (!m) return null;
    const d = m.duration_s || 0;
    const frames = m.frames.length;
    const noted = mergeLen(m.notes.map((n) => [n.start, n.end]));
    const tr = m.transcript ? mergeLen(m.transcript.segments.map((s) => [s.start, s.end])) : 0;
    return {
      duration_s: +d.toFixed(2),
      frames_sampled: frames,
      sample_times: m.frames.map((f) => +f.t.toFixed(2)).slice(0, 40),
      frames_scope: [...new Set(m.frames.map((f) => f.scope))].join(",") || "none",
      described_s: +noted.toFixed(1),
      transcript: m.transcript ? `${m.transcript.source} (${m.transcript.language || "?"}), speech ≈ ${tr.toFixed(1)}s` : "none",
      audio_features: m.audio ? Object.keys(m.audio).filter((k) => k !== "analyzedBy").join(",") : "none",
      note: frames ? `Sampled ${frames} still frame(s); motion between samples was not observed.` : "Not visually analyzed yet.",
    };
  }

  /**
   * Natural-language search across Claude's notes and transcripts.
   * Lexical scoring (Arabic-normalized); results are candidates for Claude
   * to confirm visually with view_frames — not ground truth.
   */
  search(query, { limit = 12, mediaIds } = {}) {
    const q = tokenize(query);
    const qn = normalizeText(query);
    const hits = [];
    for (const m of Object.values(this.media)) {
      if (mediaIds && !mediaIds.includes(m.id)) continue;
      for (const n of m.notes) {
        const hay = [n.description, n.shot_type, n.motion, ...(n.subjects || []), ...(n.tags || [])].join(" ");
        const s = score(q, qn, hay);
        if (s > 0) hits.push({ kind: "visual_note", media_id: m.id, name: m.name, start: n.start, end: n.end, text: n.description, score: s * (0.5 + 0.5 * (n.confidence ?? 0.7)), usable: n.usable, confidence: n.confidence });
      }
      for (const seg of m.transcript?.segments || []) {
        const s = score(q, qn, seg.text);
        if (s > 0) hits.push({ kind: "speech", media_id: m.id, name: m.name, start: seg.start, end: seg.end, text: seg.text, score: s * 0.9, speaker: seg.speaker });
      }
      const nameScore = score(q, qn, `${m.name} ${m.bin || ""}`) * 0.3;
      if (nameScore > 0) hits.push({ kind: "filename_only", media_id: m.id, name: m.name, start: 0, end: m.duration_s, text: "(match on file/bin name only — content not confirmed)", score: nameScore });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Compact text summary for Claude. */
  describe(id, { maxNotes = 30, maxSegs = 40 } = {}) {
    const m = this.media[id];
    if (!m) return "";
    const lines = [`# ${m.name} [id ${m.id}] ${m.duration_s?.toFixed(2)}s ${m.fps ? m.fps + "fps" : ""} ${m.hasVideo ? "video" : ""}${m.hasAudio ? "+audio" : ""}`];
    if (m.timelineUses?.length) lines.push(`on timeline: ${m.timelineUses.map((u) => `${u.key} src ${u.in.toFixed(2)}–${u.out.toFixed(2)}`).join("; ")}`);
    if (m.notes.length) {
      lines.push("visual notes:");
      for (const n of m.notes.slice(0, maxNotes)) lines.push(`  ${n.start.toFixed(1)}–${n.end.toFixed(1)}s ${n.shot_type || ""} ${n.motion || ""}: ${n.description}${n.issues?.length ? ` [issues: ${n.issues.join(", ")}]` : ""} (conf ${n.confidence ?? "?"})`);
    }
    if (m.scenes?.length) lines.push(`scene cuts at: ${m.scenes.map((s) => s.toFixed(2)).join(", ")}`);
    if (m.transcript?.segments?.length) {
      lines.push(`transcript (${m.transcript.source}):`);
      for (const s of m.transcript.segments.slice(0, maxSegs)) lines.push(`  ${s.start.toFixed(2)}–${s.end.toFixed(2)} ${s.speaker ? s.speaker + ": " : ""}${s.text}`);
      if (m.transcript.segments.length > maxSegs) lines.push(`  … ${m.transcript.segments.length - maxSegs} more segments (use get_transcript)`);
    }
    if (m.audio) {
      const a = m.audio;
      if (a.loudness) lines.push(`loudness: integrated ${a.loudness.integrated_lufs} LUFS, true peak ${a.loudness.true_peak_dbtp} dBTP (measured by ${a.analyzedBy || "helper"})`);
      if (a.silences?.length) lines.push(`silences: ${a.silences.slice(0, 20).map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)}`).join(", ")}`);
      if (a.beats?.length) lines.push(`beats (${a.tempo_bpm ? a.tempo_bpm + " bpm est." : "onsets"}): ${a.beats.slice(0, 40).map((b) => b.toFixed(2)).join(", ")}${a.beats.length > 40 ? " …" : ""}`);
    }
    return lines.join("\n");
  }
}

function score(q, qn, hay) {
  if (!hay) return 0;
  const h = new Set(tokenize(hay));
  const hn = normalizeText(hay);
  let s = 0;
  for (const t of q) {
    if (h.has(t)) s += 1;
    else if (t.length > 3 && [...h].some((x) => x.startsWith(t.slice(0, Math.max(3, t.length - 2))))) s += 0.5;
  }
  if (qn.length > 4 && hn.includes(qn)) s += 2;
  return q.length ? s / q.length : 0;
}

function mergeLen(ranges) {
  const r = [...ranges].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const [a, b] of r) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}
