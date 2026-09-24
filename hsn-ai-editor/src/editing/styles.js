// Editing style knowledge. A style is not a preset of effects: it is a set
// of decisions that shape shot selection, structure, rhythm, sound and text.
// Built-in styles are starting points; the user can describe any style in
// free text and Claude turns it into a StyleSpec (same schema) that can be
// saved, blended and edited. Numeric fields feed the plan validator.

import { S } from "../core/schema.js";

export const STYLE_SPEC_SCHEMA = S.obj(
  {
    id: S.str("short id, e.g. 'doc-cinematic'"),
    name: S.str("display name (any language)"),
    summary: S.str("one-paragraph description of the look and feel"),
    based_on: S.arr(S.str("built-in style id"), "styles this one blends"),
    pacing: S.obj(
      {
        avg_shot_s: S.num("typical shot length in seconds", { minimum: 0.1 }),
        min_shot_s: S.num("shortest acceptable shot", { minimum: 0.04 }),
        max_shot_s: S.num("longest acceptable shot", { minimum: 0.1 }),
        rhythm: S.str("how cuts are timed: on phrase, on beat, on action, breathing room..."),
        acceleration: S.str("how tempo evolves across the piece"),
      },
      ["avg_shot_s", "min_shot_s", "max_shot_s"]
    ),
    structure: S.arr(S.str("section"), "ordered sections, e.g. hook, context, development, climax, resolution, CTA"),
    shot_selection: S.arr(S.str("priority"), "what to favour/avoid when choosing shots"),
    audio: S.obj({
      dialogue: S.str("dialogue treatment"),
      music: S.str("music role and level"),
      nat_sound: S.str("ambience / natural sound usage"),
      j_l_cuts: S.enm(["none", "occasional", "frequent"], "J/L-cut usage"),
      silence: S.str("use of pauses/silence"),
    }),
    transitions: S.obj({
      default: S.str("default transition, usually a straight cut"),
      allowed: S.arr(S.str("transition match name or 'cut'"), "allowed transitions"),
      max_per_minute: S.num("upper bound of non-cut transitions per minute", { minimum: 0 }),
    }),
    text: S.str("titles/captions policy"),
    color: S.str("color intent (a direction, not a guaranteed match)"),
    motion: S.str("camera-motion / reframing / speed guidance, within what the API can execute"),
    ethics: S.arr(S.str("rule"), "hard rules, e.g. never splice speech to change meaning"),
  },
  ["id", "name", "summary", "pacing"],
  "Editing style specification"
);

const doc = {
  id: "documentary",
  name: "Documentary / وثائقي",
  summary: "Meaning-first storytelling built on interviews and observation. Structure follows the argument, B-roll illustrates what is said, the environment is allowed to breathe.",
  based_on: [],
  pacing: { avg_shot_s: 4.5, min_shot_s: 1.5, max_shot_s: 14, rhythm: "cut on phrase boundaries and natural pauses, never mid-word", acceleration: "calm opening, builds toward the key idea, lets the ending land" },
  structure: ["cold open / strongest observational moment", "context", "development", "turning point", "resolution"],
  shot_selection: ["interview answers that carry the central idea", "B-roll that shows what the speaker describes", "observational moments with real sound", "avoid repeated angles back-to-back", "reject shaky/soft shots unless they carry unique content"],
  audio: { dialogue: "clear, uninterrupted sentences; keep breaths when natural", music: "sparse, low under dialogue (duck 12–18 dB)", nat_sound: "keep and feature room tone and ambience", j_l_cuts: "frequent", silence: "allow pauses after strong statements" },
  transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New", "AE.ADBE Dip To Black"], max_per_minute: 1 },
  text: "lower thirds for speakers, minimal on-screen text, subtitles when needed",
  color: "natural, consistent across scenes",
  motion: "slow push-ins on stills allowed; no gimmick speed effects",
  ethics: [
    "Never splice or reorder a speaker's words to change what they meant.",
    "Never invent quotes, events or facts; titles must be supported by the footage or the user.",
    "Keep context: a statement's surrounding qualifiers stay when they change its meaning.",
  ],
};

export const BUILTIN_STYLES = [
  doc,
  {
    id: "commercial",
    name: "Commercial / إعلاني",
    summary: "Message-driven. A hook in the first 1–2 s, the product shown clearly and in use, benefits made visual, rhythm matched to the brand, clean end frame for logo/CTA when requested.",
    pacing: { avg_shot_s: 1.8, min_shot_s: 0.5, max_shot_s: 4, rhythm: "on beat or on action", acceleration: "fast hook, steady middle, hold on the hero shot" },
    structure: ["hook", "problem or desire", "product reveal", "product in use / details", "benefit payoff", "end frame / CTA"],
    shot_selection: ["hero product shots and macro details", "hands using the product", "faces reacting", "avoid anything that misrepresents the product"],
    audio: { dialogue: "short, punchy VO if provided", music: "drives the edit", nat_sound: "accent SFX on key actions", j_l_cuts: "occasional", silence: "a beat of silence before the reveal can work" },
    transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New", "AE.ADBE Dip To White"], max_per_minute: 4 },
    text: "few words, large, brand fonts; leave room for logo/CTA only when requested",
    color: "clean, product colors true, contrast slightly lifted",
    motion: "scale push-ins on details; speed ramps only via pre-rendered helper clips",
    ethics: ["Do not invent product features, prices, claims or results.", "Do not show the product doing something the footage does not show."],
  },
  {
    id: "cinematic",
    name: "Cinematic / سينمائي",
    summary: "Image and atmosphere first: longer holds, composed wides, deliberate reveals, sound design and music carrying emotion.",
    pacing: { avg_shot_s: 4, min_shot_s: 1, max_shot_s: 12, rhythm: "motivated cuts on movement and gaze", acceleration: "slow build to a peak, quiet release" },
    structure: ["atmospheric opening", "establishing", "build", "peak", "release"],
    shot_selection: ["strong composition and light", "movement continuity", "silhouettes and reveals", "avoid flat, over-lit or shaky shots"],
    audio: { dialogue: "sparse", music: "score-like, dynamic", nat_sound: "designed ambience, SFX accents", j_l_cuts: "frequent", silence: "used for tension" },
    transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New", "AE.ADBE Dip To Black", "AE.ADBE Film Dissolve"], max_per_minute: 2 },
    text: "elegant, minimal",
    color: "contrasty filmic look via LUT/Lumetri if the user supplies one",
    motion: "slow scale drifts; letterbox optional",
    ethics: [],
  },
  { id: "calm", name: "Calm / هادئ", summary: "Slow, breathing edit with long holds and gentle transitions.", pacing: { avg_shot_s: 6, min_shot_s: 2.5, max_shot_s: 16, rhythm: "on breath and stillness", acceleration: "flat" }, structure: ["arrival", "stillness", "gentle development", "rest"], shot_selection: ["stable, soft-light shots", "nature and texture"], audio: { music: "soft", nat_sound: "prominent", j_l_cuts: "frequent", silence: "welcome" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New"], max_per_minute: 3 }, text: "minimal", color: "soft, warm", motion: "very slow push-ins", ethics: [] },
  { id: "fast", name: "Fast / سريع", summary: "High energy, quick cutting, on-beat rhythm, strong motion.", pacing: { avg_shot_s: 0.9, min_shot_s: 0.25, max_shot_s: 2.5, rhythm: "on beat", acceleration: "keeps energy high, micro-peaks" }, structure: ["hook", "run", "peak", "button"], shot_selection: ["motion-rich shots", "variety of angles", "avoid static wides unless as a breath"], audio: { music: "loud and driving", nat_sound: "SFX hits", j_l_cuts: "none" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Whip", "AE.ADBE Push"], max_per_minute: 6 }, text: "kinetic, short", color: "punchy", motion: "scale punches", ethics: [] },
  { id: "luxury", name: "Luxury / فاخر", summary: "Restraint and precision: slow reveals, macro detail, negative space, calm confidence.", pacing: { avg_shot_s: 3.5, min_shot_s: 1.5, max_shot_s: 8, rhythm: "measured, elegant", acceleration: "slow, controlled" }, structure: ["intrigue", "detail", "reveal", "signature shot", "end frame"], shot_selection: ["macro textures", "light glints", "hands with care", "avoid clutter"], audio: { music: "refined, sparse", nat_sound: "subtle foley", j_l_cuts: "occasional" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New", "AE.ADBE Dip To Black"], max_per_minute: 3 }, text: "thin, spaced typography", color: "deep blacks, rich tones", motion: "slow dolly-like scale", ethics: ["No invented claims."] },
  { id: "emotional", name: "Emotional / عاطفي", summary: "Faces, moments and music carry feeling; holds on reactions.", pacing: { avg_shot_s: 3.5, min_shot_s: 1, max_shot_s: 10, rhythm: "on emotional beats", acceleration: "build to a moving peak" }, structure: ["intimate opening", "connection", "tension or longing", "emotional peak", "resolution"], shot_selection: ["faces and eyes", "touch", "genuine reactions"], audio: { music: "emotive", nat_sound: "voices and laughter", j_l_cuts: "frequent", silence: "before the peak" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New"], max_per_minute: 2 }, text: "minimal", color: "warm", motion: "gentle", ethics: [] },
  { id: "music_video", name: "Music-driven / موسيقي", summary: "The track is the spine: cuts land on beats and phrases, sections follow the song.", pacing: { avg_shot_s: 1.5, min_shot_s: 0.3, max_shot_s: 6, rhythm: "on beats / downbeats; section changes on phrase", acceleration: "follows the song" }, structure: ["intro", "verse", "chorus", "bridge", "outro"], shot_selection: ["performance and motion", "visual motifs"], audio: { music: "full level, unducked", nat_sound: "rare", j_l_cuts: "none" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New", "AE.ADBE Dip To White"], max_per_minute: 5 }, text: "lyrics/titles optional", color: "stylized allowed", motion: "on-beat scale punches", ethics: [] },
  { id: "event", name: "Event coverage / تغطية فعالية", summary: "Chronological highlight of an event: arrival, key moments, people, atmosphere, closing.", pacing: { avg_shot_s: 2.2, min_shot_s: 0.8, max_shot_s: 6, rhythm: "music-led with speech bites", acceleration: "rises to the key moment" }, structure: ["arrival / venue", "people", "key moments", "speech highlights", "celebration / closing"], shot_selection: ["crowd energy", "key speakers", "branding in the venue"], audio: { dialogue: "short speech bites", music: "upbeat bed", nat_sound: "applause, crowd", j_l_cuts: "occasional" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New"], max_per_minute: 3 }, text: "event name, date, speaker names", color: "vibrant, consistent", motion: "", ethics: ["Do not misattribute speeches."] },
  { id: "interview", name: "Interview / مقابلة", summary: "Clean, respectful interview edit: complete thoughts, cutaways to cover edits.", pacing: { avg_shot_s: 6, min_shot_s: 2, max_shot_s: 25, rhythm: "on sentence ends", acceleration: "flat" }, structure: ["introduction", "questions/themes", "closing thought"], shot_selection: ["best takes of each answer", "cutaways to hide jump cuts"], audio: { dialogue: "priority", music: "very low or none", nat_sound: "room tone for gaps", j_l_cuts: "frequent" }, transitions: { default: "cut", allowed: ["cut"], max_per_minute: 0.5 }, text: "name + title lower third", color: "natural skin tones", motion: "punch-in (scale 110–120%) to hide jump cuts", ethics: doc.ethics },
  { id: "educational", name: "Educational / تعليمي", summary: "Clarity over flair: one idea per section, visuals that explain, on-screen text for key terms.", pacing: { avg_shot_s: 4, min_shot_s: 1.5, max_shot_s: 12, rhythm: "on sentence and step boundaries", acceleration: "steady" }, structure: ["what you'll learn", "steps / concepts", "recap"], shot_selection: ["close-ups of the process", "screens/diagrams if available"], audio: { dialogue: "priority", music: "low bed", j_l_cuts: "occasional" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New"], max_per_minute: 2 }, text: "step titles, key terms", color: "neutral", motion: "zoom to details", ethics: ["No invented facts."] },
  { id: "product", name: "Product video / فيديو منتج", summary: "Show the product clearly: hero, details, use, features supported by footage, end frame.", pacing: { avg_shot_s: 2.2, min_shot_s: 0.8, max_shot_s: 5, rhythm: "on action", acceleration: "steady" }, structure: ["hero", "details", "in use", "features", "end frame"], shot_selection: ["clean hero angles", "macro details", "hands using it"], audio: { music: "brand-appropriate", nat_sound: "product foley", j_l_cuts: "occasional" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New"], max_per_minute: 3 }, text: "feature callouts only if provided by the user", color: "true product colors", motion: "slow push on details", ethics: ["Do not invent product features or claims."] },
  { id: "reels", name: "Reels / Shorts / ريلز", summary: "Vertical-first, hook in the first second, no slow build, text-friendly framing, loops well.", pacing: { avg_shot_s: 1.2, min_shot_s: 0.3, max_shot_s: 3, rhythm: "on beat / on words", acceleration: "front-loaded" }, structure: ["hook (0–1.5s)", "payoff", "twist or reveal", "loopable end"], shot_selection: ["center-weighted subjects (safe for 9:16)", "faces", "motion"], audio: { music: "trend-friendly bed if provided", dialogue: "tight, no pauses", j_l_cuts: "none" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Whip"], max_per_minute: 6 }, text: "large captions in the safe zone", color: "punchy", motion: "scale to fill 9:16, punch-ins", ethics: [] },
  { id: "travel", name: "Travel story / قصة سفر", summary: "Journey arc with sense of place: arrivals, textures, people, movement, a reflective close.", pacing: { avg_shot_s: 2.5, min_shot_s: 0.8, max_shot_s: 8, rhythm: "music-led, breathing on landscapes", acceleration: "journey rhythm" }, structure: ["departure / arrival", "sense of place", "experiences", "people", "reflection"], shot_selection: ["wide establishing", "local texture", "movement (walking, vehicles)", "golden hour"], audio: { music: "journey bed", nat_sound: "street, nature, language", j_l_cuts: "frequent" }, transitions: { default: "cut", allowed: ["cut", "AE.ADBE Cross Dissolve New", "AE.ADBE Dip To White"], max_per_minute: 3 }, text: "place names", color: "warm, vivid", motion: "", ethics: [] },
];

export function getStyle(id, custom = []) {
  return [...custom, ...BUILTIN_STYLES].find((s) => s.id === id) || null;
}

/** Numeric blend of pacing + union of rules; Claude refines the words. */
export function blendStyles(specs, weights) {
  const w = weights && weights.length === specs.length ? weights : specs.map(() => 1 / specs.length);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const avg = (f) => specs.reduce((acc, s, i) => acc + (s.pacing?.[f] ?? 0) * w[i], 0) / sum;
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  return {
    id: specs.map((s) => s.id).join("+"),
    name: specs.map((s) => s.name).join(" + "),
    summary: specs.map((s) => s.summary).join(" / "),
    based_on: specs.map((s) => s.id),
    pacing: { avg_shot_s: +avg("avg_shot_s").toFixed(2), min_shot_s: +avg("min_shot_s").toFixed(2), max_shot_s: +avg("max_shot_s").toFixed(2), rhythm: specs.map((s) => s.pacing?.rhythm).filter(Boolean).join("; ") },
    structure: specs[0].structure,
    shot_selection: uniq(specs.flatMap((s) => s.shot_selection || [])),
    transitions: {
      default: "cut",
      allowed: uniq(specs.flatMap((s) => s.transitions?.allowed || ["cut"])),
      max_per_minute: Math.min(...specs.map((s) => s.transitions?.max_per_minute ?? 3)),
    },
    ethics: uniq(specs.flatMap((s) => s.ethics || [])),
  };
}

export function styleCatalogText() {
  return BUILTIN_STYLES.map((s) => `- ${s.id}: ${s.name} — ${s.summary} (avg shot ≈ ${s.pacing.avg_shot_s}s)`).join("\n");
}
