import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bar', {
  resize: (width: number, height: number, animate = true) =>
    ipcRenderer.send('resize', width, height, animate),
  blur: () => ipcRenderer.send('blur'),
  phase: (phase: string) => ipcRenderer.send('phase', phase),
  onPhase: (cb: (phase: string) => void) =>
    ipcRenderer.on('phase', (_e, phase: string) => cb(phase)),
});
