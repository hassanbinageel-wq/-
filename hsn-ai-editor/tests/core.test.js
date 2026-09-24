import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../src/core/time.js";
import { validate, S } from "../src/core/schema.js";
import { Utf8StreamDecoder, encodeUtf8, bytesToBase64, decodeUtf8 } from "../src/core/utf8.js";
import { normalizeText, tokenize, hashObject, redactSecrets } from "../src/core/util.js";

test("ticks per frame are integers for all standard rates", () => {
  for (const fps of [23.976, 24, 25, 29.97, 30, 50, 59.94, 60]) {
    const tpf = T.ticksPerFrame(fps);
    assert.ok(Number.isInteger(tpf), `fps ${fps}`);
    assert.equal(tpf * T.toRationalFps(fps).num, T.TICKS_PER_SECOND * T.toRationalFps(fps).den);
  }
  assert.equal(T.ticksPerFrame(25), 10160640000);
  assert.equal(T.ticksPerFrame(23.976), 10594584000);
});

test("frame snapping and timecode round trip", () => {
  const fps = 25;
  const t = T.secondsToTicks(1.013); // between frames
  assert.equal(T.snapTicks(t, fps), T.framesToTicks(25, fps));
  assert.equal(T.snapTicks(T.secondsToTicks(1.03), fps, "ceil"), T.framesToTicks(26, fps));
  assert.equal(T.formatTimecode(T.framesToTicks(25 * 61 + 7, fps), fps), "00:01:01:07");
  assert.equal(T.parseTime("00:01:01:07", fps), T.framesToTicks(25 * 61 + 7, fps));
  assert.equal(T.parseTime(2.5), T.secondsToTicks(2.5));
  assert.equal(T.parseTime("1:02.5"), T.secondsToTicks(62.5));
  assert.ok(T.isFrameAligned(T.framesToTicks(3, 29.97), 29.97));
  // NTSC: 30 frames at 29.97 is 1.001s
  assert.ok(Math.abs(T.framesToSeconds(30, 29.97) - 1.001) < 1e-9);
});

test("schema validator catches bad model input", () => {
  const schema = S.obj({ a: S.int("x", { minimum: 0 }), b: S.enm(["x", "y"]), c: S.arr(S.num("n")) }, ["a"]);
  assert.deepEqual(validate(schema, { a: 1, b: "x", c: [1, 2.5] }), []);
  assert.ok(validate(schema, { b: "z" }).length >= 2);
  assert.ok(validate(schema, { a: 1, extra: true }).some((e) => e.includes("unknown property")));
  assert.ok(validate(schema, { a: -1 }).some((e) => e.includes(">=")));
  assert.deepEqual(validate(S.time("t"), "00:00:01:00"), []);
});

test("utf8 streaming decoder handles Arabic split across chunks", () => {
  const text = "مونتاج وثائقي 🎬 cinematic";
  const bytes = encodeUtf8(text);
  const dec = new Utf8StreamDecoder();
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) out += dec.decode(bytes.subarray(i, i + 3));
  out += dec.flush();
  assert.equal(out, text);
  assert.equal(decodeUtf8(Buffer.from(text)), text);
  assert.equal(bytesToBase64(Buffer.from("hello world!!")), Buffer.from("hello world!!").toString("base64"));
});

test("arabic normalization for search", () => {
  assert.equal(normalizeText("أَحْمَدُ في المدينةِ"), "احمد في المدينه");
  assert.deepEqual(tokenize("لقطات اليد وهي تمسك المنتج"), ["يد", "وهي", "تمسك", "منتج"]);
  assert.equal(hashObject({ b: 1, a: 2 }), hashObject({ a: 2, b: 1 }));
  assert.ok(!redactSecrets("key sk-ant-api03-abcdefghijk").includes("abcdefghijk"));
});
