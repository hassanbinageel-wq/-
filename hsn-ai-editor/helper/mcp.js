#!/usr/bin/env node
// HSN AI Editor — MCP server for Claude Desktop / Claude Code.
//
// Lets you drive the HSN panel inside Premiere from the Claude app you
// already use (your Claude subscription), instead of an API key. Claude
// Desktop launches this file over stdio; it exposes the panel's tools and
// relays each call to the panel through the local helper (127.0.0.1, token
// protected). If the helper is not running, it is started in-process.
//
// Claude Desktop config (Settings → Developer → Edit Config):
//   { "mcpServers": { "hsn-premiere": { "command": "node",
//       "args": ["C:\\path\\to\\hsn-ai-editor\\helper\\mcp.js"] } } }

import readline from "node:readline";
import { loadConfig, detectTools, createServer, startBridge, VERSION } from "./server.js";

const log = (...a) => process.stderr.write(`[hsn-mcp] ${a.join(" ")}\n`);
const cfg = loadConfig();
const base = `http://127.0.0.1:${cfg.port}`;

async function api(endpoint, body = {}) {
  const r = await fetch(`${base}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hsn-token": cfg.token },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

async function ensureHelper() {
  try {
    await api("health");
    log("using the running helper on", base);
    return;
  } catch { /* not running */ }
  const tools = detectTools(cfg);
  const server = createServer(cfg, tools);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(cfg.port, "127.0.0.1", resolve);
  });
  startBridge(cfg, tools, { log: (...a) => log(...a) });
  log(`started helper on ${base} (ffmpeg: ${tools.ffmpeg ? "yes" : "no"})`);
}

const STATUS_TOOL = {
  name: "hsn_connection_status",
  description: "Check whether the HSN AI Editor panel in Adobe Premiere is open and connected. Call this first if other HSN tools are missing or fail with 'panel not connected'.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};
const JOB_TOOL = {
  name: "hsn_job_status",
  description: "Get the result of a long-running Premiere operation that returned a job id (e.g. a plan execution still in progress). Waits up to ~45 s per call.",
  inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"], additionalProperties: false },
};

const DESKTOP_NOTE = `\n\n# Running from the Claude app\nYou are connected to Adobe Premiere through the HSN AI Editor panel (MCP). Start every new request by calling get_panel_context to learn the project, active sequence, work scope, execution mode and remembered rules. Edits are confirmed or previewed inside Premiere according to the panel's mode. If a tool reports that the panel is not connected, ask the user to open Window › UXP Plugins › HSN AI Editor in Premiere and switch the panel's connection mode to "Claude Desktop".`;

let cache = { tools: [], instructions: "" };
async function refreshTools() {
  try {
    const j = await api("relay/tools");
    cache = j;
  } catch (e) {
    log("tool list unavailable:", e.message);
  }
  return cache;
}

function toMcpResult(r) {
  if (!r) return { content: [{ type: "text", text: "No result." }], isError: true };
  if (r.pending) return { content: [{ type: "text", text: `Still running in Premiere. Call hsn_job_status with job_id "${r.jobId}" to get the result.` }] };
  if (r.error && !r.text) return { content: [{ type: "text", text: r.error }], isError: true };
  const content = [{ type: "text", text: r.text || "(done)" }];
  for (const im of r.images || []) {
    if (im.label) content.push({ type: "text", text: `[${im.label}]` });
    content.push({ type: "image", data: im.base64, mimeType: im.mediaType || "image/jpeg" });
  }
  return { content, isError: !!r.isError };
}

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize": {
      const c = await refreshTools();
      return {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "hsn-premiere", version: VERSION },
        instructions: (c.instructions || "You control Adobe Premiere through the HSN AI Editor panel.") + DESKTOP_NOTE,
      };
    }
    case "ping":
      return {};
    case "tools/list": {
      const c = await refreshTools();
      const panelTools = (c.tools || []).map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema }));
      return { tools: [STATUS_TOOL, JOB_TOOL, ...panelTools] };
    }
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments || {};
      if (name === STATUS_TOOL.name) {
        const s = await api("relay/status");
        return { content: [{ type: "text", text: s.panelConnected ? `Panel connected (${s.tools} tools${s.running.length ? `, running: ${s.running.join(", ")}` : ""}).` : "The HSN panel is NOT connected. Ask the user to open Premiere → Window › UXP Plugins › HSN AI Editor, and set Settings › Claude connection mode to “Claude Desktop”." }] };
      }
      if (name === JOB_TOOL.name) return toMcpResult(await api("relay/wait", { jobId: args.job_id, waitMs: 45000 }));
      const s = await api("relay/status");
      if (!s.panelConnected) return { content: [{ type: "text", text: "The HSN panel in Premiere is not connected. Ask the user to open it (Window › UXP Plugins › HSN AI Editor) with connection mode “Claude Desktop”, then retry." }], isError: true };
      return toMcpResult(await api("relay/call", { name, arguments: args, waitMs: 50000 }));
    }
    default:
      if (id === undefined) return undefined; // notification
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

await ensureHelper().catch((e) => log("could not start helper:", e.message));
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  try {
    const result = await handle(msg);
    if (msg.id !== undefined && result !== undefined) send({ jsonrpc: "2.0", id: msg.id, result });
  } catch (e) {
    if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: e.code || -32603, message: e.message } });
  }
});
rl.on("close", () => process.exit(0));

// Tell the client when the panel's tool list appears/changes.
let lastCount = cache.tools.length;
setInterval(async () => {
  const c = await refreshTools();
  if (c.tools.length !== lastCount) {
    lastCount = c.tools.length;
    send({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
  }
}, 5000).unref();
