// Claude Desktop mode end-to-end: real mcp.js process (stdio JSON-RPC) →
// helper relay (HTTP, token) → DesktopLink in the "panel" → real tools →
// SIMULATED Premiere.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "../helper/server.js";
import { Relay } from "../helper/lib/relay.js";
import { demoProject } from "./fixtures.js";
import { createRegistry } from "../src/agent/tools/index.js";
import { makeContextFactory } from "../src/agent/context.js";
import { createNodeFs } from "../src/storage/fsio-node.js";
import { SettingsStore, ProjectMemory } from "../src/storage/store.js";
import { FootageIndex } from "../src/editing/footage-index.js";
import { Analyzer } from "../src/editing/analyzer.js";
import { DesktopLink } from "../src/desktop/desktop-link.js";

const root = path.resolve(import.meta.dirname, "..");

function rpcClient(proc) {
  let buf = "";
  const waiting = new Map();
  const notes = [];
  proc.stdout.on("data", (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      if (m.id != null && waiting.has(m.id)) {
        waiting.get(m.id)(m);
        waiting.delete(m.id);
      } else notes.push(m);
    }
  });
  let id = 0;
  return {
    notes,
    call: (method, params) =>
      new Promise((resolve) => {
        const n = ++id;
        waiting.set(n, resolve);
        proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: n, method, params })}\n`);
      }),
  };
}

test("Claude Desktop (MCP) drives Premiere through the panel", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "hsn-mcp-"));
  const cfg = { token: "desk-token-123", port: 0, bridgeDir: path.join(home, "bridge") };
  const relay = new Relay({ cacheFile: path.join(home, "panel-tools.json") });
  const server = createServer(cfg, { ffmpeg: null }, relay);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  fs.writeFileSync(path.join(home, "helper.json"), JSON.stringify({ ...cfg, port }));

  // "panel"
  const { host } = demoProject();
  await host.init();
  const fsio = await createNodeFs(home);
  const settings = await SettingsStore.open(fsio);
  await settings.set({ executionMode: "direct" });
  const memory = await ProjectMemory.open(fsio, "demo");
  const index = await FootageIndex.open(fsio, memory.dir);
  const helperStub = { available: false, status: { state: "offline" }, url: `http://127.0.0.1:${port}`, token: cfg.token, fetch: (...a) => fetch(...a) };
  const analyzer = new Analyzer({ host, index, helper: helperStub, fsio, settings: settings.data });
  const ui = { confirm: async () => true, askConsent: async () => true, progress: () => {} };
  const registry = createRegistry();
  const link = new DesktopLink({ helper: helperStub, registry, instructions: "TEST INSTRUCTIONS", makeContext: makeContextFactory({ host, analyzer, index, memory, settings, helper: helperStub, fsio, ui }) });
  const seen = [];
  link.on("tool_end", (x) => seen.push(x.name));
  await link.start();

  const proc = spawn(process.execPath, [path.join(root, "helper/mcp.js")], { env: { ...process.env, HSN_HELPER_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
  const rpc = rpcClient(proc);
  try {
    const init = await rpc.call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    assert.equal(init.result.serverInfo.name, "hsn-premiere");
    assert.match(init.result.instructions, /TEST INSTRUCTIONS/);
    const list = await rpc.call("tools/list", {});
    const names = list.result.tools.map((t) => t.name);
    assert.ok(names.includes("hsn_connection_status") && names.includes("get_timeline_state") && names.includes("propose_edit_plan"));
    assert.ok(list.result.tools.every((t) => t.inputSchema && t.inputSchema.type === "object"));
    const st = await rpc.call("tools/call", { name: "hsn_connection_status", arguments: {} });
    assert.match(st.result.content[0].text, /Panel connected/);
    const tl = await rpc.call("tools/call", { name: "get_timeline_state", arguments: {} });
    assert.equal(tl.result.isError, false);
    assert.match(tl.result.content[0].text, /Sequence "Rough Assembly"/);
    assert.match(tl.result.content[0].text, /untrusted_media_data/);
    const edit = await rpc.call("tools/call", { name: "edit_timeline", arguments: { operations: [{ op: "trim", key: "V1:0.000", end: 12 }] } });
    assert.equal(edit.result.isError, false, edit.result.content[0].text);
    const bad = await rpc.call("tools/call", { name: "edit_timeline", arguments: { operations: [{ op: "explode" }] } });
    assert.equal(bad.result.isError, true);
    assert.deepEqual(seen, ["get_timeline_state", "edit_timeline", "edit_timeline"]);
    const after = await host.readTimeline();
    assert.equal(after.tracks.video[0].items[0].end, 12 * 254016000000);
  } finally {
    proc.kill();
    link.stop();
    server.close();
  }
});
