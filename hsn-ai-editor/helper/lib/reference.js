// Reference-video analysis: download (direct media URLs; optional yt-dlp),
// cut detection, shot statistics, audio/beat relation, colour per quarter,
// and representative frames.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { probe, scenes, frames, audio, colorStats } from "./analysis.js";
import { mustRun } from "./ffmpeg.js";

const MAX_BYTES = 2 * 1024 ** 3;

export function download(url, dest, { redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return reject(new Error("only http(s) URLs"));
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname)) return reject(new Error("refusing to download from a local/private address"));
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(u, { headers: { "user-agent": "HSN-AI-Editor-helper/0.1" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (!redirects) return reject(new Error("too many redirects"));
        return download(new URL(res.headers.location, u).toString(), dest, { redirects: redirects - 1 }).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const type = String(res.headers["content-type"] || "");
      if (!/^(video|audio)\//.test(type) && !/octet-stream/.test(type)) {
        res.resume();
        return reject(Object.assign(new Error(`the URL is a web page (${type || "unknown type"}), not a media file`), { code: "not_media" }));
      }
      let n = 0;
      const out = fs.createWriteStream(dest);
      res.on("data", (d) => {
        n += d.length;
        if (n > MAX_BYTES) {
          req.destroy();
          reject(new Error("file too large (>2 GB)"));
        }
      });
      res.pipe(out);
      out.on("finish", () => resolve({ bytes: n, type }));
      out.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("download timed out")));
  });
}

async function fetchReference(tools, cfg, url) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsn-ref-"));
  const dest = path.join(dir, "reference.bin");
  try {
    await download(url, dest);
    return { file: dest, source: url, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
  } catch (e) {
    if (e.code === "not_media" && tools.ytdlp && cfg.allowYtDlp) {
      await mustRun(tools.ytdlp, ["-f", "mp4/best", "--max-filesize", "2G", "-o", path.join(dir, "ref.%(ext)s"), "--no-playlist", url], { timeoutMs: 20 * 60 * 1000 });
      const f = fs.readdirSync(dir).find((x) => x.startsWith("ref."));
      if (!f) throw new Error("yt-dlp produced no file");
      return { file: path.join(dir, f), source: `${url} (via yt-dlp)`, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
    }
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`${e.message}. ${e.code === "not_media" ? "Download the video yourself and attach the file (yt-dlp support is off)." : ""}`);
  }
}

export async function analyzeReference(tools, cfg, { path: p, url, maxFrames = 12 }) {
  const ref = p ? { file: p, source: p, cleanup: () => {} } : await fetchReference(tools, cfg, url);
  try {
    const info = await probe(tools, ref.file);
    if (!info.hasVideo) throw new Error("reference has no video stream");
    const cuts = (await scenes(tools, ref.file, { threshold: 0.3 })).filter((c) => c > 0.05 && c < info.duration - 0.05);
    const bounds = [0, ...cuts, info.duration];
    const shots = [];
    for (let i = 0; i < bounds.length - 1; i++) shots.push({ start: bounds[i], end: bounds[i + 1], len: bounds[i + 1] - bounds[i] });
    const lens = shots.map((s) => s.len).sort((a, b) => a - b);
    const q = [0, 1, 2, 3].map((k) => {
      const a = (info.duration * k) / 4;
      const b = (info.duration * (k + 1)) / 4;
      const inQ = shots.filter((s) => s.start < b && s.end > a);
      return inQ.length ? inQ.reduce((x, s) => x + s.len, 0) / inQ.length : 0;
    });
    const stats = {
      duration: info.duration,
      shots: shots.length,
      avg_shot: info.duration / shots.length,
      median_shot: lens[Math.floor(lens.length / 2)],
      min_shot: lens[0],
      max_shot: lens[lens.length - 1],
      quarters: q,
      width: info.width,
      height: info.height,
      fps: info.fps,
    };
    let aud = null;
    if (info.hasAudio) {
      const a = await audio(tools, ref.file, { silence: true, loudness: true, beats: true, silenceDb: -40, minSilence: 0.3 });
      const silent = (a.silences || []).reduce((x, s) => x + ((s.end ?? info.duration) - s.start), 0);
      const onBeat = cuts.length && a.beats?.length ? cuts.filter((c) => a.beats.some((b) => Math.abs(b - c) < 0.08)).length / cuts.length : null;
      aud = { loudness: a.loudness, silence_ratio: silent / info.duration, beats: a.beats, tempo_bpm: a.tempo_bpm, cuts_on_beats_ratio: onBeat };
    }
    // representative frames: shot midpoints, spread across the piece
    const mids = shots.map((s) => s.start + s.len / 2);
    const pick = mids.length <= maxFrames ? mids : Array.from({ length: maxFrames }, (_, i) => mids[Math.floor((i * mids.length) / maxFrames)]);
    const fr = maxFrames ? await frames(tools, ref.file, pick, { width: 448 }) : [];
    const color = [];
    for (let k = 0; k < 4; k++) {
      const c = await colorStats(tools, ref.file, (info.duration * (k + 0.5)) / 4);
      if (c) color.push(c);
    }
    return { source: ref.source, stats, cuts, audio: aud, color, frames: fr };
  } finally {
    ref.cleanup();
  }
}
