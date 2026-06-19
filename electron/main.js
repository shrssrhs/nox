const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } = require("electron");
const path = require("path");

const DEV_URL  = "http://localhost:3000";
const PROD_DIR = path.join(__dirname, "../out/index.html");
const isDev    = !app.isPackaged;

let win  = null;
let tray = null;

// ─── Window ──────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  800,
    minHeight: 600,
    title: "Nox",
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration:  false,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,
  });

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(PROD_DIR);
  }

  win.once("ready-to-show", () => win.show());

  // Minimize to tray instead of closing
  win.on("close", (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
      if (process.platform === "darwin") app.dock.hide();
    }
  });
}

// ─── Tray ────────────────────────────────────────────────────────────────────
function createTray() {
  // 16×16 monochrome "N" icon rendered as a NativeImage
  const icon = nativeImage.createFromDataURL(makeTrayIcon());
  icon.setTemplateImage(true); // macOS: adapts to light/dark menu bar

  tray = new Tray(icon);
  tray.setToolTip("Nox");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Nox",   click: showWindow },
      { type: "separator"   },
      { label: "Quit",       click: () => { app.isQuiting = true; app.quit(); } },
    ])
  );
  tray.on("click", showWindow);
}

function showWindow() {
  if (!win) return;
  if (process.platform === "darwin") app.dock.show();
  win.show();
  win.focus();
}

// ─── IPC: native notifications from renderer ──────────────────────────────────
ipcMain.on("nox-notify", (_e, { title, body }) => {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, silent: false }).show();
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on("window-all-closed", () => {
  // Keep running in tray on all platforms (don't quit)
});

app.on("before-quit", () => {
  app.isQuiting = true;
});

// ─── Inline tray icon (16×16 SVG → base64 PNG fallback) ──────────────────────
function makeTrayIcon() {
  // 1-bit "N" glyph as a tiny PNG data-URL
  // Generated from a 16×16 canvas — works as template image on macOS
  return (
    "data:image/png;base64," +
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwY" +
    "AAAAB3RJTUUH6AYUCgwfj1tG9QAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJ" +
    "TVBkLmUHAAAAeElEQVQ4y2NgGAWMDAz/GagMGBkY/lMqnpGBgYGJHPEMDAxMlKhnYGBgYiRH" +
    "PA0DA8N/oHqG////Q9WTCxgZGBgYqWEAIxWMGBkYGBip4YARAKABMBIAAjCGAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAJvWBIkAAAAASUVORK5CYII="
  );
}
