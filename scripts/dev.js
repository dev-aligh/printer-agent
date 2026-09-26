"use strict";
const { spawn } = require("child_process");
const path = require("path");

// Some development tools set this variable for their own Electron runtime.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require("electron"), ["."], {
  cwd: path.join(__dirname, ".."),
  env,
  stdio: "inherit"
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code === null ? 1 : code; });
