"use strict";
const path = require("path");
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require("electron");
const { createConfigStore } = require("./config-store");
const { createApi } = require("./http-api");
const { getJobs, controlJob } = require("./raw-spooler");
const { resolveProfile } = require("./profiles");

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
    if (profile.paper !== "A5") {
      // The panel owns the document layout, but a browser's default body
      // margin or a template's top spacing becomes wasted thermal paper.
      // Normalize only the print origin before handing the page to Windows.
      await win.webContents.executeJavaScript(`
        (() => {
          const style = document.createElement("style");
          style.textContent = "@page{margin:0!important}html,body{margin-top:0!important;padding-top:0!important}[data-miro-print-root],body>:first-child{margin-top:0!important;padding-top:0!important}";
          document.head.appendChild(style);
        })()
      `);
    }
    const width = profile.paper === "thermal-58" ? 58 : profile.paper === "thermal-80" ? 80 : profile.rollWidthMm;
    // Thermal drivers commonly accept their configured roll height but can
    // hang without invoking Electron's callback for a document-sized custom
    // height. Keep the page size stable and let the driver handle the roll.
    const rollHeightMm = profile.paper === "A5" ? null : profile.rollHeightMm;
    const pageSize = profile.paper === "A5" ? "A5" : { width: width * 1000, height: rollHeightMm * 1000 };
    const margins = { marginType: "custom", top: profile.marginTop * 1000, right: profile.marginRight * 1000, bottom: profile.marginBottom * 1000, left: profile.marginLeft * 1000 };
    // Some Windows drivers never call Chromium's print callback when their
    // spooler connection has failed.  Do not leave the settings UI (or API
    // job) waiting forever in that case.
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        error ? reject(error) : resolve();
      };
      const timeout = setTimeout(() => finish(new Error("چاپگر تا ۳۰ ثانیه پاسخی نداد. اتصال، روشن‌بودن چاپگر و Windows Print Spooler را بررسی کنید.")), 30_000);
      try {
        win.webContents.print({
          silent: true, printBackground: true, deviceName,
          landscape: profile.orientation === "landscape", copies: 1,
          scaleFactor: profile.scale, margins, pageSize
        }, (ok, failure) => finish(ok ? null : new Error(failure || "Windows Spooler چاپ را نپذیرفت.")));
      } catch (error) {
        finish(error);
      }
    });
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
