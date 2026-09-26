"use strict";
const fs = require("fs");
const path = require("path");
const { randomBytes } = require("crypto");

const defaults = () => ({
  enabled: true,
  pairingToken: randomBytes(32).toString("base64url"),
  printers: {},
  profileSettings: {},
  port: 18443
});

function createConfigStore(userDataPath) {
  const file = path.join(userDataPath, "print-agent.json");
  let data = defaults();
  try { data = { ...data, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch (_) {}
  const save = () => fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  // Electron 22 embeds Node 16, which does not provide structuredClone.
  const snapshot = () => JSON.parse(JSON.stringify(data));
  return { get: snapshot, update: (patch) => { data = { ...data, ...patch }; save(); return snapshot(); }, save };
}
module.exports = { createConfigStore };
