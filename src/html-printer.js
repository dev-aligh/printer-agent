"use strict";
const { withDeadline } = require("./deadline");
const { prepareHtmlForPrint } = require("./statement-layout");

function contentHeightMm(heightPx, profile) {
  const contentMm = Math.ceil((Number(heightPx) * 25.4) / 96);
  // Keep a tiny, intentional tail after the receipt while avoiding the
  // configured fixed-length blank section.
  return Math.min(
    1000,
    Math.max(20, contentMm + profile.marginTop + profile.marginBottom + 2),
  );
}

async function renderedThermalCargoHeightMm(win, profile, timeoutMs) {
  const heightPx = await withDeadline(
    () => win.webContents.executeJavaScript(`
      (() => {
        const root = document.querySelector("[data-miro-print-root]") ||
          document.querySelector(".receipt") || document.body;
        const rect = root.getBoundingClientRect();
        return Math.ceil(Math.max(root.scrollHeight, rect.height, rect.bottom));
      })()
    `),
    timeoutMs,
    "اندازه‌گیری طول رسید حرارتی ناموفق بود.",
  );
  return contentHeightMm(heightPx, profile);
}

function createHtmlPrinter({ BrowserWindow, printerPreferences, resourcesPath, timeoutMs = 30000 }) {
return async function printHtml(html, deviceName, profile) {
  // Read the selected queue's current Windows preferences, never reapply a document profile.
  const device = await printerPreferences(deviceName, resourcesPath);
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, backgroundThrottling: false } });
  try {
    const printableHtml = prepareHtmlForPrint(html, profile, device);
    await withDeadline(() => win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(printableHtml)), timeoutMs, "بارگذاری صفحهٔ چاپ بیش از حد طول کشید.");
    await withDeadline(() => win.webContents.executeJavaScript("document.fonts.ready.then(() => true)"), timeoutMs, "آماده‌سازی صفحهٔ چاپ بیش از حد طول کشید.");
    if (device.widthMm < 110) {
      // The panel owns the document layout, but a browser's default body
      // margin or a template's top spacing becomes wasted thermal paper.
      // Normalize only the print origin before handing the page to Windows.
      await withDeadline(() => win.webContents.executeJavaScript(`
        (() => {
          const style = document.createElement("style");
          style.textContent = "@page{margin:0!important}html,body{margin-top:0!important;padding-top:0!important}[data-miro-print-root],body>:first-child{margin-top:0!important;padding-top:0!important}";
          document.head.appendChild(style);
        })()
      `), timeoutMs, "آماده‌سازی چاپ ناموفق بود.");
    }
    const thermalCargo = profile.id === "cargo_thermal" && device.widthMm < 110;
    const pageHeightMm = thermalCargo
      ? await renderedThermalCargoHeightMm(win, profile, timeoutMs)
      : device.heightMm;
    const pageSize = { width: Math.round(device.widthMm * 1000), height: Math.round(pageHeightMm * 1000) };
    const margins = { marginType: "custom", top: profile.marginTop * 96 / 25.4, right: profile.marginRight * 96 / 25.4, bottom: profile.marginBottom * 96 / 25.4, left: profile.marginLeft * 96 / 25.4 };
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
      const timeout = setTimeout(() => finish(new Error("چاپگر تا ۳۰ ثانیه پاسخی نداد. اتصال، روشن‌بودن چاپگر و Windows Print Spooler را بررسی کنید.")), timeoutMs);
      try {
        win.webContents.print({
          silent: true, printBackground: true, deviceName,
          landscape: device.orientation === "landscape", copies: 1,
          scaleFactor: profile.scale, margins, pageSize
        }, (ok, failure) => finish(ok ? null : new Error(failure || "Windows Spooler چاپ را نپذیرفت.")));
      } catch (error) {
        finish(error);
      }
    });
  } finally { if (!win.isDestroyed()) win.destroy(); }
}
}
module.exports = { contentHeightMm, createHtmlPrinter };
