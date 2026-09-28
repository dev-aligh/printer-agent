"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createApi } = require("../src/http-api");

function request(server, path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1", port: server.address().port, path, method,
      headers: { "Content-Type": "application/json", "X-Mirocab-Pairing-Token": "test-token", ...headers }
    }, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody ? JSON.parse(responseBody) : null }));
    });
    req.once("error", reject);
    if (body) req.end(JSON.stringify(body)); else req.end();
  });
}

test("thermal cargo waits for its first print to leave the spooler before sending the second", async () => {
  const config = { get: () => ({ enabled: true, pairingToken: "test-token", profileSettings: { cargo_thermal: { printer: "Miro Thermal" } } }) };
  const printed = [];
  const idleWaits = [];
  const server = createApi({
    config,
    getPrinters: async () => [{ name: "Miro Thermal" }],
    printHtml: async (html, printer, profile) => { printed.push({ html, printer, profile }); },
    resourcesPath: "",
    waitForIdle: async (printer) => { idleWaits.push(printer); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const accepted = await request(server, "/v1/print", "POST", { documentType: "cargo_thermal", html: "<p>cargo sample</p>" });
    assert.equal(accepted.status, 202);
    assert.match(accepted.body.job.id, /^[a-f0-9]{32}$/);
    assert.ok(["queued", "printing"].includes(accepted.body.job.status));

    await new Promise((resolve) => setTimeout(resolve, 20));
    const completed = await request(server, `/v1/print-jobs/${accepted.body.job.id}`, "GET");
    assert.equal(completed.status, 200);
    assert.equal(completed.body.status, "completed");
    assert.deepEqual(printed.map((item) => item.html), ["<p>cargo sample</p>", "<p>cargo sample</p>"]);
    assert.equal(printed[0].printer, "Miro Thermal");
    assert.deepEqual(idleWaits, ["Miro Thermal"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("staging panel origin receives CORS and Private Network Access approval", async () => {
  const config = { get: () => ({ enabled: true, pairingToken: "test-token", profileSettings: {} }) };
  const server = createApi({ config, getPrinters: async () => [], printHtml: async () => {}, resourcesPath: "" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await request(server, "/v1/print", "OPTIONS", null, {
      Origin: "https://company.aro.stg.agidp.ir",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Private-Network": "true"
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers["access-control-allow-origin"], "https://company.aro.stg.agidp.ir");
    assert.equal(response.headers["access-control-allow-private-network"], "true");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unknown browser origins are rejected before reaching the local print API", async () => {
  const config = { get: () => ({ enabled: true, pairingToken: "test-token", profileSettings: {} }) };
  const server = createApi({ config, getPrinters: async () => [], printHtml: async () => {}, resourcesPath: "" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await request(server, "/v1/status", "GET", null, { Origin: "https://untrusted.example" });
    assert.equal(response.status, 403);
    assert.equal(response.body.error, "origin_not_allowed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
