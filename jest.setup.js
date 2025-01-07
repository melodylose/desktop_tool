// Mock Electron's ipcRenderer
const { ipcRenderer } = require('electron-mock-ipc');
global.ipcRenderer = ipcRenderer;

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn()
};
global.localStorage = localStorageMock;

// Mock dialog
global.dialog = {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
};
