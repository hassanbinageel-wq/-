// Local helper tests on REAL generated media with a real ffmpeg binary.
// Skipped automatically when no ffmpeg is available.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findBinary } from "../helper/lib/ffmpeg.js";
import * as A from "../helper/lib/analysis.js";
import { render } from "../helper/lib/render.js";
import { analyzeReference } from "../helper/lib/reference.js";
import { createServer, startBridge } from "../helper/server.js";
import { HelperClient } from "../src/helper-client/helper-client.js";
import { createNodeFs } from "../src/storage/fsio-node.js";

let ffmpeg = findBinary("ffmpeg", process.env.HSN_FFMPEG);
if (!ffmpeg) {
  try {
    ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
  } catch { /* none */ }
}
const skip = !ffmpeg && "ffmpeg not available";
const tools = { ffmpeg, ffprobe: findBinary("ffprobe") };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsn-helper-"));
const clip = path.join(dir, "rgb_tone.mp4");
const click = path.join(dir, "click120.wav");

test.before(() => {
  if (skip) return;
  const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  run([
    "-f", "lavfi", "-i", "color=red:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "color=white:s=320x180:d=2:r=25", "-f", "lavfi", "-i", "color=navy:s=320x180:d=2:r=25",
    "-f", "lavfi", "-i", "aevalsrc=0.5*sin(2*PI*440*t)*lt(mod(t\\,2)\\,1):s=48000:d=6",
    "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-map", "3:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", clip,
  ]);
  run(["-f", "lavfi", "-i", "aevalsrc=0.8*sin(2*PI*1000*t)*lt(mod(t\\,0.5)\\,0.03):s=22050:d=10", click]);
});

test("probe (works without ffprobe)", { skip }, async () => {
  const p = await A.probe(tools, clip);
  assert.ok(Math.abs(p.duration - 6) < 0.15, `duration ${p.duration}`);
  assert.equal(p.width, 320);
  assert.ok(p.hasVideo && p.hasAudio);
});

test("scene cuts, silences, loudness are measured", { skip }, async () => {
  const sc = await A.scenes(tools, clip);
  assert.ok(sc.some((t) => Math.abs(t - 2) < 0.1) && sc.some((t) => Math.abs(t - 4) < 0.1), `scenes ${sc}`);
  const si = await A.silences(tools, clip, { noiseDb: -40, minDur: 0.5 });
  assert.ok(si.some((s) => Math.abs(s.start - 1) < 0.1 && Math.abs(s.end - 2) < 0.1), JSON.stringify(si));
  const l = await A.loudness(tools, clip);
  assert.ok(typeof l.integrated_lufs === "number");
});

test("beats/onsets and tempo on a 120 bpm click", { skip }, async () => {
  const s = await A.pcm(tools, click, 11025);
  const r = A.onsets(s, 11025);
  assert.ok(r.beats.length >= 18 && r.beats.length <= 21, `beats ${r.beats.length}`);
  assert.ok(Math.abs(r.beats[1] - r.beats[0] - 0.5) < 0.03);
  assert.equal(r.tempo_bpm, 120);
});

test("frames come back as JPEG", { skip }, async () => {
  const f = await A.frames(tools, clip, [0.5, 2.5, 4.5], { width: 160 });
  assert.equal(f.length, 3);
  assert.equal(Buffer.from(f[0].jpegBase64, "base64").subarray(0, 2).toString("hex"), "ffd8");
  const c = await A.colorStats(tools, clip, 0.5);
  assert.ok(c.sat > 0.8, "red frame is saturated");
});

test("renders: speed, reverse, ramp, lut, reframe, freeze — originals untouched", { skip }, async () => {
  const before = fs.statSync(clip).mtimeMs;
  const out = (n) => path.join(dir, `${n}.mov`);
  const sp = await render(tools, { kind: "speed", path: clip, output: out("slow"), src_in: 0, src_out: 2, speed: 0.5 });
  assert.ok(Math.abs(sp.duration - 4) < 0.2, `slow ${sp.duration}`);
  const rv = await render(tools, { kind: "reverse", path: clip, output: out("rev"), src_in: 0, src_out: 3 });
  assert.ok(Math.abs(rv.duration - 3) < 0.2);
  const rp = await render(tools, { kind: "ramp", path: clip, output: out("ramp"), src_in: 0, src_out: 4, ramp: [{ from_s: 0, to_s: 2, speed: 1 }, { from_s: 2, to_s: 4, speed: 2 }] });
  assert.ok(Math.abs(rp.duration - 3) < 0.25, `ramp ${rp.duration}`);
  const cube = path.join(dir, "id.cube");
  fs.writeFileSync(cube, `LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n`);
  await render(tools, { kind: "lut", path: clip, output: out("lut"), src_in: 0, src_out: 1, lut_path: cube });
  const rf = await render(tools, { kind: "reframe", path: clip, output: out("vert"), src_in: 0, src_out: 1, aspect: "9:16", center_x: 0.8 });
  assert.equal(rf.height, 180);
  assert.equal(rf.width, 100);
  const fz = await render(tools, { kind: "freeze", path: clip, output: out("freeze"), src_in: 2.5, src_out: 3, freeze_s: 2 });
  assert.ok(Math.abs(fz.duration - 2) < 0.2, `freeze ${fz.duration}`);
  await assert.rejects(render(tools, { kind: "speed", path: clip, output: out("slow"), src_in: 0, src_out: 1, speed: 2 }), /output must be a new file/);
  assert.equal(fs.statSync(clip).mtimeMs, before);
});

test("reference analysis: cuts, shot stats, frames, colour", { skip }, async () => {
  const r = await analyzeReference(tools, {}, { path: clip, maxFrames: 3 });
  assert.equal(r.stats.shots, 3);
  assert.ok(Math.abs(r.stats.avg_shot - 2) < 0.1);
  assert.equal(r.frames.length, 3);
  assert.equal(r.color.length, 4);
  await assert.rejects(analyzeReference(tools, {}, { url: "http://127.0.0.1:1/x.mp4" }), /local\/private/);
});

test("HTTP server: host check, token auth, input validation; client + file bridge", { skip }, async () => {
  const cfg = { token: "t0ken-for-tests", port: 0, bridgeDir: path.join(dir, "bridge") };
  const server = createServer(cfg, tools);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}`;
  const fsio = await createNodeFs(dir);
  try {
  let r = await fetch(`${url}/health`);
  assert.equal(r.status, 401);
  // fetch() cannot override Host; use a raw request to simulate DNS rebinding
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: "/health", headers: { "x-hsn-token": "t0ken-for-tests", host: "evil.example" } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 403);
  const c = new HelperClient({ url, token: "t0ken-for-tests", fsio });
  assert.equal((await c.health()).state, "connected");
  const p = await c.call("probe", { path: clip });
  assert.equal(p.width, 320);
  await assert.rejects(c.call("probe", { path: "relative.mp4" }), /absolute/);
  await assert.rejects(c.call("render", { kind: "speed", path: clip, output: "/tmp/../etc/passwd", src_in: 0, src_out: 1 }), /output/);
  } finally {
    server.close();
  }
  // bridge transport
  const stop = startBridge(cfg, tools, { intervalMs: 50 });
  try {
  const b = new HelperClient({ url: "", token: "t0ken-for-tests", bridgeDir: cfg.bridgeDir, fsio });
  assert.equal((await b.health()).transport, "bridge");
  const p2 = await b.call("probe", { path: clip });
  assert.equal(p2.height, 180);
  const bad = new HelperClient({ url: "", token: "wrong", bridgeDir: cfg.bridgeDir, fsio });
  bad.status = { state: "connected", transport: "bridge" };
  await assert.rejects(bad.call("probe", { path: clip }), /unauthorized/);
  } finally {
    stop();
  }
});
