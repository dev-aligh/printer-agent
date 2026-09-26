"use strict";
const http = require("http");
const { URL } = require("url");
const { resolveProfile, DOCUMENT_PROFILES } = require("./profiles");
const { withCut } = require("./escpos");
const { printRaw, getJobs, controlJob } = require("./raw-spooler");

const PANEL_ORIGIN = "https://company.mirocab.ir";
function isAllowedOrigin(origin) { return origin === PANEL_ORIGIN; }
function json(res, status, value) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(value)); }

function createApi({ config, getPrinters, printHtml, resourcesPath }) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) return json(res, 403, { error: "origin_not_allowed" });
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Mirocab-Pairing-Token");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    // Chrome may preflight a public HTTPS page's connection to loopback as a
    // Private Network Access request. Only the already trusted panel origin
    // reaches this point, so explicitly grant that preflight.
    if (req.headers["access-control-request-private-network"] === "true")
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") return res.end();
    if (req.socket.remoteAddress !== "127.0.0.1" && req.socket.remoteAddress !== "::1" && req.socket.remoteAddress !== "::ffff:127.0.0.1") return json(res, 403, { error: "localhost_only" });
    if (req.headers["x-mirocab-pairing-token"] !== config.get().pairingToken) return json(res, 401, { error: "pairing_required" });
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/v1/status") return json(res, 200, { enabled: config.get().enabled, profiles: DOCUMENT_PROFILES, profileSettings: config.get().profileSettings });
    if (req.method === "GET" && url.pathname === "/v1/printers") return json(res, 200, { printers: await getPrinters() });
    const jobMatch = url.pathname.match(/^\/v1\/printers\/(.+)\/jobs$/);
    if (req.method === "GET" && jobMatch) return json(res, 200, { jobs: await getJobs(decodeURIComponent(jobMatch[1]), resourcesPath) });
    const controlMatch = url.pathname.match(/^\/v1\/printers\/(.+)\/jobs\/(\d+)\/(pause|resume|cancel)$/);
    if (req.method === "POST" && controlMatch) { await controlJob(decodeURIComponent(controlMatch[1]), Number(controlMatch[2]), controlMatch[3], resourcesPath); return json(res, 200, { ok: true }); }
    if (req.method !== "POST" || url.pathname !== "/v1/print") return json(res, 404, { error: "not_found" });
    let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 8 * 1024 * 1024) return json(res, 413, { error: "payload_too_large" }); }
    try {
      if (!config.get().enabled) throw new Error("Agent غیرفعال است.");
      const job = JSON.parse(body); const profileId = job.documentType || job.profile; const saved = config.get().profileSettings[profileId] || {};
      // The panel supplies document content only.  Printer selection and every
      // print preference belong to this machine's saved Mirocab profile.
      // In particular, do not let a request choose an arbitrary local printer.
      if (typeof saved.printer !== "string" || saved.printer.length === 0)
        throw new Error("برای این نوع سند، پرینتر میروکب در Agent تنظیم نشده است.");
      const profile = resolveProfile(profileId, saved);
      const printer = (await getPrinters()).find((item) => item.name === saved.printer);
      if (!printer) throw new Error("پرینتر انتخاب‌شده یافت نشد.");
      if (job.rawEscPosBase64 && job.rawMode === true) {
        let bytes = Buffer.from(job.rawEscPosBase64, "base64");
        if (profile.cutAfterEachCopy || profile.cutAtEnd) bytes = withCut(bytes);
        await printRaw(printer.name, bytes, resourcesPath);
      } else {
        if (typeof job.html !== "string" || job.html.length === 0) throw new Error("HTML چاپ ارسال نشده است.");
        const jobs = profile.jobsPerCopy || 1;
        for (let copy = 0; copy < profile.copies; copy++) for (let i = 0; i < jobs; i++) await printHtml(job.html, printer.name, profile);
      }
      return json(res, 202, { accepted: true, profile });
    } catch (error) { return json(res, 400, { error: "print_failed", message: error.message }); }
  });
}
module.exports = { createApi };
