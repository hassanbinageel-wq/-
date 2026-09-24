// Adapter tests against the SIMULATED premierepro module (not real Premiere).
import test from "node:test";
import assert from "node:assert/strict";
import { demoProject, sec } from "./fixtures.js";

const items = (tl, kind, i) => tl.tracks[kind][i].items;

test("reads timeline with keys, source ranges and inferred A/V links", async () => {
  const { host } = demoProject();
  await host.init();
  const tl = await host.readTimeline();
  assert.equal(tl.sequence.fps, 25);
  assert.equal(items(tl, "video", 0).length, 2);
  const v = items(tl, "video", 0)[0];
  assert.equal(v.key, "V1:0.000");
  assert.equal(v.in, sec(5));
  assert.equal(v.end, sec(20));
  const a = items(tl, "audio", 0)[0];
  assert.ok(v.link && v.link === a.link, "linked pair inferred");
  assert.equal(items(tl, "audio", 2)[0].path, "/audio/music_bed.wav");
});

test("actions created outside lockedAccess are rejected by the simulation", async () => {
  const { ppro, project } = demoProject();
  const seq = await project.getActiveSequence();
  const clip = (await (await project.getRootItem()).getItems())[0];
  assert.throws(() => seq.createSetInPointAction(ppro.TickTime.TIME_ZERO), /lockedAccess/);
  assert.ok(clip);
});

test("placeSegment places an exact frame-aligned range and restores source marks", async () => {
  const { host, clips } = demoProject();
  const created = await host.placeSegment({ source: "/footage/street_night.mov", srcIn: sec(3.013), srcOut: sec(7), time: sec(40), videoTrack: 0, audioTrack: 0 });
  assert.equal(created.length, 2);
  const v = created.find((c) => c.kind === "video");
  assert.equal(v.start, sec(40));
  assert.equal(v.in, sec(3)); // snapped to the 25fps sequence grid
  assert.equal(v.end - v.start, sec(4));
  assert.equal(clips.get("/footage/street_night.mov").inMark, null, "source marks restored");
});

test("video-only B-roll does not overwrite audio already on the target audio track", async () => {
  const { host } = demoProject();
  const before = await host.readTimeline();
  const a1 = JSON.stringify(items(before, "audio", 0));
  const created = await host.placeSegment({ source: "/footage/hands_product.mp4", srcIn: sec(10), srcOut: sec(13), time: sec(2), videoTrack: 2, audioTrack: 0, audio: false });
  assert.equal(created.length, 1);
  assert.equal(created[0].kind, "video");
  const after = await host.readTimeline();
  assert.equal(JSON.stringify(items(after, "audio", 0).map(({ fp, ...r }) => r)), JSON.stringify(JSON.parse(a1).map(({ fp, ...r }) => r)));
  // the scratch track that absorbed the unwanted audio is empty
  assert.equal(after.tracks.audio.at(-1).items.length, 0);
});

for (const semantics of [{ setStart: "trim" }, { setStart: "move", setInPoint: "slip" }]) {
  test(`trim to exact range works with ${JSON.stringify(semantics)} semantics, keeping A/V in sync`, async () => {
    const { host } = demoProject({ semantics });
    await host.readTimeline();
    const res = await host.setItemRange("V1:0.000", { start: sec(1), end: sec(12), in: sec(6) });
    assert.equal(res.start, sec(1));
    assert.equal(res.end, sec(12));
    assert.equal(res.in, sec(6));
    const tl = await host.readTimeline();
    const a = items(tl, "audio", 0).find((i) => i.path.includes("interview"));
    assert.deepEqual([a.start, a.end, a.in], [sec(1), sec(12), sec(6)], "linked audio trimmed identically");
  });
}

test("move keeps linked audio in sync; protected tracks are refused", async () => {
  const { host } = demoProject({ hostSettings: { protectedAudioTracks: [2] } });
  await host.readTimeline();
  const moved = await host.moveItem("V1:20.000", sec(30));
  assert.equal(moved.start, sec(30));
  const tl = await host.readTimeline();
  assert.ok(items(tl, "audio", 0).some((i) => i.start === sec(30) && i.path.includes("hands")));
  await assert.rejects(host.setVolume("A3:0.000", { db: -12 }), /protected/);
});

test("Premiere-locked tracks: the transaction is rejected and nothing changes", async () => {
  const { host } = demoProject({ lockedAudio: [2] });
  await host.readTimeline();
  await assert.rejects(host.placeSegment({ source: "/audio/whoosh.wav", srcIn: 0, srcOut: sec(1), time: sec(5), audioTrack: 2 }), /rejected|locked/i);
  const tl = await host.readTimeline();
  assert.equal(items(tl, "audio", 2).length, 1);
});

test("split, ripple delete and markers", async () => {
  const { host } = demoProject();
  await host.readTimeline();
  const r = await host.splitItem("V1:0.000", sec(8));
  assert.ok(r.right.length >= 1);
  let tl = await host.readTimeline();
  const v1 = items(tl, "video", 0);
  assert.deepEqual(v1.slice(0, 2).map((i) => [i.start, i.end, i.in]), [[0, sec(8), sec(5)], [sec(8), sec(20), sec(13)]]);
  await host.removeItems(["V1:8.000"], { ripple: true });
  tl = await host.readTimeline();
  assert.equal(items(tl, "video", 0)[1].start, sec(8), "later clip rippled left");
  const m = await host.addMarker({ time: sec(3.01), name: "HSN: hook", comments: "strong opening", color: 1 });
  assert.equal(m.start, sec(3));
  tl = await host.readTimeline();
  assert.equal(tl.markers[0].name, "HSN: hook");
  assert.equal(await host.removeMarkers({ namePrefix: "HSN:" }), 1);
});

test("transitions, effects, keyframes and volume (dB and linear units)", async () => {
  for (const volumeUnits of ["db", "linear"]) {
    const { host } = demoProject({ volumeUnits });
    await host.readTimeline();
    await host.addTransition("V1:0.000", { matchName: "AE.ADBE Cross Dissolve New", durationTicks: sec(1), position: "end" });
    await host.addEffect("V1:0.000", { matchName: "AE.ADBE Gaussian Blur 2" });
    const kf = await host.setParam("V1:0.000", { component: "Motion", param: "Scale", keyframes: [{ t: 0, value: 100 }, { t: sec(5), value: 110 }] });
    assert.equal(kf.keyframes, 2);
    const vol = await host.setVolume("A3:0.000", { db: -18 });
    assert.equal(vol.units, volumeUnits);
    if (volumeUnits === "db") assert.equal(vol.startValue, -18);
    else assert.ok(Math.abs(vol.startValue - Math.pow(10, (-18 - 15) / 20)) < 1e-9);
    await assert.rejects(host.addTransition("A1:0.000", {}), /only exposes video transitions/);
  }
});

test("new empty sequence with same settings, vertical frame size, and backups", async () => {
  const { host } = demoProject();
  const src = await host.listSequences();
  const v = await host.createEmptySequenceLike(src[0].id, "Reel 9x16", { width: 1080, height: 1920 });
  const tl = await host.readTimeline(v.id);
  assert.equal(tl.sequence.width, 1080);
  assert.equal([...tl.tracks.video, ...tl.tracks.audio].flatMap((t) => t.items).length, 0);
  const orig = await host.readTimeline(src[0].id);
  assert.equal(orig.tracks.video[0].items.length, 2, "original untouched");
  const seqs = await host.listSequences();
  assert.ok(seqs.some((s) => s.name === "Reel 9x16"));
});

test("transcript from Premiere is normalized; frames export", async () => {
  const { host, files } = demoProject();
  await host.init();
  const tr = await host.transcript("/footage/interview_A.mp4");
  assert.equal(tr.segments[1].text, "Craft is patience.");
  assert.equal(tr.segments[1].end, 48);
  const p = await host.exportFrame({ time: sec(2), dir: "/tmp/frames", filename: "f1.jpg" });
  assert.ok(files.has(p));
});
