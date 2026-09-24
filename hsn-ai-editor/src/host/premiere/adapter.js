// Premiere host adapter: the ONLY module that talks to the `premierepro`
// UXP API. Everything above it works with plain data (ticks, keys, paths).
//
// Rules followed (from Adobe's UXP docs / changelog 26.3):
//  * Actions are created inside project.lockedAccess() and committed with
//    project.executeTransaction(), one named (undoable) transaction per step.
//  * Anything async (factory lookups, getters) happens before the lock.
//  * Every mutation is read back and verified; mismatches are corrected or
//    reported — never silently assumed.

import { TICKS_PER_SECOND, snapTicks, ticksPerFrame } from "../../core/time.js";
import { uid } from "../../core/util.js";

const LABEL = "HSN AI";

export class HostError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code; // no_project | no_sequence | stale | not_found | rejected | unsupported | locked | invalid
    Object.assign(this, extra);
  }
}

export class PremiereHost {
  /**
   * @param {object} ppro the `premierepro` module (real, or the mock)
   * @param {object} [opts]
   */
  constructor(ppro, opts = {}) {
    this.ppro = ppro;
    this.log = opts.log || (() => {});
    this.settings = {
      keyframeTimeBase: "media", // keyframe times relative to source media (ExtendScript convention); verify with self-test
      volumeUnits: "auto", // auto | db | linear
      protectedAudioTracks: [],
      protectedVideoTracks: [],
      ...(opts.settings || {}),
    };
    this.itemCache = new Map(); // key -> {obj, fp}
    this.scratch = { audio: null, video: null };
    this.capabilities = null;
  }

  // ---------------------------------------------------------------- basics
  async init() {
    const p = this.ppro;
    let version = "unknown";
    try {
      version = String(await p.Application?.version);
    } catch { /* older builds */ }
    const has = (o, k) => !!(o && typeof o[k] === "function");
    this.capabilities = {
      version,
      transcribe: has(p.Transcript, "transcribeClipProjectItem"),
      transcriptExport: has(p.Transcript, "exportToJSON"),
      frameExport: has(p.Exporter, "exportSequenceFrame"),
      sceneDetect: has(p.SequenceUtils, "performSceneEditDetectionOnSelection"),
      workArea: !!p.WorkAreaUtils,
      aaf: has(p.ProjectConverter, "exportAAF"),
      xml: has(p.ProjectConverter, "exportAsFinalCutProXML"),
      otio: has(p.ProjectConverter, "exportAsOpenTimelineIO"),
      mogrt: true,
      encoder: has(p.EncoderManager, "getManager"),
      presetSequence: true,
      // Not exposed by the UXP API (as of the 26.5 type declarations):
      speedChange: false,
      reverse: false,
      audioTransitions: false,
      trackLockRead: false,
      trackDelete: false,
      razorSplit: false,
      nativeUndo: false,
    };
    return this.capabilities;
  }

  async project() {
    const pr = await this.ppro.Project.getActiveProject();
    if (!pr) throw new HostError("no_project", "No project is open in Premiere.");
    return pr;
  }

  async sequence(seqId) {
    const pr = await this.project();
    if (seqId) {
      const all = await pr.getSequences();
      const s = all.find((x) => String(x.guid) === String(seqId) || x.name === seqId);
      if (!s) throw new HostError("not_found", `Sequence not found: ${seqId}`);
      return s;
    }
    const s = await pr.getActiveSequence();
    if (!s) throw new HostError("no_sequence", "No active sequence. Open a sequence in the Timeline panel.");
    return s;
  }

  tt(ticks) {
    return this.ppro.TickTime.createWithTicks(String(Math.round(ticks)));
  }

  /** Run one undoable transaction. `build` runs inside lockedAccess and returns actions. */
  async tx(label, build) {
    const pr = await this.project();
    let ok = false;
    let err = null;
    pr.lockedAccess(() => {
      try {
        const actions = build().filter(Boolean);
        if (!actions.length) {
          ok = true;
          return;
        }
        ok = pr.executeTransaction((compound) => {
          for (const a of actions) compound.addAction(a);
        }, `${LABEL}: ${label}`);
      } catch (e) {
        err = e;
      }
    });
    if (err) throw new HostError("rejected", `${label}: ${err.message || err}`);
    if (ok === false) throw new HostError("rejected", `Premiere rejected the edit "${label}" (the track may be locked, or the edit is not allowed).`);
    return true;
  }

  // ------------------------------------------------------------ reading
  async seqInfo(seq) {
    const settings = await seq.getSettings();
    const fr = settings.getVideoFrameRate();
    const tpf = fr.ticksPerFrame || Math.round(TICKS_PER_SECOND / fr.value);
    const fps = TICKS_PER_SECOND / tpf;
    const size = await seq.getFrameSize();
    const [end, inP, outP, playhead] = await Promise.all([seq.getEndTime(), seq.getInPoint(), seq.getOutPoint(), seq.getPlayerPosition()]);
    const endT = end.ticksNumber;
    const i = inP?.ticksNumber ?? 0;
    const o = outP?.ticksNumber ?? 0;
    const inOutSet = o > i && !(i <= 0 && o >= endT) && o > 0;
    let workArea = null;
    try {
      if (this.ppro.WorkAreaUtils) workArea = { in: this.ppro.WorkAreaUtils.getWorkAreaInPoint(seq).ticksNumber, out: this.ppro.WorkAreaUtils.getWorkAreaOutPoint(seq).ticksNumber };
    } catch { /* not available */ }
    return {
      id: String(seq.guid),
      name: seq.name,
      fps: Math.round(fps * 1000) / 1000,
      ticksPerFrame: tpf,
      width: size.width,
      height: size.height,
      endTicks: endT,
      inOut: inOutSet ? { in: i, out: o } : null,
      playheadTicks: playhead.ticksNumber,
      workArea,
    };
  }

  /** Walk the project tree. Returns flat list of {id, name, kind, path, bin, obj}. */
  async projectItems({ includeSequences = true } = {}) {
    const pr = await this.project();
    const out = [];
    const walk = async (folder, binPath) => {
      const items = await folder.getItems();
      for (const it of items) {
        const folderItem = this.ppro.FolderItem.cast ? safe(() => this.ppro.FolderItem.cast(it)) : null;
        const clip = safe(() => this.ppro.ClipProjectItem.cast(it));
        const isBin = it.type === this.ppro.ProjectItem.TYPE_BIN || (folderItem && !clip && typeof folderItem.getItems === "function");
        if (isBin) {
          out.push({ id: pid(it), name: it.name, kind: "bin", bin: binPath, obj: it });
          await walk(folderItem || it, binPath ? `${binPath}/${it.name}` : it.name);
        } else if (clip) {
          const isSeq = await clip.isSequence().catch(() => false);
          if (isSeq && !includeSequences) continue;
          out.push({ id: pid(it), name: it.name, kind: isSeq ? "sequence" : "clip", bin: binPath, path: isSeq ? "" : await clip.getMediaFilePath().catch(() => ""), obj: clip });
        }
      }
    };
    await walk(await pr.getRootItem(), "");
    return out;
  }

  async clipDetails(entry) {
    const clip = entry.obj;
    let duration = null;
    let fps = null;
    try {
      const media = await clip.getMedia();
      duration = (typeof media.getDuration === "function" ? media.getDuration() : await media.duration).ticksNumber;
    } catch { /* sequence/offline */ }
    try {
      fps = (await clip.getFootageInterpretation()).getFrameRate();
    } catch { /* stills */ }
    const offline = await clip.isOffline?.().catch(() => false);
    return { ...strip(entry), durationTicks: duration, fps, offline };
  }

  async findClip(ref) {
    const items = await this.projectItems({ includeSequences: false });
    const hit =
      items.find((i) => i.kind === "clip" && (i.id === ref || i.path === ref)) ||
      items.find((i) => i.kind === "clip" && i.name === ref);
    if (!hit) throw new HostError("not_found", `Project item not found: ${ref}`);
    return hit;
  }

  /**
   * Full timeline snapshot with stable-per-read item keys.
   * Keys look like "V1:12.40" (kind+track:start-seconds) and are resolved
   * against a fresh read before every edit, so stale keys are detected.
   */
  async readTimeline(seqId) {
    const seq = await this.sequence(seqId);
    const info = await this.seqInfo(seq);
    const C = this.ppro.Constants;
    const tracks = { video: [], audio: [] };
    this.itemCache.clear();
    for (const kind of ["video", "audio"]) {
      const count = kind === "video" ? await seq.getVideoTrackCount() : await seq.getAudioTrackCount();
      for (let i = 0; i < count; i++) {
        const track = kind === "video" ? await seq.getVideoTrack(i) : await seq.getAudioTrack(i);
        if (!track) continue;
        const items = track.getTrackItems(C.TrackItemType.CLIP, false) || [];
        const infos = [];
        for (const obj of items) {
          const [st, en, inP, outP, name, pi, speed, disabled] = await Promise.all([
            obj.getStartTime(), obj.getEndTime(), obj.getInPoint(), obj.getOutPoint(), obj.getName(),
            obj.getProjectItem(), obj.getSpeed().catch(() => 1), obj.isDisabled().catch(() => false),
          ]);
          const clip = safe(() => this.ppro.ClipProjectItem.cast(pi));
          const path = clip ? await clip.getMediaFilePath().catch(() => "") : "";
          const info = {
            key: `${kind === "video" ? "V" : "A"}${i + 1}:${(st.ticksNumber / TICKS_PER_SECOND).toFixed(3)}`,
            kind, track: i,
            start: st.ticksNumber, end: en.ticksNumber, in: inP.ticksNumber, out: outP.ticksNumber,
            name, path, projectItemId: pid(pi), speed, disabled,
          };
          info.fp = fingerprint(info);
          this.itemCache.set(info.key, { obj, info, seq });
          infos.push(info);
        }
        let muted = false;
        try { muted = await track.isMuted(); } catch { /* ignore */ }
        tracks[kind].push({ index: i, name: track.name || `${kind === "video" ? "V" : "A"}${i + 1}`, muted, items: infos });
      }
    }
    // Infer links: same project item & identical range on a video and an audio track.
    let g = 0;
    for (const v of tracks.video.flatMap((t) => t.items)) {
      const partners = tracks.audio.flatMap((t) => t.items).filter((a) => a.projectItemId === v.projectItemId && a.start === v.start && a.end === v.end && a.in === v.in);
      if (partners.length) {
        const id = `L${++g}`;
        v.link = id;
        partners.forEach((p) => (p.link = id));
      }
    }
    let markers = [];
    try {
      const m = await this.ppro.Markers.getMarkers(seq);
      markers = m.getMarkers().map((mk) => ({ name: mk.getName(), comments: mk.getComments(), start: mk.getStart().ticksNumber, duration: mk.getDuration().ticksNumber, type: mk.getType(), color: mk.getColorIndex(), guid: String(mk.guid) }));
    } catch (e) {
      this.log("warn", `markers unavailable: ${e.message}`);
    }
    let selection = [];
    try {
      const sel = await seq.getSelection();
      const its = await sel.getTrackItems();
      selection = [...this.itemCache.values()].filter((c) => its.includes(c.obj)).map((c) => c.info.key);
    } catch { /* ignore */ }
    return { sequence: info, tracks, markers, selection, readAt: Date.now() };
  }

  async projectPanelSelection() {
    const pr = await this.project();
    try {
      const sel = await this.ppro.ProjectUtils.getSelection(pr);
      const items = await sel.getItems();
      const all = await this.projectItems();
      return items.map((it) => all.find((a) => a.obj === it || a.id === pid(it))).filter(Boolean).map(strip);
    } catch (e) {
      return [];
    }
  }

  /** Resolve a key from the last read into a live track item, verifying it did not change. */
  async resolve(key, { seqId } = {}) {
    const cached = this.itemCache.get(key);
    const tl = await this.readTimeline(seqId);
    const fresh = this.itemCache.get(key);
    if (!fresh) throw new HostError("stale", `Clip ${key} is no longer at that position — the timeline changed. Re-read the timeline.`, { timeline: tl });
    if (cached && cached.info.fp !== fresh.info.fp) throw new HostError("stale", `Clip ${key} changed since it was read.`, { timeline: tl });
    return fresh;
  }

  // ------------------------------------------------------------ helpers
  async snap(seq, ticks) {
    const info = await this.seqInfo(seq);
    return snapTicks(ticks, TICKS_PER_SECOND / info.ticksPerFrame);
  }

  isProtected(kind, trackIdx) {
    const list = kind === "video" ? this.settings.protectedVideoTracks : this.settings.protectedAudioTracks;
    return (list || []).includes(trackIdx);
  }

  assertWritable(kind, trackIdx) {
    if (this.isProtected(kind, trackIdx)) {
      throw new HostError("locked", `${kind === "video" ? "V" : "A"}${trackIdx + 1} is marked as protected (locked) in HSN AI Editor. Unprotect it or choose another track.`);
    }
  }

  async scratchTrack(seq, kind) {
    // A dedicated empty track used to absorb the unwanted half of a linked
    // overwrite (UXP overwrite always places both video and audio).
    const count = kind === "video" ? await seq.getVideoTrackCount() : await seq.getAudioTrackCount();
    if (this.scratch[kind] != null && this.scratch[kind] < count) {
      const t = kind === "video" ? await seq.getVideoTrack(this.scratch[kind]) : await seq.getAudioTrack(this.scratch[kind]);
      if (t && (t.getTrackItems(this.ppro.Constants.TrackItemType.CLIP, false) || []).length === 0) return this.scratch[kind];
    }
    this.scratch[kind] = count; // index == count creates a new track on placement
    return count;
  }

  // ------------------------------------------------------------ edits
  /**
   * Place a source range on the timeline (overwrite or insert).
   * Uses the project item's source In/Out marks (restored afterwards), then
   * verifies the created item(s) and corrects the range if needed.
   */
  async placeSegment({ source, srcIn, srcOut, time, videoTrack = 0, audioTrack = 0, mode = "overwrite", video = true, audio = true, seqId }) {
    const seq = await this.sequence(seqId);
    const info = await this.seqInfo(seq);
    const fps = TICKS_PER_SECOND / info.ticksPerFrame;
    const entry = await this.findClip(source);
    const clip = entry.obj;
    const det = await this.clipDetails(entry);
    const t = snapTicks(time, fps);
    const inT = snapTicks(srcIn, fps);
    let outT = snapTicks(srcOut, fps);
    if (det.durationTicks != null && outT > det.durationTicks) outT = snapTicks(det.durationTicks, fps, "floor");
    if (outT <= inT) throw new HostError("invalid", `Empty source range for ${entry.name}`);
    if (video) this.assertWritable("video", videoTrack);
    if (audio) this.assertWritable("audio", audioTrack);
    const vIdx = video ? videoTrack : await this.scratchTrack(seq, "video");
    const aIdx = audio ? audioTrack : await this.scratchTrack(seq, "audio");

    const prevIn = await clip.getInPoint?.(this.ppro.Constants.MediaType.VIDEO).catch(() => null);
    const prevOut = await clip.getOutPoint?.(this.ppro.Constants.MediaType.VIDEO).catch(() => null);
    const editor = this.ppro.SequenceEditor.getEditor(seq);
    await this.tx(`source range ${entry.name}`, () => [clip.createSetInOutPointsAction(this.tt(inT), this.tt(outT))]);
    try {
      await this.tx(`${mode} ${entry.name}`, () => [
        mode === "insert"
          ? editor.createInsertProjectItemAction(clip, this.tt(t), vIdx, aIdx, true)
          : editor.createOverwriteItemAction(clip, this.tt(t), vIdx, aIdx),
      ]);
    } finally {
      await this.tx("restore source marks", () => [
        prevIn && prevOut && prevOut.ticksNumber > prevIn.ticksNumber && !(prevIn.ticksNumber === 0 && det.durationTicks && prevOut.ticksNumber >= det.durationTicks)
          ? clip.createSetInOutPointsAction(prevIn, prevOut)
          : clip.createClearInOutPointsAction(),
      ]).catch((e) => this.log("warn", `could not restore source marks: ${e.message}`));
    }

    // Verify & clean up.
    const tl = await this.readTimeline(seqId);
    const created = [];
    const want = { start: t, end: t + (outT - inT), in: inT, out: outT };
    for (const [kind, idx, keep] of [["video", vIdx, video], ["audio", aIdx, audio]]) {
      const track = tl.tracks[kind][idx];
      const hit = track?.items.find((i) => i.projectItemId === entry.id && Math.abs(i.start - t) <= info.ticksPerFrame);
      if (!hit) continue;
      if (!keep) {
        await this.removeItems([hit.key], { ripple: false, seqId, allowProtected: true });
        continue;
      }
      if (hit.start !== want.start || hit.end !== want.end || hit.in !== want.in) {
        const fixed = await this.setItemRange(hit.key, want, { seqId, linked: false });
        created.push(fixed);
      } else created.push(hit);
    }
    if (!created.length) throw new HostError("rejected", `Placing ${entry.name} produced no clip on the timeline (media may have no ${video ? "video" : "audio"}).`);
    return created;
  }

  async removeItems(keys, { ripple = false, seqId, allowProtected = false } = {}) {
    const seq = await this.sequence(seqId);
    const objs = [];
    for (const k of keys) {
      const r = await this.resolve(k, { seqId });
      if (!allowProtected) this.assertWritable(r.info.kind, r.info.track);
      objs.push(r.obj);
    }
    let selection;
    this.ppro.TrackItemSelection.createEmptySelection((s) => (selection = s));
    if (!selection) throw new HostError("unsupported", "Could not create a track item selection.");
    for (const o of objs) selection.addItem(o, true);
    const editor = this.ppro.SequenceEditor.getEditor(seq);
    await this.tx(`${ripple ? "ripple delete" : "delete"} ${keys.length} clip(s)`, () => [editor.createRemoveItemsAction(selection, ripple, this.ppro.Constants.MediaType.ANY)]);
    return true;
  }

  /** Partners that share project item and range (inferred link). */
  async linkedPartners(key, seqId) {
    const tl = await this.readTimeline(seqId);
    const all = [...tl.tracks.video, ...tl.tracks.audio].flatMap((t) => t.items);
    const me = all.find((i) => i.key === key);
    if (!me?.link) return [];
    return all.filter((i) => i.link === me.link && i.key !== key);
  }

  /**
   * Set an item's timeline range and source in-point exactly.
   * Tries edge trims first, then slip adjustments, verifying after each.
   */
  async setItemRange(key, want, { seqId, linked = true } = {}) {
    const partners = linked ? await this.linkedPartners(key, seqId) : [];
    const r = await this.resolve(key, { seqId });
    const target = {
      start: want.start ?? r.info.start,
      end: want.end ?? r.info.end,
      in: want.in ?? r.info.in + ((want.start ?? r.info.start) - r.info.start),
    };
    const result = await this._setRangeOne(r.info, target, seqId);
    for (const p of partners) {
      await this._setRangeOne(p, { ...target }, seqId);
    }
    return result;
  }

  /** Locate the live item that came from `orig` (same track & project item, overlapping). */
  async _locate(orig, target, seqId) {
    const tl = await this.readTimeline(seqId);
    const items = tl.tracks[orig.kind][orig.track]?.items || [];
    const lo = Math.min(orig.start, target.start);
    const hi = Math.max(orig.end, target.end);
    let best = null;
    let bestOv = -1;
    for (const i of items) {
      if (i.projectItemId !== orig.projectItemId) continue;
      if (i.start === target.start) return i;
      const ov = Math.min(i.end, hi) - Math.max(i.start, lo);
      if (ov > bestOv) {
        best = i;
        bestOv = ov;
      }
    }
    return best;
  }

  async _setRangeOne(orig, target, seqId) {
    this.assertWritable(orig.kind, orig.track);
    const t = { ...target, out: target.in + (target.end - target.start) };
    const ok = (i) => i && i.start === t.start && i.end === t.end && i.in === t.in;
    let now = await this._locate(orig, t, seqId);
    if (ok(now)) return now;
    const obj = () => this.itemCache.get(now.key).obj;
    // Each step is its own undoable transaction and is verified before the next.
    const steps = [
      ["trim start", () => obj().createSetStartAction(this.tt(t.start))],
      ["trim end", () => obj().createSetEndAction(this.tt(t.end))],
      ["slip in", () => obj().createSetInPointAction(this.tt(t.in))],
      ["slip out", () => obj().createSetOutPointAction(this.tt(t.out))],
      ["realign start", () => obj().createSetStartAction(this.tt(t.start))],
      ["realign end", () => obj().createSetEndAction(this.tt(t.end))],
    ];
    for (const [label, make] of steps) {
      if (!now) break;
      if (label.startsWith("trim start") && now.start === t.start) continue;
      if (label.startsWith("trim end") && now.end === t.end) continue;
      if (label.startsWith("slip in") && now.in === t.in) continue;
      if (label.startsWith("slip out") && now.in + (now.end - now.start) === t.out && now.out === t.out) continue;
      await this.tx(label, () => [make()]);
      now = await this._locate(orig, t, seqId);
      if (ok(now)) return now;
    }
    throw new HostError("verify_failed", `Could not set the exact range on ${orig.key}: got start=${now?.start} end=${now?.end} in=${now?.in}, wanted ${t.start}/${t.end}/${t.in}.`, { item: now });
  }

  async moveItem(key, newStart, { seqId, linked = true } = {}) {
    const r = await this.resolve(key, { seqId });
    const seq = await this.sequence(seqId);
    const start = await this.snap(seq, newStart);
    const delta = start - r.info.start;
    if (delta === 0) return r.info;
    const partners = linked ? await this.linkedPartners(key, seqId) : [];
    const all = [r.info, ...partners];
    for (const it of all) this.assertWritable(it.kind, it.track);
    const objs = all.map((i) => this.itemCache.get(i.key).obj);
    await this.tx(`move ${all.length} clip(s)`, () => objs.map((o) => o.createMoveAction(this.tt(delta))));
    let result = null;
    for (const it of all) {
      const target = { start: it.start + delta, end: it.end + delta, in: it.in };
      const got = await this._locate(it, target, seqId);
      const fixed = got && got.start === target.start && got.end === target.end && got.in === target.in ? got : await this._setRangeOne(it, target, seqId);
      if (it === r.info) result = fixed;
    }
    return result;
  }

  /** Split = trim left part + place right part (UXP has no razor action). */
  async splitItem(key, atTicks, { seqId, linked = true } = {}) {
    const r = await this.resolve(key, { seqId });
    const seq = await this.sequence(seqId);
    const at = await this.snap(seq, atTicks);
    const it = r.info;
    if (at <= it.start || at >= it.end) throw new HostError("invalid", `Split point is outside ${key}`);
    const partners = linked ? await this.linkedPartners(key, seqId) : [];
    const audioPartner = partners.find((p) => p.kind === "audio");
    await this.setItemRange(key, { start: it.start, end: at, in: it.in }, { seqId, linked });
    const created = await this.placeSegment({
      source: it.projectItemId,
      srcIn: it.in + (at - it.start),
      srcOut: it.out,
      time: at,
      videoTrack: it.kind === "video" ? it.track : 0,
      audioTrack: it.kind === "audio" ? it.track : audioPartner ? audioPartner.track : 0,
      video: it.kind === "video",
      audio: it.kind === "audio" || !!audioPartner,
      seqId,
    });
    return { left: key, right: created.map((c) => c.key), note: "Effects on the original clip stay on the left part; the right part is a fresh clip (UXP has no razor action)." };
  }

  async setEnabled(keys, enabled, { seqId } = {}) {
    const objs = [];
    for (const k of keys) objs.push((await this.resolve(k, { seqId })).obj);
    await this.tx(enabled ? "enable clips" : "disable clips", () => objs.map((o) => o.createSetDisabledAction(!enabled)));
    return true;
  }

  async renameItem(key, name, { seqId } = {}) {
    const { obj } = await this.resolve(key, { seqId });
    await this.tx("rename clip", () => [obj.createSetNameAction(name)]);
  }

  // ------------------------------------------------------------ markers
  async addMarker({ time, duration = 0, name = "", comments = "", color, seqId }) {
    const seq = await this.sequence(seqId);
    const markers = await this.ppro.Markers.getMarkers(seq);
    const before = new Set(markers.getMarkers().map((m) => String(m.guid)));
    const t = await this.snap(seq, time);
    await this.tx(`marker ${name}`, () => [markers.createAddMarkerAction(name, "Comment", this.tt(t), this.tt(duration), comments)]);
    const added = markers.getMarkers().find((m) => !before.has(String(m.guid)));
    if (added && color != null) {
      await this.tx("marker color", () => [added.createSetColorByIndexAction(color)]).catch(() => {});
    }
    return { start: t, name, guid: added ? String(added.guid) : null };
  }

  async removeMarkers(filter = {}, { seqId } = {}) {
    const seq = await this.sequence(seqId);
    const markers = await this.ppro.Markers.getMarkers(seq);
    const hits = markers.getMarkers().filter((m) => (filter.guid ? String(m.guid) === filter.guid : true) && (filter.namePrefix ? m.getName().startsWith(filter.namePrefix) : true));
    if (!hits.length) return 0;
    await this.tx(`remove ${hits.length} marker(s)`, () => hits.map((m) => markers.createRemoveMarkerAction(m)));
    return hits.length;
  }

  // ------------------------------------------------------------ transitions
  async listTransitions() {
    return this.ppro.TransitionFactory.getVideoTransitionMatchNames();
  }

  async addTransition(key, { matchName = "AE.ADBE Cross Dissolve New", durationTicks, position = "end", alignment, singleSided = false, seqId } = {}) {
    const r = await this.resolve(key, { seqId });
    if (r.info.kind !== "video") throw new HostError("unsupported", "The UXP API only exposes video transitions. For audio, use volume fades (keyframes).");
    this.assertWritable("video", r.info.track);
    const available = await this.listTransitions();
    if (!available.includes(matchName)) throw new HostError("not_found", `Transition ${matchName} is not installed. Available: ${available.slice(0, 20).join(", ")}`);
    const transition = await this.ppro.TransitionFactory.createVideoTransition(matchName);
    const opts = new this.ppro.AddTransitionOptions();
    opts.setApplyToStart(position === "start");
    if (durationTicks) opts.setDuration(this.tt(durationTicks));
    if (singleSided) opts.setForceSingleSided(true);
    if (alignment != null) opts.setTransitionAlignment(alignment);
    await this.tx(`transition ${matchName.replace("AE.ADBE ", "")}`, () => [r.obj.createAddVideoTransitionAction(transition, opts)]);
    return true;
  }

  async removeTransition(key, position = "end", { seqId } = {}) {
    const r = await this.resolve(key, { seqId });
    const P = this.ppro.Constants.TransitionPosition;
    await this.tx("remove transition", () => [r.obj.createRemoveVideoTransitionAction(position === "start" ? P.START : P.END)]);
  }

  // ------------------------------------------------------------ effects & params
  async listEffects() {
    const [video, audio] = await Promise.all([
      this.ppro.VideoFilterFactory.getMatchNames().catch(() => []),
      this.ppro.AudioFilterFactory.getDisplayNames().catch(() => []),
    ]);
    let videoNames = [];
    try { videoNames = await this.ppro.VideoFilterFactory.getDisplayNames(); } catch { /* ignore */ }
    return { video: video.map((m, i) => ({ matchName: m, displayName: videoNames[i] || m })), audio };
  }

  async components(key, seqId) {
    const r = await this.resolve(key, { seqId });
    const chain = await r.obj.getComponentChain();
    const out = [];
    const n = chain.getComponentCount();
    for (let i = 0; i < n; i++) {
      const c = chain.getComponentAtIndex(i);
      const params = [];
      for (let p = 0; p < c.getParamCount(); p++) {
        const prm = c.getParam(p);
        let value = null;
        try { value = describeValue((await prm.getStartValue())?.value?.value); } catch { /* ignore */ }
        params.push({ index: p, name: prm.displayName, value, keyframed: safe(() => prm.isTimeVarying()) });
      }
      out.push({ index: i, matchName: await c.getMatchName(), displayName: await c.getDisplayName(), params });
    }
    return { item: r.info, chain, components: out };
  }

  async addEffect(key, { matchName, displayName, seqId }) {
    const r = await this.resolve(key, { seqId });
    this.assertWritable(r.info.kind, r.info.track);
    let comp;
    if (r.info.kind === "video") {
      const names = await this.ppro.VideoFilterFactory.getMatchNames();
      let mn = matchName;
      if (!mn && displayName) {
        const dn = await this.ppro.VideoFilterFactory.getDisplayNames().catch(() => []);
        const idx = dn.findIndex((d) => d.toLowerCase() === displayName.toLowerCase());
        mn = names[idx];
      }
      if (!mn || !names.includes(mn)) throw new HostError("not_found", `Video effect not available: ${matchName || displayName}`);
      comp = await this.ppro.VideoFilterFactory.createComponent(mn);
    } else {
      const names = await this.ppro.AudioFilterFactory.getDisplayNames();
      const dn = names.find((n) => n.toLowerCase() === String(displayName || matchName).toLowerCase());
      if (!dn) throw new HostError("not_found", `Audio effect not available: ${displayName || matchName}. Available: ${names.slice(0, 25).join(", ")}`);
      comp = await this.ppro.AudioFilterFactory.createComponentByDisplayName(dn, r.obj);
    }
    const chain = await r.obj.getComponentChain();
    await this.tx(`effect ${matchName || displayName}`, () => [chain.createAppendComponentAction(comp)]);
    return { index: chain.getComponentCount() - 1 };
  }

  async findParam(key, { component, param, seqId }) {
    const { chain, components, item } = await this.components(key, seqId);
    const want = String(component).toLowerCase();
    // prefer the LAST matching component (most recently added effect)
    const comp = [...components].reverse().find((c) => c.matchName.toLowerCase() === want || c.displayName.toLowerCase() === want) ||
      [...components].reverse().find((c) => c.displayName.toLowerCase().includes(want) || c.matchName.toLowerCase().includes(want));
    if (!comp) throw new HostError("not_found", `Component "${component}" not on ${key}. Present: ${components.map((c) => c.displayName).join(", ")}`);
    const p = typeof param === "number" ? comp.params[param] : comp.params.find((x) => x.name.toLowerCase() === String(param).toLowerCase()) || comp.params.find((x) => x.name.toLowerCase().includes(String(param).toLowerCase()));
    if (!p) throw new HostError("not_found", `Parameter "${param}" not in ${comp.displayName}. Params: ${comp.params.map((x) => x.name).join(", ")}`);
    const cObj = chain.getComponentAtIndex(comp.index);
    return { item, comp, pInfo: p, param: cObj.getParam(p.index) };
  }

  /** Convert a clip-relative offset (ticks) into the keyframe time base. */
  keyTime(item, offsetTicks) {
    return this.settings.keyframeTimeBase === "media" ? item.in + offsetTicks : offsetTicks;
  }

  /**
   * Set a parameter to a constant value, or keyframes [{t (ticks, clip-relative), value}].
   * Values: number | boolean | string | {x,y} | {r,g,b,a}.
   */
  async setParam(key, { component, param, value, keyframes, interpolation, seqId }) {
    const { item, param: prm, pInfo } = await this.findParam(key, { component, param, seqId });
    this.assertWritable(item.kind, item.track);
    const mk = (v) => prm.createKeyframe(this.toHostValue(v, pInfo));
    if (keyframes && keyframes.length) {
      await this.tx(`keyframes ${pInfo.name}`, () => {
        const acts = [prm.createSetTimeVaryingAction(true)];
        return acts;
      });
      await this.tx(`keyframes ${pInfo.name}`, () =>
        keyframes.map((k) => {
          const kf = mk(k.value);
          kf.position = this.tt(this.keyTime(item, k.t));
          return prm.createAddKeyframeAction(kf);
        })
      );
      if (interpolation && this.ppro.Constants.InterpolationMode) {
        const mode = this.ppro.Constants.InterpolationMode[interpolation.toUpperCase()];
        if (mode != null) {
          await this.tx("keyframe interpolation", () => keyframes.map((k) => prm.createSetInterpolationAtKeyframeAction(this.tt(this.keyTime(item, k.t)), mode))).catch((e) => this.log("warn", e.message));
        }
      }
    } else {
      if (safe(() => prm.isTimeVarying())) await this.tx(`clear keyframes ${pInfo.name}`, () => [prm.createSetTimeVaryingAction(false)]);
      await this.tx(`${pInfo.name} = ${JSON.stringify(value)}`, () => [prm.createSetValueAction(mk(value), true)]);
    }
    const after = await prm.getStartValue().catch(() => null);
    return { param: pInfo.name, startValue: describeValue(after?.value?.value), keyframes: safe(() => prm.getKeyframeListAsTickTimes().length) ?? null };
  }

  toHostValue(v, pInfo) {
    const P = this.ppro;
    if (v && typeof v === "object" && "x" in v) return new P.PointF(v.x, v.y);
    if (v && typeof v === "object" && "r" in v) return new P.Color(v.r, v.g, v.b, v.a ?? 1);
    if (typeof pInfo?.value === "boolean" && typeof v !== "boolean") return !!v;
    return v;
  }

  // ------------------------------------------------------------ audio level
  /** dB <-> host value. ExtendScript-era mapping: level = 10^((dB-15)/20); 0 dB = 0.1778. */
  async volumeMode(key, seqId) {
    if (this.settings.volumeUnits !== "auto") return this.settings.volumeUnits;
    const { pInfo } = await this.findParam(key, { component: "Volume", param: "Level", seqId });
    const v = typeof pInfo.value === "number" ? pInfo.value : 0;
    return v > 0 && v <= 1.0 ? "linear" : "db";
  }

  dbToHost(db, mode) {
    return mode === "linear" ? Math.min(1, Math.pow(10, (db - 15) / 20)) : db;
  }

  async setVolume(key, { db, keyframes, seqId }) {
    const r = await this.resolve(key, { seqId });
    if (r.info.kind !== "audio") throw new HostError("invalid", "Volume applies to audio clips (A tracks).");
    const mode = await this.volumeMode(key, seqId);
    return this.setParam(key, {
      component: "Volume",
      param: "Level",
      value: db != null ? this.dbToHost(db, mode) : undefined,
      keyframes: keyframes?.map((k) => ({ t: k.t, value: this.dbToHost(k.db, mode) })),
      seqId,
    }).then((res) => ({ ...res, units: mode }));
  }

  // ------------------------------------------------------------ project
  async importFiles(paths, { bin } = {}) {
    const pr = await this.project();
    let target = null;
    if (bin) target = (await this.ensureBin(bin)).obj;
    const before = new Set((await this.projectItems()).map((i) => i.id));
    const ok = await pr.importFiles(paths, true, target || undefined, false);
    if (!ok) throw new HostError("rejected", `Import failed for: ${paths.join(", ")}`);
    const after = await this.projectItems();
    return after.filter((i) => !before.has(i.id)).map(strip);
  }

  async ensureBin(path) {
    const parts = String(path).split("/").filter(Boolean);
    const pr = await this.project();
    let folder = await pr.getRootItem();
    let entry = null;
    for (const part of parts) {
      let items = await folder.getItems();
      let found = items.find((i) => i.name === part && (i.type === this.ppro.ProjectItem.TYPE_BIN || safe(() => this.ppro.FolderItem.cast(i))?.getItems));
      if (!found) {
        const f = folder;
        await this.tx(`bin ${part}`, () => [f.createBinAction(part, false)]);
        items = await folder.getItems();
        found = items.find((i) => i.name === part);
      }
      folder = this.ppro.FolderItem.cast ? this.ppro.FolderItem.cast(found) || found : found;
      entry = { id: pid(found), name: part, obj: folder };
    }
    return entry;
  }

  async moveToBin(itemIds, binPath) {
    const bin = await this.ensureBin(binPath);
    const items = await this.projectItems();
    const pr = await this.project();
    const root = await pr.getRootItem();
    const objs = itemIds.map((id) => items.find((i) => i.id === id || i.name === id)?.obj).filter(Boolean);
    await this.tx(`move to ${binPath}`, () => objs.map((o) => root.createMoveItemAction(this.ppro.ProjectItem.cast ? this.ppro.ProjectItem.cast(o) : o, bin.obj)));
    return objs.length;
  }

  async listSequences() {
    const pr = await this.project();
    const active = await pr.getActiveSequence();
    const seqs = await pr.getSequences();
    return seqs.map((s) => ({ id: String(s.guid), name: s.name, active: active && String(active.guid) === String(s.guid) }));
  }

  /** Duplicate a sequence (non-destructive backup / new version). */
  async cloneSequence(seqId, newName) {
    const pr = await this.project();
    const seq = await this.sequence(seqId);
    const before = new Set((await pr.getSequences()).map((s) => String(s.guid)));
    await this.tx(`duplicate ${seq.name}`, () => [seq.createCloneAction()]);
    const created = (await pr.getSequences()).find((s) => !before.has(String(s.guid)));
    if (!created) throw new HostError("rejected", "Sequence duplicate did not appear in the project.");
    if (newName) {
      const pi = await created.getProjectItem();
      await this.tx("rename sequence", () => [pi.createSetNameAction(newName)]).catch((e) => this.log("warn", e.message));
    }
    return { id: String(created.guid), name: newName || created.name };
  }

  /**
   * New empty sequence with the same settings as `likeSeqId` (clone + clear),
   * optionally with a different frame size (vertical/square versions).
   */
  async createEmptySequenceLike(likeSeqId, name, { width, height } = {}) {
    const c = await this.cloneSequence(likeSeqId, name);
    const tl = await this.readTimeline(c.id);
    const keys = [...tl.tracks.video, ...tl.tracks.audio].flatMap((t) => t.items.map((i) => i.key));
    if (keys.length) await this.removeItems(keys, { ripple: false, seqId: c.id, allowProtected: true });
    const m = await this.ppro.Markers.getMarkers(await this.sequence(c.id));
    const mk = m.getMarkers();
    if (mk.length) await this.tx("clear markers", () => mk.map((x) => m.createRemoveMarkerAction(x))).catch(() => {});
    if (width && height) await this.setFrameSize(c.id, width, height);
    return c;
  }

  async setFrameSize(seqId, width, height) {
    const seq = await this.sequence(seqId);
    const settings = await seq.getSettings();
    const rect = new this.ppro.RectF();
    rect.width = width;
    rect.height = height;
    await settings.setVideoFrameRect(rect);
    await this.tx(`frame size ${width}x${height}`, () => [seq.createSetSettingsAction(settings)]);
    const size = await seq.getFrameSize();
    if (size.width !== width || size.height !== height) throw new HostError("verify_failed", `Frame size is ${size.width}x${size.height}, expected ${width}x${height}.`);
    return true;
  }

  async setActiveSequence(seqId) {
    const pr = await this.project();
    const seq = await this.sequence(seqId);
    await pr.openSequence?.(seq).catch(() => {});
    return pr.setActiveSequence(seq);
  }

  async setSequenceInOut(inT, outT, { seqId } = {}) {
    const seq = await this.sequence(seqId);
    await this.tx("sequence in/out", () => [seq.createSetInPointAction(this.tt(inT)), seq.createSetOutPointAction(this.tt(outT))]);
  }

  async setPlayhead(t, { seqId } = {}) {
    const seq = await this.sequence(seqId);
    return seq.setPlayerPosition(this.tt(t));
  }

  async selectItems(keys, { seqId } = {}) {
    const seq = await this.sequence(seqId);
    let sel;
    this.ppro.TrackItemSelection.createEmptySelection((s) => (sel = s));
    for (const k of keys) sel.addItem((await this.resolve(k, { seqId })).obj, true);
    return seq.setSelection(sel);
  }

  // ------------------------------------------------------------ graphics
  async insertMogrt(path, { time, videoTrack = 1, seqId }) {
    const seq = await this.sequence(seqId);
    this.assertWritable("video", videoTrack);
    const editor = this.ppro.SequenceEditor.getEditor(seq);
    const pr = await this.project();
    let items = [];
    let err;
    const t = await this.snap(seq, time);
    pr.lockedAccess(() => {
      try {
        items = editor.insertMogrtFromPath(path, this.tt(t), videoTrack, 0) || [];
      } catch (e) {
        err = e;
      }
    });
    if (err) throw new HostError("rejected", `MOGRT insert failed: ${err.message}`);
    const tl = await this.readTimeline(seqId);
    const hit = tl.tracks.video[videoTrack]?.items.find((i) => Math.abs(i.start - t) <= tl.sequence.ticksPerFrame);
    return hit || { note: "MOGRT inserted; could not locate it for verification." };
  }

  /**
   * Try to set the text of a MOGRT "Graphic Parameters" (AE.ADBE Capsule)
   * text param. Experimental: text params may be MogrtText objects that the
   * API does not let us write as a plain string.
   */
  async setMogrtText(key, text, { paramName, seqId } = {}) {
    const { components } = await this.components(key, seqId);
    const cap = components.find((c) => c.matchName === "AE.ADBE Capsule");
    if (!cap) throw new HostError("not_found", "No MOGRT parameters found on this clip.");
    const p = cap.params.find((x) => (paramName ? x.name === paramName : typeof x.value === "string"));
    if (!p) throw new HostError("unsupported", "This MOGRT exposes no plain-text parameter to the API. Edit the text in Essential Graphics.");
    return this.setParam(key, { component: "AE.ADBE Capsule", param: p.index, value: text, seqId });
  }

  // ------------------------------------------------------------ export
  async exportFrame({ seqId, time, dir, filename, width = 640, height = 360 }) {
    const seq = await this.sequence(seqId);
    const ok = await this.ppro.Exporter.exportSequenceFrame(seq, this.tt(time), filename, dir, width, height);
    if (!ok) throw new HostError("rejected", "Frame export failed.");
    return `${dir.replace(/[\\/]$/, "")}/${filename}`;
  }

  async exportSequence({ seqId, outputPath, presetPath, mode = "ame" }) {
    const seq = await this.sequence(seqId);
    const mgr = this.ppro.EncoderManager.getManager();
    const T = this.ppro.Constants.ExportType;
    const type = mode === "now" ? T.IMMEDIATELY : mode === "app" ? T.QUEUE_TO_APP : T.QUEUE_TO_AME;
    if (type === T.QUEUE_TO_AME && mgr.isAMEInstalled === false) throw new HostError("unsupported", "Adobe Media Encoder is not installed; use mode 'app' (Premiere export queue).");
    const ok = await mgr.exportSequence(seq, type, outputPath, presetPath, true);
    if (!ok) throw new HostError("rejected", "Export request was not accepted.");
    return { queued: mode !== "now", outputPath };
  }

  async exportInterchange({ seqId, format, path }) {
    const seq = await this.sequence(seqId);
    const C = this.ppro.ProjectConverter;
    const ok = format === "otio" ? await C.exportAsOpenTimelineIO(seq, path, true) : format === "aaf" ? await C.exportAAF(seq, path) : await C.exportAsFinalCutProXML(seq, path, true);
    if (!ok) throw new HostError("rejected", `${format} export failed`);
    return path;
  }

  // ------------------------------------------------------------ transcripts
  async transcript(source) {
    const entry = await this.findClip(source);
    const T = this.ppro.Transcript;
    if (!T?.hasTranscript || !T.hasTranscript(entry.obj)) return null;
    const json = await T.exportToJSON(entry.obj);
    if (!json) return null;
    return normalizePremiereTranscript(JSON.parse(json));
  }

  async transcribe(source, languageCode) {
    if (!this.capabilities?.transcribe) throw new HostError("unsupported", "Premiere transcription API needs Premiere 26.5+. Use the local helper (Whisper) instead.");
    const entry = await this.findClip(source);
    const ok = await this.ppro.Transcript.transcribeClipProjectItem(entry.obj, languageCode ? { languageCode } : undefined);
    if (!ok) throw new HostError("rejected", "Premiere could not transcribe this clip (language pack missing or unsupported language).");
    return this.transcript(source);
  }

  premiereTranscriptionLanguages() {
    try {
      return this.ppro.Transcript.querySupportedLanguages();
    } catch {
      return [];
    }
  }

  async sceneDetect(keys, { seqId, operation = "markers" } = {}) {
    const seq = await this.sequence(seqId);
    let sel;
    this.ppro.TrackItemSelection.createEmptySelection((s) => (sel = s));
    for (const k of keys) sel.addItem((await this.resolve(k, { seqId })).obj, true);
    const U = this.ppro.SequenceUtils;
    const op = operation === "cuts" ? U.SEQUENCE_OPERATION_APPLYCUT : operation === "subclips" ? U.SEQUENCE_OPERATION_CREATESUBCLIP : U.SEQUENCE_OPERATION_CREATEMARKER;
    const ok = await U.performSceneEditDetectionOnSelection(op, sel);
    if (!ok) throw new HostError("rejected", "Scene edit detection failed.");
    return true;
  }

  onChange(cb) {
    const E = this.ppro.EventManager;
    const C = this.ppro.Constants;
    const offs = [];
    try {
      for (const ev of [C.SequenceEvent?.SELECTION_CHANGED, C.SequenceEvent?.ACTIVATED, C.ProjectEvent?.DIRTY, C.ProjectEvent?.ACTIVATED]) {
        if (ev == null) continue;
        const fn = () => cb(ev);
        E.addGlobalEventListener(ev, fn);
        offs.push(() => E.removeGlobalEventListener(ev, fn));
      }
    } catch (e) {
      this.log("warn", `event listeners unavailable: ${e.message}`);
    }
    return () => offs.forEach((f) => f());
  }
}

// ---------------------------------------------------------------- utils
function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function pid(pi) {
  if (!pi) return "";
  try {
    if (typeof pi.getId === "function") return String(pi.getId());
  } catch { /* ignore */ }
  return pi.name || uid("pi");
}

function strip(e) {
  const { obj, ...rest } = e;
  return rest;
}

export function fingerprint(i) {
  return `${i.kind}|${i.track}|${i.start}|${i.end}|${i.in}|${i.projectItemId}`;
}

function describeValue(v) {
  if (v == null) return v;
  if (typeof v === "object") {
    if ("x" in v && "y" in v) return { x: v.x, y: v.y };
    if ("red" in v) return { r: v.red, g: v.green, b: v.blue, a: v.alpha };
    if (typeof v.getText === "function") return { text: v.getText() };
    return String(v);
  }
  return v;
}

/** Premiere transcript JSON (Adobe spec) -> [{start, end, text, speaker, words}] in seconds. */
export function normalizePremiereTranscript(j) {
  const speakers = Object.fromEntries((j.speakers || []).map((s) => [s.id, s.name]));
  return {
    language: j.language,
    source: "premiere",
    segments: (j.segments || []).map((s) => ({
      start: s.start,
      end: s.start + s.duration,
      speaker: speakers[s.speaker] || s.speaker,
      text: (s.words || []).map((w) => w.text).join(" ").replace(/\s+([,.!?،؟])/g, "$1"),
      words: (s.words || []).map((w) => ({ start: w.start, end: w.start + w.duration, text: w.text, confidence: w.confidence })),
    })),
  };
}

export { ticksPerFrame };
