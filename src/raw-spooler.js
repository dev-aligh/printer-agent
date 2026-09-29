"use strict";
// Windows-only native bridge. Generic printers use Chromium -> Windows Spooler;
// raw mode is opt-in for any installed printer/driver that supports RAW data.
const { spawn } = require("child_process");
const path = require("path");
function printRaw(printer, bytes, resourcesPath) {
  return rawHelper(resourcesPath, ["--printer", printer], bytes);
}
function rawHelper(resourcesPath, args, input = "", { spawnProcess = spawn, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const helper = path.join(resourcesPath, "RawPrint.exe");
    const child = spawnProcess(helper, args, { windowsHide: true }); let output = ""; let error = "";
    let settled = false;
    const finish = (failure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      failure ? reject(failure) : resolve(output);
    };
    const timer = setTimeout(() => {
      finish(new Error("مهلت پاسخ درایور چاپگر تمام شد. اتصال چاپگر و Windows Print Spooler را بررسی کنید."));
      child.kill();
    }, timeoutMs);
    child.once("error", (cause) => finish(new Error(`اجرای RawPrint.exe ناموفق بود: ${cause.message}`)));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { error += chunk; });
    child.once("close", (code) => finish(code === 0 ? null : new Error(error || `Windows Spooler با کد ${code} پاسخ داد.`)));
  });
}
async function getJobs(printer, resourcesPath) { return JSON.parse(await rawHelper(resourcesPath, ["--jobs", printer])); }
async function controlJob(printer, jobId, action, resourcesPath) { await rawHelper(resourcesPath, ["--job", printer, `${action}:${jobId}`]); }
async function printerPreferences(printer, resourcesPath, action = "read", settings) {
  const command = { read: "--preferences", apply: "--apply-preferences", reset: "--reset-preferences" }[action];
  if (!command) throw new Error("Invalid preference action");
  return JSON.parse((await rawHelper(resourcesPath, [command, printer], settings ? JSON.stringify(settings) : "")).replace(/^\uFEFF/, ""));
}
module.exports = { printRaw, getJobs, controlJob, printerPreferences, rawHelper };
