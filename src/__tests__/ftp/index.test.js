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
                addEventListener: jest.fn(),
                querySelector: jest.fn().mockReturnValue({ style: {} })
            },
            uploadBtn: {
                addEventListener: jest.fn()
            },
            downloadBtn: {
                addEventListener: jest.fn()
            },
            refreshBtn: {
                addEventListener: jest.fn()
            },
            sortableHeader: {
                addEventListener: jest.fn()
            },
            selectAll: {
                addEventListener: jest.fn()
            },
            anonymousLogin: {
                addEventListener: jest.fn(),
                checked: false
            },
            ftpServer: { value: 'ftp://test.com' },
            username: { value: 'user' },
            password: { value: 'pass' }
        };

        // Setup mock implementations
        const FtpClient = require('../../ftp/FtpClient');
        const FtpUIHandler = require('../../ftp/FtpUIHandler');
        const FtpFileOperations = require('../../ftp/FtpFileOperations');
        const FtpHistoryManager = require('../../ftp/FtpHistoryManager');
        const FtpFileListHandler = require('../../ftp/FtpFileListHandler');

        // Reset mock implementations
        FtpClient.mockReset();
        FtpUIHandler.mockReset();
        FtpFileOperations.mockReset();
        FtpHistoryManager.mockReset();
        FtpFileListHandler.mockReset();

        // Setup mock objects
        mockFtpClient = {
            connectToFTP: jest.fn(),
            disconnectFromFTP: jest.fn(),
            isConnectedToServer: jest.fn(),
            getCurrentFiles: jest.fn(),
            cleanup: jest.fn()
        };

        mockUiHandler = {
            initialize: jest.fn(),
            getElements: jest.fn().mockReturnValue(mockElements),
            setConnectingState: jest.fn(),
            updateConnectionStatus: jest.fn(),
            setInputFieldsState: jest.fn(),
            setFileListHandler: jest.fn(),
            updateProgressBar: jest.fn()
        };

        mockFileOperations = {
            initialize: jest.fn(),
            uploadFiles: jest.fn(),
            downloadFiles: jest.fn(),
            initiateUpload: jest.fn(),
            initiateDownload: jest.fn()
        };

        mockHistoryManager = {
            initialize: jest.fn(),
            loadFtpHistory: jest.fn(),
            addToFtpHistory: jest.fn()
        };

        mockFileListHandler = {
            initialize: jest.fn(),
            displayFileList: jest.fn(),
            setupSortableColumns: jest.fn(),
            getSelectedFiles: jest.fn()
        };

        // Set mock implementations
        FtpClient.mockImplementation(() => mockFtpClient);
        FtpUIHandler.mockImplementation(() => mockUiHandler);
        FtpFileOperations.mockImplementation(() => mockFileOperations);
        FtpHistoryManager.mockImplementation(() => mockHistoryManager);
        FtpFileListHandler.mockImplementation(() => mockFileListHandler);

        jest.spyOn(console, 'error').mockImplementation(() => {});

        // Create instance after all mocks are setup
        ftpHandler = new FtpHandler();
    });

    describe('initialize', () => {
        it('should initialize all components', () => {
            ftpHandler.initialize();

            expect(mockUiHandler.initialize).toHaveBeenCalled();
            expect(mockHistoryManager.loadFtpHistory).toHaveBeenCalled();
            expect(mockElements.connectBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockElements.uploadBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockElements.downloadBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });
    });

    describe('connectToFTP', () => {
        it('should handle successful connection', async () => {
            mockFtpClient.connectToFTP.mockResolvedValue(true);
            mockFtpClient.getCurrentFiles.mockResolvedValue([]);

            await ftpHandler.connectToFTP();

            expect(mockUiHandler.setConnectingState).toHaveBeenCalledWith(true);
            expect(mockFtpClient.connectToFTP).toHaveBeenCalledWith(
                'ftp://test.com',
                'user',
                'pass'
            );
            expect(mockHistoryManager.addToFtpHistory).toHaveBeenCalledWith('ftp://test.com');
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
            mockFtpClient.disconnectFromFTP.mockResolvedValue();

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

        it('should handle connect button click', async () => {
            const connectCallback = mockElements.connectBtn.addEventListener.mock.calls[0][1];
            
            await connectCallback();
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
        });
    });

    describe('cleanup', () => {
        it('should cleanup FTP client', () => {
            ftpHandler.cleanup();
            expect(mockFtpClient.cleanup).toHaveBeenCalled();
        });
    });
});
