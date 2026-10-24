import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bar', {
  resize: (width: number, height: number) =>
    ipcRenderer.send('resize', width, height),
  blur: () => ipcRenderer.send('blur'),
  phase: (phase: string) => ipcRenderer.send('phase', phase),
  onPhase: (cb: (phase: string) => void) =>
    ipcRenderer.on('phase', (_e, phase: string) => cb(phase)),
});
