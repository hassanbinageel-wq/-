// In-memory simulation of the `premierepro` UXP module (the subset of the
// v25.6–26.5 API that HSN AI Editor uses), shaped after Adobe's official
// type declarations (@adobe/premierepro). It lets the real Premiere
// adapter code run in Node for automated tests and a browser demo mode.
//
// IMPORTANT: this is a SIMULATION. Where Adobe's documentation leaves the
// exact behaviour open (e.g. whether createSetStartAction trims or slides),
// the mock implements one plausible behaviour and can be switched to others
// via `semantics`, so the adapter is tested against more than one
// interpretation. Results from the mock are never reported as Premiere tests.

export const TPS = 254016000000;

// ---------- value types ----------
export class TickTime {
  constructor(ticks = 0) {
    this._t = Math.round(Number(ticks));
  }
  static createWithSeconds(s) { return new TickTime(Math.round(s * TPS)); }
  static createWithTicks(t) { return new TickTime(Number(t)); }
  static createWithFrameAndFrameRate(frames, fr) { return new TickTime(frames * fr.ticksPerFrame); }
  get ticks() { return String(this._t); }
  get ticksNumber() { return this._t; }
  get seconds() { return this._t / TPS; }
  add(o) { return new TickTime(this._t + o._t); }
  subtract(o) { return new TickTime(this._t - o._t); }
  multiply(f) { return new TickTime(this._t * f); }
  divide(d) { return d === 0 ? TickTime.TIME_INVALID : new TickTime(this._t / d); }
  equals(o) { return o && o._t === this._t; }
  alignToFrame(fr) { return new TickTime(Math.floor(this._t / fr.ticksPerFrame) * fr.ticksPerFrame); }
  alignToNearestFrame(fr) { return new TickTime(Math.round(this._t / fr.ticksPerFrame) * fr.ticksPerFrame); }
}
TickTime.TIME_ZERO = new TickTime(0);
TickTime.TIME_ONE_SECOND = new TickTime(TPS);
TickTime.TIME_ONE_MINUTE = new TickTime(TPS * 60);
TickTime.TIME_ONE_HOUR = new TickTime(TPS * 3600);
TickTime.TIME_INVALID = new TickTime(-1);
TickTime.TIME_MAX = new TickTime(Number.MAX_SAFE_INTEGER);
TickTime.TIME_MIN = new TickTime(Number.MIN_SAFE_INTEGER);

const tt = (x) => (x instanceof TickTime ? x._t : Number(x?.ticksNumber ?? x));

export class FrameRate {
  constructor(value = 25) {
    this.value = value;
    this.ticksPerFrame = Math.round(TPS / value);
  }
  static createWithValue(v) {
    const fr = new FrameRate(v);
    const ntsc = { 23.976: 10594584000, 29.97: 8475667200, 59.94: 4237833600 };
    for (const [k, tpf] of Object.entries(ntsc)) if (Math.abs(v - Number(k)) < 0.01) fr.ticksPerFrame = tpf;
    return fr;
  }
  equals(o) { return o && o.ticksPerFrame === this.ticksPerFrame; }
}

export class Guid {
  constructor(s) { this._s = s || `guid-${Math.random().toString(36).slice(2, 10)}`; }
  static fromString(s) { return new Guid(s); }
  toString() { return this._s; }
}

export function PointF(x = 0, y = 0) {
  if (!(this instanceof PointF)) return new PointF(x, y);
  this.x = x;
  this.y = y;
}
PointF.prototype.distanceTo = function (p) { return Math.hypot(p.x - this.x, p.y - this.y); };

export function Color(r = 0, g = 0, b = 0, a = 1) {
  if (!(this instanceof Color)) return new Color(r, g, b, a);
  Object.assign(this, { red: r, green: g, blue: b, alpha: a });
}

export function RectF() {
  if (!(this instanceof RectF)) return new RectF();
  this.width = 0;
  this.height = 0;
}

export function AddTransitionOptions() {
  const o = { applyToStart: false, duration: new TickTime(TPS), forceSingleSided: false, transitionAlignment: 0.5 };
  o.setApplyToStart = (v) => ((o.applyToStart = v), o);
  o.setDuration = (t) => ((o.duration = t), o);
  o.setForceSingleSided = (v) => ((o.forceSingleSided = v), o);
  o.setTransitionAlignment = (v) => ((o.transitionAlignment = v), o);
  return o;
}

const enumOf = (names) => Object.fromEntries(names.map((n, i) => [n, i]));
export const Constants = {
  TrackItemType: enumOf(["EMPTY", "CLIP", "TRANSITION", "PREVIEW", "FEEDBACK"]),
  MediaType: enumOf(["ANY", "DATA", "VIDEO", "AUDIO"]),
  TransitionPosition: enumOf(["START", "END"]),
  InterpolationMode: enumOf(["BEZIER", "HOLD", "LINEAR", "TIME", "TIME_TRANSITION_END", "TIME_TRANSITION_START"]),
  MarkerColor: enumOf(["GREEN", "RED", "MAGNETA", "MAGENTA", "ORANGE", "YELLOW", "BLUE", "CYAN"]),
  ExportType: enumOf(["QUEUE_TO_AME", "QUEUE_TO_APP", "IMMEDIATELY"]),
  ContentType: enumOf(["ANY", "SEQUENCE", "MEDIA"]),
  SequenceEvent: enumOf(["ACTIVATED", "CLOSED", "SELECTION_CHANGED"]),
  ProjectEvent: enumOf(["OPENED", "CLOSED", "DIRTY", "ACTIVATED", "PROJECT_ITEM_SELECTION_CHANGED"]),
  VideoTrackEvent: enumOf(["TRACK_CHANGED", "INFO_CHANGED", "LOCK_CHANGED"]),
  AudioTrackEvent: enumOf(["TRACK_CHANGED", "INFO_CHANGED", "LOCK_CHANGED"]),
  PropertyType: enumOf(["PERSISTENT", "NON_PERSISTENT"]),
  SequenceOperation: enumOf(["APPLYCUT", "CREATEMARKER", "CREATESUBCLIP"]),
};

// ---------- world ----------
class World {
  constructor(opts) {
    this.opts = opts;
    this.semantics = { setStart: "trim", setEnd: "trim", setInPoint: "slip-duration", ...(opts.semantics || {}) };
    this.lockDepth = 0;
    this.files = new Map(); // path -> media descriptor
    this.undoStack = [];
    this.transactions = [];
    this.lastError = null;
    this.listeners = [];
    this.writeFile = opts.writeFile || (() => {});
    this.nextId = 1;
    this.failNext = null; // test hook: (label) => boolean
  }
  id(p) { return `${p}${this.nextId++}`; }
  requireLock(what) {
    if (this.lockDepth <= 0) throw new Error(`${what}: Actions must be created inside project.lockedAccess() (Premiere 26.3+)`);
  }
  action(desc, apply) {
    this.requireLock(desc);
    return new Action(desc, apply);
  }
}

class Action {
  constructor(desc, apply) {
    this.desc = desc;
    this._apply = apply;
  }
}

class CompoundAction {
  constructor() { this.actions = []; }
  addAction(a) {
    if (!(a instanceof Action)) throw new Error("addAction expects an Action");
    this.actions.push(a);
    return true;
  }
  get empty() { return this.actions.length === 0; }
}

// ---------- project items ----------
class ProjectItemBase {
  constructor(world, project, name, type) {
    this.world = world;
    this.project = project;
    this.name = name;
    this.type = type;
    this._id = world.id("pi");
    this.parent = null;
    this.colorLabel = 0;
  }
  getId() { return this._id; }
  getParentBin() { return this.parent; }
  async getProject() { return this.project; }
  async getColorLabelIndex() { return this.colorLabel; }
  createSetNameAction(n) { return this.world.action("rename item", () => (this.name = n)); }
  createSetColorLabelAction(i) { return this.world.action("color label", () => (this.colorLabel = i)); }
}

export class ClipProjectItem extends ProjectItemBase {
  constructor(world, project, media, sequence = null) {
    super(world, project, sequence ? sequence.name : media.name, 1);
    this.media = media;
    this.sequenceRef = sequence;
    this.inMark = null;
    this.outMark = null;
    this.markers = new MarkersImpl(world);
    this.transcript = media?.transcript || null;
  }
  createSetNameAction(n) {
    return this.world.action("rename item", () => {
      this.name = n;
      if (this.sequenceRef) this.sequenceRef.name = n;
    });
  }
  static cast(pi) { return pi instanceof ClipProjectItem ? pi : null; }
  async getMediaFilePath() { return this.media ? this.media.path : ""; }
  async isSequence() { return !!this.sequenceRef; }
  async getSequence() { return this.sequenceRef; }
  async isOffline() { return !!this.media?.offline; }
  async isMulticamClip() { return false; }
  async isMergedClip() { return false; }
  async getContentType() { return this.sequenceRef ? Constants.ContentType.SEQUENCE : Constants.ContentType.MEDIA; }
  async getInPoint() { return new TickTime(this.inMark ?? 0); }
  async getOutPoint() { return new TickTime(this.outMark ?? this.durationTicks()); }
  durationTicks() { return this.sequenceRef ? this.sequenceRef._endTicks() : this.media.duration; }
  async getMedia() {
    const d = this.durationTicks();
    return { getDuration: () => new TickTime(d), getStart: () => TickTime.TIME_ZERO, duration: Promise.resolve(new TickTime(d)), start: Promise.resolve(TickTime.TIME_ZERO) };
  }
  async getFootageInterpretation() {
    const fps = this.media?.fps || 25;
    return { getFrameRate: () => fps, getPixelAspectRatio: () => 1, getFieldType: () => 0 };
  }
  async getComponentChain() { return null; }
  createSetInOutPointsAction(i, o) {
    return this.world.action("set source in/out", () => {
      this.inMark = tt(i);
      this.outMark = tt(o);
    });
  }
  createSetInPointAction(i) { return this.world.action("set source in", () => (this.inMark = tt(i))); }
  createSetOutPointAction(o) { return this.world.action("set source out", () => (this.outMark = tt(o))); }
  createClearInOutPointsAction() {
    return this.world.action("clear source in/out", () => {
      this.inMark = null;
      this.outMark = null;
    });
  }
  createSubClipAction(name, s, e) {
    return this.world.action("subclip", () => {
      const sub = new ClipProjectItem(this.world, this.project, { ...this.media, name });
      sub.inMark = tt(s);
      sub.outMark = tt(e);
      (this.parent || this.project.root).children.push(sub);
      sub.parent = this.parent || this.project.root;
    });
  }
}

export class FolderItem extends ProjectItemBase {
  constructor(world, project, name, type = 2) {
    super(world, project, name, type);
    this.children = [];
  }
  static cast(pi) { return pi instanceof FolderItem ? pi : null; }
  async getItems() { return [...this.children]; }
  createBinAction(name, makeUnique) {
    return this.world.action("create bin", () => {
      let n = name;
      if (makeUnique) {
        let k = 1;
        while (this.children.some((c) => c.name === n)) n = `${name} ${++k}`;
      }
      const b = new FolderItem(this.world, this.project, n);
      b.parent = this;
      this.children.push(b);
    });
  }
  createMoveItemAction(item, newParent) {
    return this.world.action("move item", () => {
      const from = item.parent || this.project.root;
      from.children = from.children.filter((c) => c !== item);
      newParent.children.push(item);
      item.parent = newParent;
    });
  }
  createRemoveItemAction(item) {
    return this.world.action("remove item", () => {
      this.children = this.children.filter((c) => c !== item);
    });
  }
  createRenameBinAction(n) { return this.world.action("rename bin", () => (this.name = n)); }
  createSmartBinAction() { return this.world.action("smart bin", () => {}); }
}

export const ProjectItem = {
  cast: (i) => i,
  TYPE_BIN: 2, TYPE_CLIP: 1, TYPE_COMPOUND: 5, TYPE_FILE: 4, TYPE_ROOT: 3, TYPE_STYLE: 6,
};

// ---------- components ----------
class ParamImpl {
  constructor(world, displayName, value, kind) {
    this.world = world;
    this.displayName = displayName;
    this.value = value;
    this.kind = kind || (value instanceof PointF ? "point" : typeof value);
    this.timeVarying = false;
    this.keys = new Map();
    this.interp = new Map();
  }
  async areKeyframesSupported() { return true; }
  createKeyframe(v) {
    const ok =
      (this.kind === "point" && v instanceof PointF) ||
      (this.kind === "number" && typeof v === "number") ||
      (this.kind === "boolean" && typeof v === "boolean") ||
      (this.kind === "string" && typeof v === "string") ||
      (this.kind === "color" && v instanceof Color);
    if (!ok) throw new Error(`Value is not compatible with parameter ${this.displayName} (${this.kind})`);
    const kf = { position: new TickTime(0), value: { value: v } };
    kf.getTemporalInterpolationMode = async () => Constants.InterpolationMode.LINEAR;
    kf.setTemporalInterpolationMode = async () => true;
    return kf;
  }
  createSetTimeVaryingAction(b) {
    return this.world.action("set time varying", () => {
      this.timeVarying = b;
      if (!b) this.keys.clear();
    });
  }
  createSetValueAction(kf) {
    return this.world.action("set param value", () => {
      if (this.timeVarying) throw new Error(`Parameter ${this.displayName} is time-varying; add keyframes instead`);
      this.value = kf.value.value;
    });
  }
  createAddKeyframeAction(kf) {
    return this.world.action("add keyframe", () => {
      if (!this.timeVarying) throw new Error(`Parameter ${this.displayName} is not time-varying`);
      this.keys.set(tt(kf.position), kf.value.value);
    });
  }
  createRemoveKeyframeAction(t) { return this.world.action("remove keyframe", () => this.keys.delete(tt(t))); }
  createRemoveKeyframeRangeAction(a, b) {
    return this.world.action("remove keyframe range", () => {
      for (const k of [...this.keys.keys()]) if (k >= tt(a) && k <= tt(b)) this.keys.delete(k);
    });
  }
  createSetInterpolationAtKeyframeAction(t, mode) { return this.world.action("interp", () => this.interp.set(tt(t), mode)); }
  getKeyframeListAsTickTimes() { return [...this.keys.keys()].sort((a, b) => a - b).map((k) => new TickTime(k)); }
  getKeyframePtr(t) {
    const v = this.keys.get(tt(t));
    if (v === undefined) throw new Error("No keyframe at time");
    return { position: new TickTime(tt(t)), value: { value: v } };
  }
  isTimeVarying() { return this.timeVarying; }
  async getStartValue() {
    const v = this.timeVarying && this.keys.size ? this.keys.get(Math.min(...this.keys.keys())) : this.value;
    return { position: TickTime.TIME_ZERO, value: { value: v } };
  }
  async getValueAtTime(t) {
    if (t === undefined) throw new Error("time required");
    if (!this.timeVarying || !this.keys.size) return this.value;
    const ks = [...this.keys.keys()].sort((a, b) => a - b);
    const x = tt(t);
    if (x <= ks[0]) return this.keys.get(ks[0]);
    if (x >= ks[ks.length - 1]) return this.keys.get(ks[ks.length - 1]);
    for (let i = 0; i < ks.length - 1; i++) {
      if (x >= ks[i] && x <= ks[i + 1]) {
        const a = this.keys.get(ks[i]);
        const b = this.keys.get(ks[i + 1]);
        const f = (x - ks[i]) / (ks[i + 1] - ks[i]);
        if (typeof a === "number") return a + (b - a) * f;
        if (a instanceof PointF) return new PointF(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
        return a;
      }
    }
    return this.value;
  }
}

class ComponentImpl {
  constructor(world, matchName, displayName, params) {
    this.world = world;
    this.matchName = matchName;
    this.displayName = displayName;
    this.params = params.map(([n, v, k]) => new ParamImpl(world, n, v, k));
  }
  async getDisplayName() { return this.displayName; }
  async getMatchName() { return this.matchName; }
  getParam(i = 0) {
    if (i < 0 || i >= this.params.length) throw new Error(`Param index ${i} out of range`);
    return this.params[i];
  }
  getParamCount() { return this.params.length; }
}

const VIDEO_EFFECTS = {
  "AE.ADBE Lumetri": ["Lumetri Color", [["Exposure", 0], ["Contrast", 0], ["Highlights", 0], ["Shadows", 0], ["Whites", 0], ["Blacks", 0], ["Temperature", 0], ["Tint", 0], ["Saturation", 100], ["Vibrance", 0], ["Input LUT", "", "string"], ["Look", "", "string"], ["Look Intensity", 100], ["Faded Film", 0], ["Sharpen", 0], ["Vignette Amount", 0]]],
  "AE.ADBE Gaussian Blur 2": ["Gaussian Blur", [["Blurriness", 0]]],
  "AE.ADBE AECrop": ["Crop", [["Left", 0], ["Top", 0], ["Right", 0], ["Bottom", 0], ["Zoom", false, "boolean"], ["Edge Feather", 0]]],
  "AE.ADBE SubspaceStabilizer": ["Warp Stabilizer", [["Smoothness", 50]]],
  "PR.ADBE Gamma Correction": ["Gamma Correction", [["Gamma", 10]]],
  "AE.ADBE Black & White": ["Black & White", []],
  "AE.ADBE Sharpen": ["Sharpen", [["Sharpen Amount", 0]]],
};
const AUDIO_EFFECTS = {
  "Vocal Enhancer": [["Mode", 0]],
  "DeNoise": [["Amount", 40]],
  "DeReverb": [["Amount", 30]],
  "Parametric Equalizer": [["Master Gain", 0]],
  "Hard Limiter": [["Maximum Amplitude", -1]],
  "Dynamics": [["Threshold", -20]],
  "Highpass": [["Cutoff", 80]],
  "Amplify": [["Gain", 0]],
};

class ChainImpl {
  constructor(world, owner, comps) {
    this.world = world;
    this.owner = owner;
    this.comps = comps;
  }
  getComponentAtIndex(i) {
    if (i < 0 || i >= this.comps.length) throw new Error(`Component index ${i} out of range`);
    return this.comps[i];
  }
  getComponentCount() { return this.comps.length; }
  createAppendComponentAction(c) { return this.world.action("append effect", () => (this.owner._checkLock(), this.comps.push(c))); }
  createInsertComponentAction(c, i) { return this.world.action("insert effect", () => (this.owner._checkLock(), this.comps.splice(Math.min(i, this.comps.length), 0, c))); }
  createRemoveComponentAction(c) {
    return this.world.action("remove effect", () => {
      this.owner._checkLock();
      const i = this.comps.indexOf(c);
      if (i < 0) throw new Error("component not in chain");
      this.comps.splice(i, 1);
    });
  }
}

// ---------- track items ----------
class TrackItemBase {
  constructor(world, track, props) {
    this.world = world;
    this.track = track;
    Object.assign(this, { start: 0, end: 0, inPoint: 0, outPoint: 0, disabled: false, speed: 1, reversed: false, linkId: null, name: "" }, props);
    this.uid = world.id("ti");
    this.transitions = { start: null, end: null };
  }
  _checkLock() {
    if (this.track.locked) throw new Error(`Track ${this.track.name} is locked`);
  }
  _alive() {
    if (!this.track.items.includes(this)) throw new Error("Track item no longer exists in the sequence");
  }
  async getStartTime() { return new TickTime(this.start); }
  async getEndTime() { return new TickTime(this.end); }
  async getDuration() { return new TickTime(this.end - this.start); }
  async getInPoint() { return new TickTime(this.inPoint); }
  async getOutPoint() { return new TickTime(this.outPoint); }
  async getName() { return this.name; }
  async getMatchName() { return this.name; }
  async getProjectItem() { return this.projectItem; }
  async getSpeed() { return this.speed; }
  async isSpeedReversed() { return this.reversed ? 1 : 0; }
  async isDisabled() { return this.disabled; }
  async isAdjustmentLayer() { return false; }
  async getIsSelected() { return this.track.seq.selection.includes(this); }
  async getTrackIndex() { return this.track.index; }
  async getType() { return Constants.TrackItemType.CLIP; }
  async getMediaType() { return new Guid(this.kind); }
  async getComponentChain() { return this.chain; }
  _mut(desc, fn) {
    return this.world.action(desc, () => {
      this._alive();
      this._checkLock();
      fn();
      if (this.end <= this.start) throw new Error(`${desc}: resulting duration must be positive`);
      if (this.inPoint < 0) throw new Error(`${desc}: in point before media start`);
      const mediaDur = this.projectItem.durationTicks();
      if (this.outPoint > mediaDur + 1) throw new Error(`${desc}: out point beyond media end`);
      this.track.sort();
    });
  }
  createMoveAction(delta) {
    return this._mut("move", () => {
      this.start += tt(delta);
      this.end += tt(delta);
      if (this.start < 0) throw new Error("move: before sequence start");
    });
  }
  createSetStartAction(t) {
    const v = tt(t);
    return this._mut("set start", () => {
      const sem = this.world.semantics.setStart;
      if (sem === "trim") {
        this.inPoint += v - this.start;
        this.start = v;
      } else {
        const d = this.end - this.start;
        this.start = v;
        this.end = v + d;
      }
    });
  }
  createSetEndAction(t) {
    const v = tt(t);
    return this._mut("set end", () => {
      this.outPoint += v - this.end;
      this.end = v;
    });
  }
  createSetInPointAction(t) {
    const v = tt(t);
    return this._mut("set in point", () => {
      const sem = this.world.semantics.setInPoint;
      if (sem === "slip-duration") {
        // in changes, start fixed, duration follows (out unchanged)
        this.inPoint = v;
        this.end = this.start + (this.outPoint - this.inPoint);
      } else {
        // "slip": keep duration, shift out too
        const d = this.outPoint - this.inPoint;
        this.inPoint = v;
        this.outPoint = v + d;
      }
    });
  }
  createSetOutPointAction(t) {
    const v = tt(t);
    return this._mut("set out point", () => {
      this.outPoint = v;
      this.end = this.start + (this.outPoint - this.inPoint);
    });
  }
  createSetDisabledAction(b) { return this._mut("disable", () => (this.disabled = b)); }
  createSetNameAction(n) { return this._mut("rename clip", () => (this.name = n)); }
}

export class VideoClipTrackItem extends TrackItemBase {
  constructor(world, track, props) {
    super(world, track, props);
    this.kind = "video";
    this.chain = new ChainImpl(world, this, [
      new ComponentImpl(world, "AE.ADBE Opacity", "Opacity", [["Opacity", 100], ["Blend Mode", 0]]),
      new ComponentImpl(world, "AE.ADBE Motion", "Motion", [["Position", new PointF(0.5, 0.5)], ["Scale", 100], ["Scale Width", 100], ["Uniform Scale", true, "boolean"], ["Rotation", 0], ["Anchor Point", new PointF(0.5, 0.5)], ["Anti-flicker Filter", 0]]),
    ]);
  }
  createAddVideoTransitionAction(tr, opts = AddTransitionOptions()) {
    return this._mut("add transition", () => {
      const pos = opts.applyToStart ? "start" : "end";
      const d = tt(opts.duration);
      const handle = pos === "start" ? this.inPoint : this.projectItem.durationTicks() - this.outPoint;
      const need = opts.forceSingleSided ? 0 : d * opts.transitionAlignment;
      this.transitions[pos] = { matchName: tr.matchName, duration: d, alignment: opts.transitionAlignment, repeatedFrames: handle < need };
    });
  }
  createRemoveVideoTransitionAction(position = Constants.TransitionPosition.START) {
    return this._mut("remove transition", () => {
      this.transitions[position === Constants.TransitionPosition.END ? "end" : "start"] = null;
    });
  }
}
VideoClipTrackItem.TRACKITEMTYPE_CLIP = 1;
VideoClipTrackItem.TRACKITEMTYPE_EMPTY = 0;
VideoClipTrackItem.TRACKITEMTYPE_TRANSITION = 2;

export class AudioClipTrackItem extends TrackItemBase {
  constructor(world, track, props) {
    super(world, track, props);
    this.kind = "audio";
    this.chain = new ChainImpl(world, this, [
      new ComponentImpl(world, "AE.ADBE Volume", "Volume", [["Bypass", false, "boolean"], ["Level", world.opts.volumeUnits === "linear" ? 0.17782794 : 0]]),
      new ComponentImpl(world, "AE.ADBE Channel Volume", "Channel Volume", [["Bypass", false, "boolean"], ["Left", 0], ["Right", 0]]),
      new ComponentImpl(world, "AE.ADBE Panner", "Panner", [["Balance", 0]]),
    ]);
  }
}
AudioClipTrackItem.TRACKITEMTYPE_CLIP = 1;
AudioClipTrackItem.TRACKITEMTYPE_EMPTY = 0;

// ---------- tracks & sequences ----------
class TrackImpl {
  constructor(world, seq, kind, index, name) {
    this.world = world;
    this.seq = seq;
    this.kind = kind;
    this.index = index;
    this.name = name;
    this.id = index;
    this.items = [];
    this.muted = false;
    this.locked = false; // mock-only: the UXP API has no lock getter
  }
  sort() { this.items.sort((a, b) => a.start - b.start); }
  async getIndex() { return this.index; }
  async getMediaType() { return new Guid(this.kind); }
  async isMuted() { return this.muted; }
  async setMute(m) { this.muted = m; return true; }
  createSetNameAction(n) { return this.world.action("rename track", () => (this.name = n)); }
  getTrackItems(type, includeEmpty) {
    if (type !== Constants.TrackItemType.CLIP && type !== Constants.TrackItemType.EMPTY) return [];
    this.sort();
    return [...this.items];
  }
  /** Clear [a,b) on this track (overwrite semantics), splitting/trimming items. */
  _clearRange(a, b) {
    if (this.locked) throw new Error(`Track ${this.name} is locked`);
    const out = [];
    for (const it of this.items) {
      if (it.end <= a || it.start >= b) out.push(it);
      else if (it.start < a && it.end > b) {
        const tail = new it.constructor(this.world, this, { ...pick(it), start: b, inPoint: it.inPoint + (b - it.start) });
        it.outPoint -= it.end - a;
        it.end = a;
        out.push(it, tail);
      } else if (it.start < a) {
        it.outPoint -= it.end - a;
        it.end = a;
        out.push(it);
      } else if (it.end > b) {
        it.inPoint += b - it.start;
        it.start = b;
        out.push(it);
      }
    }
    this.items = out;
  }
  _rippleFrom(t, delta) {
    if (this.locked) throw new Error(`Track ${this.name} is locked`);
    for (const it of this.items) if (it.start >= t) {
      it.start += delta;
      it.end += delta;
    }
  }
}
function pick(it) {
  return { end: it.end, outPoint: it.outPoint, projectItem: it.projectItem, name: it.name, linkId: it.linkId, disabled: it.disabled };
}

class TrackItemSelectionImpl {
  constructor(items = []) { this.items = items; }
  static createEmptySelection(cb) { cb(new TrackItemSelectionImpl()); return true; }
  addItem(it) { if (!this.items.includes(it)) this.items.push(it); return true; }
  removeItem(it) { this.items = this.items.filter((x) => x !== it); return true; }
  async getTrackItems() { return [...this.items]; }
}
export const TrackItemSelection = { createEmptySelection: TrackItemSelectionImpl.createEmptySelection };

class SequenceImpl {
  constructor(world, project, name, settings) {
    this.world = world;
    this.project = project;
    this.name = name;
    this.guid = new Guid();
    this.fps = settings.fps;
    this.width = settings.width;
    this.height = settings.height;
    this.video = [];
    this.audio = [];
    for (let i = 0; i < (settings.videoTracks ?? 3); i++) this.video.push(new TrackImpl(world, this, "video", i, `V${i + 1}`));
    for (let i = 0; i < (settings.audioTracks ?? 3); i++) this.audio.push(new TrackImpl(world, this, "audio", i, `A${i + 1}`));
    this.markersImpl = new MarkersImpl(world);
    this.selection = [];
    this.playhead = 0;
    this.inPt = 0;
    this.outPt = 0;
    this.zero = 0;
    this.projectItem = new ClipProjectItem(world, project, null, this);
  }
  get frameRate() { return FrameRate.createWithValue(this.fps); }
  _endTicks() { return Math.max(0, ...[...this.video, ...this.audio].flatMap((t) => t.items.map((i) => i.end))); }
  _track(kind, i, create) {
    const arr = kind === "video" ? this.video : this.audio;
    while (create && arr.length <= i) arr.push(new TrackImpl(this.world, this, kind, arr.length, `${kind === "video" ? "V" : "A"}${arr.length + 1}`));
    if (!arr[i]) throw new Error(`No ${kind} track ${i}`);
    return arr[i];
  }
  async getVideoTrackCount() { return this.video.length; }
  async getAudioTrackCount() { return this.audio.length; }
  async getCaptionTrackCount() { return 0; }
  async getVideoTrack(i) { return this.video[i] || null; }
  async getAudioTrack(i) { return this.audio[i] || null; }
  async getEndTime() { return new TickTime(this._endTicks()); }
  async getFrameSize() { const r = new RectF(); r.width = this.width; r.height = this.height; return r; }
  async getInPoint() { return new TickTime(this.inPt); }
  async getOutPoint() { return new TickTime(this.outPt); }
  async getZeroPoint() { return new TickTime(this.zero); }
  async getPlayerPosition() { return new TickTime(this.playhead); }
  async setPlayerPosition(t) { this.playhead = tt(t ?? 0); return true; }
  async getProjectItem() { return this.projectItem; }
  async getTimebase() { return String(this.frameRate.ticksPerFrame); }
  async getSettings() {
    const s = this;
    return {
      getVideoFrameRate: () => s.frameRate,
      getVideoFrameRect: async () => { const r = new RectF(); r.width = s.width; r.height = s.height; return r; },
      getAudioSampleRate: async () => FrameRate.createWithValue(48000),
      getAudioChannelCount: async () => 2,
      getVideoPixelAspectRatio: async () => "1",
      getEditingMode: async () => "Custom",
      _rect: null,
      async setVideoFrameRect(r) { this._rect = { width: r.width, height: r.height }; return true; },
    };
  }
  async getSelection() { return new TrackItemSelectionImpl([...this.selection]); }
  setSelection(sel) { this.selection = [...sel.items]; this.world.emit("selection", this); return true; }
  async clearSelection() { this.selection = []; return true; }
  async isDoneAnalyzingForVideoEffects() { return true; }
  createSetInPointAction(t) { return this.world.action("seq in", () => (this.inPt = tt(t))); }
  createSetOutPointAction(t) { return this.world.action("seq out", () => (this.outPt = tt(t))); }
  createSetZeroPointAction(t) { return this.world.action("seq zero", () => (this.zero = tt(t))); }
  createSetSettingsAction(settings) {
    return this.world.action("seq settings", () => {
      if (settings?._rect) Object.assign(this, settings._rect);
    });
  }
  createCloneAction() {
    return this.world.action("clone sequence", () => {
      const c = this._clone(`${this.name} Copy`);
      this.project.sequences.push(c);
      (this.projectItem.parent || this.project.root).children.push(c.projectItem);
      c.projectItem.parent = this.projectItem.parent || this.project.root;
    });
  }
  _clone(name) {
    const c = new SequenceImpl(this.world, this.project, name, { fps: this.fps, width: this.width, height: this.height, videoTracks: 0, audioTracks: 0 });
    const linkMap = new Map();
    for (const kind of ["video", "audio"]) {
      for (const t of this[kind]) {
        const nt = c._track(kind, t.index, true);
        nt.name = t.name;
        for (const it of t.items) {
          let l = it.linkId;
          if (l) { if (!linkMap.has(l)) linkMap.set(l, this.world.id("lk")); l = linkMap.get(l); }
          const n = new it.constructor(this.world, nt, { ...pick(it), start: it.start, inPoint: it.inPoint, linkId: l });
          n.transitions = { ...it.transitions };
          nt.items.push(n);
        }
      }
    }
    for (const m of this.markersImpl.list) c.markersImpl.list.push(Object.assign(Object.create(Object.getPrototypeOf(m)), m, { guid: new Guid() }));
    return c;
  }
  async createSubsequence() { return this._clone(`${this.name} Sub`); }
}

// ---------- markers ----------
class MarkerImpl {
  constructor(world, name, type, start, duration, comments) {
    Object.assign(this, { world, name, type, start, duration, comments, colorIndex: 0, guid: new Guid() });
  }
  getName() { return this.name; }
  getComments() { return this.comments; }
  getStart() { return new TickTime(this.start); }
  getDuration() { return new TickTime(this.duration); }
  getType() { return this.type; }
  getColorIndex() { return this.colorIndex; }
  getColor() { return new Color(); }
  getTarget() { return ""; }
  getUrl() { return ""; }
  createSetNameAction(n) { return this.world.action("marker name", () => (this.name = n)); }
  createSetCommentsAction(c) { return this.world.action("marker comments", () => (this.comments = c)); }
  createSetDurationAction(d) { return this.world.action("marker dur", () => (this.duration = tt(d))); }
  createSetTypeAction(t) { return this.world.action("marker type", () => (this.type = t)); }
  createSetColorByIndexAction(i) { return this.world.action("marker color", () => (this.colorIndex = i)); }
}
class MarkersImpl {
  constructor(world) { this.world = world; this.list = []; }
  getMarkers(filters) { return this.list.filter((m) => !filters || filters.includes(m.type)).sort((a, b) => a.start - b.start); }
  createAddMarkerAction(name, type = "Comment", start = TickTime.TIME_ZERO, duration = TickTime.TIME_ZERO, comments = "") {
    return this.world.action("add marker", () => this.list.push(new MarkerImpl(this.world, name, type, tt(start), tt(duration), comments)));
  }
  createMoveMarkerAction(m, t) { return this.world.action("move marker", () => (m.start = tt(t))); }
  createRemoveMarkerAction(m) { return this.world.action("remove marker", () => (this.list = this.list.filter((x) => x !== m))); }
}
export const Markers = {
  getMarkers: async (owner) => (owner instanceof SequenceImpl ? owner.markersImpl : owner.markers),
};
export const Marker = { MARKER_TYPE_CHAPTER: "Chapter", MARKER_TYPE_COMMENT: "Comment", MARKER_TYPE_FLVCUEPOINT: "FLVCuePoint", MARKER_TYPE_WEBLINK: "WebLink" };

// ---------- project ----------
class ProjectImpl {
  constructor(world, name, path) {
    this.world = world;
    this.name = name;
    this.path = path;
    this.guid = new Guid();
    this.root = new FolderItem(world, this, "Root", 3);
    this.sequences = [];
    this.active = null;
    this.panelSelection = [];
  }
  async getRootItem() { return this.root; }
  async getInsertionBin() { return this.root; }
  async getActiveSequence() { return this.active; }
  async setActiveSequence(s) { this.active = s; this.world.emit("activated", s); return true; }
  async openSequence(s) { this.active = s; return true; }
  async closeSequence() { return true; }
  async getSequences() { return [...this.sequences]; }
  getSequence(guid) { return this.sequences.find((s) => s.guid.toString() === guid.toString()) || null; }
  async createSequence(name) {
    const d = this.world.opts.defaultSequence || { fps: 25, width: 1920, height: 1080 };
    return this._addSeq(new SequenceImpl(this.world, this, name, d));
  }
  async createSequenceWithPresetPath(name, preset) {
    const d = { ...(this.world.opts.defaultSequence || { fps: 25, width: 1920, height: 1080 }) };
    if (/9x16|vertical|portrait/i.test(preset)) Object.assign(d, { width: 1080, height: 1920 });
    return this._addSeq(new SequenceImpl(this.world, this, name, d));
  }
  async createSequenceFromMedia(name, clips = [], bin) {
    const first = clips[0]?.media;
    const s = new SequenceImpl(this.world, this, name, { fps: first?.fps || 25, width: first?.width || 1920, height: first?.height || 1080 });
    let t = 0;
    for (const c of clips) {
      placeClip(this.world, s, c, t, 0, 0, false);
      t += c.durationTicks();
    }
    return this._addSeq(s, bin);
  }
  _addSeq(s, bin) {
    this.sequences.push(s);
    const b = bin || this.root;
    b.children.push(s.projectItem);
    s.projectItem.parent = b;
    return s;
  }
  async deleteSequence(s) {
    this.sequences = this.sequences.filter((x) => x !== s);
    const p = s.projectItem.parent || this.root;
    p.children = p.children.filter((c) => c !== s.projectItem);
    if (this.active === s) this.active = this.sequences[0] || null;
    return true;
  }
  async importFiles(paths, suppressUI, targetBin) {
    const bin = targetBin || this.root;
    for (const p of paths) {
      const media = this.world.files.get(p);
      if (!media) return false;
      const item = new ClipProjectItem(this.world, this, media);
      item.parent = bin;
      bin.children.push(item);
    }
    return true;
  }
  async save() { return true; }
  lockedAccess(cb) {
    this.world.lockDepth++;
    try {
      cb();
    } finally {
      this.world.lockDepth--;
    }
  }
  executeTransaction(cb, label = "") {
    const comp = new CompoundAction();
    cb(comp);
    const snap = snapshot(this);
    try {
      if (this.world.failNext && this.world.failNext(label)) throw new Error(`Simulated failure in "${label}"`);
      for (const a of comp.actions) a._apply();
      this.world.transactions.push({ label, actions: comp.actions.map((a) => a.desc) });
      this.world.undoStack.push({ label, snap });
      this.world.lastError = null;
      return true;
    } catch (e) {
      restore(this, snap);
      this.world.lastError = e;
      return false;
    }
  }
}

/** Overwrite/insert a clip project item (honouring its source in/out marks). */
function placeClip(world, seq, clip, t, vIdx, aIdx, insert, limitShift = true) {
  const inT = clip.inMark ?? 0;
  const outT = clip.outMark ?? clip.durationTicks();
  const dur = outT - inT;
  if (dur <= 0) throw new Error("Source in/out range is empty");
  const media = clip.media || { hasVideo: true, hasAudio: true };
  const linkId = media.hasVideo && media.hasAudio ? world.id("lk") : null;
  const targets = [];
  if (media.hasVideo) targets.push(seq._track("video", vIdx, true));
  if (media.hasAudio) targets.push(seq._track("audio", aIdx, true));
  if (insert) {
    const ripple = limitShift ? targets : [...seq.video, ...seq.audio];
    for (const tr of ripple) {
      // split an item spanning t, then shift
      tr._clearRange(t, t); // no-op; keeps behaviour simple
      for (const it of tr.items) if (it.start < t && it.end > t) {
        const tail = new it.constructor(world, tr, { ...pick(it), start: t, inPoint: it.inPoint + (t - it.start) });
        it.outPoint -= it.end - t;
        it.end = t;
        tr.items.push(tail);
      }
      tr._rippleFrom(t, dur);
    }
  } else {
    for (const tr of targets) tr._clearRange(t, t + dur);
  }
  const created = [];
  for (const tr of targets) {
    const Ctor = tr.kind === "video" ? VideoClipTrackItem : AudioClipTrackItem;
    const it = new Ctor(world, tr, { start: t, end: t + dur, inPoint: inT, outPoint: outT, projectItem: clip, name: clip.name, linkId });
    tr.items.push(it);
    tr.sort();
    created.push(it);
  }
  return created;
}

function snapshot(project) {
  return project.sequences.map((s) => ({
    s,
    video: s.video.map((t) => ({ t, items: t.items.map((i) => ({ i, st: { ...i, transitions: { ...i.transitions } } })) })),
    audio: s.audio.map((t) => ({ t, items: t.items.map((i) => ({ i, st: { ...i, transitions: { ...i.transitions } } })) })),
    vlen: s.video.length,
    alen: s.audio.length,
    markers: s.markersImpl.list.map((m) => ({ m, st: { ...m } })),
    io: [s.inPt, s.outPt],
  })).concat([{ seqs: [...project.sequences], clips: collectClips(project.root).map((c) => ({ c, marks: [c.inMark, c.outMark] })) }]);
}
function collectClips(folder) {
  return folder.children.flatMap((c) => (c instanceof FolderItem ? collectClips(c) : [c]));
}
function restore(project, snap) {
  const meta = snap[snap.length - 1];
  project.sequences = meta.seqs;
  for (const { c, marks } of meta.clips) [c.inMark, c.outMark] = marks;
  for (const e of snap.slice(0, -1)) {
    const { s } = e;
    s.video.length = e.vlen;
    s.audio.length = e.alen;
    for (const k of ["video", "audio"]) for (const { t, items } of e[k]) {
      t.items = items.map(({ i, st }) => Object.assign(i, st));
    }
    s.markersImpl.list = e.markers.map(({ m, st }) => Object.assign(m, st));
    [s.inPt, s.outPt] = e.io;
  }
}

// ---------- editor ----------
class SequenceEditorImpl {
  constructor(world, seq) { this.world = world; this.seq = seq; }
  createOverwriteItemAction(pi, time, v, a) {
    return this.world.action("overwrite", () => placeClip(this.world, this.seq, pi, tt(time), v, a, false));
  }
  createInsertProjectItemAction(pi, time, v, a, limitShift) {
    return this.world.action("insert", () => placeClip(this.world, this.seq, pi, tt(time), v, a, true, limitShift));
  }
  createRemoveItemsAction(sel, ripple) {
    return this.world.action("remove items", () => {
      for (const it of sel.items) {
        it._checkLock();
        const tr = it.track;
        if (!tr.items.includes(it)) continue;
        tr.items = tr.items.filter((x) => x !== it);
        if (ripple) tr._rippleFrom(it.end, -(it.end - it.start));
      }
      this.seq.selection = this.seq.selection.filter((x) => !sel.items.includes(x));
    });
  }
  createCloneTrackItemAction(it, offset, vOff, aOff, alignToVideo, isInsert) {
    return this.world.action("clone item", () => {
      const tr = this.seq._track(it.kind, it.track.index + (it.kind === "video" ? vOff : aOff), true);
      const s = it.start + tt(offset);
      const d = it.end - it.start;
      if (isInsert) tr._rippleFrom(s, d);
      else tr._clearRange(s, s + d);
      const n = new it.constructor(this.world, tr, { ...pick(it), start: s, end: s + d, inPoint: it.inPoint, linkId: null });
      tr.items.push(n);
      tr.sort();
    });
  }
  insertMogrtFromPath(path, time, v) {
    this.world.requireLock("insertMogrtFromPath");
    const media = this.world.files.get(path);
    if (!media) throw new Error(`MOGRT not found: ${path}`);
    const clip = new ClipProjectItem(this.world, this.seq.project, { ...media, hasAudio: false });
    const items = placeClip(this.world, this.seq, clip, tt(time), v, 0, false);
    items[0].chain.comps.push(new ComponentImpl(this.world, "AE.ADBE Capsule", "Graphic Parameters", [["Text", "Title", "string"]]));
    return items;
  }
  insertMogrtFromLibrary() { throw new Error("Libraries not available in simulation"); }
}
export const SequenceEditor = {
  getEditor: (seq) => new SequenceEditorImpl(seq.world, seq),
  getInstalledMogrtPath: async () => "/mock/mogrts",
};

// ---------- module factory ----------
/**
 * Create a mock `premierepro` module.
 * @param {object} opts
 *  media: [{path,name,duration(sec),hasVideo,hasAudio,fps,width,height,scenes?,transcript?}]
 *  timeline: [{path, track, start(sec), in(sec), out(sec)}]  initial active sequence
 */
export function createMockPpro(opts = {}) {
  const world = new World(opts);
  world.emit = (name, arg) => world.listeners.filter((l) => l.name === name).forEach((l) => l.fn(arg));
  const project = new ProjectImpl(world, opts.projectName || "Demo Project", "/mock/Demo Project.prproj");
  for (const m of opts.media || []) {
    const desc = { hasVideo: true, hasAudio: true, fps: 25, width: 1920, height: 1080, ...m, duration: Math.round((m.duration || 10) * TPS) };
    world.files.set(m.path, desc);
  }
  const rawBin = new FolderItem(world, project, "Footage");
  rawBin.parent = project.root;
  project.root.children.push(rawBin);
  const clips = new Map();
  for (const [p, desc] of world.files) {
    if (desc.isMogrt) continue;
    const c = new ClipProjectItem(world, project, desc);
    c.parent = rawBin;
    rawBin.children.push(c);
    clips.set(p, c);
  }
  if (opts.timeline) {
    const seq = new SequenceImpl(world, project, opts.sequenceName || "Rough Assembly", opts.defaultSequence || { fps: 25, width: 1920, height: 1080 });
    project._addSeq(seq);
    project.active = seq;
    for (const e of opts.timeline) {
      const c = clips.get(e.path);
      c.inMark = Math.round((e.in ?? 0) * TPS);
      c.outMark = Math.round((e.out ?? desc(world, e.path).duration / TPS) * TPS);
      const kinds = e.only;
      const created = placeClip(world, seq, c, Math.round(e.start * TPS), e.track ?? 0, e.audioTrack ?? e.track ?? 0, false);
      if (kinds) for (const it of created) if (it.kind !== kinds) it.track.items = it.track.items.filter((x) => x !== it);
      c.inMark = c.outMark = null;
    }
    for (const i of opts.lockedAudioTracks || []) seq.audio[i].locked = true;
    for (const i of opts.lockedVideoTracks || []) seq.video[i].locked = true;
  }
  const ppro = {
    TickTime, FrameRate, Guid, PointF, Color, RectF, AddTransitionOptions, Constants,
    ClipProjectItem, FolderItem, ProjectItem, VideoClipTrackItem, AudioClipTrackItem, TrackItemSelection,
    Markers, Marker, SequenceEditor,
    Keyframe: { INTERPOLATION_MODE_LINEAR: 2, INTERPOLATION_MODE_BEZIER: 0, INTERPOLATION_MODE_HOLD: 1 },
    Application: { version: Promise.resolve(opts.version || "26.5.0") },
    Project: {
      getActiveProject: async () => project,
      createProject: async () => project,
      open: async () => project,
      getProject: () => project,
      isProject: () => true,
    },
    ProjectUtils: {
      getSelection: async () => ({ getItems: async () => [...project.panelSelection] }),
      getProjectViewIds: async () => [new Guid("view1")],
      getSelectionFromViewId: async () => ({ getItems: async () => [...project.panelSelection] }),
    },
    VideoFilterFactory: {
      getMatchNames: async () => Object.keys(VIDEO_EFFECTS),
      getDisplayNames: async () => Object.values(VIDEO_EFFECTS).map((v) => v[0]),
      createComponent: async (mn) => {
        const e = VIDEO_EFFECTS[mn];
        if (!e) throw new Error(`Unknown effect ${mn}`);
        return new ComponentImpl(world, mn, e[0], e[1]);
      },
    },
    AudioFilterFactory: {
      getDisplayNames: async () => Object.keys(AUDIO_EFFECTS),
      createComponentByDisplayName: async (n) => {
        const e = AUDIO_EFFECTS[n];
        if (!e) throw new Error(`Unknown audio effect ${n}`);
        return new ComponentImpl(world, `AE.ADBE ${n}`, n, e);
      },
    },
    TransitionFactory: {
      getVideoTransitionMatchNames: async () => ["AE.ADBE Cross Dissolve New", "AE.ADBE Dip To Black", "AE.ADBE Dip To White", "AE.ADBE Film Dissolve", "AE.ADBE Additive Dissolve", "AE.ADBE Push", "AE.ADBE Whip"],
      createVideoTransition: (mn) => ({ matchName: mn }),
    },
    Exporter: {
      exportSequenceFrame: async (seq, time, filename, dir) => {
        world.writeFile(`${dir.replace(/[\\/]$/, "")}/${filename}`, tinyJpeg());
        (world.exportedFrames ||= []).push({ seq: seq.name, t: tt(time), filename });
        return true;
      },
    },
    EncoderManager: {
      getManager: () => ({
        isAMEInstalled: true,
        exportSequence: async (seq, type, out) => ((world.exports ||= []).push({ seq: seq.name, type, out }), true),
        encodeFile: async () => true,
        launchEncoder: async () => true,
        startBatchEncode: async () => true,
      }),
      getExportFileExtension: async () => "mp4",
      EXPORT_IMMEDIATELY: "IMMEDIATELY", EXPORT_QUEUE_TO_AME: "QUEUE_TO_AME", EXPORT_QUEUE_TO_APP: "QUEUE_TO_APP",
    },
    ProjectConverter: {
      exportAsFinalCutProXML: async (seq, p) => (world.writeFile(p, Buffer.from(`<xmeml><sequence>${seq.name}</sequence></xmeml>`)), true),
      exportAsOpenTimelineIO: async (seq, p) => (world.writeFile(p, Buffer.from(JSON.stringify({ name: seq.name }))), true),
    },
    Transcript: {
      hasTranscript: (c) => !!c.transcript,
      exportToJSON: async (c) => (c.transcript ? JSON.stringify(c.transcript) : ""),
      transcribeClipProjectItem: async (c) => { if (!c.media?.transcriptSource) return false; c.transcript = c.media.transcriptSource; return true; },
      querySupportedLanguages: () => [{ displayString: "English", languageCode: "en-us", locale: "en_US" }],
      isLanguagePackAvailable: (l) => l === "en-us",
      importFromJSON: (j) => JSON.parse(j),
      createImportTextSegmentsAction: (segs, c) => world.action("import transcript", () => (c.transcript = segs)),
    },
    SequenceUtils: {
      performSceneEditDetectionOnSelection: async (op, sel) => {
        for (const it of sel.items) {
          const scenes = it.projectItem.media?.scenes || [];
          for (const s of scenes) {
            const st = Math.round(s * TPS);
            if (st > it.inPoint && st < it.outPoint) it.track.seq.markersImpl.list.push(new MarkerImpl(world, "Scene", "Comment", it.start + st - it.inPoint, 0, "scene edit"));
          }
        }
        return true;
      },
      SEQUENCE_OPERATION_APPLYCUT: "ApplyCuts", SEQUENCE_OPERATION_CREATEMARKER: "CreateMarkers", SEQUENCE_OPERATION_CREATESUBCLIP: "CreateSubclips",
    },
    WorkAreaUtils: {
      getWorkAreaInPoint: (s) => new TickTime(s._wa?.[0] ?? 0),
      getWorkAreaOutPoint: (s) => new TickTime(s._wa?.[1] ?? s._endTicks()),
      setWorkAreaInOutPoints: (s, a, b) => ((s._wa = [tt(a), tt(b)]), true),
      setWorkAreaInPoint: () => true,
      setWorkAreaOutPoint: () => true,
    },
    SourceMonitor: { openProjectItem: async () => true, closeAllClips: async () => true, play: async () => true, getPosition: async () => TickTime.TIME_ZERO, setPosition: async () => true },
    EventManager: {
      addEventListener: (target, name, fn) => world.listeners.push({ name: String(name), fn, target }),
      removeEventListener: () => {},
      addGlobalEventListener: (name, fn) => world.listeners.push({ name: String(name), fn }),
      removeGlobalEventListener: () => {},
    },
    Sequence: {},
  };
  return { ppro, world, project, clips };
}

function desc(world, p) {
  return world.files.get(p);
}

function tinyJpeg() {
  // 1x1 white JPEG
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64"
  );
}
