// Bundles the Basic Clinical Examination lesson into one offline HTML file.
// Usage: node build.js [output.html]
const fs = require("fs");
const path = require("path");
const dir = __dirname;
const out = process.argv[2] || path.join(dir, "..", "basic-clinical-examination.html");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const js = (s) => s.replace(/<\/script/gi, "<\\/script");
const html = [
  "<!doctype html>",
  '<html lang="en">',
  "<head>",
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  "<title>Basic Clinical Examination</title>",
  '<meta name="description" content="Basic clinical examination: general physical examination, vital signs and systemic examination. Dr. Ruqaiah Aidaros Alhebshi.">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@500;600&display=swap">',
  '<script>try{var t=localStorage.getItem("ce-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>',
  "<style>", read("style.css"), read("extra.css"), "</style>",
  "</head>",
  "<body>",
  read("body.html"),
  "<script>", js(read("ill.js")), "</script>",
  "<script>", js(read("app.js")), "</script>",
  "</body>",
  "</html>",
  ""
].join("\n");
fs.writeFileSync(out, html);
console.log("Wrote " + out + " (" + Math.round(html.length / 1024) + " KB)");
