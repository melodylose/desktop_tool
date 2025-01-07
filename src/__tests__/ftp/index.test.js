// Mock dependencies first
jest.mock('../../ftp/FtpClient');
jest.mock('../../ftp/FtpUIHandler');
jest.mock('../../ftp/FtpFileOperations');
jest.mock('../../ftp/FtpHistoryManager');
jest.mock('../../ftp/FtpFileListHandler');

jest.mock('electron', () => ({
    ipcRenderer: {
        send: jest.fn(),
        invoke: jest.fn(),
        on: jest.fn()
    }
}));

const { ipcRenderer } = require('electron');
const FtpHandler = require('../../ftp/index');

describe('FtpHandler', () => {
    let ftpHandler;
    let mockFtpClient;
    let mockUiHandler;
    let mockFileOperations;
    let mockHistoryManager;
    let mockFileListHandler;
    let mockElements;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Mock elements
        mockElements = {
            connectBtn: {
                addEventListener: jest.fn()
            },
            uploadBtn: {
                addEventListener: jest.fn()
            },
            downloadBtn: {
                addEventListener: jest.fn()
            },
            sortableHeader: {
                addEventListener: jest.fn()
            },
            selectAll: {
                addEventListener: jest.fn()
            },
            anonymousLogin: {
                addEventListener: jest.fn()
            },
            username: {
                value: '',
                disabled: false
            },
            password: {
                value: '',
                disabled: false
            }
        };

        // Mock dependencies
        mockFtpClient = require('../../ftp/FtpClient').mock.instances[0];
        mockUiHandler = require('../../ftp/FtpUIHandler').mock.instances[0];
        mockFileOperations = require('../../ftp/FtpFileOperations').mock.instances[0];
        mockHistoryManager = require('../../ftp/FtpHistoryManager').mock.instances[0];
        mockFileListHandler = require('../../ftp/FtpFileListHandler').mock.instances[0];

        // Setup mock methods
        mockUiHandler.getElements.mockReturnValue(mockElements);
        mockFtpClient.isConnectedToServer.mockReturnValue(false);

        ftpHandler = new FtpHandler();
    });

    describe('initialize', () => {
        it('should initialize all components', () => {
            ftpHandler.initialize();

            expect(mockUiHandler.initialize).toHaveBeenCalled();
            expect(mockHistoryManager.loadFtpHistory).toHaveBeenCalled();
            expect(mockElements.connectBtn.addEventListener).toHaveBeenCalled();
            expect(mockElements.uploadBtn.addEventListener).toHaveBeenCalled();
            expect(mockElements.downloadBtn.addEventListener).toHaveBeenCalled();
        });
    });

    describe('connectToFTP', () => {
        beforeEach(() => {
            mockElements.ftpServer = { value: 'test.com' };
            mockElements.username = { value: 'user' };
            mockElements.password = { value: 'pass' };
        });

        it('should handle successful connection', async () => {
            mockFtpClient.connectToFTP.mockResolvedValue(true);
            mockFtpClient.getCurrentFiles.mockReturnValue([]);

            await ftpHandler.connectToFTP();

            expect(mockUiHandler.setConnectingState).toHaveBeenCalledWith(true);
            expect(mockFtpClient.connectToFTP).toHaveBeenCalledWith(
                'test.com',
                'user',
                'pass'
            );
            expect(mockHistoryManager.addToFtpHistory).toHaveBeenCalledWith('test.com');
            expect(mockFileListHandler.displayFileList).toHaveBeenCalled();
            expect(mockUiHandler.updateConnectionStatus).toHaveBeenCalledWith(true);
        });

        it('should handle connection failure', async () => {
            const error = new Error('Connection failed');
            mockFtpClient.connectToFTP.mockRejectedValue(error);

            await ftpHandler.connectToFTP();

            expect(mockUiHandler.updateConnectionStatus).toHaveBeenCalledWith(false, error.message);
            expect(mockUiHandler.setInputFieldsState).toHaveBeenCalledWith(false);
        });
    });

    describe('disconnectFromFTP', () => {
        it('should handle successful disconnection', async () => {
            await ftpHandler.disconnectFromFTP();

            expect(mockFtpClient.disconnectFromFTP).toHaveBeenCalled();
            expect(mockUiHandler.updateConnectionStatus).toHaveBeenCalledWith(false);
            expect(mockFileListHandler.displayFileList).toHaveBeenCalledWith([]);
            expect(mockUiHandler.setInputFieldsState).toHaveBeenCalledWith(false);
        });

        it('should handle disconnection failure', async () => {
            const error = new Error('Disconnection failed');
            mockFtpClient.disconnectFromFTP.mockRejectedValue(error);

            await ftpHandler.disconnectFromFTP();

            expect(console.error).toHaveBeenCalledWith('Disconnection failed:', error);
        });
    });

    describe('bindEvents', () => {
        beforeEach(() => {
            ftpHandler.initialize();
        });

        it('should handle connect button click', () => {
            const connectCallback = mockElements.connectBtn.addEventListener.mock.calls[0][1];
            
            connectCallback();
            expect(mockFtpClient.isConnectedToServer).toHaveBeenCalled();
        });

        it('should handle upload button click', () => {
            const uploadCallback = mockElements.uploadBtn.addEventListener.mock.calls[0][1];
            const mockEvent = { preventDefault: jest.fn() };
            
            uploadCallback(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockFileOperations.initiateUpload).toHaveBeenCalled();
        });

        it('should handle download button click', () => {
            const downloadCallback = mockElements.downloadBtn.addEventListener.mock.calls[0][1];
            const mockEvent = { preventDefault: jest.fn() };
            const mockSelectedFiles = new Set(['file1.txt']);
            mockFileListHandler.getSelectedFiles.mockReturnValue(mockSelectedFiles);
            
            downloadCallback(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockFileOperations.initiateDownload).toHaveBeenCalledWith(mockSelectedFiles);
        });

        it('should handle anonymous login toggle', () => {
            const anonymousCallback = mockElements.anonymousLogin.addEventListener.mock.calls[0][1];
            const mockEvent = { target: { checked: true } };
            
            anonymousCallback(mockEvent);
            expect(mockElements.username.disabled).toBe(true);
            expect(mockElements.password.disabled).toBe(true);
            expect(mockElements.username.value).toBe('anonymous');
            expect(mockElements.password.value).toBe('anonymous@example.com');
        });
    });

    describe('cleanup', () => {
        it('should cleanup FTP client', () => {
            ftpHandler.cleanup();
            expect(mockFtpClient.cleanup).toHaveBeenCalled();
        });
    });
});
