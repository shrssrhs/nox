const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronNox", {
  /** Send a native OS notification even when window is hidden. */
  notify: (title, body) => ipcRenderer.send("nox-notify", { title, body }),
  isElectron: true,
});
