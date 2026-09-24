// Server-Sent-Events parser (text in, {event, data} out). Works on
// arbitrary chunk boundaries.

export class SSEParser {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.buf = "";
    this.event = null;
    this.data = [];
  }
  push(text) {
    this.buf += text;
    let idx;
    while ((idx = this.buf.search(/\r?\n/)) >= 0) {
      const line = this.buf.slice(0, idx);
      const nl = this.buf[idx] === "\r" ? 2 : 1;
      this.buf = this.buf.slice(idx + nl);
      this.line(line);
    }
  }
  line(line) {
    if (line === "") {
      if (this.data.length || this.event) {
        this.onEvent({ event: this.event || "message", data: this.data.join("\n") });
      }
      this.event = null;
      this.data = [];
      return;
    }
    if (line.startsWith(":")) return;
    const c = line.indexOf(":");
    const field = c < 0 ? line : line.slice(0, c);
    let value = c < 0 ? "" : line.slice(c + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") this.event = value;
    else if (field === "data") this.data.push(value);
  }
  end() {
    if (this.buf) this.line(this.buf);
    this.buf = "";
    this.line("");
  }
}
