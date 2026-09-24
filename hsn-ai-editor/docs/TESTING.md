# Testing

## 1. Automated (run here): 53/53 passing

`npm test` (Node 22, ffmpeg 7.0.2 for helper tests). **None of these ran inside Premiere.** The Premiere parts run against `src/host/mock/ppro-mock.js`, a simulation of the `premierepro` module built from Adobe's official type declarations (`@adobe/premierepro` 26.5.1) and samples.

| File | Tests | Covers |
|---|---|---|
| `core.test.js` | 5 | ticks/frames for 23.976–60 fps, timecode, schema validator, streaming UTF-8 (Arabic split across chunks), Arabic search normalization, key redaction |
| `client.test.js` | 10 | SSE assembly (text, thinking + signature, tool JSON), request shape per model (adaptive thinking, effort, fallbacks), 529 retry with retry-after, 401 without retry and without echoing the key, dropped stream re-request, invalid tool JSON flagged, fallback rejection fallback, abort, fallback history echo, test connection + cost |
| `adapter.test.js` | 13 | timeline read + inferred links, stale keys detected even after background polls, actions outside `lockedAccess` rejected, frame-accurate placement + source mark restore, video-only B-roll keeps dialogue audio, exact trims under **two different trim semantics**, linked move, protected tracks, Premiere-locked track rejection with no change, split/ripple/markers, transitions/effects/keyframes/volume in dB and linear units, new sequence like source + vertical frame, transcript + frame export |
| `plan-executor.test.js` | 8 | documentary plan with J/L cuts, checkerboarding, ducking; rejects fabricated quotes, out-of-range sources, overlaps, protected tracks; speech-reordering needs a splice note; pins/constraints; execution into a new sequence with verification; **no duplicate on re-request**; **stop + resume**; failed step skips only dependents |
| `agent.test.js` | 6 | full loop: read → analyze (frames as images) → notes → Arabic search → plan → execute → verify; preview approval flow + idempotent execute; quote rejection before execution; restore point + Stop halting remaining tools; timeline changed between turns flagged to Claude; invalid tool input rejected; **API key never written to disk** |
| `helper.test.js` | 7 | real ffmpeg on generated media: probe without ffprobe, scene cuts, silences, EBU R128 loudness, onsets + 120 bpm tempo, JPEG frames, colour stats, renders (speed, reverse, ramp, LUT, reframe 9:16, freeze) without touching the original, reference analysis, HTTP host check (DNS rebinding), token auth, path validation, file bridge transport |
| `selftest.test.js` | 2 | the on-device self-test itself, run on the simulation (dB and linear), cleans up its temporary sequence |
| `desktop.test.js` | 1 | Claude Desktop mode: real `mcp.js` over stdio JSON-RPC (initialize, tools/list, tools/call) → token-protected relay → panel loop → tools → simulated Premiere; invalid input rejected |
| `ui.test.js` | 1 | the **built bundle** in jsdom: boot, header, streaming Arabic reply, plan card → Execute → new sequence, settings, language switch, no key on disk |

## 2. In-Premiere checks (need your machine)

### 2a. Automatic: Settings → Premiere calibration → Run self-test
Creates a temporary sequence from a clip > 6 s, runs: read, exact placement, video-only placement, trim to exact range, linked move, split, markers, transition, Motion keyframes + position normalization, audio level units, video effect + parameter, frame export availability, ripple remove, then deletes the sequence. Paste the output into an issue if anything fails.

### 2b. Manual scenario (≈20 min)
Prepare a test project: 3–5 video clips (one interview with speech, B-roll, a clip with nat sound), one music file, one SFX; a sequence with the clips roughly laid on V1/A1, B-roll on V2, music on A3; lock A3 in Premiere; link state default.

| # | Do | Expect |
|---|---|---|
| 1 | Open panel, paste API key, Test connection | ✓ model, latency, cost shown; chip turns green |
| 2 | Scope = timeline, preview mode: «شوف الخامات واقترح أسلوب مونتاج» | tool chips (read, analyze with 🖼 frames), a text proposal; Footage tab shows notes & coverage |
| 3 | «نفذ مونتاج وثائقي 45 ثانية» | plan card with structure/assumptions; Execute → new sequence “… — HSN v1 documentary”; original untouched; verification “all at the planned frames” |
| 4 | Scrub the new sequence | cuts at frame boundaries, A/V sync, J/L cuts audible, music ducked under speech |
| 5 | Stop during execution of another plan | stops after the current step; Execute again resumes, no duplicate sequence |
| 6 | Ask to edit A3 (locked) | clear error, nothing changed |
| 7 | Move a clip yourself, then ask for a trim | Claude is told the timeline changed and re-reads |
| 8 | «ثبت البداية وعدل الوسط فقط» then «سو نسخة ثانية مختلفة» | pins saved (Versions tab); v2 keeps the opening |
| 9 | «ارجع للنسخة السابقة» and “Undo last AI change” | active sequence switches; nothing deleted |
| 10 | Disconnect network mid-reply | retry notice, no duplicated edits |
| 11 | Helper: start, paste token, «حلل الصوت» / reference file / «بطّئ اللقطة للنصف» | LUFS/silences/beats; reference stats + frames; new clip in “HSN Renders” |
| 12 | «سوّ ترجمة عربية» | SRT in project folder + “HSN Captions” bin; Arabic displays right-to-left |
| 13 | «نسخة رأسية» | 1080×1920 copy, clips scaled/positioned |
| 14 | Edit › Undo in Premiere | undoes the last “HSN AI: …” step |

Record: Premiere version, OS, pass/fail per row.

## 3. Not verified here (honest list)
- Rendering fidelity of the panel in UXP (CSS subset) — verified only in jsdom.
- Exact behaviour of `createSetStartAction`/`createMoveAction`, volume `Level` units, keyframe time base, `Motion.Position` normalization on your build — the self-test measures these.
- MOGRT text parameter writing; SRT import creating a caption item; `EncoderManager.exportSequence` with/without preset.
- macOS http-to-localhost policy for the helper (file bridge provided as fallback).
- Live Claude API calls (no key in the build environment); request shapes follow Anthropic's documented API and are unit-tested against a fake server.
