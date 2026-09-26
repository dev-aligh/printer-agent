"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mirocab", {
  getConfig: () => ipcRenderer.invoke("config:get"), saveConfig: (patch) => ipcRenderer.invoke("config:save", patch),
  printers: () => ipcRenderer.invoke("printers:list"), testPrint: (profileId) => ipcRenderer.invoke("agent:test-print", profileId),
  jobs: (printer) => ipcRenderer.invoke("printer:jobs", printer), controlJob: (printer, jobId, action) => ipcRenderer.invoke("printer:job-control", printer, jobId, action)
});
