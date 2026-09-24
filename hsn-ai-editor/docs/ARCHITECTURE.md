# Architecture

```
┌──────────────── Premiere (UXP panel) ─────────────────────────────────────┐
│ ui/app.js ── chat, plan cards, scope, status, versions, settings           │
│    │                                                                       │
│ agent/agent.js ── conversation loop (append-only history, stop, retries)   │
│    │        ├─ claude/client.js ── HTTPS + SSE to api.anthropic.com        │
│    │        └─ agent/registry.js ── typed tools (JSON schema validated)    │
│    │              ├ perception: timeline/media/scope/analyze/frames/search │
│    │              ├ planning:   propose/execute plan, versions, pins, style│
│    │              ├ editing:    edit_timeline, audio, visual, markers,     │
│    │              │             restore, project_ops                       │
│    │              └ delivery:   captions, titles, renders, formats,        │
│    │                            reference, export                          │
│ editing/ ── styles, plan (validate → layout → compile), analyzer, index,   │
│             captions                                                       │
│ executor/ ── step runner: stop points, dependency skipping, journal,       │
│              verification                                                  │
│ host/premiere/adapter.js ── the ONLY code that calls `premierepro`         │
│ storage/ ── settings (plugin-data), API key (secureStorage), project memory│
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ http://127.0.0.1:47631 + token  (or file bridge)
┌───────────────────────────────▼───────────────────────────────────────────┐
│ helper/server.js (Node, no deps) ── ffmpeg/ffprobe, Whisper, yt-dlp (opt.)│
└───────────────────────────────────────────────────────────────────────────┘
```

## Key decisions

| Decision | Why |
|---|---|
| **UXP** (not CEP/ExtendScript) | Adobe's current, supported extensibility for Premiere 25.6+; modern JS, network, secure storage. |
| **Raw HTTP client for Claude** | UXP lacks `TextDecoder` (Adobe network recipe), which the official JS SDK's streaming relies on. The client uses documented UXP globals (`fetch`, `ReadableStream.getReader`) plus its own UTF-8 decoder; covered by tests against a fake SSE server. |
| **Plans instead of free code** | Claude composes typed tools and structured plans; it cannot execute arbitrary code in Premiere. Plans are validated against real media before anything runs. |
| **New sequence per full edit** | Non-destructive: the source sequence and media are never altered. Versions are sequences recorded in project memory. |
| **One transaction per step + read-back** | Each step is an undoable `executeTransaction` named `HSN AI: …`, created inside `lockedAccess` (required since Premiere 26.3). Results are re-read and corrected/reported. |
| **Frame-accurate ticks** | 254,016,000,000 ticks/s; all standard rates have integer ticks per frame. Every time is snapped to the sequence grid. |
| **Overwrite with source In/Out** | Exact segments are placed by setting the project item's In/Out, overwriting at the target time, and restoring the marks. Unwanted linked halves go to a scratch track and are removed, so B-roll never overwrites dialogue audio. |
| **Verification-driven trims** | Adobe's docs don't define `createSetStartAction` etc. precisely; the adapter applies edge/slip steps one by one and stops as soon as the read-back matches. Tested against two different simulated semantics. |
| **Helper is optional** | Everything essential works without it (frames via `Exporter.exportSequenceFrame`, transcripts from Premiere). The helper adds measurement and rendering. |

## Data flow for “edit this footage as a documentary”
1. Context note (project, sequence, scope, mode, remembered rules, timeline-changed warning) + user text → Claude.
2. Claude: `get_timeline_state` → `analyze_footage` (frames as images + transcripts + audio) → `record_shot_notes` → `search_footage`/`view_frames` as needed.
3. Claude: `propose_edit_plan` (events with source ranges, roles, J/L cuts, ducking, transitions, quotes).
4. `resolvePlan` validates: media bounds, frame snapping, overlaps (auto checkerboard for dialogue), transition handles, quote ↔ transcript, speech reordering (documentary ethics), pins, constraints, protected tracks, style pacing, target duration.
5. Preview mode → plan card; Execute → `compilePlan` → ordered ops → `Executor` (journal keyed by plan hash) → verification report → version recorded.

## Extending
- **New tool**: add `{ name, description, input_schema, handler(input, ctx) }` to a file in `src/agent/tools/` and register it in `tools/index.js`. `ctx` gives `host`, `analyzer`, `index`, `memory`, `settings`, `helper`, `ui`, `stop`.
- **New host capability**: add a method to `PremiereHost` (actions inside `tx()`), mirror it in `host/mock/ppro-mock.js`, add a test.
- **New style**: add a StyleSpec to `BUILTIN_STYLES`, or let users save their own (`save_style`).
- **New helper endpoint**: add a handler in `helper/server.js#makeHandlers` (validate inputs, spawn with arg arrays).

## Storage
- `plugin-data/settings.json` — preferences (no secrets; writing a key-like string is refused).
- UXP `secureStorage` — Anthropic API key.
- `plugin-data/projects/<project guid>/memory.json` — chat log, constraints, pins, versions, restore points, plans, execution journal, custom styles, reference profiles.
- `plugin-data/projects/<project guid>/footage-index.json` — per-media notes, frames sampled, transcripts, audio features, coverage.
- Renders/captions/exports go to `<project folder>/HSN AI Editor/…`.
