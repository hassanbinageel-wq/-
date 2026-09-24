// Small shared helpers: hashing, ids, events, text normalization.

/** Deterministic JSON (sorted keys) so hashes are stable. */
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v)
    .filter((k) => v[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`)
    .join(",")}}`;
}

/** 53-bit string hash (cyrb53) rendered as hex. Not cryptographic. */
export function hash(str) {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export const hashObject = (o) => hash(stableStringify(o));

let counter = 0;
export function uid(prefix = "id") {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export class Emitter {
  constructor() {
    this.handlers = {};
  }
  on(evt, fn) {
    (this.handlers[evt] ||= []).push(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) {
    this.handlers[evt] = (this.handlers[evt] || []).filter((f) => f !== fn);
  }
  emit(evt, ...args) {
    for (const fn of this.handlers[evt] || []) {
      try {
        fn(...args);
      } catch (e) {
        console.error(`handler for ${evt} failed`, e);
      }
    }
  }
}

/** Normalize Arabic/English text for search: strip diacritics/tatweel, unify letter forms, lowercase. */
export function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "the a an of and or to in on at for with is are was be this that it its from by as ال في من على الى إلى عن و او أو هذا هذه ذلك التي الذي مع هو هي لقطات لقطة shot shots clip clips".split(" ")
);

export function tokenize(s) {
  return normalizeText(s)
    .split(" ")
    .map((t) => (t.length > 3 && t.startsWith("ال") ? t.slice(2) : t))
    .filter((t) => t && !STOP.has(t));
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener?.("abort", () => {
        clearTimeout(t);
        reject(abortError());
      });
    }
  });
}

export function abortError(msg = "Aborted") {
  const e = new Error(msg);
  e.name = "AbortError";
  return e;
}

/** Redact anything that looks like an API key before logging. */
export function redactSecrets(s) {
  return String(s).replace(/sk-ant-[A-Za-z0-9_\-]{6,}/g, "sk-ant-***REDACTED***").replace(/("x-api-key"\s*:\s*")[^"]+/gi, "$1***");
}

export function truncate(s, n) {
  s = String(s ?? "");
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
