const FtpHistoryManager = require('../../ftp/FtpHistoryManager');

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

describe('FtpHistoryManager', () => {
    let historyManager;
    let mockUiHandler;

    beforeEach(() => {
        // Mock UI handler
        mockUiHandler = {
            getElements: jest.fn().mockReturnValue({
                ftpHistory: {
                    innerHTML: '',
                    appendChild: jest.fn()
                }
            })
        };

        historyManager = new FtpHistoryManager(mockUiHandler);
        
        // Clear mock calls
        mockLocalStorage.getItem.mockClear();
        mockLocalStorage.setItem.mockClear();
    });

    describe('loadFtpHistory', () => {
        it('should load history from localStorage', () => {
            const mockHistory = ['ftp://server1.com', 'ftp://server2.com'];
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockHistory));

            historyManager.loadFtpHistory();

            expect(historyManager.ftpHistory).toEqual(mockHistory);
        });

        it('should handle empty or invalid localStorage data', () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            historyManager.loadFtpHistory();

            expect(historyManager.ftpHistory).toEqual([]);
        });

        it('should handle JSON parse error', () => {
            mockLocalStorage.getItem.mockReturnValue('invalid json');

            historyManager.loadFtpHistory();

            expect(historyManager.ftpHistory).toEqual([]);
        });
    });

    describe('saveFtpHistory', () => {
        it('should save history to localStorage', () => {
            historyManager.ftpHistory = ['ftp://server1.com'];
            historyManager.saveFtpHistory();

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
                'ftpServerHistory',
                JSON.stringify(['ftp://server1.com'])
            );
        });

        it('should handle localStorage errors', () => {
            mockLocalStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });

            // Should not throw error
            expect(() => historyManager.saveFtpHistory()).not.toThrow();
        });
    });

    describe('updateFtpHistoryDisplay', () => {
        it('should update history dropdown with current history items', () => {
            historyManager.ftpHistory = ['ftp://server1.com', 'ftp://server2.com'];
            const mockFtpHistory = mockUiHandler.getElements().ftpHistory;

            historyManager.updateFtpHistoryDisplay();

            expect(mockFtpHistory.innerHTML).toBe('');
            expect(mockFtpHistory.appendChild).toHaveBeenCalledTimes(2);
        });

        it('should handle missing ftpHistory element', () => {
            mockUiHandler.getElements.mockReturnValue({});

            // Should not throw error
            expect(() => historyManager.updateFtpHistoryDisplay()).not.toThrow();
        });
    });

    describe('addToFtpHistory', () => {
        it('should add new URL to history', () => {
            const newUrl = 'ftp://newserver.com';
            historyManager.ftpHistory = ['ftp://server1.com'];

            historyManager.addToFtpHistory(newUrl);

            expect(historyManager.ftpHistory[0]).toBe(newUrl);
            expect(mockLocalStorage.setItem).toHaveBeenCalled();
        });

        it('should remove duplicate URLs', () => {
            const url = 'ftp://server1.com';
            historyManager.ftpHistory = [url, 'ftp://server2.com'];

            historyManager.addToFtpHistory(url);

            expect(historyManager.ftpHistory).toHaveLength(2);
            expect(historyManager.ftpHistory[0]).toBe(url);
        });

        it('should limit history size', () => {
            historyManager.maxHistoryItems = 2;
            historyManager.ftpHistory = ['ftp://old.com'];

            historyManager.addToFtpHistory('ftp://new1.com');
            historyManager.addToFtpHistory('ftp://new2.com');

            expect(historyManager.ftpHistory).toHaveLength(2);
            expect(historyManager.ftpHistory[0]).toBe('ftp://new2.com');
            expect(historyManager.ftpHistory[1]).toBe('ftp://new1.com');
        });

        it('should ignore empty URLs', () => {
            historyManager.ftpHistory = ['ftp://server1.com'];

            historyManager.addToFtpHistory('');

            expect(historyManager.ftpHistory).toEqual(['ftp://server1.com']);
            expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
        });
    });
});
