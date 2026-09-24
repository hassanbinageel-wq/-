// Captions, titles, derived renders (helper), format versions, reference
// analysis and export.
import { S } from "../../core/schema.js";
import { parseTime, secondsToTicks, ticksToSeconds } from "../../core/time.js";
import { cuesFromTimeline, toSrt, parseSrt } from "../../editing/captions.js";
import { STYLE_SPEC_SCHEMA } from "../../editing/styles.js";
import { joinPath } from "../../storage/fsio.js";
import { uid, safeFileName } from "../util-tools.js";

async function outputDir(ctx, sub) {
  const pr = await ctx.host.project();
  const base = pr.path ? pr.path.replace(/[\\/][^\\/]*$/, "") : await ctx.fsio.dataDir();
  const dir = joinPath(ctx.fsio, base, "HSN AI Editor", sub);
  await ctx.fsio.mkdir(dir);
  return dir;
}

export const deliveryTools = [
  {
    name: "build_captions",
    description: "Build caption cues for a sequence from the transcripts of the audio clips on it (timed to the sequence). Returns cues so you can review or translate them (Arabic ↔ English) before write_captions. Media without transcripts are listed.",
    input_schema: S.obj({ sequence_id: S.str("default active"), max_chars: S.int("characters per line (default 42)", { minimum: 16, maximum: 80 }) }),
    async handler(i, ctx) {
      const tl = await ctx.host.readTimeline(i.sequence_id);
      const cues = cuesFromTimeline(tl, ctx.index, { maxChars: i.max_chars || 42 });
      const missing = [...new Set(tl.tracks.audio.flatMap((t) => t.items).filter((it) => !(ctx.index.get(it.projectItemId)?.transcript)).map((it) => it.name))];
      return { text: `${cues.length} cue(s) for "${tl.sequence.name}":\n${cues.map((c, k) => `${k + 1}. ${c.start.toFixed(2)}–${c.end.toFixed(2)} ${c.text}`).join("\n")}${missing.length ? `\nNo transcript for: ${missing.join(", ")} (use get_transcript generate=true).` : ""}`, untrusted: true };
    },
  },
  {
    name: "write_captions",
    description: "Write captions as an SRT file (UTF-8; Arabic lines get RTL marks) next to the project and import it into the bin 'HSN Captions'. Use for original-language or translated subtitles (you provide translated text; keep timings). The UXP API cannot create caption tracks directly: tell the user to drag the imported caption item onto the timeline (or File > Import onto a caption track).",
    input_schema: S.obj(
      {
        cues: S.arr(S.obj({ start: S.num("sequence seconds"), end: S.num("sequence seconds"), text: S.str("caption text") }, ["start", "end", "text"]), "cues", { minItems: 1, maxItems: 3000 }),
        language: S.str("e.g. ar, en"),
        file_name: S.str("file name without extension"),
        max_chars: S.int("characters per line", { minimum: 16, maximum: 80 }),
        import: S.bool("import into the project (default true)"),
      },
      ["cues", "language"]
    ),
    async handler(i, ctx) {
      const dir = await outputDir(ctx, "captions");
      const name = `${safeFileName(i.file_name || `captions_${i.language}`)}.srt`;
      const path = joinPath(ctx.fsio, dir, name);
      await ctx.fsio.writeText(path, toSrt(i.cues, { maxChars: i.max_chars || 42 }));
      let imported = "";
      if (i.import !== false) {
        try {
          const r = await ctx.host.importFiles([path], { bin: "HSN Captions" });
          imported = `Imported into bin "HSN Captions" as ${r.map((x) => x.name).join(", ") || "(item)"}. Drag it onto the timeline to create the caption track.`;
        } catch (e) {
          imported = `Import failed (${e.message}); the SRT file is ready to import manually.`;
        }
      }
      ctx.memory.log(`Captions written: ${path} (${i.cues.length} cues)`);
      return `SRT saved: ${path}\n${imported}`;
    },
  },
  {
    name: "read_captions",
    description: "Read an existing SRT file (e.g. from a translator) into cues.",
    input_schema: S.obj({ path: S.str("absolute path") }, ["path"]),
    async handler(i, ctx) {
      const cues = parseSrt(await ctx.fsio.readText(i.path));
      return { text: cues.map((c, k) => `${k + 1}. ${c.start.toFixed(2)}–${c.end.toFixed(2)} ${c.text}`).join("\n"), untrusted: true };
    },
  },
  {
    name: "insert_title",
    description: "Insert a Motion Graphics template (MOGRT) title/lower third at a time on a video track and try to set its text. Uses the given .mogrt or the default from Settings > Brand. Setting MOGRT text through the API is experimental; if it fails the title is inserted and the user edits the text in Essential Graphics.",
    input_schema: S.obj({ mogrt: S.str("path to .mogrt (optional)"), text: S.str("title text"), at: S.time("timeline time"), duration_s: S.num("duration", { minimum: 0.2 }), video_track: S.int("1-based (default 3)", { minimum: 1 }), lower_third: S.bool("use the lower-third template from settings"), sequence_id: S.str("default active") }, ["text", "at"]),
    async handler(i, ctx) {
      const brand = ctx.settings.get("brand") || {};
      const mogrt = i.mogrt || (i.lower_third ? brand.lowerThirdMogrt : brand.titleMogrt);
      if (!mogrt) return { isError: true, text: "No MOGRT template path. Ask the user to set one in Settings > Brand (title / lower third), or provide a .mogrt path." };
      const tl = await ctx.host.readTimeline(i.sequence_id);
      const t = parseTime(i.at, tl.sequence.fps);
      const it = await ctx.host.insertMogrt(mogrt, { time: t, videoTrack: (i.video_track || 3) - 1, seqId: tl.sequence.id });
      const out = [`Inserted ${mogrt.split(/[\\/]/).pop()} at ${ticksToSeconds(t).toFixed(2)}s${it.key ? ` [${it.key}]` : ""}.`];
      if (it.key) {
        try {
          await ctx.host.setMogrtText(it.key, i.text, { seqId: tl.sequence.id });
          out.push(`Text set: "${i.text}".`);
        } catch (e) {
          out.push(`Could not set the text automatically (${e.message}) — set "${i.text}" in Essential Graphics.`);
        }
        if (i.duration_s) {
          try {
            await ctx.host.setItemRange(it.key, { end: t + secondsToTicks(i.duration_s) }, { seqId: tl.sequence.id, linked: false });
          } catch (e) {
            out.push(`Duration not changed: ${e.message}`);
          }
        }
      }
      ctx.memory.log(`Title "${i.text}"`);
      return out.join(" ");
    },
  },
  {
    name: "render_derivative",
    description:
      "Create a new media file from a source range with the local helper (ffmpeg), import it into bin 'HSN Renders', and optionally place it. Use for things the Premiere API cannot do directly: speed change / slow motion, reverse, speed ramps (piecewise speeds), baking a LUT (.cube) you were given, crop-reframe to 9:16 / 1:1 / 4:5 around a centre point, freeze frame. Originals are never modified.",
    input_schema: S.obj(
      {
        kind: S.enm(["speed", "reverse", "ramp", "lut", "reframe", "freeze"], "render type"),
        media_id: S.str("source media id/path"),
        src_in: S.num("source seconds", { minimum: 0 }),
        src_out: S.num("source seconds", { minimum: 0 }),
        speed: S.num("playback speed, e.g. 0.5 = half speed", { minimum: 0.05, maximum: 20 }),
        ramp: S.arr(S.obj({ from_s: S.num("source seconds"), to_s: S.num("source seconds"), speed: S.num("speed", { minimum: 0.05, maximum: 20 }) }, ["from_s", "to_s", "speed"]), "piecewise speed segments"),
        keep_audio: S.bool("keep audio (pitch-corrected with atempo for speed changes)"),
        lut_path: S.str(".cube LUT path"),
        aspect: S.enm(["9:16", "1:1", "4:5", "16:9"], "reframe aspect"),
        center_x: S.num("0..1 horizontal centre of interest", { minimum: 0, maximum: 1 }),
        center_y: S.num("0..1 vertical centre", { minimum: 0, maximum: 1 }),
        freeze_s: S.num("freeze duration", { minimum: 0.1, maximum: 30 }),
        place_at: S.time("place on the active timeline at this time (optional)"),
        video_track: S.int("1-based track for placing", { minimum: 1 }),
      },
      ["kind", "media_id", "src_in", "src_out"]
    ),
    async handler(i, ctx) {
      if (!ctx.helper?.available) return { isError: true, text: "Rendering needs the local helper (ffmpeg), which is offline. Alternative inside Premiere: tell the user to use Clip > Speed/Duration (the API cannot change speed)." };
      const scope = await ctx.analyzer.resolveScope("project", { mediaIds: [i.media_id] });
      const u = scope.uses[0];
      if (!u) return { isError: true, text: `Unknown media ${i.media_id}` };
      const dir = await outputDir(ctx, "renders");
      const out = joinPath(ctx.fsio, dir, `${safeFileName(u.name.replace(/\.[^.]+$/, ""))}_${i.kind}_${uid()}.mov`);
      const r = await ctx.helper.call("render", { ...i, path: u.path, output: out }, { timeoutMs: 30 * 60 * 1000, signal: ctx.signal });
      const imported = await ctx.host.importFiles([r.output], { bin: "HSN Renders" });
      const text = [`Rendered ${i.kind}: ${r.output} (${r.duration?.toFixed?.(2) ?? "?"}s). Imported: ${imported.map((x) => `${x.name} [${x.id}]`).join(", ")}.`];
      if (i.place_at != null && imported[0]) {
        const tl = await ctx.host.readTimeline();
        const items = await ctx.host.placeSegment({ source: imported[0].id, srcIn: 0, srcOut: secondsToTicks(r.duration), time: parseTime(i.place_at, tl.sequence.fps), videoTrack: (i.video_track || 2) - 1, audioTrack: 1, audio: !!i.keep_audio });
        text.push(`Placed as ${items.map((x) => x.key).join(", ")}.`);
      }
      ctx.memory.log(`Render ${i.kind} of ${u.name}`);
      return text.join("\n");
    },
  },
  {
    name: "create_format_version",
    description: "Make a vertical (9:16), square (1:1) or 4:5 copy of a sequence: duplicates it, changes the frame size, and reframes every video clip with Motion scale/position so the frame is filled, using per-clip centres of interest you choose from the frames (default centre). Titles/graphics may need manual adjustment.",
    input_schema: S.obj({ sequence_id: S.str("source sequence (default active)"), aspect: S.enm(["9:16", "1:1", "4:5"], "target aspect"), name: S.str("new sequence name"), centers: S.arr(S.obj({ key: S.str("clip key in the SOURCE sequence"), x: S.num("0..1", { minimum: 0, maximum: 1 }), y: S.num("0..1", { minimum: 0, maximum: 1 }) }, ["key", "x"]), "centre of interest per clip") }, ["aspect"]),
    async handler(i, ctx) {
      const src = await ctx.host.readTimeline(i.sequence_id);
      const [aw, ah] = i.aspect.split(":").map(Number);
      const long = Math.max(src.sequence.width, src.sequence.height);
      const W = aw >= ah ? long : Math.round((long * aw) / ah / 2) * 2;
      const H = aw >= ah ? Math.round((long * ah) / aw / 2) * 2 : long;
      const copy = await ctx.host.cloneSequence(src.sequence.id, i.name || `${src.sequence.name} — ${i.aspect}`);
      await ctx.host.setFrameSize(copy.id, W, H);
      const tl = await ctx.host.readTimeline(copy.id);
      const results = [];
      for (const it of tl.tracks.video.flatMap((t) => t.items)) {
        const m = ctx.index.get(it.projectItemId);
        const sw = m?.width || src.sequence.width;
        const sh = m?.height || src.sequence.height;
        const scale = Math.max(W / sw, H / sh) * 100;
        // the duplicate keeps positions, so source keys match
        const c = (i.centers || []).find((x) => x.key === it.key) || { x: 0.5, y: 0.5 };
        // Position so the chosen centre lands in the middle of the new frame (normalized coordinates).
        const dispW = (sw * scale) / 100;
        const dispH = (sh * scale) / 100;
        const px = 0.5 + ((0.5 - c.x) * dispW) / W;
        const py = 0.5 + ((0.5 - (c.y ?? 0.5)) * dispH) / H;
        const clampX = Math.min(0.5 + (dispW - W) / (2 * W), Math.max(0.5 - (dispW - W) / (2 * W), px));
        const clampY = Math.min(0.5 + (dispH - H) / (2 * H), Math.max(0.5 - (dispH - H) / (2 * H), py));
        try {
          await ctx.host.setParam(it.key, { component: "Motion", param: "Scale", value: +scale.toFixed(2), seqId: copy.id });
          await ctx.host.setParam(it.key, { component: "Motion", param: "Position", value: { x: +clampX.toFixed(4), y: +clampY.toFixed(4) }, seqId: copy.id });
          results.push(`${it.key} scale ${scale.toFixed(1)}% centre ${c.x}`);
        } catch (e) {
          results.push(`${it.key} ✗ ${e.message}`);
        }
      }
      ctx.memory.addVersion({ name: copy.name, seqId: copy.id, planId: null, parent: null, style: `format ${i.aspect}`, status: "done" });
      ctx.memory.log(`Format version ${i.aspect}: ${copy.name}`);
      return `Created "${copy.name}" ${W}x${H}.\n${results.join("\n")}\nPositions assume Motion.Position is normalized (0–1) — confirmed by the self-test on your Premiere build.`;
    },
  },
  {
    name: "analyze_reference",
    description:
      "Analyze a reference video (local file, or a URL the helper can download) for editing style: cut timing and shot-length statistics, pacing over time, audio loudness/silence/beats, speech presence, plus representative frames (images) for composition, text, colour, camera motion. Report what was OBSERVED (measurements, frames) separately from what you INFER. If the URL cannot be fetched, ask the user to provide the file — never pretend to have seen it.",
    input_schema: S.obj({ path: S.str("local file"), url: S.str("http(s) URL"), max_frames: S.int("frames to return (default 12)", { minimum: 0, maximum: 30 }) }),
    async handler(i, ctx) {
      if (!i.path && !i.url) return { isError: true, text: "Provide a path or url." };
      if (!ctx.helper?.available) return { isError: true, text: "Reference analysis needs the local helper (ffmpeg). It is offline — ask the user to start it, or to describe the reference." };
      if (!(await ctx.ensureConsent("reference"))) return { isError: true, text: "User did not allow sending reference frames to Claude." };
      if (i.url) {
        const ok = await ctx.ui.confirm({ title: "Download reference?", body: `The helper will download:\n${i.url}\nOnly continue if you have the right to use this video for reference. It is analyzed locally; only a few frames and statistics are sent to Claude. Its music/footage will not be used in your edit.`, kind: "reference" });
        if (!ok) return { text: "The user declined the download. Ask them to provide the file instead." };
      }
      let r;
      try {
        r = await ctx.helper.call("reference", { path: i.path, url: i.url, maxFrames: i.max_frames ?? 12 }, { timeoutMs: 20 * 60 * 1000, signal: ctx.signal });
      } catch (e) {
        return { isError: true, text: `Could not access the reference (${e.message}). Ask the user to download it and attach the file.` };
      }
      const s = r.stats;
      const text = [
        `REFERENCE (observed by measurement): ${r.source}`,
        `duration ${s.duration.toFixed(2)}s · ${s.shots} shots · avg ${s.avg_shot.toFixed(2)}s · median ${s.median_shot.toFixed(2)}s · min ${s.min_shot.toFixed(2)}s · max ${s.max_shot.toFixed(2)}s`,
        `shot lengths by quarter: ${s.quarters.map((q) => q.toFixed(2)).join(" / ")}s (pacing curve)`,
        `cut times: ${r.cuts.slice(0, 80).map((c) => c.toFixed(2)).join(", ")}${r.cuts.length > 80 ? " …" : ""}`,
        r.audio ? `audio: ${r.audio.loudness ? `integrated ${r.audio.loudness.integrated_lufs} LUFS` : "no loudness"}, silence ${(r.audio.silence_ratio * 100).toFixed(0)}% of runtime, ${r.audio.beats?.length ? `${r.audio.beats.length} onsets${r.audio.tempo_bpm ? ` (~${r.audio.tempo_bpm} bpm)` : ""}` : "no beat grid"}; cuts landing within 80 ms of an onset: ${r.audio.cuts_on_beats_ratio != null ? (r.audio.cuts_on_beats_ratio * 100).toFixed(0) + "%" : "n/a"}` : "audio: none",
        r.color ? `average colour per quarter (luma/sat): ${r.color.map((c) => `${c.luma.toFixed(2)}/${c.sat.toFixed(2)}`).join(" · ")}` : "",
        `Frames attached: ${r.frames.length} (shot midpoints). Motion, zooms and speed changes can only be inferred from these samples and cut timing — label them as inferred.`,
      ].join("\n");
      return { text, images: r.frames.map((f) => ({ mediaId: "reference", t: f.t, base64: f.jpegBase64, label: `reference @ ${f.t.toFixed(2)}s` })), untrusted: true };
    },
  },
  {
    name: "save_reference_profile",
    description: "Save a Style Profile derived from a reference: what was observed (measured) vs inferred, the influence level (light / balanced / close), and a StyleSpec usable in plans. Never copy the reference's music or footage; adapt to the user's material and duration.",
    input_schema: S.obj({ name: S.str("profile name"), source: S.str("file or url"), observed: S.str("measured facts"), inferred: S.str("interpretation"), influence: S.enm(["light", "balanced", "close"], "how strongly to follow"), style: STYLE_SPEC_SCHEMA, adaptations: S.str("what cannot be reproduced with the user's footage and the creative alternative") }, ["name", "observed", "inferred", "influence", "style"]),
    async handler(i, ctx) {
      const list = ctx.memory.data.references.filter((r) => r.name !== i.name);
      list.push({ ...i, savedAt: Date.now() });
      ctx.memory.data.references = list;
      ctx.memory.save();
      return `Saved reference profile "${i.name}" (influence: ${i.influence}). Use style_id "${i.style.id}" in plans.`;
    },
  },
  {
    name: "export_media",
    description: "Export: queue the sequence to Adobe Media Encoder or Premiere's export queue (with an .epr preset if given, otherwise the sequence's applied export settings), export a still frame, or export interchange (FCP XML / OpenTimelineIO / AAF). Only on the user's request.",
    input_schema: S.obj({ kind: S.enm(["sequence", "frame", "xml", "otio", "aaf"], "export type"), sequence_id: S.str("default active"), output_path: S.str("absolute output path"), preset_path: S.str(".epr preset"), mode: S.enm(["ame", "app", "now"], "sequence export route"), at: S.time("frame time") }, ["kind"]),
    async handler(i, ctx) {
      const tl = await ctx.host.readTimeline(i.sequence_id);
      const dir = await outputDir(ctx, "exports");
      const base = safeFileName(tl.sequence.name);
      if (i.kind === "sequence") {
        const out = i.output_path || joinPath(ctx.fsio, dir, `${base}.mp4`);
        const ok = await ctx.ui.confirm({ title: "Start export?", body: `${tl.sequence.name} → ${out}\nRoute: ${i.mode || "ame"}${i.preset_path ? `\nPreset: ${i.preset_path}` : ""}`, kind: "export" });
        if (!ok) return "Export cancelled by the user.";
        const r = await ctx.host.exportSequence({ seqId: tl.sequence.id, outputPath: out, presetPath: i.preset_path, mode: i.mode || "ame" });
        ctx.memory.log(`Export queued: ${out}`);
        return `Export ${r.queued ? "queued" : "started"}: ${out}`;
      }
      if (i.kind === "frame") {
        const p = await ctx.host.exportFrame({ seqId: tl.sequence.id, time: parseTime(i.at ?? ticksToSeconds(tl.sequence.playheadTicks), tl.sequence.fps), dir, filename: `${base}_${Date.now()}.png`, width: tl.sequence.width, height: tl.sequence.height });
        return `Frame exported: ${p}`;
      }
      const ext = { xml: "xml", otio: "otio", aaf: "aaf" }[i.kind];
      const p = await ctx.host.exportInterchange({ seqId: tl.sequence.id, format: i.kind, path: i.output_path || joinPath(ctx.fsio, dir, `${base}.${ext}`) });
      return `Exported ${i.kind.toUpperCase()}: ${p}`;
    },
  },
];
