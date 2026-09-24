// Local speech-to-text through an installed Whisper implementation.
// Supported (configure in ~/.hsn-ai-editor/helper.json → "whisper"):
//  - whisper.cpp:   {"kind":"whisper.cpp","bin":"/path/whisper-cli","model":"/path/ggml-large-v3.bin"}
//  - openai-whisper:{"kind":"openai-whisper","bin":"whisper","model":"medium"}
// Audio never leaves the machine for transcription.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mustRun } from "./ffmpeg.js";

export function whisperAvailable(cfg) {
  return !!(cfg?.whisper?.bin && (cfg.whisper.kind === "openai-whisper" || fs.existsSync(cfg.whisper.bin)));
}

export async function transcribe(tools, cfg, { path: media, language = "auto" }) {
  const w = cfg.whisper;
  if (!whisperAvailable(cfg)) throw new Error("Whisper is not configured in the helper (see README → Transcription).");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hsn-stt-"));
  try {
    const wav = path.join(dir, "audio.wav");
    await mustRun(tools.ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", media, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], { timeoutMs: 30 * 60 * 1000 });
    const lang = language === "auto" ? null : language.slice(0, 2);
    if (w.kind === "whisper.cpp") {
      const base = path.join(dir, "out");
      await mustRun(w.bin, ["-m", w.model, "-f", wav, "-oj", "-ojf", "-of", base, ...(lang ? ["-l", lang] : ["-l", "auto"])], { timeoutMs: 3 * 60 * 60 * 1000 });
      const j = JSON.parse(fs.readFileSync(`${base}.json`, "utf8"));
      const segs = (j.transcription || []).map((s) => ({
        start: s.offsets.from / 1000,
        end: s.offsets.to / 1000,
        text: s.text.trim(),
        words: (s.tokens || []).filter((t) => t.text && !/^\[/.test(t.text)).map((t) => ({ start: t.offsets.from / 1000, end: t.offsets.to / 1000, text: t.text.trim(), confidence: t.p })),
      }));
      return { language: j.result?.language || lang, segments: segs, model: path.basename(w.model || "") };
    }
    // openai-whisper CLI
    await mustRun(w.bin, [wav, "--model", w.model || "medium", "--output_format", "json", "--output_dir", dir, "--word_timestamps", "True", ...(lang ? ["--language", lang] : [])], { timeoutMs: 3 * 60 * 60 * 1000 });
    const j = JSON.parse(fs.readFileSync(path.join(dir, "audio.json"), "utf8"));
    return {
      language: j.language,
      model: w.model || "medium",
      segments: j.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim(), words: (s.words || []).map((x) => ({ start: x.start, end: x.end, text: x.word.trim(), confidence: x.probability })) })),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
