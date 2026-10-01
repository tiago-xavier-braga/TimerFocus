const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("timerFocus", {
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (state) => ipcRenderer.invoke("state:save", state),
  saveStateSync: (state) => ipcRenderer.sendSync("state:save-sync", state),
  setAlwaysOnTop: (on) => ipcRenderer.send("window:always-on-top", on),
  setTheme: (theme) => ipcRenderer.send("theme:set", theme),
});
