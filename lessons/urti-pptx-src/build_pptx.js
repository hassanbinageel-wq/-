// Editable PowerPoint version of the URTIs lesson (A4 landscape, pink theme).
// Usage: NODE_PATH=<dir with pptxgenjs, sharp, react, react-dom, react-icons> node build_pptx.js [out.pptx]
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const fa = require("react-icons/fa6");
const gi = require("react-icons/gi");
const fs = require("fs");
const path = require("path");
const SKILL = fs.readdirSync("/root/.claude/skills/synced").map((d) => "/root/.claude/skills/synced/" + d + "/pptx").find((p) => fs.existsSync(p));
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");
const ASSETS = path.join(__dirname, "assets");
const OUT = process.argv[2] || path.join(__dirname, "..", "URTIs-Upper-Respiratory-Tract-Infections.pptx");
const AUTHOR = "Dr. Ruqaiah Alhebshi";
const LESSON = "Upper respiratory tract infections (URTIs)";

const THEME = {
  name: "URTIs Pink", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: "2C1A24", lt1: "FFFFFF", dk2: "8A1F4B", lt2: "FDF0F5", accent1: "E64980", accent2: "C2255C", accent3: "AE3EC9", accent4: "7950C8", accent5: "E8590C", accent6: "0C9A6E", hlink: "C2255C", folHlink: "7950C8" }
};
const HEX = THEME.colors;
const MUTED = "7A5A6B", LINE = "F0CFDD", SOFT = "FFE3EE", SOFT2 = "F6E5FA", SOFT3 = "FDEBE0", SOFT4 = "EEE9FA", RED = "E03131";

const pres = new pptxgen();
pres.defineLayout({ name: "A4L", width: 11.69, height: 8.27 });
pres.layout = "A4L";
pres.title = LESSON;
pres.author = AUTHOR + ", MBBS";
pres.subject = "Common cold, pharyngitis and tonsillitis in children";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const PART = { 1: C.accent1, 2: C.accent2, 3: C.accent3, 4: C.accent4 };
const PARTHEX = { 0: HEX.accent1, 1: HEX.accent1, 2: HEX.accent2, 3: HEX.accent3, 4: HEX.accent4 };
const W = 11.69, H = 8.27, M = 0.55;

pres.defineSlideMaster({
  title: "Content", background: { color: C.background2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.72, w: W - 2 * M, h: 0.75, fontSize: 32, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: LESSON + " · " + AUTHOR + ", MBBS", options: { x: M, y: H - 0.42, w: 8, h: 0.26, fontSize: 10, color: MUTED, margin: 0 } } }
  ],
  slideNumber: { x: W - M - 0.6, y: H - 0.42, w: 0.6, h: 0.26, fontSize: 10, color: MUTED, align: "right" }
});
pres.defineSlideMaster({
  title: "Section", background: { color: C.text2 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.9, y: 3.1, w: 6.4, h: 1.5, fontSize: 52, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } }]
});
pres.defineSlideMaster({ title: "Cover", background: { color: C.background2 }, objects: [] });

/* ---------- helpers ---------- */
const cache = {};
async function asset(n) {
  if (!cache[n]) {
    const f = path.join(ASSETS, n + ".png"), m = await sharp(f).metadata();
    let buf = fs.readFileSync(f), w = m.width, h = m.height;
    if (n.startsWith("throat-")) { const cw = Math.round(h * 0.8); buf = await sharp(f).extract({ left: Math.round((w - cw) / 2), top: 0, width: cw, height: h }).png().toBuffer(); w = cw; } // same portrait crop for every 3D view
    cache[n] = { w, h, data: "image/png;base64," + buf.toString("base64") };
  }
  return cache[n];
}
async function img(s, n, x, y, w, h, alt) {
  const a = await asset(n), r = Math.min(w / a.w, h / a.h), iw = a.w * r, ih = a.h * r;
  s.addImage({ data: a.data, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih, altText: alt, objectName: "Illustration: " + alt });
}
const iconCache = {};
async function iconPng(I, hex) {
  const k = I.name + hex;
  if (!iconCache[k]) {
    const svg = renderToStaticMarkup(React.createElement(I, { size: 256, color: "#" + hex }));
    iconCache[k] = "image/png;base64," + (await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer()).toString("base64");
  }
  return iconCache[k];
}
// icon in a coloured circle (circle stays an editable shape)
async function icon(s, I, x, y, d, circleColor, iconHex, alt) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: circleColor }, line: { type: "none" }, objectName: "Icon circle" });
  const p = d * 0.25;
  s.addImage({ data: await iconPng(I, iconHex || "FFFFFF"), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: alt || "icon", objectName: "Icon: " + (alt || "") });
}
function T(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top" }, o)); }
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, objectName: o.name || "Card", fill: { color: o.fill || "FFFFFF" }, line: { color: o.line || LINE, width: 0.75 },
    shadow: o.shadow === false ? undefined : { type: "outer", color: "8A1F4B", opacity: 0.1, blur: 8, offset: 2, angle: 90 } });
}
function bullets(s, items, x, y, w, h, o = {}) {
  T(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), Object.assign({ x, y, w, h, fontSize: 16, paraSpaceAfter: 6 }, o));
}
// rich text: "plain **bold** plain"
function rich(str, base = {}) {
  return str.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => p.startsWith("**") ? { text: p.slice(2, -2), options: Object.assign({}, base, { bold: true }) } : { text: p, options: Object.assign({}, base) });
}
function richBullets(s, items, x, y, w, h, o = {}) {
  const runs = [];
  items.forEach((t, i) => { const r = rich(t); r[0].options.bullet = true; r[r.length - 1].options.breakLine = i < items.length - 1; runs.push(...r); }); // fix_ppr.py drops the stray mid-paragraph pPr
  T(s, runs, Object.assign({ x, y, w, h, fontSize: 16, paraSpaceAfter: 6 }, o));
}
function pill(s, x, y, w, h, text, fill, color, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { type: "none" }, objectName: "Pill: " + text });
  T(s, text, { x, y, w, h, align: "center", valign: "middle", fontSize: o.fontSize || 13, bold: true, color });
}
let sec = "";
function section(title) { pres.addSection({ title }); sec = title; }
function content(part, eyebrow, title) {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: sec });
  const col = part ? PART[part] : C.accent1;
  if (part) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.36, w: 0.42, h: 0.28, rectRadius: 0.06, fill: { color: col }, line: { type: "none" }, objectName: "Part number" });
    T(s, "0" + part, { x: M, y: 0.36, w: 0.42, h: 0.28, align: "center", valign: "middle", fontSize: 11, bold: true, color: C.background1 });
  }
  T(s, eyebrow.toUpperCase(), { x: M + (part ? 0.55 : 0), y: 0.36, w: 7, h: 0.28, valign: "middle", fontSize: 12, bold: true, color: col, charSpacing: 2 });
  s.addText(title, { placeholder: "title" });
  return s;
}
async function divider(part, name, sub, I) {
  const s = pres.addSlide({ masterName: "Section", sectionTitle: sec });
  T(s, "PART " + part, { x: 0.9, y: 2.45, w: 5, h: 0.45, fontSize: 18, bold: true, color: "FFC9DD", charSpacing: 4 });
  s.addText(name, { placeholder: "title" });
  T(s, sub, { x: 0.9, y: 4.7, w: 6.2, h: 0.9, fontSize: 18, color: "FFE3EE" });
  s.addShape(pres.shapes.OVAL, { x: 7.75, y: 1.95, w: 3.6, h: 3.6, fill: { color: "FFFFFF", transparency: 88 }, line: { type: "none" }, objectName: "Halo" });
  s.addShape(pres.shapes.OVAL, { x: 8.35, y: 2.55, w: 2.4, h: 2.4, fill: { color: PARTHEX[part] }, line: { type: "none" }, objectName: "Icon circle" });
  s.addImage({ data: await iconPng(I, "FFFFFF"), x: 8.9, y: 3.1, w: 1.3, h: 1.3, altText: name, objectName: "Icon: " + name });
  return s;
}
// symptom tile: tinted card + icon circle + label (+ optional italic sub)
async function tile(s, x, y, w, h, I, label, colHex, tint, sub) {
  card(s, x, y, w, h, { fill: tint, line: tint, shadow: false, name: "Symptom: " + label });
  const d = Math.min(0.62, h - 0.3);
  await icon(s, I, x + 0.2, y + (h - d) / 2, d, colHex, "FFFFFF", label);
  if (sub) T(s, [{ text: label, options: { bold: true, breakLine: true } }, { text: sub, options: { italic: true, color: colHex, fontSize: 13 } }], { x: x + 0.38 + d, y, w: w - d - 0.5, h, valign: "middle", fontSize: 16 });
  else T(s, label, { x: x + 0.38 + d, y, w: w - d - 0.5, h, valign: "middle", fontSize: 16, bold: true });
}
function callout(s, x, y, w, h, runs, fill, line) {
  card(s, x, y, w, h, { fill, line: line || fill, shadow: false, name: "Callout" });
  T(s, runs, { x: x + 0.85, y, w: w - 1.05, h, valign: "middle", fontSize: 17 });
}

(async () => {
  /* ================= COVER ================= */
  section("Introduction");
  let s = pres.addSlide({ masterName: "Cover", sectionTitle: sec });
  s.addShape(pres.shapes.OVAL, { x: 5.6, y: 0.7, w: 6.6, h: 6.6, fill: { color: "FFFFFF" }, line: { type: "none" }, objectName: "Halo" });
  await img(s, "viruses", 5.9, 0.75, 5.4, 6.6, "3D models of rhinovirus, coronavirus, adenovirus and RSV");
  T(s, "PEDIATRICS", { x: 0.75, y: 1.55, w: 4, h: 0.3, fontSize: 13, bold: true, color: C.accent1, charSpacing: 4 });
  T(s, [{ text: "Upper respiratory ", options: { breakLine: true } }, { text: "tract infections", options: { color: C.accent1, italic: true } }],
    { x: 0.75, y: 1.95, w: 5.4, h: 1.9, fontSize: 44, bold: true, fontFace: "Cambria", valign: "middle" });
  T(s, "(URTIs)", { x: 0.75, y: 3.85, w: 4, h: 0.5, fontSize: 24, color: C.accent2, bold: true, fontFace: "Cambria" });
  pill(s, 0.75, 4.55, 1.55, 0.36, "Common cold", SOFT, HEX.accent1);
  pill(s, 2.4, 4.55, 1.45, 0.36, "Pharyngitis", SOFT, HEX.accent2);
  pill(s, 3.95, 4.55, 1.4, 0.36, "Tonsillitis", SOFT2, HEX.accent3);
  card(s, 0.75, 5.3, 4.6, 1.0, { name: "Presenter card" });
  await icon(s, fa.FaUserDoctor, 0.95, 5.5, 0.6, HEX.accent1, "FFFFFF", "Presenter");
  T(s, [{ text: "PRESENTED BY", options: { fontSize: 10, bold: true, color: MUTED, charSpacing: 2, breakLine: true } }, { text: AUTHOR + "  ", options: { fontSize: 19, bold: true, fontFace: "Cambria" } }, { text: "MBBS", options: { fontSize: 12, bold: true, color: C.accent1 } }],
    { x: 1.75, y: 5.3, w: 3.5, h: 1.0, valign: "middle" });

  /* ================= INTRODUCTION ================= */
  s = content(0, "Introduction", "Upper respiratory tract infections (URTIs)");
  card(s, M, 1.75, 4.6, 5.75, { name: "Anatomy card" });
  await img(s, "anatomy", M + 0.2, 1.9, 4.2, 5.45, "Side view of the head showing the nose, pharynx and tonsils");
  card(s, 5.4, 1.75, 5.74, 1.2, { fill: SOFT, line: LINE, shadow: false, name: "Definition" });
  T(s, [{ text: "URTIs are " }, { text: "common infections in children", options: { bold: true } }, { text: " affecting the " }, { text: "nose", options: { bold: true, color: C.accent1 } }, { text: ", " }, { text: "pharynx", options: { bold: true, color: C.accent2 } }, { text: " and " }, { text: "tonsils", options: { bold: true, color: C.accent3 } }, { text: "." }],
    { x: 5.65, y: 1.75, w: 5.3, h: 1.2, valign: "middle", fontSize: 18 });
  T(s, "THE COMMON TYPES INCLUDE", { x: 5.4, y: 3.15, w: 5, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  const types = [["Common cold", gi.GiNoseFront, HEX.accent1, "Part 1"], ["Pharyngitis", fa.FaHeadSideVirus, HEX.accent2, "Part 2"], ["Tonsillitis", gi.GiMouthWatering, HEX.accent3, "Part 3"]];
  for (let i = 0; i < 3; i++) {
    const y = 3.55 + i * 0.85;
    card(s, 5.4, y, 5.74, 0.7, { name: "Type: " + types[i][0] });
    await icon(s, types[i][1], 5.55, y + 0.1, 0.5, types[i][2], "FFFFFF", types[i][0]);
    T(s, types[i][0], { x: 6.25, y, w: 3, h: 0.7, valign: "middle", fontSize: 19, bold: true });
    T(s, types[i][3], { x: 9.6, y, w: 1.3, h: 0.7, valign: "middle", align: "right", fontSize: 13, bold: true, color: types[i][2] });
  }
  callout(s, 5.4, 6.25, 5.74, 1.25, [{ text: "Most cases are caused by " }, { text: "viruses", options: { bold: true, color: C.accent3 } }, { text: "." }], SOFT2);
  await icon(s, fa.FaVirus, 5.6, 6.53, 0.68, HEX.accent3, "FFFFFF", "Virus");

  /* ================= PART 1 · COMMON COLD ================= */
  section("Part 1 · Common cold");
  await divider(1, "Common cold", "Definition and causes · clinical manifestations · physical examination · management and nursing care", gi.GiNoseFront);

  s = content(1, "Common cold", "Definition and causes");
  callout(s, M, 1.7, W - 2 * M, 0.8, [{ text: "Common cold is a " }, { text: "viral infection", options: { bold: true } }, { text: " of the upper respiratory tract, mainly affecting the " }, { text: "nose and throat", options: { bold: true } }, { text: "." }], SOFT);
  await icon(s, fa.FaBookMedical || fa.FaNotesMedical, M + 0.18, 1.82, 0.56, HEX.accent1, "FFFFFF", "Definition");
  card(s, M, 2.75, 4.1, 4.75, { name: "Virus models" });
  await img(s, "viruses", M + 0.1, 2.85, 3.9, 4.55, "3D models of the viruses that cause the common cold");
  T(s, "CAUSES", { x: 4.95, y: 2.75, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  const causes = [["Rhinovirus", "most common", HEX.accent1], ["Coronavirus", "", HEX.accent2], ["Adenovirus", "", HEX.accent3], ["RSV", "", HEX.accent4]];
  for (let i = 0; i < 4; i++) {
    const x = 4.95 + (i % 2) * 3.13, y = 3.1 + Math.floor(i / 2) * 0.8;
    card(s, x, y, 3.0, 0.65, { name: "Cause: " + causes[i][0] });
    await icon(s, fa.FaVirus, x + 0.12, y + 0.1, 0.45, causes[i][2], "FFFFFF", causes[i][0]);
    T(s, causes[i][1] ? [{ text: causes[i][0], options: { bold: true, breakLine: true } }, { text: causes[i][1], options: { fontSize: 12, bold: true, color: causes[i][2] } }] : causes[i][0],
      { x: x + 0.7, y, w: 2.2, h: 0.65, valign: "middle", fontSize: 16, bold: !causes[i][1] });
  }
  T(s, "TRANSMISSION", { x: 4.95, y: 4.82, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  const trn = [["tr-droplets", "Respiratory droplets", SOFT], ["tr-contact", "Direct contact", SOFT], ["tr-surface", "Contaminated surfaces", SOFT2]];
  for (let i = 0; i < 3; i++) {
    const x = 4.95 + i * 2.1;
    card(s, x, 5.17, 1.98, 2.33, { fill: trn[i][2], line: LINE, shadow: false, name: trn[i][1] });
    await img(s, trn[i][0], x + 0.15, 5.3, 1.68, 1.15, trn[i][1]);
    T(s, trn[i][1], { x: x + 0.1, y: 6.55, w: 1.78, h: 0.8, align: "center", valign: "middle", fontSize: 15, bold: true });
  }

  s = content(1, "Common cold", "Clinical manifestations");
  card(s, M, 1.7, 3.6, 5.8, { name: "Child card" });
  await img(s, "kid", M + 0.2, 1.85, 3.2, 5.5, "Child with a runny nose and fever");
  const coldSx = [[gi.GiNoseFront, "Runny nose", HEX.accent1, SOFT, "Rhinorrhea"], [gi.GiNoseSide, "Nasal congestion", HEX.accent2, SOFT], [fa.FaWind, "Sneezing", HEX.accent3, SOFT2], [fa.FaHeadSideVirus, "Mild sore throat", HEX.accent4, SOFT4],
    [fa.FaHeadSideCough, "Cough", HEX.accent1, SOFT], [fa.FaTemperatureHigh, "Mild fever", RED, SOFT], [fa.FaFaceTired, "Headache", HEX.accent5, SOFT3], [fa.FaUtensils, "Decreased appetite", HEX.accent2, SOFT]];
  for (let i = 0; i < 8; i++) await tile(s, 4.35 + (i % 2) * 3.45, 1.7 + Math.floor(i / 2) * 1.47, 3.33, 1.35, coldSx[i][0], coldSx[i][1], coldSx[i][2], coldSx[i][3], coldSx[i][4]);

  s = content(1, "Common cold", "Physical examination");
  const exams = [["General examination", fa.FaUser, HEX.accent1, ["Child may appear **mildly ill**.", "**Normal or mildly elevated** temperature."], "ex-general"],
    ["Nose examination", gi.GiNoseFront, HEX.accent2, ["Nasal **congestion**.", "**Redness** of nasal mucosa.", "**Watery** nasal discharge."], "ex-nose"],
    ["Throat examination", gi.GiMouthWatering, HEX.accent3, ["**Mild redness** of the pharynx.", "Tonsils **usually normal**."], "ex-throat"],
    ["Chest examination", fa.FaLungs, HEX.accent4, ["Usually **normal breath sounds**."], "ex-chest"]];
  for (let i = 0; i < 4; i++) {
    const x = M + i * 2.68, w = 2.53;
    card(s, x, 1.7, w, 5.8, { name: exams[i][0] });
    await icon(s, exams[i][1], x + 0.2, 1.9, 0.6, exams[i][2], "FFFFFF", exams[i][0]);
    T(s, exams[i][0], { x: x + 0.2, y: 2.6, w: w - 0.4, h: 0.75, fontSize: 18, bold: true, fontFace: "Cambria", valign: "middle" });
    richBullets(s, exams[i][3], x + 0.2, 3.4, w - 0.35, 1.9, { fontSize: 15 });
    await img(s, exams[i][4], x + 0.15, 5.0, w - 0.3, 2.35, exams[i][0]);
  }

  s = content(1, "Common cold", "Management and nursing care");
  card(s, M, 1.7, 5.2, 4.55, { name: "Management" });
  await icon(s, fa.FaKitMedical, M + 0.2, 1.88, 0.55, HEX.accent1, "FFFFFF", "Management");
  T(s, "Management", { x: M + 0.9, y: 1.88, w: 3.5, h: 0.55, valign: "middle", fontSize: 21, bold: true, fontFace: "Cambria" });
  const mgmt = [[fa.FaGlassWater, "Adequate fluids", HEX.accent4], [fa.FaBed, "Rest", HEX.accent3], [fa.FaEyeDropper, "Saline nasal drops", HEX.accent2], [fa.FaPills, "Paracetamol for fever when needed", RED], [fa.FaJar, "Honey for cough in children **older than one year**", HEX.accent5]];
  for (let i = 0; i < 5; i++) {
    const y = 2.62 + i * 0.7;
    await icon(s, mgmt[i][0], M + 0.25, y + 0.06, 0.46, mgmt[i][2], "FFFFFF", "");
    T(s, rich(mgmt[i][1]), { x: M + 0.9, y, w: 4.15, h: 0.58, valign: "middle", fontSize: 16 });
  }
  card(s, 5.94, 1.7, 5.2, 4.55, { name: "Nursing care" });
  await icon(s, fa.FaUserNurse, 6.14, 1.88, 0.55, HEX.accent3, "FFFFFF", "Nursing care");
  T(s, "Nursing care", { x: 6.84, y: 1.88, w: 3.5, h: 0.55, valign: "middle", fontSize: 21, bold: true, fontFace: "Cambria" });
  const nc = ["Monitor **temperature** and **respiratory rate**.", "Encourage **fluid intake**.", "Keep the **nose clean**.", "Provide **adequate nutrition**.", "Educate parents about **handwashing**."];
  for (let i = 0; i < 5; i++) {
    const y = 2.62 + i * 0.7;
    s.addShape(pres.shapes.OVAL, { x: 6.2, y: y + 0.1, w: 0.38, h: 0.38, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "Step number" });
    T(s, String(i + 1), { x: 6.2, y: y + 0.1, w: 0.38, h: 0.38, align: "center", valign: "middle", fontSize: 13, bold: true, color: C.background1 });
    T(s, rich(nc[i]), { x: 6.8, y, w: 4.2, h: 0.58, valign: "middle", fontSize: 16 });
  }
  callout(s, M, 6.5, W - 2 * M, 1.0, [{ text: "Note: ", options: { bold: true } }, { text: "Antibiotics are " }, { text: "not indicated", options: { bold: true, color: RED } }, { text: " for common cold." }], "FDE7EA", "F7C4CC");
  await icon(s, fa.FaBan, M + 0.18, 6.71, 0.58, RED, "FFFFFF", "Not indicated");

  /* ================= PART 2 · PHARYNGITIS ================= */
  section("Part 2 · Pharyngitis");
  await divider(2, "Pharyngitis", "Definition and causes · clinical manifestations · physical examination · diagnosis and management", fa.FaHeadSideVirus);

  s = content(2, "Pharyngitis", "Definition and causes");
  callout(s, M, 1.7, 5.25, 1.25, [{ text: "Pharyngitis is " }, { text: "inflammation of the pharynx", options: { bold: true } }, { text: " (throat), causing " }, { text: "pain", options: { bold: true } }, { text: " and " }, { text: "difficulty swallowing", options: { bold: true } }, { text: "." }], SOFT);
  await icon(s, fa.FaNotesMedical, M + 0.18, 2.03, 0.58, HEX.accent2, "FFFFFF", "Definition");
  card(s, M, 3.15, 5.25, 4.35, { name: "Pharynx illustration" });
  await img(s, "pharynx", M + 0.2, 3.3, 4.85, 4.05, "Open mouth with an inflamed posterior pharyngeal wall");
  T(s, "CAUSES", { x: 6.0, y: 1.7, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  card(s, 6.0, 2.05, 5.14, 3.0, { name: "Viral causes" });
  await icon(s, fa.FaVirus, 6.2, 2.22, 0.6, HEX.accent3, "FFFFFF", "Viral");
  T(s, "Viral", { x: 6.95, y: 2.22, w: 3, h: 0.6, valign: "middle", fontSize: 22, bold: true, fontFace: "Cambria", color: C.accent3 });
  ["Adenovirus", "Influenza virus", "Rhinovirus"].forEach((v, i) => { card(s, 6.2, 3.0 + i * 0.66, 4.74, 0.54, { fill: SOFT2, line: SOFT2, shadow: false, name: v }); T(s, v, { x: 6.4, y: 3.0 + i * 0.66, w: 4.4, h: 0.54, valign: "middle", fontSize: 16, bold: true }); });
  card(s, 6.0, 5.3, 5.14, 2.2, { name: "Bacterial cause" });
  await icon(s, fa.FaBacteria, 6.2, 5.47, 0.6, HEX.accent5, "FFFFFF", "Bacterial");
  T(s, "Bacterial", { x: 6.95, y: 5.47, w: 3, h: 0.6, valign: "middle", fontSize: 22, bold: true, fontFace: "Cambria", color: C.accent5 });
  card(s, 6.2, 6.3, 4.74, 0.7, { fill: SOFT3, line: SOFT3, shadow: false, name: "GAS" });
  T(s, "Group A Streptococcus (GAS)", { x: 6.4, y: 6.3, w: 4.4, h: 0.7, valign: "middle", fontSize: 17, bold: true });

  s = content(2, "Pharyngitis", "Clinical manifestations");
  const pSx = [[fa.FaHeadSideVirus, "Sore throat", HEX.accent2, SOFT], [gi.GiMouthWatering, "Painful swallowing", HEX.accent1, SOFT, "Odynophagia"], [fa.FaTemperatureHigh, "Fever", RED, SOFT], [fa.FaFaceTired, "Headache", HEX.accent5, SOFT3], [fa.FaUtensils, "Poor appetite", HEX.accent2, SOFT], [fa.FaStethoscope, "Enlarged cervical lymph nodes", HEX.accent3, SOFT2]];
  for (let i = 0; i < 6; i++) await tile(s, M + (i % 2) * 3.55, 1.7 + Math.floor(i / 2) * 1.97, 3.42, 1.83, pSx[i][0], pSx[i][1], pSx[i][2], pSx[i][3], pSx[i][4]);
  card(s, 7.75, 1.7, 3.39, 5.8, { name: "Viral infection may cause" });
  await icon(s, fa.FaVirus, 7.95, 1.9, 0.6, HEX.accent3, "FFFFFF", "Viral");
  T(s, "Viral infection may cause", { x: 7.95, y: 2.6, w: 3.0, h: 0.9, fontSize: 20, bold: true, fontFace: "Cambria" });
  const vir = [[fa.FaHeadSideCough, "Cough"], [gi.GiNoseFront, "Runny nose"], [fa.FaMicrophoneSlash, "Hoarseness"]];
  for (let i = 0; i < 3; i++) {
    const y = 3.75 + i * 1.15;
    card(s, 7.95, y, 2.99, 0.95, { fill: SOFT2, line: SOFT2, shadow: false, name: vir[i][1] });
    await icon(s, vir[i][0], 8.1, y + 0.17, 0.6, HEX.accent3, "FFFFFF", vir[i][1]);
    T(s, vir[i][1], { x: 8.85, y, w: 2.0, h: 0.95, valign: "middle", fontSize: 17, bold: true });
  }

  s = content(2, "Pharyngitis", "Physical examination");
  card(s, M, 1.7, 5.4, 5.8, { name: "Throat views" });
  await img(s, "throat-0", M + 0.15, 1.85, 2.5, 4.9, "3D open-mouth view of a normal throat");
  await img(s, "throat-2", M + 2.75, 1.85, 2.5, 4.9, "3D open-mouth view of pharyngitis");
  pill(s, M + 0.55, 6.85, 1.7, 0.42, "Normal", "D9F2E8", HEX.accent6);
  pill(s, M + 3.15, 6.85, 1.7, 0.42, "Pharyngitis", SOFT, HEX.accent2);
  const pex = [["General examination", fa.FaUser, HEX.accent1, ["Child may **appear ill**.", "**Fever** may be present."], 1.45],
    ["Throat examination", gi.GiMouthWatering, HEX.accent2, ["**Redness** of posterior pharyngeal wall.", "Pharyngeal **swelling**.", "Possible **white patches** or exudates."], 1.85],
    ["Neck examination", fa.FaStethoscope, HEX.accent3, ["**Enlarged** cervical lymph nodes.", "**Tender anterior** cervical lymph nodes, especially in **bacterial** infection."], 1.95]];
  let yy = 1.7;
  for (const [t, I, c, b, h] of pex) {
    card(s, 6.15, yy, 4.99, h + 0.05, { name: t });
    await icon(s, I, 6.3, yy + 0.15, 0.48, c, "FFFFFF", t);
    T(s, t, { x: 6.92, y: yy + 0.15, w: 4, h: 0.48, valign: "middle", fontSize: 18, bold: true, fontFace: "Cambria" });
    richBullets(s, b, 6.35, yy + 0.72, 4.65, h - 0.75, { fontSize: 15 });
    yy += h + 0.2;
  }

  s = content(2, "Pharyngitis", "Diagnosis and management");
  card(s, M, 1.7, W - 2 * M, 1.95, { name: "Diagnosis" });
  T(s, "DIAGNOSIS", { x: M + 0.25, y: 1.82, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  const dx = [[fa.FaMagnifyingGlass, "Clinical examination", "", HEX.accent1], [fa.FaVial, "Rapid antigen detection test", "RADT", HEX.accent2], [fa.FaFlask, "Throat culture", "when indicated", HEX.accent3]];
  for (let i = 0; i < 3; i++) {
    const x = M + 0.3 + i * 3.55;
    await icon(s, dx[i][0], x, 2.32, 0.7, dx[i][3], "FFFFFF", dx[i][1]);
    T(s, dx[i][2] ? [{ text: dx[i][1], options: { bold: true, breakLine: true } }, { text: dx[i][2], options: { fontSize: 13, bold: true, color: dx[i][3] } }] : dx[i][1], { x: x + 0.85, y: 2.2, w: 2.2, h: 0.95, valign: "middle", fontSize: 16, bold: !dx[i][2] });
    if (i < 2) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 3.1, y: 2.55, w: 0.35, h: 0.25, fill: { color: LINE }, line: { type: "none" }, objectName: "Arrow" });
  }
  card(s, M, 3.85, 5.2, 2.5, { name: "Viral pharyngitis" });
  await icon(s, fa.FaVirus, M + 0.2, 4.02, 0.55, HEX.accent3, "FFFFFF", "Viral");
  T(s, "Viral pharyngitis", { x: M + 0.9, y: 4.02, w: 4, h: 0.55, valign: "middle", fontSize: 20, bold: true, fontFace: "Cambria", color: C.accent3 });
  const vt = [[fa.FaGlassWater, "Fluids"], [fa.FaBed, "Rest"], [fa.FaPills, "Paracetamol"]];
  for (let i = 0; i < 3; i++) {
    const x = M + 0.2 + i * 1.62;
    card(s, x, 4.85, 1.5, 1.3, { fill: SOFT2, line: SOFT2, shadow: false, name: vt[i][1] });
    await icon(s, vt[i][0], x + 0.5, 4.97, 0.5, HEX.accent3, "FFFFFF", vt[i][1]);
    T(s, vt[i][1], { x, y: 5.55, w: 1.5, h: 0.45, align: "center", valign: "middle", fontSize: 15, bold: true });
  }
  card(s, 5.94, 3.85, 5.2, 2.5, { name: "Bacterial pharyngitis" });
  await icon(s, fa.FaBacteria, 6.14, 4.02, 0.55, HEX.accent5, "FFFFFF", "Bacterial");
  T(s, "Bacterial pharyngitis", { x: 6.84, y: 4.02, w: 4, h: 0.55, valign: "middle", fontSize: 20, bold: true, fontFace: "Cambria", color: C.accent5 });
  T(s, [{ text: "Antibiotics", options: { bold: true } }, { text: " such as " }, { text: "Penicillin", options: { bold: true, color: C.accent5 } }, { text: " or " }, { text: "Amoxicillin", options: { bold: true, color: C.accent5 } }, { text: " when indicated", options: { bold: true } }, { text: "." }],
    { x: 6.14, y: 4.85, w: 4.8, h: 1.3, valign: "middle", fontSize: 18 });
  callout(s, M, 6.55, W - 2 * M, 0.95, [{ text: "Important: ", options: { bold: true } }, { text: "Antibiotics do " }, { text: "not", options: { bold: true, color: RED } }, { text: " treat viral infections." }], "FDE7EA", "F7C4CC");
  await icon(s, fa.FaTriangleExclamation, M + 0.18, 6.74, 0.56, RED, "FFFFFF", "Important");

  /* ================= PART 3 · TONSILLITIS ================= */
  section("Part 3 · Tonsillitis");
  await divider(3, "Tonsillitis", "Definition and causes · clinical manifestations · physical examination · management · nursing care · complications", gi.GiMouthWatering);

  s = content(3, "Tonsillitis", "Definition and causes");
  card(s, M, 1.7, 5.0, 5.8, { name: "Tonsils illustration" });
  await img(s, "tonsils", M + 0.2, 1.85, 4.6, 5.5, "Open mouth showing the palatine tonsils on both sides of the throat");
  callout(s, 5.75, 1.7, 5.39, 1.35, [{ text: "Tonsillitis is " }, { text: "inflammation of the palatine tonsils", options: { bold: true } }, { text: ", located on " }, { text: "both sides of the throat", options: { bold: true } }, { text: "." }], SOFT2);
  await icon(s, fa.FaNotesMedical, 5.93, 2.08, 0.58, HEX.accent3, "FFFFFF", "Definition");
  T(s, "CAUSES", { x: 5.75, y: 3.3, w: 3, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  card(s, 5.75, 3.7, 5.39, 1.75, { name: "Viral infections" });
  await icon(s, fa.FaVirus, 5.98, 4.1, 0.95, HEX.accent3, "FFFFFF", "Viral");
  T(s, "Viral infections", { x: 7.15, y: 3.95, w: 3.8, h: 0.6, valign: "middle", fontSize: 22, bold: true, fontFace: "Cambria" });
  pill(s, 7.15, 4.65, 1.75, 0.38, "most common", SOFT2, HEX.accent3);
  card(s, 5.75, 5.75, 5.39, 1.75, { name: "Bacterial infections" });
  await icon(s, fa.FaBacteria, 5.98, 6.15, 0.95, HEX.accent5, "FFFFFF", "Bacterial");
  T(s, [{ text: "Bacterial infections", options: { bold: true, fontSize: 22, fontFace: "Cambria", breakLine: true } }, { text: "especially " }, { text: "Group A Streptococcus", options: { bold: true } }], { x: 7.15, y: 5.85, w: 3.85, h: 1.55, valign: "middle", fontSize: 16 });

  s = content(3, "Tonsillitis", "Clinical manifestations");
  const tSx = [[fa.FaHeadSideVirus, "Sore throat", HEX.accent2, SOFT], [fa.FaTemperatureHigh, "Fever", RED, SOFT], [gi.GiMouthWatering, "Difficulty swallowing", HEX.accent1, SOFT], [gi.GiMouthWatering, "Enlarged tonsils", HEX.accent3, SOFT2],
    [fa.FaBacteria, "White or yellow patches on tonsils", HEX.accent5, SOFT3], [fa.FaWind, "Bad breath", HEX.accent4, SOFT4], [fa.FaStethoscope, "Enlarged cervical lymph nodes", HEX.accent1, SOFT], [fa.FaUtensils, "Decreased appetite", HEX.accent2, SOFT]];
  for (let i = 0; i < 8; i++) await tile(s, M + (i % 2) * 3.55, 1.7 + Math.floor(i / 2) * 1.47, 3.42, 1.35, tSx[i][0], tSx[i][1], tSx[i][2], tSx[i][3]);
  card(s, 7.75, 1.7, 3.39, 5.8, { name: "In young children" });
  await icon(s, fa.FaChild, 7.95, 1.9, 0.6, HEX.accent1, "FFFFFF", "Young children");
  T(s, "In young children", { x: 7.95, y: 2.6, w: 3.0, h: 0.6, fontSize: 20, bold: true, fontFace: "Cambria" });
  const yc = [[fa.FaBan, "Refusal to eat or drink", HEX.accent1, SOFT], [gi.GiVomiting, "Vomiting", HEX.accent5, SOFT3], [fa.FaFaceDizzy, "Irritability", HEX.accent3, SOFT2]];
  for (let i = 0; i < 3; i++) {
    const y = 3.5 + i * 1.3;
    card(s, 7.95, y, 2.99, 1.1, { fill: yc[i][3], line: yc[i][3], shadow: false, name: yc[i][1] });
    await icon(s, yc[i][0], 8.1, y + 0.25, 0.6, yc[i][2], "FFFFFF", yc[i][1]);
    T(s, yc[i][1], { x: 8.85, y, w: 2.0, h: 1.1, valign: "middle", fontSize: 16, bold: true });
  }

  s = content(3, "Tonsillitis", "Physical examination");
  card(s, M, 1.7, 5.9, 5.8, { name: "Tonsil views" });
  const tv = [["throat-0", "Normal", "D9F2E8", HEX.accent6], ["throat-3", "Tonsillitis", SOFT2, HEX.accent3], ["throat-4", "Severe", "FDE7EA", RED]];
  for (let i = 0; i < 3; i++) {
    await img(s, tv[i][0], M + 0.12 + i * 1.9, 1.9, 1.8, 4.75, "3D open-mouth view: " + tv[i][1]);
    pill(s, M + 0.22 + i * 1.9, 6.85, 1.6, 0.42, tv[i][1], tv[i][2], tv[i][3]);
  }
  const tex = [["General examination", fa.FaUser, HEX.accent1, ["**Fever**.", "Child may appear **sick and uncomfortable**."], 1.45],
    ["Mouth and throat examination", gi.GiMouthWatering, HEX.accent3, ["**Enlarged** tonsils.", "**Red and swollen** tonsils.", "**White or yellowish exudates** may be present.", "Severe cases: tonsils **nearly touching each other**."], 2.55],
    ["Neck examination", fa.FaStethoscope, HEX.accent2, ["**Enlarged and tender anterior** cervical lymph nodes."], 1.25]];
  yy = 1.7;
  for (const [t, I, c, b, h] of tex) {
    card(s, 6.65, yy, 4.49, h + 0.05, { name: t });
    await icon(s, I, 6.8, yy + 0.15, 0.48, c, "FFFFFF", t);
    T(s, t, { x: 7.42, y: yy + 0.15, w: 3.6, h: 0.48, valign: "middle", fontSize: 17, bold: true, fontFace: "Cambria" });
    richBullets(s, b, 6.85, yy + 0.72, 4.15, h - 0.75, { fontSize: 15 });
    yy += h + 0.2;
  }

  s = content(3, "Tonsillitis", "Medical and surgical management");
  T(s, "MEDICAL MANAGEMENT", { x: M, y: 1.65, w: 4, h: 0.3, fontSize: 12, bold: true, color: MUTED, charSpacing: 2 });
  const med = [[fa.FaPills, "Paracetamol", "for pain and fever", RED, SOFT], [fa.FaGlassWater, "Adequate fluids", "", HEX.accent4, SOFT4], [fa.FaBowlFood, "Soft diet", "", HEX.accent1, SOFT], [fa.FaCapsules, "Antibiotics", "if bacterial infection is confirmed or indicated", HEX.accent5, SOFT3]];
  for (let i = 0; i < 4; i++) {
    const x = M + i * 2.68;
    card(s, x, 2.0, 2.53, 2.1, { fill: med[i][4], line: med[i][4], shadow: false, name: med[i][1] });
    await icon(s, med[i][0], x + 0.92, 2.15, 0.7, med[i][3], "FFFFFF", med[i][1]);
    T(s, med[i][2] ? [{ text: med[i][1], options: { bold: true, fontSize: 18, fontFace: "Cambria", breakLine: true } }, { text: med[i][2], options: { fontSize: 13, color: MUTED } }] : [{ text: med[i][1], options: { bold: true, fontSize: 18, fontFace: "Cambria" } }],
      { x: x + 0.12, y: 2.95, w: 2.29, h: 1.05, align: "center", valign: "middle" });
  }
  card(s, M, 4.35, W - 2 * M, 3.15, { name: "Surgical management" });
  await img(s, "tonsillectomy", M + 0.3, 4.5, 4.3, 2.85, "Tonsillectomy: removal of the tonsils");
  T(s, "SURGICAL MANAGEMENT", { x: 5.4, y: 4.6, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.accent3, charSpacing: 2 });
  T(s, [{ text: "Tonsillectomy", options: { bold: true, fontSize: 26, fontFace: "Cambria", breakLine: true } }, { text: "Removal of tonsils, may be indicated in:", options: { fontSize: 16 } }], { x: 5.4, y: 4.95, w: 5.5, h: 1.0 });
  const surg = [[fa.FaRepeat, "Recurrent severe infections", HEX.accent3, SOFT2], [fa.FaMoon, "Obstructive sleep apnea", HEX.accent4, SOFT4]];
  for (let i = 0; i < 2; i++) {
    card(s, 5.4, 6.05 + i * 0.68, 5.5, 0.58, { fill: surg[i][3], line: surg[i][3], shadow: false, name: surg[i][1] });
    await icon(s, surg[i][0], 5.52, 6.12 + i * 0.68, 0.44, surg[i][2], "FFFFFF", surg[i][1]);
    T(s, surg[i][1], { x: 6.1, y: 6.05 + i * 0.68, w: 4.7, h: 0.58, valign: "middle", fontSize: 16, bold: true });
  }

  s = content(3, "Tonsillitis", "Nursing care");
  const tn = [[fa.FaTemperatureHigh, "Monitor temperature", RED], [gi.GiMouthWatering, "Assess swallowing difficulties", HEX.accent1], [fa.FaGlassWater, "Encourage fluids", HEX.accent4], [fa.FaBowlFood, "Provide soft foods", HEX.accent2],
    [fa.FaSyringe, "Administer prescribed medications", HEX.accent3], [fa.FaDroplet, "Monitor for dehydration", HEX.accent5], [fa.FaCapsules, "Educate parents about completing prescribed antibiotics", HEX.accent5]];
  for (let i = 0; i < 7; i++) {
    const wide = i === 6, x = M + (i % 4) * 2.68, y = i < 4 ? 1.7 : 4.7, w = wide ? 5.21 : 2.53;
    card(s, x, y, w, 2.8, { name: "Nursing care " + (i + 1) });
    T(s, String(i + 1), { x: x + w - 0.75, y: y + 0.12, w: 0.6, h: 0.6, align: "right", fontSize: 30, bold: true, fontFace: "Cambria", color: "F3C2D6" });
    await icon(s, tn[i][0], x + 0.25, y + 0.35, 0.7, tn[i][2], "FFFFFF", tn[i][1]);
    T(s, wide ? [{ text: "Educate parents about " }, { text: "completing prescribed antibiotics", options: { color: C.accent5 } }] : tn[i][1], { x: x + 0.25, y: y + 1.25, w: w - 0.45, h: 1.35, fontSize: 18, bold: true, fontFace: "Cambria" });
  }

  s = content(3, "Tonsillitis", "Complications");
  card(s, M, 1.7, 4.4, 5.8, { name: "Complications map" });
  await img(s, "complications", M + 0.15, 1.85, 4.1, 5.5, "Body map of the complications");
  card(s, 5.15, 1.7, 5.99, 2.85, { name: "Possible complications" });
  await icon(s, fa.FaTriangleExclamation, 5.35, 1.88, 0.5, RED, "FFFFFF", "Possible complications");
  T(s, "Possible complications", { x: 6.0, y: 1.88, w: 4.5, h: 0.5, valign: "middle", fontSize: 20, bold: true, fontFace: "Cambria" });
  const cp = [[fa.FaEarListen, "Otitis media", HEX.accent4, SOFT4], [gi.GiMouthWatering, "Peritonsillar abscess", HEX.accent3, SOFT2], [fa.FaDroplet, "Dehydration", HEX.accent5, SOFT3], [fa.FaLungs, "Airway obstruction (severe cases)", RED, "FDE7EA"]];
  for (let i = 0; i < 4; i++) {
    const x = 5.35 + (i % 2) * 2.85, y = 2.6 + Math.floor(i / 2) * 0.9;
    card(s, x, y, 2.74, 0.78, { fill: cp[i][3], line: cp[i][3], shadow: false, name: cp[i][1] });
    await icon(s, cp[i][0], x + 0.12, y + 0.15, 0.48, cp[i][2], "FFFFFF", cp[i][1]);
    T(s, cp[i][1], { x: x + 0.7, y, w: 1.98, h: 0.78, valign: "middle", fontSize: 15, bold: true });
  }
  card(s, 5.15, 4.75, 5.99, 2.75, { name: "GAS complications" });
  await icon(s, fa.FaBacteria, 5.35, 4.92, 0.5, HEX.accent5, "FFFFFF", "Group A Streptococcus");
  T(s, "Complications of Group A Streptococcal infection", { x: 6.0, y: 4.88, w: 5.0, h: 0.6, valign: "middle", fontSize: 18, bold: true, fontFace: "Cambria" });
  const gc = [[fa.FaHeartPulse, "Acute rheumatic fever", HEX.accent2, SOFT], [gi.GiKidneys, "Post-streptococcal glomerulonephritis", HEX.accent5, SOFT3]];
  for (let i = 0; i < 2; i++) {
    const x = 5.35 + i * 2.85;
    card(s, x, 5.65, 2.74, 1.65, { fill: gc[i][3], line: gc[i][3], shadow: false, name: gc[i][1] });
    await icon(s, gc[i][0], x + 1.05, 5.78, 0.62, gc[i][2], "FFFFFF", gc[i][1]);
    T(s, gc[i][1], { x: x + 0.1, y: 6.45, w: 2.54, h: 0.75, align: "center", valign: "middle", fontSize: 15, bold: true });
  }

  /* ================= PART 4 · COMPARISON ================= */
  section("Part 4 · Comparison");
  await divider(4, "Comparison", "Comparison between the three conditions", fa.FaScaleBalanced || fa.FaArrowRight);

  s = content(4, "Comparison", "Comparison between the three conditions");
  const cmp = [["Common cold", "Mainly affects the nose", gi.GiNoseFront, HEX.accent1, SOFT, ["Runny nose and sneezing.", "Mild fever.", "Normal tonsils usually."], "cmp-cold"],
    ["Pharyngitis", "Affects the pharynx", fa.FaHeadSideVirus, HEX.accent2, SOFT, ["Redness of posterior pharyngeal wall.", "Sore throat and painful swallowing."], "cmp-phar"],
    ["Tonsillitis", "Affects the tonsils", gi.GiMouthWatering, HEX.accent3, SOFT2, ["Enlarged and red tonsils.", "Possible tonsillar exudates.", "Fever and difficulty swallowing."], "cmp-tons"]];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 3.6, w = 3.39;
    card(s, x, 1.7, w, 5.8, { name: cmp[i][0] });
    await icon(s, cmp[i][2], x + 0.2, 1.9, 0.7, cmp[i][3], "FFFFFF", cmp[i][0]);
    T(s, cmp[i][0], { x: x + 1.05, y: 1.85, w: w - 1.2, h: 0.45, fontSize: 22, bold: true, fontFace: "Cambria" });
    pill(s, x + 1.05, 2.3, w - 1.25, 0.34, cmp[i][1], cmp[i][4], cmp[i][3], { fontSize: 12 });
    bullets(s, cmp[i][5], x + 0.25, 2.95, w - 0.45, 2.2, { fontSize: 16 });
    await img(s, cmp[i][6], x + 0.25, 5.2, w - 0.5, 2.1, cmp[i][0]);
  }

  s = content(4, "Comparison", "Look into the throat: the four views");
  const views = [["throat-1", "Common cold", "Mild redness of the pharynx · tonsils usually normal", HEX.accent1, SOFT], ["throat-2", "Pharyngitis", "Redness and swelling of the posterior pharyngeal wall · possible white patches", HEX.accent2, SOFT],
    ["throat-3", "Tonsillitis", "Enlarged, red and swollen tonsils · possible exudates", HEX.accent3, SOFT2], ["throat-4", "Severe tonsillitis", "Tonsils nearly touching each other", RED, "FDE7EA"]];
  for (let i = 0; i < 4; i++) {
    const x = M + i * 2.68, w = 2.53;
    card(s, x, 1.7, w, 5.8, { name: views[i][1] });
    await img(s, views[i][0], x + 0.12, 1.82, w - 0.24, 3.7, "3D open-mouth view: " + views[i][1]);
    pill(s, x + 0.2, 5.65, w - 0.4, 0.4, views[i][1], views[i][4], views[i][3], { fontSize: 14 });
    T(s, views[i][2], { x: x + 0.18, y: 6.15, w: w - 0.36, h: 1.2, fontSize: 13, color: MUTED, align: "center" });
  }

  /* ================= END ================= */
  s = pres.addSlide({ masterName: "Cover", sectionTitle: sec });
  await img(s, "end", 3.85, 0.9, 4.0, 2.4, "Viruses and streptococci");
  T(s, "Thank you", { x: 1, y: 3.4, w: W - 2, h: 1.3, align: "center", valign: "middle", fontSize: 66, bold: true, italic: true, fontFace: "Cambria", color: C.accent1 });
  T(s, LESSON, { x: 1, y: 4.7, w: W - 2, h: 0.5, align: "center", fontSize: 20, color: MUTED });
  card(s, 3.55, 5.5, 4.6, 1.0, { name: "Presenter card" });
  await icon(s, fa.FaUserDoctor, 3.75, 5.7, 0.6, HEX.accent1, "FFFFFF", "Presenter");
  T(s, [{ text: "PRESENTED BY", options: { fontSize: 10, bold: true, color: MUTED, charSpacing: 2, breakLine: true } }, { text: AUTHOR + "  ", options: { fontSize: 19, bold: true, fontFace: "Cambria" } }, { text: "MBBS", options: { fontSize: 12, bold: true, color: C.accent1 } }],
    { x: 4.55, y: 5.5, w: 3.5, h: 1.0, valign: "middle" });

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("Wrote " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
