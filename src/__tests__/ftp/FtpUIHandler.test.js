const FtpUIHandler = require('../../ftp/FtpUIHandler');

// Mock DOM elements
const mockElements = {
    connectBtn: { 
        querySelector: jest.fn().mockImplementation((selector) => {
            const states = {
                '.normal-state': { style: { display: 'none' }, classList: { add: jest.fn(), remove: jest.fn() } },
                '.connecting-state': { style: { display: 'none' }, classList: { add: jest.fn(), remove: jest.fn() } },
                '.connected-state': { style: { display: 'none' }, classList: { add: jest.fn(), remove: jest.fn() } }
            };
            return states[selector];
        }),
        classList: { add: jest.fn(), remove: jest.fn() },
        disabled: false
    },
    connectBtnNormalState: { style: { display: 'none' } },
    connectBtnConnectingState: { style: { display: 'none' } },
    uploadBtn: { disabled: false },
    downloadBtn: { disabled: false },
    downloadProgress: { 
        classList: { add: jest.fn(), remove: jest.fn() },
        querySelector: jest.fn().mockReturnValue({
            style: { width: '0%' },
            textContent: ''
        })
    },
    ftpServer: { disabled: false },
    ftpHistory: { innerHTML: '' },
    username: { disabled: false },
    password: { disabled: false },
    fileList: { innerHTML: '' },
    selectAll: { checked: false },
    anonymousLogin: { checked: false }
};

// Mock document.getElementById and querySelector
document.getElementById = jest.fn((id) => mockElements[id]);
document.querySelector = jest.fn((selector) => mockElements[selector]);

describe('FtpUIHandler', () => {
    let uiHandler;

    beforeEach(() => {
        uiHandler = new FtpUIHandler();
        // Reset mock functions
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        it('should initialize all UI elements', () => {
            uiHandler.initialize();
            expect(uiHandler.elements).toEqual(mockElements);
        });

        it('should throw error if required elements are missing', () => {
            document.getElementById.mockImplementationOnce(() => null);
            expect(() => uiHandler.initialize()).toThrow('Required element');
        });
    });

    describe('setConnectingState', () => {
        beforeEach(() => {
            uiHandler.initialize();
        });

        it('should set connecting state correctly', () => {
            uiHandler.setConnectingState(true);
            expect(uiHandler.elements.connectBtn.disabled).toBe(true);
            expect(uiHandler.elements.connectBtn.querySelector('.connecting-state').style.display)
                .toBe('inline-block');
        });

        it('should set normal state correctly when not connected', () => {
            uiHandler.isConnected = false;
            uiHandler.setConnectingState(false);
            expect(uiHandler.elements.connectBtn.disabled).toBe(false);
            expect(uiHandler.elements.connectBtn.querySelector('.normal-state').style.display)
                .toBe('inline-block');
        });
    });

    describe('updateConnectionStatus', () => {
        beforeEach(() => {
            uiHandler.initialize();
        });

        it('should update UI for successful connection', () => {
            uiHandler.updateConnectionStatus(true);
            expect(uiHandler.elements.connectBtn.disabled).toBe(false);
        });

        it('should update UI for failed connection', () => {
            const errorMessage = 'Connection failed';
            uiHandler.updateConnectionStatus(false, errorMessage);
            expect(uiHandler.elements.connectBtn.disabled).toBe(false);
        });
    });

    describe('setInputFieldsState', () => {
        beforeEach(() => {
            uiHandler.initialize();
        });

        it('should disable input fields when connected', () => {
            uiHandler.setInputFieldsState(true);
            expect(uiHandler.elements.ftpServer.disabled).toBe(true);
            expect(uiHandler.elements.username.disabled).toBe(true);
            expect(uiHandler.elements.password.disabled).toBe(true);
        });

        it('should enable input fields when disconnected', () => {
            uiHandler.setInputFieldsState(false);
            expect(uiHandler.elements.ftpServer.disabled).toBe(false);
            expect(uiHandler.elements.username.disabled).toBe(false);
            expect(uiHandler.elements.password.disabled).toBe(false);
        });
    });

    describe('updateProgressBar', () => {
        beforeEach(() => {
            uiHandler.initialize();
        });

        it('should update progress bar percentage correctly', () => {
            const percentage = 45.5;
            uiHandler.updateProgressBar(percentage);
            const progressBar = uiHandler.elements.downloadProgress.querySelector('.progress-bar');
            expect(progressBar.style.width).toBe('45.5%');
            expect(progressBar.textContent).toBe('45.5%');
        });

        it('should handle invalid percentage values', () => {
            uiHandler.updateProgressBar(150);
            const progressBar = uiHandler.elements.downloadProgress.querySelector('.progress-bar');
            expect(progressBar.style.width).toBe('100%');
            expect(progressBar.textContent).toBe('100%');
        });
    });

    describe('updateDownloadButton', () => {
        beforeEach(() => {
            uiHandler.initialize();
        });

        it('should enable download button when files are selected', () => {
            uiHandler.updateDownloadButton(true);
            expect(uiHandler.elements.downloadBtn.disabled).toBe(false);
        });

        it('should disable download button when no files are selected', () => {
            uiHandler.updateDownloadButton(false);
            expect(uiHandler.elements.downloadBtn.disabled).toBe(true);
        });
    });
});
