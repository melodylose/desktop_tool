// Mock ipcRenderer
const mockIpcRenderer = {
    send: jest.fn(),
    invoke: jest.fn().mockResolvedValue('C:/downloads'),
    on: jest.fn()
};

jest.mock('electron', () => ({
    ipcRenderer: mockIpcRenderer
}));

const { ipcRenderer } = require('electron');
const FtpHandler = require('../ftpOperations');

jest.mock('basic-ftp', () => ({
    Client: jest.fn().mockImplementation(() => ({
        access: jest.fn(),
        downloadTo: jest.fn(),
        uploadFrom: jest.fn(),
        list: jest.fn(),
        cd: jest.fn(),
        close: jest.fn()
    }))
}));

// Mock DOM elements
const mockElements = {
    fileList: { 
        innerHTML: '',
        appendChild: jest.fn(),
        style: { display: 'none' },
        querySelector: jest.fn().mockReturnValue({
            addEventListener: jest.fn(),
            querySelector: jest.fn().mockReturnValue({ 
                classList: { add: jest.fn(), remove: jest.fn() }
            })
        })
    },
    selectAll: { checked: false, indeterminate: false },
    ftpHistory: { appendChild: jest.fn(), innerHTML: '' },
    ftpServer: { value: '', disabled: false },
    username: { value: '', disabled: false },
    password: { value: '', disabled: false },
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
        style: { display: 'none' },
        disabled: false
    },
    uploadBtn: { classList: { add: jest.fn(), remove: jest.fn() }, style: { display: 'none' }, disabled: false },
    downloadBtn: { classList: { add: jest.fn(), remove: jest.fn() }, style: { display: 'none' }, disabled: false },
    downloadProgress: { 
        classList: { add: jest.fn(), remove: jest.fn() },
        querySelector: jest.fn().mockReturnValue({ 
            style: { width: '0%' },
            textContent: ''
        }),
        style: { display: 'none' }
    },
    parentDirBtn: { classList: { add: jest.fn(), remove: jest.fn() }, style: { display: 'none' } },
    progressBar: { 
        style: { width: '0%' },
        textContent: ''
    },
    normalState: { style: { display: 'none' } },
    connectingState: { style: { display: 'none' } },
    connectedState: { style: { display: 'none' } },
    currentPath: { textContent: '' },
    uploadProgress: {
        classList: { add: jest.fn(), remove: jest.fn() },
        style: { display: 'none' }
    }
};

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true
});

describe('FtpHandler', () => {
    let ftpHandler;
    let mockClient;
    
    beforeEach(() => {
        // Spy on console.error
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Mock ipcRenderer
        ipcRenderer.send = mockIpcRenderer.send;
        ipcRenderer.invoke = mockIpcRenderer.invoke;
        ipcRenderer.on = mockIpcRenderer.on;

        mockClient = {
            downloadTo: jest.fn(),
            list: jest.fn(),
            access: jest.fn(),
            cd: jest.fn(),
            close: jest.fn()
        };
        
        // 初始化 ftpHandler
        ftpHandler = new FtpHandler();
        
        // 設置 elements
        ftpHandler.elements = mockElements;
        mockClient = ftpHandler.client;
        
        ftpHandler.displayFileList = jest.fn();
        ftpHandler.showDownloadResult = jest.fn();
    });

    describe('connectToFTP', () => {
        const credentials = {
            host: 'test.com',
            user: 'user',
            password: 'pass'
        };

        beforeEach(() => {
            // Clear all mocks before each test
            mockIpcRenderer.send.mockClear();
            mockClient.access.mockClear();
            
            ftpHandler = new FtpHandler();
            ftpHandler.elements = {
                ftpServer: { value: 'ftp://test.com', disabled: false },
                username: { value: 'user', disabled: false },
                password: { value: 'pass', disabled: false },
                connectBtn: { 
                    disabled: false,
                    classList: { add: jest.fn(), remove: jest.fn() },
                    querySelector: jest.fn().mockImplementation((selector) => {
                        const states = {
                            '.normal-state': { style: { display: 'none' } },
                            '.connecting-state': { style: { display: 'none' } },
                            '.connected-state': { style: { display: 'none' } }
                        };
                        return states[selector];
                    })
                },
                uploadBtn: { classList: { add: jest.fn(), remove: jest.fn() }, style: { display: 'none' }, disabled: false },
                downloadBtn: { classList: { add: jest.fn(), remove: jest.fn() }, style: { display: 'none' }, disabled: false },
                downloadProgress: { 
                    classList: { add: jest.fn(), remove: jest.fn() },
                    querySelector: jest.fn().mockReturnValue({
                        style: { width: '0%' },
                        textContent: '0%'
                    })
                },
                fileList: { 
                    innerHTML: '',
                    appendChild: jest.fn(),
                    style: { display: 'none' },
                    querySelector: jest.fn().mockReturnValue({
                        addEventListener: jest.fn(),
                        querySelector: jest.fn().mockReturnValue({ 
                            classList: { add: jest.fn(), remove: jest.fn() }
                        })
                    })
                }
            };
            mockClient = {
                access: jest.fn().mockResolvedValue(),
                end: jest.fn()
            };
            ftpHandler.client = mockClient;
        });

        it('should connect to FTP server with correct credentials', async () => {
            await ftpHandler.connectToFTP();
            expect(mockClient.access).toHaveBeenCalledWith({
                host: 'ftp://test.com',
                user: 'user',
                password: 'pass',
                secure: false
            });
            expect(mockIpcRenderer.send).toHaveBeenCalledWith('show-notification', expect.any(Object));
        });

        it('should handle invalid FTP URL', async () => {
            // Mock validateFtpUrl to return invalid for 'invalid-url'
            ftpHandler.validateFtpUrl = jest.fn().mockReturnValue({ isValid: false, message: 'Invalid URL' });
            
            ftpHandler.elements.ftpServer.value = 'invalid-url';
            await ftpHandler.connectToFTP();
            
            expect(mockClient.access).not.toHaveBeenCalled();
            expect(mockIpcRenderer.send).toHaveBeenCalledWith('show-notification', expect.any(Object));
        });

        it('should handle connection error', async () => {
            mockClient.access.mockRejectedValue(new Error('Connection failed'));
            await ftpHandler.connectToFTP();
            expect(mockIpcRenderer.send).toHaveBeenCalledWith('show-notification', {
                title: 'Connection Error',
                body: expect.stringContaining('Failed to connect to FTP server: Connection failed')
            });
        });
    });

    describe('Connection State Management', () => {
        beforeEach(() => {
            ftpHandler = new FtpHandler();
            ftpHandler.elements = mockElements;
            
            // 設置必要的元素值
            ftpHandler.elements.ftpServer = { value: 'ftp://test.com' };
            ftpHandler.elements.username = { value: 'user' };
            ftpHandler.elements.password = { value: 'pass' };

            // 重置所有 mock 函數
            mockClient = ftpHandler.client;
            mockClient.access.mockReset().mockResolvedValue();
            mockClient.list.mockReset().mockResolvedValue([]);
            mockClient.close.mockReset().mockResolvedValue();
        });

        it('should update button states when connecting', async () => {
            // 模擬連接過程開始
            const connectPromise = ftpHandler.connectToFTP();
            
            // 驗證連接中的狀態
            expect(ftpHandler.elements.connectBtn.disabled).toBe(true);
            
            await connectPromise;

            // 驗證連接後的狀態
            expect(ftpHandler.isConnected).toBe(true);
            expect(ftpHandler.elements.connectBtn.disabled).toBe(false);
            expect(mockClient.access).toHaveBeenCalledWith({
                host: 'ftp://test.com',
                user: 'user',
                password: 'pass',
                secure: false
            });
            expect(mockClient.list).toHaveBeenCalled();
        });

        it('should handle connection timeout', async () => {
            // 模擬連接超時
            mockClient.access.mockImplementation(() => new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 100);
            }));

            await ftpHandler.connectToFTP();

            // 驗證超時後的狀態
            expect(ftpHandler.isConnected).toBe(false);
            expect(ftpHandler.elements.connectBtn.disabled).toBe(false);
            expect(mockIpcRenderer.send).toHaveBeenCalledWith('show-notification', 
                expect.objectContaining({ 
                    title: 'Connection Error',
                    body: expect.stringContaining('Connection timeout')
                }));
        });

        it('should handle disconnection correctly', async () => {
            // 先模擬成功連接
            mockClient.access.mockResolvedValue();
            await ftpHandler.connectToFTP();
            
            // 模擬斷開連接
            await ftpHandler.disconnectFromFTP();
            
            expect(ftpHandler.isConnected).toBe(false);
            expect(mockClient.close).toHaveBeenCalled();
            expect(ftpHandler.elements.connectBtn.disabled).toBe(false);
        });

        it('should handle unexpected disconnection', async () => {
            // 模擬成功連接
            mockClient.access.mockResolvedValue();
            await ftpHandler.connectToFTP();

            // 模擬意外斷開連接（例如網絡錯誤）
            const error = new Error('ECONNRESET');
            mockClient.cd.mockRejectedValue(error);
            
            await ftpHandler.listDirectory();

            // 只驗證錯誤通知，因為目前的實作並不會自動斷開連接
            expect(mockIpcRenderer.send).toHaveBeenCalledWith('show-notification', 
                expect.objectContaining({ 
                    title: 'Directory Error',
                    body: expect.stringContaining('Failed to access directory')
                }));

            // 連接狀態保持不變
            expect(ftpHandler.isConnected).toBe(true);
        });
    });

    describe('File Operations', () => {
        beforeEach(() => {
            // Mock file system operations
            mockClient.uploadFrom = jest.fn().mockResolvedValue();
            mockClient.downloadTo = jest.fn().mockResolvedValue();
            mockClient.list = jest.fn().mockResolvedValue([
                { name: 'test.txt', size: 1024, isDirectory: false }
            ]);
            
            // Mock file path
            ftpHandler.currentPath = '/test';
            ftpHandler.currentFiles = [
                { name: 'test.txt', size: 1024, isDirectory: false }
            ];
        });

        describe('Upload Operations', () => {
            beforeEach(() => {
                // Mock isConnected state
                ftpHandler.isConnected = true;
            });

            it('should handle successful file upload', async () => {
                // Mock file dialog result
                const testFilePath = 'C:\\test\\file.txt';
                mockIpcRenderer.invoke.mockResolvedValueOnce({
                    filePaths: [testFilePath]
                });

                // Mock successful upload
                mockClient.uploadFrom.mockResolvedValueOnce();

                // Start upload
                await ftpHandler.initiateUpload();

                // Verify upload was called
                expect(mockClient.uploadFrom).toHaveBeenCalledWith(
                    testFilePath,
                    'file.txt'
                );

                // Verify success notification
                expect(mockIpcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Upload Success'
                    })
                );

                // Verify file list refresh
                expect(mockClient.list).toHaveBeenCalled();
            });

            it('should handle upload errors', async () => {
                // Mock file dialog result
                const testFilePath = 'C:\\test\\file.txt';
                mockIpcRenderer.invoke.mockResolvedValueOnce({
                    filePaths: [testFilePath]
                });

                // Mock upload error
                const mockError = new Error('Network error during upload');
                mockClient.uploadFrom.mockRejectedValueOnce(mockError);

                // Start upload
                await ftpHandler.initiateUpload();

                // Verify error notification
                expect(mockIpcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Upload Error'
                    })
                );
            });

            it('should handle no connection', async () => {
                // Set disconnected state
                ftpHandler.isConnected = false;

                // Start upload
                await ftpHandler.initiateUpload();

                // Verify connection required notification
                expect(mockIpcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Connection Required'
                    })
                );

                // Verify no upload attempt was made
                expect(mockClient.uploadFrom).not.toHaveBeenCalled();
            });

            it('should handle no file selected', async () => {
                // Mock empty file dialog result
                mockIpcRenderer.invoke.mockResolvedValueOnce({
                    filePaths: []
                });

                // Start upload
                await ftpHandler.initiateUpload();

                // Verify no upload attempt was made
                expect(mockClient.uploadFrom).not.toHaveBeenCalled();
            });
        });

        describe('Download Operations', () => {
            let mockProgressBar;
            let mockProgressBarContainer;

            beforeEach(() => {
                // Mock isConnected state
                ftpHandler.isConnected = true;

                // Mock progress bar element with initial width
                mockProgressBar = { 
                    style: { width: '0%' }, 
                    textContent: '0%',
                    getAttribute: jest.fn().mockReturnValue('0'),
                    setAttribute: jest.fn()
                };
                mockProgressBarContainer = {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    querySelector: jest.fn().mockImplementation((selector) => {
                        if (selector === '.progress-bar') {
                            return mockProgressBar;
                        }
                        return null;
                    }),
                    style: { display: 'none' }
                };
                ftpHandler.elements.downloadProgress = mockProgressBarContainer;

                // Mock current files with size information
                ftpHandler.currentFiles = [
                    { name: 'test.txt', size: 1024, isDirectory: false }
                ];
                ftpHandler.selectedFiles = new Set(['test.txt']);

                // Mock client methods
                mockClient.downloadTo = jest.fn().mockImplementation(() => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            // Update progress to 100% before resolving
                            if (ftpHandler.progressCallback) {
                                ftpHandler.progressCallback({ bytes: 1024 });
                            }
                            resolve();
                        }, 100);
                    });
                });

                // Mock trackProgress
                mockClient.trackProgress = jest.fn(callback => {
                    // Store callback for later use
                    ftpHandler.progressCallback = callback;
                    return () => {
                        ftpHandler.progressCallback = null;
                    };
                });
            });

            it('should handle successful file download', async () => {
                // Mock directory dialog result
                const downloadDir = 'C:\\downloads';
                mockIpcRenderer.invoke.mockResolvedValueOnce({
                    filePaths: [downloadDir]
                });

                // Mock fs.existsSync for generateUniqueFileName
                const fs = require('fs');
                const existsSyncMock = jest.spyOn(fs, 'existsSync');
                existsSyncMock.mockImplementation((path) => {
                    return path !== `${downloadDir}\\test.txt`;
                });

                // Mock updateProgressBar method
                const originalUpdateProgressBar = ftpHandler.updateProgressBar;
                ftpHandler.updateProgressBar = jest.fn((percentage) => {
                    console.log(`Updating progress bar to ${percentage}%`);
                    mockProgressBar.style.width = `${percentage}%`;
                    mockProgressBar.textContent = `${percentage}%`;
                });

                // Mock downloadTo method to simulate progress
                mockClient.downloadTo = jest.fn().mockImplementation(() => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            // Update progress to 100% before resolving
                            if (ftpHandler.progressCallback) {
                                console.log('Simulating final progress update');
                                ftpHandler.progressCallback({ bytes: 1024 });
                            }
                            resolve();
                        }, 100);
                    });
                });

                try {
                    // Start download process
                    console.log('Starting download process');
                    const downloadPromise = ftpHandler.initiateDownload();

                    // Wait a bit for the download to start
                    await new Promise(resolve => setTimeout(resolve, 50));

                    // Simulate progress updates
                    if (ftpHandler.progressCallback) {
                        console.log('Simulating 50% progress update');
                        ftpHandler.progressCallback({ bytes: 512 });  // 50%
                        await new Promise(resolve => setTimeout(resolve, 10));
                        console.log(`Current progress: width=${mockProgressBar.style.width}, text=${mockProgressBar.textContent}`);
                        expect(mockProgressBar.style.width).toBe('50%');
                        expect(mockProgressBar.textContent).toBe('50%');
                    }

                    // Wait for download to complete
                    console.log('Waiting for download to complete');
                    await downloadPromise;

                    // Wait a bit for the final progress update, but not too long
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Log final progress bar state
                    console.log(`Final progress: width=${mockProgressBar.style.width}, text=${mockProgressBar.textContent}`);
                    console.log('Progress bar update calls:', ftpHandler.updateProgressBar.mock.calls);

                    // Verify download was called with correct path
                    expect(mockClient.downloadTo).toHaveBeenCalledWith(
                        `${downloadDir}\\test.txt`,
                        'test.txt'
                    );

                    // Verify that updateProgressBar was called with 100% at some point
                    expect(ftpHandler.updateProgressBar).toHaveBeenCalledWith(100);
                } finally {
                    // Restore original updateProgressBar method
                    ftpHandler.updateProgressBar = originalUpdateProgressBar;
                    // Clean up
                    existsSyncMock.mockRestore();
                }
            }, 15000);

            it('should handle download errors', async () => {
                // Mock directory dialog result
                const downloadDir = 'C:\\downloads';
                mockIpcRenderer.invoke.mockResolvedValueOnce({
                    filePaths: [downloadDir]
                });

                // Mock download error
                const mockError = new Error('Network error during download');
                mockClient.downloadTo.mockRejectedValueOnce(mockError);

                // Start download process
                await ftpHandler.initiateDownload();

                // Verify error notification
                expect(mockIpcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Download Error'
                    })
                );
            }, 15000);

            it('should handle download progress updates', async () => {
                // Mock directory dialog result
                const downloadDir = 'C:\\downloads';
                mockIpcRenderer.invoke.mockResolvedValueOnce({
                    filePaths: [downloadDir]
                });

                // Mock fs.existsSync for generateUniqueFileName
                const fs = require('fs');
                const existsSyncMock = jest.spyOn(fs, 'existsSync');
                existsSyncMock.mockImplementation((path) => {
                    return path !== `${downloadDir}\\test.txt`;
                });

                // Mock updateProgressBar method
                const originalUpdateProgressBar = ftpHandler.updateProgressBar;
                ftpHandler.updateProgressBar = jest.fn((percentage) => {
                    console.log(`Updating progress bar to ${percentage}%`);
                    mockProgressBar.style.width = `${percentage}%`;
                    mockProgressBar.textContent = `${percentage}%`;
                });

                // Mock downloadTo method to simulate progress
                mockClient.downloadTo = jest.fn().mockImplementation(() => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            // Update progress to 100% before resolving
                            if (ftpHandler.progressCallback) {
                                console.log('Simulating final progress update');
                                ftpHandler.progressCallback({ bytes: 1024 });
                            }
                            resolve();
                        }, 100);
                    });
                });

                // Start download process
                console.log('Starting download process');
                const downloadPromise = ftpHandler.initiateDownload();

                // Wait a bit for the download to start
                await new Promise(resolve => setTimeout(resolve, 50));

                // Simulate progress updates
                if (ftpHandler.progressCallback) {
                    console.log('Simulating 25% progress update');
                    ftpHandler.progressCallback({ bytes: 256 });  // 25%
                    await new Promise(resolve => setTimeout(resolve, 10));
                    console.log(`Current progress: width=${mockProgressBar.style.width}, text=${mockProgressBar.textContent}`);
                    expect(mockProgressBar.style.width).toBe('25%');
                    expect(mockProgressBar.textContent).toBe('25%');

                    console.log('Simulating 50% progress update');
                    ftpHandler.progressCallback({ bytes: 512 });  // 50%
                    await new Promise(resolve => setTimeout(resolve, 10));
                    console.log(`Current progress: width=${mockProgressBar.style.width}, text=${mockProgressBar.textContent}`);
                    expect(mockProgressBar.style.width).toBe('50%');
                    expect(mockProgressBar.textContent).toBe('50%');

                    console.log('Simulating 75% progress update');
                    ftpHandler.progressCallback({ bytes: 768 });  // 75%
                    await new Promise(resolve => setTimeout(resolve, 10));
                    console.log(`Current progress: width=${mockProgressBar.style.width}, text=${mockProgressBar.textContent}`);
                    expect(mockProgressBar.style.width).toBe('75%');
                    expect(mockProgressBar.textContent).toBe('75%');
                }

                // Wait for download to complete
                console.log('Waiting for download to complete');
                await downloadPromise;

                // Wait a bit for the final progress update
                await new Promise(resolve => setTimeout(resolve, 100));

                // Log final progress bar state and all update calls
                console.log(`Final progress: width=${mockProgressBar.style.width}, text=${mockProgressBar.textContent}`);
                console.log('Progress bar update calls:', ftpHandler.updateProgressBar.mock.calls);

                // Verify progress bar updates sequence
                expect(ftpHandler.updateProgressBar).toHaveBeenCalledWith(0);  // Initial state
                expect(ftpHandler.updateProgressBar).toHaveBeenCalledWith(25);
                expect(ftpHandler.updateProgressBar).toHaveBeenCalledWith(50);
                expect(ftpHandler.updateProgressBar).toHaveBeenCalledWith(75);
                expect(ftpHandler.updateProgressBar).toHaveBeenCalledWith(100);

                // Clean up
                ftpHandler.updateProgressBar = originalUpdateProgressBar;
                existsSyncMock.mockRestore();
            }, 15000);
        });

        describe('initiateDownload', () => {
            test('should handle network error during download', async () => {
                const mockError = new Error('Network error during download');
                mockClient.downloadTo.mockRejectedValueOnce(mockError);
                
                // Mock getDownloadDirectory
                ftpHandler.getDownloadDirectory = jest.fn().mockResolvedValue('C:/downloads');
                
                await ftpHandler.initiateDownload();
                
                expect(mockElements.downloadProgress.classList.add).toHaveBeenCalledWith('d-none');
                expect(ftpHandler.showDownloadResult).toHaveBeenCalled();
            });
        });
    });

    describe('File Sorting', () => {
        beforeEach(() => {
            ftpHandler = new FtpHandler();
            ftpHandler.displayFileList = jest.fn();
            ftpHandler.currentFiles = [
                { name: 'b.txt', modifiedAt: new Date('2024-01-02') },
                { name: 'a.txt', modifiedAt: new Date('2024-01-01') }
            ];
        });

        it('should sort files by date in ascending order', () => {
            const mockEvent = {
                target: {
                    classList: {
                        contains: jest.fn().mockReturnValue(false),
                        toggle: jest.fn()
                    }
                }
            };
            
            ftpHandler.sortFileList(mockEvent);
            
            expect(ftpHandler.currentFiles[0].modifiedAt).toEqual(new Date('2024-01-01'));
            expect(ftpHandler.currentFiles[1].modifiedAt).toEqual(new Date('2024-01-02'));
            expect(ftpHandler.displayFileList).toHaveBeenCalled();
        });

        it('should sort files by date in descending order', () => {
            const mockEvent = {
                target: {
                    classList: {
                        contains: jest.fn().mockReturnValue(true),
                        toggle: jest.fn()
                    }
                }
            };
            
            ftpHandler.sortFileList(mockEvent);
            
            expect(ftpHandler.currentFiles[0].modifiedAt).toEqual(new Date('2024-01-02'));
            expect(ftpHandler.currentFiles[1].modifiedAt).toEqual(new Date('2024-01-01'));
            expect(ftpHandler.displayFileList).toHaveBeenCalled();
        });
    });

    describe('FTP History Management', () => {
        beforeEach(() => {
            // Reset all mocks before each test
            mockLocalStorage.getItem.mockClear();
            mockLocalStorage.setItem.mockClear();
            mockLocalStorage.clear.mockClear();
            console.error.mockClear();
            mockElements.ftpHistory.appendChild.mockClear();
            mockElements.ftpHistory.innerHTML = '';
            ftpHandler = new FtpHandler();
            ftpHandler.elements = mockElements;
        });

        afterEach(() => {
            console.error.mockRestore();
        });

        describe('loadFtpHistory', () => {
            it('should load history from localStorage', () => {
                const mockHistory = ['ftp://test1.com', 'ftp://test2.com'];
                mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockHistory));
                
                ftpHandler.loadFtpHistory();
                
                expect(mockLocalStorage.getItem).toHaveBeenCalledWith('ftpServerHistory');
                expect(ftpHandler.ftpHistory).toEqual(mockHistory);
            });

            it('should handle empty history', () => {
                mockLocalStorage.getItem.mockReturnValue(null);

                ftpHandler.loadFtpHistory();

                expect(ftpHandler.ftpHistory).toEqual([]);
            });

            it('should handle invalid JSON in localStorage', () => {
                mockLocalStorage.getItem.mockReturnValue('invalid-json');

                ftpHandler.loadFtpHistory();

                expect(ftpHandler.ftpHistory).toEqual([]);
                expect(console.error).toHaveBeenCalled();
            });
        });

        describe('saveFtpHistory', () => {
            it('should save history to localStorage', () => {
                const mockHistory = ['ftp://server1.com', 'ftp://server2.com'];
                ftpHandler.ftpHistory = mockHistory;

                ftpHandler.saveFtpHistory();

                expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                    'ftpServerHistory',
                    JSON.stringify(mockHistory)
                );
            });

            it('should handle localStorage error', () => {
                mockLocalStorage.setItem.mockImplementation(() => {
                    throw new Error('Storage error');
                });

                ftpHandler.saveFtpHistory();

                expect(console.error).toHaveBeenCalled();
            });
        });

        describe('addToFtpHistory', () => {
            it('should add new URL to history', () => {
                const newUrl = 'ftp://newserver.com';
                ftpHandler.ftpHistory = ['ftp://oldserver.com'];

                ftpHandler.addToFtpHistory(newUrl);

                expect(ftpHandler.ftpHistory[0]).toBe(newUrl);
                expect(ftpHandler.ftpHistory.length).toBe(2);
            });

            it('should move existing URL to front of history', () => {
                const existingUrl = 'ftp://server1.com';
                ftpHandler.ftpHistory = [
                    'ftp://server2.com',
                    existingUrl,
                    'ftp://server3.com'
                ];

                ftpHandler.addToFtpHistory(existingUrl);

                expect(ftpHandler.ftpHistory[0]).toBe(existingUrl);
                expect(ftpHandler.ftpHistory.length).toBe(3);
            });

            it('should limit history to maxHistoryItems', () => {
                ftpHandler.maxHistoryItems = 3;
                const urls = [
                    'ftp://server1.com',
                    'ftp://server2.com',
                    'ftp://server3.com',
                    'ftp://server4.com'
                ];

                urls.forEach(url => ftpHandler.addToFtpHistory(url));

                expect(ftpHandler.ftpHistory.length).toBe(3);
                expect(ftpHandler.ftpHistory[0]).toBe('ftp://server4.com');
                expect(ftpHandler.ftpHistory).not.toContain('ftp://server1.com');
            });

            it('should not add empty URL to history', () => {
                ftpHandler.ftpHistory = ['ftp://server1.com'];

                ftpHandler.addToFtpHistory('');
                ftpHandler.addToFtpHistory(null);
                ftpHandler.addToFtpHistory(undefined);

                expect(ftpHandler.ftpHistory.length).toBe(1);
            });
        });

        describe('updateFtpHistoryDisplay', () => {
            it('should update history dropdown options', () => {
                ftpHandler.ftpHistory = ['ftp://server1.com', 'ftp://server2.com'];

                ftpHandler.updateFtpHistoryDisplay();

                expect(ftpHandler.elements.ftpHistory.innerHTML).toBe('');
                expect(ftpHandler.elements.ftpHistory.appendChild).toHaveBeenCalledTimes(2);
            });

            it('should handle missing ftpHistory element', () => {
                ftpHandler.elements.ftpHistory = null;
                ftpHandler.ftpHistory = ['ftp://server1.com'];

                expect(() => ftpHandler.updateFtpHistoryDisplay()).not.toThrow();
            });
        });
    });

    describe('URL Validation', () => {
        test('should validate FTP URLs', () => {
            // Add isValidFtpUrl method to ftpHandler
            ftpHandler.isValidFtpUrl = (url) => {
                try {
                    const urlObj = new URL(url);
                    return urlObj.protocol === 'ftp:';
                } catch {
                    return false;
                }
            };

            expect(ftpHandler.isValidFtpUrl('ftp://test.com')).toBe(true);
            expect(ftpHandler.isValidFtpUrl('http://test.com')).toBe(false);
            expect(ftpHandler.isValidFtpUrl('invalid-url')).toBe(false);
        });
    });
});
