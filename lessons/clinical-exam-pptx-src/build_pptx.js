// Editable PowerPoint version of the Basic Clinical Examination lesson.
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const SKILL = fs.readdirSync("/root/.claude/skills/synced").map((d) => "/root/.claude/skills/synced/" + d + "/pptx").find((p) => fs.existsSync(p));
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");
const ASSETS = path.join(__dirname, "assets");
const OUT = process.argv[2] || path.join(__dirname, "Basic-Clinical-Examination.pptx");
const AUTHOR = "Dr. Ruqaiah Aidaros Alhebshi";

const THEME = {
  name: "Clinical Examination", headFontFace: "Calibri", bodyFontFace: "Calibri",
  colors: { dk1: "11262D", lt1: "FFFFFF", dk2: "0B5259", lt2: "EEF3F3", accent1: "C0342B", accent2: "1F63A8", accent3: "B0620A", accent4: "6A44B8", accent5: "0E6C75", accent6: "BF2A2A", hlink: "1F63A8", folHlink: "6A44B8" }
};
const MUTED = "4B636B", LINE = "CDDADC", OK = "1B7A43", BAD = "BF2A2A", WARN = "A1630A", LO = "3B82F6";
const DEEP = { 1: "93231C", 2: "174C84", 3: "8A4A05", 4: "4F3293" };
const NAMES = ["", "Cardiovascular System", "Respiratory System", "Abdomen", "Neurological System"];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "Basic Clinical Examination";
pres.author = AUTHOR;
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const PC = { 0: C.accent5, 1: C.accent1, 2: C.accent2, 3: C.accent3, 4: C.accent4 };

pres.defineSlideMaster({
  title: "Content", background: { color: C.background2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 12.1, h: 0.8, fontSize: 36, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Basic Clinical Examination · " + AUTHOR, options: { x: 0.6, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } }
  ],
  slideNumber: { x: 12.2, y: 7.05, w: 0.6, h: 0.3, fontSize: 10, color: MUTED, align: "right" }
});
pres.defineSlideMaster({
  title: "Section", background: { color: C.text2 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.7, y: 2.6, w: 6.8, h: 1.6, fontSize: 48, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } }]
});
pres.defineSlideMaster({ title: "Cover", background: { color: C.background2 }, objects: [] });

/* ---------- helpers ---------- */
const imgs = {};
async function asset(n) {
  if (!imgs[n]) { const f = path.join(ASSETS, n + ".png"), m = await sharp(f).metadata(); imgs[n] = { w: m.width, h: m.height, data: "image/png;base64," + fs.readFileSync(f).toString("base64") }; }
  return imgs[n];
}
async function img(s, n, x, y, w, h, alt) {
  const a = await asset(n), r = Math.min(w / a.w, h / a.h), iw = a.w * r, ih = a.h * r;
  s.addImage({ data: a.data, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: alt || n, objectName: "Illustration " + n });
}
function T(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top" }, o)); }
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, objectName: o.name || "Card", fill: o.fill || { color: C.background1 }, line: o.line || { color: LINE, width: 0.75 },
    shadow: o.shadow === false ? undefined : { type: "outer", color: "11262D", opacity: 0.08, blur: 6, offset: 2, angle: 90 } });
}
function eyebrow(s, part, label) { T(s, label.toUpperCase(), { x: 0.6, y: 0.3, w: 8, h: 0.3, fontSize: 12, bold: true, color: PC[part], charSpacing: 2 }); }
let sec = "";
function section(t) { pres.addSection({ title: t }); sec = t; }
function content(part, eye, title) { const s = pres.addSlide({ masterName: "Content", sectionTitle: sec }); eyebrow(s, part, eye); s.addText(title, { placeholder: "title" }); return s; }
function bullets(s, items, x, y, w, h, o = {}) {
  T(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), Object.assign({ x, y, w, h, fontSize: 18, paraSpaceAfter: 8 }, o));
}
function pill(s, x, y, w, h, text, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: o.fill || { color: C.background1 }, line: o.line || { color: LINE, width: 0.75 }, objectName: "Pill" });
  T(s, text, { x, y, w, h, align: "center", valign: "middle", fontSize: o.fontSize || 14, bold: !!o.bold, color: o.color || C.text1 });
}

/* Range scale: zones [from%, to%, color, label], ticks [pct, text, low], pin pct */
function range(s, x, y, w, zones, ticks, pin) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + 0.45, w, h: 0.3, rectRadius: 0.15, fill: { color: "E2EAEB" }, line: { type: "none" }, objectName: "Scale track" });
  zones.forEach(([a, b, col, lab]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: x + w * a / 100, y: y + 0.45, w: w * (b - a) / 100, h: 0.3, fill: { color: col }, line: { type: "none" }, objectName: "Zone " + lab });
    T(s, lab, { x: x + w * (a + b) / 200 - 1.1, y, w: 2.2, h: 0.35, align: "center", fontSize: 13, bold: true, color: col });
  });
  ticks.forEach(([p, t, low]) => {
    s.addShape(pres.shapes.LINE, { x: x + w * p / 100, y: y + 0.78, w: 0, h: 0.1, line: { color: MUTED, width: 1 }, objectName: "Tick" });
    T(s, t, { x: x + w * p / 100 - 0.6, y: y + (low ? 1.18 : 0.92), w: 1.2, h: 0.28, align: "center", fontSize: 12, color: MUTED });
  });
  s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: x + w * pin / 100 - 0.12, y: y + 0.25, w: 0.24, h: 0.2, rotate: 180, fill: { color: C.text1 }, line: { type: "none" }, objectName: "Normal marker" });
}
function rows(s, items, x, y, w) {
  items.forEach(([col, label, val], i) => {
    const yy = y + i * 0.62;
    card(s, x, yy, w, 0.52, { shadow: false });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: yy + 0.17, w: 0.18, h: 0.18, fill: { color: col }, line: { type: "none" }, objectName: "Status dot" });
    T(s, [{ text: label + "  ", options: { bold: true } }, { text: val, options: { color: MUTED } }], { x: x + 0.55, y: yy, w: w - 0.7, h: 0.52, valign: "middle", fontSize: 16 });
  });
}
async function vitalSlide(title, illus, caption, accentHex, normalLabel, normal, unit, zones, ticks, pin, rowItems) {
  const s = content(0, "Vital signs", title);
  card(s, 0.6, 1.7, 4.9, 4.9, { fill: { color: accentHex, transparency: 92 }, line: { color: accentHex, width: 0.75, transparency: 60 } });
  await img(s, illus, 0.9, 1.95, 4.3, 3.9, caption);
  T(s, caption.toUpperCase(), { x: 0.6, y: 6.05, w: 4.9, h: 0.35, align: "center", fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  T(s, normalLabel.toUpperCase(), { x: 6.0, y: 1.7, w: 6.5, h: 0.3, fontSize: 12, bold: true, color: OK, charSpacing: 2 });
  T(s, [{ text: normal, options: { fontSize: 50, bold: true } }, { text: "  " + unit, options: { fontSize: 20, bold: true, color: MUTED } }], { x: 6.0, y: 2.0, w: 6.8, h: 0.95, valign: "middle" });
  range(s, 6.0, 3.15, 6.7, zones, ticks, pin);
  rows(s, rowItems, 6.0, 4.75, 6.7);
  return s;
}
async function divider(part, chips, illus) {
  const s = pres.addSlide({ masterName: "Section", sectionTitle: sec });
  s.background = { color: DEEP[part] };
  T(s, "SYSTEM " + part, { x: 0.7, y: 2.1, w: 4, h: 0.35, fontSize: 14, bold: true, color: C.background1, charSpacing: 3 });
  s.addText(NAMES[part], { placeholder: "title" });
  let x = 0.7;
  chips.forEach((c) => { const w = 0.45 + c.length * 0.11; s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.45, w, h: 0.44, rectRadius: 0.22, fill: { color: C.background1, transparency: 100 }, line: { color: C.background1, width: 0.75, transparency: 40 }, objectName: "Topic chip" }); T(s, c, { x, y: 4.45, w, h: 0.44, align: "center", valign: "middle", fontSize: 14, color: C.background1 }); x += w + 0.15; });
  card(s, 7.9, 1.5, 4.8, 4.5, { shadow: false, line: { type: "none" } });
  await img(s, illus, 8.3, 1.8, 4.0, 3.9, NAMES[part]);
}
const TAG = { Inspection: [C.accent5, "eye"], Palpation: [C.accent1, "hand"], Percussion: [C.accent3, "percuss"], Auscultation: [C.accent2, "ausc"], Assessment: [C.accent4, "brain"] };
async function exam(s, x, y, w, h, name, items, o = {}) {
  card(s, x, y, w, h);
  s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.22, w: 0.62, h: 0.62, fill: { color: TAG[name][0], transparency: 85 }, line: { type: "none" }, objectName: "Step icon circle" });
  await img(s, TAG[name][1], x + 0.3, y + 0.27, 0.52, 0.52, name);
  T(s, name, { x: x + 1.0, y: y + 0.22, w: w - 1.2, h: 0.62, valign: "middle", fontSize: 22, bold: true, color: TAG[name][0] });
  bullets(s, items, x + 0.3, y + 1.05, w - 0.55, h - 1.25, { fontSize: o.fontSize || 18 });
}
async function figure(s, illus, x, y, w, h, cap, part) {
  card(s, x, y, w, h, { fill: { color: PC[part], transparency: 93 }, line: { color: PC[part], width: 0.75, transparency: 60 } });
  await img(s, illus, x + 0.2, y + 0.2, w - 0.4, h - 0.75, cap);
  T(s, cap.toUpperCase(), { x, y: y + h - 0.5, w, h: 0.35, align: "center", fontSize: 11, bold: true, color: MUTED, charSpacing: 2 });
}

/* ================= Build ================= */
(async () => {
  section("Introduction");
  { // 1 cover
    const s = pres.addSlide({ masterName: "Cover", sectionTitle: sec });
    T(s, "CLINICAL SKILLS", { x: 0.6, y: 1.0, w: 6, h: 0.3, fontSize: 13, bold: true, color: C.accent5, charSpacing: 2 });
    T(s, [{ text: "Basic Clinical\n", options: { color: C.text1 } }, { text: "Examination", options: { color: C.accent5 } }], { x: 0.6, y: 1.4, w: 7.2, h: 2.2, fontSize: 58, bold: true, valign: "middle" });
    card(s, 0.6, 3.95, 6.6, 1.25);
    T(s, "PRESENTED BY", { x: 0.9, y: 4.12, w: 6, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
    T(s, AUTHOR, { x: 0.9, y: 4.45, w: 6.2, h: 0.55, fontSize: 28, bold: true, color: C.accent5 });
    let x = 0.6;
    ["General physical examination", "Vital signs", "Systemic examination"].forEach((c) => { const w = 0.4 + c.length * 0.1; pill(s, x, 5.55, w, 0.44, c, { fontSize: 13 }); x += w + 0.15; });
    await img(s, "steth", 7.9, 0.8, 4.8, 5.9, "Stethoscope");
  }
  section("General examination");
  { // 2
    const s = content(0, "General examination", "General physical examination");
    T(s, [{ text: "General examination", options: { bold: true, color: C.accent5 } }, { text: " is a quick assessment of the patient’s overall condition before examining individual body systems." }], { x: 0.6, y: 1.65, w: 12, h: 0.95, fontSize: 22 });
    T(s, "IT STARTS WITH THE VITAL SIGNS", { x: 0.6, y: 2.85, w: 8, h: 0.3, fontSize: 12, bold: true, color: C.accent5, charSpacing: 2 });
    const v = [["thermo", "Temperature"], ["pulse", "Pulse"], ["lungs", "Respiratory rate"], ["bp", "Blood pressure"], ["spo2", "SpO₂"]];
    for (let i = 0; i < 5; i++) { const x = 0.6 + i * 2.46; card(s, x, 3.3, 2.28, 3.25); await img(s, v[i][0], x + 0.2, 3.5, 1.88, 2.1, v[i][1]); T(s, v[i][1], { x, y: 5.75, w: 2.28, h: 0.5, align: "center", fontSize: 17, bold: true }); }
  }
  { // 3
    const s = content(0, "Vital signs", "Vital signs: normal values");
    const v = [["Temperature", "36.5–37.5 °C", "Fever ≥38 °C\nHypothermia <35 °C"], ["Pulse", "60–100 /min", "Tachycardia >100\nBradycardia <60"], ["Respiratory rate", "12–20 /min", "Tachypnea >20\nBradypnea <12"], ["Blood pressure", "≈ 90/60–120/80 mmHg", "Hypertension ≥140/90\nHypotension <90/60"], ["SpO₂", "95–100 %", "Low <94 %\nSevere hypoxemia <90 %"]];
    v.forEach((r, i) => { const x = 0.6 + i * 2.46; card(s, x, 1.8, 2.28, 4.2); T(s, r[0], { x: x + 0.15, y: 2.05, w: 1.98, h: 0.5, align: "center", fontSize: 18, bold: true }); T(s, r[1], { x: x + 0.15, y: 2.75, w: 1.98, h: 1.1, align: "center", valign: "middle", fontSize: 22, bold: true, color: OK }); T(s, r[2], { x: x + 0.15, y: 4.2, w: 1.98, h: 1.4, align: "center", fontSize: 14, color: MUTED }); });
  }
  await vitalSlide("Temperature", "thermo", "Digital thermometer", "D9822B", "Normal", "36.5–37.5", "°C",
    [[0, 25, LO, "Hypothermia"], [43.75, 56.25, OK, "Normal"], [62.5, 100, BAD, "Fever"]], [[25, "35"], [43.75, "36.5"], [56.25, "37.5", true], [62.5, "38 °C"]], 50,
    [[OK, "Normal:", "36.5–37.5 °C"], [BAD, "Fever:", "≥38 °C"], [LO, "Hypothermia:", "<35 °C"]]);
  await vitalSlide("Pulse", "pulse", "Radial pulse", "C0342B", "Normal", "60–100", "beats/min",
    [[0, 25, LO, "Bradycardia"], [25, 58.33, OK, "Normal"], [58.33, 100, BAD, "Tachycardia"]], [[25, "60"], [58.33, "100 /min"]], 41.67,
    [[OK, "Normal:", "60–100 beats/min"], [BAD, "Tachycardia:", ">100 beats/min"], [LO, "Bradycardia:", "<60 beats/min"]]);
  await vitalSlide("Respiratory rate", "lungs", "Count breaths per minute", "1F63A8", "Normal", "12–20", "breaths/min",
    [[0, 25, LO, "Bradypnea"], [25, 50, OK, "Normal"], [50, 100, BAD, "Tachypnea"]], [[25, "12"], [50, "20 /min"]], 37.5,
    [[OK, "Normal:", "12–20 breaths/min"], [BAD, "Tachypnea:", ">20/min"], [LO, "Bradypnea:", "<12/min"]]);
  await vitalSlide("Blood pressure", "bp", "Sphygmomanometer", "6A44B8", "Normal adult BP · approximately", "90/60–120/80", "mmHg",
    [[0, 18.18, LO, "Hypotension"], [18.18, 45.45, OK, "Normal"], [63.64, 100, BAD, "Hypertension"]], [[18.18, "90/60"], [45.45, "120/80"], [63.64, "140/90"]], 31.82,
    [[OK, "Normal adult BP:", "approximately 90/60–120/80 mmHg"], [BAD, "Hypertension:", "≥140/90 mmHg"], [LO, "Hypotension:", "<90/60 mmHg"]]);
  await vitalSlide("SpO₂", "spo2", "Pulse oximeter", "0E6C75", "Normal", "95–100", "%",
    [[0, 50, BAD, "Severe hypoxemia"], [50, 70, WARN, "Low"], [75, 100, OK, "Normal"]], [[50, "90"], [70, "94"], [75, "95", true], [100, "100 %"]], 87.5,
    [[OK, "Normal:", "95–100%"], [WARN, "Low:", "<94%"], [BAD, "Severe hypoxemia:", "<90%"]]);
  { // 9
    const s = content(0, "Systemic examination", "Basic systemic examination");
    T(s, [{ text: "Basic systemic examination", options: { bold: true, color: C.accent5 } }, { text: " is a focused physical examination of a specific body system to identify abnormal signs." }], { x: 0.6, y: 1.65, w: 12, h: 0.95, fontSize: 22 });
    T(s, "Main systems", { x: 0.6, y: 2.85, w: 6, h: 0.4, fontSize: 20, bold: true });
    const v = [["heart", "Cardiovascular system", 1], ["lungs", "Respiratory system", 2], ["abdomen", "Abdomen / Gastrointestinal system", 3], ["brain", "Neurological system", 4], ["bone", "Musculoskeletal system", 0]];
    for (let i = 0; i < 5; i++) { const x = 0.6 + i * 2.46; card(s, x, 3.4, 2.28, 3.2); await img(s, v[i][0], x + 0.3, 3.6, 1.68, 1.75, v[i][1]); T(s, v[i][1], { x: x + 0.1, y: 5.5, w: 2.08, h: 0.9, align: "center", valign: "middle", fontSize: 16, bold: true, color: PC[v[i][2]] }); }
  }
  { // 10
    const s = content(0, "Systemic examination", "Basic examination sequence");
    T(s, "For most systems:", { x: 0.6, y: 1.55, w: 6, h: 0.4, fontSize: 18, color: MUTED });
    const st = [["eye", "Inspection", C.accent5], ["hand", "Palpation", C.accent1], ["percuss", "Percussion", C.accent3], ["ausc", "Auscultation", C.accent2]];
    for (let i = 0; i < 4; i++) {
      const cx = 1.95 + i * 3.15;
      s.addShape(pres.shapes.OVAL, { x: cx - 1.15, y: 2.4, w: 2.3, h: 2.3, fill: { color: st[i][2], transparency: 88 }, line: { color: st[i][2], width: 2, transparency: 45 }, objectName: "Step circle" });
      await img(s, st[i][0], cx - 0.8, 2.75, 1.6, 1.6, st[i][1]);
      T(s, "STEP " + (i + 1), { x: cx - 1.2, y: 4.95, w: 2.4, h: 0.3, align: "center", fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
      T(s, st[i][1], { x: cx - 1.4, y: 5.3, w: 2.8, h: 0.55, align: "center", fontSize: 26, bold: true, color: st[i][2] });
      if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: cx + 1.3, y: 3.37, w: 0.5, h: 0.36, fill: { color: C.accent5 }, line: { type: "none" }, objectName: "Arrow" });
    }
  }

  section("Cardiovascular system");
  await divider(1, ["Inspection", "Palpation", "Percussion", "Auscultation"], "heart");
  { const s = content(1, "Cardiovascular system", "Cardiovascular system: inspection & palpation");
    await exam(s, 0.6, 1.7, 3.9, 5.0, "Inspection", ["Pallor", "Cyanosis", "Edema", "JVP", "Precordial pulsations"]);
    await exam(s, 4.7, 1.7, 3.9, 5.0, "Palpation", ["Pulse: rate, rhythm, volume", "Peripheral pulses", "Capillary refill", "Apex beat", "Edema"]);
    await figure(s, "pulse", 8.8, 1.7, 3.95, 5.0, "Pulse: rate, rhythm, volume", 1); }
  { const s = content(1, "Cardiovascular system", "Cardiovascular system: percussion & auscultation");
    await exam(s, 0.6, 1.7, 3.6, 5.0, "Percussion", ["Usually not routinely performed", "May help estimate cardiac borders"]);
    await exam(s, 4.4, 1.7, 3.6, 5.0, "Auscultation", ["S1 and S2", "S3 / S4", "Murmurs", "Main valve areas"]);
    await figure(s, "valves", 8.2, 1.7, 4.55, 5.0, "Main valve areas", 1); }

  section("Respiratory system");
  await divider(2, ["Inspection", "Palpation", "Percussion", "Auscultation"], "lungs");
  { const s = content(2, "Respiratory system", "Respiratory system: inspection & palpation");
    await exam(s, 0.6, 1.7, 3.9, 5.0, "Inspection", ["Respiratory rate", "Pattern", "Chest shape", "Chest movement", "Accessory muscle use", "Cyanosis"]);
    await exam(s, 4.7, 1.7, 3.9, 5.0, "Palpation", ["Chest expansion", "Tracheal position", "Tactile vocal fremitus"]);
    await figure(s, "lungs", 8.8, 1.7, 3.95, 5.0, "Chest movement & expansion", 2); }
  { const s = content(2, "Respiratory system", "Respiratory system: percussion & auscultation");
    card(s, 0.6, 1.7, 6.6, 5.0);
    s.addShape(pres.shapes.OVAL, { x: 0.85, y: 1.92, w: 0.62, h: 0.62, fill: { color: C.accent3, transparency: 85 }, line: { type: "none" }, objectName: "Step icon circle" });
    await img(s, "percuss", 0.9, 1.97, 0.52, 0.52, "Percussion");
    T(s, "Percussion", { x: 1.6, y: 1.92, w: 5, h: 0.62, valign: "middle", fontSize: 22, bold: true, color: C.accent3 });
    [["Resonant", "Normal", OK], ["Dull", "Consolidation / effusion", WARN], ["Hyperresonant", "Pneumothorax", BAD]].forEach(([a, b, col], i) => {
      const y = 2.85 + i * 1.12;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.9, y, w: 6.0, h: 0.92, rectRadius: 0.1, fill: { color: col, transparency: 90 }, line: { color: col, width: 1, transparency: 50 }, objectName: "Percussion note" });
      T(s, a, { x: 1.15, y, w: 2.3, h: 0.92, valign: "middle", fontSize: 20, bold: true, color: col });
      s.addShape(pres.shapes.RIGHT_ARROW, { x: 3.45, y: y + 0.32, w: 0.42, h: 0.28, fill: { color: col }, line: { type: "none" }, objectName: "Arrow" });
      T(s, b, { x: 4.05, y, w: 2.75, h: 0.92, valign: "middle", fontSize: 18 });
    });
    await exam(s, 7.45, 1.7, 5.3, 5.0, "Auscultation", ["Breath sounds", "Wheeze", "Crackles", "Bronchial breathing", "Reduced / absent sounds"]); }

  section("Abdomen");
  await divider(3, ["Inspection", "Palpation", "Percussion", "Auscultation"], "abdomen");
  { const s = content(3, "Abdomen", "Abdomen: inspection & palpation");
    await exam(s, 0.6, 1.7, 3.6, 5.0, "Inspection", ["Distension", "Scars", "Masses", "Visible veins", "Umbilicus"]);
    await exam(s, 4.4, 1.7, 3.6, 5.0, "Palpation", ["Tenderness", "Guarding / rigidity", "Masses", "Liver", "Spleen", "Kidneys"]);
    await figure(s, "abdmap", 8.2, 1.7, 4.55, 5.0, "Liver · Spleen · Kidneys", 3); }
  { const s = content(3, "Abdomen", "Abdomen: percussion & auscultation");
    await exam(s, 0.6, 1.7, 3.9, 5.0, "Percussion", ["Liver", "Spleen", "Ascites"]);
    await exam(s, 4.7, 1.7, 3.9, 5.0, "Auscultation", ["Bowel sounds", "Bruits when indicated"]);
    await figure(s, "abdomen", 8.8, 1.7, 3.95, 5.0, "Abdomen / GI system", 3); }

  section("Neurological system");
  await divider(4, ["Inspection", "Assessment", "Reflexes"], "brain");
  { const s = content(4, "Neurological system", "Neurological system");
    await exam(s, 0.6, 1.7, 3.75, 5.0, "Inspection", ["Level of consciousness", "Speech", "Posture", "Gait", "Involuntary movements"]);
    await exam(s, 4.55, 1.7, 3.75, 5.0, "Assessment", ["Cranial nerves", "Muscle power", "Muscle tone", "Sensation", "Coordination", "Reflexes: deep tendon reflexes"]);
    card(s, 8.5, 1.7, 4.25, 5.0, { fill: { color: C.accent4, transparency: 93 }, line: { color: C.accent4, width: 0.75, transparency: 60 } });
    await img(s, "reflex", 8.75, 1.85, 2.6, 2.6, "Deep tendon reflex with a reflex hammer");
    T(s, "DEEP TENDON REFLEX", { x: 8.5, y: 4.45, w: 2.9, h: 0.3, align: "center", fontSize: 11, bold: true, color: MUTED, charSpacing: 1 });
    await img(s, "gait", 11.3, 2.1, 1.3, 2.2, "Gait");
    T(s, "GAIT", { x: 11.2, y: 4.45, w: 1.5, h: 0.3, align: "center", fontSize: 11, bold: true, color: MUTED, charSpacing: 1 }); }

  section("Close");
  { const s = pres.addSlide({ masterName: "Cover", sectionTitle: sec });
    T(s, [{ text: "Thank\n", options: { color: C.text1 } }, { text: "you", options: { color: C.accent5 } }], { x: 0.6, y: 1.2, w: 6, h: 2.4, fontSize: 64, bold: true, valign: "middle" });
    card(s, 0.6, 3.95, 6.6, 1.25);
    T(s, "BASIC CLINICAL EXAMINATION", { x: 0.9, y: 4.12, w: 6, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
    T(s, AUTHOR, { x: 0.9, y: 4.45, w: 6.2, h: 0.55, fontSize: 28, bold: true, color: C.accent5 });
    await img(s, "steth", 7.9, 0.8, 4.8, 5.9, "Stethoscope"); }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
