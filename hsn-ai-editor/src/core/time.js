// Frame-accurate time math. Premiere represents time in "ticks":
// 254,016,000,000 ticks per second. Every standard frame rate
// (23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120) has an integer
// number of ticks per frame, so all edit points are computed in integer
// ticks and snapped to whole frames of the target sequence.

export const TICKS_PER_SECOND = 254016000000;

const NTSC = { 23.976: [24000, 1001], 29.97: [30000, 1001], 59.94: [60000, 1001], 47.952: [48000, 1001], 119.88: [120000, 1001] };

/** Returns {num, den} rational frame rate from a float or rational-ish input. */
export function toRationalFps(fps) {
  if (fps && typeof fps === "object" && fps.num) return { num: fps.num, den: fps.den || 1 };
  const f = Number(fps);
  if (!isFinite(f) || f <= 0) throw new Error(`Invalid frame rate: ${fps}`);
  for (const [k, [n, d]] of Object.entries(NTSC)) {
    if (Math.abs(f - Number(k)) < 0.01) return { num: n, den: d };
  }
  if (Math.abs(f - Math.round(f)) < 1e-6) return { num: Math.round(f), den: 1 };
  return { num: Math.round(f * 1000), den: 1000 };
}

/** Integer ticks per frame for a frame rate. */
export function ticksPerFrame(fps) {
  const { num, den } = toRationalFps(fps);
  return Math.round((TICKS_PER_SECOND * den) / num);
}

export function fpsValue(fps) {
  const { num, den } = toRationalFps(fps);
  return num / den;
}

export function secondsToTicks(sec) {
  return Math.round(Number(sec) * TICKS_PER_SECOND);
}

export function ticksToSeconds(ticks) {
  return Number(ticks) / TICKS_PER_SECOND;
}

/** Snap ticks to the nearest frame boundary (mode: 'nearest' | 'floor' | 'ceil'). */
export function snapTicks(ticks, fps, mode = "nearest") {
  const tpf = ticksPerFrame(fps);
  const f = Number(ticks) / tpf;
  const frames = mode === "floor" ? Math.floor(f + 1e-9) : mode === "ceil" ? Math.ceil(f - 1e-9) : Math.round(f);
  return frames * tpf;
}

export function ticksToFrames(ticks, fps) {
  return Math.round(Number(ticks) / ticksPerFrame(fps));
}

export function framesToTicks(frames, fps) {
  return Math.round(frames) * ticksPerFrame(fps);
}

export function secondsToFrames(sec, fps) {
  return ticksToFrames(secondsToTicks(sec), fps);
}

export function framesToSeconds(frames, fps) {
  return ticksToSeconds(framesToTicks(frames, fps));
}

/** True when ticks lie on a frame boundary. */
export function isFrameAligned(ticks, fps) {
  return Number(ticks) % ticksPerFrame(fps) === 0;
}

/**
 * Format as SMPTE-style timecode HH:MM:SS:FF (non-drop display; NTSC rates
 * are displayed with the nominal integer frame base, matching Premiere's
 * non-drop-frame display).
 */
export function formatTimecode(ticks, fps) {
  const frameBase = Math.round(fpsValue(fps));
  let frames = ticksToFrames(ticks, fps);
  const neg = frames < 0;
  frames = Math.abs(frames);
  const ff = frames % frameBase;
  const totalSec = Math.floor(frames / frameBase);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const p = (n) => String(n).padStart(2, "0");
  return `${neg ? "-" : ""}${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}

/** Human friendly seconds display like 12.40s / 1:05.2 */
export function formatSeconds(sec) {
  const s = Number(sec);
  if (!isFinite(s)) return "?";
  if (Math.abs(s) < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

/**
 * Parse a time expression into ticks. Accepts numbers (seconds),
 * "12.5", "12.5s", "00:00:12:10" (timecode, needs fps), "1:02.5" (m:ss).
 */
export function parseTime(value, fps) {
  if (typeof value === "number") return secondsToTicks(value);
  if (value && typeof value === "object" && "ticks" in value) return Number(value.ticks);
  const s = String(value).trim();
  if (/^-?\d+(\.\d+)?s?$/.test(s)) return secondsToTicks(parseFloat(s));
  const tc = s.match(/^(\d+):(\d{2}):(\d{2})[:;](\d{2})$/);
  if (tc) {
    if (!fps) throw new Error("Timecode needs a frame rate");
    const base = Math.round(fpsValue(fps));
    const frames = ((+tc[1] * 60 + +tc[2]) * 60 + +tc[3]) * base + +tc[4];
    return framesToTicks(frames, fps);
  }
  const ms = s.match(/^(\d+):(\d{1,2}(\.\d+)?)$/);
  if (ms) return secondsToTicks(+ms[1] * 60 + parseFloat(ms[2]));
  throw new Error(`Unrecognized time value: ${value}`);
}

/** Overlap length (ticks) of [a0,a1) and [b0,b1). */
export function overlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}
