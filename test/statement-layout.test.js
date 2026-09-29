"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { prepareHtmlForPrint } = require("../src/statement-layout");

const statement = { id: "statement_a5" };
const html = "<html><head></head><body><main>صورت</main></body></html>";

test("a landscape printer rotates a portrait A5 statement onto its page", () => {
  const prepared = prepareHtmlForPrint(html, statement, { orientation: "landscape" });
  assert.match(prepared, /@page \{ size: A5 landscape !important/);
  assert.match(prepared, /transform: rotate\(90deg\) !important/);
  assert.match(prepared, /left: 210mm !important/);
});

test("portrait statement and other document types keep the panel HTML unchanged", () => {
  assert.equal(prepareHtmlForPrint(html, statement, { orientation: "portrait" }), html);
  assert.equal(prepareHtmlForPrint(html, { id: "cargo_a5" }, { orientation: "landscape" }), html);
});
