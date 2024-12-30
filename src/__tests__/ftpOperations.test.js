const FtpHandler = require('../ftpOperations');
const BasicFtp = require('basic-ftp');
const path = require('path');

// Mock basic-ftp
jest.mock('basic-ftp', () => ({
    Client: jest.fn().mockImplementation(() => ({
        access: jest.fn(),
        downloadTo: jest.fn(),
        uploadFrom: jest.fn(),
        list: jest.fn().mockResolvedValue([]),
        close: jest.fn(),
        connect: jest.fn(),
        cd: jest.fn(),
        trackProgress: jest.fn().mockImplementation((callback) => {
            callback({ bytes: 50, bytesOverall: 100 });
            return { stop: jest.fn() };
        })
    }))
}));

// Mock electron
jest.mock('electron', () => ({
    ipcRenderer: {
        send: jest.fn(),
        invoke: jest.fn()
    }
}));

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
};
global.localStorage = localStorageMock;

describe('FtpHandler', () => {
    let ftpHandler;
    let mockDocument;

    beforeEach(() => {
        // Reset localStorage mock
        localStorageMock.getItem.mockReset();
        localStorageMock.setItem.mockReset();
        
        // Mock DOM elements
        const createMockElement = () => ({
            addEventListener: jest.fn(),
            querySelector: jest.fn().mockReturnValue({
                style: { display: 'none', width: '0%' },
                textContent: '',
                classList: {
                    add: jest.fn(),
                    remove: jest.fn(),
                    contains: jest.fn()
                }
            }),
            querySelectorAll: jest.fn().mockReturnValue([]),
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn()
            },
            disabled: false,
            checked: false,
            dataset: { filename: '' },
            style: { display: 'none', width: '0%' },
            value: ''
        });

        mockDocument = {
            getElementById: jest.fn().mockImplementation((id) => {
                const element = createMockElement();
                if (id === 'connectBtn') {
                    element.querySelector = jest.fn().mockImplementation((selector) => ({
                        style: { display: 'none' },
                        classList: {
                            add: jest.fn(),
                            remove: jest.fn(),
                            contains: jest.fn()
                        }
                    }));
                }
                if (id === 'fileList') {
                    element.innerHTML = '';
                }
                if (id === 'downloadProgress') {
                    element.querySelector = jest.fn().mockReturnValue({
                        style: { width: '0%' },
                        textContent: '0%'
                    });
                }
                return element;
            }),
            querySelector: jest.fn().mockReturnValue(createMockElement()),
            createElement: jest.fn().mockReturnValue({
                ...createMockElement(),
                innerHTML: '',
                appendChild: jest.fn()
            })
        };

        global.document = mockDocument;
        ftpHandler = new FtpHandler();
        ftpHandler.initialize();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('initialize', () => {
        test('should initialize all required elements', () => {
            expect(mockDocument.getElementById).toHaveBeenCalled();
        });
    });

    describe('connectToFTP', () => {
        test('should connect to FTP server with correct credentials', async () => {
            const mockCredentials = {
                host: 'test.com',
                user: 'user',
                password: 'pass'
            };

            ftpHandler.elements = {
                ftpServer: { value: mockCredentials.host },
                username: { value: mockCredentials.user },
                password: { value: mockCredentials.password },
                connectBtn: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    querySelector: jest.fn().mockImplementation((selector) => ({
                        style: { display: 'none' }
                    }))
                }
            };

            await ftpHandler.connectToFTP();
            expect(ftpHandler.client.access).toHaveBeenCalledWith(expect.objectContaining(mockCredentials));
        });
    });

    describe('File Operations', () => {
        const mockFiles = [
            { name: 'test1.txt', size: 1024, isDirectory: false },
            { name: 'test2.txt', size: 2048, isDirectory: false },
            { name: 'testDir', isDirectory: true }
        ];

        beforeEach(() => {
            ftpHandler.isConnected = true;
            ftpHandler.currentPath = '/';
            ftpHandler.client.list.mockResolvedValue(mockFiles);
        });

        describe('listDirectory', () => {
            test('should list directory contents', async () => {
                ftpHandler.elements.fileList = document.createElement('div');
                
                await ftpHandler.listDirectory('/test');
                
                expect(ftpHandler.client.cd).toHaveBeenCalledWith('/');
                expect(ftpHandler.client.cd).toHaveBeenCalledWith('/test');
                expect(ftpHandler.client.list).toHaveBeenCalled();
                expect(ftpHandler.currentFiles).toEqual(mockFiles);
            });

            test('should not list directory when not connected', async () => {
                ftpHandler.isConnected = false;
                await ftpHandler.listDirectory('/');
                expect(ftpHandler.client.list).not.toHaveBeenCalled();
            });
        });

        describe('initiateUpload', () => {
            test('should upload files successfully', async () => {
                const { ipcRenderer } = require('electron');
                const mockFilePaths = ['C:\\test\\file1.txt', 'C:\\test\\file2.txt'];
                
                ipcRenderer.invoke.mockResolvedValue({ filePaths: mockFilePaths });
                
                await ftpHandler.initiateUpload();
                
                expect(ipcRenderer.invoke).toHaveBeenCalledWith('show-file-dialog');
                expect(ftpHandler.client.uploadFrom).toHaveBeenCalledTimes(2);
                expect(ftpHandler.client.uploadFrom).toHaveBeenCalledWith(
                    mockFilePaths[0],
                    'file1.txt'
                );
            });

            test('should handle upload errors', async () => {
                const { ipcRenderer } = require('electron');
                const mockError = new Error('Upload failed');
                
                ipcRenderer.invoke.mockResolvedValue({ filePaths: ['test.txt'] });
                ftpHandler.client.uploadFrom.mockRejectedValue(mockError);
                
                await ftpHandler.initiateUpload();
                
                expect(ipcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Upload Error'
                    })
                );
            });
        });

        describe('initiateDownload', () => {
            test('should prepare download correctly', async () => {
                const { ipcRenderer } = require('electron');
                const mockDownloadPath = 'C:\\downloads';
                
                ftpHandler.selectedFiles = new Set(['test1.txt']);
                ftpHandler.currentFiles = mockFiles;
                ipcRenderer.invoke.mockResolvedValue({ filePaths: [mockDownloadPath] });
                
                await ftpHandler.initiateDownload();
                
                expect(ipcRenderer.invoke).toHaveBeenCalledWith('show-directory-dialog');
            });

            test('should not download when no files selected', async () => {
                ftpHandler.selectedFiles = new Set();
                
                await ftpHandler.initiateDownload();
                
                expect(ftpHandler.client.downloadTo).not.toHaveBeenCalled();
            });
        });

        describe('navigation', () => {
            test('should navigate to subdirectory', async () => {
                await ftpHandler.navigateToDirectory('testDir');
                
                expect(ftpHandler.client.cd).toHaveBeenCalledWith('/');
                expect(ftpHandler.client.cd).toHaveBeenCalledWith('/testDir');
            });

            test('should navigate to parent directory', async () => {
                ftpHandler.currentPath = '/test/dir';
                
                await ftpHandler.navigateToParent();
                
                expect(ftpHandler.client.cd).toHaveBeenCalledWith('/');
                expect(ftpHandler.client.cd).toHaveBeenCalledWith('/test');
            });

            test('should not navigate up from root', async () => {
                ftpHandler.currentPath = '/';
                
                await ftpHandler.navigateToParent();
                
                expect(ftpHandler.client.cd).not.toHaveBeenCalled();
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            ftpHandler.isConnected = true;
            ftpHandler.elements = {
                connectBtn: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    disabled: false,
                    querySelector: jest.fn().mockImplementation((selector) => ({
                        style: { display: 'none' },
                        classList: {
                            add: jest.fn(),
                            remove: jest.fn()
                        }
                    }))
                },
                username: { disabled: false },
                password: { disabled: false },
                ftpServer: { disabled: false },
                downloadBtn: { disabled: true },
                fileList: {
                    querySelectorAll: jest.fn().mockReturnValue([]),
                    innerHTML: '',
                    appendChild: jest.fn()
                },
                downloadProgress: {
                    querySelector: jest.fn().mockReturnValue({
                        style: { width: '0%' },
                        textContent: '0%'
                    }),
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn()
                    },
                    style: { width: '0%' }
                },
                selectAllCheckbox: {
                    checked: false
                }
            };

            // Mock client for progress tracking
            ftpHandler.client = {
                trackProgress: jest.fn().mockImplementation((callback) => {
                    callback({ bytes: 50, bytesOverall: 100 });
                    return { stop: jest.fn() };
                })
            };
        });

        describe('Connection Errors', () => {
            test('should handle invalid FTP URL', async () => {
                ftpHandler.client = {
                    access: jest.fn().mockRejectedValue(new Error('Invalid URL')),
                    close: jest.fn()
                };
                ftpHandler.elements.ftpServer.value = 'invalid url';
                await ftpHandler.connectToFTP();
                expect(ftpHandler.isConnected).toBe(false);
            });

            test('should handle connection timeout', async () => {
                const timeoutError = new Error('Connection timed out');
                ftpHandler.client = {
                    access: jest.fn().mockRejectedValue(timeoutError),
                    close: jest.fn()
                };
                
                await ftpHandler.connectToFTP();
                expect(ftpHandler.isConnected).toBe(false);
            });

            test('should handle authentication failure', async () => {
                const authError = new Error('Authentication failed');
                ftpHandler.client = {
                    access: jest.fn().mockRejectedValue(authError),
                    close: jest.fn()
                };
                
                await ftpHandler.connectToFTP();
                expect(ftpHandler.isConnected).toBe(false);
            });
        });

        describe('File Operation Errors', () => {
            test('should handle permission denied error during upload', async () => {
                const { ipcRenderer } = require('electron');
                const permissionError = new Error('Permission denied');
                ftpHandler.client = {
                    uploadFrom: jest.fn().mockRejectedValue(permissionError),
                    close: jest.fn()
                };
                
                ipcRenderer.invoke.mockResolvedValue({ filePaths: ['test.txt'] });
                await ftpHandler.initiateUpload();
                
                expect(ipcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Upload Error'
                    })
                );
            });

            test('should handle network error during download', async () => {
                const { ipcRenderer } = require('electron');
                const networkError = new Error('Network error');
                ftpHandler.client = {
                    downloadTo: jest.fn().mockRejectedValue(networkError),
                    trackProgress: jest.fn(),
                    close: jest.fn()
                };
                
                ftpHandler.selectedFiles = new Set(['test.txt']);
                ftpHandler.currentFiles = [{ name: 'test.txt', isDirectory: false }];
                ipcRenderer.invoke.mockResolvedValue({ filePaths: ['C:\\downloads'] });
                
                await ftpHandler.initiateDownload();
                
                expect(ipcRenderer.send).toHaveBeenCalledWith(
                    'show-notification',
                    expect.objectContaining({
                        title: 'Download Error'
                    })
                );
            });
        });
    });

    describe('UI State Management', () => {
        beforeEach(() => {
            ftpHandler.elements = {
                connectBtn: {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    disabled: false,
                    querySelector: jest.fn().mockImplementation((selector) => ({
                        style: { display: 'none' },
                        classList: {
                            add: jest.fn(),
                            remove: jest.fn()
                        }
                    }))
                },
                username: { disabled: false },
                password: { disabled: false },
                ftpServer: { disabled: false },
                downloadBtn: { disabled: true },
                fileList: {
                    querySelectorAll: jest.fn().mockReturnValue([]),
                    innerHTML: '',
                    appendChild: jest.fn()
                },
                downloadProgress: {
                    querySelector: jest.fn().mockReturnValue({
                        style: { width: '0%' },
                        textContent: '0%'
                    }),
                    classList: {
                        add: jest.fn(),
                        remove: jest.fn()
                    },
                    style: { width: '0%' }
                },
                selectAllCheckbox: {
                    checked: false
                }
            };

            // Mock client for progress tracking
            ftpHandler.client = {
                trackProgress: jest.fn().mockImplementation((callback) => {
                    callback({ bytes: 50, bytesOverall: 100 });
                    return { stop: jest.fn() };
                })
            };
        });

        describe('Connection State', () => {
            test('should update UI elements when connecting', () => {
                ftpHandler.elements = {
                    username: { disabled: false },
                    password: { disabled: false },
                    ftpServer: { disabled: false },
                    connectBtn: {
                        disabled: false,
                        querySelector: jest.fn().mockReturnValue({
                            style: { display: 'none' }
                        })
                    }
                };
                
                ftpHandler.setConnectingState(true);
                ftpHandler.setInputFieldsState(true);
                
                expect(ftpHandler.elements.username.disabled).toBe(true);
                expect(ftpHandler.elements.password.disabled).toBe(true);
                expect(ftpHandler.elements.ftpServer.disabled).toBe(true);
            });

            test('should update UI elements when disconnecting', () => {
                ftpHandler.setConnectingState(false);
                
                expect(ftpHandler.elements.username.disabled).toBe(false);
                expect(ftpHandler.elements.password.disabled).toBe(false);
                expect(ftpHandler.elements.ftpServer.disabled).toBe(false);
            });
        });

        describe('Progress Indicators', () => {
            test('should update progress bar during download', () => {
                ftpHandler.updateProgressBar(50);
                const progressBar = ftpHandler.elements.downloadProgress.querySelector('.progress-bar');
                expect(progressBar.style.width).toBe('50%');
                expect(progressBar.textContent).toBe('50%');
            });

            test('should handle 100% progress', () => {
                ftpHandler.updateProgressBar(100);
                const progressBar = ftpHandler.elements.downloadProgress.querySelector('.progress-bar');
                expect(progressBar.style.width).toBe('100%');
                expect(progressBar.textContent).toBe('100%');
            });

            test('should handle invalid progress values', () => {
                ftpHandler.elements.downloadProgress = {
                    querySelector: jest.fn().mockReturnValue({
                        style: { width: '0%' },
                        textContent: '0%'
                    })
                };
                
                ftpHandler.updateProgressBar(-10);
                const progressBar = ftpHandler.elements.downloadProgress.querySelector('.progress-bar');
                expect(progressBar.style.width).toBe('0%');
                expect(progressBar.textContent).toBe('0%');

                ftpHandler.updateProgressBar(150);
                expect(progressBar.style.width).toBe('100%');
                expect(progressBar.textContent).toBe('100%');
            });
        });

        describe('File Selection', () => {
            test('should update download button state when files are selected', () => {
                ftpHandler.elements.downloadBtn = { disabled: true };
                ftpHandler.currentFiles = [{ name: 'file1.txt', isDirectory: false }];
                ftpHandler.selectedFiles = new Set(['file1.txt']);
                
                ftpHandler.updateDownloadButton();
                expect(ftpHandler.elements.downloadBtn.disabled).toBe(false);
            });

            test('should disable download button when no files are selected', () => {
                ftpHandler.selectedFiles = new Set();
                ftpHandler.updateDownloadButton();
                expect(ftpHandler.elements.downloadBtn.disabled).toBe(true);
            });

            test('should handle select all toggle', () => {
                ftpHandler.currentFiles = [
                    { name: 'file1.txt', isDirectory: false },
                    { name: 'file2.txt', isDirectory: false }
                ];
                ftpHandler.elements = {
                    ...ftpHandler.elements,
                    selectAll: { checked: false, indeterminate: false },
                    fileList: {
                        querySelectorAll: jest.fn().mockReturnValue([
                            { 
                                checked: false, 
                                dataset: { filename: 'file1.txt' },
                                getAttribute: (attr) => attr === 'data-filename' ? 'file1.txt' : null
                            },
                            { 
                                checked: false, 
                                dataset: { filename: 'file2.txt' },
                                getAttribute: (attr) => attr === 'data-filename' ? 'file2.txt' : null
                            }
                        ])
                    }
                };
                
                ftpHandler.toggleSelectAll(true);
                expect(ftpHandler.selectedFiles.size).toBe(2);
                
                ftpHandler.toggleSelectAll(false);
                expect(ftpHandler.selectedFiles.size).toBe(0);
            });
        });
    });
});
