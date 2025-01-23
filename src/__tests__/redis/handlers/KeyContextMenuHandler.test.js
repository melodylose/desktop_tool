const KeyContextMenuHandler = require('../../../redis/handlers/KeyContextMenuHandler');
const RedisUIHandler = require('../../../redis/RedisUIHandler');
const RedisOperations = require('../../../redis/RedisOperations');
const DialogManager = require('../../../redis/dialogs/DialogManager');
const UIStateManager = require('../../../redis/UIStateManager');

jest.mock('../../../redis/RedisUIHandler');
jest.mock('../../../redis/RedisOperations');
jest.mock('../../../redis/dialogs/DialogManager');
jest.mock('../../../redis/UIStateManager');

describe('KeyContextMenuHandler', () => {
    let handler;
    let mockRedisUIHandler;
    let mockRedisOperations;
    let mockDialogManager;
    let mockUIStateManager;

    beforeEach(() => {
        // 設置 document body
        document.body.innerHTML = `
            <div id="redisTree"></div>
            <div id="contextMenu"></div>
        `;

        // 建立 mock 物件
        mockUIStateManager = {
            showNotification: jest.fn()
        };

        mockRedisUIHandler = {
            elements: {
                redisTree: document.getElementById('redisTree')
            },
            uiStateManager: mockUIStateManager
        };

        mockRedisOperations = {
            connections: new Map(),
            deleteKey: jest.fn(),
            setExpire: jest.fn()
        };

        mockDialogManager = {
            showDeleteConfirmDialog: jest.fn(),
            showTTLDialog: jest.fn()
        };

        DialogManager.mockImplementation(() => mockDialogManager);

        handler = new KeyContextMenuHandler(mockRedisUIHandler, mockRedisOperations);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('Menu initialization', () => {
        it('should initialize menu element', () => {
            handler.initialize();
            expect(handler.menuElement).toBeTruthy();
            expect(handler.menuElement.classList.contains('context-menu')).toBe(true);
        });
    });

    describe('Context menu display', () => {
        beforeEach(() => {
            handler.initialize();
        });

        it('should show context menu for valid key', () => {
            handler.showForKey('test-key', 'test-connection', 100, 200);
            expect(handler.currentKey).toBe('test-key');
            expect(handler.currentConnectionId).toBe('test-connection');
            expect(handler.menuElement.style.display).toBe('block');
        });

        it('should not show context menu without key or connection', () => {
            // 先初始化選單元素並設置初始值
            handler.initialize();
            handler.currentKey = 'initial-key';
            handler.currentConnectionId = 'initial-connection';

            // 測試無效的 key，應該保持原有的 connectionId
            handler.showForKey(null, 'test-connection', 100, 200);
            expect(handler.currentKey).toBe('initial-key');
            expect(handler.currentConnectionId).toBe('initial-connection');

            // 測試無效的 connection，應該保持原有的 key
            handler.showForKey('test-key', null, 100, 200);
            expect(handler.currentKey).toBe('initial-key');
            expect(handler.currentConnectionId).toBe('initial-connection');
        });
    });

    describe('Menu actions', () => {
        beforeEach(() => {
            handler.currentKey = 'test-key';
            handler.currentConnectionId = 'test-connection';
            handler.menuElement = document.createElement('div');
            handler.menuElement.style.display = 'block';
            document.body.appendChild(handler.menuElement);
        });

        afterEach(() => {
            if (handler.menuElement && handler.menuElement.parentNode) {
                handler.menuElement.parentNode.removeChild(handler.menuElement);
            }
            jest.clearAllMocks();
        });

        describe('TTL handling', () => {
            it('should handle TTL setting successfully', async () => {
                const mockTTL = '3600';
                mockDialogManager.showTTLDialog.mockResolvedValueOnce(mockTTL);
                mockRedisOperations.setExpire.mockResolvedValueOnce(true);

                await handler.executeMenuFunction('ttl');

                expect(mockDialogManager.showTTLDialog).toHaveBeenCalledWith('test-key');
                expect(mockRedisOperations.setExpire).toHaveBeenCalledWith(
                    'test-key',
                    3600,
                    'test-connection'
                );
                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    '成功設定 test-key 的過期時間為 3600 秒',
                    'success'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle TTL cancellation', async () => {
                mockDialogManager.showTTLDialog.mockResolvedValueOnce(null);

                await handler.executeMenuFunction('ttl');

                expect(mockDialogManager.showTTLDialog).toHaveBeenCalledWith('test-key');
                expect(mockRedisOperations.setExpire).not.toHaveBeenCalled();
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle TTL error', async () => {
                const mockTTL = '3600';
                mockDialogManager.showTTLDialog.mockResolvedValueOnce(mockTTL);
                mockRedisOperations.setExpire.mockResolvedValueOnce(false);

                await handler.executeMenuFunction('ttl');

                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    '設定過期時間失敗',
                    'error'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle TTL operation error', async () => {
                const mockTTL = '3600';
                const error = new Error('Redis 錯誤');
                mockDialogManager.showTTLDialog.mockResolvedValueOnce(mockTTL);
                mockRedisOperations.setExpire.mockRejectedValueOnce(error);

                await handler.executeMenuFunction('ttl');

                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    'Redis 錯誤',
                    'error'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });
        });

        describe('Delete handling', () => {
            it('should handle delete successfully', async () => {
                const connection = { client: {} };
                mockRedisOperations.connections.set('test-connection', connection);
                mockDialogManager.showDeleteConfirmDialog.mockResolvedValueOnce(true);
                mockRedisOperations.deleteKey.mockResolvedValueOnce({ success: true });

                await handler.executeMenuFunction('delete');

                expect(mockDialogManager.showDeleteConfirmDialog).toHaveBeenCalledWith('test-key');
                expect(mockRedisOperations.deleteKey).toHaveBeenCalledWith(
                    connection.client,
                    'test-key'
                );
                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    '成功刪除 test-key',
                    'success'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle delete cancellation', async () => {
                mockDialogManager.showDeleteConfirmDialog.mockResolvedValueOnce(false);

                await handler.executeMenuFunction('delete');

                expect(mockDialogManager.showDeleteConfirmDialog).toHaveBeenCalledWith('test-key');
                expect(mockRedisOperations.deleteKey).not.toHaveBeenCalled();
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle delete error', async () => {
                const connection = { client: {} };
                mockRedisOperations.connections.set('test-connection', connection);
                mockDialogManager.showDeleteConfirmDialog.mockResolvedValueOnce(true);
                mockRedisOperations.deleteKey.mockResolvedValueOnce({ success: false });

                await handler.executeMenuFunction('delete');

                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    '刪除失敗',
                    'error'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle delete operation error', async () => {
                const connection = { client: {} };
                mockRedisOperations.connections.set('test-connection', connection);
                mockDialogManager.showDeleteConfirmDialog.mockResolvedValueOnce(true);
                mockRedisOperations.deleteKey.mockRejectedValueOnce(new Error('Redis 錯誤'));

                await handler.executeMenuFunction('delete');

                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    'Redis 錯誤',
                    'error'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });

            it('should handle server not connected error', async () => {
                mockDialogManager.showDeleteConfirmDialog.mockResolvedValueOnce(true);

                await handler.executeMenuFunction('delete');

                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    '伺服器未連線',
                    'error'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });
        });

        describe('Unknown action handling', () => {
            it('should handle unknown action', async () => {
                await handler.executeMenuFunction('unknown');

                expect(mockUIStateManager.showNotification).toHaveBeenCalledWith(
                    '未知的動作',
                    'error'
                );
                expect(handler.menuElement.style.display).toBe('none');
            });
        });
    });

    describe('Resource cleanup', () => {
        it('should clean up resources on destroy', () => {
            handler.menuElement = document.createElement('div');
            document.body.appendChild(handler.menuElement);
            
            handler.destroy();
            
            expect(handler.menuElement).toBeNull();
            expect(document.querySelector('.context-menu')).toBeNull();
        });
    });
});
