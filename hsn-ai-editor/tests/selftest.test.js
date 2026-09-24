// The on-device self-test, exercised here against the SIMULATION only.
import test from "node:test";
import assert from "node:assert/strict";
import { demoProject } from "./fixtures.js";
import { runSelfTest } from "../src/host/premiere/selftest.js";

for (const volumeUnits of ["db", "linear"]) {
  test(`self-test passes on the simulation (volume units: ${volumeUnits}) and cleans up`, async () => {
    const { host } = demoProject({ volumeUnits });
    const before = (await host.listSequences()).map((s) => s.name);
    const r = await runSelfTest(host);
    assert.ok(r.ok, JSON.stringify(r.results.filter((x) => !x.ok)));
    assert.equal(r.findings.volumeUnits, volumeUnits);
    assert.equal(r.findings.positionNormalized, true);
    assert.deepEqual((await host.listSequences()).map((s) => s.name), before, "temporary sequence removed");
  });
}
