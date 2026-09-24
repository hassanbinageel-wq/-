// Node implementation of the file I/O abstraction (tests, tooling).
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

