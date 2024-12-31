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

// Mock document methods
document.createElement = jest.fn((tag) => {
    const element = {
        style: {},
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
        },
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        appendChild: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(),
        getAttribute: jest.fn(),
        setAttribute: jest.fn(),
        dataset: {},
        innerHTML: '',
        value: '',
        checked: false,
        textContent: ''
    };
    return element;
});

// Mock dialog
global.dialog = {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
};
