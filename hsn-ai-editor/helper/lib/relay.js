// Relay between an MCP client (Claude Desktop / Claude Code, via mcp.js) and
// the HSN panel running inside Premiere. The panel registers its tool list,
// long-polls for calls, runs them with the same validated tools used in API
// mode, and posts results back.
import fs from "node:fs";
import path from "node:path";

export class Relay {
  constructor({ cacheFile } = {}) {
    this.cacheFile = cacheFile;
    this.tools = [];
    this.instructions = "";
    this.queue = [];
    this.pollers = [];
    this.jobs = new Map(); // id -> {name, args, status, result, waiters}
    this.panelSeenAt = 0;
    this.seq = 0;
    this.listeners = new Set();
    if (cacheFile) {
      try {
        const j = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        this.tools = j.tools || [];
        this.instructions = j.instructions || "";
      } catch { /* no cache yet */ }
    }
  }

  get panelConnected() {
    return Date.now() - this.panelSeenAt < 40000;
  }

  register({ tools, instructions }) {
    const changed = JSON.stringify(tools) !== JSON.stringify(this.tools);
    this.tools = tools || [];
    this.instructions = instructions || this.instructions;
    this.panelSeenAt = Date.now();
    if (this.cacheFile) {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify({ tools: this.tools, instructions: this.instructions }));
    }
    if (changed) for (const l of this.listeners) l("tools_changed");
    return { ok: true };
  }

  /** Called by the MCP side. Resolves with the result or {pending:true, jobId} after waitMs. */
  call(name, args, waitMs = 50000) {
    const id = `job${++this.seq}`;
    const job = { id, name, args, status: "queued", result: null, waiters: [], createdAt: Date.now() };
    this.jobs.set(id, job);
    const poller = this.pollers.shift();
    if (poller) poller({ id, name, args });
    else this.queue.push({ id, name, args });
    return this.wait(id, waitMs);
  }

  wait(id, waitMs = 45000) {
    const job = this.jobs.get(id);
    if (!job) return Promise.resolve({ error: `unknown job ${id}` });
    if (job.status === "done") return Promise.resolve(job.result);
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        job.waiters = job.waiters.filter((w) => w !== done);
        resolve({ pending: true, jobId: id });
      }, waitMs);
      const done = (r) => {
        clearTimeout(t);
        resolve(r);
      };
      job.waiters.push(done);
    });
  }

  /** Called by the panel: long-poll for the next call. */
  poll(waitMs = 25000) {
    this.panelSeenAt = Date.now();
    const next = this.queue.shift();
    if (next) {
      const j = this.jobs.get(next.id);
      if (j) j.status = "running";
      return Promise.resolve(next);
    }
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.pollers = this.pollers.filter((p) => p !== fn);
        this.panelSeenAt = Date.now();
        resolve(null);
      }, waitMs);
      const fn = (c) => {
        clearTimeout(t);
        const j = this.jobs.get(c.id);
        if (j) j.status = "running";
        resolve(c);
      };
      this.pollers.push(fn);
    });
  }

  /** Called by the panel with a tool result {text, images, isError}. */
  result(id, payload) {
    this.panelSeenAt = Date.now();
    const job = this.jobs.get(id);
    if (!job) return { ok: false };
    job.status = "done";
    job.result = payload;
    for (const w of job.waiters) w(payload);
    job.waiters = [];
    // keep finished jobs for 30 min for hsn_job_status
    setTimeout(() => this.jobs.delete(id), 30 * 60 * 1000).unref?.();
    return { ok: true };
  }

  status() {
    return { panelConnected: this.panelConnected, tools: this.tools.length, queued: this.queue.length, running: [...this.jobs.values()].filter((j) => j.status === "running").map((j) => j.name) };
  }
}
