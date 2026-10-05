// Editable PowerPoint version of the Infant & Child Feeding lesson.
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SKILL = "/root/.claude/skills/synced/4ddcfb6c-5e90-4277-a68a-dff17696674b_45f4a70e-217d-4087-8c8a-d8ee4182d52a/pptx";
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");
const SRC = "/home/user/-/lessons/infant-feeding-src";
const ASSETS = path.join(__dirname, "assets");
const OUT = process.argv[2] || path.join(__dirname, "Infant-Child-Feeding.pptx");

// Icon + art dictionaries from the lesson source
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SRC, "icons.js"), "utf8"), sandbox);
const ICONS = sandbox.window.IFL_ICONS, ART = sandbox.window.IFL_ART;

// Speaker notes (Arabic explanation + teacher notes) extracted from the HTML lesson
const NOTES = {};
JSON.parse(fs.readFileSync(path.join(__dirname, "notes.json"), "utf8")).forEach((n) => {
  const clean = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  NOTES[n.title] = { ar: clean(n.ar), nt: clean(n.nt) };
});

const THEME = {
  name: "Infant Feeding",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "11262D", lt1: "FFFFFF", dk2: "0B5259", lt2: "EEF3F3",
    accent1: "BC3561", accent2: "2161A6", accent3: "6646B9", accent4: "357C30", accent5: "0E6C75", accent6: "BF2A2A",
    hlink: "2161A6", folHlink: "6646B9"
  }
};
const HEX = { 0: "0E6C75", 1: "BC3561", 2: "2161A6", 3: "6646B9", 4: "357C30" };
const DEEP = { 1: "922347", 2: "184C86", 3: "4D3292", 4: "285F24" };
const BAD = "BF2A2A", OK = "1B7A43", MUTED = "4B636B", LINE = "CDDADC";
const PARTS = ["", "Breastfeeding", "Artificial Feeding", "NG Tube Feeding", "Weaning"];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Infant and Child Feeding";
pres.subject = "Pediatric nursing lesson";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const PC = { 0: C.accent5, 1: C.accent1, 2: C.accent2, 3: C.accent3, 4: C.accent4 };

/* ---------------- Layouts ---------------- */
pres.defineSlideMaster({
  title: "Content",
  background: { color: C.background2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontSize: 36, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Infant and Child Feeding", options: { x: 0.6, y: 7.05, w: 6, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } }
  ],
  slideNumber: { x: 12.2, y: 7.05, w: 0.6, h: 0.3, fontSize: 10, color: MUTED, align: "right" }
});
pres.defineSlideMaster({
  title: "Section",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 2.75, w: 7.4, h: 1.4, fontSize: 48, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } }
  ]
});
pres.defineSlideMaster({
  title: "Cover",
  background: { color: C.background2 },
  objects: []
});

/* ---------------- Helpers ---------------- */
function stroked(name, hex) {
  let s = ICONS[name];
  s = s.replace(/class="t"/g, `fill="#${hex}" fill-opacity="0.16" stroke="none"`)
       .replace(/class="s"/g, `fill="#${hex}" stroke="none"`)
       .replace(/currentColor/g, `#${hex}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="256" height="256" fill="none" stroke="#${hex}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
}
const cache = {};
async function iconData(name, hex) {
  const k = name + hex;
  if (!cache[k]) cache[k] = "image/png;base64," + (await sharp(Buffer.from(stroked(name, hex))).png().toBuffer()).toString("base64");
  return cache[k];
}
async function artData(name) {
  const k = "art:" + name;
  if (!cache[k]) cache[k] = "image/png;base64," + (await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 68 68" width="320" height="320">${ART[name]}</svg>`)).png().toBuffer()).toString("base64");
  return cache[k];
}
const sizes = {};
async function asset(name) {
  const f = path.join(ASSETS, name + ".png");
  if (!sizes[name]) { const m = await sharp(f).metadata(); sizes[name] = { w: m.width, h: m.height, data: "image/png;base64," + fs.readFileSync(f).toString("base64") }; }
  return sizes[name];
}
// contain-fit an asset image inside a box
async function img(slide, name, x, y, w, h, alt) {
  const a = await asset(name), r = Math.min(w / a.w, h / a.h), iw = a.w * r, ih = a.h * r;
  slide.addImage({ data: a.data, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: alt || name, objectName: "Illustration " + name });
}
function T(slide, text, o) { slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top" }, o)); }
function card(slide, x, y, w, h, o = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.12, objectName: o.name || "Card",
    fill: o.fill || { color: C.background1 },
    line: o.line || { color: LINE, width: 0.75 },
    shadow: o.shadow === false ? undefined : { type: "outer", color: "11262D", opacity: 0.08, blur: 6, offset: 2, angle: 90 }
  });
}
function tint(part, t) { return { color: PC[part], transparency: t == null ? 88 : t }; }
async function iconBubble(slide, name, hex, part, x, y, s) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: s, h: s, fill: tint(part), line: { type: "none" }, objectName: "Icon circle" });
  slide.addImage({ data: await iconData(name, hex), x: x + s * 0.2, y: y + s * 0.2, w: s * 0.6, h: s * 0.6, altText: name + " icon" });
}
function eyebrow(slide, part, label) {
  T(slide, (label || ("PART " + part + " · " + PARTS[part])).toUpperCase(), { x: 0.6, y: 0.3, w: 8, h: 0.3, fontSize: 12, bold: true, color: PC[part], charSpacing: 2 });
}
function notes(slide, title, extra) {
  const n0 = NOTES[title] || { ar: "", nt: "" };
  const n = { nt: NT_OVERRIDE[title] || n0.nt, ar: n0.ar.split("\n").filter((l) => !AR_DROP.test(l)).join("\n") };
  const parts = [];
  if (extra) parts.push(extra);
  if (n.nt) parts.push("Teacher notes:\n" + n.nt);
  if (n.ar) parts.push("شرح عربي:\n" + n.ar);
  if (parts.length) slide.addNotes(parts.join("\n\n"));
}
const NT_OVERRIDE = {
  "Types of infant formula": "≈2 min. Introduce each type of formula in turn.",
  "Infant & Child Feeding": "≈2 min. Introduce the four parts of the lesson.",
  "NG tube feeding": "≈3 min. Trace the path on the 3D picture: nose → oesophagus → stomach. Point out that the airway sits right in front of the oesophagus.",
  "Bottle-feeding technique": "≈3 min. Compare the two 3D pictures: tilted bottle = nipple full of milk; too flat = air in the nipple.",
  "Safe formula preparation": "≈3 min. Ask students to read the steps aloud in order.",
  "Before NG feeding": "≈3 min. Ask a student to read each check aloud.",
  "Benefits of breastfeeding": "≈3 min. Ask students to guess each benefit before you reveal it.",
  "Breastfeeding technique": "≈4 min. Use the latch picture for steps 5 and 6, and the two figures for “head and body in a straight line”."
};
const AR_DROP = /اضغط|المجسم|اسحب/;
let curSection = "";
function section(title) { pres.addSection({ title }); curSection = title; }
function content(part, title, eyeLabel) {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: curSection });
  eyebrow(s, part, eyeLabel);
  s.addText(title, { placeholder: "title" });
  return s;
}
async function iconRows(slide, items, part, x, y, w, rowH, o = {}) {
  for (let i = 0; i < items.length; i++) {
    const [ic, text] = items[i], yy = y + i * rowH, s = o.icon || 0.5;
    await iconBubble(slide, ic, o.hex || HEX[part], o.tintPart != null ? o.tintPart : part, x, yy + (rowH - s) / 2 - 0.04, s);
    T(slide, text, { x: x + s + 0.2, y: yy, w: w - s - 0.2, h: rowH - 0.08, valign: "middle", fontSize: o.fontSize || 16 });
  }
}
function pill(slide, x, y, w, h, text, o = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: o.fill || { color: C.background1 }, line: o.line || { color: LINE, width: 0.75 }, objectName: "Pill" });
  T(slide, text, { x, y, w, h, align: "center", valign: "middle", fontSize: o.fontSize || 14, bold: !!o.bold, color: o.color || C.text1 });
}

/* ---------------- Quiz data (from the lesson) ---------------- */
const QUIZ = {
  1: [
    ["Exclusive breastfeeding is recommended for…", ["The first 4 months", "The first 6 months", "The first 12 months", "The first 2 weeks"], 1, "Recommended for the first 6 months of life."],
    ["Which of these is a LATE hunger cue?", ["Rooting", "Lip smacking", "Crying", "Hand-to-mouth movements"], 2, "Crying is a late hunger cue."],
    ["Which is a sign of effective breastfeeding?", ["More areola visible below the mouth", "Fast, shallow sucking", "Chin touches the breast", "Baby unsettled after feeding"], 2, "Chin touches the breast; more areola above the mouth than below."],
    ["Colostrum is rich in…", ["Fat only", "Antibodies, especially IgA", "Added sugar", "Water only"], 1, "Rich in antibodies (especially IgA), proteins and immune cells."]
  ],
  2: [
    ["How much powder should be used?", ["An extra scoop for better growth", "The manufacturer’s exact ratio", "Less powder, easier to digest", "An estimate by eye"], 1, "Follow the manufacturer’s exact water-to-powder ratio."],
    ["The correct position for bottle feeding is…", ["Lying completely flat", "Semi-upright, head and neck supported", "On the tummy", "Any position if the bottle is propped"], 1, "Semi-upright; never feed while lying completely flat."],
    ["Formula left in the bottle after a feed should be…", ["Saved for the next feed", "Discarded", "Re-warmed", "Mixed with a fresh feed"], 1, "Discard leftover formula after feeding."],
    ["Incorrect formula preparation can cause…", ["Faster growth", "Dehydration or electrolyte disturbances", "Better sleep", "No effect"], 1, "Incorrect preparation → dehydration or electrolyte disturbances."]
  ],
  3: [
    ["Before every NG feed, the nurse must…", ["Weigh the infant", "Check tube position (approved method)", "Warm the feed", "Change the tape"], 1, "Never administer a feed if tube placement is uncertain."],
    ["The infant coughs and becomes cyanosed during a feed. You…", ["Speed up to finish", "Stop feeding", "Flush the tube", "Continue and observe"], 1, "Stop feeding if coughing, cyanosis or distress occur."],
    ["The most serious complication of NG feeding is…", ["Nasal irritation", "Constipation", "Aspiration", "Tube blockage"], 2, "Most serious complication: aspiration."],
    ["Enteral (NG) feeding requires…", ["A functional GI tract", "A child over 2 years", "No prescription", "24 hours of fasting"], 0, "The GI tract should be functional for enteral feeding."]
  ],
  4: [
    ["Complementary feeding should begin at approximately…", ["2 months", "4 months", "6 months", "12 months"], 2, "At approximately 6 months of age."],
    ["Honey is avoided before 12 months because of…", ["Tooth decay", "Infant botulism", "Allergy", "Constipation"], 1, "Honey before 12 months → risk of infant botulism."],
    ["A child eating goes silent and cannot breathe or cough. This is…", ["Gagging", "Choking", "Normal swallowing", "Hiccups"], 1, "Choking may be silent; gagging is noisy and protective."],
    ["Cow’s milk should not be the main drink before…", ["3 months", "6 months", "9 months", "12 months"], 3, "Not as the main drink before 12 months."]
  ]
};
function quizSlide(part, reveal) {
  const title = reveal ? "Quick check: answers" : "Quick check: " + ["", "breastfeeding", "artificial feeding", "NG tube feeding", "weaning"][part];
  const s = content(part, title);
  QUIZ[part].forEach((q, qi) => {
    const col = qi % 2, row = Math.floor(qi / 2), x = 0.6 + col * 6.2, y = 1.65 + row * 2.62, w = 5.9;
    T(s, [{ text: "Q" + (qi + 1) + "  ", options: { color: PC[part], bold: true } }, { text: q[0], options: { bold: true } }], { x, y, w, h: 0.5, fontSize: 16 });
    q[1].forEach((o, oi) => {
      const ox = x + (oi % 2) * 2.98, oy = y + 0.6 + Math.floor(oi / 2) * 0.62, right = reveal && oi === q[2];
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ox, y: oy, w: 2.88, h: 0.52, rectRadius: 0.08, fill: right ? { color: OK, transparency: 82 } : { color: C.background1 }, line: { color: right ? OK : LINE, width: right ? 1.5 : 0.75 }, objectName: "Option" });
      T(s, [{ text: "ABCD"[oi] + "   ", options: { bold: true, color: right ? OK : MUTED } }, { text: o }], { x: ox + 0.14, y: oy, w: 2.66, h: 0.52, valign: "middle", fontSize: 14, color: C.text1 });
    });
    if (reveal) T(s, "✓ " + q[3], { x, y: y + 1.88, w, h: 0.5, fontSize: 14, italic: true, color: OK });
  });
  notes(s, "Quick check · Part " + part, reveal ? null : "Answers: " + QUIZ[part].map((q, i) => "Q" + (i + 1) + " " + "ABCD"[q[2]]).join(" · ") + " (shown on the next slide).");
  return s;
}

async function divider(part, chips, question) {
  const s = pres.addSlide({ masterName: "Section", sectionTitle: curSection });
  s.background = { color: DEEP[part] };
  T(s, "PART " + part + " OF 4", { x: 0.7, y: 1.0, w: 4, h: 0.35, fontSize: 14, bold: true, color: C.background1, charSpacing: 3 });
  T(s, "0" + part, { x: 0.62, y: 1.4, w: 4, h: 1.25, fontSize: 88, bold: true, color: C.background1, transparency: 65 });
  s.addText(PARTS[part], { placeholder: "title" });
  let x = 0.7, y = 4.35;
  chips.forEach((c) => {
    const w = 0.35 + c.length * 0.105;
    if (x + w > 7.9) { x = 0.7; y += 0.55; }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.42, rectRadius: 0.21, fill: { color: C.background1, transparency: 100 }, line: { color: C.background1, width: 0.75, transparency: 40 }, objectName: "Topic chip" });
    T(s, c, { x, y, w, h: 0.42, align: "center", valign: "middle", fontSize: 14, color: C.background1 });
    x += w + 0.15;
  });
  T(s, [{ text: "KEEP THIS QUESTION IN MIND\n", options: { fontSize: 11, bold: true, charSpacing: 2, transparency: 25 } }, { text: question, options: { fontSize: 20 } }], { x: 0.95, y: y + 0.85, w: 6.6, h: 1.0, color: C.background1 });
  s.addShape(pres.shapes.LINE, { x: 0.72, y: y + 0.88, w: 0, h: 0.92, line: { color: C.background1, width: 2.5, transparency: 40 }, objectName: "Quote rule" });
  await img(s, "dv" + part, 8.4, 1.3, 4.4, 4.8, "Line illustration for " + PARTS[part]);
  notes(s, "Part " + part + " · " + ({ 1: "Breastfeeding", 2: "Artificial feeding", 3: "NG tube feeding", 4: "Weaning" })[part]);
}

/* ================= Build ================= */
(async () => {
  /* ---------- Introduction ---------- */
  section("Introduction");
  {
    const s = pres.addSlide({ masterName: "Cover", sectionTitle: curSection });
    eyebrow(s, 0, "Pediatric Nursing");
    T(s, [{ text: "Infant & Child\n", options: { color: C.text1 } }, { text: "Feeding", options: { color: C.accent5 } }], { x: 0.6, y: 1.0, w: 6.6, h: 2.3, fontSize: 60, bold: true, valign: "middle" });
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + (i % 2) * 3.25, y = 3.75 + Math.floor(i / 2) * 0.95;
      card(s, x, y, 3.05, 0.78, { name: "Part card" });
      T(s, "0" + (i + 1), { x: x + 0.2, y, w: 0.7, h: 0.78, valign: "middle", fontSize: 26, bold: true, color: PC[i + 1] });
      T(s, PARTS[i + 1], { x: x + 0.9, y, w: 2.1, h: 0.78, valign: "middle", fontSize: 17, bold: true });
    }
    await img(s, "hero3d-t", 6.9, 0.7, 6.0, 6.0, "3D models: milk drop, feeding bottle, feeding tube and spoon");
    notes(s, "Infant & Child Feeding");
  }
  {
    const s = content(0, "By the end of this lesson you can…", "Lesson goals");
    const items = [
      [1, "drop", "Explain exclusive breastfeeding and colostrum, and teach breastfeeding technique."],
      [2, "bottle", "Teach safe formula preparation and bottle-feeding technique."],
      [3, "tube", "Carry out safe NG tube feeding and recognise its complications."],
      [4, "spoon", "Guide parents through weaning and complementary feeding."]
    ];
    for (let i = 0; i < 4; i++) {
      const [p, ic, t] = items[i], x = 0.6 + (i % 2) * 6.2, y = 1.9 + Math.floor(i / 2) * 2.2;
      card(s, x, y, 5.9, 1.9);
      await iconBubble(s, ic, HEX[p], p, x + 0.35, y + 0.5, 0.9);
      T(s, t, { x: x + 1.5, y: y + 0.25, w: 4.1, h: 1.4, valign: "middle", fontSize: 18 });
    }
    notes(s, "Learning outcomes");
  }
  const MF = [
    ["A baby under 6 months needs water or juice.", "MYTH", "With exclusive breastfeeding, no water, juice or other foods are routinely needed."],
    ["The thick yellow first milk should be thrown away.", "MYTH", "That is colostrum. It should not be discarded."],
    ["Most newborns breastfeed 8–12 times in 24 hours.", "FACT", "Feed on demand, according to hunger cues."],
    ["Crying is the first sign that a baby is hungry.", "MYTH", "Crying is a late hunger cue."],
    ["Formula left in the bottle after a feed is thrown away.", "FACT", "Discard leftover formula after feeding."],
    ["Gagging during weaning is usually noisy and protective.", "FACT", "Choking may be silent, with inability to breathe or cough effectively."]
  ];
  for (const reveal of [false, true]) {
    const s = content(0, reveal ? "Myth or fact? The answers" : "Myth or fact? Vote first", "Warm-up");
    MF.forEach((m, i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.75 + Math.floor(i / 3) * 2.6, myth = m[1] === "MYTH";
      card(s, x, y, 3.85, 2.35, reveal ? { fill: { color: myth ? BAD : OK, transparency: 90 }, line: { color: myth ? BAD : OK, width: 1.25 } } : {});
      T(s, m[0], { x: x + 0.25, y: y + 0.22, w: 3.35, h: 1.0, fontSize: 17, bold: true });
      if (reveal) {
        pill(s, x + 0.25, y + 1.25, 1.0, 0.36, m[1], { fill: { color: myth ? BAD : OK }, line: { type: "none" }, color: C.background1, bold: true, fontSize: 12 });
        T(s, m[2], { x: x + 0.25, y: y + 1.68, w: 3.35, h: 0.6, fontSize: 13, color: C.text1 });
      } else {
        T(s, "Myth or fact?", { x: x + 0.25, y: y + 1.75, w: 3.35, h: 0.35, fontSize: 13, italic: true, color: MUTED });
      }
    });
    notes(s, "Myth or fact?", reveal ? null : "Students vote, then show the next slide for the answers.");
  }

  /* ---------- Part 1 ---------- */
  section("Part 1 · Breastfeeding");
  await divider(1, ["Definition", "Benefits", "Colostrum", "Technique", "Effective feeding", "Frequency & burping"], "Why should colostrum never be discarded?");
  {
    const s = content(1, "What is breastfeeding?");
    T(s, [{ text: "Breastfeeding", options: { bold: true, color: C.accent1 } }, { text: " is feeding an infant with breast milk directly from the mother’s breast." }], { x: 0.6, y: 1.6, w: 12, h: 0.6, fontSize: 22 });
    card(s, 0.6, 2.5, 5.7, 4.1);
    T(s, "FIRST 6 MONTHS", { x: 0.9, y: 2.7, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
    T(s, "Exclusive breastfeeding", { x: 0.9, y: 3.0, w: 5, h: 0.45, fontSize: 22, bold: true });
    await iconBubble(s, "drop", HEX[1], 1, 0.9, 3.6, 0.85);
    T(s, "only", { x: 1.85, y: 3.6, w: 0.8, h: 0.85, valign: "middle", fontSize: 16, italic: true, color: MUTED });
    const no = ["glass", "juice", "bowl"];
    for (let i = 0; i < 3; i++) {
      const x = 3.7 + i * 0.75;
      s.addImage({ data: await iconData(no[i], MUTED), x, y: 3.75, w: 0.55, h: 0.55, altText: "No " + no[i] });
      s.addShape(pres.shapes.LINE, { x: x + 0.02, y: 3.77, w: 0.51, h: 0.51, line: { color: BAD, width: 2.5 }, objectName: "Cross-out" });
    }
    T(s, [
      { text: "Breast milk is the only food and drink.", options: { bullet: true, breakLine: true } },
      { text: "Recommended for the first 6 months of life.", options: { bullet: true, breakLine: true } },
      { text: "No water, juice or other foods are routinely needed.", options: { bullet: true } }
    ], { x: 0.9, y: 4.65, w: 5.2, h: 1.8, fontSize: 16, paraSpaceAfter: 6 });
    s.addShape(pres.shapes.RIGHT_ARROW, { x: 6.45, y: 4.2, w: 0.45, h: 0.45, fill: { color: C.accent1 }, line: { type: "none" }, objectName: "Arrow" });
    T(s, "6 months", { x: 6.25, y: 4.7, w: 0.85, h: 0.3, fontSize: 11, bold: true, align: "center", color: C.accent1 });
    card(s, 7.05, 2.5, 5.7, 4.1);
    T(s, "AFTER 6 MONTHS", { x: 7.35, y: 2.7, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent4, charSpacing: 2 });
    T(s, "Breastfeeding + complementary foods", { x: 7.35, y: 3.0, w: 5.2, h: 0.45, fontSize: 22, bold: true });
    await iconBubble(s, "drop", HEX[1], 1, 7.35, 3.6, 0.85);
    T(s, "+", { x: 8.3, y: 3.6, w: 0.5, h: 0.85, align: "center", valign: "middle", fontSize: 28, bold: true, color: MUTED });
    await iconBubble(s, "bowl", HEX[4], 4, 8.85, 3.6, 0.85);
    T(s, [
      { text: "Continue breastfeeding.", options: { bullet: true, breakLine: true } },
      { text: "Start complementary foods.", options: { bullet: true } }
    ], { x: 7.35, y: 4.65, w: 5.2, h: 1.2, fontSize: 16, paraSpaceAfter: 6 });
    notes(s, "What is breastfeeding?");
  }
  {
    const s = content(1, "Benefits of breastfeeding");
    card(s, 0.6, 1.6, 6.4, 5.2); card(s, 7.3, 1.6, 5.45, 5.2);
    T(s, "FOR THE INFANT", { x: 0.9, y: 1.8, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
    await iconRows(s, [["dropStar", "Provides ideal nutrition."], ["stomach", "Easily digested."], ["antibody", "Contains antibodies and immune factors."], ["shield", "Reduces respiratory and gastrointestinal infections."], ["growth", "Supports normal growth and development."], ["scale", "Reduces risk of childhood overweight and obesity."]], 1, 0.9, 2.2, 5.9, 0.75);
    T(s, "FOR THE MOTHER", { x: 7.6, y: 1.8, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
    await iconRows(s, [["contract", "Helps uterine contraction after delivery."], ["dropDown", "May reduce postpartum bleeding."], ["heart", "Promotes mother–infant bonding."], ["coin", "Convenient and economical."]], 1, 7.6, 2.2, 4.95, 0.75);
    notes(s, "Benefits of breastfeeding");
  }
  {
    const s = content(1, "Colostrum");
    T(s, [{ text: "Colostrum", options: { bold: true, color: C.accent1 } }, { text: " is the thick, yellowish milk produced during the first few days after birth." }], { x: 0.6, y: 1.6, w: 6.7, h: 0.9, fontSize: 20 });
    await iconRows(s, [["antibody", "Rich in antibodies, especially IgA."], ["microbe", "Rich in proteins and immune cells."], ["stomach", "Easy to digest."], ["shield", "Provides protection against infection."], ["gut", "Helps establish the infant’s gastrointestinal tract."]], 1, 0.6, 2.55, 6.7, 0.65);
    card(s, 0.6, 5.95, 6.7, 0.8, { fill: { color: BAD, transparency: 90 }, line: { color: BAD, width: 1 }, shadow: false });
    s.addImage({ data: await iconData("ban", BAD), x: 0.85, y: 6.1, w: 0.5, h: 0.5, altText: "Do not" });
    T(s, [{ text: "IMPORTANT  ", options: { bold: true, color: BAD, fontSize: 12, charSpacing: 2 } }, { text: "Colostrum should not be discarded.", options: { bold: true } }], { x: 1.55, y: 5.95, w: 5.6, h: 0.8, valign: "middle", fontSize: 18 });
    await img(s, "colostrum", 7.6, 1.5, 5.2, 5.3, "Golden drop of colostrum labelled IgA, surrounded by antibodies");
    notes(s, "Colostrum");
  }
  {
    const s = content(1, "Breastfeeding technique");
    T(s, "The nurse should teach the mother:", { x: 0.6, y: 1.5, w: 7, h: 0.4, fontSize: 16, color: MUTED });
    const steps = ["Wash hands.", "Choose a comfortable position.", "Keep the baby’s head and body in a straight line.", "Keep the baby close to the mother.", "Baby’s mouth should open widely.", "Baby should take the nipple and much of the areola into the mouth.", "Observe effective sucking and swallowing.", "Allow the baby to finish one breast before offering the other."];
    steps.forEach((t, i) => {
      const y = 2.0 + i * 0.52;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.05, w: 0.38, h: 0.38, fill: tint(1, 85), line: { type: "none" }, objectName: "Step number" });
      T(s, String(i + 1), { x: 0.6, y: y + 0.05, w: 0.38, h: 0.38, align: "center", valign: "middle", fontSize: 13, bold: true, color: C.accent1 });
      T(s, t, { x: 1.15, y, w: 6.4, h: 0.48, valign: "middle", fontSize: 15 });
    });
    await img(s, "latch-good", 8.6, 1.45, 3.4, 2.5, "Good latch: nipple and much of the areola in the mouth");
    await img(s, "align-ok", 7.9, 4.1, 2.35, 1.4, "Head and body in a straight line");
    await img(s, "align-bad", 10.45, 4.1, 2.35, 1.4, "Head twisted away from the body");
    T(s, "Straight line ✓", { x: 7.9, y: 5.5, w: 2.35, h: 0.3, fontSize: 13, bold: true, align: "center", color: OK });
    T(s, "Head twisted ✕", { x: 10.45, y: 5.5, w: 2.35, h: 0.3, fontSize: 13, bold: true, align: "center", color: BAD });
    card(s, 0.6, 6.25, 12.15, 0.65, { fill: { color: OK, transparency: 90 }, line: { color: OK, width: 1 }, shadow: false });
    T(s, "✓  Good latch → less nipple pain + effective milk transfer.", { x: 0.85, y: 6.25, w: 11.7, h: 0.65, valign: "middle", fontSize: 18, bold: true });
    notes(s, "Breastfeeding technique");
  }
  {
    const s = content(1, "Signs of effective breastfeeding");
    card(s, 0.6, 1.6, 6.3, 5.25);
    T(s, "THE NURSE SHOULD OBSERVE", { x: 0.9, y: 1.8, w: 5.5, h: 0.3, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 });
    const signs = ["Baby has a wide-open mouth.", "Chin touches the breast.", "More areola visible above the baby’s mouth than below.", "Slow, deep sucking.", "Audible swallowing.", "Baby appears satisfied after feeding.", "Adequate urine output and weight gain."];
    for (let i = 0; i < signs.length; i++) {
      const y = 2.2 + i * 0.64;
      s.addImage({ data: await iconData("check", OK), x: 0.9, y: y + 0.12, w: 0.36, h: 0.36, altText: "check" });
      T(s, signs[i], { x: 1.45, y, w: 5.25, h: 0.6, valign: "middle", fontSize: 15 });
    }
    await img(s, "latch-good", 7.2, 1.55, 2.7, 2.6, "Good latch");
    await img(s, "latch-poor", 10.05, 1.55, 2.7, 2.6, "Poor latch");
    T(s, "Good latch ✓", { x: 7.2, y: 4.15, w: 2.7, h: 0.35, fontSize: 15, bold: true, align: "center", color: OK });
    T(s, "Poor latch ✕", { x: 10.05, y: 4.15, w: 2.7, h: 0.35, fontSize: 15, bold: true, align: "center", color: BAD });
    T(s, "Poor latch may cause", { x: 7.2, y: 4.75, w: 5.5, h: 0.4, fontSize: 18, bold: true });
    ["Nipple pain", "Cracked nipples", "Poor milk transfer", "Inadequate infant weight gain"].forEach((t, i) => {
      const x = 7.2 + (i % 2) * 2.8, y = 5.25 + Math.floor(i / 2) * 0.62;
      pill(s, x, y, 2.65, 0.48, t, { fill: { color: BAD, transparency: 90 }, line: { color: BAD, width: 0.75, transparency: 50 }, fontSize: 13 });
    });
    notes(s, "Signs of effective breastfeeding");
  }
  {
    const s = content(1, "Breastfeeding frequency & burping");
    await img(s, "dial", 0.5, 1.5, 2.9, 2.9, "24-hour clock showing about ten feeds through day and night");
    T(s, [
      { text: "Feed the newborn on demand, according to hunger cues.", options: { bullet: true, breakLine: true } },
      { text: "Most newborns breastfeed approximately 8–12 times / 24 hours.", options: { bullet: true, breakLine: true } },
      { text: "Avoid rigid feeding schedules in the early neonatal period.", options: { bullet: true } }
    ], { x: 3.6, y: 1.75, w: 4.9, h: 2.5, fontSize: 16, paraSpaceAfter: 8, valign: "middle" });
    await img(s, "burp", 8.7, 1.6, 1.5, 2.2, "Baby held upright for burping");
    T(s, [{ text: "After feeding\n", options: { bold: true, fontSize: 18 } }, { text: "Hold the baby upright. Burping may be helpful, especially if the baby swallowed air." }], { x: 10.3, y: 1.7, w: 2.45, h: 2.4, fontSize: 14 });
    T(s, "Hunger cues", { x: 0.6, y: 4.45, w: 6, h: 0.4, fontSize: 18, bold: true });
    const cues = ["Rooting", "Hand-to-mouth", "Lip smacking", "Restlessness", "Crying"];
    for (let i = 0; i < 5; i++) {
      const x = 0.6 + i * 2.45, late = i === 4;
      card(s, x, 4.95, 2.25, 1.9, late ? { fill: { color: BAD, transparency: 92 }, line: { color: BAD, width: 1 } } : {});
      await img(s, "baby" + (i + 1), x + 0.45, 5.0, 1.35, 1.2, "Baby showing " + cues[i]);
      T(s, cues[i] + (late ? "  · late cue" : ""), { x, y: 6.25, w: 2.25, h: 0.45, align: "center", fontSize: 14, bold: true, color: late ? BAD : C.text1 });
    }
    notes(s, "Breastfeeding frequency & burping");
  }
  quizSlide(1, false); quizSlide(1, true);

  /* ---------- Part 2 ---------- */
  section("Part 2 · Artificial Feeding");
  await divider(2, ["Definition", "Types of formula", "Safe preparation", "Bottle technique", "Complications"], "What happens if formula is prepared incorrectly?");
  {
    const s = content(2, "Artificial feeding");
    T(s, [{ text: "Artificial feeding", options: { bold: true, color: C.accent2 } }, { text: " means feeding an infant with infant formula instead of breast milk, either partially or completely." }], { x: 0.6, y: 1.6, w: 12, h: 0.9, fontSize: 20 });
    T(s, "It may be used when:", { x: 0.6, y: 2.6, w: 6, h: 0.4, fontSize: 18, bold: true });
    const it = [["ban", "Breastfeeding is contraindicated."], ["dropEmpty", "Breast milk is unavailable or insufficient."], ["choice", "The mother chooses formula feeding."], ["medical", "Certain medical conditions require alternative feeding."]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.06;
      card(s, x, 3.15, 2.85, 2.1);
      await iconBubble(s, it[i][0], HEX[2], 2, x + 0.25, 3.35, 0.75);
      T(s, it[i][1], { x: x + 0.25, y: 4.2, w: 2.4, h: 0.95, fontSize: 15 });
    }
    card(s, 0.6, 5.65, 12.15, 0.95, { fill: tint(1, 90), line: { color: C.accent1, width: 1, transparency: 50 }, shadow: false });
    s.addImage({ data: await iconData("drop", HEX[1]), x: 0.85, y: 5.82, w: 0.6, h: 0.6, altText: "Breast milk" });
    T(s, [{ text: "IMPORTANT  ", options: { bold: true, color: C.accent1, fontSize: 12, charSpacing: 2 } }, { text: "Breast milk is preferred whenever it is safe and available.", options: { bold: true } }], { x: 1.65, y: 5.65, w: 10.9, h: 0.95, valign: "middle", fontSize: 18 });
    notes(s, "Artificial feeding");
  }
  {
    const s = content(2, "Types of infant formula");
    const tins = [["Standard cow’s-milk-based", "Suitable for most healthy term infants."], ["Preterm formula", "Designed for premature infants according to medical advice."], ["Specialised formulas", "For conditions such as:\n• Cow’s milk protein allergy\n• Certain metabolic disorders\n• Malabsorption"]];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.6, 3.85, 4.3);
      await img(s, "tin" + (i + 1), x + 1.0, 1.75, 1.85, 2.1, "Formula tin");
      T(s, (i + 1) + " · " + tins[i][0], { x: x + 0.25, y: 3.9, w: 3.35, h: 0.75, fontSize: 18, bold: true, color: C.accent2 });
      T(s, tins[i][1], { x: x + 0.25, y: 4.7, w: 3.35, h: 1.15, fontSize: 15 });
    }
    card(s, 0.6, 6.15, 12.15, 0.7, { fill: tint(2, 90), line: { color: C.accent2, width: 1, transparency: 50 }, shadow: false });
    T(s, "Formula should be selected according to the infant’s needs and healthcare advice.", { x: 0.85, y: 6.15, w: 11.7, h: 0.7, valign: "middle", fontSize: 17, bold: true });
    notes(s, "Types of infant formula");
  }
  {
    const s = content(2, "Safe formula preparation");
    T(s, "The nurse should teach the caregiver:", { x: 0.6, y: 1.45, w: 7, h: 0.4, fontSize: 16, color: MUTED });
    const st = [["soap", "Wash hands."], ["bottle", "Clean feeding equipment."], ["tap", "Use safe drinking water."], ["label", "Follow the manufacturer’s exact water-to-powder ratio."], ["scoop", "Measure water and formula accurately."], ["noPlus", "Do not add extra powder."], ["noDilute", "Do not dilute formula excessively."], ["fridge", "Prepare feeds safely and store them according to instructions."], ["bin", "Discard leftover formula after feeding."]];
    for (let i = 0; i < 9; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 1.95 + Math.floor(i / 3) * 1.38, no = i === 5 || i === 6;
      card(s, x, y, 3.85, 1.2);
      await iconBubble(s, st[i][0], no ? BAD : HEX[2], 2, x + 0.2, y + 0.25, 0.7);
      T(s, st[i][1], { x: x + 1.1, y: y + 0.08, w: 2.5, h: 1.04, valign: "middle", fontSize: 15 });
      T(s, String(i + 1), { x: x + 3.45, y: y + 0.1, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: MUTED, align: "right" });
    }
    card(s, 0.6, 6.2, 12.15, 0.65, { fill: { color: BAD, transparency: 90 }, line: { color: BAD, width: 1 }, shadow: false });
    T(s, "Incorrect dilution can cause serious complications.", { x: 0.85, y: 6.2, w: 11.7, h: 0.65, valign: "middle", fontSize: 18, bold: true, color: BAD });
    notes(s, "Safe formula preparation");
  }
  {
    const s = content(2, "Bottle-feeding technique");
    card(s, 0.6, 1.6, 6.0, 3.15);
    T(s, "Do", { x: 0.9, y: 1.75, w: 3, h: 0.45, fontSize: 20, bold: true, color: OK });
    T(s, ["Hold the infant in a semi-upright position.", "Support the baby’s head and neck.", "Keep the bottle tilted so the nipple remains filled with milk.", "Allow the baby to pause during feeding.", "Burp the baby when appropriate."].map((t, i, a) => ({ text: "✓  " + t, options: { breakLine: i < a.length - 1 } })), { x: 0.9, y: 2.25, w: 5.5, h: 2.4, fontSize: 15, paraSpaceAfter: 5 });
    card(s, 0.6, 4.95, 6.0, 1.9, { line: { color: BAD, width: 1, transparency: 40 } });
    T(s, "Never", { x: 0.9, y: 5.08, w: 3, h: 0.45, fontSize: 20, bold: true, color: BAD });
    T(s, ["Force the infant to finish the bottle.", "Prop the bottle and leave the infant alone.", "Feed an infant while lying completely flat."].map((t, i, a) => ({ text: "✕  " + t, options: { breakLine: i < a.length - 1 } })), { x: 0.9, y: 5.55, w: 5.5, h: 1.25, fontSize: 15, paraSpaceAfter: 4 });
    await img(s, "bottle-ok-t", 6.85, 1.6, 2.95, 4.3, "3D model: correct tilt, nipple filled with milk");
    T(s, "Correct tilt:\nnipple filled with milk ✓", { x: 6.85, y: 6.0, w: 2.95, h: 0.75, fontSize: 15, bold: true, align: "center", color: OK });
    await img(s, "bottle-flat-t", 9.85, 1.6, 2.95, 4.3, "3D model: bottle too flat, air in the nipple");
    T(s, "Too flat:\nair in the nipple ✕", { x: 9.85, y: 6.0, w: 2.95, h: 0.75, fontSize: 15, bold: true, align: "center", color: BAD });
    notes(s, "Bottle-feeding technique", "The two pictures come from the interactive 3D model in the HTML version of this lesson.");
  }
  {
    const s = content(2, "Complications of artificial feeding");
    const it = [["bottlePlus", "Overfeeding."], ["upflow", "Vomiting or regurgitation."], ["gut", "Diarrhoea."], ["gutBlock", "Constipation."], ["stomachX", "Feeding intolerance."], ["microbe", "Infection from contaminated bottles or formula."], ["dropAlert", "Incorrect formula preparation → dehydration or electrolyte disturbances."], ["tooth", "Increased risk of dental caries with inappropriate prolonged bottle use."]];
    for (let i = 0; i < 8; i++) {
      const x = 0.6 + (i % 4) * 3.06, y = 1.65 + Math.floor(i / 4) * 2.65, bad = i === 6;
      card(s, x, y, 2.85, 2.4, bad ? { fill: { color: BAD, transparency: 92 }, line: { color: BAD, width: 1 } } : {});
      await iconBubble(s, it[i][0], bad ? BAD : HEX[2], 2, x + 0.25, y + 0.25, 0.75);
      T(s, it[i][1], { x: x + 0.25, y: y + 1.1, w: 2.4, h: 1.2, fontSize: 15, bold: bad });
    }
    notes(s, "Complications of artificial feeding");
  }
  quizSlide(2, false); quizSlide(2, true);

  /* ---------- Part 3 ---------- */
  section("Part 3 · NG Tube Feeding");
  await divider(3, ["Definition", "Indications", "Before feeding", "Procedure", "Complications"], "What must be checked before every NG feed?");
  {
    const s = content(3, "NG tube feeding");
    T(s, [{ text: "Nasogastric (NG) feeding", options: { bold: true, color: C.accent3 } }, { text: " is the administration of nutrition, fluids or medication through a tube inserted through the nose into the stomach." }], { x: 0.6, y: 1.6, w: 6.4, h: 1.25, fontSize: 19 });
    T(s, "It may be used when the infant / child:", { x: 0.6, y: 2.95, w: 6.4, h: 0.4, fontSize: 17, bold: true });
    T(s, ["Cannot feed safely by mouth.", "Has inadequate oral intake.", "Has impaired swallowing.", "Has certain neurological or medical conditions.", "Requires temporary enteral nutrition."].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: 0.6, y: 3.4, w: 6.4, h: 2.2, fontSize: 16, paraSpaceAfter: 5 });
    card(s, 0.6, 5.75, 6.4, 1.05, { fill: { color: BAD, transparency: 90 }, line: { color: BAD, width: 1 }, shadow: false });
    T(s, "NG feeding requires trained healthcare personnel and appropriate tube-placement verification.", { x: 0.85, y: 5.75, w: 6.0, h: 1.05, valign: "middle", fontSize: 15, bold: true });
    await img(s, "ng3d-t", 7.4, 1.45, 5.3, 5.4, "3D model: tube passes from the nose through the oesophagus into the stomach");
    notes(s, "NG tube feeding", "The picture comes from the interactive 3D model in the HTML version (with the tube insertion animation).");
  }
  {
    const s = content(3, "Indications for NG feeding");
    T(s, "NG feeding may be indicated in:", { x: 0.6, y: 1.45, w: 7, h: 0.4, fontSize: 16, color: MUTED });
    const it = [["baby", "Premature or medically unstable infants with inadequate oral feeding."], ["brain", "Neurological disorders affecting swallowing."], ["zzz", "Reduced level of consciousness when enteral feeding is appropriate."], ["battery", "Severe weakness or fatigue during oral feeding."], ["bowlDown", "Conditions causing inadequate oral intake."]];
    for (let i = 0; i < 5; i++) {
      const x = 0.6 + i * 2.46;
      card(s, x, 2.0, 2.3, 3.3);
      await iconBubble(s, it[i][0], HEX[3], 3, x + 0.25, 2.2, 0.8);
      T(s, it[i][1], { x: x + 0.22, y: 3.15, w: 1.9, h: 2.05, fontSize: 15 });
    }
    card(s, 0.6, 5.65, 12.15, 0.95, { fill: tint(3, 90), line: { color: C.accent3, width: 1, transparency: 50 }, shadow: false });
    s.addImage({ data: await iconData("gut", HEX[3]), x: 0.85, y: 5.8, w: 0.65, h: 0.65, altText: "Gut" });
    T(s, "The gastrointestinal tract should be functional for enteral feeding.", { x: 1.7, y: 5.65, w: 10.9, h: 0.95, valign: "middle", fontSize: 18, bold: true });
    notes(s, "Indications for NG feeding");
  }
  {
    const s = content(3, "Before NG feeding");
    T(s, "The nurse should:", { x: 0.6, y: 1.45, w: 7, h: 0.4, fontSize: 16, color: MUTED });
    const chk = ["Verify the feeding prescription.", "Check the patient’s identity.", "Assess the infant’s condition.", "Check tube position using the approved institutional method.", "Assess abdominal status and feeding tolerance.", "Check the prescribed formula, amount and rate.", "Perform hand hygiene."];
    chk.forEach((t, i) => {
      const y = 1.95 + i * 0.68;
      card(s, 0.6, y, 7.2, 0.58, { shadow: false });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8, y: y + 0.15, w: 0.28, h: 0.28, rectRadius: 0.05, fill: { color: C.background1 }, line: { color: C.accent3, width: 1.5 }, objectName: "Checkbox" });
      T(s, t, { x: 1.3, y, w: 6.4, h: 0.58, valign: "middle", fontSize: 15 });
    });
    card(s, 8.2, 1.95, 4.55, 4.6, { fill: { color: BAD, transparency: 92 }, line: { color: BAD, width: 1.5 } });
    s.addImage({ data: await iconData("tube", BAD), x: 9.75, y: 2.4, w: 1.45, h: 1.45, altText: "Feeding tube" });
    T(s, "Never administer a feed if tube placement is uncertain.", { x: 8.5, y: 4.1, w: 3.95, h: 1.8, align: "center", valign: "middle", fontSize: 22, bold: true, color: BAD });
    notes(s, "Before NG feeding", "Ask a student to read each check aloud and tick it on the board.");
  }
  {
    const s = content(3, "NG feeding procedure");
    const st = ["Perform hand hygiene.", "Position the infant safely, usually semi-upright.", "Verify NG tube placement according to protocol.", "Check the prescribed feed.", "Administer the feed at the prescribed rate.", "Observe the infant throughout feeding.", "Stop feeding if concerning signs occur (see below).", "Flush the tube only according to the prescribed / appropriate protocol.", "Keep the infant appropriately positioned after feeding.", "Document the feeding and the infant’s response."];
    st.forEach((t, i) => {
      const col = Math.floor(i / 5), x = 0.6 + col * 6.2, y = 1.55 + (i % 5) * 0.7;
      s.addShape(pres.shapes.OVAL, { x, y: y + 0.08, w: 0.44, h: 0.44, fill: { color: C.background1 }, line: { color: C.accent3, width: 1.75 }, objectName: "Step number" });
      T(s, String(i + 1), { x, y: y + 0.08, w: 0.44, h: 0.44, align: "center", valign: "middle", fontSize: 13, bold: true, color: C.accent3 });
      T(s, t, { x: x + 0.6, y, w: 5.4, h: 0.6, valign: "middle", fontSize: 15 });
    });
    card(s, 0.6, 5.2, 12.15, 1.65, { fill: { color: BAD, transparency: 92 }, line: { color: BAD, width: 1.5 } });
    s.addShape(pres.shapes.OCTAGON, { x: 0.85, y: 5.45, w: 1.15, h: 1.15, fill: { color: BAD }, line: { type: "none" }, objectName: "Stop sign" });
    T(s, "STOP", { x: 0.85, y: 5.45, w: 1.15, h: 1.15, align: "center", valign: "middle", fontSize: 18, bold: true, color: C.background1 });
    T(s, "Stop feeding if significant respiratory distress, vomiting, coughing, cyanosis or other concerning signs occur.", { x: 2.25, y: 5.3, w: 10.3, h: 0.6, valign: "middle", fontSize: 16, bold: true });
    const sg = [["lungs", "Respiratory distress", BAD], ["upflow", "Vomiting", BAD], ["cough", "Coughing", BAD], ["blueface", "Cyanosis", "3F7FD9"]];
    for (let i = 0; i < 4; i++) {
      const x = 2.25 + i * 2.6;
      s.addImage({ data: await iconData(sg[i][0], sg[i][2]), x, y: 6.0, w: 0.6, h: 0.6, altText: sg[i][1] });
      T(s, sg[i][1], { x: x + 0.7, y: 6.0, w: 1.85, h: 0.6, valign: "middle", fontSize: 14 });
    }
    notes(s, "NG feeding procedure");
  }
  {
    const s = content(3, "Complications of NG feeding");
    const g = [["lungs", "RESPIRATORY", "Aspiration · Coughing · Respiratory distress · Cyanosis"], ["stomach", "GASTROINTESTINAL", "Vomiting · Abdominal distension · Diarrhoea · Constipation · Feeding intolerance"], ["tube", "TUBE-RELATED", "Nasal irritation · Pressure injury · Tube displacement or blockage"]];
    for (let i = 0; i < 3; i++) {
      const y = 1.65 + i * 1.7;
      card(s, 0.6, y, 6.9, 1.5);
      await iconBubble(s, g[i][0], HEX[3], 3, 0.85, y + 0.32, 0.85);
      T(s, g[i][1], { x: 1.95, y: y + 0.18, w: 5.3, h: 0.3, fontSize: 12, bold: true, color: C.accent3, charSpacing: 2 });
      T(s, g[i][2], { x: 1.95, y: y + 0.5, w: 5.35, h: 0.9, fontSize: 15 });
    }
    await img(s, "aspiration", 7.8, 1.5, 4.95, 4.1, "Feed goes down the oesophagus to the stomach; in aspiration it goes down the airway to the lungs");
    card(s, 7.8, 5.75, 4.95, 1.05, { fill: { color: BAD, transparency: 90 }, line: { color: BAD, width: 1 }, shadow: false });
    T(s, [{ text: "MOST SERIOUS COMPLICATION\n", options: { fontSize: 12, bold: true, color: BAD, charSpacing: 2 } }, { text: "Aspiration", options: { fontSize: 22, bold: true } }], { x: 8.05, y: 5.75, w: 4.5, h: 1.05, valign: "middle" });
    notes(s, "Complications of NG feeding");
  }
  quizSlide(3, false); quizSlide(3, true);

  /* ---------- Part 4 ---------- */
  section("Part 4 · Weaning");
  await divider(4, ["Complementary feeding", "Principles", "Foods", "Foods to avoid", "Feeding safety"], "Why do complementary foods start at about 6 months?");
  {
    const s = content(4, "Weaning / complementary feeding");
    T(s, [{ text: "Weaning", options: { bold: true, color: C.accent4 } }, { text: " in this context means introducing complementary foods while continuing breastfeeding. It should begin at approximately 6 months of age." }], { x: 0.6, y: 1.6, w: 12, h: 0.9, fontSize: 20 });
    card(s, 0.6, 2.75, 6.6, 3.9);
    T(s, "WHY?", { x: 0.9, y: 2.95, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent4, charSpacing: 2 });
    await iconRows(s, [["puzzle", "Breast milk alone no longer provides all nutritional requirements."], ["bolt", "The infant needs additional energy and nutrients."], ["chew", "It supports development of chewing and swallowing skills."]], 4, 0.9, 3.35, 6.1, 1.05, { icon: 0.65 });
    await iconBubble(s, "drop", HEX[1], 1, 7.9, 3.0, 1.2);
    s.addShape(pres.shapes.OVAL, { x: 9.5, y: 2.85, w: 1.5, h: 1.5, fill: { color: C.accent4 }, line: { type: "none" }, objectName: "6 months badge" });
    T(s, [{ text: "6\n", options: { fontSize: 36, bold: true } }, { text: "MONTHS", options: { fontSize: 11, bold: true, charSpacing: 2 } }], { x: 9.5, y: 2.85, w: 1.5, h: 1.5, align: "center", valign: "middle", color: C.background1 });
    await iconBubble(s, "bowl", HEX[4], 4, 11.3, 3.0, 1.2);
    card(s, 7.6, 4.95, 5.15, 1.7, { fill: { color: OK, transparency: 90 }, line: { color: OK, width: 1 }, shadow: false });
    T(s, "Breastfeeding should continue alongside complementary feeding.", { x: 7.85, y: 4.95, w: 4.7, h: 1.7, valign: "middle", fontSize: 18, bold: true });
    notes(s, "Weaning / complementary feeding");
  }
  {
    const s = content(4, "Principles of weaning");
    T(s, "When introducing complementary foods:", { x: 0.6, y: 1.45, w: 7, h: 0.4, fontSize: 16, color: MUTED });
    const it = [["cal6", "Start around 6 months."], ["spoon", "Begin with small amounts."], ["stairs", "Introduce foods gradually."], ["layers", "Increase variety and texture as the child develops."], ["drop", "Continue breastfeeding."], ["leaf", "Use nutrient-rich foods."], ["heart", "Encourage responsive feeding."], ["soap", "Maintain good hygiene."], ["handStop", "Do not force the child to eat."]];
    for (let i = 0; i < 9; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 2.0 + Math.floor(i / 3) * 1.6, warn = i === 8;
      card(s, x, y, 3.85, 1.4, warn ? { line: { color: BAD, width: 1 } } : {});
      await iconBubble(s, it[i][0], warn ? BAD : (i === 4 ? HEX[1] : HEX[4]), warn ? 0 : 4, x + 0.22, y + 0.3, 0.8);
      T(s, it[i][1], { x: x + 1.2, y: y + 0.1, w: 2.45, h: 1.2, valign: "middle", fontSize: 16, bold: true, color: warn ? BAD : C.text1 });
    }
    notes(s, "Principles of weaning");
  }
  {
    const s = content(4, "Foods during weaning");
    T(s, "Offer a variety of:", { x: 0.6, y: 1.45, w: 7, h: 0.4, fontSize: 16, color: MUTED });
    const f = [["grains", "Cereals & grains"], ["carrot", "Vegetables"], ["fruit", "Fruits"], ["egg", "Eggs"], ["meat", "Meat, chicken & fish"], ["legumes", "Legumes"], ["dairy", "Dairy foods appropriate for age"], ["oil", "Healthy fats / oils"]];
    for (let i = 0; i < 8; i++) {
      const x = 0.6 + (i % 4) * 3.06, y = 2.0 + Math.floor(i / 4) * 2.0;
      card(s, x, y, 2.85, 1.8);
      s.addImage({ data: await artData(f[i][0]), x: x + 0.15, y: y + 0.4, w: 1.0, h: 1.0, altText: f[i][1] });
      T(s, f[i][1], { x: x + 1.25, y: y + 0.1, w: 1.5, h: 1.6, valign: "middle", fontSize: 15, bold: true });
    }
    T(s, "CHOOSE FOODS RICH IN", { x: 0.6, y: 6.25, w: 2.7, h: 0.5, valign: "middle", fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
    ["Iron", "Protein", "Energy", "Vitamins & minerals"].forEach((t, i) => {
      const w = [1.0, 1.3, 1.25, 2.35][i], x = [3.3, 4.45, 5.9, 7.3][i];
      pill(s, x, 6.27, w, 0.46, t, { fill: tint(4, 88), line: { color: C.accent4, width: 0.75, transparency: 50 }, bold: true, fontSize: 14 });
    });
    notes(s, "Foods during weaning");
  }
  {
    const s = content(4, "Foods to avoid");
    const f = [["honey", "Honey before 12 months", "Risk of infant botulism"], ["nuts", "Whole nuts", "Choking risk"], ["grapes", "Whole grapes", "Choking hazard unless prepared safely"], ["salt", "Excessive salt or added sugar", "Avoid"], ["raw", "Unpasteurised milk / products", "Avoid"], ["dirty", "Unsafe or contaminated foods", "Avoid"]];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.1, y = 1.65 + Math.floor(i / 3) * 1.95;
      card(s, x, y, 3.85, 1.75);
      s.addImage({ data: await artData(f[i][0]), x: x + 0.25, y: y + 0.3, w: 1.15, h: 1.15, altText: f[i][1] });
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.25, w: 1.25, h: 1.25, fill: { type: "none" }, line: { color: BAD, width: 4 }, objectName: "No sign" });
      s.addShape(pres.shapes.LINE, { x: x + 0.38, y: y + 0.43, w: 0.89, h: 0.89, line: { color: BAD, width: 4 }, objectName: "No sign slash" });
      T(s, [{ text: f[i][1] + "\n", options: { bold: true, fontSize: 16 } }, { text: f[i][2], options: { bold: true, fontSize: 14, color: BAD } }], { x: x + 1.6, y: y + 0.1, w: 2.1, h: 1.55, valign: "middle" });
    }
    card(s, 0.6, 5.65, 12.15, 1.15, { fill: { color: BAD, transparency: 90 }, line: { color: BAD, width: 1 }, shadow: false });
    s.addImage({ data: await artData("cowmilk"), x: 0.8, y: 5.75, w: 0.95, h: 0.95, altText: "Glass of cow’s milk" });
    T(s, "Cow’s milk should not be used as the main drink before 12 months.", { x: 1.95, y: 5.65, w: 10.6, h: 1.15, valign: "middle", fontSize: 19, bold: true });
    notes(s, "Foods to avoid");
  }
  {
    const s = content(4, "Feeding safety: choking ≠ gagging");
    card(s, 0.6, 1.6, 5.9, 5.25);
    T(s, "THE CHILD SHOULD", { x: 0.9, y: 1.8, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent4, charSpacing: 2 });
    await iconRows(s, [["chair", "Sit upright during feeding."], ["eye", "Be supervised while eating."], ["bowl", "Eat appropriate textures."], ["knife", "Have food cut or mashed appropriately."]], 4, 0.9, 2.2, 5.4, 0.9, { icon: 0.65 });
    await iconBubble(s, "aloneX", BAD, 0, 0.9, 5.95, 0.65);
    T(s, "Never be left alone while eating.", { x: 1.75, y: 5.85, w: 4.55, h: 0.82, valign: "middle", fontSize: 16, bold: true, color: BAD });
    card(s, 6.8, 1.6, 2.85, 5.25);
    await img(s, "gag", 7.0, 1.75, 2.45, 3.1, "Gagging: airway open, air moving, noisy");
    T(s, [{ text: "Gagging\n", options: { bold: true, fontSize: 22, color: "A1630A" } }, { text: "Usually noisy and protective.", options: { fontSize: 15 } }], { x: 7.0, y: 5.0, w: 2.45, h: 1.7, align: "center" });
    card(s, 9.9, 1.6, 2.85, 5.25, { fill: { color: BAD, transparency: 94 }, line: { color: BAD, width: 1 } });
    await img(s, "choke", 10.1, 1.75, 2.45, 3.1, "Choking: food blocks the airway, may be silent");
    T(s, [{ text: "Choking\n", options: { bold: true, fontSize: 22, color: BAD } }, { text: "May be silent, with inability to breathe or cough effectively.", options: { fontSize: 15 } }], { x: 10.1, y: 5.0, w: 2.45, h: 1.7, align: "center" });
    notes(s, "Feeding safety during weaning");
  }
  quizSlide(4, false); quizSlide(4, true);

  /* ---------- Review ---------- */
  section("Review");
  {
    const s = content(0, "Role of the nurse", "Review");
    const L = [[0, "Assess nutritional status and growth."], [1, "Educate parents about breastfeeding."], [2, "Teach safe formula preparation."], [2, "Teach safe bottle feeding."], [3, "Ensure safe NG feeding."]];
    const R = [[0, "Monitor feeding tolerance."], [3, "Identify signs of aspiration."], [0, "Monitor weight and development."], [4, "Educate caregivers about complementary feeding."], [4, "Promote hygiene and food safety."]];
    const cx = 6.667, cy = 4.25;
    [[L, 0.6], [R, 8.25]].forEach(([arr, x]) => arr.forEach(([p, t], i) => {
      const y = 1.85 + i * 0.95;
      const lx = x === 0.6 ? x + 4.5 : x, ex = x === 0.6 ? cx - 1.15 : cx + 1.15;
      s.addShape(pres.shapes.LINE, { x: Math.min(lx, ex), y: Math.min(y + 0.38, cy), w: Math.abs(ex - lx), h: Math.abs(cy - (y + 0.38)), flipV: (x === 0.6) !== (y + 0.38 > cy), line: { color: C.accent5, width: 1.25, transparency: 50 }, objectName: "Connector" });
      card(s, x, y, 4.5, 0.76, { shadow: false });
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.29, w: 0.18, h: 0.18, fill: { color: PC[p] }, line: { type: "none" }, objectName: "Part dot" });
      T(s, t, { x: x + 0.5, y, w: 3.9, h: 0.76, valign: "middle", fontSize: 15 });
    }));
    s.addShape(pres.shapes.OVAL, { x: cx - 1.15, y: cy - 1.15, w: 2.3, h: 2.3, fill: { color: C.accent5 }, line: { color: C.accent5, width: 8, transparency: 75 }, objectName: "Nurse hub" });
    s.addImage({ data: await iconData("nurse", "FFFFFF"), x: cx - 0.4, y: cy - 0.85, w: 0.8, h: 0.8, altText: "Nurse" });
    T(s, "The nurse", { x: cx - 1.1, y: cy + 0.05, w: 2.2, h: 0.5, align: "center", fontSize: 18, bold: true, color: C.background1 });
    notes(s, "Role of the nurse");
  }
  const CASES = [
    [1, "Breastfeeding", "A mother has painful, cracked nipples. The baby takes only the nipple into the mouth.", "What is the problem? What will you teach?", "Poor latch.", "Comfortable position · head and body in a straight line · baby close · wide-open mouth · nipple and much of the areola · observe sucking and swallowing."],
    [2, "Artificial feeding", "A father adds an extra scoop of powder to every bottle “so the baby grows faster”.", "What is the risk? What do you teach?", "Dehydration or electrolyte disturbances.", "Follow the manufacturer’s exact ratio · measure accurately · do not add extra powder."],
    [3, "NG tube feeding", "During an NG feed, the infant starts coughing and becomes cyanosed.", "First action? Which complication do you fear most?", "Stop feeding. Fear aspiration.", "Never restart while placement is uncertain · document the feeding and the infant’s response."],
    [4, "Weaning", "A mother gives her 8-month-old honey on bread and whole grapes, and leaves the baby eating alone.", "How many hazards can you find?", "3 hazards: honey, whole grapes, left alone.", "No honey before 12 months · prepare choking hazards safely · sit upright, supervised, never alone."]
  ];
  for (const reveal of [false, true]) {
    const s = content(0, reveal ? "Case studies: answers" : "Case studies: what would you do?", "Review");
    CASES.forEach((c, i) => {
      const x = 0.6 + (i % 2) * 6.2, y = 1.6 + Math.floor(i / 2) * 2.68;
      card(s, x, y, 5.95, 2.48);
      T(s, ("CASE " + (i + 1) + " · " + c[1]).toUpperCase(), { x: x + 0.25, y: y + 0.18, w: 5.4, h: 0.3, fontSize: 12, bold: true, color: PC[c[0]], charSpacing: 2 });
      if (!reveal) {
        T(s, c[2], { x: x + 0.25, y: y + 0.55, w: 5.45, h: 1.15, fontSize: 17 });
        T(s, c[3], { x: x + 0.25, y: y + 1.75, w: 5.45, h: 0.55, fontSize: 15, italic: true, color: MUTED });
      } else {
        T(s, c[4], { x: x + 0.25, y: y + 0.5, w: 5.45, h: 0.75, valign: "middle", fontSize: 18, bold: true, color: c[0] === 3 ? BAD : C.text1 });
        T(s, c[5], { x: x + 0.25, y: y + 1.32, w: 5.45, h: 1.05, fontSize: 15 });
      }
    });
    notes(s, "Case studies", reveal ? null : "Groups of 4, 2 minutes per case; show the next slide for the answers.");
  }
  {
    const s = content(0, "Four things to remember", "Review");
    const k = [[1, "drop", "Breastfeeding", "Breast milk only for the first 6 months. Colostrum should not be discarded. Good latch → less pain + effective milk transfer."], [2, "bottle", "Artificial feeding", "Exact water-to-powder ratio. Semi-upright. Never prop the bottle and leave the infant alone."], [3, "tube", "NG tube feeding", "Never feed if tube placement is uncertain. Most serious complication: aspiration."], [4, "spoon", "Weaning", "Start around 6 months, continue breastfeeding, never leave the child alone while eating."]];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.06;
      card(s, x, 1.65, 2.85, 5.0);
      await iconBubble(s, k[i][1], HEX[k[i][0]], k[i][0], x + 0.25, 1.9, 0.9);
      T(s, k[i][2], { x: x + 0.25, y: 2.95, w: 2.4, h: 0.85, valign: "middle", fontSize: 19, bold: true, color: PC[k[i][0]] });
      T(s, k[i][3], { x: x + 0.25, y: 3.9, w: 2.4, h: 2.6, fontSize: 16 });
    }
    notes(s, "Key takeaways");
  }
  {
    const s = content(0, "Questions?", "Close");
    T(s, "Before you leave, complete the exit ticket on a slip of paper.", { x: 0.6, y: 1.6, w: 12, h: 0.5, fontSize: 20, color: MUTED });
    [["1", "thing you learned today"], ["1", "question you still have"]].forEach(([n, t], i) => {
      const x = 0.6 + i * 6.2;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.6, w: 5.95, h: 2.8, rectRadius: 0.15, fill: { color: C.background1 }, line: { color: C.accent5, width: 1.5, dashType: "dash" }, objectName: "Exit ticket" });
      T(s, n, { x: x + 0.4, y: 2.9, w: 2, h: 1.2, fontSize: 72, bold: true, color: C.accent5 });
      T(s, t, { x: x + 0.4, y: 4.25, w: 5.2, h: 0.8, fontSize: 24 });
    });
    notes(s, "Questions & exit ticket");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
