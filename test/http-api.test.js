"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createApi } = require("../src/http-api");

function request(server, path, method, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1", port: server.address().port, path, method,
      headers: { "Content-Type": "application/json", "X-Mirocab-Pairing-Token": "test-token" }
    }, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(responseBody) }));
    });
    req.once("error", reject);
    if (body) req.end(JSON.stringify(body)); else req.end();
  });
}

test("print requests return a trackable job that completes after spooler submission", async () => {
  const config = { get: () => ({ enabled: true, pairingToken: "test-token", profileSettings: { cargo_a5: { printer: "Miro A5" } } }) };
  const server = createApi({
    config,
    getPrinters: async () => [{ name: "Miro A5" }],
    printHtml: async () => new Promise((resolve) => setTimeout(resolve, 20)),
    resourcesPath: ""
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const accepted = await request(server, "/v1/print", "POST", { documentType: "cargo_a5", html: "<p>test</p>" });
    assert.equal(accepted.status, 202);
    assert.match(accepted.body.job.id, /^[a-f0-9]{32}$/);
    assert.ok(["queued", "printing"].includes(accepted.body.job.status));

    await new Promise((resolve) => setTimeout(resolve, 40));
    const completed = await request(server, `/v1/print-jobs/${accepted.body.job.id}`, "GET");
    assert.equal(completed.status, 200);
    assert.equal(completed.body.status, "completed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
