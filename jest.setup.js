// Mock Electron's ipcRenderer
const { ipcRenderer } = require('electron-mock-ipc');
global.ipcRenderer = ipcRenderer;
