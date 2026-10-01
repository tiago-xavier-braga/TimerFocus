const { app, BrowserWindow, ipcMain, nativeTheme, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const isDev = process.argv.includes("--dev");

const dataFile = (name) => path.join(app.getPath("userData"), name);

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(dataFile(name), "utf8"));
  } catch {
    return fallback;
  }
}

// Write to a temp file and rename, so a crash mid-write never leaves a corrupt file.
function writeJson(name, value) {
  const file = dataFile(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
  fs.renameSync(`${file}.tmp`, file);
}

// Saved bounds are only reused if they still overlap a connected display.
function isOnScreen(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y);
}

function createWindow() {
  const saved = readJson("window.json", null);
  const bounds = saved && isOnScreen(saved) ? saved : { width: 340, height: 600 };

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 280,
    minHeight: 380,
    title: "Timer Focus",
    icon: path.join(__dirname, "../build/icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#121317" : "#f6f5f2",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.removeMenu();
  win.once("ready-to-show", () => win.show());
  win.on("close", () => writeJson("window.json", win.getNormalBounds()));

  if (isDev) win.loadURL("http://localhost:1420");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}

ipcMain.handle("state:load", () => readJson("state.json", {}));
ipcMain.handle("state:save", (_e, state) => writeJson("state.json", state));
ipcMain.on("state:save-sync", (e, state) => {
  writeJson("state.json", state);
  e.returnValue = true;
});
ipcMain.on("window:always-on-top", (e, on) => BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(on));
ipcMain.on("theme:set", (_e, theme) => {
  nativeTheme.themeSource = theme ?? "system";
});

// A second instance would overwrite the same state file; focus the first one instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(createWindow);
  app.on("window-all-closed", () => app.quit());
}
