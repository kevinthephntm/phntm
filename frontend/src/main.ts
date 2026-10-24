import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import started from 'electron-squirrel-startup';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const GLOW_WINDOW_WEBPACK_ENTRY: string;
declare const GLOW_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (started) {
  app.quit();
}

const MARGIN = 14; // gap above the Dock / screen bottom

// full-screen, click-through light around the screen edges; the island tells it the current phase
const createGlow = (): BrowserWindow => {
  const { bounds } = screen.getPrimaryDisplay();
  const glow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: GLOW_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: false,
    },
  });
  glow.setIgnoreMouseEvents(true);
  glow.setAlwaysOnTop(true, 'screen-saver', 0);
  glow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  glow.loadURL(GLOW_WINDOW_WEBPACK_ENTRY);
  return glow;
};

const createIsland = (glow: BrowserWindow): void => {
  const win = new BrowserWindow({
    width: 160,
    height: 44,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: false,
    },
  });
  // bottom-centre, growing upwards; the renderer reports its content size
  const place = (width: number, height: number, animate: boolean) => {
    const { workArea } = screen.getPrimaryDisplay();
    win.setBounds(
      {
        x: Math.round(workArea.x + (workArea.width - width) / 2),
        y: workArea.y + workArea.height - height - MARGIN,
        width,
        height,
      },
      animate,
    );
  };
  place(160, 44, false);
  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.webContents.on('console-message', (e) =>
    console.log('[renderer]', e.level, e.message),
  );
  ipcMain.on('resize', (_e, w: number, h: number) =>
    place(Math.ceil(w), Math.ceil(h), true),
  );
  ipcMain.on('blur', () => win.blur());
  ipcMain.on('phase', (_e, phase: string) =>
    glow.webContents.send('phase', phase),
  );
  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.show();
    win.focus();
  });
};

app.whenReady().then(() => {
  app.dock?.hide();
  createIsland(createGlow());
});

app.on('window-all-closed', () => app.quit());
