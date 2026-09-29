"use strict";
const path = require("path");
const { createHtmlPrinter } = require("./html-printer");
const { withDeadline } = require("./deadline");
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require("electron");
const { createConfigStore } = require("./config-store");
const { createApi } = require("./http-api");
const { getJobs, controlJob, printerPreferences } = require("./raw-spooler");
const { createPrinterSettings } = require("./printer-settings");
const { resolveProfile } = require("./profiles");

let settingsWindow; let tray; let api; let store; let printerSettings;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
const resourcesPath = app.isPackaged
  ? path.join(process.resourcesPath, "resources")
  : path.join(__dirname, "..", "resources");
const appIconPath = path.join(resourcesPath, "tray-icon.png");
function showSettings() {
  if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({ width: 860, height: 720, minWidth: 720, minHeight: 600, title: "تنظیمات چاپ میروکب", icon: appIconPath, webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  settingsWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  settingsWindow.on("closed", () => { settingsWindow = undefined; });
}
app.on("second-instance", () => showSettings());
async function getPrinters() {
  const window = settingsWindow || new BrowserWindow({ show: false });
  try { return await withDeadline(() => window.webContents.getPrintersAsync(), 15000, "فهرست چاپگرها از ویندوز دریافت نشد."); } finally { if (window !== settingsWindow) window.destroy(); }
}

const printHtml = createHtmlPrinter({ BrowserWindow, printerPreferences, resourcesPath });
app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  store = createConfigStore(app.getPath("userData"));
  printerSettings = createPrinterSettings({ store, getPrinters, preferences: (printer, action, settings) => printerPreferences(printer, resourcesPath, action, settings) });
  api = createApi({ config: store, getPrinters, printHtml, resourcesPath });
  api.once("error", (error) => {
    const message = error.code === "EADDRINUSE"
      ? `پورت محلی ${store.get().port} در اختیار برنامهٔ دیگری است. Agent میروکب را از کنار ساعت ویندوز پیدا و ببندید، سپس دوباره اجرا کنید.`
      : `Agent نتوانست سرویس محلی چاپ را اجرا کند: ${error.message}`;
    dialog.showErrorBox("اجرای Agent ممکن نیست", message);
    app.quit();
  });
  api.listen(store.get().port, "127.0.0.1");
  const trayIcon = nativeImage.createFromPath(appIconPath);
  tray = new Tray(trayIcon);
  tray.setToolTip("Mirocab Print Agent — فعال");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "تنظیمات", click: showSettings }, { label: "خروج", click: () => app.quit() }]));
  tray.on("click", showSettings); showSettings();
});
ipcMain.handle("config:get", () => store.get());
ipcMain.handle("config:save", (_, patch) => store.update({ enabled: Boolean(patch.enabled) }));
ipcMain.handle("profile:save", (_, profileId, setting) => printerSettings.save(profileId, setting));
ipcMain.handle("printer:reset", (_, printer) => printerSettings.reset(printer));
ipcMain.handle("printer:preferences", (_, printer) => printerPreferences(printer, resourcesPath));
ipcMain.handle("printers:list", getPrinters);
ipcMain.handle("printer:jobs", (_, printer) => getJobs(printer, resourcesPath));
ipcMain.handle("printer:job-control", (_, printer, jobId, action) => controlJob(printer, jobId, action, resourcesPath));
ipcMain.handle("agent:test-print", async (_, profileId) => {
  const saved = store.get().profileSettings[profileId] || {};
  if (typeof saved.printer !== "string" || saved.printer.length === 0)
    throw new Error("ابتدا پرینتر همین نوع سند را ذخیره کنید.");
  const printer = (await getPrinters()).find((item) => item.name === saved.printer);
  if (!printer) throw new Error("پرینتر ذخیره‌شده برای این نوع سند یافت نشد.");
  const profile = resolveProfile(profileId, saved);
  return printHtml("<html dir='rtl'><head><style>@page{margin:0}html,body{margin:0;padding:0}body{font-family:Tahoma,sans-serif;text-align:center;padding:12mm}h2{margin:0}p{margin:8px 0 0}</style></head><body><h2>تست چاپ میروکب</h2><p>این job فقط با پروفایل ذخیره‌شدهٔ همین نوع سند ارسال شده است.</p></body></html>", printer.name, profile);
});
app.on("window-all-closed", (event) => event.preventDefault());
app.on("before-quit", () => { if (api) api.close(); });
