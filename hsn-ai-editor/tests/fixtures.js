// Shared simulated project: several clips, music, linked A/V, a locked track.
import { createMockPpro, TPS } from "../src/host/mock/ppro-mock.js";
import { PremiereHost } from "../src/host/premiere/adapter.js";

export const sec = (s) => Math.round(s * TPS);

export function demoProject(opts = {}) {
  const files = new Map();
  const mock = createMockPpro({
    writeFile: (p, b) => files.set(p, b),
    media: [
      {
        path: "/footage/interview_A.mp4", name: "interview_A.mp4", duration: 120,
        transcript: {
          language: "en-us",
          speakers: [{ id: "s1", name: "Speaker 1" }],
          segments: [
            { start: 2, duration: 6, speaker: "s1", language: "en-us", words: [{ start: 2, duration: 1, text: "We", confidence: 0.9, eos: false, tags: [], type: "word" }, { start: 3, duration: 5, text: "started with nothing.", confidence: 0.9, eos: true, tags: [], type: "word" }] },
            { start: 40, duration: 8, speaker: "s1", language: "en-us", words: [{ start: 40, duration: 8, text: "Craft is patience.", confidence: 0.95, eos: true, tags: [], type: "word" }] },
          ],
        },
      },
      { path: "/footage/hands_product.mp4", name: "hands_product.mp4", duration: 20, scenes: [4, 9, 15] },
      { path: "/footage/workshop_wide.mp4", name: "workshop_wide.mp4", duration: 15 },
      { path: "/footage/street_night.mov", name: "street_night.mov", duration: 30, fps: 23.976 },
      { path: "/audio/music_bed.wav", name: "music_bed.wav", duration: 90, hasVideo: false },
      { path: "/audio/whoosh.wav", name: "whoosh.wav", duration: 1.2, hasVideo: false },
      { path: "/mogrt/lower_third.mogrt", name: "lower_third.mogrt", duration: 5, hasAudio: false, isMogrt: true },
    ],
    timeline: [
      { path: "/footage/interview_A.mp4", track: 0, start: 0, in: 5, out: 25 },
      { path: "/footage/hands_product.mp4", track: 0, start: 20, in: 2, out: 10 },
      { path: "/footage/workshop_wide.mp4", track: 1, audioTrack: 1, start: 4, in: 0, out: 6 },
      { path: "/audio/music_bed.wav", audioTrack: 2, track: 0, start: 0, in: 0, out: 40 },
    ],
    lockedAudioTracks: opts.lockedAudio ?? [],
    semantics: opts.semantics,
    volumeUnits: opts.volumeUnits,
  });
  const host = new PremiereHost(mock.ppro, { settings: opts.hostSettings });
  return { ...mock, host, files };
}
