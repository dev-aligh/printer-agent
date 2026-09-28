"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const { resolveProfile } = require("../src/profiles");
test("statement is irrevocably A5 portrait", () => { const p = resolveProfile("statement_a5", { paper: "thermal-80", orientation: "landscape" }); assert.equal(p.paper, "A5"); assert.equal(p.orientation, "portrait"); });
test("cargo A5 is irrevocably landscape", () => { assert.equal(resolveProfile("cargo_a5", { orientation: "portrait" }).orientation, "landscape"); });
test("thermal cargo sends two separate spool jobs for each copy", () => { const p = resolveProfile("cargo_thermal", { copies: 3 }); assert.equal(p.jobsPerCopy * p.copies, 6); assert.equal(p.cutAfterEachCopy, false); });
test("profile print controls are bounded and custom roll dimensions are retained", () => { const p = resolveProfile("passenger_ticket", { paper: "custom-roll", scale: 250, marginTop: -1, rollWidthMm: 76, rollHeightMm: 210 }); assert.equal(p.paper, "custom-roll"); assert.equal(p.scale, 200); assert.equal(p.marginTop, 0); assert.equal(p.rollWidthMm, 76); assert.equal(p.rollHeightMm, 210); });
test("cut mode is configurable for thermal documents", () => { assert.equal(resolveProfile("passenger_ticket", { cutMode: "at-end" }).cutAtEnd, true); assert.equal(resolveProfile("cargo_thermal", { cutMode: "none" }).cutAfterEachCopy, false); });
