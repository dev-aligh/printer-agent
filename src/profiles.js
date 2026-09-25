"use strict";

const DOCUMENT_PROFILES = Object.freeze({
  statement_a5: { title: "صورت‌وضعیت A5", paper: "A5", orientation: "portrait", fixedOrientation: true, transport: "spooler" },
  cargo_a5: { title: "بارنامه A5", paper: "A5", orientation: "landscape", fixedOrientation: true, transport: "spooler" },
  passenger_ticket: { title: "بلیت مسافر", paper: "thermal-80", orientation: "portrait", allowedPapers: ["A5", "thermal-58", "thermal-80"], transport: "auto" },
  cargo_thermal: { title: "بارنامه حرارتی", paper: "thermal-80", orientation: "portrait", jobsPerCopy: 2, cutAfterEachCopy: true, transport: "raw-or-spooler" },
  driver_performance: { title: "گزارش عملکرد راننده", paper: "thermal-80", orientation: "portrait", allowedPapers: ["A5", "thermal-58", "thermal-80"], cutAtEnd: true, transport: "raw-or-spooler" }
});

function resolveProfile(profileId, requested = {}) {
  const profile = DOCUMENT_PROFILES[profileId];
  if (!profile) throw new Error("پروفایل سند معتبر نیست.");
  const paper = profile.allowedPapers?.includes(requested.paper) ? requested.paper : profile.paper;
  return {
    ...profile,
    id: profileId,
    paper,
    orientation: profile.fixedOrientation ? profile.orientation : (requested.orientation || profile.orientation),
    copies: Math.max(1, Math.min(20, Number(requested.copies || 1)))
  };
}

module.exports = { DOCUMENT_PROFILES, resolveProfile };
