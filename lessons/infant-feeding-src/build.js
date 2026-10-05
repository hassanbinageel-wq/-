// Bundles the lesson into one self-contained HTML file that works offline.
// Usage: node build.js <path/to/three.min.js (r149)> [output.html]
// three.min.js r149 ships in the npm package "three@0.149.0" at build/three.min.js.
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const threePath = process.argv[2];
const out = process.argv[3] || path.join(dir, "..", "infant-feeding-lesson.html");
if (!threePath) {
  console.error("Usage: node build.js <three.min.js> [output.html]");
  process.exit(1);
}
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const js = (s) => s.replace(/<\/script/gi, "<\\/script");

const html = [
  "<!doctype html>",
  '<html lang="en">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  "<title>Infant &amp; Child Feeding</title>",
  '<meta name="description" content="Interactive pediatric nursing lesson: breastfeeding, artificial feeding, NG tube feeding and weaning.">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap">',
  '<script>try{var t=localStorage.getItem("ifl-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>',
  "<style>",
  read("style.css"),
  "</style>",
  "</head>",
  "<body>",
  read("body.html"),
  "<script>/* three.js r149 | MIT License | https://threejs.org */",
  js(fs.readFileSync(threePath, "utf8")),
  "</script>",
  "<script>", js(read("icons.js")), "</script>",
  "<script>", js(read("scenes.js")), "</script>",
  "<script>", js(read("app.js")), "</script>",
  "</body>",
  "</html>",
  ""
].join("\n");

fs.writeFileSync(out, html);
console.log("Wrote " + out + " (" + Math.round(html.length / 1024) + " KB)");
