// Client for the optional local helper (Node + ffmpeg). Two transports:
//  1. HTTP on 127.0.0.1 with a per-install token header (default).
//  2. File bridge: request/response JSON files in a shared folder — for
//     setups where the host blocks plain-http localhost (Adobe notes that
//     macOS restricts http:// in UXP).
// The helper never receives the Anthropic API key.

import { uid, sleep } from "../core/util.js";
import { joinPath } from "../storage/fsio.js";

export class HelperClient {
  constructor({ url, token, bridgeDir, fsio, fetchImpl, log = () => {} }) {
    this.url = (url || "").replace(/\/$/, "");
    this.token = token || "";
    this.bridgeDir = bridgeDir || "";
    this.fsio = fsio;
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.log = log;
    this.status = { state: "unknown", transport: null, version: null, tools: {} };
  }

  async health() {
    try {
      if (this.url) {
        const r = await this.fetch(`${this.url}/health`, { headers: { "x-hsn-token": this.token } });
        if (r.status === 401) {
          this.status = { state: "unauthorized", transport: "http", tools: {} };
          return this.status;
        }
        const j = await r.json();
        this.status = { state: "connected", transport: "http", version: j.version, tools: j.tools || {} };
        return this.status;
      }
    } catch (e) {
      this.log("info", `helper http unavailable: ${e.message}`);
    }
    if (this.bridgeDir && this.fsio) {
      try {
        const j = await this.viaBridge("health", {}, 4000);
        this.status = { state: "connected", transport: "bridge", version: j.version, tools: j.tools || {} };
        return this.status;
      } catch { /* not running */ }
    }
    this.status = { state: "offline", transport: null, tools: {} };
    return this.status;
  }

  get available() {
    return this.status.state === "connected";
  }

  async call(endpoint, body = {}, { timeoutMs = 10 * 60 * 1000, signal } = {}) {
    if (!this.available) await this.health();
    if (!this.available) throw Object.assign(new Error("The local helper is not running. Start it (see README → Local helper) or continue without it."), { code: "helper_offline" });
    if (this.status.transport === "bridge") return this.viaBridge(endpoint, body, timeoutMs, signal);
    const r = await this.fetch(`${this.url}/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hsn-token": this.token },
      body: JSON.stringify(body),
      signal,
    });
    const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    if (!r.ok || j.error) throw Object.assign(new Error(j.error || `helper HTTP ${r.status}`), { code: "helper_error" });
    return j;
  }

  async viaBridge(endpoint, body, timeoutMs, signal) {
    const id = uid("req");
    const reqPath = joinPath(this.fsio, this.bridgeDir, "requests", `${id}.json`);
    const resPath = joinPath(this.fsio, this.bridgeDir, "responses", `${id}.json`);
    await this.fsio.writeText(reqPath, JSON.stringify({ id, endpoint, token: this.token, body }));
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (signal?.aborted) throw new Error("cancelled");
      if (await this.fsio.exists(resPath)) {
        const j = JSON.parse(await this.fsio.readText(resPath));
        await this.fsio.remove(resPath);
        if (j.error) throw Object.assign(new Error(j.error), { code: "helper_error" });
        return j.result;
      }
      await sleep(250);
    }
    throw Object.assign(new Error("helper bridge timed out"), { code: "helper_timeout" });
  }
}
