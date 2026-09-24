// Planning, execution, versions, constraints/pins and styles.
import { S } from "../../core/schema.js";
import { uid } from "../../core/util.js";
import { secondsToTicks, ticksToSeconds } from "../../core/time.js";
import { PLAN_SCHEMA, resolvePlan, compilePlan, summarizeResolved } from "../../editing/plan.js";
import { STYLE_SPEC_SCHEMA, getStyle, blendStyles, BUILTIN_STYLES } from "../../editing/styles.js";
import { Executor } from "../../executor/executor.js";

const ASPECTS = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "4:5": [4, 5] };

/** Build the validation context for a plan from live project data. */
export async function planContext(ctx, plan) {
  const items = await ctx.host.projectItems({ includeSequences: false });
  const media = new Map();
  for (const e of items.filter((x) => x.kind === "clip")) {
    const ix = ctx.index.get(e.id);
    let duration_s = ix?.duration_s;
    let fps = ix?.fps;
    if (duration_s == null) {
      const d = await ctx.host.clipDetails(e);
      duration_s = d.durationTicks != null ? ticksToSeconds(d.durationTicks) : null;
      fps = d.fps;
    }
    const audioOnly = /\.(wav|mp3|aif|aiff|m4a|aac|flac|ogg)$/i.test(e.path || "");
    const still = /\.(png|jpe?g|tiff?|psd|gif|webp|heic)$/i.test(e.path || "");
    media.set(e.id, { id: e.id, path: e.path, name: e.name, duration_s: duration_s ?? (still ? 3600 : null), fps, hasVideo: ix?.hasVideo ?? !audioOnly, hasAudio: ix?.hasAudio ?? !still });
  }
  // Quotes must be checked against real transcripts: fetch Premiere transcripts for quoted sources.
  for (const ev of plan.events || []) {
    if (!ev.quote || !ev.source) continue;
    const m = media.get(ev.source) || [...media.values()].find((x) => x.path === ev.source || x.name === ev.source);
    if (!m || ctx.index.get(m.id)?.transcript) continue;
    const tr = await ctx.host.transcript(m.id).catch(() => null);
    if (tr?.segments?.length) {
      ctx.index.upsert({ id: m.id, path: m.path, name: m.name, duration_s: m.duration_s, hasVideo: m.hasVideo, hasAudio: m.hasAudio });
      ctx.index.setTranscript(m.id, tr);
    }
  }
  const transcripts = new Map(Object.values(ctx.index.media).filter((m) => m.transcript).map((m) => [m.id, m.transcript]));
  const custom = [...(ctx.memory.data.styles || []), ...(ctx.memory.data.references || []).map((r) => r.style).filter(Boolean)];
  const style = plan.style_id ? getStyle(plan.style_id, custom) : null;
  const tl = await ctx.host.readTimeline().catch(() => null);
  return {
    media,
    fps: tl?.sequence.fps || 25,
    transcripts,
    style,
    constraints: ctx.memory.data.constraints,
    pins: ctx.memory.data.pins.map((p) => ({ ...p, srcIn: secondsToTicks(p.srcIn), srcOut: secondsToTicks(p.srcOut), start: secondsToTicks(p.start) })),
    protected: { video: ctx.settings.get("protectedVideoTracks") || [], audio: ctx.settings.get("protectedAudioTracks") || [] },
    availableTransitions: await ctx.host.listTransitions().catch(() => null),
    activeSeq: tl?.sequence,
  };
}

export async function executePlanRecord(ctx, rec, { rerun = false } = {}) {
  const plan = rec.plan;
  const pctx = await planContext(ctx, plan);
  const resolved = resolvePlan(plan, pctx);
  if (!resolved.ok) return { ok: false, text: `Plan no longer validates (the project changed?):\n- ${resolved.errors.join("\n- ")}` };
  const base = pctx.activeSeq;
  if (!base) return { ok: false, text: "Open a sequence first: the new version copies its settings." };
  let frame;
  const aspect = plan.intent?.aspect;
  if (aspect && ASPECTS[aspect]) {
    const [aw, ah] = ASPECTS[aspect];
    const cur = base.width / base.height;
    if (Math.abs(cur - aw / ah) > 0.01) {
      const long = Math.max(base.width, base.height);
      frame = aw >= ah ? { width: long, height: Math.round((long * ah) / aw / 2) * 2 } : { width: Math.round((long * aw) / ah / 2) * 2, height: long };
    }
  }
  const n = ctx.memory.data.versions.length + 1;
  const name = rec.versionName || `${base.name.replace(/ — HSN v\d+.*$/, "")} — HSN v${n} ${plan.style_id || ""}`.trim();
  const ops = compilePlan(resolved, { sequenceName: name, likeSeqId: base.id, frame });
  ctx.progress?.({ phase: "execute", label: `Executing "${plan.title}" (${ops.length} steps)` });
  const ex = new Executor(ctx.host, { journal: ctx.memory.journalStore(), onProgress: ctx.progress, log: ctx.log });
  const report = await ex.run({ ops, planHash: resolved.hash, planId: rec.id, stop: ctx.stop, resolved, allowRerun: rerun });
  if (report.sequence && !report.alreadyExecuted) {
    const v = ctx.memory.addVersion({ name: report.sequence.name, seqId: report.sequence.id, planId: rec.id, parent: plan.base_version || null, style: plan.style_id || null, duration_s: report.verification?.duration_s, status: report.status });
    rec.versionId = v.id;
  }
  rec.status = report.status === "done" ? "executed" : report.status;
  rec.report = report;
  ctx.memory.putPlan(rec.id, rec);
  ctx.memory.log(`Executed plan "${plan.title}" → ${report.sequence?.name || "?"} (${report.status}; ${report.counts?.done ?? 0} steps ok, ${report.counts?.failed ?? 0} failed, ${report.counts?.skipped ?? 0} skipped)`, report.status === "done");
  return { ok: true, report, text: reportText(report) };
}

export function reportText(r) {
  if (r.alreadyExecuted) return `Already executed earlier as "${r.sequence?.name}". ${r.note}`;
  const lines = [
    `Execution ${r.status}${r.resumed ? " (resumed)" : ""} → sequence "${r.sequence?.name || "?"}" [${r.sequence?.id || "-"}]`,
    `Steps: ${r.counts.done} done, ${r.counts.failed} failed, ${r.counts.skipped} skipped, ${r.counts.pending} not run.`,
  ];
  if (r.failures?.length) lines.push(`Problems:\n${r.failures.map((f) => `- ${f.status}: ${f.step} — ${f.error}`).join("\n")}`);
  const v = r.verification;
  if (v) lines.push(v.error ? `Verification failed: ${v.error}` : `Verified ${v.checked} placed clip(s): ${v.mismatches.length ? v.mismatches.join("; ") : "all at the planned frames"}. Length ${v.duration_s}s${v.expected_duration_s != null ? ` (planned ${v.expected_duration_s}s)` : ""}.`);
  if (r.status === "stopped") lines.push("Stopped by the user at a safe point. Call execute_plan again with the same plan to resume.");
  return lines.join("\n");
}

export const planningTools = [
  {
    name: "propose_edit_plan",
    description:
      "Submit a complete edit as a structured plan (events with source ranges, roles, tracks, J/L cuts, levels, ducking, transitions, effects, transforms, titles, markers). The plan is validated against real media lengths, transcripts (quotes must be real), handles, pins/constraints, protected tracks and the style. In 'preview' mode it is shown to the user as a plan card for approval — then stop and wait. In 'direct' mode a valid plan is executed immediately into a NEW sequence. For revisions set base_version and keep pinned parts.",
    input_schema: S.obj({ plan: PLAN_SCHEMA }, ["plan"]),
    async handler(i, ctx) {
      const plan = i.plan;
      const pctx = await planContext(ctx, plan);
      const resolved = resolvePlan(plan, pctx);
      const id = uid("plan");
      const rec = { id, plan, hash: resolved.hash, createdAt: Date.now(), status: resolved.ok ? "proposed" : "invalid", stats: resolved.stats, summary: summarizeResolved(resolved), warnings: resolved.warnings, fixes: resolved.fixes, errors: resolved.errors };
      ctx.memory.putPlan(id, rec);
      const head = `Plan ${id} "${plan.title}": ${resolved.stats.events} events, ${resolved.stats.shots} shots, ${resolved.stats.duration_s}s, avg shot ${resolved.stats.avg_shot_s}s, ${resolved.stats.transitions} transitions, ${resolved.stats.sources_used} sources.`;
      const notes = [
        resolved.fixes.length ? `Auto-adjusted:\n- ${resolved.fixes.join("\n- ")}` : "",
        resolved.warnings.length ? `Warnings:\n- ${resolved.warnings.join("\n- ")}` : "",
      ].filter(Boolean).join("\n");
      if (!resolved.ok) return { isError: true, text: `${head}\nNOT VALID — fix these and propose again:\n- ${resolved.errors.join("\n- ")}\n${notes}` };
      ctx.ui.showPlan?.(rec);
      if (ctx.settings.get("executionMode") === "direct") {
        const ex = await executePlanRecord(ctx, rec);
        return { text: `${head}\n${notes}\n${ex.text}`, isError: !ex.ok };
      }
      return { text: `${head}\n${notes}\nShown to the user as a plan card (preview mode). Summarize the plan briefly and wait: the user will press Execute, ask for changes, or tell you to execute (then call execute_plan).`, endTurn: false };
    },
  },
  {
    name: "execute_plan",
    description: "Execute a previously proposed, valid plan into a new sequence (never modifies the original sequence). In preview mode the user is asked to confirm. Re-executing the same plan does not duplicate edits: an interrupted run resumes; a finished one is reported. Set rerun=true only when the user explicitly wants another copy.",
    input_schema: S.obj({ plan_id: S.str("id from propose_edit_plan"), version_name: S.str("optional sequence name"), rerun: S.bool("force a new copy") }, ["plan_id"]),
    async handler(i, ctx) {
      const rec = ctx.memory.data.plans[i.plan_id];
      if (!rec) return { isError: true, text: `Unknown plan ${i.plan_id}` };
      if (rec.status === "invalid") return { isError: true, text: "This plan did not validate; propose a corrected plan." };
      if (ctx.settings.get("executionMode") !== "direct" && !["approved", "executed", "partial", "stopped"].includes(rec.status)) {
        const ok = await ctx.ui.confirm({ title: "Execute edit plan?", body: `${rec.plan.title}\n${rec.stats?.duration_s}s · ${rec.stats?.shots} shots\nA new sequence will be created; your current sequence is not changed.`, kind: "plan", planId: rec.id });
        if (!ok) return { text: "The user did not approve execution. Ask what to change." };
        rec.status = "approved";
      }
      if (i.version_name) rec.versionName = i.version_name;
      const ex = await executePlanRecord(ctx, rec, { rerun: !!i.rerun });
      return { text: ex.text, isError: !ex.ok };
    },
  },
  {
    name: "manage_versions",
    description: "List edit versions (sequences created by HSN), activate one (e.g. 'go back to the previous version'), or rename it. Activating never deletes anything.",
    input_schema: S.obj({ action: S.enm(["list", "activate", "rename"], "action"), version_id: S.str("version id"), name: S.str("new name for rename") }, ["action"]),
    async handler(i, ctx) {
      const vs = ctx.memory.data.versions;
      if (i.action === "list") {
        const seqs = await ctx.host.listSequences();
        return vs.length ? vs.map((v, k) => `${k + 1}. ${v.id} "${v.name}" ${v.style || ""} ${v.duration_s ? v.duration_s + "s" : ""} ${v.status}${seqs.find((s) => s.id === v.seqId)?.active ? " (ACTIVE)" : ""}${seqs.some((s) => s.id === v.seqId) ? "" : " (sequence deleted)"} parent ${v.parent || "-"} · plan ${v.planId}`).join("\n") : "No HSN versions yet.";
      }
      const v = vs.find((x) => x.id === i.version_id) || (i.version_id === "previous" ? vs[vs.length - 2] : null);
      if (!v) return { isError: true, text: `Unknown version ${i.version_id}` };
      if (i.action === "activate") {
        await ctx.host.setActiveSequence(v.seqId);
        ctx.memory.log(`Activated version "${v.name}"`);
        return `Now showing "${v.name}".`;
      }
      if (i.action === "rename") {
        const seqs = await ctx.host.projectItems({ includeSequences: true });
        const pi = seqs.find((s) => s.kind === "sequence" && s.name === v.name);
        if (pi) await ctx.host.tx("rename sequence", () => [pi.obj.createSetNameAction(i.name)]);
        v.name = i.name;
        ctx.memory.save();
        return `Renamed to "${i.name}".`;
      }
      return { isError: true, text: "unknown action" };
    },
  },
  {
    name: "set_constraint",
    description:
      "Remember a user decision or rule for this project so every future plan respects it. Machine-checked kinds: no_speech_before{seconds}, max_duration{seconds}, exclude_source{source}, keep_source_range{source,in,out} (\"don't cut this shot\"), end_with_source_range{source,in,out} (\"use this part as the ending\"), no_transitions. Use kind 'note' for preferences you must keep in mind (e.g. 'keep ambience clearly audible').",
    input_schema: S.obj(
      {
        kind: S.enm(["no_speech_before", "max_duration", "exclude_source", "keep_source_range", "end_with_source_range", "no_transitions", "note"], "constraint type"),
        label: S.str("the user's wording, short"),
        seconds: S.num("for time constraints"),
        source: S.str("media id/name"),
        in: S.num("source in seconds"),
        out: S.num("source out seconds"),
        text: S.str("for notes"),
      },
      ["kind", "label"]
    ),
    async handler(i, ctx) {
      const c = ctx.memory.addConstraint(i);
      return `Saved constraint ${c.id}: ${i.label}`;
    },
  },
  {
    name: "pin_parts",
    description: "Lock parts of an executed version so revisions keep them (e.g. 'lock the opening, only change the middle', 'don't remove this shot'). Pin by event ids or by a time range of that version's timeline. keep_position=true also keeps their timeline position.",
    input_schema: S.obj({ version_id: S.str("version id (default: latest)"), event_ids: S.arr(S.str("event id"), "events"), from_s: S.num("timeline seconds"), to_s: S.num("timeline seconds"), keep_position: S.bool("keep exact position"), label: S.str("user wording") }, ["label"]),
    async handler(i, ctx) {
      const vs = ctx.memory.data.versions;
      const v = i.version_id ? vs.find((x) => x.id === i.version_id) : vs[vs.length - 1];
      if (!v) return { isError: true, text: "No executed version to pin from. Pin after a version exists, or use set_constraint keep_source_range." };
      const rec = ctx.memory.data.plans[v.planId];
      const pctx = await planContext(ctx, rec.plan);
      const resolved = resolvePlan(rec.plan, { ...pctx, pins: [], constraints: [] });
      const pick = resolved.events.filter((e) => (i.event_ids?.includes(e.id)) || (i.from_s != null && i.to_s != null && e.start < secondsToTicks(i.to_s) && e.end > secondsToTicks(i.from_s)));
      if (!pick.length) return { isError: true, text: "No events matched." };
      for (const e of pick) ctx.memory.addPin({ label: `${i.label} (${e.id})`, versionId: v.id, eventId: e.id, source: e.source, srcIn: ticksToSeconds(e.srcIn), srcOut: ticksToSeconds(e.srcOut), start: ticksToSeconds(e.start), keepPosition: !!i.keep_position });
      return `Pinned ${pick.length} part(s): ${pick.map((e) => `${e.id} ${e.sourceName} @${ticksToSeconds(e.start).toFixed(2)}s`).join(", ")}. Future plans must keep them (same event ids recommended).`;
    },
  },
  {
    name: "list_constraints",
    description: "List remembered constraints, notes and pinned parts.",
    input_schema: S.obj({}),
    async handler(i, ctx) {
      const c = ctx.memory.data.constraints.map((x) => `${x.id} [${x.kind}] ${x.label}${x.text ? `: ${x.text}` : ""}`);
      const p = ctx.memory.data.pins.map((x) => `${x.id} [pin] ${x.label} src ${x.srcIn.toFixed(2)}–${x.srcOut.toFixed(2)}${x.keepPosition ? ` @${x.start.toFixed(2)}s` : ""}`);
      return [...c, ...p].join("\n") || "None.";
    },
  },
  {
    name: "remove_constraint",
    description: "Remove a constraint or pin by id (when the user changes their mind).",
    input_schema: S.obj({ id: S.str("constraint/pin id") }, ["id"]),
    async handler(i, ctx) {
      return ctx.memory.removeConstraint(i.id) ? `Removed ${i.id}.` : { isError: true, text: `Not found: ${i.id}` };
    },
  },
  {
    name: "save_style",
    description: "Save a style (user-described, blended from built-ins, or derived from a reference) as a reusable StyleSpec. Use blend_of to start from built-ins with weights; then refine fields to match the user's words.",
    input_schema: S.obj({ spec: STYLE_SPEC_SCHEMA, blend_of: S.arr(S.str("built-in style id"), "styles to blend"), weights: S.arr(S.num("weight"), "blend weights"), favorite: S.bool("add to favorites") }, ["spec"]),
    async handler(i, ctx) {
      let spec = i.spec;
      if (i.blend_of?.length) {
        const base = blendStyles(i.blend_of.map((id) => getStyle(id)).filter(Boolean), i.weights);
        spec = { ...base, ...spec, pacing: { ...base.pacing, ...spec.pacing } };
      }
      const list = ctx.memory.data.styles.filter((s) => s.id !== spec.id);
      list.push(spec);
      ctx.memory.data.styles = list;
      ctx.memory.save();
      if (i.favorite) await ctx.settings.set({ favoriteStyles: [...new Set([...(ctx.settings.get("favoriteStyles") || []), spec.id])] });
      return `Saved style "${spec.name}" (${spec.id}). Use style_id "${spec.id}" in plans.`;
    },
  },
  {
    name: "get_style",
    description: "Get the full StyleSpec of a built-in or saved style (pacing numbers, structure, audio, transitions, ethics).",
    input_schema: S.obj({ id: S.str("style id") }, ["id"]),
    async handler(i, ctx) {
      const s = getStyle(i.id, ctx.memory.data.styles);
      return s ? JSON.stringify(s, null, 1) : { isError: true, text: `Unknown style. Built-ins: ${BUILTIN_STYLES.map((x) => x.id).join(", ")}; saved: ${ctx.memory.data.styles.map((x) => x.id).join(", ") || "none"}` };
    },
  },
];
