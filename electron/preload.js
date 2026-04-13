/**
 * Electron Preload Script
 * 렌더러 프로세스와 메인 프로세스 사이의 안전한 브리지
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  platform: process.platform,
  isElectron: true,
});
