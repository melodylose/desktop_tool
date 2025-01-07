const FtpFileListHandler = require('../../ftp/FtpFileListHandler');

describe('FtpFileListHandler', () => {
    let ftpFileListHandler;
    let mockFtpClient;
    let mockUiHandler;
    let mockFileOperations;
    let mockFileList;
    let mockSelectAll;
    let mockFiles;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create DOM elements using jsdom
        mockFileList = document.createElement('div');
        mockSelectAll = document.createElement('input');
        mockSelectAll.type = 'checkbox';
        
        mockFiles = [
            { name: 'test1.txt', isDirectory: false, size: 100, modifiedAt: new Date() },
            { name: 'test2.txt', isDirectory: false, size: 200, modifiedAt: new Date() }
        ];

        mockFtpClient = {
            getCurrentPath: jest.fn().mockReturnValue('/test'),
            getCurrentFiles: jest.fn().mockReturnValue(mockFiles),
            navigateToDirectory: jest.fn(),
            navigateToParent: jest.fn(),
            listDirectory: jest.fn()
        };

        mockFileOperations = {
            formatFileSize: jest.fn(size => size ? `${size} B` : '-')
        };

        mockUiHandler = {
            getElements: jest.fn().mockReturnValue({
                fileList: mockFileList,
                selectAll: mockSelectAll,
                selectAllCheckbox: mockSelectAll
            }),
            updateDownloadButton: jest.fn()
        };

        ftpFileListHandler = new FtpFileListHandler(mockFtpClient, mockUiHandler, mockFileOperations);
    });

    describe('displayFileList', () => {
        it('should display files and directories correctly', () => {
            ftpFileListHandler.displayFileList(mockFiles);
            // 檢查是否添加了正確數量的文件行（包括返回上一級的行）
            expect(mockFileList.children.length).toBe(mockFiles.length + 1);
            expect(mockUiHandler.updateDownloadButton).toHaveBeenCalledWith(false);
        });

        it('should add back row when not in root directory', () => {
            mockFtpClient.getCurrentPath.mockReturnValue('/test');
            ftpFileListHandler.displayFileList(mockFiles);
            expect(mockFileList.children.length).toBeGreaterThan(0);
            const backRow = mockFileList.children[0];
            expect(backRow.querySelector('.directory-link')).toBeTruthy();
        });
    });

    describe('createBackRow', () => {
        it('should create back row with correct structure', () => {
            const backRow = ftpFileListHandler.createBackRow();
            const dirCell = backRow.querySelector('.directory-link');
            expect(dirCell).toBeTruthy();
            expect(dirCell.style.cursor).toBe('pointer');
            expect(backRow.querySelector('i.fa-level-up-alt')).toBeTruthy();
        });
    });

    describe('createFileRow', () => {
        it('should create file row with correct structure', () => {
            const file = { name: 'test.txt', isDirectory: false, size: 100, modifiedAt: new Date() };
            const row = ftpFileListHandler.createFileRow(file);
            const checkbox = row.querySelector('input[type="checkbox"]');
            expect(checkbox).toBeTruthy();
            expect(checkbox.type).toBe('checkbox');
            expect(checkbox.dataset.filename).toBe('test.txt');
        });

        it('should create directory row with correct structure', () => {
            const dir = { name: 'testdir', isDirectory: true, size: 0, modifiedAt: new Date() };
            const row = ftpFileListHandler.createFileRow(dir);
            const dirCell = row.querySelector('.directory-link');
            expect(dirCell).toBeTruthy();
            expect(dirCell.style.cursor).toBe('pointer');
            expect(row.querySelector('i.fa-folder')).toBeTruthy();
        });
    });

    describe('navigateToDirectory', () => {
        it('should navigate to subdirectory', async () => {
            await ftpFileListHandler.navigateToDirectory('testdir');
            expect(mockFtpClient.listDirectory).toHaveBeenCalledWith('/test/testdir');
        });

        it('should handle nested directories', async () => {
            mockFtpClient.getCurrentPath.mockReturnValue('/test/dir1');
            await ftpFileListHandler.navigateToDirectory('dir2');
            expect(mockFtpClient.listDirectory).toHaveBeenCalledWith('/test/dir1/dir2');
        });
    });

    describe('navigateToParent', () => {
        it('should navigate to parent directory', async () => {
            mockFtpClient.getCurrentPath.mockReturnValue('/test/dir');
            await ftpFileListHandler.navigateToParent();
            expect(mockFtpClient.listDirectory).toHaveBeenCalledWith('/test');
        });

        it('should not navigate up from root directory', async () => {
            mockFtpClient.getCurrentPath.mockReturnValue('/');
            await ftpFileListHandler.navigateToParent();
            expect(mockFtpClient.listDirectory).not.toHaveBeenCalled();
        });
    });

    describe('handleRowSelection', () => {
        it('should handle file selection', () => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.dataset.filename = 'test.txt';

            mockFtpClient.getCurrentFiles.mockReturnValue([
                { name: 'test.txt', isDirectory: false }
            ]);

            ftpFileListHandler.handleRowSelection(checkbox, 'test.txt');
            expect(ftpFileListHandler.selectedFiles.has('test.txt')).toBe(true);
            expect(mockUiHandler.updateDownloadButton).toHaveBeenCalledWith(true);
        });

        it('should handle file deselection', () => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = false;
            checkbox.dataset.filename = 'test.txt';

            mockFtpClient.getCurrentFiles.mockReturnValue([
                { name: 'test.txt', isDirectory: false }
            ]);

            ftpFileListHandler.selectedFiles = new Set(['test.txt']);
            ftpFileListHandler.handleRowSelection(checkbox, 'test.txt');
            expect(ftpFileListHandler.selectedFiles.has('test.txt')).toBe(false);
            expect(mockUiHandler.updateDownloadButton).toHaveBeenCalledWith(false);
        });
    });

    describe('toggleSelectAll', () => {
        beforeEach(() => {
            // 創建測試文件列表
            ftpFileListHandler.displayFileList(mockFiles);
        });

        it('should select all files', () => {
            ftpFileListHandler.toggleSelectAll(true);
            const checkboxes = mockFileList.querySelectorAll('input[type="checkbox"]:not([disabled])');
            checkboxes.forEach(checkbox => {
                expect(checkbox.checked).toBe(true);
            });
            expect(ftpFileListHandler.selectedFiles.size).toBe(mockFiles.length);
            expect(mockUiHandler.updateDownloadButton).toHaveBeenCalledWith(true);
        });

        it('should deselect all files', () => {
            // 先選中所有文件
            ftpFileListHandler.toggleSelectAll(true);
            // 然後取消選中
            ftpFileListHandler.toggleSelectAll(false);
            const checkboxes = mockFileList.querySelectorAll('input[type="checkbox"]:not([disabled])');
            checkboxes.forEach(checkbox => {
                expect(checkbox.checked).toBe(false);
            });
            expect(ftpFileListHandler.selectedFiles.size).toBe(0);
            expect(mockUiHandler.updateDownloadButton).toHaveBeenCalledWith(false);
        });
    });

    describe('sortFileList', () => {
        it('should sort files by date ascending', () => {
            const date1 = new Date('2023-01-01');
            const date2 = new Date('2023-02-01');
            const mockFiles = [
                { name: 'test2.txt', isDirectory: false, size: 200, modifiedAt: date2 },
                { name: 'test1.txt', isDirectory: false, size: 100, modifiedAt: date1 }
            ];
            mockFtpClient.getCurrentFiles.mockReturnValue(mockFiles);

            const event = {
                target: {
                    classList: {
                        contains: jest.fn().mockReturnValue(false),
                        toggle: jest.fn()
                    }
                }
            };

            ftpFileListHandler.sortFileList(event);
            expect(mockFiles[0].name).toBe('test1.txt');
            expect(mockFiles[1].name).toBe('test2.txt');
        });

        it('should sort files by date descending', () => {
            const date1 = new Date('2023-01-01');
            const date2 = new Date('2023-02-01');
            const mockFiles = [
                { name: 'test1.txt', isDirectory: false, size: 100, modifiedAt: date1 },
                { name: 'test2.txt', isDirectory: false, size: 200, modifiedAt: date2 }
            ];
            mockFtpClient.getCurrentFiles.mockReturnValue(mockFiles);

            const event = {
                target: {
                    classList: {
                        contains: jest.fn().mockReturnValue(true),
                        toggle: jest.fn()
                    }
                }
            };

            ftpFileListHandler.sortFileList(event);
            expect(mockFiles[0].name).toBe('test2.txt');
            expect(mockFiles[1].name).toBe('test1.txt');
        });
    });
});
