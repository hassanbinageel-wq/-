// Persistent state: global settings, API key (secure storage), and
// per-project memory (conversation log, constraints/pins, versions, restore
// points, plans, change log, execution journal, footage index).

import { joinPath } from "./fsio.js";
import { decodeUtf8 } from "../core/utf8.js";
import { uid, redactSecrets } from "../core/util.js";
import { DEFAULT_MODEL } from "../claude/models.js";

export const DEFAULT_SETTINGS = {
  language: "ar", // ui language: ar | en
  connectionMode: "desktop", // desktop (Claude app via MCP, subscription) | api (API key)
  model: DEFAULT_MODEL,
  effort: "high",
  showThinking: true,
  executionMode: "preview", // preview | direct
  analysisScope: "timeline", // timeline | selection | inout | bin | project
  analyzeFullSource: false,
  framesPerClip: 6,
  frameWidth: 512,
  maxFramesPerRequest: 24,
  backupBeforeEdits: true,
  helperUrl: "http://127.0.0.1:47631",
  helperToken: "",
  helperBridgeDir: "",
  quickCommands: [
    { ar: "حلّل الخامات واقترح أسلوب", en: "Analyze footage and suggest a style" },
    { ar: "مونتاج وثائقي من الخامات", en: "Documentary cut from the footage" },
    { ar: "إعلان سينمائي 30 ثانية", en: "30s cinematic ad" },
    { ar: "البداية بطيئة خلها أقوى", en: "The opening is slow — make it stronger" },
    { ar: "قلل الانتقالات", en: "Fewer transitions" },
    { ar: "نسخة ريلز رأسية", en: "Vertical reels version" },
  ],
  brand: { logoPath: "", fonts: "", titleMogrt: "", lowerThirdMogrt: "", sfxFolder: "", musicFolder: "", lutFolder: "", verticalPreset: "", squarePreset: "" },
  favoriteStyles: [],
  protectedVideoTracks: [],
  protectedAudioTracks: [],
  keyframeTimeBase: "media",
  volumeUnits: "auto",
  consent: { frames: false, transcripts: false, audioFeatures: false, reference: false, attachments: false },
};

const KEY_NAME = "hsn.anthropic.apiKey";

export class SecretStore {
  constructor(backend) {
    this.backend = backend; // uxp secureStorage or {getItem,setItem,removeItem}
  }
  static uxp() {
    // eslint-disable-next-line no-undef
    return new SecretStore(require("uxp").storage.secureStorage);
  }
  static memory() {
    const m = new Map();
    return new SecretStore({ getItem: async (k) => m.get(k), setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) });
  }
  async getApiKey() {
    try {
      const v = await this.backend.getItem(KEY_NAME);
      if (v == null) return "";
      return typeof v === "string" ? v : decodeUtf8(v instanceof Uint8Array ? v : new Uint8Array(v));
    } catch {
      return "";
    }
  }
  async setApiKey(key) {
    const k = String(key || "").trim();
    if (!k) return this.clearApiKey();
    await this.backend.setItem(KEY_NAME, k);
  }
  async clearApiKey() {
    try {
      await this.backend.removeItem(KEY_NAME);
    } catch { /* not present */ }
  }
  async hasApiKey() {
    return !!(await this.getApiKey());
  }
}

export function maskKey(k) {
  if (!k) return "";
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

class JsonFile {
  constructor(fsio, path, defaults) {
    this.fsio = fsio;
    this.path = path;
    this.defaults = defaults;
    this.data = null;
    this.writing = Promise.resolve();
  }
  async load() {
    try {
      this.data = { ...structuredCopy(this.defaults), ...JSON.parse(await this.fsio.readText(this.path)) };
    } catch {
      this.data = structuredCopy(this.defaults);
    }
    return this.data;
  }
  save() {
    const text = JSON.stringify(this.data, null, 1);
    if (/sk-ant-[A-Za-z0-9_-]{10,}/.test(text)) throw new Error("Refusing to write an API key into a plain file");
    this.writing = this.writing.then(() => this.fsio.writeText(this.path, text)).catch((e) => console.error("save failed", e));
    return this.writing;
  }
}

function structuredCopy(o) {
  return JSON.parse(JSON.stringify(o));
}

export class SettingsStore extends JsonFile {
  static async open(fsio) {
    const dir = await fsio.dataDir();
    await fsio.mkdir(dir);
    const s = new SettingsStore(fsio, joinPath(fsio, dir, "settings.json"), DEFAULT_SETTINGS);
    await s.load();
    s.data.brand = { ...DEFAULT_SETTINGS.brand, ...(s.data.brand || {}) };
    s.data.consent = { ...DEFAULT_SETTINGS.consent, ...(s.data.consent || {}) };
    return s;
  }
  get(k) {
    return this.data[k];
  }
  async set(patch) {
    Object.assign(this.data, patch);
    await this.save();
  }
}

const PROJECT_DEFAULTS = {
  version: 1,
  chat: [], // display log: {id, role, text, ts, kind}
  constraints: [], // {id, kind, label, ...}
  pins: [], // {id, label, versionId, eventId, source, srcIn, srcOut, start, keepPosition}
  versions: [], // {id, name, seqId, planId, parent, style, createdAt, duration_s, status}
  restorePoints: [], // {id, seqId, name, fromSeqId, createdAt, reason}
  plans: {}, // id -> {plan, summary, hash, createdAt, status}
  changeLog: [], // {ts, text, ok}
  journal: {}, // planHash -> executor record
  styles: [], // custom StyleSpecs saved in this project
  references: [], // style profiles derived from references
  summary: "", // rolling memory of decisions for new chats
};

export class ProjectMemory extends JsonFile {
  static async open(fsio, projectKey) {
    const dir = joinPath(fsio, await fsio.dataDir(), "projects", safeName(projectKey));
    await fsio.mkdir(dir);
    const m = new ProjectMemory(fsio, joinPath(fsio, dir, "memory.json"), PROJECT_DEFAULTS);
    m.dir = dir;
    await m.load();
    return m;
  }

  addChat(role, text, extra = {}) {
    const e = { id: uid("m"), role, text: redactSecrets(text), ts: Date.now(), ...extra };
    this.data.chat.push(e);
    if (this.data.chat.length > 400) this.data.chat.splice(0, this.data.chat.length - 400);
    this.save();
    return e;
  }

  log(text, ok = true) {
    this.data.changeLog.push({ ts: Date.now(), text, ok });
    if (this.data.changeLog.length > 500) this.data.changeLog.shift();
    this.save();
  }

  addConstraint(c) {
    const e = { id: uid("c"), createdAt: Date.now(), ...c };
    this.data.constraints.push(e);
    this.save();
    return e;
  }
  removeConstraint(id) {
    const n = this.data.constraints.length + this.data.pins.length;
    this.data.constraints = this.data.constraints.filter((c) => c.id !== id);
    this.data.pins = this.data.pins.filter((c) => c.id !== id);
    this.save();
    return n !== this.data.constraints.length + this.data.pins.length;
  }
  addPin(p) {
    const e = { id: uid("pin"), createdAt: Date.now(), ...p };
    this.data.pins.push(e);
    this.save();
    return e;
  }

  addVersion(v) {
    const e = { id: uid("v"), createdAt: Date.now(), ...v };
    this.data.versions.push(e);
    this.save();
    return e;
  }
  addRestorePoint(r) {
    const e = { id: uid("rp"), createdAt: Date.now(), ...r };
    this.data.restorePoints.push(e);
    this.save();
    return e;
  }
  putPlan(id, rec) {
    this.data.plans[id] = rec;
    const ids = Object.keys(this.data.plans);
    if (ids.length > 60) delete this.data.plans[ids[0]];
    this.save();
  }
  journalStore() {
    return {
      get: async (k) => this.data.journal[k],
      put: async (k, v) => {
        this.data.journal[k] = JSON.parse(JSON.stringify(v));
        await this.save();
      },
    };
  }
}

export function safeName(s) {
  return String(s || "untitled").replace(/[^\w؀-ۿ.-]+/g, "_").slice(0, 80);
}
