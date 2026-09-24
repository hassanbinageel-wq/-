// ffmpeg/ffprobe runner. Arguments are passed as arrays (no shell), so
// file names can never inject commands.
import { spawn } from "node:child_process";
import fs from "node:fs";

export function findBinary(name, configured) {
  if (configured && fs.existsSync(configured)) return configured;
  const env = process.env[`HSN_${name.toUpperCase()}`];
  if (env && fs.existsSync(env)) return env;
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const dirs = (process.env.PATH || "").split(process.platform === "win32" ? ";" : ":");
  const extra = process.platform === "darwin" ? ["/opt/homebrew/bin", "/usr/local/bin"] : process.platform === "win32" ? ["C:\\ffmpeg\\bin"] : ["/usr/bin", "/usr/local/bin"];
  for (const d of [...dirs, ...extra]) {
    const p = `${d}${d.endsWith("/") || d.endsWith("\\") ? "" : process.platform === "win32" ? "\\" : "/"}${exe}`;
    if (d && fs.existsSync(p)) return p;
  }
  return null;
}

/** Run a binary; resolves {code, stdout(Buffer), stderr(string)}. */
export function run(bin, args, { timeoutMs = 10 * 60 * 1000, signal, input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const out = [];
    let err = "";
    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${bin.split(/[\\/]/).pop()} timed out`));
    }, timeoutMs);
    signal?.addEventListener?.("abort", () => p.kill("SIGKILL"));
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 4e6) err = err.slice(-2e6);
    });
    p.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code, stdout: Buffer.concat(out), stderr: err });
    });
    if (input) p.stdin.end(input);
    else p.stdin.end();
  });
}

export async function mustRun(bin, args, opts) {
  const r = await run(bin, args, opts);
  if (r.code !== 0) throw new Error(`${bin.split(/[\\/]/).pop()} failed: ${r.stderr.split("\n").filter(Boolean).slice(-3).join(" | ")}`);
  return r;
}
