"use strict";

const FLEXIBLE_PAPERS = ["A5", "thermal-58", "thermal-80", "custom-roll"];
const DOCUMENT_PROFILES = Object.freeze({
  statement_a5: { title: "صورت‌وضعیت", paper: "A5", orientation: "portrait", fixedPaper: true, fixedOrientation: true, transport: "spooler" },
  cargo_a5: { title: "بارنامه A5", paper: "A5", orientation: "landscape", fixedPaper: true, fixedOrientation: true, transport: "spooler" },
  passenger_ticket: { title: "بلیت مسافر", paper: "thermal-80", orientation: "portrait", allowedPapers: FLEXIBLE_PAPERS, transport: "auto" },
  cargo_thermal: { title: "بارنامه", paper: "thermal-80", orientation: "portrait", allowedPapers: FLEXIBLE_PAPERS, transport: "spooler" },
  driver_performance: { title: "گزارش عملکرد راننده", paper: "thermal-80", orientation: "portrait", allowedPapers: FLEXIBLE_PAPERS, cutAtEnd: true, transport: "raw-or-spooler" }
});

function numberInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function resolveCutMode(profile, requested) {
  if (profile.cutAfterEachCopy) return "after-each-copy";
  if (profile.cutAtEnd) return "at-end";
  return ["none", "at-end", "after-each-copy"].includes(requested.cutMode) ? requested.cutMode : "none";
}

function resolveProfile(profileId, requested = {}) {
  const profile = DOCUMENT_PROFILES[profileId];
  if (!profile) throw new Error("پروفایل سند معتبر نیست.");
  const paper = profile.fixedPaper ? profile.paper : (profile.allowedPapers?.includes(requested.paper) ? requested.paper : profile.paper);
  const cutMode = resolveCutMode(profile, requested);
  return {
    ...profile,
    id: profileId,
    paper,
    orientation: profile.fixedOrientation ? profile.orientation : (requested.orientation === "landscape" ? "landscape" : "portrait"),
    copies: numberInRange(requested.copies, 1, 1, 20),
    scale: numberInRange(requested.scale, 100, 25, 200),
    marginTop: numberInRange(requested.marginTop, 0, 0, 30),
    marginRight: numberInRange(requested.marginRight, 0, 0, 30),
    marginBottom: numberInRange(requested.marginBottom, 0, 0, 30),
    marginLeft: numberInRange(requested.marginLeft, 0, 0, 30),
    rollWidthMm: numberInRange(requested.rollWidthMm, paper === "thermal-58" ? 58 : 80, 30, 220),
    rollHeightMm: numberInRange(requested.rollHeightMm, 130, 20, 1000),
    cutMode,
    cutAfterEachCopy: cutMode === "after-each-copy",
    cutAtEnd: cutMode === "at-end"
  };
}

module.exports = { DOCUMENT_PROFILES, resolveProfile };
