"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createPrinterSettings } = require("../src/printer-settings");
function fixture(fail = false) {
  let state = { profileSettings: { cargo_a5: { printer: "P2", scale: 80 }, passenger_ticket: { printer: "P1", scale: 75 } } };
  const calls = [];
  const service = createPrinterSettings({
    store: { get: () => structuredClone(state), update: (patch) => (state = { ...state, ...patch }) },
    getPrinters: async () => [1, 2, 3, 4, 5].map(n => ({ name: `P${n}` })),
    preferences: async (...args) => { calls.push(args); if (fail) throw new Error("driver rejected"); return { widthMm: 148, heightMm: 210, orientation: "portrait" }; }
  });
  return { service, calls, state: () => state };
}
test("saving a profile changes only the selected printer among five", async () => {
  const f = fixture();
  await f.service.save("statement_a5", { printer: "P1", paper: "thermal-80", orientation: "landscape" });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], "P1");
  assert.equal(f.calls[0][1], "apply");
  assert.equal(f.calls[0][2].paper, "thermal-80");
  assert.equal(f.calls[0][2].orientation, "landscape");
  assert.deepEqual(f.state().profileSettings.cargo_a5, { printer: "P2", scale: 80 });
  assert.deepEqual(Object.keys(f.state().printerSettings), ["P1"]);
});
test("driver failure does not persist a successful save", async () => {
  const f = fixture(true); const before = structuredClone(f.state());
  await assert.rejects(f.service.save("statement_a5", { printer: "P1" }), /driver rejected/);
  assert.deepEqual(f.state(), before);
});
test("reset only targets the selected queue and its local document settings", async () => {
  const f = fixture();
  await f.service.reset("P1");
  assert.deepEqual(f.calls, [["P1", "reset"]]);
  assert.equal(f.state().profileSettings.passenger_ticket.scale, 100);
  assert.deepEqual(f.state().profileSettings.cargo_a5, { printer: "P2", scale: 80 });
});
test("unknown printers and profiles never reach Windows mutations", async () => {
  const f = fixture();
  await assert.rejects(f.service.save("invalid", { printer: "P1" }));
  await assert.rejects(f.service.save("statement_a5", { printer: "missing" }));
  await assert.rejects(f.service.reset("missing"));
  assert.equal(f.calls.length, 0);
});
test("concurrent saves preserve both mappings", async () => {
  const f = fixture();
  await Promise.all([f.service.save("statement_a5", { printer: "P1" }), f.service.save("cargo_a5", { printer: "P2" })]);
  assert.equal(f.state().profileSettings.statement_a5.printer, "P1");
  assert.equal(f.state().profileSettings.cargo_a5.printer, "P2");
});
