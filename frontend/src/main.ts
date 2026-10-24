import {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  systemPreferences,
} from 'electron';
import started from 'electron-squirrel-startup';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (started) {
  app.quit();
}

const WIDTH = 520;
const HEIGHT = 96;

const createBar = (): void => {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: Math.round(workArea.x + (workArea.width - WIDTH) / 2),
    y: workArea.y + 12,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setContentProtection(true); // hidden from screenshots, so the computer-use agent never sees or targets the bar
  win.webContents.on('console-message', (e) =>
    console.log('[renderer]', e.level, e.message),
  );
  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.show();
    win.focus();
  });
};

app.whenReady().then(() => {
  app.dock?.hide();
  systemPreferences.askForMediaAccess('microphone');
  createBar();
});

app.on('window-all-closed', () => app.quit());
