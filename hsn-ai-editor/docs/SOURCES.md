# Official sources used

## Adobe
- Premiere UXP documentation (source of developer.adobe.com/premiere-pro/uxp): https://github.com/AdobeDocs/uxp-premiere-pro
  - Changelog 26.5 / 26.3 / 26.2 (lockedAccess requirement for actions, Transcript API, WorkAreaUtils, synchronous `Sequence.setSelection`)
  - Recipes: network (fetch/XHR/WebSocket, `TextDecoder` unavailable, macOS http restriction), filesystem (`plugin-data:`, `file:` + `fullAccess`), external process, manifest v5 (`requiredPermissions`)
  - `require('uxp').storage.secureStorage`
  - UXP CSS / HTML support lists, `HTMLDialogElement.showModal()` returning a Promise
- Type declarations: `@adobe/premierepro` 26.5.1 on npm (https://github.com/adobe/premierepro-types) — every host call in `src/host/premiere/adapter.js` exists in these declarations.
- Samples: https://github.com/AdobeDocs/uxp-premiere-pro-samples (`premiere-api`: sequence editor, effects, keyframes, transitions, transcript, export)
- Premiere transcript JSON format: `transcript_format_spec.json` in the samples (supported language list — no Arabic).
- UXP Developer Tool / distribution: developer.adobe.com/premiere-pro/uxp/plugins/distribution

## Anthropic
- Messages API (streaming SSE events, tool use, image input in tool results): https://platform.claude.com/docs/en/api/messages
- Adaptive thinking, effort (`output_config.effort`), server-side fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), refusal stop reason, prompt caching, eager input streaming — per Anthropic's current API reference.
- Pricing used for estimates (USD per 1M tokens): Opus 5 $5/$25, Opus 5.5 $4/$20, Fable 5.1 $10/$50, Sonnet 5 $2/$10, Haiku 4.5 $1/$5.

## Media tooling
- ffmpeg filters: `silencedetect`, `ebur128`, `select=gt(scene,…)`, `showinfo`, `setpts`, `atempo`, `reverse/areverse`, `lut3d`, `crop`, `loop`.
- whisper.cpp (`whisper-cli -oj -ojf`) and openai-whisper (`--output_format json --word_timestamps True`).
