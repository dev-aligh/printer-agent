"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const { resolveProfile } = require("../src/profiles");
test("statement accepts paper and orientation overrides", () => { const p = resolveProfile("statement_a5", { paper: "thermal-80", orientation: "landscape" }); assert.equal(p.paper, "thermal-80"); assert.equal(p.orientation, "landscape"); });
test("cargo A5 accepts portrait", () => { assert.equal(resolveProfile("cargo_a5", { orientation: "portrait" }).orientation, "portrait"); });
test("thermal cargo sends one spool job for each copy", () => { const p = resolveProfile("cargo_thermal", { copies: 3 }); assert.equal(p.jobsPerCopy || 1, 1); assert.equal(p.cutAfterEachCopy, false); });
test("profile print controls are bounded and custom roll dimensions are retained", () => { const p = resolveProfile("passenger_ticket", { paper: "custom-roll", scale: 250, marginTop: -1, rollWidthMm: 76, rollHeightMm: 210 }); assert.equal(p.paper, "custom-roll"); assert.equal(p.scale, 200); assert.equal(p.marginTop, 0); assert.equal(p.rollWidthMm, 76); assert.equal(p.rollHeightMm, 210); });
test("cut mode is configurable for thermal documents", () => { assert.equal(resolveProfile("passenger_ticket", { cutMode: "at-end" }).cutAtEnd, true); assert.equal(resolveProfile("cargo_thermal", { cutMode: "none" }).cutAfterEachCopy, false); });

test("every document accepts every paper, both orientations and all cut modes", () => { for (const id of Object.keys(require("../src/profiles").DOCUMENT_PROFILES)) for (const paper of ["A5", "thermal-58", "thermal-80", "custom-roll"]) for (const orientation of ["portrait", "landscape"]) for (const cutMode of ["none", "at-end", "after-each-copy"]) { const p = resolveProfile(id, { paper, orientation, cutMode }); assert.equal(p.paper, paper); assert.equal(p.orientation, orientation); assert.equal(p.cutMode, cutMode); } });
