const FtpUIHandler = require('../../ftp/FtpUIHandler');

// Mock DOM elements
const createButtonStates = () => ({
    '.normal-state': { style: { display: 'none' } },
    '.connecting-state': { style: { display: 'none' } },
    '.connected-state': { style: { display: 'none' } }
});

const mockElements = {
    connectBtn: { 
        querySelector: jest.fn().mockImplementation((selector) => {
            return mockElements.connectBtn._states[selector];
        }),
        classList: { 
            add: jest.fn(), 
            remove: jest.fn() 
        },
        disabled: false,
        _states: createButtonStates()
    },
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
    anonymousLogin: { checked: false },
    sortableHeader: { classList: { add: jest.fn(), remove: jest.fn() } }
};

// Mock document.getElementById and querySelector
document.getElementById = jest.fn((id) => mockElements[id]);
document.querySelector = jest.fn((selector) => {
    if (selector === '#connectBtn .normal-state') return { style: { display: 'none' } };
    if (selector === '#connectBtn .connecting-state') return { style: { display: 'none' } };
    if (selector === '.sortable') return mockElements.sortableHeader;
    return null;
});

describe('FtpUIHandler', () => {
    let uiHandler;
    let expectedElements;

    beforeEach(() => {
        uiHandler = new FtpUIHandler();
        // Create expected elements structure that matches the actual implementation
        expectedElements = {
            ...mockElements,
            connectBtnNormalState: { style: { display: 'none' } },
            connectBtnConnectingState: { style: { display: 'none' } }
        };
        // Reset mock functions
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        it('should initialize all UI elements', () => {
            uiHandler.initialize();
            expect(uiHandler.elements).toEqual(expectedElements);
        });

        it('should throw error if required elements are missing', () => {
            document.getElementById.mockImplementationOnce(() => null);
            expect(() => uiHandler.initialize()).toThrow('Required element');
        });
    });

    describe('setConnectingState', () => {
        beforeEach(() => {
            uiHandler.initialize();
            // Reset button states before each test
            mockElements.connectBtn._states = createButtonStates();
        });

        it('should set connecting state correctly', () => {
            uiHandler.setConnectingState(true);
            expect(uiHandler.elements.connectBtn.disabled).toBe(true);
            expect(mockElements.connectBtn._states['.connecting-state'].style.display)
                .toBe('inline-block');
            expect(mockElements.connectBtn._states['.normal-state'].style.display)
                .toBe('none');
            expect(mockElements.connectBtn._states['.connected-state'].style.display)
                .toBe('none');
        });

        it('should set normal state correctly when not connected', () => {
            uiHandler.isConnected = false;
            uiHandler.setConnectingState(false);
            expect(uiHandler.elements.connectBtn.disabled).toBe(false);
            expect(mockElements.connectBtn._states['.normal-state'].style.display)
                .toBe('inline-block');
            expect(mockElements.connectBtn._states['.connecting-state'].style.display)
                .toBe('none');
            expect(mockElements.connectBtn._states['.connected-state'].style.display)
                .toBe('none');
            expect(uiHandler.elements.connectBtn.classList.add)
                .toHaveBeenCalledWith('btn-primary');
        });

        it('should set connected state correctly when connected', () => {
            uiHandler.isConnected = true;
            uiHandler.setConnectingState(false);
            expect(uiHandler.elements.connectBtn.disabled).toBe(false);
            expect(mockElements.connectBtn._states['.connected-state'].style.display)
                .toBe('inline-block');
            expect(mockElements.connectBtn._states['.connecting-state'].style.display)
                .toBe('none');
            expect(mockElements.connectBtn._states['.normal-state'].style.display)
                .toBe('none');
            expect(uiHandler.elements.connectBtn.classList.add)
                .toHaveBeenCalledWith('btn-success');
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
