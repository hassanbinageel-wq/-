// File I/O abstraction: UXP (`require('fs')` with plugin-data:/ and file:/
// URLs, documented in Adobe's filesystem recipe) or Node (tests/helper).

export function createUxpFs() {
  // eslint-disable-next-line no-undef
  const fs = require("fs");
  // eslint-disable-next-line no-undef
  const uxp = require("uxp");
  const url = (p) => (/^(plugin|plugin-data|plugin-temp|file):/.test(p) ? p : `file:${p.startsWith("/") ? "" : "/"}${p.replace(/\\/g, "/")}`);
  let dataNative = null;
  let tempNative = null;
  return {
    kind: "uxp",
    async readText(p) {
      return fs.readFile(url(p), { encoding: "utf-8" });
    },
    async writeText(p, text) {
      await fs.writeFile(url(p), text, { encoding: "utf-8" });
    },
    async readBytes(p) {
      const buf = await fs.readFile(url(p));
      return new Uint8Array(buf);
    },
    async writeBytes(p, bytes) {
      await fs.writeFile(url(p), bytes);
    },
    async exists(p) {
      try {
        await fs.lstat(url(p));
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(p) {
      try {
        await fs.mkdir(url(p), { recursive: true });
      } catch { /* exists */ }
    },
    async remove(p) {
      try {
        await fs.unlink(url(p));
      } catch { /* ignore */ }
    },
    async list(p) {
      try {
        return await fs.readdir(url(p));
      } catch {
        return [];
      }
    },
    /** Native path of the plugin data folder (needed by APIs that take OS paths). */
    async dataDir() {
      if (!dataNative) dataNative = (await uxp.storage.localFileSystem.getDataFolder()).nativePath;
      return dataNative;
    },
    async tempDir() {
      if (!tempNative) tempNative = (await uxp.storage.localFileSystem.getTemporaryFolder()).nativePath;
      return tempNative;
    },
    sep: typeof navigator !== "undefined" && /Win/.test(navigator.platform || "") ? "\\" : "/",
  };
}

export async function createNodeFs(root) {
  const fsp = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");
  const base = root || (await fsp.mkdtemp(path.join(os.tmpdir(), "hsn-")));
  return {
    kind: "node",
    readText: (p) => fsp.readFile(p, "utf8"),
    writeText: async (p, t) => {
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, t);
    },
    readBytes: async (p) => new Uint8Array(await fsp.readFile(p)),
    writeBytes: async (p, b) => {
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, b);
    },
    exists: async (p) => fsp.access(p).then(() => true, () => false),
    mkdir: (p) => fsp.mkdir(p, { recursive: true }),
    remove: (p) => fsp.rm(p, { force: true }),
    list: (p) => fsp.readdir(p).catch(() => []),
    dataDir: async () => path.join(base, "data"),
    tempDir: async () => path.join(base, "tmp"),
    sep: path.sep,
  };
}

export function joinPath(fsio, ...parts) {
  const sep = fsio.sep || "/";
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? String(p).replace(/[\\/]+$/, "") : String(p).replace(/^[\\/]+|[\\/]+$/g, "")))
    .join(sep);
}
