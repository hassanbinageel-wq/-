// UI smoke test: the BUILT bundle (plugin/dist/main.js) runs in jsdom with a
// fake UXP runtime, the SIMULATED premierepro module and a scripted Claude.
// This checks wiring (boot, chat streaming, plan card → execute, settings,
// language switch). It does not prove UXP rendering fidelity — that needs
// Premiere (see docs/TESTING.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { createMockPpro } from "../src/host/mock/ppro-mock.js";
import { fakeFetch, sse, messageEvents } from "./fake-claude.js";

const root = path.resolve(import.meta.dirname, "..");

function fakeUxp(base) {
  const store = new Map();
  const toPath = (u) => String(u).replace(/^file:/, "").replace(/^plugin-data:/, path.join(base, "data")).replace(/^plugin-temp:/, path.join(base, "tmp"));
  const fsApi = {
    readFile: async (u, o) => (o?.encoding ? fs.readFileSync(toPath(u), "utf8") : fs.readFileSync(toPath(u)).buffer),
    writeFile: async (u, d) => {
      fs.mkdirSync(path.dirname(toPath(u)), { recursive: true });
      fs.writeFileSync(toPath(u), d);
    },
    lstat: async (u) => fs.lstatSync(toPath(u)),
    mkdir: async (u) => fs.mkdirSync(toPath(u), { recursive: true }),
    unlink: async (u) => fs.rmSync(toPath(u), { force: true }),
    readdir: async (u) => fs.readdirSync(toPath(u)),
  };
  const uxp = {
    storage: {
      localFileSystem: {
        getDataFolder: async () => ({ nativePath: path.join(base, "data") }),
        getTemporaryFolder: async () => ({ nativePath: path.join(base, "tmp") }),
        getFileForOpening: async () => [],
      },
      secureStorage: {
        getItem: async (k) => (store.has(k) ? new TextEncoder().encode(store.get(k)) : undefined),
        setItem: async (k, v) => void store.set(k, v),
        removeItem: async (k) => void store.delete(k),
      },
      formats: { binary: "binary", utf8: "utf8" },
    },
  };
  return { uxp, fsApi, store };
}

const until = async (fn, ms = 4000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout waiting for UI");
};

test("panel boots, streams a reply, executes a plan from its card, switches language", async () => {
  if (!fs.existsSync(path.join(root, "plugin/dist/main.js"))) execFileSync("node", ["scripts/build.mjs"], { cwd: root });
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "hsn-ui-"));
  const mock = createMockPpro({
    writeFile: (p, b) => fs.writeFileSync(p, b),
    media: [
      { path: "/f/a.mp4", name: "a.mp4", duration: 30 },
      { path: "/f/b.mp4", name: "b.mp4", duration: 30 },
    ],
    timeline: [{ path: "/f/a.mp4", track: 0, start: 0, in: 0, out: 10 }],
  });
  const { uxp, fsApi, store } = fakeUxp(base);
  const html = fs.readFileSync(path.join(root, "plugin/index.html"), "utf8").replace('<script src="dist/main.js"></script>', "");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.require = (n) => ({ premierepro: mock.ppro, uxp, fs: fsApi, os: { platform: () => "darwin" } })[n];
  w.HTMLDialogElement.prototype.showModal = function () {
    return Promise.resolve("yes");
  };
  w.HTMLDialogElement.prototype.close = function () {};
  const items = [...mock.clips.values()];
  const plan = { title: "Quick cut", style_id: "fast", intent: { target_duration_s: 4 }, events: [
    { id: "e1", role: "a_roll", source: items[1].getId(), src_in: 2, src_out: 4 },
    { id: "e2", role: "a_roll", source: items[0].getId(), src_in: 1, src_out: 3 },
  ] };
  const claude = fakeFetch([
    { sse: sse(messageEvents([{ type: "text", text: "مرحبا! جاهز للمونتاج." }])) },
    { sse: sse(messageEvents([{ type: "tool_use", id: "p1", name: "propose_edit_plan", input: { plan } }])) },
    { sse: sse(messageEvents([{ type: "text", text: "الخطة جاهزة للمراجعة." }])) },
  ]);
  // the local helper is "not running" in this test
  w.fetch = (url, init) => (String(url).includes("127.0.0.1") ? Promise.reject(new Error("ECONNREFUSED")) : claude(url, init));
  w.eval(fs.readFileSync(path.join(root, "plugin/dist/main.js"), "utf8"));
  const doc = w.document;
  try {
    await until(() => doc.querySelector("#projName")?.textContent === "Demo Project");
    assert.equal(doc.documentElement.getAttribute("dir"), "rtl");
    assert.ok(doc.querySelector("#chipClaude").textContent.includes("غير"), "shows not connected");
    await w.__hsn.secrets.setApiKey("sk-ant-api03-UI-TEST-KEY-123456");
    assert.ok(store.size === 1);

    doc.querySelector("#composer").value = "هلا";
    doc.querySelector("#sendBtn").click();
    await until(() => [...doc.querySelectorAll(".msg.assistant")].some((m) => m.textContent.includes("جاهز للمونتاج")));
    assert.equal([...doc.querySelectorAll(".msg.assistant")].filter((m) => m.textContent.includes("أهلاً")).length, 1, "welcome shown once");
    assert.equal(claude.calls[0].headers["x-api-key"], "sk-ant-api03-UI-TEST-KEY-123456");

    await w.__hsn.send("سوّ مونتاج سريع");
    const card = await until(() => doc.querySelector(".card.plan"));
    assert.match(card.textContent, /Quick cut/);
    const before = (await mock.project.getSequences()).length;
    card.querySelector("button.primary").click();
    await until(async () => (await mock.project.getSequences()).length === before + 1);
    await until(() => [...doc.querySelectorAll(".msg.system")].some((m) => /Execution done/.test(m.textContent)));

    w.__hsn.showTab("settings");
    await until(() => doc.querySelector("#view-settings input[type=password]"));
    w.__hsn.setLang("en");
    await until(() => doc.documentElement.getAttribute("dir") === "ltr");
    assert.ok([...doc.querySelectorAll(".tab")].some((b) => b.textContent === "Settings"));
    // the key never lands in plain files
    const all = fs.readdirSync(base, { recursive: true }).filter((p) => p.endsWith(".json")).map((p) => fs.readFileSync(path.join(base, p), "utf8")).join("");
    assert.ok(!all.includes("UI-TEST-KEY"));
  } finally {
    w.close();
  }
});
