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
    sep: uxpIsWindows() ? "\\" : "/",
  };
}

function uxpIsWindows() {
  try {
    // eslint-disable-next-line no-undef
    return /^win/i.test(require("os").platform());
  } catch {
    return false;
  }
}

export function joinPath(fsio, ...parts) {
  const sep = fsio.sep || "/";
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? String(p).replace(/[\\/]+$/, "") : String(p).replace(/^[\\/]+|[\\/]+$/g, "")))
    .join(sep);
}
