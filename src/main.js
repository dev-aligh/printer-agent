"use strict";
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const { createConfigStore } = require("./config-store");
const { createApi } = require("./http-api");
const { getJobs, controlJob } = require("./raw-spooler");

let settingsWindow; let tray; let api; let store;
function showSettings() {
  if (settingsWindow) return settingsWindow.show();
  settingsWindow = new BrowserWindow({ width: 860, height: 720, minWidth: 720, minHeight: 600, title: "تنظیمات چاپ میروکب", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  settingsWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  settingsWindow.on("closed", () => { settingsWindow = undefined; });
}
async function getPrinters() {
  const window = settingsWindow || new BrowserWindow({ show: false });
  try { return await window.webContents.getPrintersAsync(); } finally { if (window !== settingsWindow) window.destroy(); }
}
async function printHtml(html, deviceName, profile) {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    await new Promise((resolve, reject) => win.webContents.print({ silent: true, printBackground: true, deviceName, landscape: profile.orientation === "landscape", copies: 1, margins: { marginType: "none" }, pageSize: profile.paper === "A5" ? "A5" : profile.paper === "thermal-58" ? { width: 58000, height: 130000 } : profile.paper === "thermal-80" ? { width: 80000, height: 130000 } : "A5" }, (ok, failure) => ok ? resolve() : reject(new Error(failure || "Windows Spooler چاپ را نپذیرفت."))));
  } finally { win.destroy(); }
}
app.whenReady().then(async () => {
  store = createConfigStore(app.getPath("userData"));
  api = createApi({ config: store, getPrinters, printHtml, resourcesPath: process.resourcesPath });
  api.listen(store.get().port, "127.0.0.1");
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip("Mirocab Print Agent");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "تنظیمات", click: showSettings }, { label: "خروج", click: () => app.quit() }]));
  tray.on("click", showSettings); showSettings();
});
ipcMain.handle("config:get", () => store.get());
ipcMain.handle("config:save", (_, patch) => store.update(patch));
ipcMain.handle("printers:list", getPrinters);
ipcMain.handle("printer:jobs", (_, printer) => getJobs(printer, process.resourcesPath));
ipcMain.handle("printer:job-control", (_, printer, jobId, action) => controlJob(printer, jobId, action, process.resourcesPath));
ipcMain.handle("agent:test-print", async (_, printer) => printHtml("<html dir='rtl'><body style='font-family:Tahoma;text-align:center;padding:20mm'><h2>تست چاپ میروکب</h2><p>اتصال Agent و Windows Spooler برقرار است.</p></body></html>", printer, { orientation: "portrait", paper: "A5" }));
app.on("window-all-closed", (event) => event.preventDefault());
app.on("before-quit", () => { if (api) api.close(); });
