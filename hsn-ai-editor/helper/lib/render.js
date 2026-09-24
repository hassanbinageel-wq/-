// Derived renders. The source file is only read; output is a new file.
import fs from "node:fs";
import { mustRun, run } from "./ffmpeg.js";
import { probe } from "./analysis.js";

function atempoChain(speed) {
  // atempo supports 0.5..2.0 per stage (newer ffmpeg up to 100; chain for safety)
  const parts = [];
  let s = speed;
  while (s > 2) {
    parts.push("atempo=2.0");
    s /= 2;
  }
  while (s < 0.5) {
    parts.push("atempo=0.5");
    s /= 0.5;
  }
  parts.push(`atempo=${s.toFixed(5)}`);
  return parts.join(",");
}

let proresOk = null;
async function videoCodecArgs(tools) {
  if (proresOk == null) {
    const r = await run(tools.ffmpeg, ["-hide_banner", "-encoders"]);
    proresOk = /prores_ks/.test(r.stdout.toString() + r.stderr);
  }
  return proresOk ? ["-c:v", "prores_ks", "-profile:v", "2", "-pix_fmt", "yuv422p10le"] : ["-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p"];
}
const AUDIO = ["-c:a", "pcm_s16le"];

export async function render(tools, req) {
  const { kind, path, output } = req;
  if (!output || fs.existsSync(output)) throw new Error("output must be a new file path");
  const info = await probe(tools, path);
  const a = Math.max(0, req.src_in);
  const b = Math.min(info.duration, req.src_out);
  if (!(b > a)) throw new Error("empty source range");
  const vc = await videoCodecArgs(tools);
  const keepAudio = req.keep_audio !== false && info.hasAudio;
  const inArgs = ["-hide_banner", "-loglevel", "error", "-ss", String(a), "-t", String(b - a), "-i", path];
  let args;
  switch (kind) {
    case "speed": {
      const sp = req.speed || 1;
      const fc = `[0:v]setpts=PTS/${sp}[v]${keepAudio ? `;[0:a]${atempoChain(sp)}[a]` : ""}`;
      args = [...inArgs, "-filter_complex", fc, "-map", "[v]", ...(keepAudio ? ["-map", "[a]", ...AUDIO] : ["-an"]), ...vc, output];
      break;
    }
    case "reverse": {
      if (b - a > 60) throw new Error("reverse is limited to 60 s ranges (memory)");
      args = [...inArgs, "-vf", "reverse", ...(keepAudio ? ["-af", "areverse", ...AUDIO] : ["-an"]), ...vc, output];
      break;
    }
    case "ramp": {
      const segs = (req.ramp || []).map((s) => ({ from: Math.max(a, s.from_s), to: Math.min(b, s.to_s), speed: s.speed })).filter((s) => s.to > s.from);
      if (!segs.length) throw new Error("ramp needs segments inside the range");
      const parts = [];
      const labels = [];
      segs.forEach((s, i) => {
        parts.push(`[0:v]trim=start=${(s.from - a).toFixed(3)}:end=${(s.to - a).toFixed(3)},setpts=(PTS-STARTPTS)/${s.speed}[v${i}]`);
        if (keepAudio) parts.push(`[0:a]atrim=start=${(s.from - a).toFixed(3)}:end=${(s.to - a).toFixed(3)},asetpts=PTS-STARTPTS,${atempoChain(s.speed)}[a${i}]`);
        labels.push(`[v${i}]${keepAudio ? `[a${i}]` : ""}`);
      });
      parts.push(`${labels.join("")}concat=n=${segs.length}:v=1:a=${keepAudio ? 1 : 0}[v]${keepAudio ? "[a]" : ""}`);
      args = [...inArgs, "-filter_complex", parts.join(";"), "-map", "[v]", ...(keepAudio ? ["-map", "[a]", ...AUDIO] : ["-an"]), ...vc, output];
      break;
    }
    case "lut": {
      if (!req.lut_path || !fs.existsSync(req.lut_path)) throw new Error("lut_path must be an existing .cube file");
      const esc = req.lut_path.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
      args = [...inArgs, "-vf", `lut3d=file='${esc}'`, ...(keepAudio ? AUDIO : ["-an"]), ...vc, output];
      break;
    }
    case "reframe": {
      const [aw, ah] = String(req.aspect || "9:16").split(":").map(Number);
      const W = info.width;
      const H = info.height;
      let cw = W;
      let ch = Math.round((W * ah) / aw);
      if (ch > H) {
        ch = H;
        cw = Math.round((H * aw) / ah);
      }
      cw -= cw % 2;
      ch -= ch % 2;
      const cx = Math.round((req.center_x ?? 0.5) * W - cw / 2);
      const cy = Math.round((req.center_y ?? 0.5) * H - ch / 2);
      const x = Math.max(0, Math.min(W - cw, cx));
      const y = Math.max(0, Math.min(H - ch, cy));
      args = [...inArgs, "-vf", `crop=${cw}:${ch}:${x}:${y}`, ...(keepAudio ? AUDIO : ["-an"]), ...vc, output];
      break;
    }
    case "freeze": {
      const dur = req.freeze_s || 2;
      args = ["-hide_banner", "-loglevel", "error", "-ss", String(a), "-i", path, "-vf", "loop=loop=-1:size=1:start=0", "-t", String(dur), "-an", ...vc, output];
      break;
    }
    default:
      throw new Error(`unknown render kind ${kind}`);
  }
  await mustRun(tools.ffmpeg, args, { timeoutMs: 60 * 60 * 1000 });
  const out = await probe(tools, output);
  return { output, duration: out.duration, width: out.width, height: out.height };
}
