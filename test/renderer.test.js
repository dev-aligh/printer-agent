"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { DOCUMENT_PROFILES } = require("../src/profiles");

test("all document settings remain enabled when switching documents and paper types", async () => {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: id === "profile" ? "statement_a5" : "", disabled: false, hidden: false, classList: { toggle() {} } });
    return elements.get(id);
  };
  const context = {
    document: { getElementById: element, querySelector: element, addEventListener() {} },
    window: { mirocab: { getConfig: async () => ({ enabled: true, profileSettings: {} }), printers: async () => [] } }
  };
  await vm.runInNewContext(fs.readFileSync(require.resolve("../src/renderer/renderer.js"), "utf8"), context);
  for (const profile of Object.keys(DOCUMENT_PROFILES)) {
    element("profile").value = profile; element("profile").onchange();
    for (const paper of ["A5", "thermal-58", "thermal-80", "custom-roll"]) {
      element("profilePaper").value = paper; element("profilePaper").onchange();
      for (const id of ["profilePaper", "profileOrientation", "profileCopies", "profileScale", "marginTop", "marginRight", "marginBottom", "marginLeft", "rollWidthMm", "rollHeightMm", "profileCutMode"]) assert.equal(element(id).disabled, false, `${profile}/${paper}/${id}`);
      assert.equal(element("rollSettings").hidden, false);
    }
  }
});
