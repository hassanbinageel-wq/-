// Creates installable archives:
//   dist-package/hsn-ai-editor-<version>.ccx   (UXP plugin package = zip of plugin/)
//   dist-package/hsn-ai-editor-helper-<version>.zip
// A .ccx is a zip with manifest.json at its root. Packages built here are
// unsigned: install them with the UXP Developer Tool ("Load" / "Package"),
// or Creative Cloud's plugin installer where unsigned packages are allowed.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin/manifest.json"), "utf8"));
const out = path.join(root, "dist-package");
fs.mkdirSync(out, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  if (zlib.crc32) return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name.replace(/\\/g, "/"), "utf8");
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(useDeflate ? 8 : 0, 10);
    c.writeUInt32LE(0, 12);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

function collect(dir, base = dir, skip = () => false) {
  const res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (skip(rel, e)) continue;
    if (e.isDirectory()) res.push(...collect(full, base, skip));
    else res.push({ name: rel, data: fs.readFileSync(full) });
  }
  return res;
}

const pluginFiles = collect(path.join(root, "plugin"));
if (!pluginFiles.find((f) => f.name === "dist/main.js")) throw new Error("Run `npm run build` first (plugin/dist/main.js missing)");
const ccx = path.join(out, `hsn-ai-editor-${manifest.version}.ccx`);
fs.writeFileSync(ccx, zip(pluginFiles));
const helperFiles = collect(path.join(root, "helper"), path.join(root, "helper"), (rel) => rel.startsWith("node_modules"));
const hz = path.join(out, `hsn-ai-editor-helper-${manifest.version}.zip`);
fs.writeFileSync(hz, zip(helperFiles.map((f) => ({ ...f, name: `hsn-helper/${f.name}` }))));
console.log(`${path.relative(root, ccx)} (${pluginFiles.length} files)\n${path.relative(root, hz)} (${helperFiles.length} files)`);
