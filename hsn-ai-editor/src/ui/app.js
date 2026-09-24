// Panel controller: wires Premiere, Claude, the helper and the UI.
import { t, STR } from "./i18n.js";
import { MODELS, getModel, DEFAULT_MODEL } from "../claude/models.js";
import { ClaudeClient } from "../claude/client.js";
import { PremiereHost } from "../host/premiere/adapter.js";
import { runSelfTest } from "../host/premiere/selftest.js";
import { HelperClient } from "../helper-client/helper-client.js";
import { SettingsStore, ProjectMemory, SecretStore, maskKey } from "../storage/store.js";
import { FootageIndex } from "../editing/footage-index.js";
import { Analyzer } from "../editing/analyzer.js";
import { Agent } from "../agent/agent.js";
import { createRegistry } from "../agent/tools/index.js";
import { makeContextFactory } from "../agent/context.js";
import { executePlanRecord, reportText } from "../agent/tools/planning.js";
import { StopToken } from "../executor/executor.js";
import { BUILTIN_STYLES } from "../editing/styles.js";
import { bytesToBase64 } from "../core/utf8.js";
import { redactSecrets, truncate } from "../core/util.js";
import { ticksToSeconds } from "../core/time.js";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) n.appendChild(typeof k === "string" ? document.createTextNode(k) : k);
  return n;
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isRtl = (s) => /[֐-ࣿ]/.test(s || "");

/** Minimal, safe markdown: escapes HTML, then **bold**, `code`, line breaks, "- " bullets. */
function md(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, '<span class="code">$1</span>')
    .replace(/^#{1,4} (.+)$/gm, "<b>$1</b>")
    .replace(/^[-•] (.+)$/gm, "• $1")
    .replace(/\n/g, "<br>");
}

export class App {
  constructor({ ppro, uxp, fsio }) {
    this.ppro = ppro;
    this.uxp = uxp;
    this.fsio = fsio;
    this.state = {};
    this.attachments = [];
    this.currentBubble = null;
    this.projectKey = null;
  }

  get lang() {
    return this.settings?.get("language") || "ar";
  }
  tr(k) {
    return t(this.lang, k);
  }

  // ------------------------------------------------------------ boot
  async start() {
    this.settings = await SettingsStore.open(this.fsio);
    this.secrets = SecretStore.uxp();
    this.host = new PremiereHost(this.ppro, { log: (lvl, m) => this.log(lvl, m), settings: this.hostSettings() });
    await this.host.init().catch((e) => this.log("warn", e.message));
    this.helper = new HelperClient({ url: this.settings.get("helperUrl"), token: this.settings.get("helperToken"), bridgeDir: this.settings.get("helperBridgeDir"), fsio: this.fsio, log: (l, m) => this.log(l, m) });
    this.client = new ClaudeClient({ getApiKey: () => this.secrets.getApiKey(), log: (l, m) => this.log(l, m) });
    this.registry = createRegistry();
    this.ui = {
      confirm: (o) => this.confirmDialog(o),
      showPlan: (rec) => this.renderPlanCard(rec),
      progress: (p) => this.onProgress(p),
      askConsent: (kind) => this.consentDialog(kind),
    };
    this.buildLayout();
    await this.loadProject();
    this.agent = new Agent({
      client: this.client,
      registry: this.registry,
      settings: this.settings,
      makeContext: makeContextFactory({
        host: this.host, helper: this.helper, fsio: this.fsio, settings: this.settings, ui: this.ui,
        memory: () => this.memory, index: () => this.index, analyzer: () => this.analyzer,
        log: (l, m) => this.log(l, m), state: this.state,
      }),
    });
    this.bindAgent();
    this.refreshStatus();
    await this.pollProject(true);
    this.pollTimer = setInterval(() => this.pollProject(), 3000);
    this.host.onChange(() => this.pollProject(true));
    this.helper.health().then(() => this.refreshStatus());
  }

  hostSettings() {
    const s = this.settings;
    return {
      keyframeTimeBase: s.get("keyframeTimeBase"),
      volumeUnits: s.get("volumeUnits"),
      protectedVideoTracks: s.get("protectedVideoTracks"),
      protectedAudioTracks: s.get("protectedAudioTracks"),
    };
  }

  async loadProject() {
    let key = "no-project";
    let name = "";
    try {
      const pr = await this.host.project();
      key = String(pr.guid || pr.path || pr.name);
      name = pr.name;
    } catch { /* no project */ }
    if (key === this.projectKey) return;
    this.projectKey = key;
    this.memory = await ProjectMemory.open(this.fsio, key);
    this.index = await FootageIndex.open(this.fsio, this.memory.dir);
    this.analyzer = new Analyzer({ host: this.host, index: this.index, helper: this.helper, fsio: this.fsio, settings: this.settings.data, log: (l, m) => this.log(l, m) });
    this.state.projectName = name;
    if (this.agent && !this.agent.busy) this.agent.reset();
    this.renderChatHistory();
    this.renderSideTabs();
  }

  async pollProject(force = false) {
    try {
      await this.loadProject();
      const tl = await this.host.readTimeline(undefined, { updateCache: false }).catch(() => null);
      const pr = await this.host.project().catch(() => null);
      $("#projName").textContent = pr ? pr.name : this.tr("noProject");
      $("#seqName").textContent = tl ? `${tl.sequence.name} · ${tl.sequence.fps}fps · ${ticksToSeconds(tl.sequence.endTicks).toFixed(1)}s` : this.tr("noSequence");
      if (force) this.renderSideTabs();
    } catch { /* ignore */ }
  }

  log(level, msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${level.toUpperCase()} ${redactSecrets(msg)}`;
    (this.logLines ||= []).push(line);
    if (this.logLines.length > 400) this.logLines.shift();
    if (level === "error") console.error(line);
  }

  // ------------------------------------------------------------ layout
  buildLayout() {
    const root = $("#app");
    root.innerHTML = "";
    document.documentElement.setAttribute("dir", this.lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", this.lang);
    const tabs = ["chat", "media", "versions", "styles", "log", "settings"];
    const tabKey = { chat: "tabChat", media: "tabMedia", versions: "tabVersions", styles: "tabStyles", log: "tabLog", settings: "tabSettings" };
    root.append(
      el("div", { class: "header" },
        el("div", { class: "brand" }, el("span", { class: "logo", text: "HSN" }), el("span", { class: "brandName", text: "AI Editor" })),
        el("div", { class: "projInfo" }, el("div", { id: "projName", class: "proj", text: "…" }), el("div", { id: "seqName", class: "seq muted", text: "" })),
        el("div", { class: "chips" },
          el("span", { id: "chipClaude", class: "chip" }),
          el("span", { id: "chipHelper", class: "chip" }),
          el("button", { id: "modeBtn", class: "chip btnChip", onclick: () => this.toggleMode() }),
          el("button", { class: "chip btnChip", text: this.lang === "ar" ? "EN" : "ع", onclick: () => this.setLang(this.lang === "ar" ? "en" : "ar") })
        )
      ),
      el("div", { class: "tabs" }, ...tabs.map((k) => el("button", { class: `tab${k === "chat" ? " active" : ""}`, "data-tab": k, text: this.tr(tabKey[k]), onclick: () => this.showTab(k) }))),
      el("div", { class: "views" },
        this.chatView(),
        el("div", { class: "view hidden", id: "view-media" }),
        el("div", { class: "view hidden", id: "view-versions" }),
        el("div", { class: "view hidden", id: "view-styles" }),
        el("div", { class: "view hidden", id: "view-log" }),
        el("div", { class: "view hidden", id: "view-settings" })
      )
    );
    this.refreshStatus();
  }

  chatView() {
    const scopes = [["timeline", "scopeTimeline"], ["selection", "scopeSelection"], ["inout", "scopeInOut"], ["bin", "scopeBin"], ["project", "scopeProject"]];
    const scopeSel = el("select", { id: "scopeSel", onchange: (e) => this.settings.set({ analysisScope: e.target.value }) }, ...scopes.map(([v, k]) => el("option", { value: v, text: this.tr(k), selected: this.settings.get("analysisScope") === v })));
    const full = el("input", { type: "checkbox", id: "fullSrc", checked: this.settings.get("analyzeFullSource"), onchange: (e) => this.settings.set({ analyzeFullSource: e.target.checked }) });
    const input = el("textarea", { id: "composer", placeholder: this.tr("placeholder"), rows: "3" });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendFromComposer();
      }
    });
    input.addEventListener("input", () => input.setAttribute("dir", isRtl(input.value) || (!input.value && this.lang === "ar") ? "rtl" : "ltr"));
    return el("div", { class: "view", id: "view-chat" },
      el("div", { class: "scopeBar" }, el("span", { class: "muted", text: this.tr("scope") }), scopeSel, el("label", { class: "chk" }, full, el("span", { text: this.tr("fullSource") }))),
      el("div", { id: "messages", class: "messages" }),
      el("div", { class: "statusBar" },
        el("span", { id: "phase", class: "phase", text: this.tr("idle") }),
        el("progress", { id: "prog", max: "100", value: "0", class: "hidden" }),
        el("span", { id: "usage", class: "muted small" }),
        el("button", { id: "stopBtn", class: "danger small hidden", text: this.tr("stop"), onclick: () => this.stopAll() })
      ),
      el("div", { id: "quick", class: "quick" }),
      el("div", { id: "attachList", class: "attachList" }),
      el("div", { class: "composer" },
        input,
        el("div", { class: "composerBtns" },
          el("button", { class: "primary", id: "sendBtn", text: this.tr("send"), onclick: () => this.sendFromComposer() }),
          el("button", { text: this.tr("attach"), onclick: () => this.pickAttachments() }),
          el("button", { text: this.tr("link"), onclick: () => this.addReferenceLink() }),
          el("button", { text: this.tr("undo"), onclick: () => this.undoLast() }),
          el("button", { text: this.tr("newChat"), onclick: () => this.newChat() })
        )
      )
    );
  }

  setLang(l) {
    this.settings.set({ language: l }).then(() => {
      this.buildLayout();
      this.renderChatHistory();
      this.renderSideTabs();
      this.pollProject();
    });
  }

  showTab(k) {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.getAttribute("data-tab") === k));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.id !== `view-${k}`));
    if (k !== "chat") this.renderSideTabs(k);
  }

  toggleMode() {
    const m = this.settings.get("executionMode") === "direct" ? "preview" : "direct";
    this.settings.set({ executionMode: m }).then(() => this.refreshStatus());
  }

  async refreshStatus() {
    if (!$("#chipClaude")) return;
    const has = this.secrets ? await this.secrets.hasApiKey() : false;
    const c = $("#chipClaude");
    c.textContent = has ? `● ${this.tr("claudeOn")}` : `○ ${this.tr("claudeOff")}`;
    c.className = `chip ${has ? "ok" : "bad"}`;
    const h = $("#chipHelper");
    const hs = this.helper?.status?.state;
    h.textContent = hs === "connected" ? `● ${this.tr("helperOn")}` : `○ ${this.tr("helperOff")}${hs === "unauthorized" ? ` (${this.tr("unauthorized")})` : ""}`;
    h.className = `chip ${hs === "connected" ? "ok" : "warn"}`;
    $("#modeBtn").textContent = this.settings.get("executionMode") === "direct" ? `⚡ ${this.tr("modeDirect")}` : `👁 ${this.tr("modePreview")}`;
    const q = $("#quick");
    if (q) {
      q.innerHTML = "";
      for (const cmd of this.settings.get("quickCommands") || []) {
        const label = typeof cmd === "string" ? cmd : cmd[this.lang] || cmd.en;
        q.append(el("button", { class: "qc", text: label, onclick: () => this.send(label) }));
      }
    }
  }

  // ------------------------------------------------------------ chat
  renderChatHistory() {
    const box = $("#messages");
    if (!box) return;
    box.innerHTML = "";
    const chat = this.memory?.data.chat || [];
    if (!chat.length) this.addBubble("assistant", this.tr("welcome"), { noSave: true });
    for (const m of chat.slice(-80)) this.addBubble(m.role, m.text, { kind: m.kind, noSave: true });
    for (const rec of Object.values(this.memory?.data.plans || {}).slice(-3)) if (rec.status === "proposed") this.renderPlanCard(rec);
  }

  addBubble(role, text, { kind, noSave } = {}) {
    const box = $("#messages");
    const b = el("div", { class: `msg ${role}${kind ? ` ${kind}` : ""}`, dir: isRtl(text) ? "rtl" : "ltr" });
    b.innerHTML = md(text);
    box.appendChild(b);
    box.scrollTop = box.scrollHeight;
    if (!noSave && this.memory && text) this.memory.addChat(role, text, kind ? { kind } : {});
    return b;
  }

  bindAgent() {
    const a = this.agent;
    let text = "";
    let thinking = null;
    a.on("assistant_start", () => {
      text = "";
      thinking = null;
      this.currentBubble = null;
    });
    a.on("thinking", (d) => {
      if (!this.settings.get("showThinking")) return;
      if (!thinking) {
        thinking = el("details", { class: "thinking" }, el("summary", { text: this.lang === "ar" ? "ملخص التفكير" : "Thinking summary" }), el("div", { class: "tbody" }));
        $("#messages").appendChild(thinking);
      }
      $(".tbody", thinking).textContent += d;
    });
    a.on("text", (d) => {
      text += d;
      if (!this.currentBubble) this.currentBubble = this.addBubble("assistant", "", { noSave: true });
      this.currentBubble.innerHTML = md(text);
      this.currentBubble.setAttribute("dir", isRtl(text) ? "rtl" : "ltr");
      const box = $("#messages");
      box.scrollTop = box.scrollHeight;
    });
    a.on("assistant_end", () => {
      if (text.trim()) this.memory.addChat("assistant", text);
      this.currentBubble = null;
    });
    a.on("retry", (r) => {
      if (this.currentBubble) this.currentBubble.remove();
      this.currentBubble = null;
      text = "";
      this.setPhase(`${this.lang === "ar" ? "إعادة المحاولة" : "Retrying"} (${r.reason}, ${Math.round(r.wait / 1000)}s)…`);
    });
    a.on("tool_start", (x) => {
      this.setPhase(`🔧 ${toolLabel(x.name, this.lang)}…`);
      this.toolChip = el("div", { class: "tool running", text: `🔧 ${toolLabel(x.name, this.lang)}` });
      $("#messages").appendChild(this.toolChip);
    });
    a.on("tool_end", (x) => {
      if (this.toolChip) {
        this.toolChip.className = `tool ${x.ok ? "ok" : "fail"}`;
        this.toolChip.textContent = `${x.ok ? "✓" : "✗"} ${toolLabel(x.name, this.lang)}${x.images ? ` · ${x.images} 🖼` : ""}`;
        this.toolChip.title = truncate(x.text, 800);
        const det = el("details", { class: "toolDetail" }, el("summary", { text: "…" }), el("pre", { text: truncate(x.text, 4000) }));
        this.toolChip.appendChild(det);
      }
      this.toolChip = null;
      this.renderSideTabs();
    });
    a.on("usage", (u) => {
      const tot = u.total;
      const m = getModel(u.model || this.settings.get("model"));
      $("#usage").textContent = `${this.tr("usage")}: ${fmtK(tot.input_tokens + tot.cache_read_input_tokens + tot.cache_creation_input_tokens)} in / ${fmtK(tot.output_tokens)} out${tot.cost ? ` · ${this.tr("cost")} $${tot.cost.toFixed(3)}` : ""}${m.unknown ? "" : ""}`;
    });
    a.on("notice", (n) => this.addBubble("system", n, { kind: "notice" }));
    a.on("busy", (b) => {
      $("#stopBtn").classList.toggle("hidden", !b);
      $("#sendBtn").disabled = b;
      if (!b) {
        this.setPhase(this.tr("idle"));
        $("#prog").classList.add("hidden");
      }
    });
    a.on("phase", (p) => p.phase !== "idle" && this.setPhase(this.tr(p.phase) || p.phase));
  }

  setPhase(s) {
    const p = $("#phase");
    if (p) p.textContent = s;
  }

  onProgress(p) {
    const bar = $("#prog");
    if (p.total) {
      bar.classList.remove("hidden");
      bar.value = String(Math.round((100 * (p.index || 0)) / p.total));
    }
    const name = p.phase === "execute" ? this.tr("executing") : p.phase === "analyze" ? this.tr("analyzing") : this.tr("editing");
    this.setPhase(`${name} ${p.index ? `${p.index}/${p.total} ` : ""}${p.op?.label || p.label || ""}${p.status === "failed" ? " ✗" : ""}`);
  }

  async sendFromComposer() {
    const box = $("#composer");
    const text = box.value.trim();
    if (!text && !this.attachments.length) return;
    box.value = "";
    await this.send(text || (this.lang === "ar" ? "راجع المرفقات" : "See attachments"));
  }

  async send(text) {
    if (!(await this.secrets.hasApiKey())) {
      this.addBubble("system", this.tr("needKey"), { kind: "notice" });
      this.showTab("settings");
      return;
    }
    if (this.agent.busy) return;
    const blocks = await this.attachmentBlocks();
    this.addBubble("user", text + (this.attachments.length ? `\n📎 ${this.attachments.map((a) => a.name).join(", ")}` : ""));
    this.attachments = [];
    this.renderAttachments();
    this.memory.data.summary = this.memorySummary();
    try {
      await this.agent.send(text, { blocks });
    } catch (e) {
      this.addBubble("system", `⚠ ${redactSecrets(e.message)}`, { kind: "error" });
      this.log("error", e.message);
    }
    this.refreshStatus();
  }

  memorySummary() {
    const recent = (this.memory.data.chat || []).filter((m) => m.role === "user").slice(-6).map((m) => `“${truncate(m.text, 140)}”`);
    const changes = (this.memory.data.changeLog || []).slice(-4).map((c) => truncate(c.text, 140));
    return [recent.length ? `recent requests: ${recent.join("; ")}` : "", changes.length ? `recent changes: ${changes.join("; ")}` : ""].filter(Boolean).join(" · ");
  }

  stopAll() {
    this.agent?.stop();
    this.cardStop?.stop();
    this.setPhase(this.lang === "ar" ? "جارٍ الإيقاف عند أقرب نقطة آمنة…" : "Stopping at the next safe point…");
  }

  newChat() {
    if (this.agent.busy) return;
    this.agent.reset();
    this.memory.data.chat = [];
    this.memory.save();
    this.renderChatHistory();
  }

  // ------------------------------------------------------------ plan cards
  renderPlanCard(rec) {
    const box = $("#messages");
    if (!box) return;
    const old = document.getElementById(`card-${rec.id}`);
    const card = el("div", { class: "card plan", id: `card-${rec.id}` });
    const p = rec.plan;
    const s = rec.stats || {};
    card.append(
      el("div", { class: "cardTitle", text: `🎬 ${this.tr("planTitle")}: ${p.title}` }),
      el("div", { class: "muted small", text: `${s.duration_s ?? "?"}s · ${s.shots ?? "?"} shots · avg ${s.avg_shot_s ?? "?"}s · ${s.transitions ?? 0} transitions · ${p.style_id || ""}${p.intent?.aspect ? ` · ${p.intent.aspect}` : ""}` })
    );
    if (p.style_notes) card.append(el("div", { class: "small", text: p.style_notes }));
    if (p.assumptions?.length) card.append(el("div", { class: "small" }, el("b", { text: `${this.tr("assumptions")}: ` }), p.assumptions.join(" · ")));
    if (p.structure?.length) card.append(el("div", { class: "structure" }, ...p.structure.map((x) => el("span", { class: "seg", text: `${x.section}${x.target_s ? ` ${x.target_s}s` : ""}` }))));
    if (rec.fixes?.length) card.append(el("div", { class: "small warnText", text: `${this.tr("autoFixes")}: ${rec.fixes.join(" · ")}` }));
    if (rec.warnings?.length) card.append(el("div", { class: "small warnText", text: `${this.tr("warnings")}: ${rec.warnings.join(" · ")}` }));
    const det = el("details", {}, el("summary", { text: this.tr("details") }), el("pre", { class: "planLines", text: rec.summary || "" }));
    card.append(det);
    const status = el("div", { class: "small muted", id: `status-${rec.id}`, text: rec.status === "executed" ? "✓ executed" : "" });
    const btns = el("div", { class: "cardBtns" },
      el("button", { class: "primary", text: this.tr("execute"), disabled: rec.status === "executed", onclick: () => this.executeFromCard(rec.id) }),
      el("button", { text: this.tr("revise"), onclick: () => {
        const c = $("#composer");
        c.value = this.lang === "ar" ? `عدّل الخطة "${p.title}": ` : `Revise plan "${p.title}": `;
        c.focus();
      } })
    );
    card.append(btns, status);
    if (old) old.replaceWith(card);
    else box.appendChild(card);
    box.scrollTop = box.scrollHeight;
  }

  async executeFromCard(planId) {
    if (this.cardRunning) return;
    // If Claude is still finishing its reply, wait for the turn to end first.
    for (let i = 0; this.agent.busy && i < 600; i++) {
      this.setPhase(this.lang === "ar" ? "بانتظار انتهاء رد Claude…" : "Waiting for Claude to finish…");
      await new Promise((r) => setTimeout(r, 100));
    }
    if (this.agent.busy) return;
    const rec = this.memory.data.plans[planId];
    if (!rec) return;
    this.cardRunning = true;
    rec.status = "approved";
    this.cardStop = new StopToken();
    $("#stopBtn").classList.remove("hidden");
    const ctx = this.agent.makeContext({ stop: this.cardStop, signal: undefined, userText: "execute plan" });
    try {
      const r = await executePlanRecord(ctx, rec);
      const txt = r.report ? reportText(r.report) : r.text;
      this.addBubble("system", txt, { kind: r.ok && r.report?.status === "done" ? "success" : "notice" });
      this.agent.addNote(`[The user pressed Execute on plan ${planId} ("${rec.plan.title}"). Result:\n${txt}]`);
      this.renderPlanCard(rec);
    } catch (e) {
      this.addBubble("system", `⚠ ${e.message}`, { kind: "error" });
    } finally {
      this.cardRunning = false;
      this.cardStop = null;
      $("#stopBtn").classList.add("hidden");
      this.setPhase(this.tr("idle"));
      $("#prog").classList.add("hidden");
      this.renderSideTabs();
    }
  }

  async undoLast() {
    const rps = this.memory.data.restorePoints;
    const vs = this.memory.data.versions;
    const lastRp = rps[rps.length - 1];
    const lastV = vs[vs.length - 1];
    try {
      if (lastRp && (!lastV || lastRp.createdAt > lastV.createdAt)) {
        await this.host.setActiveSequence(lastRp.seqId);
        this.memory.log(`Undo → restore point "${lastRp.name}"`);
        this.agent.addNote(`[The user pressed "Undo last AI change": now showing restore point "${lastRp.name}".]`);
        this.addBubble("system", this.tr("restoreDone"), { kind: "notice" });
      } else if (lastV) {
        const target = vs.find((v) => v.id === lastV.parent) || vs[vs.length - 2];
        const rp = rps.find((r) => r.createdAt < lastV.createdAt);
        if (target) await this.host.setActiveSequence(target.seqId);
        else if (rp) await this.host.setActiveSequence(rp.seqId);
        else {
          const seqs = await this.host.listSequences();
          const orig = seqs.find((s) => !/— HSN/.test(s.name));
          if (orig) await this.host.setActiveSequence(orig.id);
        }
        this.agent.addNote(`[The user pressed "Undo last AI change": switched away from version "${lastV.name}".]`);
        this.addBubble("system", this.tr("restoreDone"), { kind: "notice" });
      } else this.addBubble("system", this.tr("nothingToRestore"), { kind: "notice" });
    } catch (e) {
      this.addBubble("system", `⚠ ${e.message}`, { kind: "error" });
    }
    this.pollProject(true);
  }

  // ------------------------------------------------------------ attachments
  async pickAttachments() {
    const { localFileSystem } = this.uxp.storage;
    let files;
    try {
      files = await localFileSystem.getFileForOpening({ allowMultiple: true });
    } catch {
      return;
    }
    for (const f of [].concat(files || [])) {
      const name = f.name;
      const ext = (name.split(".").pop() || "").toLowerCase();
      const kind = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? "image" : ["mp4", "mov", "mxf", "avi", "mkv", "m4v", "webm"].includes(ext) ? "video" : ["wav", "mp3", "aif", "aiff", "m4a", "aac", "flac"].includes(ext) ? "audio" : ext === "cube" ? "lut" : ext === "mogrt" ? "mogrt" : ext === "srt" ? "srt" : "file";
      this.attachments.push({ name, path: f.nativePath, kind, entry: f });
    }
    this.renderAttachments();
  }

  addReferenceLink() {
    this.textDialog(this.tr("link"), this.tr("refUrlPrompt")).then((url) => {
      if (!url) return;
      this.attachments.push({ name: url, path: url, kind: "url" });
      this.renderAttachments();
    });
  }

  renderAttachments() {
    const box = $("#attachList");
    box.innerHTML = "";
    this.attachments.forEach((a, i) => box.append(el("span", { class: "att" }, `${a.kind === "url" ? "🔗" : "📎"} ${truncate(a.name, 40)} `, el("button", { class: "x", text: "×", onclick: () => {
      this.attachments.splice(i, 1);
      this.renderAttachments();
    } }))));
  }

  async attachmentBlocks() {
    const blocks = [];
    const notes = [];
    for (const a of this.attachments) {
      if (a.kind === "image") {
        const ok = (this.settings.get("consent") || {}).attachments || (await this.consentDialog("attachments"));
        if (!ok) continue;
        await this.settings.set({ consent: { ...this.settings.get("consent"), attachments: true } });
        const buf = await a.entry.read({ format: this.uxp.storage.formats.binary });
        const ext = a.name.split(".").pop().toLowerCase();
        blocks.push({ type: "text", text: `[Attached image: ${a.name}]` });
        blocks.push({ type: "image", source: { type: "base64", media_type: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg", data: bytesToBase64(new Uint8Array(buf)) } });
      } else if (a.kind === "video" || a.kind === "audio") {
        notes.push(`${a.kind} file attached: ${a.path} — if it is a reference, analyze it with analyze_reference(path); if it is footage/music/SFX for the edit, import it with project_ops (bin "HSN Attachments").`);
      } else if (a.kind === "url") {
        notes.push(`Reference link from the user: ${a.path} — use analyze_reference(url). If it cannot be fetched, ask for the file.`);
      } else {
        notes.push(`${a.kind} file attached: ${a.path}`);
      }
    }
    if (notes.length) blocks.unshift({ type: "text", text: `[${this.tr("attachedFiles")}]\n${notes.join("\n")}` });
    return blocks;
  }

  // ------------------------------------------------------------ dialogs
  async modal(title, bodyNode, buttons) {
    const dlg = el("dialog", { class: "dlg" });
    const form = el("form", { method: "dialog" }, el("div", { class: "dlgTitle", text: title }), bodyNode, el("div", { class: "dlgBtns" }, ...buttons.map(([label, value, cls]) => el("button", { class: cls || "", type: "button", text: label, onclick: () => dlg.close(value) }))));
    dlg.appendChild(form);
    document.body.appendChild(dlg);
    let v = null;
    try {
      v = await dlg.showModal();
      if (v === undefined) v = dlg.returnValue;
    } catch {
      v = null;
    }
    dlg.remove();
    return v;
  }

  async confirmDialog({ title, body }) {
    const v = await this.modal(title, el("pre", { class: "dlgBody", text: body }), [[this.tr("cancel"), "no"], [this.tr("confirm"), "yes", "primary"]]);
    return v === "yes";
  }

  async consentDialog(kind) {
    const text = STR[this.lang].consentBody[kind] || STR.en.consentBody[kind] || kind;
    const v = await this.modal(this.tr("consentTitle"), el("div", { class: "dlgBody", text }), [[this.tr("deny"), "no"], [this.tr("allow"), "yes", "primary"]]);
    return v === "yes";
  }

  async textDialog(title, label) {
    const input = el("input", { type: "text", class: "wide" });
    const v = await this.modal(title, el("div", {}, el("div", { class: "small", text: label }), input), [[this.tr("cancel"), "no"], [this.tr("ok"), "yes", "primary"]]);
    return v === "yes" ? input.value.trim() : null;
  }

  // ------------------------------------------------------------ side tabs
  renderSideTabs(only) {
    if (!this.memory) return;
    if (!only || only === "versions") this.renderVersions();
    if (!only || only === "media") this.renderMedia();
    if (!only || only === "styles") this.renderStyles();
    if (!only || only === "log") this.renderLog();
    if (only === "settings") this.renderSettings();
  }

  renderVersions() {
    const v = $("#view-versions");
    if (!v) return;
    v.innerHTML = "";
    const m = this.memory.data;
    v.append(el("div", { class: "sectionTitle", text: this.tr("versions") }));
    if (!m.versions.length) v.append(el("div", { class: "muted small", text: "—" }));
    for (const x of [...m.versions].reverse()) {
      v.append(el("div", { class: "row" }, el("div", { class: "grow" }, el("div", { text: x.name }), el("div", { class: "muted small", text: `${x.style || ""} ${x.duration_s ? `${x.duration_s}s` : ""} · ${x.status} · ${new Date(x.createdAt).toLocaleString()}` })), el("button", { class: "small", text: this.tr("activate"), onclick: () => this.host.setActiveSequence(x.seqId).then(() => this.pollProject(true)) })));
    }
    v.append(el("div", { class: "sectionTitle", text: this.tr("restorePoints") }));
    for (const r of [...m.restorePoints].reverse().slice(0, 20)) {
      v.append(el("div", { class: "row" }, el("div", { class: "grow" }, el("div", { text: r.name }), el("div", { class: "muted small", text: truncate(r.reason, 90) })), el("button", { class: "small", text: this.tr("activate"), onclick: () => this.host.setActiveSequence(r.seqId).then(() => this.pollProject(true)) })));
    }
    v.append(el("div", { class: "sectionTitle", text: this.tr("constraints") }));
    for (const c of [...m.constraints, ...m.pins]) {
      v.append(el("div", { class: "row" }, el("div", { class: "grow", text: `${c.kind ? `[${c.kind}] ` : "📌 "}${c.label}` }), el("button", { class: "small", text: this.tr("remove"), onclick: () => {
        this.memory.removeConstraint(c.id);
        this.renderVersions();
      } })));
    }
  }

  renderMedia() {
    const v = $("#view-media");
    if (!v) return;
    v.innerHTML = "";
    const results = el("div", { id: "searchResults" });
    const q = el("input", { type: "text", class: "wide", placeholder: this.tr("searchFootage") });
    q.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const hits = this.index.search(q.value, { limit: 20 });
      results.innerHTML = "";
      for (const h of hits) results.append(el("div", { class: "row small" }, el("div", { class: "grow", text: `${h.name} ${h.start.toFixed(1)}–${h.end.toFixed(1)}s · ${h.text}` }), el("span", { class: "muted", text: h.kind })));
      if (!hits.length) results.append(el("div", { class: "muted small", text: "—" }));
    });
    v.append(el("div", { class: "sectionTitle", text: this.tr("mediaIndex") }), q, results, el("button", { class: "primary", text: this.tr("analyzeScope"), onclick: () => {
      this.showTab("chat");
      this.send(this.lang === "ar" ? "حلّل الخامات في النطاق الحالي وسجّل ملاحظاتك عن كل لقطة، ثم لخّص لي المحتوى واقترح الأسلوب الأنسب." : "Analyze the footage in the current scope, record shot notes, then summarize the content and suggest the best style.");
    } }));
    for (const m of Object.values(this.index.media)) {
      const cov = this.index.coverage(m.id);
      v.append(el("details", { class: "mediaItem" }, el("summary", { text: `${m.name} · ${m.duration_s?.toFixed?.(1) ?? "?"}s · ${m.notes.length} notes · ${cov.frames_sampled} frames · ${m.transcript ? "📝" : ""}` }), el("pre", { class: "small", text: this.index.describe(m.id, { maxNotes: 40, maxSegs: 20 }) + `\n\ncoverage: ${JSON.stringify(cov)}` })));
    }
  }

  renderStyles() {
    const v = $("#view-styles");
    if (!v) return;
    v.innerHTML = "";
    const favs = new Set(this.settings.get("favoriteStyles") || []);
    const fav = (id) => el("button", { class: "small", text: favs.has(id) ? "★" : "☆", onclick: () => {
      favs.has(id) ? favs.delete(id) : favs.add(id);
      this.settings.set({ favoriteStyles: [...favs] }).then(() => this.renderStyles());
    } });
    const use = (s) => el("button", { class: "small", text: this.lang === "ar" ? "استخدم" : "Use", onclick: () => {
      this.showTab("chat");
      $("#composer").value = this.lang === "ar" ? `مونتاج الخامات بأسلوب ${s.name}` : `Edit the footage in the ${s.name} style`;
    } });
    v.append(el("div", { class: "sectionTitle", text: `${this.tr("styles")} — ${this.tr("saved")}` }));
    for (const s of this.memory.data.styles) v.append(el("div", { class: "row" }, el("div", { class: "grow" }, el("div", { text: s.name }), el("div", { class: "muted small", text: truncate(s.summary, 160) })), fav(s.id), use(s)));
    v.append(el("div", { class: "sectionTitle", text: this.tr("references") }));
    for (const r of this.memory.data.references) v.append(el("details", {}, el("summary", { text: `${r.name} · ${r.influence}` }), el("pre", { class: "small", text: `Observed: ${r.observed}\n\nInferred: ${r.inferred}\n\n${r.adaptations || ""}` })));
    v.append(el("div", { class: "sectionTitle", text: `${this.tr("styles")} — ${this.tr("builtIn")}` }));
    for (const s of BUILTIN_STYLES) v.append(el("div", { class: "row" }, el("div", { class: "grow" }, el("div", { text: s.name }), el("div", { class: "muted small", text: truncate(s.summary, 160) })), fav(s.id), use(s)));
  }

  renderLog() {
    const v = $("#view-log");
    if (!v) return;
    v.innerHTML = "";
    v.append(el("div", { class: "sectionTitle", text: this.tr("tabLog") }));
    for (const c of [...this.memory.data.changeLog].reverse().slice(0, 200)) v.append(el("div", { class: `logLine ${c.ok ? "" : "fail"}`, text: `${new Date(c.ts).toLocaleTimeString()} ${c.ok ? "✓" : "✗"} ${c.text}` }));
    v.append(el("details", {}, el("summary", { text: "Diagnostics" }), el("pre", { class: "small", text: (this.logLines || []).slice(-150).join("\n") })));
  }

  async renderSettings() {
    const v = $("#view-settings");
    v.innerHTML = "";
    const s = this.settings;
    const key = await this.secrets.getApiKey();
    const field = (label, input) => el("label", { class: "field" }, el("span", { text: label }), input);
    const txt = (val, onchange, attrs = {}) => el("input", { type: "text", class: "wide", value: val ?? "", onchange: (e) => onchange(e.target.value), ...attrs });
    const num = (val, onchange) => el("input", { type: "number", value: String(val), onchange: (e) => onchange(Number(e.target.value)) });
    const chk = (val, onchange) => el("input", { type: "checkbox", checked: !!val, onchange: (e) => onchange(e.target.checked) });
    const sel = (val, opts, onchange) => el("select", { onchange: (e) => onchange(e.target.value) }, ...opts.map(([v2, l]) => el("option", { value: v2, text: l, selected: v2 === val })));

    // Claude
    const keyIn = el("input", { type: "password", class: "wide", placeholder: key ? maskKey(key) : "sk-ant-…" });
    const result = el("div", { class: "small", id: "testResult" });
    const modelOpts = MODELS.map((m) => [m.id, m.label]);
    if (!modelOpts.find((x) => x[0] === s.get("model"))) modelOpts.push([s.get("model"), s.get("model")]);
    const modelSel = sel(s.get("model") || DEFAULT_MODEL, modelOpts, (x) => s.set({ model: x }));
    v.append(
      el("div", { class: "sectionTitle", text: this.tr("settingsClaude") }),
      field(this.tr("apiKey"), keyIn),
      el("div", { class: "btnRow" },
        el("button", { class: "primary", text: this.tr("save"), onclick: async () => {
          await this.secrets.setApiKey(keyIn.value);
          keyIn.value = "";
          this.refreshStatus();
          this.renderSettings();
        } }),
        el("button", { text: this.tr("test"), onclick: async () => {
          result.textContent = "…";
          try {
            const r = await this.client.testConnection(s.get("model"));
            result.textContent = `✓ ${r.model} · ${r.latencyMs} ms · "${r.text}"${r.cost != null ? ` · $${r.cost.toFixed(5)}` : ""}`;
          } catch (e) {
            result.textContent = `✗ ${e.kind || ""} ${e.message}`;
          }
        } }),
        el("button", { text: this.tr("clear"), onclick: async () => {
          await this.secrets.clearApiKey();
          this.refreshStatus();
          this.renderSettings();
        } })
      ),
      result,
      el("div", { class: "muted small", text: this.tr("keyNote") }),
      field(this.tr("model"), modelSel),
      el("button", { class: "small", text: this.tr("refreshModels"), onclick: async () => {
        try {
          const list = await this.client.listModels();
          for (const m of list) if (![...modelSel.options].some((o) => o.value === m.id)) modelSel.append(el("option", { value: m.id, text: `${m.label} (${m.id})` }));
          result.textContent = `✓ ${list.length} models available to this key`;
        } catch (e) {
          result.textContent = `✗ ${e.message}`;
        }
      } }),
      field(this.tr("effort"), sel(s.get("effort"), [["low", "low"], ["medium", "medium"], ["high", "high"], ["xhigh", "xhigh"], ["max", "max"]], (x) => s.set({ effort: x }))),
      field(this.tr("showThinking"), chk(s.get("showThinking"), (x) => s.set({ showThinking: x }))),
      el("div", { class: "muted small", text: `${getModel(s.get("model")).label}: $${getModel(s.get("model")).input ?? "?"} / $${getModel(s.get("model")).output ?? "?"} per 1M tokens (input/output). Estimates only — see your Anthropic Console for billing.` })
    );

    // Helper
    const hres = el("div", { class: "small" });
    v.append(
      el("div", { class: "sectionTitle", text: this.tr("settingsHelper") }),
      field(this.tr("helperUrl"), txt(s.get("helperUrl"), (x) => s.set({ helperUrl: x }).then(() => (this.helper.url = x.replace(/\/$/, ""))))),
      field(this.tr("helperToken"), txt(s.get("helperToken"), (x) => s.set({ helperToken: x }).then(() => (this.helper.token = x)), { type: "password" })),
      field(this.tr("bridgeDir"), txt(s.get("helperBridgeDir"), (x) => s.set({ helperBridgeDir: x }).then(() => (this.helper.bridgeDir = x)))),
      el("button", { text: this.tr("test"), onclick: async () => {
        const st = await this.helper.health();
        hres.textContent = `${st.state}${st.transport ? ` via ${st.transport}` : ""}${st.version ? ` · v${st.version}` : ""} · ffmpeg ${st.tools?.ffmpeg ? "✓" : "✗"} · whisper ${st.tools?.whisper ? "✓" : "✗"}`;
        this.refreshStatus();
      } }),
      hres
    );

    // Behaviour
    const list = (arr) => (arr || []).map((i) => i + 1).join(",");
    const parse = (str) => String(str).split(/[,\s]+/).map(Number).filter((n) => n > 0).map((n) => n - 1);
    v.append(
      el("div", { class: "sectionTitle", text: this.tr("settingsBehavior") }),
      field(this.tr("backup"), chk(s.get("backupBeforeEdits"), (x) => s.set({ backupBeforeEdits: x }))),
      field(this.tr("framesPerClip"), num(s.get("framesPerClip"), (x) => s.set({ framesPerClip: x }))),
      field(this.tr("frameWidth"), num(s.get("frameWidth"), (x) => s.set({ frameWidth: x }))),
      field(this.tr("maxFrames"), num(s.get("maxFramesPerRequest"), (x) => s.set({ maxFramesPerRequest: x }))),
      el("div", { class: "small", text: this.tr("protectedTracks") }),
      field(this.tr("videoTracks"), txt(list(s.get("protectedVideoTracks")), (x) => s.set({ protectedVideoTracks: parse(x) }).then(() => (this.host.settings.protectedVideoTracks = parse(x))))),
      field(this.tr("audioTracks"), txt(list(s.get("protectedAudioTracks")), (x) => s.set({ protectedAudioTracks: parse(x) }).then(() => (this.host.settings.protectedAudioTracks = parse(x))))),
      field(this.tr("quickCommands"), el("textarea", { rows: "4", class: "wide", onchange: (e) => s.set({ quickCommands: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) }).then(() => this.refreshStatus()) }, (s.get("quickCommands") || []).map((c) => (typeof c === "string" ? c : c[this.lang] || c.en)).join("\n")))
    );

    // Brand
    const brand = s.get("brand") || {};
    const bset = (k) => (x) => s.set({ brand: { ...s.get("brand"), [k]: x } });
    v.append(
      el("div", { class: "sectionTitle", text: this.tr("settingsBrand") }),
      ...["logo:logoPath", "fonts:fonts", "titleMogrt:titleMogrt", "lowerThirdMogrt:lowerThirdMogrt", "sfxFolder:sfxFolder", "musicFolder:musicFolder", "lutFolder:lutFolder"].map((p) => {
        const [label, k] = p.split(":");
        return field(this.tr(label), txt(brand[k], bset(k)));
      })
    );

    // Calibration + self-test
    const stOut = el("pre", { class: "small" });
    v.append(
      el("div", { class: "sectionTitle", text: this.tr("settingsCalib") }),
      field(this.tr("keyframeBase"), sel(s.get("keyframeTimeBase"), [["media", "source media time"], ["clip", "clip start"]], (x) => s.set({ keyframeTimeBase: x }).then(() => (this.host.settings.keyframeTimeBase = x)))),
      field(this.tr("volumeUnits"), sel(s.get("volumeUnits"), [["auto", "auto-detect"], ["db", "dB"], ["linear", "linear gain"]], (x) => s.set({ volumeUnits: x }).then(() => (this.host.settings.volumeUnits = x)))),
      el("button", { class: "primary", text: this.tr("runSelfTest"), onclick: async () => {
        stOut.textContent = `${this.tr("selfTestRunning")}\n`;
        const r = await runSelfTest(this.host, { onStep: (x) => x.status !== "running" && (stOut.textContent += `${x.status === "pass" ? "✓" : "✗"} ${x.name}: ${x.detail ?? ""}\n`) });
        stOut.textContent += `\n${r.ok ? "ALL PASSED" : "SOME CHECKS FAILED"} (source: ${r.source || "-"})\nFindings: ${JSON.stringify(r.findings)}`;
        if (r.findings.volumeUnits && s.get("volumeUnits") === "auto") this.host.settings.volumeUnits = "auto";
        this.memory.log(`Self-test: ${r.ok ? "passed" : "failed"} ${JSON.stringify(r.findings)}`, r.ok);
      } }),
      stOut
    );

    // Privacy
    const consent = s.get("consent") || {};
    const cset = (k) => (x) => s.set({ consent: { ...s.get("consent"), [k]: x } });
    v.append(
      el("div", { class: "sectionTitle", text: this.tr("settingsPrivacy") }),
      field(this.tr("consentFrames"), chk(consent.frames, cset("frames"))),
      field(this.tr("consentTranscripts"), chk(consent.transcripts, cset("transcripts"))),
      field(this.tr("consentReference"), chk(consent.reference, cset("reference"))),
      field(this.tr("consentAttachments"), chk(consent.attachments, cset("attachments"))),
      el("div", { class: "muted small", text: this.lang === "ar" ? "ما يُرسل إلى Anthropic: نص المحادثة، وصف التايم لاين، إطارات مصغّرة (بموافقتك)، النصوص المفرغة (بموافقتك). لا تُرفع ملفات الفيديو أو الصوت. المساعد المحلي لا يرى مفتاح API." : "Sent to Anthropic: chat text, timeline descriptions, small frames (with consent), transcripts (with consent). Video/audio files are never uploaded. The local helper never sees your API key." }),
      el("div", { class: "muted small", text: `HSN AI Editor 0.1.0 · Premiere ${this.host.capabilities?.version || "?"} · UXP` })
    );
  }
}

function fmtK(n) {
  return n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const TOOL_LABELS = {
  get_timeline_state: ["قراءة التايم لاين", "Reading timeline"],
  get_project_media: ["قراءة الخامات", "Listing media"],
  get_work_scope: ["تحديد النطاق", "Resolving scope"],
  analyze_footage: ["تحليل الخامات", "Analyzing footage"],
  view_frames: ["مشاهدة إطارات", "Viewing frames"],
  record_shot_notes: ["تسجيل ملاحظات اللقطات", "Saving shot notes"],
  search_footage: ["بحث في الخامات", "Searching footage"],
  get_transcript: ["تفريغ الكلام", "Transcript"],
  analyze_audio: ["تحليل الصوت", "Audio analysis"],
  list_effects_and_transitions: ["المؤثرات المتاحة", "Available effects"],
  check_timeline: ["مراجعة تقنية", "Technical check"],
  propose_edit_plan: ["خطة المونتاج", "Edit plan"],
  execute_plan: ["تنفيذ الخطة", "Executing plan"],
  manage_versions: ["النسخ", "Versions"],
  set_constraint: ["حفظ قرار", "Saving decision"],
  pin_parts: ["تثبيت أجزاء", "Pinning parts"],
  list_constraints: ["القيود", "Constraints"],
  remove_constraint: ["إزالة قيد", "Removing constraint"],
  save_style: ["حفظ أسلوب", "Saving style"],
  get_style: ["قراءة أسلوب", "Reading style"],
  edit_timeline: ["تعديل التايم لاين", "Editing timeline"],
  adjust_audio: ["تعديل الصوت", "Adjusting audio"],
  adjust_visual: ["تعديل الصورة", "Adjusting picture"],
  markers: ["Markers", "Markers"],
  restore: ["استعادة", "Restore"],
  project_ops: ["عمليات المشروع", "Project operations"],
  build_captions: ["تجهيز الترجمة", "Building captions"],
  write_captions: ["كتابة SRT", "Writing SRT"],
  read_captions: ["قراءة SRT", "Reading SRT"],
  insert_title: ["إدراج عنوان", "Inserting title"],
  render_derivative: ["تصيير مقطع مشتق", "Rendering clip"],
  create_format_version: ["نسخة بمقاس آخر", "Format version"],
  analyze_reference: ["تحليل المرجع", "Analyzing reference"],
  save_reference_profile: ["حفظ ملف المرجع", "Saving reference profile"],
  export_media: ["تصدير", "Export"],
};
function toolLabel(name, lang) {
  const l = TOOL_LABELS[name];
  return l ? l[lang === "ar" ? 0 : 1] : name;
}
