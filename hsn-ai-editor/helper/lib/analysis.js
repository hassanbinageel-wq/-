// Media analysis with ffmpeg. All values are measurements from the file.
import { run, mustRun } from "./ffmpeg.js";

export async function probe(tools, path) {
  if (tools.ffprobe) {
    const r = await mustRun(tools.ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path]);
    const j = JSON.parse(r.stdout.toString());
    const v = j.streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
    const a = j.streams.find((s) => s.codec_type === "audio");
    const rate = v?.avg_frame_rate && v.avg_frame_rate !== "0/0" ? v.avg_frame_rate : v?.r_frame_rate;
    const [n, d] = String(rate || "0/1").split("/").map(Number);
    return {
      duration: Number(j.format?.duration || v?.duration || a?.duration || 0),
      hasVideo: !!v, hasAudio: !!a,
      width: v?.width, height: v?.height,
      fps: d ? +(n / d).toFixed(3) : null,
      videoCodec: v?.codec_name, audioCodec: a?.codec_name,
      sampleRate: a ? Number(a.sample_rate) : null, channels: a?.channels ?? null,
      rotation: Number(v?.tags?.rotate || v?.side_data_list?.find?.((x) => x.rotation != null)?.rotation || 0),
    };
  }
  // ffprobe missing: parse `ffmpeg -i` banner.
  const r = await run(tools.ffmpeg, ["-hide_banner", "-i", path]);
  const e = r.stderr;
  const dur = e.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const vid = e.match(/Stream #\S+.*Video: (\w+)[^\n]*?, (\d{2,5})x(\d{2,5})[^\n]*?(?:, ([\d.]+) fps)?/);
  const fpsM = e.match(/, ([\d.]+) fps/);
  const aud = e.match(/Stream #\S+.*Audio: (\w+)[^\n]*?, (\d+) Hz/);
  if (!dur) throw new Error("Could not read media (unsupported or missing file)");
  return {
    duration: +dur[1] * 3600 + +dur[2] * 60 + +dur[3],
    hasVideo: !!vid, hasAudio: !!aud,
    width: vid ? +vid[2] : null, height: vid ? +vid[3] : null,
    fps: fpsM ? +fpsM[1] : null,
    videoCodec: vid?.[1] || null, audioCodec: aud?.[1] || null,
    sampleRate: aud ? +aud[2] : null,
  };
}

/** Extract JPEG frames at times (seconds). */
export async function frames(tools, path, times, { width = 512, quality = 5 } = {}) {
  const out = [];
  const queue = [...times];
  const worker = async () => {
    while (queue.length) {
      const t = queue.shift();
      const r = await run(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-ss", String(Math.max(0, t)), "-i", path, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", String(quality), "-f", "image2pipe", "-vcodec", "mjpeg", "-"]);
      if (r.code === 0 && r.stdout.length) out.push({ t, jpegBase64: r.stdout.toString("base64") });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, times.length) }, worker));
  return out.sort((a, b) => a.t - b.t);
}

/** Scene-change times using ffmpeg's scene score. */
export async function scenes(tools, path, { threshold = 0.3 } = {}) {
  const r = await run(tools.ffmpeg, ["-hide_banner", "-i", path, "-an", "-vf", `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"], { timeoutMs: 30 * 60 * 1000 });
  const times = [...r.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +(+m[1]).toFixed(3));
  return [...new Set(times)].sort((a, b) => a - b);
}

export async function silences(tools, path, { noiseDb = -35, minDur = 0.4 } = {}) {
  const r = await run(tools.ffmpeg, ["-hide_banner", "-i", path, "-vn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minDur}`, "-f", "null", "-"], { timeoutMs: 30 * 60 * 1000 });
  const out = [];
  let start = null;
  for (const line of r.stderr.split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Math.max(0, +s[1]);
    if (e && start != null) {
      out.push({ start: +start.toFixed(3), end: +(+e[1]).toFixed(3) });
      start = null;
    }
  }
  if (start != null) out.push({ start: +start.toFixed(3), end: null });
  return out;
}

/** EBU R128 integrated loudness + true peak (measured). */
export async function loudness(tools, path) {
  const r = await run(tools.ffmpeg, ["-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], { timeoutMs: 30 * 60 * 1000 });
  const summary = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const I = summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/);
  const LRA = summary.match(/LRA:\s+(-?[\d.]+) LU/);
  const TP = summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/);
  if (!I) return null;
  return { integrated_lufs: I[1] === "-inf" ? null : +I[1], loudness_range_lu: LRA ? +LRA[1] : null, true_peak_dbtp: TP && TP[1] !== "-inf" ? +TP[1] : null, standard: "EBU R128 (ffmpeg ebur128)" };
}

/** Decode mono PCM float32 at `sr` Hz. */
export async function pcm(tools, path, sr = 11025, maxSeconds = 1800) {
  const r = await mustRun(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", path, "-vn", "-ac", "1", "-ar", String(sr), "-t", String(maxSeconds), "-f", "f32le", "-"], { timeoutMs: 30 * 60 * 1000 });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
}

/**
 * Onset detection (energy flux with adaptive threshold) + tempo estimate
 * from onset-interval autocorrelation. Good for cutting on hits/beats;
 * tempo is an estimate.
 */
export function onsets(samples, sr) {
  const hop = Math.round(sr * 0.01); // 10 ms
  const win = hop * 2;
  const env = [];
  for (let i = 0; i + win < samples.length; i += hop) {
    let e = 0;
    for (let k = 0; k < win; k++) e += samples[i + k] * samples[i + k];
    env.push(Math.sqrt(e / win));
  }
  const flux = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? v)));
  const beats = [];
  const W = 30;
  let last = -1e9;
  for (let i = 1; i < flux.length - 1; i++) {
    let mean = 0;
    let n = 0;
    for (let k = Math.max(0, i - W); k < Math.min(flux.length, i + W); k++) {
      mean += flux[k];
      n++;
    }
    mean /= n;
    const t = (i * hop) / sr;
    if (flux[i] > mean * 2.2 + 1e-4 && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1] && t - last > 0.12) {
      beats.push(+t.toFixed(3));
      last = t;
    }
  }
  // Tempo: histogram of inter-onset intervals folded into 60–180 bpm.
  let tempo = null;
  if (beats.length > 8) {
    const hist = new Map();
    for (let i = 1; i < beats.length; i++) {
      for (let j = i; j < Math.min(beats.length, i + 4); j++) {
        let d = beats[j] - beats[i - 1];
        if (d <= 0) continue;
        let bpm = 60 / d;
        while (bpm < 60) bpm *= 2;
        while (bpm > 180) bpm /= 2;
        const b = Math.round(bpm);
        hist.set(b, (hist.get(b) || 0) + 1 / (j - i + 1));
      }
    }
    const best = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) tempo = best[0];
  }
  return { beats, tempo_bpm: tempo };
}

export async function audio(tools, path, o = {}) {
  const info = await probe(tools, path);
  if (!info.hasAudio) return { hasAudio: false };
  const res = { hasAudio: true, duration: info.duration };
  if (o.silence !== false) res.silences = await silences(tools, path, { noiseDb: o.silenceDb ?? -35, minDur: o.minSilence ?? 0.4 });
  if (o.loudness !== false) res.loudness = await loudness(tools, path);
  if (o.beats) {
    const sr = 11025;
    const s = await pcm(tools, path, sr);
    Object.assign(res, onsets(s, sr));
  }
  return res;
}

/** Mean luma/saturation of a frame (tiny RGB decode). */
export async function colorStats(tools, path, t) {
  const r = await run(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", path, "-frames:v", "1", "-vf", "scale=32:18", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const b = r.stdout;
  if (!b.length) return null;
  let l = 0;
  let s = 0;
  const n = b.length / 3;
  for (let i = 0; i < b.length; i += 3) {
    const R = b[i] / 255;
    const G = b[i + 1] / 255;
    const B = b[i + 2] / 255;
    const mx = Math.max(R, G, B);
    const mn = Math.min(R, G, B);
    l += 0.2126 * R + 0.7152 * G + 0.0722 * B;
    s += mx === 0 ? 0 : (mx - mn) / mx;
  }
  return { luma: l / n, sat: s / n };
}
