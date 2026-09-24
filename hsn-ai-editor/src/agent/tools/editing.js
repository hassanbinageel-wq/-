// Direct, incremental edits on an existing sequence (for small requests:
// "trim this", "remove repeated shots", "lower the music"). Every batch:
//  1. optionally asks for confirmation (preview mode),
//  2. makes a restore point (duplicate of the sequence) once per turn,
//  3. runs ops in order, stopping dependents on failure,
//  4. reports exactly what happened.

import { S } from "../../core/schema.js";
import { parseTime, ticksToSeconds, secondsToTicks } from "../../core/time.js";
import { timelineText } from "../format.js";

const T = S.time("time");

async function ensureBackup(ctx, seqId) {
  if (!ctx.settings.get("backupBeforeEdits")) return null;
  const tl = await ctx.host.readTimeline(seqId);
  const id = tl.sequence.id;
  if (ctx.turn.backedUp.has(id)) return null;
  const stamp = new Date().toTimeString().slice(0, 5);
  const copy = await ctx.host.cloneSequence(id, `${tl.sequence.name} — HSN restore ${stamp}`);
  const rp = ctx.memory.addRestorePoint({ seqId: copy.id, name: copy.name, fromSeqId: id, fromName: tl.sequence.name, reason: ctx.turn.userText?.slice(0, 120) || "" });
  ctx.turn.backedUp.add(id);
  // cloning may switch the active sequence in some builds; make sure we stay on the working one
  await ctx.host.setActiveSequence(id).catch(() => {});
  return rp;
}

async function gate(ctx, title, lines) {
  if (ctx.settings.get("executionMode") === "direct") return true;
  return ctx.ui.confirm({ title, body: lines.join("\n"), kind: "edit" });
}

async function runBatch(ctx, name, seqId, ops, fn) {
  const lines = ops.map((o, k) => `${k + 1}. ${describeOp(o)}`);
  if (!(await gate(ctx, name, lines))) return { text: "The user declined these edits. Ask what they want instead." };
  const rp = await ensureBackup(ctx, seqId);
  const results = [];
  let failed = false;
  for (const [k, o] of ops.entries()) {
    if (ctx.stop.stopped) {
      results.push(`${k + 1}. not run (stopped by user)`);
      continue;
    }
    if (failed && o.depends_on_previous !== false) {
      results.push(`${k + 1}. skipped (an earlier step failed)`);
      continue;
    }
    ctx.progress?.({ phase: "edit", index: k + 1, total: ops.length, label: describeOp(o) });
    try {
      const r = await fn(o, seqId);
      results.push(`${k + 1}. ✓ ${describeOp(o)}${r ? ` → ${typeof r === "string" ? r : JSON.stringify(r).slice(0, 200)}` : ""}`);
      ctx.memory.log(`${name}: ${describeOp(o)}`);
    } catch (e) {
      failed = true;
      results.push(`${k + 1}. ✗ ${describeOp(o)} — ${e.message}`);
      ctx.memory.log(`${name}: FAILED ${describeOp(o)} — ${e.message}`, false);
    }
  }
  const tl = await ctx.host.readTimeline(seqId);
  ctx.state.lastTimeline = tl;
  return {
    text: `${results.join("\n")}\n${rp ? `Restore point: "${rp.name}" (${rp.id}).` : ""}\n\nTimeline now:\n${timelineText(tl, { maxItems: 120 })}`,
    isError: failed && results.every((r) => !r.includes("✓")),
    untrusted: true,
  };
}

function describeOp(o) {
  const t = (v) => (v == null ? "" : typeof v === "number" ? `${v}s` : v);
  switch (o.op) {
    case "place": return `place ${o.source} [${t(o.src_in)}–${t(o.src_out)}] at ${t(o.at)} on V${o.video_track || 1}/A${o.audio_track || 1}${o.use_video === false ? " (sound only)" : ""}${o.use_audio === false ? " (picture only)" : ""}${o.mode === "insert" ? " (insert)" : ""}`;
    case "remove": return `${o.ripple ? "ripple-delete" : "delete"} ${o.keys.join(", ")}`;
    case "trim": return `trim ${o.key} to ${o.start != null ? `start ${t(o.start)} ` : ""}${o.end != null ? `end ${t(o.end)} ` : ""}${o.src_in != null ? `src-in ${t(o.src_in)}` : ""}`;
    case "move": return `move ${o.key} to ${t(o.to)}`;
    case "split": return `split ${o.key} at ${t(o.at)}`;
    case "enable": return `${o.enabled ? "enable" : "disable"} ${o.keys.join(", ")}`;
    case "rename": return `rename ${o.key} → ${o.name}`;
    case "close_gaps": return `close gaps on ${o.track}`;
    case "volume": return `level ${o.key} ${o.db != null ? `${o.db} dB` : "keyframed"}`;
    case "fade": return `fade ${o.key} in ${o.in_s || 0}s / out ${o.out_s || 0}s`;
    case "duck": return `duck ${o.key} by ${o.depth_db || 14} dB under ${o.under.join(", ")}`;
    case "audio_effect": return `audio effect ${o.name} on ${o.key}`;
    case "video_effect": return `video effect ${o.name} on ${o.key}`;
    case "param": return `${o.component}.${o.param} on ${o.key}`;
    case "transform": return `transform ${o.key}`;
    case "transition": return `${o.name} (${o.duration_s || 0.5}s) at ${o.position || "end"} of ${o.key}`;
    case "remove_transition": return `remove ${o.position || "end"} transition of ${o.key}`;
    default: return o.op;
  }
}

const tick = (v, fps) => (v == null ? undefined : parseTime(v, fps));

async function keyAt(ctx, kind, trackIdx, atTicks, seqId) {
  const tl = await ctx.host.readTimeline(seqId);
  const it = tl.tracks[kind][trackIdx]?.items.find((i) => i.start <= atTicks && i.end > atTicks);
  return it?.key;
}

export const editingTools = [
  {
    name: "edit_timeline",
    description:
      "Precise edits on an existing sequence using clip keys from get_timeline_state (times in seconds or timecode). Ops: place (put a source range at a time; mode overwrite|insert; use_video/use_audio), remove (ripple or not), trim (set start/end on the timeline and/or src_in; linked audio follows unless linked=false), move (to a new start; linked follows), split (UXP has no razor: emulated as trim+place), enable/disable, rename, close_gaps (ripple clips left on one track). A restore point is created first. For full re-edits prefer propose_edit_plan (new sequence).",
    input_schema: S.obj(
      {
        sequence_id: S.str("default: active sequence"),
        operations: S.arr(
          S.obj(
            {
              op: S.enm(["place", "remove", "trim", "move", "split", "enable", "rename", "close_gaps"], "operation"),
              key: S.str("clip key, e.g. V1:12.400"),
              keys: S.arr(S.str("clip key"), "clip keys"),
              source: S.str("media id/path (place)"),
              src_in: T, src_out: T, at: T, start: T, end: T, to: T,
              video_track: S.int("1-based", { minimum: 1 }), audio_track: S.int("1-based", { minimum: 1 }),
              use_video: S.bool("place picture"), use_audio: S.bool("place sound"),
              mode: S.enm(["overwrite", "insert"], "place mode"),
              ripple: S.bool("close the gap after removing"),
              linked: S.bool("apply to the linked audio/video partner (default true)"),
              enabled: S.bool("for enable"),
              name: S.str("for rename"),
              track: S.str("for close_gaps: V1, A2, ..."),
              depends_on_previous: S.bool("skip if an earlier op failed (default true)"),
            },
            ["op"]
          ),
          "ordered operations",
          { minItems: 1, maxItems: 80 }
        ),
      },
      ["operations"]
    ),
    async handler(i, ctx) {
      const tl0 = await ctx.host.readTimeline(i.sequence_id);
      const seqId = tl0.sequence.id;
      const fps = tl0.sequence.fps;
      return runBatch(ctx, "Timeline edit", seqId, i.operations, async (o) => {
        const h = ctx.host;
        switch (o.op) {
          case "place": {
            const items = await h.placeSegment({ source: o.source, srcIn: tick(o.src_in, fps), srcOut: tick(o.src_out, fps), time: tick(o.at, fps), videoTrack: (o.video_track || 1) - 1, audioTrack: (o.audio_track || 1) - 1, mode: o.mode || "overwrite", video: o.use_video !== false, audio: o.use_audio !== false, seqId });
            return items.map((x) => x.key).join(", ");
          }
          case "remove":
            await h.removeItems(o.keys || [o.key], { ripple: !!o.ripple, seqId });
            return null;
          case "trim": {
            const r = await h.setItemRange(o.key, { start: tick(o.start, fps), end: tick(o.end, fps), in: tick(o.src_in, fps) }, { seqId, linked: o.linked !== false });
            return r.key;
          }
          case "move":
            return (await h.moveItem(o.key, tick(o.to, fps), { seqId, linked: o.linked !== false })).key;
          case "split":
            return (await h.splitItem(o.key, tick(o.at, fps), { seqId, linked: o.linked !== false })).right.join(", ");
          case "enable":
            await h.setEnabled(o.keys || [o.key], o.enabled !== false, { seqId });
            return null;
          case "rename":
            await h.renameItem(o.key, o.name, { seqId });
            return null;
          case "close_gaps": {
            const m = /^([VA])(\d+)$/i.exec(o.track || "V1");
            const kind = m[1].toUpperCase() === "V" ? "video" : "audio";
            const idx = +m[2] - 1;
            const tl = await h.readTimeline(seqId);
            let cursor = 0;
            let moved = 0;
            for (const it of [...tl.tracks[kind][idx].items].sort((a, b) => a.start - b.start)) {
              const len = it.end - it.start;
              if (it.start > cursor) {
                await h.moveItem(it.key, cursor, { seqId, linked: o.linked !== false });
                moved++;
                cursor += len;
              } else cursor = Math.max(cursor, it.end);
            }
            return `${moved} clip(s) moved`;
          }
          default:
            throw new Error(`unknown op ${o.op}`);
        }
      });
    },
  },
  {
    name: "adjust_audio",
    description: "Audio on existing clips: volume (dB), fades (keyframes — the API has no audio transitions), ducking a music/ambience clip under dialogue clips, and audio effects by display name (e.g. 'DeNoise', 'Vocal Enhancer', 'Parametric Equalizer', 'Hard Limiter'). dB mapping is verified per Premiere build by the self-test; loudness targets need a measurement (analyze_audio).",
    input_schema: S.obj(
      {
        sequence_id: S.str("default active"),
        operations: S.arr(
          S.obj(
            {
              op: S.enm(["volume", "fade", "duck", "audio_effect"], "operation"),
              key: S.str("audio clip key (A-track)"),
              db: S.num("level dB", { minimum: -60, maximum: 15 }),
              in_s: S.num("fade-in seconds", { minimum: 0 }),
              out_s: S.num("fade-out seconds", { minimum: 0 }),
              under: S.arr(S.str("dialogue clip key"), "duck under these"),
              depth_db: S.num("duck depth dB", { minimum: 1, maximum: 40 }),
              base_db: S.num("level outside ducked parts (default 0)"),
              name: S.str("audio effect display name"),
            },
            ["op", "key"]
          ),
          "operations",
          { minItems: 1, maxItems: 60 }
        ),
      },
      ["operations"]
    ),
    async handler(i, ctx) {
      const tl0 = await ctx.host.readTimeline(i.sequence_id);
      const seqId = tl0.sequence.id;
      return runBatch(ctx, "Audio adjustment", seqId, i.operations, async (o) => {
        const h = ctx.host;
        if (o.op === "volume") return (await h.setVolume(o.key, { db: o.db ?? 0, seqId })).units;
        if (o.op === "audio_effect") return h.addEffect(o.key, { displayName: o.name, seqId });
        const tl = await h.readTimeline(seqId);
        const it = tl.tracks.audio.flatMap((t) => t.items).find((x) => x.key === o.key);
        if (!it) throw new Error(`no audio clip ${o.key}`);
        const len = it.end - it.start;
        const base = o.base_db ?? o.db ?? 0;
        const kfs = [];
        if (o.op === "fade") {
          kfs.push({ t: 0, db: o.in_s ? -60 : base });
          if (o.in_s) kfs.push({ t: secondsToTicks(Math.min(o.in_s, ticksToSeconds(len) / 2)), db: base });
          if (o.out_s) kfs.push({ t: len - secondsToTicks(Math.min(o.out_s, ticksToSeconds(len) / 2)), db: base });
          kfs.push({ t: len, db: o.out_s ? -60 : base });
        } else {
          const under = tl.tracks.audio.flatMap((t) => t.items).filter((x) => o.under.includes(x.key));
          const depth = o.depth_db ?? 14;
          const ramp = secondsToTicks(0.3);
          kfs.push({ t: 0, db: base });
          for (const u of under.sort((a, b) => a.start - b.start)) {
            const a = Math.max(0, u.start - it.start);
            const b = Math.min(len, u.end - it.start);
            if (b <= 0 || a >= len) continue;
            kfs.push({ t: Math.max(0, a - ramp), db: base }, { t: a, db: base - depth }, { t: b, db: base - depth }, { t: Math.min(len, b + ramp), db: base });
          }
          kfs.push({ t: len, db: base });
        }
        const uniq = [...new Map(kfs.sort((a, b) => a.t - b.t).map((k) => [k.t, k])).values()];
        return (await h.setVolume(o.key, { keyframes: uniq, seqId })).keyframes + " keyframes";
      });
    },
  },
  {
    name: "adjust_visual",
    description: "Picture on existing clips: add video effects (by match name from list_effects_and_transitions, e.g. Lumetri 'AE.ADBE Lumetri'), set any effect parameter (constant or keyframes), Motion/Opacity transform (scale %, position as 0–1 of frame, rotation, opacity; with optional animation e.g. slow push-in), add/remove video transitions (duration limited by media handles). Colour changes are approximate — describe them as such.",
    input_schema: S.obj(
      {
        sequence_id: S.str("default active"),
        operations: S.arr(
          S.obj(
            {
              op: S.enm(["video_effect", "param", "transform", "transition", "remove_transition"], "operation"),
              key: S.str("video clip key"),
              name: S.str("effect match/display name, or transition: dissolve|dip_black|dip_white|match name"),
              component: S.str("effect/component name for param (e.g. 'Lumetri Color', 'Motion', 'Opacity')"),
              param: S.str("parameter display name"),
              value: { description: "number | boolean | string | {x,y}", type: ["number", "boolean", "string", "object"] },
              keyframes: S.arr(S.obj({ t: S.num("seconds from clip start"), value: { type: ["number", "boolean", "string", "object"], description: "value" } }, ["t", "value"]), "keyframes"),
              scale: S.num("percent"), rotation: S.num("degrees"), opacity: S.num("0-100"),
              position: S.obj({ x: S.num("0..1"), y: S.num("0..1") }, ["x", "y"]),
              animate_to: S.obj({ scale: S.num("percent"), position: S.obj({ x: S.num("x"), y: S.num("y") }, ["x", "y"]) }),
              duration_s: S.num("transition seconds", { minimum: 0.04, maximum: 5 }),
              position_edge: S.enm(["start", "end"], "transition edge"),
              position_name: S.str("alias"),
            },
            ["op", "key"]
          ),
          "operations",
          { minItems: 1, maxItems: 60 }
        ),
      },
      ["operations"]
    ),
    async handler(i, ctx) {
      const tl0 = await ctx.host.readTimeline(i.sequence_id);
      const seqId = tl0.sequence.id;
      const aliases = { dissolve: "AE.ADBE Cross Dissolve New", dip_black: "AE.ADBE Dip To Black", dip_white: "AE.ADBE Dip To White" };
      return runBatch(ctx, "Picture adjustment", seqId, i.operations, async (o) => {
        const h = ctx.host;
        switch (o.op) {
          case "video_effect":
            return h.addEffect(o.key, /^(AE|PR)\./.test(o.name) ? { matchName: o.name, seqId } : { displayName: o.name, seqId });
          case "param":
            return h.setParam(o.key, { component: o.component, param: o.param, value: o.value, keyframes: o.keyframes?.map((k) => ({ t: secondsToTicks(k.t), value: k.value })), seqId });
          case "transform": {
            const tl = await h.readTimeline(seqId);
            const it = tl.tracks.video.flatMap((t) => t.items).find((x) => x.key === o.key);
            if (!it) throw new Error(`no video clip ${o.key}`);
            const d = it.end - it.start;
            const out = [];
            if (o.scale != null || o.animate_to?.scale != null) out.push(await h.setParam(o.key, o.animate_to?.scale != null ? { component: "Motion", param: "Scale", keyframes: [{ t: 0, value: o.scale ?? 100 }, { t: d, value: o.animate_to.scale }], seqId } : { component: "Motion", param: "Scale", value: o.scale, seqId }));
            if (o.position || o.animate_to?.position) out.push(await h.setParam(o.key, o.animate_to?.position ? { component: "Motion", param: "Position", keyframes: [{ t: 0, value: o.position || { x: 0.5, y: 0.5 } }, { t: d, value: o.animate_to.position }], seqId } : { component: "Motion", param: "Position", value: o.position, seqId }));
            if (o.rotation != null) out.push(await h.setParam(o.key, { component: "Motion", param: "Rotation", value: o.rotation, seqId }));
            if (o.opacity != null) out.push(await h.setParam(o.key, { component: "Opacity", param: "Opacity", value: o.opacity, seqId }));
            return out.map((x) => x.param).join(", ");
          }
          case "transition":
            await h.addTransition(o.key, { matchName: aliases[o.name] || o.name, durationTicks: secondsToTicks(o.duration_s || 0.5), position: o.position_edge || "end", seqId });
            return null;
          case "remove_transition":
            await h.removeTransition(o.key, o.position_edge || "end", { seqId });
            return null;
          default:
            throw new Error(`unknown op ${o.op}`);
        }
      });
    },
  },
  {
    name: "markers",
    description: "Add markers (notes for the editor, sections, beat points, review comments) or remove HSN markers.",
    input_schema: S.obj(
      {
        sequence_id: S.str("default active"),
        add: S.arr(S.obj({ at: T, name: S.str("name"), comments: S.str("comment"), duration_s: S.num("seconds"), color: S.int("color index 0-7", { minimum: 0, maximum: 7 }) }, ["at", "name"]), "markers to add", { maxItems: 200 }),
        remove_prefix: S.str("remove markers whose name starts with this"),
      }
    ),
    async handler(i, ctx) {
      const tl = await ctx.host.readTimeline(i.sequence_id);
      const seqId = tl.sequence.id;
      let removed = 0;
      if (i.remove_prefix) removed = await ctx.host.removeMarkers({ namePrefix: i.remove_prefix }, { seqId });
      for (const m of i.add || []) await ctx.host.addMarker({ time: parseTime(m.at, tl.sequence.fps), name: m.name, comments: m.comments || "", duration: secondsToTicks(m.duration_s || 0), color: m.color, seqId });
      ctx.memory.log(`Markers: +${(i.add || []).length} −${removed}`);
      return `Added ${(i.add || []).length} marker(s), removed ${removed}.`;
    },
  },
  {
    name: "restore",
    description: "Undo AI changes non-destructively: list restore points, or switch the timeline back to a restore point (the duplicate made before edits) or to an earlier version. Premiere's own Edit > Undo also works: each AI step is a separate undoable transaction named 'HSN AI: …'.",
    input_schema: S.obj({ action: S.enm(["list", "activate"], "action"), id: S.str("restore point id or version id; 'latest' for the most recent restore point") }, ["action"]),
    async handler(i, ctx) {
      const rps = ctx.memory.data.restorePoints;
      if (i.action === "list") return rps.length ? rps.slice(-20).map((r) => `${r.id} "${r.name}" (before: ${r.reason || "edits"}) of "${r.fromName}"`).join("\n") : "No restore points yet.";
      const rp = i.id === "latest" ? rps[rps.length - 1] : rps.find((r) => r.id === i.id);
      const v = rp ? null : ctx.memory.data.versions.find((x) => x.id === i.id);
      const target = rp || v;
      if (!target) return { isError: true, text: `Unknown id ${i.id}` };
      await ctx.host.setActiveSequence(target.seqId);
      ctx.memory.log(`Restored: now showing "${target.name}"`);
      return `Now showing "${target.name}". The edited sequence was kept too (nothing deleted).`;
    },
  },
  {
    name: "project_ops",
    description: "Project housekeeping: import files (to a bin), create bins, move items to bins, duplicate a sequence, create an empty sequence like another (optionally vertical/square frame), change frame size, set active sequence, set sequence In/Out, move the playhead, select clips.",
    input_schema: S.obj(
      {
        operations: S.arr(
          S.obj(
            {
              op: S.enm(["import", "create_bin", "move_to_bin", "duplicate_sequence", "new_sequence_like", "frame_size", "activate_sequence", "set_in_out", "playhead", "select"], "operation"),
              paths: S.arr(S.str("absolute file path"), "files to import"),
              bin: S.str("bin path like 'HSN/Music'"),
              item_ids: S.arr(S.str("project item id"), "items"),
              sequence_id: S.str("sequence id"),
              name: S.str("name"),
              width: S.int("pixels", { minimum: 16 }), height: S.int("pixels", { minimum: 16 }),
              in: T, out: T, at: T,
              keys: S.arr(S.str("clip key"), "clips to select"),
            },
            ["op"]
          ),
          "operations",
          { minItems: 1, maxItems: 40 }
        ),
      },
      ["operations"]
    ),
    async handler(i, ctx) {
      const out = [];
      for (const o of i.operations) {
        const h = ctx.host;
        try {
          switch (o.op) {
            case "import": {
              const r = await h.importFiles(o.paths, { bin: o.bin });
              out.push(`imported ${r.length}: ${r.map((x) => `${x.name} [${x.id}]`).join(", ")}`);
              break;
            }
            case "create_bin":
              out.push(`bin ${(await h.ensureBin(o.bin)).name}`);
              break;
            case "move_to_bin":
              out.push(`moved ${await h.moveToBin(o.item_ids, o.bin)} item(s)`);
              break;
            case "duplicate_sequence": {
              const c = await h.cloneSequence(o.sequence_id, o.name);
              out.push(`duplicated → "${c.name}" [${c.id}]`);
              break;
            }
            case "new_sequence_like": {
              const c = await h.createEmptySequenceLike(o.sequence_id, o.name || "HSN sequence", { width: o.width, height: o.height });
              out.push(`new sequence "${c.name}" [${c.id}]`);
              break;
            }
            case "frame_size":
              await h.setFrameSize(o.sequence_id || (await h.readTimeline()).sequence.id, o.width, o.height);
              out.push(`frame ${o.width}x${o.height}`);
              break;
            case "activate_sequence":
              await h.setActiveSequence(o.sequence_id);
              out.push("activated");
              break;
            case "set_in_out": {
              const fps = (await h.readTimeline(o.sequence_id)).sequence.fps;
              await h.setSequenceInOut(parseTime(o.in, fps), parseTime(o.out, fps), { seqId: o.sequence_id });
              out.push("in/out set");
              break;
            }
            case "playhead":
              await h.setPlayhead(parseTime(o.at), { seqId: o.sequence_id });
              out.push("playhead moved");
              break;
            case "select":
              await h.selectItems(o.keys, { seqId: o.sequence_id });
              out.push(`selected ${o.keys.length}`);
              break;
          }
          ctx.memory.log(`Project: ${o.op} ${o.name || o.bin || ""}`);
        } catch (e) {
          out.push(`✗ ${o.op}: ${e.message}`);
        }
      }
      return { text: out.join("\n"), untrusted: true };
    },
  },
];

export { keyAt, tick };
