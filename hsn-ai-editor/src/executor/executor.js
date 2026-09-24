// Executes compiled operations against the host, one verified step at a
// time. Guarantees:
//  * stop requests are honoured between operations (safe boundaries);
//  * a failed operation never lets its dependents run blindly;
//  * every result is journaled, so a re-sent request (network retry, the
//    model asking twice) resumes or reports instead of duplicating edits;
//  * the finished sequence is re-read and compared to the plan.

import { ticksToSeconds } from "../core/time.js";

export class StopToken {
  constructor() {
    this.stopped = false;
  }
  stop() {
    this.stopped = true;
  }
}

const SOFT_FAIL = new Set(["set_mogrt_text", "add_effect", "set_param", "add_transition", "add_marker", "set_volume"]);

export class Executor {
  /**
   * @param {import('../host/premiere/adapter.js').PremiereHost} host
   * @param {object} opts { journal: {get(hash), put(hash, rec)}, onProgress(evt), log }
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.journal = opts.journal || memoryJournal();
    this.onProgress = opts.onProgress || (() => {});
    this.log = opts.log || (() => {});
  }

  async run({ ops, planHash, planId, stop = new StopToken(), resolved, allowRerun = false }) {
    const existing = await this.journal.get(planHash);
    if (existing && existing.status === "done" && !allowRerun) {
      return { ...existing.report, alreadyExecuted: true, note: "This exact plan was already executed; no edits were repeated." };
    }
    const rec = existing && !allowRerun && ["stopped", "partial", "running"].includes(existing.status)
      ? existing
      : { planHash, planId, startedAt: Date.now(), status: "running", seqId: null, ops: {}, refs: {} };
    const resumed = rec === existing;
    rec.status = "running";
    await this.journal.put(planHash, rec);

    const failed = new Set();
    const total = ops.length;
    let i = 0;
    for (const op of ops) {
      i++;
      const prev = rec.ops[op.id];
      if (prev?.status === "done") continue;
      if (stop.stopped) {
        rec.status = "stopped";
        break;
      }
      const blocked = op.deps.find((d) => failed.has(d) || rec.ops[d]?.status === "failed" || rec.ops[d]?.status === "skipped");
      if (blocked) {
        rec.ops[op.id] = { status: "skipped", error: `depends on failed step ${blocked}` };
        failed.add(op.id);
        this.onProgress({ phase: "execute", op, index: i, total, status: "skipped" });
        continue;
      }
      this.onProgress({ phase: "execute", op, index: i, total, status: "running" });
      try {
        const result = await this.apply(op, rec);
        rec.ops[op.id] = { status: "done", result: compact(result) };
        this.onProgress({ phase: "execute", op, index: i, total, status: "done" });
      } catch (e) {
        rec.ops[op.id] = { status: "failed", error: e.message, code: e.code };
        failed.add(op.id);
        this.log("error", `${op.label}: ${e.message}`);
        this.onProgress({ phase: "execute", op, index: i, total, status: "failed", error: e.message });
        if (op.kind === "create_sequence") break;
      }
      await this.journal.put(planHash, rec);
    }
    if (rec.status !== "stopped") rec.status = Object.values(rec.ops).some((o) => o.status !== "done") ? "partial" : "done";

    const verification = rec.seqId ? await this.verify(rec, ops, resolved).catch((e) => ({ error: e.message })) : null;
    const report = buildReport(rec, ops, verification, resumed);
    rec.report = report;
    rec.finishedAt = Date.now();
    await this.journal.put(planHash, rec);
    return report;
  }

  ref(rec, r) {
    const key = rec.refs[r];
    if (!key) throw Object.assign(new Error(`Timeline item for ${r} was not created`), { code: "missing_ref" });
    return key;
  }

  async apply(op, rec) {
    const h = this.host;
    const a = op.args;
    const seqId = rec.seqId;
    switch (op.kind) {
      case "create_sequence": {
        const s = await h.createEmptySequenceLike(a.likeSeqId, a.name, a.frame || {});
        rec.seqId = s.id;
        rec.seqName = s.name;
        return s;
      }
      case "place": {
        const items = await h.placeSegment({ ...a, seqId });
        for (const it of items) {
          const ref = a.refs.find((r) => r.endsWith(`.${it.kind}`));
          if (ref) rec.refs[ref] = it.key;
        }
        return items.map((x) => x.key);
      }
      case "set_volume":
        return h.setVolume(this.ref(rec, a.ref), { db: a.db, keyframes: a.keyframes, seqId });
      case "set_param":
        return h.setParam(this.ref(rec, a.ref), { component: a.component, param: a.param, value: a.value, keyframes: a.keyframes, interpolation: a.interpolation, seqId });
      case "add_effect":
        return h.addEffect(this.ref(rec, a.ref), /^(AE|PR)\./.test(a.name) ? { matchName: a.name, seqId } : { displayName: a.name, seqId });
      case "add_transition":
        return h.addTransition(this.ref(rec, a.ref), { matchName: a.matchName, durationTicks: a.durationTicks, position: a.position, seqId });
      case "insert_mogrt": {
        const it = await h.insertMogrt(a.path, { time: a.time, videoTrack: a.videoTrack, seqId });
        if (it?.key) rec.refs[a.ref] = it.key;
        return it;
      }
      case "set_mogrt_text":
        return h.setMogrtText(this.ref(rec, a.ref), a.text, { seqId });
      case "add_marker":
        return h.addMarker({ ...a, seqId });
      case "activate_sequence":
        return h.setActiveSequence(seqId);
      default:
        throw new Error(`Unknown operation ${op.kind}`);
    }
  }

  async verify(rec, ops, resolved) {
    const tl = await this.host.readTimeline(rec.seqId);
    const all = [...tl.tracks.video, ...tl.tracks.audio].flatMap((t) => t.items);
    const byKey = new Map(all.map((x) => [x.key, x]));
    const mismatches = [];
    let checked = 0;
    for (const op of ops.filter((o) => o.kind === "place" && rec.ops[o.id]?.status === "done")) {
      for (const r of op.args.refs) {
        const key = rec.refs[r];
        if (!key) continue;
        checked++;
        const it = byKey.get(key);
        const expectEnd = op.args.time + (op.args.srcOut - op.args.srcIn);
        if (!it) mismatches.push(`${r}: missing from the timeline`);
        else if (it.start !== op.args.time || it.end !== expectEnd || it.in !== op.args.srcIn) mismatches.push(`${r}: expected ${ticksToSeconds(op.args.time).toFixed(3)}–${ticksToSeconds(expectEnd).toFixed(3)}s got ${ticksToSeconds(it.start).toFixed(3)}–${ticksToSeconds(it.end).toFixed(3)}s`);
      }
    }
    // A/V sync of linked placements.
    for (const op of ops.filter((o) => o.kind === "place" && o.args.video && o.args.audio)) {
      const v = byKey.get(rec.refs[`${op.args.event}.video`]);
      const au = byKey.get(rec.refs[`${op.args.event}.audio`]);
      if (v && au && (v.start !== au.start || v.in !== au.in)) mismatches.push(`${op.args.event}: picture and sound out of sync`);
    }
    const duration = Math.max(0, ...all.map((x) => x.end));
    return {
      checked,
      mismatches,
      duration_s: +ticksToSeconds(duration).toFixed(3),
      expected_duration_s: resolved?.stats?.duration_s ?? null,
      clips_on_timeline: all.length,
      markers: tl.markers.length,
    };
  }
}

function compact(r) {
  if (r == null) return r;
  try {
    const s = JSON.stringify(r);
    return s.length > 400 ? JSON.parse(JSON.stringify(r, (k, v) => (k === "fp" ? undefined : v))) : r;
  } catch {
    return String(r);
  }
}

function buildReport(rec, ops, verification, resumed) {
  const counts = { done: 0, failed: 0, skipped: 0, pending: 0 };
  const failures = [];
  for (const op of ops) {
    const st = rec.ops[op.id]?.status || "pending";
    counts[st]++;
    if (st === "failed" || st === "skipped") failures.push({ step: op.label, kind: op.kind, status: st, error: rec.ops[op.id].error, soft: SOFT_FAIL.has(op.kind) });
  }
  return {
    status: rec.status,
    resumed,
    sequence: rec.seqId ? { id: rec.seqId, name: rec.seqName } : null,
    counts,
    failures: failures.slice(0, 40),
    verification,
  };
}

export function memoryJournal() {
  const m = new Map();
  return { get: async (k) => m.get(k), put: async (k, v) => void m.set(k, JSON.parse(JSON.stringify(v))), all: async () => [...m.values()] };
}
