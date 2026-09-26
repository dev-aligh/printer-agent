"use strict";
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require("electron");
const { createConfigStore } = require("./config-store");
const { createApi } = require("./http-api");
const { getJobs, controlJob } = require("./raw-spooler");

let settingsWindow; let tray; let api; let store;
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
  try { return await window.webContents.getPrintersAsync(); } finally { if (window !== settingsWindow) window.destroy(); }
}
async function printHtml(html, deviceName, profile) {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const width = profile.paper === "thermal-58" ? 58 : profile.paper === "thermal-80" ? 80 : profile.rollWidthMm;
    const pageSize = profile.paper === "A5" ? "A5" : { width: width * 1000, height: profile.rollHeightMm * 1000 };
    const margins = { marginType: "custom", top: profile.marginTop * 1000, right: profile.marginRight * 1000, bottom: profile.marginBottom * 1000, left: profile.marginLeft * 1000 };
    await new Promise((resolve, reject) => win.webContents.print({ silent: true, printBackground: true, deviceName, landscape: profile.orientation === "landscape", copies: 1, scaleFactor: profile.scale, margins, pageSize }, (ok, failure) => ok ? resolve() : reject(new Error(failure || "Windows Spooler چاپ را نپذیرفت."))));
  } finally { win.destroy(); }
}
app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  store = createConfigStore(app.getPath("userData"));
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
ipcMain.handle("config:save", (_, patch) => store.update(patch));
ipcMain.handle("printers:list", getPrinters);
ipcMain.handle("printer:jobs", (_, printer) => getJobs(printer, resourcesPath));
ipcMain.handle("printer:job-control", (_, printer, jobId, action) => controlJob(printer, jobId, action, resourcesPath));
ipcMain.handle("agent:test-print", async (_, printer) => printHtml("<html dir='rtl'><body style='font-family:Tahoma;text-align:center;padding:20mm'><h2>تست چاپ میروکب</h2><p>اتصال Agent و Windows Spooler برقرار است.</p></body></html>", printer, { orientation: "portrait", paper: "A5" }));
app.on("window-all-closed", (event) => event.preventDefault());
app.on("before-quit", () => { if (api) api.close(); });
