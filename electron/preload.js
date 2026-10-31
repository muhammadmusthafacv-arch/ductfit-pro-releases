const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    platform: process.platform,
    getVersion: () => ipcRenderer.invoke('app:version'),
    saveProjectFile: (options) => ipcRenderer.invoke('dialog:save-file', options),
    openProjectFile: () => ipcRenderer.invoke('dialog:open-file')
});
