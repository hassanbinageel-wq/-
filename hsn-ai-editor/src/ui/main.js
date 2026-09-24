// Panel entry point (bundled to plugin/dist/main.js).
import { App } from "./app.js";
import { createUxpFs } from "../storage/fsio.js";

async function boot() {
  const root = document.getElementById("app");
  try {
    // eslint-disable-next-line no-undef
    const ppro = require("premierepro");
    // eslint-disable-next-line no-undef
    const uxp = require("uxp");
    const app = new App({ ppro, uxp, fsio: createUxpFs() });
    window.__hsn = app;
    await app.start();
  } catch (e) {
    root.innerHTML = `<div class="fatal"><b>HSN AI Editor could not start.</b><br>${String(e && e.message ? e.message : e).replace(/</g, "&lt;")}<br><br>Requires Adobe Premiere 25.6 or later with UXP plugins enabled.</div>`;
    console.error(e);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
