import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) {
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel);
  },
  send(channel: string, ...args: any[]) {
    ipcRenderer.send(channel, ...args);
  },
  invoke(channel: string, ...args: any[]) {
    return ipcRenderer.invoke(channel, ...args);
  },
})
