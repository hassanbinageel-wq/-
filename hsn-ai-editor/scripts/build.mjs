// Bundles the panel code into plugin/dist/main.js for UXP.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const opts = {
  entryPoints: ["src/ui/main.js"],
  bundle: true,
  outfile: "plugin/dist/main.js",
  format: "iife",
  platform: "neutral",
  target: ["es2020"],
  mainFields: ["module", "main"],
  external: ["premierepro", "uxp", "fs", "os", "path"],
  legalComments: "none",
  sourcemap: false,
  minify: false,
  banner: { js: "/* HSN AI Editor — built bundle. Source: src/ (see README). */" },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log("watching…");
} else {
  await esbuild.build(opts);
}
