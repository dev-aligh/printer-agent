"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const { resolveProfile } = require("../src/profiles");
test("statement is irrevocably A5 portrait", () => { const p = resolveProfile("statement_a5", { paper: "thermal-80", orientation: "landscape" }); assert.equal(p.paper, "A5"); assert.equal(p.orientation, "portrait"); });
test("cargo A5 is irrevocably landscape", () => { assert.equal(resolveProfile("cargo_a5", { orientation: "portrait" }).orientation, "landscape"); });
test("thermal cargo creates two spool jobs for each copy", () => { const p = resolveProfile("cargo_thermal", { copies: 3 }); assert.equal(p.jobsPerCopy * p.copies, 6); assert.equal(p.cutAfterEachCopy, true); });
