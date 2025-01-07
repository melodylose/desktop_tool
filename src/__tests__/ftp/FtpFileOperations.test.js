// Mock electron before requiring it
jest.mock('electron', () => ({
    ipcRenderer: {
        send: jest.fn(),
        invoke: jest.fn(),
        on: jest.fn()
    }
}));

const { ipcRenderer } = require('electron');
const FtpFileOperations = require('../../ftp/FtpFileOperations');

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn()
}));

describe('FtpFileOperations', () => {
    let fileOperations;
    let mockFtpClient;
    let mockUiHandler;
    let mockBasicFtpClient;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Mock FTP client
        mockBasicFtpClient = {
            uploadFrom: jest.fn(),
            downloadTo: jest.fn(),
            trackProgress: jest.fn(),
        };

        mockFtpClient = {
            isConnectedToServer: jest.fn(),
            getCurrentFiles: jest.fn(),
            listDirectory: jest.fn(),
            getClient: jest.fn().mockReturnValue(mockBasicFtpClient)
        };

        // Mock UI handler
        mockUiHandler = {
            getElements: jest.fn().mockReturnValue({
                downloadProgress: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    querySelector: jest.fn().mockReturnValue({
                        style: { width: '0%' },
                        textContent: ''
                    })
                }
            }),
            updateProgressBar: jest.fn()
        };

        fileOperations = new FtpFileOperations(mockFtpClient, mockUiHandler);
    });

    describe('initiateUpload', () => {
        beforeEach(() => {
            mockFtpClient.isConnectedToServer.mockReturnValue(true);
            ipcRenderer.invoke.mockResolvedValue({ filePaths: ['C:\\test\\file.txt'] });
        });

        it('should handle successful file upload', async () => {
            await fileOperations.initiateUpload();

            expect(mockBasicFtpClient.uploadFrom).toHaveBeenCalledWith(
                'C:\\test\\file.txt',
                'file.txt'
            );
            expect(mockFtpClient.listDirectory).toHaveBeenCalled();
            expect(ipcRenderer.send).toHaveBeenCalledWith(
                'show-notification',
                expect.objectContaining({
                    title: 'Upload Success'
                })
            );
        });

        it('should handle upload failure', async () => {
            const error = new Error('Upload failed');
            mockBasicFtpClient.uploadFrom.mockRejectedValueOnce(error);

            await fileOperations.initiateUpload();

            expect(ipcRenderer.send).toHaveBeenCalledWith(
                'show-notification',
                expect.objectContaining({
                    title: 'Upload Error'
                })
            );
        });
    });

    describe('initiateDownload', () => {
        const mockSelectedFiles = new Set(['file1.txt']);
        const mockFileInfo = { name: 'file1.txt', size: 1024, isDirectory: false };

        beforeEach(() => {
            ipcRenderer.invoke.mockResolvedValue({ filePaths: ['C:\\downloads'] });
            mockFtpClient.getCurrentFiles.mockReturnValue([mockFileInfo]);
        });

        it('should handle successful file download', async () => {
            mockBasicFtpClient.downloadTo.mockResolvedValueOnce();

            await fileOperations.initiateDownload(mockSelectedFiles);

            expect(mockBasicFtpClient.downloadTo).toHaveBeenCalled();
            expect(ipcRenderer.send).toHaveBeenCalledWith(
                'show-notification',
                expect.objectContaining({
                    title: 'Download Complete'
                })
            );
        });

        it('should handle download failure', async () => {
            const error = new Error('Download failed');
            mockBasicFtpClient.downloadTo.mockRejectedValueOnce(error);

            await fileOperations.initiateDownload(mockSelectedFiles);

            expect(ipcRenderer.send).toHaveBeenCalledWith(
                'show-notification',
                expect.objectContaining({
                    title: 'Download Error'
                })
            );
        });

        it('should update progress during download', async () => {
            // Mock selected files and file info
            const mockSelectedFiles = ['file1.txt'];
            const mockFileInfo = { name: 'file1.txt', size: 1024 };
            mockFtpClient.getCurrentFiles.mockReturnValue([mockFileInfo]);
            
            // Mock download directory
            const downloadPath = 'C:\\downloads';
            jest.spyOn(fileOperations, 'getDownloadDirectory').mockResolvedValue(downloadPath);
            
            // Mock fs module
            const fs = require('fs');
            fs.existsSync.mockReturnValue(false);
            
            // Mock UI elements
            const mockProgressBar = { style: { width: '0%' } };
            const mockProgressElement = {
                classList: { add: jest.fn(), remove: jest.fn() },
                querySelector: jest.fn().mockReturnValue(mockProgressBar)
            };
            mockUiHandler.getElements.mockReturnValue({
                downloadProgress: mockProgressElement
            });
            mockUiHandler.updateProgressBar.mockImplementation(progress => {
                mockProgressBar.style.width = `${progress}%`;
            });
            
            // Mock getDownloadableFiles
            jest.spyOn(fileOperations, 'getDownloadableFiles').mockReturnValue(['file1.txt']);
            
            // Mock successful download with progress updates
            let progressCallback;
            mockBasicFtpClient.trackProgress.mockImplementation(cb => {
                progressCallback = cb;
                return () => {}; // Return cleanup function
            });
            
            mockBasicFtpClient.downloadTo.mockImplementation(async (localPath, filename) => {
                expect(filename).toBe('file1.txt');
                expect(localPath).toBe('C:\\downloads\\file1.txt');
                
                if (progressCallback) {
                    progressCallback({ bytes: 512 }); // 50%
                    expect(mockUiHandler.updateProgressBar).toHaveBeenCalledWith(expect.any(Number));
                    
                    progressCallback({ bytes: 1024 }); // 100%
                    expect(mockUiHandler.updateProgressBar).toHaveBeenCalledWith(100);
                }
                return Promise.resolve();
            });

            await fileOperations.initiateDownload(mockSelectedFiles);
            
            expect(mockBasicFtpClient.downloadTo).toHaveBeenCalled();
            expect(mockBasicFtpClient.trackProgress).toHaveBeenCalled();
        });
    });

    describe('generateUniqueFileName', () => {
        const fs = require('fs');

        it('should return original name if file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            const result = fileOperations.generateUniqueFileName('C:\\downloads', 'test.txt');
            expect(result).toBe('test.txt');
        });

        it('should generate unique name if file exists', () => {
            fs.existsSync
                .mockReturnValueOnce(true)  // test.txt exists
                .mockReturnValueOnce(true)  // test (1).txt exists
                .mockReturnValueOnce(false); // test (2).txt doesn't exist

            const result = fileOperations.generateUniqueFileName('C:\\downloads', 'test.txt');
            expect(result).toBe('test (2).txt');
        });
    });

    describe('formatFileSize', () => {
        it('should format file sizes correctly', () => {
            expect(fileOperations.formatFileSize(0)).toBe('0 Bytes');
            expect(fileOperations.formatFileSize(1024)).toBe('1 KB');
            expect(fileOperations.formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(fileOperations.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
        });
    });
});
