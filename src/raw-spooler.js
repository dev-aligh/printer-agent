"use strict";
// Windows-only native bridge. Generic printers use Chromium -> Windows Spooler;
// raw mode is opt-in for any installed printer/driver that supports RAW data.
const { spawn } = require("child_process");
const path = require("path");
function printRaw(printer, bytes, resourcesPath) {
  return new Promise((resolve, reject) => {
    const helper = path.join(resourcesPath, "RawPrint.exe");
    const child = spawn(helper, ["--printer", printer], { windowsHide: true });
    child.once("error", () => reject(new Error("RawPrint.exe در نصب Agent موجود نیست.")));
    child.stdin.end(bytes);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`چاپ خام با کد ${code} ناموفق بود.`)));
  });
}
function rawHelper(resourcesPath, args, input = "") {
  return new Promise((resolve, reject) => {
    const helper = path.join(resourcesPath, "RawPrint.exe");
    const child = spawn(helper, args, { windowsHide: true }); let output = ""; let error = "";
    child.once("error", () => reject(new Error("RawPrint.exe در نصب Agent موجود نیست.")));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { error += chunk; });
    child.once("exit", (code) => code === 0 ? resolve(output) : reject(new Error(error || `Windows Spooler با کد ${code} پاسخ داد.`)));
  });
}
async function getJobs(printer, resourcesPath) { return JSON.parse(await rawHelper(resourcesPath, ["--jobs", printer])); }
async function controlJob(printer, jobId, action, resourcesPath) { await rawHelper(resourcesPath, ["--job", printer, `${action}:${jobId}`]); }
async function printerPreferences(printer, resourcesPath, action = "read", settings) {
  const command = { read: "--preferences", apply: "--apply-preferences", reset: "--reset-preferences" }[action];
  if (!command) throw new Error("Invalid preference action");
  return JSON.parse((await rawHelper(resourcesPath, [command, printer], settings ? JSON.stringify(settings) : "")).replace(/^\uFEFF/, ""));
}
module.exports = { printRaw, getJobs, controlJob, printerPreferences };
