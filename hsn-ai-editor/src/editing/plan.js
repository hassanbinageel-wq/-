// Edit plans: the structured contract between Claude's creative decisions
// and deterministic execution. Claude proposes a plan (JSON); this module
// validates it against the real media (durations, handles, transcripts),
// the user's constraints and the chosen style, lays it out on a frame grid,
// and compiles it into host operations. Nothing here touches Premiere.

import { S } from "../core/schema.js";
import { secondsToTicks, ticksToSeconds, snapTicks, ticksPerFrame } from "../core/time.js";
import { normalizeText, tokenize, hashObject } from "../core/util.js";

const ROLES = ["a_roll", "b_roll", "music", "sfx", "nat_sound", "title", "still"];

const EVENT_SCHEMA = S.obj(
  {
    id: S.str("unique event id, e.g. 'e1'"),
    role: S.enm(ROLES, "editorial role"),
    section: S.str("structure section this belongs to (hook, context, ...)"),
    source: S.str("media id/path from the media index (not needed for titles without media)"),
    src_in: S.num("source in point, seconds from media start", { minimum: 0 }),
    src_out: S.num("source out point, seconds from media start", { minimum: 0 }),
    at: S.num("timeline position in seconds. Omit to follow the previous storyline event", { minimum: 0 }),
    after: S.str("place right after this event id ends (storyline)"),
    with: S.str("align start to this event id (e.g. B-roll over a-roll)"),
    offset_s: S.num("offset from the 'with' event start, seconds"),
    video_track: S.int("1-based video track (default: a_roll/still V1, b_roll V2, title V3)", { minimum: 1, maximum: 24 }),
    audio_track: S.int("1-based audio track (default: a_roll A1, nat_sound A2, music A3, sfx A4)", { minimum: 1, maximum: 24 }),
    use_video: S.bool("include the video part"),
    use_audio: S.bool("include the audio part"),
    audio_lead_s: S.num("J-cut: audio starts this many seconds before the picture", { minimum: 0, maximum: 10 }),
    audio_tail_s: S.num("L-cut: audio continues this many seconds after the picture", { minimum: 0, maximum: 10 }),
    gain_db: S.num("clip gain in dB (0 = unchanged)", { minimum: -60, maximum: 15 }),
    fade_in_s: S.num("audio fade-in seconds", { minimum: 0, maximum: 20 }),
    fade_out_s: S.num("audio fade-out seconds", { minimum: 0, maximum: 20 }),
    duck_under: S.arr(S.str("event id"), "music/nat: lower this clip while these events play"),
    duck_db: S.num("ducking depth in dB (positive number)", { minimum: 0, maximum: 40 }),
    transition_in: S.obj({ name: S.str("'cut' | 'dissolve' | 'dip_black' | 'dip_white' | exact transition match name"), duration_s: S.num("seconds", { minimum: 0.04, maximum: 5 }) }, ["name"]),
    effects: S.arr(S.obj({ name: S.str("effect match name or display name"), params: { type: "object", description: "param name -> value" } }, ["name"]), "effects to add"),
    transform: S.obj(
      {
        scale: S.num("percent", { minimum: 1, maximum: 1000 }),
        position: S.obj({ x: S.num("0..1 of frame width"), y: S.num("0..1 of frame height") }, ["x", "y"]),
        rotation: S.num("degrees"),
        opacity: S.num("0..100", { minimum: 0, maximum: 100 }),
        animate_to: S.obj({ scale: S.num("percent at clip end"), position: S.obj({ x: S.num("x"), y: S.num("y") }, ["x", "y"]) }, [], "animate from the static values to these by the end of the clip (e.g. slow push-in)"),
      },
      []
    ),
    title_text: S.str("text for a title (role=title)"),
    mogrt: S.str("path to a .mogrt for the title (optional)"),
    duration_s: S.num("duration for titles/graphics", { minimum: 0.04 }),
    quote: S.str("for speech: the exact words spoken in this range (verified against the transcript)"),
    splice_note: S.str("if speech from one answer is reordered/shortened, explain why meaning is preserved"),
    reason: S.str("why this shot/moment was chosen (short)"),
    confidence: S.num("0..1 confidence in content-based choices", { minimum: 0, maximum: 1 }),
  },
  ["id", "role"]
);

export const PLAN_SCHEMA = S.obj(
  {
    title: S.str("short plan name"),
    mode: S.enm(["new_version", "modify_active"], "new_version builds a new sequence (default, required for full edits)"),
    base_version: S.str("version id this plan revises (keeps pinned parts)"),
    intent: S.obj({
      goal: S.str("what the piece must achieve"),
      platform: S.str("where it will be published"),
      target_duration_s: S.num("target length in seconds", { minimum: 1 }),
      aspect: S.enm(["16:9", "9:16", "1:1", "4:5", "source"], "frame aspect"),
      audience: S.str("who it is for"),
      language: S.str("spoken/subtitle language"),
    }),
    style_id: S.str("built-in or saved style id"),
    style_notes: S.str("how the style is interpreted/blended for this piece"),
    assumptions: S.arr(S.str("assumption"), "defaults you inferred (duration, platform, ...)"),
    structure: S.arr(S.obj({ section: S.str("name"), purpose: S.str("purpose"), target_s: S.num("seconds") }, ["section"]), "story structure"),
    events: S.arr(EVENT_SCHEMA, "timeline events in storyline order", { minItems: 1, maxItems: 400 }),
    markers: S.arr(S.obj({ at: S.num("seconds"), name: S.str("name"), note: S.str("comment") }, ["at", "name"]), "extra markers"),
    excluded: S.arr(S.obj({ source: S.str("media"), range: S.str("e.g. 12.0-15.5"), why: S.str("reason") }, ["source", "why"]), "notable material deliberately left out"),
    notes: S.str("notes for the editor"),
  },
  ["title", "events"]
);

const TRANSITION_ALIASES = {
  dissolve: "AE.ADBE Cross Dissolve New",
  cross_dissolve: "AE.ADBE Cross Dissolve New",
  dip_black: "AE.ADBE Dip To Black",
  dip_white: "AE.ADBE Dip To White",
  film_dissolve: "AE.ADBE Film Dissolve",
};

const DEFAULT_TRACKS = {
  a_roll: [1, 1],
  still: [1, 1],
  b_roll: [2, 2],
  nat_sound: [2, 2],
  title: [3, null],
  music: [null, 3],
  sfx: [null, 4],
};

/**
 * Validate + lay out a plan.
 * @param {object} plan
 * @param {object} ctx { fps, media: Map|obj id->{id,path,name,duration_s,hasVideo,hasAudio},
 *   transcripts: Map id->{segments}, style, constraints: [], protected: {video:[], audio:[]} (0-based),
 *   basePlan, availableTransitions: string[] }
 */
export function resolvePlan(plan, ctx) {
  const errors = [];
  const warnings = [];
  const fixes = [];
  const fps = ctx.fps || 25;
  const tpf = ticksPerFrame(fps);
  const snap = (sec) => snapTicks(secondsToTicks(sec), fps);
  const media = ctx.media instanceof Map ? ctx.media : new Map(Object.entries(ctx.media || {}));
  const findMedia = (ref) => media.get(ref) || [...media.values()].find((m) => m.path === ref || m.name === ref || m.id === ref);

  const ids = new Set();
  const laid = [];
  const byId = new Map();
  let cursor = 0; // storyline cursor (ticks)

  for (const [idx, ev] of plan.events.entries()) {
    const where = `event ${ev.id || idx}`;
    if (ids.has(ev.id)) errors.push(`${where}: duplicate id`);
    ids.add(ev.id);
    const role = ev.role;
    const isTitle = role === "title";
    const m = ev.source ? findMedia(ev.source) : null;
    if (!isTitle && !m) {
      errors.push(`${where}: unknown source "${ev.source}". Use an id or path from the media index.`);
      continue;
    }
    const [dv, da] = DEFAULT_TRACKS[role] || [1, 1];
    const useVideo = ev.use_video ?? (isTitle ? true : role === "music" || role === "sfx" || role === "nat_sound" ? false : !!m?.hasVideo);
    const useAudio = ev.use_audio ?? (isTitle ? false : role === "b_roll" || role === "still" ? false : !!m?.hasAudio);
    if (useVideo && m && !m.hasVideo) errors.push(`${where}: ${m.name} has no video`);
    if (useAudio && m && !m.hasAudio) errors.push(`${where}: ${m.name} has no audio`);

    let srcIn = 0;
    let srcOut = 0;
    let dur;
    if (isTitle) {
      dur = snap(ev.duration_s ?? 3);
    } else {
      if (ev.src_in == null || ev.src_out == null) {
        errors.push(`${where}: src_in and src_out are required`);
        continue;
      }
      srcIn = snap(ev.src_in);
      srcOut = snap(ev.src_out);
      const mediaDur = secondsToTicks(m.duration_s ?? Infinity);
      if (srcOut > mediaDur) {
        const clamped = snapTicks(mediaDur, fps, "floor");
        if (srcOut - clamped > secondsToTicks(0.5)) errors.push(`${where}: src_out ${ev.src_out}s is beyond the media length ${m.duration_s.toFixed(2)}s`);
        else fixes.push(`${where}: src_out clamped to media end`);
        srcOut = clamped;
      }
      if (srcOut <= srcIn) {
        errors.push(`${where}: empty or negative range (${ev.src_in}–${ev.src_out})`);
        continue;
      }
      dur = srcOut - srcIn;
    }

    // Timeline position.
    let start;
    if (ev.at != null) start = snap(ev.at);
    else if (ev.with) {
      const ref = byId.get(ev.with);
      if (!ref) {
        errors.push(`${where}: 'with' refers to unknown/earlier-undefined event ${ev.with}`);
        continue;
      }
      start = snapTicks(ref.start + secondsToTicks(ev.offset_s || 0), fps);
    } else if (ev.after) {
      const ref = byId.get(ev.after);
      if (!ref) {
        errors.push(`${where}: 'after' refers to unknown event ${ev.after}`);
        continue;
      }
      start = ref.end;
    } else if (role === "music" || role === "sfx" || role === "title") {
      start = role === "music" ? 0 : cursor;
    } else {
      start = cursor;
    }
    if (start < 0) {
      errors.push(`${where}: negative timeline position`);
      continue;
    }
    const end = start + dur;
    const storyline = ev.at == null && !ev.with && (role === "a_roll" || role === "b_roll" || role === "still") ;
    if (storyline || ev.after) cursor = Math.max(cursor, end);
    else if ((role === "a_roll" || role === "still") && ev.at != null) cursor = Math.max(cursor, end);

    const lead = snap(ev.audio_lead_s || 0);
    const tail = snap(ev.audio_tail_s || 0);
    if (lead && srcIn - lead < 0) errors.push(`${where}: J-cut lead ${ev.audio_lead_s}s needs ${ev.audio_lead_s}s of media before src_in (only ${ticksToSeconds(srcIn).toFixed(2)}s available)`);
    if (tail && m && srcOut + tail > secondsToTicks(m.duration_s)) errors.push(`${where}: L-cut tail needs media after src_out`);
    if (lead && start - lead < 0) errors.push(`${where}: J-cut would start before the sequence start`);

    const vTrack = (ev.video_track ?? dv ?? 1) - 1;
    let aTrack = (ev.audio_track ?? da ?? 1) - 1;

    const item = {
      id: ev.id, role, section: ev.section || "", source: m ? m.id : null, sourceName: m?.name || ev.title_text || "",
      srcIn, srcOut, start, end, useVideo, useAudio, vTrack, aTrack,
      audioStart: start - lead, audioEnd: end + tail, audioSrcIn: srcIn - lead, audioSrcOut: srcOut + tail,
      lead, tail, ev, media: m,
    };
    laid.push(item);
    byId.set(ev.id, item);
  }

  // Protected tracks / constraints.
  const prot = ctx.protected || { video: [], audio: [] };
  for (const it of laid) {
    if (it.useVideo && prot.video?.includes(it.vTrack)) errors.push(`event ${it.id}: V${it.vTrack + 1} is protected`);
    if (it.useAudio && prot.audio?.includes(it.aTrack)) errors.push(`event ${it.id}: A${it.aTrack + 1} is protected`);
  }

  // Overlaps: video per track are errors; audio overlaps caused by J/L cuts are re-routed (checkerboard).
  const byTrack = (kind) => {
    const map = new Map();
    for (const it of laid) {
      const use = kind === "video" ? it.useVideo : it.useAudio;
      if (!use) continue;
      const t = kind === "video" ? it.vTrack : it.aTrack;
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(it);
    }
    return map;
  };
  for (const [t, list] of byTrack("video")) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      if (list[i].start < list[i - 1].end) errors.push(`V${t + 1}: event ${list[i].id} overlaps ${list[i - 1].id} (${ticksToSeconds(list[i].start).toFixed(2)}s < ${ticksToSeconds(list[i - 1].end).toFixed(2)}s). Put overlays on a higher track.`);
    }
  }
  const audioOcc = new Map();
  const occupied = (t, a, b) => (audioOcc.get(t) || []).some(([x, y]) => a < y && b > x);
  const dialogueTracks = [0, 1];
  for (const it of [...laid].filter((x) => x.useAudio).sort((a, b) => a.audioStart - b.audioStart)) {
    if (occupied(it.aTrack, it.audioStart, it.audioEnd)) {
      const alt = [...(it.role === "a_roll" ? dialogueTracks : []), ...Array.from({ length: 8 }, (_, i) => i)].find(
        (t) => t !== it.aTrack && !occupied(t, it.audioStart, it.audioEnd) && !prot.audio?.includes(t)
      );
      if (alt == null) errors.push(`A${it.aTrack + 1}: audio of ${it.id} overlaps another clip and no free track was found`);
      else {
        fixes.push(`event ${it.id}: audio moved A${it.aTrack + 1}→A${alt + 1} to avoid overlapping another clip (J/L-cut checkerboard)`);
        it.aTrack = alt;
      }
    }
    if (!audioOcc.has(it.aTrack)) audioOcc.set(it.aTrack, []);
    audioOcc.get(it.aTrack).push([it.audioStart, it.audioEnd]);
  }

  // Transitions: resolve names and check handles.
  const avail = ctx.availableTransitions;
  for (const it of laid) {
    const tr = it.ev.transition_in;
    if (!tr || tr.name === "cut" || !it.useVideo) continue;
    const matchName = TRANSITION_ALIASES[tr.name] || tr.name;
    if (avail && !avail.includes(matchName)) {
      warnings.push(`event ${it.id}: transition ${tr.name} is not installed — using a cut`);
      continue;
    }
    let d = snap(tr.duration_s ?? 0.5);
    const prev = laid.filter((p) => p.useVideo && p.vTrack === it.vTrack && p.end === it.start).pop();
    const headIn = it.srcIn;
    const tailPrev = prev && prev.media ? secondsToTicks(prev.media.duration_s) - prev.srcOut : Infinity;
    const available = Math.min(headIn, tailPrev) * 2;
    if (prev && available < d) {
      const nd = snapTicks(Math.max(0, available), fps, "floor");
      if (nd < 2 * tpf) {
        warnings.push(`event ${it.id}: not enough media handles for a ${tr.duration_s}s ${tr.name} — kept as a cut`);
        continue;
      }
      fixes.push(`event ${it.id}: ${tr.name} shortened to ${ticksToSeconds(nd).toFixed(2)}s to fit the available handles`);
      d = nd;
    }
    it.transition = { matchName, duration: d, attachTo: prev ? prev.id : it.id, position: prev ? "end" : "start" };
  }

  // Anti-fabrication: quotes must exist in the transcript for that range.
  for (const it of laid) {
    const q = it.ev.quote;
    if (!q || !it.source) continue;
    const tr = ctx.transcripts?.get?.(it.source);
    if (!tr) {
      warnings.push(`event ${it.id}: quote could not be verified (no transcript for ${it.sourceName})`);
      continue;
    }
    const s0 = ticksToSeconds(it.audioSrcIn) - 0.5;
    const s1 = ticksToSeconds(it.audioSrcOut) + 0.5;
    const text = tr.segments.filter((s) => s.end > s0 && s.start < s1).map((s) => wordsInRange(s, s0, s1)).join(" ");
    const qTok = tokenize(q);
    const tTok = new Set(tokenize(text));
    const hit = qTok.filter((w) => tTok.has(w)).length / Math.max(1, qTok.length);
    if (hit < 0.8) errors.push(`event ${it.id}: the quote "${q.slice(0, 80)}" is not spoken in ${it.sourceName} ${ticksToSeconds(it.srcIn).toFixed(1)}–${ticksToSeconds(it.srcOut).toFixed(1)}s (transcript match ${(hit * 100).toFixed(0)}%). Do not attribute words that are not there.`);
  }

  // Documentary ethics: reordered speech from the same source.
  const ethicsStrict = (ctx.style?.ethics || []).some((r) => /speaker|splice|quote/i.test(r));
  const aRolls = laid.filter((x) => x.role === "a_roll" && x.useAudio).sort((a, b) => a.start - b.start);
  for (let i = 1; i < aRolls.length; i++) {
    const a = aRolls[i - 1];
    const b = aRolls[i];
    if (a.source === b.source && b.srcIn < a.srcOut && !b.ev.splice_note) {
      (ethicsStrict ? errors : warnings).push(`events ${a.id}→${b.id}: speech from ${a.sourceName} is used out of its original order. Add a splice_note explaining why the speaker's meaning is preserved, or reorder.`);
    }
  }

  // Pinned parts from the base version.
  for (const pin of ctx.pins || []) {
    const it = byId.get(pin.eventId) || laid.find((x) => x.source === pin.source && Math.abs(x.srcIn - pin.srcIn) <= tpf && Math.abs(x.srcOut - pin.srcOut) <= tpf);
    if (!it) errors.push(`pinned part "${pin.label}" is missing from the plan — pinned parts must be kept`);
    else if (pin.keepPosition && Math.abs(it.start - pin.start) > tpf) errors.push(`pinned part "${pin.label}" must stay at ${ticksToSeconds(pin.start).toFixed(2)}s`);
    else if (Math.abs(it.srcIn - pin.srcIn) > tpf || Math.abs(it.srcOut - pin.srcOut) > tpf) errors.push(`pinned part "${pin.label}" must keep its source range`);
  }
  for (const c of ctx.constraints || []) applyConstraint(c, laid, errors, warnings);

  // Stats & style checks.
  const visual = laid.filter((x) => x.useVideo && (x.role === "a_roll" || x.role === "b_roll" || x.role === "still"));
  const end = Math.max(0, ...laid.map((x) => Math.max(x.end, x.useAudio ? x.audioEnd : 0)));
  const storyEnd = Math.max(0, ...laid.filter((x) => x.role !== "music").map((x) => Math.max(x.end, x.useAudio ? x.audioEnd : 0)));
  const shotDur = visual.map((x) => ticksToSeconds(x.end - x.start));
  const cuts = cutPoints(visual);
  const avgShot = cuts.length > 1 ? ticksToSeconds(storyEnd) / cuts.length : shotDur[0] || 0;
  const transitions = laid.filter((x) => x.transition).length;
  const stats = {
    duration_s: +ticksToSeconds(storyEnd || end).toFixed(3),
    events: laid.length,
    shots: cuts.length,
    avg_shot_s: +avgShot.toFixed(2),
    transitions,
    sources_used: new Set(laid.map((x) => x.source).filter(Boolean)).size,
  };
  const target = plan.intent?.target_duration_s;
  if (target) {
    const tol = Math.max(1, target * 0.05);
    if (Math.abs(stats.duration_s - target) > tol) warnings.push(`duration ${stats.duration_s.toFixed(1)}s differs from the target ${target}s by more than ${tol.toFixed(1)}s`);
  }
  const pace = ctx.style?.pacing;
  if (pace) {
    const short = shotDur.filter((d) => d < pace.min_shot_s - 0.02).length;
    const long = shotDur.filter((d) => d > pace.max_shot_s + 0.02).length;
    if (short) warnings.push(`${short} shot(s) are shorter than the style minimum ${pace.min_shot_s}s`);
    if (long) warnings.push(`${long} shot(s) are longer than the style maximum ${pace.max_shot_s}s`);
    const maxT = ctx.style?.transitions?.max_per_minute;
    if (maxT != null && stats.duration_s > 0 && transitions / (stats.duration_s / 60) > maxT + 0.5) warnings.push(`${transitions} transitions exceed the style limit (~${maxT}/min)`);
  }

  return { ok: errors.length === 0, errors, warnings, fixes, events: laid, stats, fps, markers: plan.markers || [], hash: hashObject({ events: plan.events, intent: plan.intent || null, markers: plan.markers || null }) };
}

function wordsInRange(seg, s0, s1) {
  if (seg.words?.length) return seg.words.filter((w) => w.end > s0 && w.start < s1).map((w) => w.text).join(" ");
  return seg.text;
}

function cutPoints(visual) {
  // A "shot" is a distinct visible picture interval on the top-most track.
  const pts = new Set();
  for (const v of visual) {
    pts.add(v.start);
    pts.add(v.end);
  }
  const sorted = [...pts].sort((a, b) => a - b);
  const shots = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (visual.some((v) => v.start <= a && v.end >= b)) shots.push([a, b]);
  }
  return shots;
}

function applyConstraint(c, laid, errors, warnings) {
  const secs = (t) => ticksToSeconds(t);
  switch (c.kind) {
    case "no_speech_before": {
      const bad = laid.filter((x) => x.role === "a_roll" && x.useAudio && secs(x.audioStart) < c.seconds - 0.01);
      if (bad.length) errors.push(`constraint "${c.label || "no speech in the first " + c.seconds + "s"}": speech from ${bad.map((b) => b.id).join(", ")} starts before ${c.seconds}s`);
      break;
    }
    case "max_duration": {
      const end = Math.max(...laid.filter((x) => x.role !== "music").map((x) => x.end));
      if (secs(end) > c.seconds + 0.01) errors.push(`constraint: duration ${secs(end).toFixed(1)}s exceeds ${c.seconds}s`);
      break;
    }
    case "exclude_source":
      for (const x of laid) if (x.source === c.source || x.sourceName === c.source) errors.push(`constraint "${c.label || "exclude"}": ${x.id} uses excluded source ${x.sourceName}`);
      break;
    case "keep_source_range": {
      const ok = laid.some((x) => (x.source === c.source || x.sourceName === c.source) && secs(x.srcIn) <= c.in + 0.05 && secs(x.srcOut) >= c.out - 0.05);
      if (!ok) errors.push(`constraint "${c.label || "keep"}": ${c.source} ${c.in}–${c.out}s must stay in the edit`);
      break;
    }
    case "no_transitions":
      if (laid.some((x) => x.transition)) errors.push(`constraint "${c.label || "no transitions"}": remove transitions`);
      break;
    case "end_with_source_range": {
      const story = laid.filter((x) => x.role === "a_roll" || x.role === "b_roll").sort((a, b) => b.end - a.end)[0];
      if (!story || !(story.source === c.source || story.sourceName === c.source) || Math.abs(secs(story.srcIn) - c.in) > 0.5) errors.push(`constraint "${c.label || "ending"}": the edit must end with ${c.source} ${c.in}–${c.out}s`);
      break;
    }
    default:
      if (c.kind && c.kind !== "note") warnings.push(`constraint kind ${c.kind} is advisory only`);
  }
}

// ------------------------------------------------------------------ compile
/**
 * Compile a resolved plan into ordered host operations. Operations refer to
 * items created earlier via refs like "e3.video" resolved at run time.
 */
export function compilePlan(resolved, { sequenceName, likeSeqId, frame, dbDuck = 14 } = {}) {
  const ops = [];
  let n = 0;
  const op = (kind, args, deps = [], label = "") => {
    const id = `op${++n}`;
    ops.push({ id, kind, args, deps, label: label || kind });
    return id;
  };
  const seqOp = op("create_sequence", { name: sequenceName, likeSeqId, frame }, [], `New sequence "${sequenceName}"`);
  const placeOps = new Map();
  const ev = resolved.events;

  // 1. Picture + sound placement (linked when timings coincide, split for J/L).
  for (const it of ev) {
    if (it.role === "title") continue;
    const linked = it.useVideo && it.useAudio && !it.lead && !it.tail;
    const deps = [seqOp];
    if (linked) {
      const id = op("place", { event: it.id, source: it.source, srcIn: it.srcIn, srcOut: it.srcOut, time: it.start, videoTrack: it.vTrack, audioTrack: it.aTrack, video: true, audio: true, refs: [`${it.id}.video`, `${it.id}.audio`] }, deps, `${it.id} ${it.sourceName}`);
      placeOps.set(`${it.id}.video`, id).set(`${it.id}.audio`, id);
    } else {
      if (it.useVideo) placeOps.set(`${it.id}.video`, op("place", { event: it.id, source: it.source, srcIn: it.srcIn, srcOut: it.srcOut, time: it.start, videoTrack: it.vTrack, audioTrack: it.aTrack, video: true, audio: false, refs: [`${it.id}.video`] }, deps, `${it.id} picture ${it.sourceName}`));
      if (it.useAudio) placeOps.set(`${it.id}.audio`, op("place", { event: it.id, source: it.source, srcIn: it.audioSrcIn, srcOut: it.audioSrcOut, time: it.audioStart, videoTrack: it.vTrack, audioTrack: it.aTrack, video: false, audio: true, refs: [`${it.id}.audio`] }, deps, `${it.id} sound ${it.sourceName}${it.lead ? " (J-cut)" : ""}${it.tail ? " (L-cut)" : ""}`));
    }
  }

  // 2. Titles.
  for (const it of ev.filter((x) => x.role === "title")) {
    if (it.ev.mogrt) {
      const ins = op("insert_mogrt", { path: it.ev.mogrt, time: it.start, videoTrack: it.vTrack, ref: `${it.id}.video` }, [seqOp], `title ${it.ev.title_text || ""}`);
      placeOps.set(`${it.id}.video`, ins);
      if (it.ev.title_text) op("set_mogrt_text", { ref: `${it.id}.video`, text: it.ev.title_text }, [ins], `title text`);
    } else {
      op("add_marker", { time: it.start, duration: it.end - it.start, name: `TITLE: ${it.ev.title_text || ""}`, comments: "No MOGRT template set — add a title here (Essential Graphics), or set a default MOGRT in Settings.", color: 5 }, [seqOp], `title marker`);
    }
  }

  // 3. Audio levels: gain + fades + ducking merged into one envelope per audio part.
  for (const it of ev.filter((x) => x.useAudio)) {
    const ref = `${it.id}.audio`;
    const envelope = gainEnvelope(it, ev, resolved.fps, dbDuck);
    if (!envelope) continue;
    op("set_volume", { ref, ...envelope }, [placeOps.get(ref)], `${it.id} level${envelope.keyframes ? " (keyframed)" : ""}`);
  }

  // 4. Effects & transforms.
  for (const it of ev.filter((x) => x.useVideo)) {
    const ref = `${it.id}.video`;
    for (const fx of it.ev.effects || []) {
      const a = op("add_effect", { ref, name: fx.name }, [placeOps.get(ref)], `${it.id} + ${fx.name}`);
      for (const [param, value] of Object.entries(fx.params || {})) op("set_param", { ref, component: fx.name, param, value }, [a], `${it.id} ${fx.name}.${param}`);
    }
    const tf = it.ev.transform;
    if (tf) {
      const d = it.end - it.start;
      const anim = tf.animate_to || {};
      if (tf.scale != null || anim.scale != null) {
        const from = tf.scale ?? 100;
        op("set_param", anim.scale != null ? { ref, component: "Motion", param: "Scale", keyframes: [{ t: 0, value: from }, { t: d, value: anim.scale }], interpolation: "bezier" } : { ref, component: "Motion", param: "Scale", value: from }, [placeOps.get(ref)], `${it.id} scale`);
      }
      if (tf.position || anim.position) {
        const from = tf.position || { x: 0.5, y: 0.5 };
        op("set_param", anim.position ? { ref, component: "Motion", param: "Position", keyframes: [{ t: 0, value: from }, { t: d, value: anim.position }] } : { ref, component: "Motion", param: "Position", value: from }, [placeOps.get(ref)], `${it.id} position`);
      }
      if (tf.rotation != null) op("set_param", { ref, component: "Motion", param: "Rotation", value: tf.rotation }, [placeOps.get(ref)], `${it.id} rotation`);
      if (tf.opacity != null) op("set_param", { ref, component: "Opacity", param: "Opacity", value: tf.opacity }, [placeOps.get(ref)], `${it.id} opacity`);
    }
  }

  // 5. Transitions last (neighbours must exist).
  for (const it of ev.filter((x) => x.transition)) {
    const ref = `${it.transition.attachTo}.video`;
    op("add_transition", { ref, matchName: it.transition.matchName, durationTicks: it.transition.duration, position: it.transition.position }, [placeOps.get(ref), placeOps.get(`${it.id}.video`)].filter(Boolean), `${it.transition.matchName.replace("AE.ADBE ", "")} into ${it.id}`);
  }

  // 6. Section markers + plan markers.
  const sections = [];
  for (const it of [...ev].sort((a, b) => a.start - b.start)) {
    if (it.section && !sections.find((s) => s.name === it.section)) sections.push({ name: it.section, start: it.start });
  }
  for (const s of sections) op("add_marker", { time: s.start, name: `§ ${s.name}`, comments: "HSN section", color: 0 }, [seqOp], `marker ${s.name}`);
  for (const mk of resolved.markers || []) op("add_marker", { time: secondsToTicks(mk.at), name: mk.name, comments: mk.note || "" }, [seqOp], `marker ${mk.name}`);

  op("activate_sequence", {}, [seqOp], "Show the new sequence");
  return ops;
}

function gainEnvelope(it, all, fps, dbDuck) {
  const base = it.ev.gain_db ?? 0;
  const len = it.audioEnd - it.audioStart;
  const pts = [];
  const tpf = ticksPerFrame(fps);
  const fin = it.ev.fade_in_s ? Math.min(secondsToTicks(it.ev.fade_in_s), len / 2) : 0;
  const fout = it.ev.fade_out_s ? Math.min(secondsToTicks(it.ev.fade_out_s), len / 2) : 0;
  const duckRanges = [];
  if (it.ev.duck_under?.length) {
    const depth = it.ev.duck_db ?? dbDuck;
    for (const id of it.ev.duck_under) {
      const o = all.find((x) => x.id === id);
      if (!o) continue;
      const a = Math.max(o.useAudio ? o.audioStart : o.start, it.audioStart) - it.audioStart;
      const b = Math.min(o.useAudio ? o.audioEnd : o.end, it.audioEnd) - it.audioStart;
      if (b > a) duckRanges.push([a, b, depth]);
    }
  }
  if (!fin && !fout && !duckRanges.length) return base !== 0 ? { db: base } : null;
  const ramp = Math.min(secondsToTicks(0.3), 8 * tpf);
  const level = (t) => {
    let db = base;
    for (const [a, b, d] of mergeRanges(duckRanges)) {
      if (t >= a && t <= b) db = base - d;
      else if (t > a - ramp && t < a) db = Math.min(db, base - d * ((t - (a - ramp)) / ramp));
      else if (t > b && t < b + ramp) db = Math.min(db, base - d * (1 - (t - b) / ramp));
    }
    return db;
  };
  const times = new Set([0, len]);
  if (fin) times.add(fin);
  if (fout) times.add(len - fout);
  for (const [a, b] of mergeRanges(duckRanges)) [a - ramp, a, b, b + ramp].forEach((t) => t > 0 && t < len && times.add(t));
  for (const t of [...times].sort((a, b) => a - b)) {
    let db = level(t);
    if (fin && t === 0) db = -60;
    if (fout && t === len) db = -60;
    pts.push({ t: Math.round(t / tpf) * tpf, db: +db.toFixed(2) });
  }
  return { keyframes: pts };
}

function mergeRanges(r) {
  const s = [...r].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1] + secondsToTicks(0.6)) {
      last[1] = Math.max(last[1], x[1]);
      last[2] = Math.max(last[2], x[2]);
    } else out.push([...x]);
  }
  return out;
}

/** Compact, human-readable plan summary (for plan cards and tool results). */
export function summarizeResolved(resolved) {
  const lines = resolved.events.map((e) => {
    const t = `${ticksToSeconds(e.start).toFixed(2)}–${ticksToSeconds(e.end).toFixed(2)}s`;
    const src = e.source ? `${e.sourceName} [${ticksToSeconds(e.srcIn).toFixed(2)}–${ticksToSeconds(e.srcOut).toFixed(2)}]` : `"${e.ev.title_text || ""}"`;
    const tracks = `${e.useVideo ? `V${e.vTrack + 1}` : ""}${e.useVideo && e.useAudio ? "/" : ""}${e.useAudio ? `A${e.aTrack + 1}` : ""}`;
    const jl = `${e.lead ? ` J-${ticksToSeconds(e.lead).toFixed(1)}s` : ""}${e.tail ? ` L+${ticksToSeconds(e.tail).toFixed(1)}s` : ""}`;
    return `${e.id} ${e.role} ${tracks} ${t} ← ${src}${jl}${e.transition ? ` +${e.transition.matchName.replace("AE.ADBE ", "")}` : ""}`;
  });
  return lines.join("\n");
}

export { TRANSITION_ALIASES };
