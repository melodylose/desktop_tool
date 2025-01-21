'use strict';

// Mock Electron
const electron = {
    ipcRenderer: {
        send: jest.fn(),
        on: jest.fn(),
        invoke: jest.fn(),
        removeListener: jest.fn()
    },
    clipboard: {
        writeText: jest.fn()
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn()
    }
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

// Mock UIStateManager
class UIStateManager {
    constructor() {
        this.showNotification = jest.fn();
        this.showDialog = jest.fn();
        this.showEditDialog = jest.fn();
        this.showTTLDialog = jest.fn();
        this.showAddKeyDialog = jest.fn();
    }
}

// 設置全局變數
global.electron = electron;
global.localStorage = localStorageMock;
global.UIStateManager = UIStateManager;

// 在每個測試後清理 mock
afterEach(() => {
    jest.clearAllMocks();
});
