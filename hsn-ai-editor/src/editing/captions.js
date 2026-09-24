// Captions: map source transcripts onto a sequence's timeline and write SRT.
import { ticksToSeconds } from "../core/time.js";

const RLM = "‏";
const isRtl = (s) => /[֐-ࣿ]/.test(s);

/** Build caption cues (timeline seconds) from audio clips + transcripts. */
export function cuesFromTimeline(tl, index, { maxChars = 42, maxDur = 6 } = {}) {
  const cues = [];
  const audio = tl.tracks.audio.flatMap((t) => t.items).filter((i) => !i.disabled);
  for (const it of audio) {
    const m = index.get(it.projectItemId) || index.get(it.path);
    if (!m?.transcript) continue;
    const s0 = ticksToSeconds(it.in);
    const s1 = s0 + ticksToSeconds(it.end - it.start);
    const off = ticksToSeconds(it.start) - s0;
    for (const seg of m.transcript.segments) {
      if (seg.end <= s0 || seg.start >= s1) continue;
      const words = seg.words?.length ? seg.words.filter((w) => w.end > s0 && w.start < s1) : null;
      if (words?.length) {
        let cur = [];
        const flush = () => {
          if (!cur.length) return;
          cues.push({ start: Math.max(cur[0].start, s0) + off, end: Math.min(cur[cur.length - 1].end, s1) + off, text: cur.map((w) => w.text).join(" ").replace(/\s+([,.!?،؟])/g, "$1") });
          cur = [];
        };
        for (const w of words) {
          const len = cur.map((x) => x.text).join(" ").length + w.text.length + 1;
          if (cur.length && (len > maxChars * 2 || w.end - cur[0].start > maxDur)) flush();
          cur.push(w);
          if (/[.!?؟]$/.test(w.text)) flush();
        }
        flush();
      } else {
        cues.push({ start: Math.max(seg.start, s0) + off, end: Math.min(seg.end, s1) + off, text: seg.text });
      }
    }
  }
  cues.sort((a, b) => a.start - b.start);
  // remove overlaps (checkerboarded dialogue)
  for (let i = 1; i < cues.length; i++) if (cues[i].start < cues[i - 1].end) cues[i - 1].end = Math.max(cues[i - 1].start + 0.3, cues[i].start);
  return cues.map((c) => ({ ...c, start: +c.start.toFixed(3), end: +c.end.toFixed(3) }));
}

export function wrapLines(text, maxChars = 42) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = `${cur} ${w}`.trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) {
    // rebalance into two lines
    const all = words.join(" ");
    const mid = all.lastIndexOf(" ", Math.ceil(all.length / 2));
    return [all.slice(0, mid), all.slice(mid + 1)];
  }
  return lines;
}

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, k = 2) => String(n).padStart(k, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

export function toSrt(cues, { maxChars = 42 } = {}) {
  return cues
    .map((c, i) => {
      const lines = wrapLines(c.text, maxChars).map((l) => (isRtl(l) ? `${RLM}${l}` : l));
      return `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${lines.join("\n")}\n`;
    })
    .join("\n");
}

export function parseSrt(text) {
  const out = [];
  for (const block of String(text).replace(/\r/g, "").split(/\n\n+/)) {
    const m = block.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\n([\s\S]*)/);
    if (!m) continue;
    const t = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
    out.push({ start: t(m[1], m[2], m[3], m[4]), end: t(m[5], m[6], m[7], m[8]), text: m[9].replace(/‏/g, "").trim() });
  }
  return out;
}
