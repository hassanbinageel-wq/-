#!/usr/bin/env node
// HSN AI Editor — local helper.
// Heavy media work the Premiere UXP API cannot do (frame extraction from
// source files, audio measurement, beat detection, local Whisper, speed /
// reverse / LUT / reframe renders, reference analysis).
//
// Security model:
//  * listens on 127.0.0.1 only; Host header must be localhost/127.0.0.1
//    (DNS-rebinding guard); no CORS headers are sent, so web pages cannot
//    read responses or send the custom auth header;
//  * every request needs the per-install token (x-hsn-token), compared in
//    constant time; the token is created on first run and stored with
//    user-only permissions in ~/.hsn-ai-editor/helper.json;
//  * ffmpeg is spawned with argument arrays (no shell);
//  * input paths must be existing absolute files; outputs must be new files;
//  * it never sees or needs the Anthropic API key.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { findBinary } from "./lib/ffmpeg.js";
import * as A from "./lib/analysis.js";
import { render } from "./lib/render.js";
import { analyzeReference } from "./lib/reference.js";
import { transcribe, whisperAvailable } from "./lib/whisper.js";
import { Relay } from "./lib/relay.js";

export const VERSION = "0.1.0";
export const CONFIG_DIR = process.env.HSN_HELPER_HOME || path.join(os.homedir(), ".hsn-ai-editor");
export const CONFIG_PATH = path.join(CONFIG_DIR, "helper.json");

export function loadConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch { /* first run */ }
  if (!cfg.token) cfg.token = crypto.randomBytes(24).toString("base64url");
  cfg.port ||= 47631;
  cfg.allowYtDlp ??= false;
  cfg.bridgeDir ??= path.join(CONFIG_DIR, "bridge");
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  return cfg;
}

export function detectTools(cfg) {
  return {
    ffmpeg: findBinary("ffmpeg", cfg.ffmpeg),
    ffprobe: findBinary("ffprobe", cfg.ffprobe),
    ytdlp: findBinary("yt-dlp", cfg.ytdlp),
  };
}

function checkInput(p) {
  if (typeof p !== "string" || !path.isAbsolute(p)) throw new Error("path must be an absolute file path");
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) throw new Error(`file not found: ${p}`);
  return p;
}

function checkOutput(p) {
  if (typeof p !== "string" || !path.isAbsolute(p)) throw new Error("output must be an absolute path");
  if (fs.existsSync(p)) throw new Error("output already exists (refusing to overwrite)");
  if (!/\.(mov|mp4|mxf)$/i.test(p)) throw new Error("output must be .mov/.mp4/.mxf");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  return p;
}

export function makeHandlers(cfg, tools) {
  const need = () => {
    if (!tools.ffmpeg) throw new Error("ffmpeg was not found. Install ffmpeg or set \"ffmpeg\" in ~/.hsn-ai-editor/helper.json");
  };
  return {
    health: async () => ({ ok: true, version: VERSION, tools: { ffmpeg: !!tools.ffmpeg, ffprobe: !!tools.ffprobe, whisper: whisperAvailable(cfg), ytdlp: !!tools.ytdlp && !!cfg.allowYtDlp } }),
    probe: async (b) => (need(), A.probe(tools, checkInput(b.path))),
    frames: async (b) => {
      need();
      const times = (b.times || []).slice(0, 40).map(Number).filter((t) => t >= 0);
      return { frames: await A.frames(tools, checkInput(b.path), times, { width: Math.min(1280, Math.max(160, b.width || 512)) }) };
    },
    scenes: async (b) => (need(), { scenes: await A.scenes(tools, checkInput(b.path), { threshold: b.threshold ?? 0.3 }) }),
    audio: async (b) => (need(), A.audio(tools, checkInput(b.path), b)),
    transcribe: async (b) => (need(), transcribe(tools, cfg, { path: checkInput(b.path), language: b.language || "auto" })),
    render: async (b) => (need(), render(tools, { ...b, path: checkInput(b.path), output: checkOutput(b.output) })),
    reference: async (b) => {
      need();
      if (b.path) checkInput(b.path);
      return analyzeReference(tools, cfg, { path: b.path, url: b.url, maxFrames: Math.min(30, b.maxFrames ?? 12) });
    },
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createServer(cfg, tools, relay = new Relay({ cacheFile: path.join(CONFIG_DIR, "panel-tools.json") })) {
  const handlers = makeHandlers(cfg, tools);
  // Relay endpoints (Claude Desktop / MCP mode). Long-polls are exempt from the busy limit.
  const relayHandlers = {
    "relay/register": async (b) => relay.register(b),
    "relay/poll": async () => ({ call: await relay.poll(25000) }),
    "relay/result": async (b) => relay.result(b.id, b.result),
    "relay/tools": async () => ({ tools: relay.tools, instructions: relay.instructions, panelConnected: relay.panelConnected }),
    "relay/call": async (b) => relay.call(b.name, b.arguments || {}, Math.min(b.waitMs ?? 50000, 55000)),
    "relay/wait": async (b) => relay.wait(b.jobId, Math.min(b.waitMs ?? 45000, 55000)),
    "relay/status": async () => relay.status(),
  };
  let active = 0;
  return http.createServer((req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify(obj));
    };
    const host = String(req.headers.host || "").replace(/:\d+$/, "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) return send(403, { error: "bad host" });
    if (req.method === "OPTIONS") return send(403, { error: "no CORS" });
    if (!safeEqual(req.headers["x-hsn-token"] || "", cfg.token)) return send(401, { error: "unauthorized: set the helper token in the panel settings" });
    const name = req.url.replace(/^\//, "").split("?")[0];
    const isRelay = name in relayHandlers;
    const h = relayHandlers[name] || handlers[name];
    if (!h) return send(404, { error: `unknown endpoint ${name}` });
    let body = "";
    const limit = isRelay ? 60e6 : 2e6;
    req.on("data", (d) => {
      body += d;
      if (body.length > limit) req.destroy();
    });
    req.on("end", async () => {
      if (isRelay) {
        try {
          return send(200, await h(body ? JSON.parse(body) : {}));
        } catch (e) {
          return send(400, { error: e.message });
        }
      }
      if (active >= 3 && name !== "health") return send(429, { error: "helper busy, retry shortly" });
      active++;
      try {
        const input = body ? JSON.parse(body) : {};
        send(200, await h(input));
      } catch (e) {
        send(400, { error: e.message });
      } finally {
        active--;
      }
    });
  });
}

/** File bridge: requests/<id>.json -> responses/<id>.json */
export function startBridge(cfg, tools, { intervalMs = 300, log = console.log } = {}) {
  const handlers = makeHandlers(cfg, tools);
  const reqDir = path.join(cfg.bridgeDir, "requests");
  const resDir = path.join(cfg.bridgeDir, "responses");
  fs.mkdirSync(reqDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });
  const busy = new Set();
  const timer = setInterval(() => {
    for (const f of fs.readdirSync(reqDir)) {
      if (!f.endsWith(".json") || busy.has(f)) continue;
      busy.add(f);
      const full = path.join(reqDir, f);
      (async () => {
        let out;
        try {
          const r = JSON.parse(fs.readFileSync(full, "utf8"));
          if (!safeEqual(r.token || "", cfg.token)) throw new Error("unauthorized");
          const h = handlers[r.endpoint];
          if (!h) throw new Error(`unknown endpoint ${r.endpoint}`);
          out = { result: await h(r.body || {}) };
        } catch (e) {
          out = { error: e.message };
        }
        fs.writeFileSync(path.join(resDir, f), JSON.stringify(out));
        fs.rmSync(full, { force: true });
        busy.delete(f);
      })().catch((e) => log("bridge error", e));
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const cfg = loadConfig();
  const tools = detectTools(cfg);
  const server = createServer(cfg, tools);
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") console.log(`Port ${cfg.port} is already in use — the helper is probably already running (e.g. started by Claude Desktop).`);
    else console.error(e);
    process.exit(1);
  });
  server.listen(cfg.port, "127.0.0.1", () => {
    console.log(`HSN AI Editor helper ${VERSION}`);
    console.log(`Listening on http://127.0.0.1:${cfg.port}`);
    console.log(`ffmpeg: ${tools.ffmpeg || "NOT FOUND"} · ffprobe: ${tools.ffprobe || "not found (fallback parser)"} · whisper: ${whisperAvailable(cfg) ? cfg.whisper.kind : "not configured"}`);
    console.log(`\nPaste this token into the panel (Settings → Local helper):\n\n  ${cfg.token}\n`);
    console.log(`File bridge folder (alternative transport): ${cfg.bridgeDir}`);
    console.log(`Config: ${CONFIG_PATH}`);
  });
  startBridge(cfg, tools);
}
