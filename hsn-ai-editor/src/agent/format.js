// Compact text renderings of Premiere state for the model and the UI.
import { ticksToSeconds, formatTimecode } from "../core/time.js";

const s = (t) => ticksToSeconds(t).toFixed(2);

export function timelineText(tl, { maxItems = 400 } = {}) {
  const q = tl.sequence;
  const fps = q.fps;
  const lines = [
    `Sequence "${q.name}" [id ${q.id}] ${fps}fps ${q.width}x${q.height}, length ${s(q.endTicks)}s (${formatTimecode(q.endTicks, fps)})`,
    `In/Out: ${q.inOut ? `${s(q.inOut.in)}–${s(q.inOut.out)}s` : "not set"} · playhead ${s(q.playheadTicks)}s${q.workArea ? ` · work area ${s(q.workArea.in)}–${s(q.workArea.out)}s` : ""}`,
    `Selected clips: ${tl.selection.length ? tl.selection.join(", ") : "none"}`,
  ];
  let n = 0;
  for (const kind of ["video", "audio"]) {
    for (const t of [...tl.tracks[kind]].reverse()) {
      const label = `${kind === "video" ? "V" : "A"}${t.index + 1}${t.muted ? " (muted)" : ""}`;
      if (!t.items.length) {
        lines.push(`${label}: —`);
        continue;
      }
      const parts = [];
      for (const i of t.items) {
        if (++n > maxItems) break;
        parts.push(`[${i.key}] ${i.name} src ${s(i.in)}–${s(i.out)} @ ${s(i.start)}–${s(i.end)}${i.link ? ` ${i.link}` : ""}${i.disabled ? " DISABLED" : ""}${i.speed && i.speed !== 1 ? ` speed ${i.speed}` : ""}`);
      }
      lines.push(`${label}: ${parts.join(" | ")}`);
    }
  }
  if (n > maxItems) lines.push(`… ${n - maxItems} more clips not listed`);
  lines.push(`Markers: ${tl.markers.length ? tl.markers.map((m) => `${s(m.start)}s "${m.name}"${m.comments ? ` (${m.comments})` : ""}`).join("; ") : "none"}`);
  lines.push("Keys like [V1:12.400] identify clips for editing tools; they change when a clip moves, so re-read after edits.");
  return lines.join("\n");
}

/** Detect problems a human editor would flag. */
export function timelineChecks(tl) {
  const issues = [];
  const tpf = tl.sequence.ticksPerFrame;
  for (const kind of ["video", "audio"]) {
    for (const t of tl.tracks[kind]) {
      const it = [...t.items].sort((a, b) => a.start - b.start);
      for (let i = 0; i < it.length; i++) {
        const c = it[i];
        if (c.end - c.start <= 2 * tpf) issues.push(`${c.key}: flash clip (${Math.round((c.end - c.start) / tpf)} frame(s))`);
        if (c.disabled) issues.push(`${c.key}: disabled`);
        const n = it[i + 1];
        if (n && n.start > c.end && n.start - c.end <= 3 * tpf && kind === "video") issues.push(`${kind === "video" ? "V" : "A"}${t.index + 1}: ${Math.round((n.start - c.end) / tpf)}-frame gap at ${s(c.end)}s (black flash)`);
        if (n && n.start < c.end) issues.push(`${c.key} overlaps ${n.key}`);
      }
    }
  }
  const v = tl.tracks.video.flatMap((t) => t.items);
  const a = tl.tracks.audio.flatMap((t) => t.items);
  for (const x of v) {
    if (!x.link) continue;
    const partner = a.find((y) => y.link === x.link);
    if (partner && (partner.start !== x.start || partner.in !== x.in)) issues.push(`${x.key}: out of sync with its audio`);
  }
  // Gaps in picture on V1 (the base layer)
  const base = [...(tl.tracks.video[0]?.items || [])].sort((a, b) => a.start - b.start);
  let cur = 0;
  for (const x of base) {
    const covered = tl.tracks.video.slice(1).some((t) => t.items.some((y) => y.start <= cur && y.end >= x.start));
    if (x.start - cur > 3 * tpf && !covered) issues.push(`V1: empty picture ${s(cur)}–${s(x.start)}s`);
    cur = Math.max(cur, x.end);
  }
  return issues;
}

export function fingerprintTimeline(tl) {
  return [...tl.tracks.video, ...tl.tracks.audio].flatMap((t) => t.items.map((i) => i.fp)).join(";") + `|${tl.sequence.id}`;
}

export function diffTimelines(a, b) {
  if (!a || !b) return null;
  if (a.sequence.id !== b.sequence.id) return `active sequence changed to "${b.sequence.name}"`;
  const fa = new Set([...a.tracks.video, ...a.tracks.audio].flatMap((t) => t.items.map((i) => i.fp)));
  const fb = new Set([...b.tracks.video, ...b.tracks.audio].flatMap((t) => t.items.map((i) => i.fp)));
  const added = [...fb].filter((x) => !fa.has(x)).length;
  const removed = [...fa].filter((x) => !fb.has(x)).length;
  if (!added && !removed) return null;
  return `${added} clip(s) added/changed, ${removed} removed/changed since the last read`;
}
