// Static checks on the built plugin before packaging.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const bundle = fs.readFileSync(path.join(root, "plugin/dist/main.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin/manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const problems = [];
if (/\bfrom\s+["']node:|import\(["']node:/.test(bundle)) problems.push("bundle imports node: modules (not available in UXP)");
if (/sk-ant-[A-Za-z0-9_-]{12,}/.test(bundle)) problems.push("bundle contains something that looks like an API key");
if (/\bTextDecoder\b/.test(bundle)) problems.push("bundle uses TextDecoder (unavailable in UXP)");
if (manifest.version !== pkg.version) problems.push(`manifest version ${manifest.version} != package.json ${pkg.version}`);
if (!manifest.requiredPermissions?.network?.domains?.includes("https://api.anthropic.com")) problems.push("manifest lacks api.anthropic.com network permission");
if (manifest.host?.app !== "premierepro") problems.push("manifest host.app must be premierepro");
if (manifest.manifestVersion !== 5) problems.push("manifestVersion must be 5");
for (const e of manifest.entrypoints) for (const i of e.icons || []) if (!fs.existsSync(path.join(root, "plugin", i.path))) problems.push(`missing icon ${i.path}`);
console.log(`bundle ${(bundle.length / 1024).toFixed(0)} KB`);
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
console.log("✓ bundle and manifest checks passed");
