// UTF-8 + base64 helpers. UXP has no TextDecoder (documented in Adobe's
// network recipe), so streaming responses are decoded here, carrying
// incomplete multi-byte sequences (Arabic is 2 bytes/char) across chunks.

export class Utf8StreamDecoder {
  constructor() {
    this.pending = [];
  }
  /** Decode a Uint8Array chunk; returns the complete characters. */
  decode(bytes, { stream = true } = {}) {
    const all = this.pending.length ? concat(Uint8Array.from(this.pending), bytes) : bytes;
    let end = all.length;
    if (stream) {
      // Find start of a possibly incomplete trailing sequence.
      let i = all.length - 1;
      let back = 0;
      while (i >= 0 && back < 4 && (all[i] & 0xc0) === 0x80) { i--; back++; }
      if (i >= 0) {
        const lead = all[i];
        const need = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
        if (need > 1 && all.length - i < need) end = i;
      }
    }
    this.pending = Array.from(all.subarray(end));
    return decodeUtf8(all.subarray(0, end));
  }
  flush() {
    const out = decodeUtf8(Uint8Array.from(this.pending));
    this.pending = [];
    return out;
  }
}

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function decodeUtf8(bytes) {
  let out = "";
  let i = 0;
  const n = bytes.length;
  const chunk = [];
  while (i < n) {
    const b0 = bytes[i++];
    let cp;
    if (b0 < 0x80) cp = b0;
    else if (b0 >= 0xc0 && b0 < 0xe0 && i < n) cp = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b0 >= 0xe0 && b0 < 0xf0 && i + 1 < n) {
      cp = ((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else if (b0 >= 0xf0 && i + 2 < n) {
      cp = ((b0 & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else cp = 0xfffd;
    if (cp > 0xffff) {
      cp -= 0x10000;
      chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else chunk.push(cp);
    if (chunk.length > 8192) {
      out += String.fromCharCode.apply(null, chunk);
      chunk.length = 0;
    }
  }
  if (chunk.length) out += String.fromCharCode.apply(null, chunk);
  return out;
}

export function encodeUtf8(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += B64[n >> 18] + B64[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + "=";
  }
  return out;
}
