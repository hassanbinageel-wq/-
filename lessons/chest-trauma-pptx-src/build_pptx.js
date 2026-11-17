// Editable PowerPoint version of the Chest Trauma lesson (A4 landscape, light theme).
// Usage: NODE_PATH=<dir with pptxgenjs, sharp, react, react-dom, react-icons> node build_pptx.js [out.pptx]
// then: python3 fix_ppr.py out.pptx && python3 transitions.py out.pptx
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
const OUT = process.argv[2] || path.join(__dirname, "..", "Chest-Trauma.pptx");
const AUTHOR = "Dr. Ruqaiah Alhebshi";
const LESSON = "Chest Trauma";

const THEME = {
  name: "Chest Trauma Light", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: "16202C", lt1: "FFFFFF", dk2: "3B4A5C", lt2: "F4F6F9", accent1: "C8102E", accent2: "1C6DD0", accent3: "D9730D", accent4: "0B8F8A", accent5: "7A4FD0", accent6: "1A9E5C", hlink: "1C6DD0", folHlink: "7A4FD0" }
};
const HEX = THEME.colors;
const MUTED = "6B7A8C", LINE = "DDE4EC", AIR = "2F9BE0";
const TINT = { red: "FCE8EB", blue: "E6F0FB", orange: "FCEEDD", teal: "E1F4F3", purple: "EFE9FB", green: "E3F5EB", air: "E4F2FC" };

const pres = new pptxgen();
pres.defineLayout({ name: "A4L", width: 11.69, height: 8.27 });
pres.layout = "A4L";
pres.title = LESSON;
pres.author = AUTHOR + ", MBBS";
pres.subject = "Chest trauma: assessment, chest wall injuries and pleural injuries";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const PART = { 1: C.accent1, 2: C.accent2, 3: C.accent3, 4: C.accent4 };
const PARTHEX = { 1: HEX.accent1, 2: HEX.accent2, 3: HEX.accent3, 4: HEX.accent4 };
const PARTTINT = { 1: TINT.red, 2: TINT.blue, 3: TINT.orange, 4: TINT.teal };
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
  title: "Section", background: { color: C.background1 },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.9, y: 3.1, w: 6.4, h: 1.5, fontSize: 50, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } }]
});
pres.defineSlideMaster({ title: "Cover", background: { color: C.background1 }, objects: [] });

/* ---------- helpers ---------- */
const cache = {};
async function asset(n) {
  if (!cache[n]) {
    const f = path.join(ASSETS, n + ".png");
    const { data, info } = await sharp(f).trim().png().toBuffer({ resolveWithObject: true });   // drop the empty margin around each capture
    cache[n] = { w: info.width, h: info.height, data: "image/png;base64," + data.toString("base64") };
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
async function icon(s, I, x, y, d, circleColor, alt) {   // icon in a coloured circle (the circle stays an editable shape)
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: circleColor }, line: { type: "none" }, objectName: "Icon circle" });
  const p = d * 0.25;
  s.addImage({ data: await iconPng(I, "FFFFFF"), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: alt || "icon", objectName: "Icon: " + (alt || "") });
}
function T(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: C.text1, valign: "top" }, o)); }
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, objectName: o.name || "Card", fill: { color: o.fill || "FFFFFF" }, line: { color: o.line || LINE, width: 0.75 },
    shadow: o.shadow === false ? undefined : { type: "outer", color: "16202C", opacity: 0.1, blur: 8, offset: 2, angle: 90 } });
}
function tint(s, x, y, w, h, fill, name) { card(s, x, y, w, h, { fill, line: fill, shadow: false, name }); }
function rich(str, base = {}) {   // "plain **bold** plain"
  return str.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => p.startsWith("**") ? { text: p.slice(2, -2), options: Object.assign({}, base, { bold: true }) } : { text: p, options: Object.assign({}, base) });
}
function bullets(s, items, x, y, w, h, o = {}) {
  const runs = [];
  items.forEach((t, i) => { const r = rich(t); r[0].options.bullet = true; r[r.length - 1].options.breakLine = i < items.length - 1; runs.push(...r); }); // fix_ppr.py drops the stray mid-paragraph pPr
  T(s, runs, Object.assign({ x, y, w, h, fontSize: 16, paraSpaceAfter: 7 }, o));
}
function pill(s, x, y, w, h, text, fill, color, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { type: "none" }, objectName: "Pill: " + text });
  T(s, text, { x, y, w, h, align: "center", valign: "middle", fontSize: o.fontSize || 13, bold: true, color });
}
function label(s, text, x, y, w, color) { T(s, text.toUpperCase(), { x, y, w: w || 5, h: 0.3, fontSize: 12, bold: true, color: color || MUTED, charSpacing: 2 }); }
let sec = "";
function section(title) { pres.addSection({ title }); sec = title; }
function content(part, eyebrow, title) {
  const s = pres.addSlide({ masterName: "Content", sectionTitle: sec });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 0.36, w: 0.42, h: 0.28, rectRadius: 0.06, fill: { color: PART[part] }, line: { type: "none" }, objectName: "Part number" });
  T(s, "0" + part, { x: M, y: 0.36, w: 0.42, h: 0.28, align: "center", valign: "middle", fontSize: 11, bold: true, color: C.background1 });
  T(s, eyebrow.toUpperCase(), { x: M + 0.55, y: 0.36, w: 7, h: 0.28, valign: "middle", fontSize: 12, bold: true, color: PART[part], charSpacing: 2 });
  s.addText(title, { placeholder: "title" });
  return s;
}
async function divider(part, name, sub, I) {
  const s = pres.addSlide({ masterName: "Section", sectionTitle: sec });
  T(s, "PART " + part, { x: 0.9, y: 2.5, w: 5, h: 0.45, fontSize: 18, bold: true, color: PART[part], charSpacing: 4 });
  s.addText(name, { placeholder: "title" });
  T(s, sub, { x: 0.9, y: 4.7, w: 6.2, h: 1.0, fontSize: 18, color: MUTED });
  s.addShape(pres.shapes.OVAL, { x: 7.75, y: 1.95, w: 3.6, h: 3.6, fill: { color: PARTTINT[part] }, line: { type: "none" }, objectName: "Halo" });
  s.addShape(pres.shapes.OVAL, { x: 8.35, y: 2.55, w: 2.4, h: 2.4, fill: { color: PART[part] }, line: { type: "none" }, objectName: "Icon circle" });
  s.addImage({ data: await iconPng(I, "FFFFFF"), x: 8.9, y: 3.1, w: 1.3, h: 1.3, altText: name, objectName: "Icon: " + name });
}
async function tile(s, x, y, w, h, I, text, colHex, fill, sub) {   // tinted tile: icon on top, centred label
  tint(s, x, y, w, h, fill, text);
  const d = 0.66;
  await icon(s, I, x + (w - d) / 2, y + h * 0.5 - d - 0.08, d, colHex, text);
  T(s, sub ? [{ text, options: { bold: true, breakLine: true } }, { text: sub, options: { italic: true, color: colHex, fontSize: 13 } }] : [{ text, options: { bold: true } }],
    { x: x + 0.1, y: y + h * 0.5 + 0.04, w: w - 0.2, h: h * 0.5 - 0.12, align: "center", valign: "top", fontSize: 16 });
}
async function row(s, x, y, w, h, I, text, colHex, fill, o = {}) {   // tinted row: icon left, label right
  tint(s, x, y, w, h, fill, text.replace(/\*\*/g, ""));
  const d = Math.min(0.5, h - 0.16);
  await icon(s, I, x + 0.14, y + (h - d) / 2, d, colHex, text.replace(/\*\*/g, ""));
  T(s, rich(text, { bold: o.bold !== false }), { x: x + 0.28 + d, y, w: w - d - 0.4, h, valign: "middle", fontSize: o.fontSize || 16 });
}
async function callout(s, x, y, w, h, I, colHex, fill, runs, fontSize) {
  tint(s, x, y, w, h, fill, "Callout");
  const d = Math.min(0.58, h - 0.2);
  await icon(s, I, x + 0.18, y + (h - d) / 2, d, colHex, "");
  T(s, runs, { x: x + 0.36 + d, y, w: w - d - 0.55, h, valign: "middle", fontSize: fontSize || 17 });
}
async function head(s, x, y, I, colHex, text, w) {   // card header: icon + heading
  await icon(s, I, x, y, 0.5, colHex, text);
  T(s, text, { x: x + 0.65, y, w: w || 4, h: 0.5, valign: "middle", fontSize: 19, bold: true, fontFace: "Cambria" });
}
async function presenter(s, x, y) {
  card(s, x, y, 4.6, 1.0, { name: "Presenter card" });
  await icon(s, fa.FaUserDoctor, x + 0.2, y + 0.2, 0.6, HEX.accent1, "Presenter");
  T(s, [{ text: "PRESENTED BY", options: { fontSize: 10, bold: true, color: MUTED, charSpacing: 2, breakLine: true } }, { text: AUTHOR + "  ", options: { fontSize: 19, bold: true, fontFace: "Cambria" } }, { text: "MBBS", options: { fontSize: 12, bold: true, color: C.accent1 } }],
    { x: x + 1.0, y, w: 3.5, h: 1.0, valign: "middle" });
}
const B = (t) => ({ text: t, options: { bold: true } }), P = (t) => ({ text: t });

(async () => {
  /* ================= COVER ================= */
  section("Introduction to trauma");
  let s = pres.addSlide({ masterName: "Cover", sectionTitle: sec });
  s.addShape(pres.shapes.OVAL, { x: 5.9, y: 0.75, w: 6.6, h: 6.6, fill: { color: TINT.red }, line: { type: "none" }, objectName: "Halo" });
  await img(s, "thorax", 6.2, 0.85, 5.0, 6.5, "3D model of the chest: rib cage, lungs, heart, great vessels and trachea");
  T(s, "EMERGENCY", { x: 0.75, y: 1.9, w: 4, h: 0.3, fontSize: 13, bold: true, color: C.accent1, charSpacing: 4 });
  T(s, [{ text: "Chest ", options: { breakLine: true } }, { text: "Trauma", options: { color: C.accent1, italic: true } }], { x: 0.75, y: 2.3, w: 5.2, h: 2.3, fontSize: 66, bold: true, fontFace: "Cambria", valign: "middle" });
  pill(s, 0.75, 4.8, 2.05, 0.36, "Chest wall injuries", TINT.orange, HEX.accent3);
  pill(s, 2.9, 4.8, 1.75, 0.36, "Pleural injuries", TINT.teal, HEX.accent4);
  await presenter(s, 0.75, 5.5);

  /* ================= PART 1 ================= */
  s = content(1, "Introduction to trauma", "What is trauma?");
  await callout(s, M, 1.7, W - 2 * M, 0.85, fa.FaNotesMedical, HEX.accent1, TINT.red, [P("Trauma is a "), B("physical injury"), P(" caused by an "), B("external force"), P(" that damages body "), B("tissues or organs"), P(".")], 18);
  label(s, "Common causes of trauma", M, 2.78);
  const causes = [[fa.FaCarBurst, "Road traffic accidents", HEX.accent1, TINT.red], [fa.FaPersonFalling, "Falls from heights", HEX.accent3, TINT.orange], [gi.GiBowieKnife, "Stab wounds", HEX.accent5, TINT.purple],
    [fa.FaGun, "Gunshot wounds", HEX.accent2, TINT.blue], [fa.FaFire, "Burns", HEX.accent1, TINT.red], [fa.FaHandFist, "Physical assault", HEX.accent4, TINT.teal]];
  for (let i = 0; i < 6; i++) await tile(s, M + (i % 3) * 1.95, 3.15 + Math.floor(i / 3) * 2.2, 1.83, 2.1, causes[i][0], causes[i][1], causes[i][2], causes[i][3]);
  label(s, "Types of trauma", 6.55, 2.78);
  const types = [["blunt", "Blunt trauma", "Injury **without penetration** of the skin.", C.accent2], ["penetrating", "Penetrating trauma", "Injury caused by an **object entering the body**.", C.accent1]];
  for (let i = 0; i < 2; i++) {
    const y = 3.15 + i * 2.2;
    card(s, 6.55, y, 4.59, 2.1, { name: types[i][1] });
    await img(s, types[i][0], 6.7, y + 0.35, 1.6, 1.4, types[i][1]);
    T(s, types[i][1], { x: 8.45, y: y + 0.35, w: 2.6, h: 0.5, valign: "middle", fontSize: 20, bold: true, fontFace: "Cambria", color: types[i][3] });
    T(s, rich(types[i][2]), { x: 8.45, y: y + 0.9, w: 2.55, h: 1.0, fontSize: 16 });
  }

  s = content(1, "Introduction to trauma", "What is chest trauma?");
  card(s, M, 1.7, 4.7, 5.8, { name: "Chest model" });
  await img(s, "thorax", M + 0.2, 1.85, 4.3, 5.5, "3D model of the chest");
  await callout(s, 5.5, 1.7, 5.64, 1.15, fa.FaNotesMedical, HEX.accent1, TINT.red, [P("Chest trauma is an injury to the "), B("chest wall"), P(" or "), B("internal organs of the chest"), P(".")], 18);
  label(s, "Structures that may be injured", 5.5, 3.08);
  const st = [[fa.FaBone, "Ribs and sternum", HEX.accent3, TINT.orange], [fa.FaLungs, "Lungs", HEX.accent1, TINT.red], [fa.FaLayerGroup, "Pleura", HEX.accent4, TINT.teal],
    [fa.FaHeart, "Heart", HEX.accent1, TINT.red], [fa.FaDroplet, "Great blood vessels", HEX.accent1, TINT.red], [fa.FaWind, "Trachea and bronchi", HEX.accent2, TINT.blue]];
  for (let i = 0; i < 6; i++) await row(s, 5.5 + (i % 2) * 2.88, 3.45 + Math.floor(i / 2) * 1.37, 2.76, 1.25, st[i][0], st[i][1], st[i][2], st[i][3]);

  s = content(1, "Introduction to trauma", "Why is it dangerous?");
  T(s, "Chest trauma can cause:", { x: M, y: 1.65, w: 6, h: 0.4, fontSize: 18, color: C.text2 });
  const dg = [["dg-resp", "Respiratory failure", C.accent2], ["dg-bleed", "Severe bleeding", C.accent1], ["dg-shock", "Shock", C.accent3], ["dg-death", "Death if not treated quickly", C.text2]];
  for (let i = 0; i < 4; i++) {
    const x = M + i * 2.68, w = 2.53;
    card(s, x, 2.2, w, 5.3, { name: dg[i][1] });
    T(s, String(i + 1), { x: x + 0.2, y: 2.3, w: 0.6, h: 0.6, fontSize: 30, bold: true, fontFace: "Cambria", color: dg[i][2] });
    await img(s, dg[i][0], x + 0.3, 3.2, w - 0.6, 1.9, dg[i][1]);
    T(s, i === 3 ? [{ text: "Death ", options: { breakLine: true } }, { text: "if not treated quickly", options: { color: C.accent1 } }] : dg[i][1], { x: x + 0.15, y: 5.4, w: w - 0.3, h: 1.3, align: "center", valign: "middle", fontSize: 22, bold: true, fontFace: "Cambria" });
  }

  s = content(1, "Introduction to trauma", "Classification of chest trauma");
  const cls = [["1", "Blunt chest trauma", "skin not penetrated", "cl-blunt", C.accent2, HEX.accent2, TINT.blue, ["Caused by **road traffic accidents**.", "**Falls**.", "**Direct blows** to the chest.", "May cause **rib fractures** or **lung injuries**."]],
    ["2", "Penetrating chest trauma", "object enters the chest", "cl-pen", C.accent1, HEX.accent1, TINT.red, ["Caused by **knives** or **bullets**.", "May damage the **lungs**, **heart**, or **blood vessels**.", "Can cause **severe internal bleeding**."]]];
  for (let i = 0; i < 2; i++) {
    const x = M + i * 5.39, w = 5.2, c = cls[i];
    card(s, x, 1.7, w, 5.8, { name: c[1] });
    T(s, c[0], { x: x + 0.25, y: 1.85, w: 0.7, h: 0.9, fontSize: 48, bold: true, fontFace: "Cambria", color: c[4], valign: "middle" });
    T(s, c[1], { x: x + 1.0, y: 1.88, w: w - 1.2, h: 0.5, fontSize: 23, bold: true, fontFace: "Cambria", valign: "middle" });
    pill(s, x + 1.0, 2.42, 2.4, 0.33, c[2], c[6], c[5], { fontSize: 12 });
    await img(s, c[3], x + 0.4, 3.0, w - 0.8, 1.75, c[1]);
    bullets(s, c[7], x + 0.3, 5.0, w - 0.55, 2.3, { fontSize: 17 });
  }

  s = content(1, "Introduction to trauma", "Types of chest trauma");
  T(s, [P("Chest trauma includes several injuries affecting the "), B("chest wall"), P(", "), B("lungs"), P(", "), B("pleura"), P(" and "), B("heart"), P(". In this lecture, we will discuss the following conditions:")], { x: M, y: 1.62, w: W - 2 * M, h: 0.7, fontSize: 16, color: C.text2 });
  const tg = [["Chest wall injuries", fa.FaBone, HEX.accent3, TINT.orange, ["Rib fracture", "Flail chest"]], ["Pleural injuries", fa.FaLayerGroup, HEX.accent4, TINT.teal, ["Pneumothorax", "Tension pneumothorax", "Open pneumothorax", "Hemothorax"]],
    ["Lung injuries", fa.FaLungs, HEX.accent1, TINT.red, ["Pulmonary contusion"]], ["Cardiac injuries", fa.FaHeart, HEX.accent1, TINT.red, ["Cardiac tamponade"]]];
  for (let i = 0; i < 4; i++) {
    const x = M + i * 2.68, w = 2.53, g = tg[i];
    card(s, x, 2.45, w, 4.05, { name: g[0] });
    await icon(s, g[1], x + 0.2, 2.62, 0.6, g[2], g[0]);
    T(s, String(i + 1), { x: x + w - 0.6, y: 2.62, w: 0.4, h: 0.4, align: "right", fontSize: 18, bold: true, color: g[2] });
    T(s, g[0], { x: x + 0.2, y: 3.3, w: w - 0.4, h: 0.45, fontSize: 19, bold: true, fontFace: "Cambria", valign: "middle" });
    g[4].forEach((t, k) => { tint(s, x + 0.2, 3.88 + k * 0.62, w - 0.4, 0.52, g[3], t); T(s, t, { x: x + 0.35, y: 3.88 + k * 0.62, w: w - 0.65, h: 0.52, valign: "middle", fontSize: 15, bold: true }); });
  }
  await callout(s, M, 6.7, W - 2 * M, 0.8, fa.FaLink, HEX.accent5, TINT.purple, [B("Note: "), P("These injuries may occur "), B("alone or together"), P(" in the same patient following chest trauma.")]);

  /* ================= PART 2 ================= */
  section("Clinical assessment");
  await divider(2, "Clinical assessment", "The ABCDE approach · clinical signs and symptoms", fa.FaStethoscope);

  s = content(2, "Clinical assessment", "The ABCDE approach");
  T(s, "The initial assessment follows the ABCDE approach.", { x: M, y: 1.62, w: 8, h: 0.4, fontSize: 17, color: C.text2 });
  const abc = [["A", "Airway", "Check if the airway is **open**.", fa.FaWind, C.accent2, HEX.accent2, TINT.blue], ["B", "Breathing", "Assess **respiratory rate**, **chest movement** and **oxygen saturation**.", fa.FaLungs, C.accent4, HEX.accent4, TINT.teal],
    ["C", "Circulation", "Check **pulse**, **blood pressure** and **signs of bleeding**.", fa.FaHeartPulse, C.accent1, HEX.accent1, TINT.red], ["D", "Disability", "Assess **consciousness** and **neurological status**.", fa.FaBrain, C.accent5, HEX.accent5, TINT.purple],
    ["E", "Exposure", "Examine the **whole body** for injuries while **preventing hypothermia**.", fa.FaPerson, C.accent3, HEX.accent3, TINT.orange]];
  for (let i = 0; i < 5; i++) {
    const x = M + i * 2.142, w = 2.02, a = abc[i];
    card(s, x, 2.15, w, 4.25, { name: a[1] });
    T(s, a[0], { x: x + w - 1.15, y: 2.1, w: 1.05, h: 1.25, align: "right", fontSize: 80, bold: true, fontFace: "Cambria", color: a[6] });
    await icon(s, a[3], x + 0.2, 2.4, 0.62, a[5], a[1]);
    T(s, a[1], { x: x + 0.2, y: 3.35, w: w - 0.35, h: 0.5, fontSize: 22, bold: true, fontFace: "Cambria", color: a[4], valign: "middle" });
    T(s, rich(a[2]), { x: x + 0.2, y: 3.95, w: w - 0.35, h: 2.3, fontSize: 16 });
  }
  await callout(s, M, 6.6, W - 2 * M, 0.9, fa.FaTriangleExclamation, HEX.accent1, TINT.red, [B("Important: "), P("Life-threatening problems must be "), B("treated immediately"), P(".")], 19);

  s = content(2, "Clinical assessment", "Clinical signs and symptoms");
  T(s, "Common manifestations of chest trauma:", { x: M, y: 1.62, w: 8, h: 0.4, fontSize: 17, color: C.text2 });
  const sx = [[fa.FaBolt, "Chest pain", HEX.accent1, TINT.red], [fa.FaLungs, "Shortness of breath", HEX.accent2, TINT.blue, "Dyspnea"], [fa.FaWind, "Rapid breathing", HEX.accent4, TINT.teal, "Tachypnea"], [fa.FaHeartPulse, "Rapid heart rate", HEX.accent1, TINT.red, "Tachycardia"],
    [fa.FaDroplet, "Cyanosis", HEX.accent5, TINT.purple], [fa.FaBandage, "Chest wall bruising", HEX.accent3, TINT.orange], [fa.FaStethoscope, "Decreased breath sounds", HEX.accent4, TINT.teal], [fa.FaGaugeSimple || fa.FaGauge, "Hypotension", HEX.accent1, TINT.red, "in severe cases"]];
  for (let i = 0; i < 8; i++) await tile(s, M + (i % 4) * 2.68, 2.15 + Math.floor(i / 4) * 2.72, 2.53, 2.6, sx[i][0], sx[i][1], sx[i][2], sx[i][3], sx[i][4]);

  /* ================= PART 3 ================= */
  section("Chest wall injuries");
  await divider(3, "Chest wall injuries", "Rib fracture · flail chest", fa.FaBone);

  s = content(3, "Chest wall injuries", "Rib fracture");
  card(s, M, 1.7, 4.6, 5.8, { name: "Rib fracture model" });
  await img(s, "fracture", M + 0.2, 1.85, 4.2, 5.2, "3D rib cage with one fractured rib");
  pill(s, M + 1.4, 7.05, 1.8, 0.34, "Fracture site (ring)", TINT.red, HEX.accent1, { fontSize: 12 });
  tint(s, 5.4, 1.7, 5.74, 1.45, TINT.orange, "Definition");
  label(s, "Definition", 5.62, 1.82, 3, C.accent3);
  T(s, [P("A rib fracture is a "), B("break in one or more ribs"), P(", usually caused by "), B("direct trauma"), P(" to the chest.")], { x: 5.62, y: 2.14, w: 5.3, h: 0.95, fontSize: 17, valign: "middle" });
  card(s, 5.4, 3.35, 5.74, 4.15, { name: "Clinical manifestations" });
  await head(s, 5.62, 3.55, fa.FaBolt, HEX.accent1, "Clinical manifestations");
  bullets(s, ["**Severe chest pain**.", "Pain **increases with deep breathing or coughing**.", "**Tenderness** over the fractured rib.", "Sometimes **crepitus**."], 5.7, 4.3, 5.25, 3.0, { fontSize: 18, paraSpaceAfter: 12 });

  s = content(3, "Chest wall injuries", "Rib fracture: complications and management");
  card(s, M, 1.7, 4.7, 4.55, { name: "Complications" });
  await head(s, M + 0.22, 1.9, fa.FaTriangleExclamation, HEX.accent1, "Complications");
  const cp = [[fa.FaWind, "Pneumothorax", AIR, TINT.air], [fa.FaDroplet, "Hemothorax", HEX.accent1, TINT.red], [fa.FaLungs, "Lung injury", HEX.accent3, TINT.orange]];
  for (let i = 0; i < 3; i++) await row(s, M + 0.22, 2.65 + i * 0.82, 4.26, 0.7, cp[i][0], cp[i][1], cp[i][2], cp[i][3]);
  card(s, 5.44, 1.7, 5.7, 4.55, { name: "Management" });
  await head(s, 5.66, 1.9, fa.FaShieldHeart || fa.FaShield, HEX.accent6, "Management");
  const mg = [[fa.FaPills, "Pain control", HEX.accent5, TINT.purple], [fa.FaMaskVentilator || fa.FaWind, "Oxygen if needed", HEX.accent2, TINT.blue], [fa.FaLungs, "Encourage deep breathing and coughing", HEX.accent4, TINT.teal], [fa.FaHeartPulse, "Monitor respiratory status", HEX.accent6, TINT.green]];
  for (let i = 0; i < 4; i++) await row(s, 5.66, 2.65 + i * 0.82, 5.26, 0.7, mg[i][0], mg[i][1], mg[i][2], mg[i][3]);
  await callout(s, M, 6.5, W - 2 * M, 1.0, fa.FaBan, HEX.accent1, TINT.red, [B("Note: "), P("Chest binding is "), { text: "not recommended", options: { bold: true, color: C.accent1 } }, P(" because it "), B("restricts breathing"), P(".")], 18);

  s = content(3, "Chest wall injuries", "Flail chest");
  card(s, M, 1.7, 5.3, 5.8, { name: "Paradoxical movement" });
  await img(s, "flail-in", M + 0.1, 1.85, 2.5, 4.4, "3D rib cage: flail segment drawn inward on inspiration");
  await img(s, "flail-out", M + 2.7, 1.85, 2.5, 4.4, "3D rib cage: flail segment pushed outward on expiration");
  T(s, [{ text: "Inspiration", options: { bold: true, color: C.accent2, fontSize: 17, fontFace: "Cambria", breakLine: true } }, { text: "segment moves inward", options: { fontSize: 13, color: MUTED } }], { x: M + 0.1, y: 6.4, w: 2.5, h: 0.9, align: "center", valign: "middle" });
  T(s, [{ text: "Expiration", options: { bold: true, color: C.accent3, fontSize: 17, fontFace: "Cambria", breakLine: true } }, { text: "segment moves outward", options: { fontSize: 13, color: MUTED } }], { x: M + 2.7, y: 6.4, w: 2.5, h: 0.9, align: "center", valign: "middle" });
  tint(s, 6.05, 1.7, 5.09, 2.05, TINT.orange, "Definition");
  label(s, "Definition", 6.27, 1.82, 3, C.accent3);
  T(s, [P("Flail chest occurs when "), B("at least three consecutive ribs"), P(" are each fractured in "), B("two or more places"), P(", creating a "), B("free-floating segment"), P(" of the chest wall.")], { x: 6.27, y: 2.14, w: 4.7, h: 1.55, fontSize: 16.5, valign: "middle" });
  card(s, 6.05, 3.95, 5.09, 3.55, { name: "Paradoxical movement" });
  await head(s, 6.27, 4.12, fa.FaArrowsLeftRight, HEX.accent1, "Characteristic sign: paradoxical movement", 4.2);
  const pm = [["During inspiration", "The injured segment moves **inward**.", HEX.accent2, TINT.blue], ["During expiration", "The injured segment moves **outward**.", HEX.accent3, TINT.orange]];
  for (let i = 0; i < 2; i++) {
    const y = 5.0 + i * 1.2;
    tint(s, 6.27, y, 4.65, 1.05, pm[i][3], pm[i][0]);
    pill(s, 6.4, y + 0.12, 1.75, 0.32, pm[i][0], "FFFFFF", pm[i][2], { fontSize: 12 });
    T(s, rich(pm[i][1]), { x: 6.45, y: y + 0.5, w: 3.6, h: 0.45, fontSize: 16, valign: "middle" });
    s.addShape(i ? pres.shapes.RIGHT_ARROW : pres.shapes.LEFT_ARROW, { x: 10.15, y: y + 0.36, w: 0.6, h: 0.34, fill: { color: pm[i][2] }, line: { type: "none" }, objectName: "Arrow" });
  }

  s = content(3, "Chest wall injuries", "Flail chest: manifestations and management");
  card(s, M, 1.7, 5.2, 5.8, { name: "Clinical manifestations" });
  await head(s, M + 0.22, 1.9, fa.FaBolt, HEX.accent1, "Clinical manifestations");
  const fm = [[fa.FaBolt, "Severe chest pain", HEX.accent1, TINT.red], [fa.FaLungs, "Respiratory distress", HEX.accent2, TINT.blue], [fa.FaWind, "Rapid breathing", HEX.accent4, TINT.teal], [fa.FaMaskVentilator || fa.FaWind, "Low oxygen saturation", HEX.accent5, TINT.purple]];
  for (let i = 0; i < 4; i++) await row(s, M + 0.22, 2.75 + i * 1.13, 4.76, 0.98, fm[i][0], fm[i][1], fm[i][2], fm[i][3], { fontSize: 18 });
  card(s, 5.94, 1.7, 5.2, 5.8, { name: "Management" });
  await head(s, 6.16, 1.9, fa.FaShieldHeart || fa.FaShield, HEX.accent6, "Management");
  const fmg = ["**Oxygen therapy**.", "Adequate **pain control**.", "**Respiratory support**.", "**Mechanical ventilation** in severe cases."];
  for (let i = 0; i < 4; i++) {
    const y = 2.85 + i * 1.13;
    s.addShape(pres.shapes.OVAL, { x: 6.2, y: y + 0.15, w: 0.5, h: 0.5, fill: { color: C.accent6 }, line: { type: "none" }, objectName: "Step number" });
    T(s, String(i + 1), { x: 6.2, y: y + 0.15, w: 0.5, h: 0.5, align: "center", valign: "middle", fontSize: 16, bold: true, color: C.background1 });
    T(s, rich(fmg[i]), { x: 6.95, y, w: 4.0, h: 0.8, valign: "middle", fontSize: 18 });
  }

  /* ================= PART 4 ================= */
  section("Pleural injuries");
  await divider(4, "Pleural injuries", "Pneumothorax · tension pneumothorax · open pneumothorax · hemothorax", fa.FaLungs);

  s = content(4, "Pleural injuries", "Pneumothorax");
  tint(s, M, 1.7, W - 2 * M, 1.05, TINT.air, "Definition");
  await img(s, "ptx-def", M + 0.2, 1.8, 1.1, 0.85, "Collapsed lung with air around it");
  T(s, [P("Pneumothorax is the presence of "), { text: "air", options: { bold: true, color: AIR } }, P(" in the "), B("pleural space"), P(" (pleural cavity).")], { x: M + 1.5, y: 1.7, w: 8.6, h: 1.05, valign: "middle", fontSize: 19 });
  label(s, "Classification", M, 2.95);
  // classification tree built from editable shapes
  const node = (x, y, w, h, text, fill, color, o = {}) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: o.r || 0.14, fill: { color: fill }, line: { color: o.line || fill, width: o.line ? 1.5 : 0.75 }, objectName: "Node: " + (typeof text === "string" ? text : "Iatrogenic") }); T(s, text, { x, y, w, h, align: "center", valign: "middle", fontSize: o.fontSize || 18, bold: true, color, fontFace: o.face }); };
  const link = (x1, y1, x2, y2, col) => s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: y2 - y1, flipH: x2 < x1, line: { color: col, width: 2 }, objectName: "Connector" });
  link(5.845, 3.95, 3.2, 4.55, HEX.accent5); link(5.845, 3.95, 8.49, 4.55, HEX.accent1);
  link(3.2, 5.3, 1.75, 5.95, HEX.accent5); link(3.2, 5.3, 4.65, 5.95, HEX.accent5); link(8.49, 5.3, 7.04, 5.95, HEX.accent1); link(8.49, 5.3, 9.94, 5.95, HEX.accent1);
  node(4.445, 3.35, 2.8, 0.6, "Pneumothorax", AIR, "FFFFFF", { r: 0.3, fontSize: 20, face: "Cambria" });
  node(1.9, 4.55, 2.6, 0.75, "1 · Spontaneous", TINT.purple, C.text1, { line: HEX.accent5, fontSize: 19, face: "Cambria" });
  node(7.19, 4.55, 2.6, 0.75, "2 · Traumatic", TINT.red, C.text1, { line: HEX.accent1, fontSize: 19, face: "Cambria" });
  node(0.65, 5.95, 2.2, 0.75, "Primary", "FFFFFF", C.text1, { line: "C5D0DC" });
  node(3.55, 5.95, 2.2, 0.75, "Secondary", "FFFFFF", C.text1, { line: "C5D0DC" });
  node(5.94, 5.95, 2.2, 0.75, "Chest injury", "FFFFFF", C.text1, { line: "C5D0DC" });
  node(8.84, 5.95, 2.2, 1.2, [{ text: "Iatrogenic", options: { bold: true, breakLine: true } }, { text: "following thoracic surgery or biopsy", options: { bold: false, fontSize: 12, color: MUTED } }], "FFFFFF", C.text1, { line: "C5D0DC" });

  s = content(4, "Pleural injuries", "Spontaneous pneumothorax");
  card(s, M, 1.7, 5.2, 2.15, { name: "Primary" });
  await head(s, M + 0.22, 1.88, fa.FaCircleCheck, HEX.accent5, "Primary");
  bullets(s, ["**No evidence of overt lung disease**.", "Occurs in patients with **no history of lung disease**."], M + 0.3, 2.55, 4.75, 1.2, { fontSize: 16 });
  card(s, 5.94, 1.7, 5.2, 2.15, { name: "Secondary" });
  await head(s, 6.16, 1.88, fa.FaLungs, HEX.accent3, "Secondary");
  bullets(s, ["**Underlying lung disease** is present."], 6.24, 2.55, 4.75, 1.2, { fontSize: 16 });
  card(s, M, 4.05, W - 2 * M, 3.45, { name: "Clinical picture" });
  await head(s, M + 0.22, 4.22, fa.FaMagnifyingGlass, AIR, "Clinical picture of spontaneous pneumothorax", 8);
  const sp = [[fa.FaBookMedical || fa.FaNotesMedical, "**History of the cause** (in secondary).", HEX.accent3, TINT.orange], [fa.FaBolt, "**Sudden-onset unilateral pleuritic chest pain** and **breathlessness**.", HEX.accent1, TINT.red], [fa.FaLungs, "With underlying lung disease: breathlessness can be **severe** and **may not resolve spontaneously**.", HEX.accent2, TINT.blue]];
  for (let i = 0; i < 3; i++) {
    const x = M + 0.22 + i * 3.42;
    tint(s, x, 4.95, 3.3, 2.35, sp[i][3], "Clinical picture " + (i + 1));
    await icon(s, sp[i][0], x + 0.18, 5.1, 0.5, sp[i][2], "");
    T(s, rich(sp[i][1]), { x: x + 0.2, y: 5.72, w: 2.95, h: 1.5, fontSize: 16 });
  }

  s = content(4, "Pleural injuries", "Traumatic pneumothorax: three types");
  const pt = [["pleura-1", "1 · Closed (simple)", AIR, TINT.air, ["**Limited amount of air** is entrapped into the pleural cavity.", "**Not communicating** with the exterior."]],
    ["pleura-2", "2 · Open", HEX.accent3, TINT.orange, ["The pleural space **communicates freely with the exterior**.", "Paradoxical respiration: **collapses more** during inspiration, **expands slightly** during expiration."]],
    ["pleura-3", "3 · Tension", HEX.accent1, TINT.red, ["**Valvular tear** lets air **enter** but not **come out** of the pleural space.", "**Respiratory failure**: mediastinal shift to the opposite side, affecting the normal lung.", "**Shock**: mediastinal shift affecting the heart."]]];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 3.6, w = 3.39, t = pt[i];
    card(s, x, 1.7, w, 5.8, { name: t[1] });
    pill(s, x + 0.2, 1.85, w - 0.4, 0.42, t[1], t[3], t[2], { fontSize: 16 });
    await img(s, t[0], x + 0.3, 2.4, w - 0.6, 2.5, "3D chest: " + t[1]);
    bullets(s, t[4], x + 0.22, 5.0, w - 0.4, 2.4, { fontSize: 14, paraSpaceAfter: 5 });
  }

  s = content(4, "Pleural injuries", "Clinical picture of traumatic pneumothorax");
  await callout(s, M, 1.7, 3.9, 0.8, fa.FaBookMedical || fa.FaNotesMedical, HEX.accent3, TINT.orange, [B("History of trauma"), P(".")]);
  await callout(s, 4.64, 1.7, 6.5, 0.8, fa.FaBolt, HEX.accent1, TINT.red, [B("Symptoms: "), P("acute chest pain, dyspnea, cough.")]);
  card(s, M, 2.7, 5.2, 3.3, { name: "General signs" });
  await head(s, M + 0.22, 2.88, fa.FaUser, HEX.accent2, "Signs · general");
  const gs = [[fa.FaGaugeSimple || fa.FaGauge, "Shock", HEX.accent3, TINT.orange], [fa.FaDroplet, "Distended neck veins", HEX.accent2, TINT.blue], [fa.FaDroplet, "Cyanosis", HEX.accent5, TINT.purple], [fa.FaLungs, "Respiratory distress", HEX.accent1, TINT.red]];
  for (let i = 0; i < 4; i++) await row(s, M + 0.22 + (i % 2) * 2.43, 3.6 + Math.floor(i / 2) * 1.12, 2.33, 1.0, gs[i][0], gs[i][1], gs[i][2], gs[i][3], { fontSize: 15 });
  card(s, 5.94, 2.7, 5.2, 3.3, { name: "Local signs" });
  await head(s, 6.16, 2.88, fa.FaStethoscope, HEX.accent4, "Signs · local");
  bullets(s, ["**Decreased chest movement** on the affected side.", "**Shifting of the trachea** to the opposite side (tension pneumothorax).", "**Decreased air entry**."], 6.24, 3.6, 4.75, 2.3, { fontSize: 16.5, paraSpaceAfter: 9 });
  tint(s, M, 6.2, W - 2 * M, 1.3, TINT.red, "Tension vs open");
  await icon(s, fa.FaTriangleExclamation, M + 0.2, 6.52, 0.66, HEX.accent1, "Difference");
  T(s, [P("The clinical picture of "), B("tension"), P(" pneumothorax is similar to "), B("open"), P(" but differs in:")], { x: M + 1.05, y: 6.28, w: 9.3, h: 0.45, valign: "middle", fontSize: 16.5 });
  pill(s, M + 1.05, 6.83, 3.9, 0.42, "More severe cardiorespiratory distress", "FFFFFF", HEX.accent1, { fontSize: 14 });
  pill(s, M + 5.1, 6.83, 3.1, 0.42, "Presence of mediastinal shift", "FFFFFF", HEX.accent1, { fontSize: 14 });

  s = content(4, "Pleural injuries", "Pneumothorax: investigation");
  await img(s, "xray", M, 1.7, 4.6, 5.8, "Chest X-ray: radiolucent side without lung markings and a collapsed lung margin");
  const inv = [["Chest X-ray", "Usually diagnostic", fa.FaXRay, HEX.accent2, TINT.blue], ["CT scan", "More accurate", fa.FaCircleDot, HEX.accent5, TINT.purple]];
  for (let i = 0; i < 2; i++) {
    const x = 5.4 + i * 2.93;
    card(s, x, 1.7, 2.81, 1.85, { name: inv[i][0] });
    await icon(s, inv[i][2], x + 0.2, 1.87, 0.55, inv[i][3], inv[i][0]);
    T(s, inv[i][0], { x: x + 0.9, y: 1.87, w: 1.8, h: 0.55, valign: "middle", fontSize: 20, bold: true, fontFace: "Cambria" });
    pill(s, x + 0.2, 2.75, 2.2, 0.4, inv[i][1], inv[i][4], inv[i][3], { fontSize: 14 });
  }
  card(s, 5.4, 3.75, 5.74, 3.75, { name: "Chest X-ray shows" });
  await head(s, 5.62, 3.93, fa.FaXRay, AIR, "Chest X-ray shows");
  const xr = [["**Radiolucency** on the affected side.", AIR], ["**Absence of lung markings**.", AIR], ["**Collapsed lung margin**.", "D99A00"]];
  for (let i = 0; i < 3; i++) {
    const y = 4.75 + i * 0.88;
    s.addShape(pres.shapes.OVAL, { x: 5.66, y: y + 0.1, w: 0.5, h: 0.5, fill: { color: xr[i][1] }, line: { type: "none" }, objectName: "Finding number" });
    T(s, String(i + 1), { x: 5.66, y: y + 0.1, w: 0.5, h: 0.5, align: "center", valign: "middle", fontSize: 16, bold: true, color: "FFFFFF" });
    T(s, rich(xr[i][0]), { x: 6.4, y, w: 4.5, h: 0.7, valign: "middle", fontSize: 18 });
  }

  s = content(4, "Pleural injuries", "Pneumothorax: management");
  card(s, M, 1.7, 6.2, 1.55, { name: "Emergency treatment" });
  label(s, "Emergency treatment · ABCD", M + 0.22, 1.82, 5, C.accent1);
  const ab = [["A", "Airway", C.accent2, TINT.blue], ["B", "Breathing", C.accent4, TINT.teal], ["C", "Circulation", C.accent1, TINT.red], ["D", "Disability", C.accent5, TINT.purple]];
  for (let i = 0; i < 4; i++) {
    const x = M + 0.22 + i * 1.46;
    tint(s, x, 2.2, 1.36, 0.85, ab[i][3], ab[i][1]);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.1, y: 2.4, w: 0.42, h: 0.42, rectRadius: 0.08, fill: { color: ab[i][2] }, line: { type: "none" }, objectName: "Letter" });
    T(s, ab[i][0], { x: x + 0.1, y: 2.4, w: 0.42, h: 0.42, align: "center", valign: "middle", fontSize: 16, bold: true, color: C.background1, fontFace: "Cambria" });
    T(s, ab[i][1], { x: x + 0.56, y: 2.2, w: 0.8, h: 0.85, valign: "middle", fontSize: 12.5, bold: true });
  }
  card(s, M, 3.45, 6.2, 4.05, { name: "Treatment" });
  T(s, [{ text: "Once ", options: { bullet: true } }, B("tension pneumothorax"), P(" is clinically diagnosed, a "), B("wide-bore needle"), P(" is "), B("immediately"), P(" placed in the "), { text: "second intercostal space", options: { bold: true, color: C.accent2 } }, P(" in the "), { text: "midclavicular line", options: { bold: true, color: C.accent2 } }, { text: ".", options: { breakLine: true } },
    { text: "Antibiotic", options: { bullet: true, bold: true } }, P(" and "), B("analgesics"), { text: " are given.", options: { breakLine: true } },
    { text: "In severe cases ", options: { bullet: true } }, B("ventilator support"), P(" may be needed.")], { x: M + 0.3, y: 3.62, w: 5.7, h: 2.5, fontSize: 16.5, paraSpaceAfter: 9 });
  await callout(s, M + 0.22, 6.3, 5.76, 1.0, fa.FaSyringe, HEX.accent4, TINT.teal, [B("Specific treatment: "), P("intercostal tube drainage "), B("(chest tube)"), P(".")], 16);
  card(s, 6.94, 1.7, 4.2, 5.8, { name: "Needle site" });
  await img(s, "site-needle", 7.09, 1.85, 3.9, 4.6, "3D rib cage: needle in the 2nd intercostal space, midclavicular line");
  T(s, [{ text: "Needle", options: { bold: true, color: C.accent2, fontSize: 16, breakLine: true } }, { text: "2nd intercostal space · midclavicular line", options: { fontSize: 13, color: MUTED } }], { x: 7.09, y: 6.55, w: 3.9, h: 0.8, align: "center", valign: "middle" });

  s = content(4, "Pleural injuries", "Hemothorax");
  card(s, M, 1.7, 4.9, 5.8, { name: "Hemothorax model" });
  await img(s, "pleura-0", M + 0.1, 1.9, 2.3, 4.5, "3D chest: normal");
  await img(s, "pleura-4", M + 2.5, 1.9, 2.3, 4.5, "3D chest: blood in the pleural space");
  pill(s, M + 0.45, 6.75, 1.6, 0.42, "Normal", TINT.green, HEX.accent6);
  pill(s, M + 2.85, 6.75, 1.6, 0.42, "Hemothorax", TINT.red, HEX.accent1);
  await callout(s, 5.65, 1.7, 5.49, 1.15, fa.FaDroplet, HEX.accent1, TINT.red, [B("Accumulation of "), { text: "blood", options: { bold: true, color: C.accent1 } }, P(" in the "), B("pleural space"), P(" (pleural cavity).")], 18);
  card(s, 5.65, 3.05, 5.49, 4.45, { name: "Causes" });
  await head(s, 5.87, 3.22, fa.FaMagnifyingGlass, HEX.accent1, "Causes");
  const hc = [[fa.FaBolt, "Trauma", HEX.accent1, TINT.red], [fa.FaUserDoctor, "Postoperative: pulmonary, cardiac", HEX.accent5, TINT.purple], [fa.FaLungs, "Tumors of lung / pleura", HEX.accent3, TINT.orange], [fa.FaDroplet, "Leaking aneurysms", HEX.accent1, TINT.red]];
  for (let i = 0; i < 4; i++) await row(s, 5.87, 3.92 + i * 0.72, 5.05, 0.62, hc[i][0], hc[i][1], hc[i][2], hc[i][3], { fontSize: 15.5 });
  T(s, [B("There may be rib fractures"), P(" in traumatic hemothorax.")], { x: 5.87, y: 6.85, w: 5.05, h: 0.5, valign: "middle", fontSize: 15, color: C.text2 });

  s = content(4, "Pleural injuries", "Hemothorax: features, investigations and treatment");
  card(s, M, 1.7, 6.4, 2.15, { name: "Clinical features" });
  await head(s, M + 0.22, 1.85, fa.FaUser, HEX.accent1, "Clinical features");
  label(s, "Symptoms", M + 0.3, 2.45, 2.5, C.accent1); label(s, "Signs", M + 3.3, 2.45, 2.5, C.accent1);
  bullets(s, ["Chest pain", "Difficulty in breathing"], M + 0.3, 2.78, 2.8, 1.0, { fontSize: 15, paraSpaceAfter: 3 });
  bullets(s, ["Features of **shock**", "Tenderness", "**Diminished** breath sounds"], M + 3.3, 2.78, 2.95, 1.0, { fontSize: 15, paraSpaceAfter: 3 });
  card(s, M, 4.03, 6.4, 1.5, { name: "Investigations" });
  await head(s, M + 0.22, 4.15, fa.FaXRay, HEX.accent2, "Investigations");
  const hi = [["Chest X-ray", TINT.blue], ["Aspiration (pleural tap)", TINT.orange], ["Chest CT scan", TINT.purple]];
  for (let i = 0; i < 3; i++) { tint(s, M + 0.22 + i * 2.0, 4.8, 1.92, 0.58, hi[i][1], hi[i][0]); T(s, hi[i][0], { x: M + 0.22 + i * 2.0, y: 4.8, w: 1.92, h: 0.58, align: "center", valign: "middle", fontSize: 13.5, bold: true }); }
  card(s, M, 5.71, 6.4, 1.79, { name: "Treatment" });
  await head(s, M + 0.22, 5.85, fa.FaSyringe, HEX.accent4, "Treatment · chest tube");
  T(s, [P("Put in the "), B("pleural space"), P(" in the "), { text: "4th intercostal space", options: { bold: true, color: C.accent4 } }, P(", in the "), { text: "mid axillary", options: { bold: true, color: C.accent4 } }, P(" or "), { text: "anterior axillary line", options: { bold: true, color: C.accent4 } }, P(".")], { x: M + 0.3, y: 6.45, w: 5.9, h: 0.95, fontSize: 16.5, valign: "middle" });
  card(s, 7.14, 1.7, 4.0, 5.8, { name: "Chest tube site" });
  await img(s, "site-tube", 7.29, 1.85, 3.7, 4.6, "3D rib cage: chest tube in the 4th intercostal space");
  T(s, [{ text: "Chest tube", options: { bold: true, color: C.accent4, fontSize: 16, breakLine: true } }, { text: "4th intercostal space · mid / anterior axillary line", options: { fontSize: 13, color: MUTED } }], { x: 7.29, y: 6.55, w: 3.7, h: 0.8, align: "center", valign: "middle" });

  /* ================= END ================= */
  s = pres.addSlide({ masterName: "Cover", sectionTitle: sec });
  await img(s, "ecg", 3.85, 1.2, 4.0, 1.8, "ECG trace");
  T(s, "Thank you", { x: 1, y: 3.2, w: W - 2, h: 1.3, align: "center", valign: "middle", fontSize: 66, bold: true, italic: true, fontFace: "Cambria", color: C.accent1 });
  T(s, LESSON, { x: 1, y: 4.5, w: W - 2, h: 0.5, align: "center", fontSize: 20, color: MUTED });
  await presenter(s, 3.55, 5.35);

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("Wrote " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
