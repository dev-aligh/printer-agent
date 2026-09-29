"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { rawHelper } = require("../src/raw-spooler");
const { createHtmlPrinter } = require("../src/html-printer");
const { resolveProfile } = require("../src/profiles");

function fixture(stage) {
  let destroyed = false; let options;
  class Window {
    webContents = {
      executeJavaScript: () => stage === "prepare" ? new Promise(() => {}) : Promise.resolve(true),
      print: (value, callback) => {
        options = value;
        if (stage === "callback") return;
        if (stage === "throw") throw new Error("driver exception");
        callback(stage !== "reject", "driver rejected");
      }
    };
    loadURL() { return stage === "load" ? new Promise(() => {}) : Promise.resolve(); }
    isDestroyed() { return destroyed; }
    destroy() { destroyed = true; }
  }
  const print = createHtmlPrinter({ BrowserWindow: Window, printerPreferences: async () => ({ widthMm: 148, heightMm: 210, orientation: "landscape" }), timeoutMs: 20 });
  return { print: () => print("<p>test</p>", "selected", resolveProfile("statement_a5", { marginTop: 10 })), destroyed: () => destroyed, options: () => options };
}
test("printing uses pixel margins, micron paper and selected Windows orientation", async () => {
  const f = fixture(); await f.print();
  assert.equal(f.options().deviceName, "selected");
  assert.equal(f.options().landscape, true);
  assert.equal(f.options().margins.top, 10 * 96 / 25.4);
  assert.deepEqual(f.options().pageSize, { width: 148000, height: 210000 });
  assert.equal(f.destroyed(), true);
});
for (const stage of ["load", "prepare", "callback", "throw", "reject"]) test(`print ${stage} failure releases its window and rejects`, async () => {
  const f = fixture(stage); await assert.rejects(f.print()); assert.equal(f.destroyed(), true);
});
function child() {
  const process = new EventEmitter();
  process.stdin = new EventEmitter(); process.stdin.end = () => {};
  process.stdout = new EventEmitter(); process.stderr = new EventEmitter();
  process.kill = () => { process.killed = true; };
  return process;
}
test("hung native driver is terminated and request rejects", async () => {
  const process = child();
  await assert.rejects(rawHelper("resources", [], "", { spawnProcess: () => process, timeoutMs: 20 }), /مهلت/);
  assert.equal(process.killed, true);
});
test("native output is drained before resolving", async () => {
  const process = child();
  const request = rawHelper("resources", [], "", { spawnProcess: () => process, timeoutMs: 100 });
  process.emit("exit", 0);
  process.stdout.emit("data", "{\"ok\":true}"); process.emit("close", 0);
  assert.equal(await request, '{"ok":true}');
});
