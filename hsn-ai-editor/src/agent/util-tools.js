export { uid } from "../core/util.js";

export function safeFileName(s) {
  return String(s || "file").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "file";
}
