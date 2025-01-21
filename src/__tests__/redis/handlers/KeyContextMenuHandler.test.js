'use strict';

const KeyContextMenuHandler = require('../../../redis/handlers/KeyContextMenuHandler');

describe('KeyContextMenuHandler', () => {
    let handler;
    let container;
    let mockUIStateManager;
    let mockRedisOperations;

    beforeEach(() => {
        mockUIStateManager = {
            showNotification: jest.fn(),
            showDialog: jest.fn().mockResolvedValue(true)
        };

        mockRedisOperations = {
            deleteKey: jest.fn().mockResolvedValue(undefined),
            copyKey: jest.fn().mockResolvedValue(undefined),
            renameKey: jest.fn().mockResolvedValue(undefined),
            setExpire: jest.fn().mockResolvedValue(undefined)
        };

        // 創建容器
        container = document.createElement('div');
        document.body.appendChild(container);

        // 初始化處理器
        handler = new KeyContextMenuHandler(container, mockUIStateManager, mockRedisOperations);
        handler.initialize();

        // 設置選單尺寸
        if (handler.menuElement) {
            handler.menuElement.style.width = '200px';
            handler.menuElement.style.height = '300px';
        }

        // 設置視窗尺寸
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    });

    afterEach(() => {
        if (handler) {
            handler.destroy();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        jest.clearAllMocks();
    });

    describe('menu display', () => {
        it('should show menu at specified position', () => {
            const key = 'test-key';
            const connectionId = 'test-connection';

            handler.showForKey(key, connectionId, 100, 100);

            expect(handler.menuElement.style.display).toBe('block');
            expect(handler.menuElement.style.left).toBe('100px');
            expect(handler.menuElement.style.top).toBe('100px');
        });

        it('should adjust menu position when it would overflow window', () => {
            const key = 'test-key';
            const connectionId = 'test-connection';

            handler.showForKey(key, connectionId, 900, 500);

            expect(handler.menuElement.style.display).toBe('block');
            expect(parseInt(handler.menuElement.style.left)).toBeLessThanOrEqual(window.innerWidth - 200);
            expect(parseInt(handler.menuElement.style.top)).toBeLessThanOrEqual(window.innerHeight - 300);
        });

        it('should hide menu when clicking outside', () => {
            const key = 'test-key';
            const connectionId = 'test-connection';

            // 先顯示選單
            handler.showForKey(key, connectionId, 100, 100);
            expect(handler.menuElement.style.display).toBe('block');

            // 點擊外部
            const outsideElement = document.createElement('div');
            document.body.appendChild(outsideElement);

            const event = new window.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });

            // 手動設置 target
            Object.defineProperty(event, 'target', {
                value: outsideElement,
                enumerable: true
            });

            document.dispatchEvent(event);
            document.body.removeChild(outsideElement);

            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should not hide menu when clicking inside', () => {
            const key = 'test-key';
            const connectionId = 'test-connection';

            // 先顯示選單
            handler.showForKey(key, connectionId, 100, 100);
            expect(handler.menuElement.style.display).toBe('block');

            // 點擊選單內部
            const event = new window.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });

            // 手動設置 target
            Object.defineProperty(event, 'target', {
                value: handler.menuElement,
                enumerable: true
            });

            handler.menuElement.dispatchEvent(event);

            expect(handler.menuElement.style.display).toBe('block');
        });
    });

    describe('menu actions', () => {
        beforeEach(() => {
            // 先設置當前的 key 和 connectionId
            handler.showForKey('test-key', 'test-connection', 100, 100);
            
            // 確保這些值被正確設置
            expect(handler.currentKey).toBe('test-key');
            expect(handler.currentConnectionId).toBe('test-connection');
            expect(handler.menuElement.style.display).toBe('block');
        });

        it('should handle delete action', async () => {
            await handler.executeMenuFunction('delete');
            expect(mockRedisOperations.deleteKey).toHaveBeenCalledWith('test-key', 'test-connection');
            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should handle copy action', async () => {
            await handler.executeMenuFunction('copy');
            expect(mockRedisOperations.copyKey).toHaveBeenCalledWith('test-key', 'test-connection');
            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should handle rename action', async () => {
            mockUIStateManager.showDialog.mockResolvedValueOnce('new-key');
            await handler.executeMenuFunction('rename');
            expect(mockRedisOperations.renameKey).toHaveBeenCalledWith('test-key', 'new-key', 'test-connection');
            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should handle ttl action', async () => {
            mockUIStateManager.showDialog.mockResolvedValueOnce('3600');
            await handler.executeMenuFunction('ttl');
            expect(mockRedisOperations.setExpire).toHaveBeenCalledWith('test-key', 3600, 'test-connection');
            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should handle unknown action', async () => {
            await handler.executeMenuFunction('unknown');
            expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('Unknown action'),
                'error'
            );
            expect(handler.menuElement.style.display).toBe('none');
        });
    });
});
