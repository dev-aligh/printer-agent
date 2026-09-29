"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mirocab", {
  saveProfile: (id, setting) => ipcRenderer.invoke("profile:save", id, setting),
  resetPrinter: (printer) => ipcRenderer.invoke("printer:reset", printer),
  printerPreferences: (printer) => ipcRenderer.invoke("printer:preferences", printer),
  getConfig: () => ipcRenderer.invoke("config:get"), saveConfig: (patch) => ipcRenderer.invoke("config:save", patch),
  printers: () => ipcRenderer.invoke("printers:list"), testPrint: (profileId) => ipcRenderer.invoke("agent:test-print", profileId),
  jobs: (printer) => ipcRenderer.invoke("printer:jobs", printer), controlJob: (printer, jobId, action) => ipcRenderer.invoke("printer:job-control", printer, jobId, action)
});
