// Tools that read the project and understand footage.
import { S } from "../../core/schema.js";
import { timelineText, timelineChecks } from "../format.js";
import { ticksToSeconds } from "../../core/time.js";

const SCOPES = ["timeline", "selection", "inout", "bin", "project"];

export const perceptionTools = [
  {
    name: "get_timeline_state",
    description:
      "Read the current state of a sequence (default: the active one): tracks, clips with keys, source in/out, timeline positions, inferred A/V links, markers, In/Out, playhead and selection. Call this before editing and again after the user changes things.",
    input_schema: S.obj({ sequence_id: S.str("sequence id or name; omit for the active sequence") }),
    async handler(i, ctx) {
      const tl = await ctx.host.readTimeline(i.sequence_id);
      ctx.state.lastTimeline = tl;
      const seqs = await ctx.host.listSequences();
      return { text: `${timelineText(tl)}\n\nAll sequences: ${seqs.map((s) => `${s.active ? "*" : ""}"${s.name}" [${s.id}]`).join(", ")}`, untrusted: true };
    },
  },
  {
    name: "get_project_media",
    description: "List media in the project (id, name, bin, path, duration, fps) and what the footage index already knows about each (notes/transcript coverage). Optionally filter by bin.",
    input_schema: S.obj({ bin: S.str("bin path filter, e.g. 'Footage/Day 1'"), include_sequences: S.bool("also list sequences") }),
    async handler(i, ctx) {
      const items = await ctx.host.projectItems({ includeSequences: !!i.include_sequences });
      const rows = [];
      for (const e of items) {
        if (i.bin && !(e.bin || "").startsWith(i.bin)) continue;
        if (e.kind === "bin") continue;
        const d = e.kind === "clip" ? await ctx.host.clipDetails(e) : e;
        const ix = ctx.index.get(e.id);
        rows.push(`${e.kind === "sequence" ? "SEQ " : ""}${e.name} [id ${e.id}] bin "${e.bin || "/"}" ${d.durationTicks != null ? ticksToSeconds(d.durationTicks).toFixed(2) + "s" : ""} ${d.fps ? d.fps + "fps" : ""}${d.offline ? " OFFLINE" : ""}${ix ? ` · indexed: ${ix.notes.length} notes, ${ix.frames.length} frames, transcript ${ix.transcript ? "yes" : "no"}` : " · not analyzed"}`);
      }
      return { text: rows.length ? rows.join("\n") : "No media found.", untrusted: true };
    },
  },
  {
    name: "get_work_scope",
    description: "Return the work scope the user selected in the panel (timeline / selected clips / In-Out range / Project-panel selection / whole project) and whether full-source analysis is enabled, resolved into concrete media and ranges.",
    input_schema: S.obj({ scope: S.enm(SCOPES, "override the panel's scope"), full_source: S.bool("override: analyze whole source files instead of only the parts in scope") }),
    async handler(i, ctx) {
      const scope = i.scope || ctx.settings.get("analysisScope");
      const full = i.full_source ?? ctx.settings.get("analyzeFullSource");
      const r = await ctx.analyzer.resolveScope(scope, { fullSource: full });
      ctx.state.lastScope = r;
      return { text: `${r.description}\n${r.uses.map((u) => `- ${u.name} [id ${u.mediaId}] ranges ${u.ranges.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`).join(", ")}${u.duration_s ? ` of ${u.duration_s.toFixed(2)}s` : ""}${u.timeline.length ? ` · on timeline as ${u.timeline.map((t) => t.key).join(", ")}` : ""}`).join("\n")}`, untrusted: true };
    },
  },
  {
    name: "analyze_footage",
    description:
      "Tier-1 analysis of the footage in scope: metadata, representative frames (returned as images), transcripts (Premiere or local Whisper), silences/loudness/beats (helper), scene cuts. Frames are samples — say so; do not claim to have watched every frame. Uses the panel's scope unless overridden. After looking at the frames, call record_shot_notes.",
    input_schema: S.obj({
      scope: S.enm(SCOPES, "override scope"),
      full_source: S.bool("analyze entire source files, not only the parts in scope"),
      media_ids: S.arr(S.str("media id"), "analyze only these media"),
      frames_per_clip: S.int("frames per clip (default from settings)", { minimum: 0, maximum: 24 }),
      want: S.obj({ frames: S.bool("frames"), transcript: S.bool("transcripts"), audio: S.bool("audio features"), scenes: S.bool("scene detection") }),
    }),
    async handler(i, ctx) {
      if (!(await ctx.ensureConsent("frames"))) return { isError: true, text: "The user has not allowed sending frames to Claude. Ask them to allow it in the upload-consent prompt or Settings." };
      const scopeRes = await ctx.analyzer.resolveScope(i.scope || ctx.settings.get("analysisScope"), { fullSource: i.full_source ?? ctx.settings.get("analyzeFullSource"), mediaIds: i.media_ids });
      if (!scopeRes.uses.length) return { isError: true, text: `Nothing to analyze: ${scopeRes.description}.` };
      const r = await ctx.analyzer.indexUses(scopeRes, { framesPerClip: i.frames_per_clip, want: i.want, signal: ctx.signal, onProgress: ctx.progress });
      return { text: r.text, images: r.images.map((im) => ({ ...im, label: `${im.mediaId} @ ${im.t.toFixed(2)}s (${im.name})` })), untrusted: true };
    },
  },
  {
    name: "view_frames",
    description: "Tier-2 look: get frames of one media file at specific source times (seconds), e.g. to confirm a search hit, check focus/shake, or pick exact in/out points. Keep requests small (≤ 12 frames).",
    input_schema: S.obj({ media_id: S.str("media id or path"), times: S.arr(S.num("seconds in source media"), "times", { minItems: 1, maxItems: 16 }), width: S.int("pixel width (default 512; up to 1024 for detail)", { minimum: 160, maximum: 1024 }) }, ["media_id", "times"]),
    async handler(i, ctx) {
      if (!(await ctx.ensureConsent("frames"))) return { isError: true, text: "Frame upload not allowed by the user." };
      const scope = await ctx.analyzer.resolveScope("project", { mediaIds: [i.media_id] });
      const u = scope.uses[0];
      if (!u) return { isError: true, text: `Unknown media ${i.media_id}` };
      ctx.index.upsert({ id: u.mediaId, path: u.path, name: u.name, duration_s: u.duration_s, fps: u.fps, hasVideo: true, hasAudio: true });
      const tl = ctx.state.lastTimeline;
      const onTl = tl ? [...tl.tracks.video].flatMap((t) => t.items).filter((x) => x.projectItemId === u.mediaId).map((x) => ({ key: x.key, start: ticksToSeconds(x.start), end: ticksToSeconds(x.end), in: ticksToSeconds(x.in), out: ticksToSeconds(x.in) + ticksToSeconds(x.end - x.start), kind: "video" })) : [];
      const inTimeline = i.times.every((t) => onTl.some((x) => t >= x.in && t < x.out));
      const frames = await ctx.analyzer.frames({ ...u, timeline: onTl }, i.times, { width: i.width || 512, fullSource: !inTimeline, signal: ctx.signal });
      ctx.index.addFrames(u.mediaId, frames.map((f) => ({ t: f.t, scope: f.scope })));
      return { text: `${frames.length} frame(s) of ${u.name} (${frames[0]?.scope || "n/a"}).`, images: frames.map((f) => ({ mediaId: u.mediaId, t: f.t, base64: f.base64, label: `${u.name} @ ${f.t.toFixed(2)}s` })), untrusted: true };
    },
  },
  {
    name: "record_shot_notes",
    description: "Store what you observed in frames/transcript for a media file: per-range description, shot type (ECU/CU/MCU/MS/WS/EWS/aerial/insert/POV), camera motion (static/pan/tilt/handheld/push/pull/gimbal/drone), subjects, tags, usability and visible issues (shake, soft focus, over/under-exposure, dropped frames). Include a confidence (0–1): lower it when inferring between sampled frames.",
    input_schema: S.obj(
      {
        media_id: S.str("media id"),
        notes: S.arr(
          S.obj(
            {
              start: S.num("source seconds", { minimum: 0 }),
              end: S.num("source seconds", { minimum: 0 }),
              description: S.str("what is visible/audible"),
              shot_type: S.str("framing"),
              motion: S.str("camera/subject motion"),
              subjects: S.arr(S.str("subject"), "people/objects"),
              tags: S.arr(S.str("tag"), "search tags, Arabic and/or English"),
              usable: S.enm(["yes", "maybe", "no"], "editorial usability"),
              issues: S.arr(S.str("issue"), "technical problems seen"),
              potential_use: S.str("e.g. hook, establishing, detail, reaction, transition"),
              confidence: S.num("0..1", { minimum: 0, maximum: 1 }),
            },
            ["start", "end", "description", "confidence"]
          ),
          "notes",
          { minItems: 1, maxItems: 80 }
        ),
      },
      ["media_id", "notes"]
    ),
    async handler(i, ctx) {
      const m = ctx.index.get(i.media_id);
      if (!m) return { isError: true, text: `Unknown media ${i.media_id}; run analyze_footage first.` };
      const n = ctx.index.addNotes(m.id, i.notes);
      return `Stored ${i.notes.length} note(s) for ${m.name} (${n} total).`;
    },
  },
  {
    name: "search_footage",
    description: "Search the footage index in natural language (Arabic or English), e.g. 'hands holding the product' or 'لقطات اليد وهي تمسك المنتج'. Matches your stored visual notes and transcripts; results are candidates — confirm with view_frames before relying on them. Unanalyzed media cannot be found by content.",
    input_schema: S.obj({ query: S.str("what to find"), limit: S.int("max results", { minimum: 1, maximum: 40 }), media_ids: S.arr(S.str("media id"), "restrict to") }, ["query"]),
    async handler(i, ctx) {
      const hits = ctx.index.search(i.query, { limit: i.limit || 12, mediaIds: i.media_ids });
      const unindexed = Object.values(ctx.index.media).filter((m) => !m.notes.length).length;
      if (!hits.length) return { text: `No matches for "${i.query}".${unindexed ? ` ${unindexed} media file(s) have no visual notes yet — analyze them first.` : ""}`, untrusted: true };
      return { text: hits.map((h) => `${h.name} [${h.media_id}] ${h.start.toFixed(2)}–${h.end.toFixed(2)}s ${h.kind} score ${h.score.toFixed(2)}${h.confidence != null ? ` conf ${h.confidence}` : ""}: ${h.text}`).join("\n"), untrusted: true };
    },
  },
  {
    name: "get_transcript",
    description: "Get the timed transcript for a media file (Premiere transcript first; else local Whisper via the helper, which supports Arabic). Optionally only a time range.",
    input_schema: S.obj({ media_id: S.str("media id or path"), from_s: S.num("start seconds"), to_s: S.num("end seconds"), generate: S.bool("transcribe now if missing (may take a while)"), language: S.str("language code for Premiere/Whisper, e.g. 'ar' or 'en-us'") }, ["media_id"]),
    async handler(i, ctx) {
      if (!(await ctx.ensureConsent("transcripts"))) return { isError: true, text: "Transcript upload not allowed by the user." };
      const scope = await ctx.analyzer.resolveScope("project", { mediaIds: [i.media_id] });
      const u = scope.uses[0];
      if (!u) return { isError: true, text: `Unknown media ${i.media_id}` };
      ctx.index.upsert({ id: u.mediaId, path: u.path, name: u.name, duration_s: u.duration_s, hasVideo: true, hasAudio: true });
      let tr = ctx.index.get(u.mediaId).transcript;
      if (!tr && i.generate) {
        if (ctx.host.capabilities?.transcribe && i.language && !/^ar/.test(i.language)) tr = await ctx.host.transcribe(u.mediaId, i.language).catch(() => null);
        if (!tr) tr = await ctx.analyzer.transcriptFor(u);
        if (tr?.error) return { isError: true, text: tr.error };
        ctx.index.setTranscript(u.mediaId, tr);
      } else if (!tr) {
        tr = await ctx.analyzer.transcriptFor(u, { allowHelper: false });
        if (tr?.error) return { isError: true, text: `${tr.error}. Call again with generate=true to transcribe.` };
        ctx.index.setTranscript(u.mediaId, tr);
      }
      const segs = tr.segments.filter((s) => (i.from_s == null || s.end > i.from_s) && (i.to_s == null || s.start < i.to_s));
      return { text: `Transcript of ${u.name} (${tr.source}, ${tr.language || "?"}):\n${segs.map((s) => `${s.start.toFixed(2)}–${s.end.toFixed(2)} ${s.speaker ? s.speaker + ": " : ""}${s.text}`).join("\n") || "(no speech in range)"}`, untrusted: true };
    },
  },
  {
    name: "analyze_audio",
    description: "Measure audio with the local helper (ffmpeg): silences (for pacing/cuts), integrated loudness (LUFS) and true peak, and beat/onset times for music (cut-to-beat). Values are measurements; report them as such.",
    input_schema: S.obj({ media_id: S.str("media id or path"), silence_db: S.num("silence threshold dBFS (default -35)"), min_silence_s: S.num("minimum silence length (default 0.4)"), beats: S.bool("detect beats/onsets") }, ["media_id"]),
    async handler(i, ctx) {
      if (!ctx.helper?.available) return { isError: true, text: "Audio measurement needs the local helper. It is offline. Suggest starting it, or proceed using transcript timing." };
      const scope = await ctx.analyzer.resolveScope("project", { mediaIds: [i.media_id] });
      const u = scope.uses[0];
      if (!u) return { isError: true, text: `Unknown media ${i.media_id}` };
      const a = await ctx.helper.call("audio", { path: u.path, silence: true, loudness: true, beats: !!i.beats, silenceDb: i.silence_db, minSilence: i.min_silence_s });
      ctx.index.upsert({ id: u.mediaId, path: u.path, name: u.name, duration_s: u.duration_s, hasVideo: true, hasAudio: true });
      ctx.index.setAudio(u.mediaId, { ...a, analyzedBy: "helper/ffmpeg" });
      return ctx.index.describe(u.mediaId);
    },
  },
  {
    name: "list_effects_and_transitions",
    description: "List the video effects (match names), audio effects and video transitions actually installed in this Premiere, so you only use what exists.",
    input_schema: S.obj({ filter: S.str("substring filter") }),
    async handler(i, ctx) {
      const [fx, tr] = await Promise.all([ctx.host.listEffects(), ctx.host.listTransitions()]);
      const f = (x) => !i.filter || String(x).toLowerCase().includes(i.filter.toLowerCase());
      return `Video transitions: ${tr.filter(f).join(", ")}\nVideo effects: ${fx.video.filter((v) => f(v.matchName) || f(v.displayName)).map((v) => `${v.displayName} (${v.matchName})`).join(", ")}\nAudio effects: ${fx.audio.filter(f).join(", ")}\nNot available through the API: audio transitions (use fades), speed/reverse changes (use render_derivative), razor (split is emulated).`;
    },
  },
  {
    name: "check_timeline",
    description: "Technical review of a sequence after editing: flash frames, tiny gaps (black flashes), overlaps, A/V sync of linked clips, disabled clips, empty picture.",
    input_schema: S.obj({ sequence_id: S.str("sequence id; default active") }),
    async handler(i, ctx) {
      const tl = await ctx.host.readTimeline(i.sequence_id);
      const issues = timelineChecks(tl);
      return issues.length ? `Found ${issues.length} issue(s):\n- ${issues.join("\n- ")}` : `No technical issues found in "${tl.sequence.name}" (${ticksToSeconds(tl.sequence.endTicks).toFixed(2)}s).`;
    },
  },
];
