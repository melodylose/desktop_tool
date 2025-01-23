'use strict';

const ServerContextMenuHandler = require('../../../redis/handlers/ServerContextMenuHandler');

describe('ServerContextMenuHandler', () => {
    let redisUIHandler;
    let redisOperations;
    let handler;
    let uiStateManager;

    beforeEach(() => {
        // 重置所有 mock
        jest.clearAllMocks();

        // Mock UIStateManager
        uiStateManager = {
            showNotification: jest.fn(),
            showAddKeyModal: jest.fn(),
            showConfirmDialog: jest.fn()
        };

        // Mock RedisOperations
        redisOperations = {
            connections: new Map(),
            refreshKeys: jest.fn(),
            reconnectToServer: jest.fn(),
            disconnectFromServer: jest.fn(),
            removeServer: jest.fn()
        };

        // Mock RedisUIHandler
        redisUIHandler = {
            elements: {
                redisTree: document.createElement('div')
            },
            uiStateManager: uiStateManager,
            refreshKeys: jest.fn(),
            showAddKeyModal: jest.fn(),
            handleReconnect: jest.fn(),
            disconnect: jest.fn(),
            connectionManager: {
                removeServer: jest.fn()
            },
            dialogManager: {
                showServerDeleteConfirmDialog: jest.fn()
            }
        };

        // 初始化處理器
        handler = new ServerContextMenuHandler(redisUIHandler, redisOperations);
    });

    afterEach(() => {
        if (handler) {
            handler.destroy();
        }
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(handler.redisUIHandler).toBe(redisUIHandler);
            expect(handler.redisOperations).toBe(redisOperations);
            expect(handler.uiStateManager).toBe(uiStateManager);
            expect(handler.currentConnectionId).toBeNull();
            expect(handler.menuItems).toBeDefined();
        });
    });

    describe('_createMenuElement', () => {
        it('should create menu with all required items', () => {
            const menu = handler._createMenuElement();
            
            expect(menu.id).toBe('serverContextMenu');
            expect(menu.className).toBe('context-menu');
            
            // 檢查所有必要的選單項目
            expect(handler.menuItems.addKey).toBeDefined();
            expect(handler.menuItems.refresh).toBeDefined();
            expect(handler.menuItems.reconnect).toBeDefined();
            expect(handler.menuItems.disconnect).toBeDefined();
            expect(handler.menuItems.remove).toBeDefined();
        });

        it('should create menu items with correct structure', () => {
            handler._createMenuElement();
            
            Object.values(handler.menuItems).forEach(item => {
                expect(item.className).toBe('menu-item');
                expect(item.querySelector('i')).toBeDefined();
                expect(item.querySelector('span')).toBeDefined();
            });
        });
    });

    describe('_handleContextMenu', () => {
        beforeEach(() => {
            handler.initialize();
        });

        it('should show menu for server node', () => {
            const serverNode = document.createElement('div');
            serverNode.setAttribute('data-connection-id', 'test-connection');
            handler.container.appendChild(serverNode);

            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 100,
                clientY: 200
            });

            const showForServerSpy = jest.spyOn(handler, 'showForServer');
            
            handler.handleContextMenuEvent(event, serverNode);

            expect(showForServerSpy).toHaveBeenCalledWith('test-connection', 100, 200);
            expect(handler.currentConnectionId).toBe('test-connection');
        });
    });

    describe('show', () => {
        beforeEach(() => {
            handler.initialize();
        });

        it('should show menu at specified position', () => {
            const x = 100;
            const y = 200;

            handler.show(x, y);

            expect(handler.menuElement.style.left).toBe(x + 'px');
            expect(handler.menuElement.style.top).toBe(y + 'px');
        });
    });

    describe('_updateMenuItemsVisibility', () => {
        beforeEach(() => {
            handler.initialize();
            handler.currentConnectionId = 'test-connection';
        });

        it('should show correct items for connected server', () => {
            redisOperations.connections.set('test-connection', { status: 'ready' });
            handler._updateMenuItemsVisibility();

            expect(handler.menuItems.addKey.style.display).toBe('flex');
            expect(handler.menuItems.refresh.style.display).toBe('flex');
            expect(handler.menuItems.reconnect.style.display).toBe('none');
            expect(handler.menuItems.disconnect.style.display).toBe('flex');
            expect(handler.menuItems.remove.style.display).toBe('none');
        });

        it('should show correct items for disconnected server', () => {
            redisOperations.connections.set('test-connection', { status: 'error' });
            handler._updateMenuItemsVisibility();

            expect(handler.menuItems.addKey.style.display).toBe('none');
            expect(handler.menuItems.refresh.style.display).toBe('none');
            expect(handler.menuItems.reconnect.style.display).toBe('flex');
            expect(handler.menuItems.disconnect.style.display).toBe('none');
            expect(handler.menuItems.remove.style.display).toBe('flex');
        });
    });

    describe('executeMenuFunction', () => {
        let warnSpy;

        beforeEach(() => {
            handler.initialize();
            handler.currentConnectionId = 'test-connection';
            warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            warnSpy.mockRestore();
        });

        it('should handle addKey action', async () => {
            // 設置連線狀態為已連線
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'ready' });
            
            await handler.executeMenuFunction('addKey');
            expect(redisUIHandler.showAddKeyModal).toHaveBeenCalled();
        });

        it('should handle refresh action', async () => {
            redisOperations.connections.set('test-connection', { status: 'ready' });
            await handler.executeMenuFunction('refresh');
            expect(redisUIHandler.refreshKeys).toHaveBeenCalledTimes(1);
        });

        it('should handle reconnect action', async () => {
            // 設置連線狀態為未連線
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'closed' });

            await handler.executeMenuFunction('reconnect');
            expect(redisUIHandler.handleReconnect).toHaveBeenCalledWith('test-connection');
        });

        it('should handle disconnect action', async () => {
            // 設置連線狀態為已連線
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'ready' });

            await handler.executeMenuFunction('disconnect');
            expect(redisUIHandler.disconnect).toHaveBeenCalledWith('test-connection');
        });

        it('should handle remove action with confirmation', async () => {
            // 設置連線狀態為未連線
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'closed' });
            
            redisUIHandler.dialogManager.showServerDeleteConfirmDialog.mockResolvedValue(true);
            await handler.executeMenuFunction('remove');
            expect(redisUIHandler.connectionManager.removeServer).toHaveBeenCalledWith('test-connection');
        });

        it('should not remove server when confirmation is cancelled', async () => {
            // 設置連線狀態為未連線
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'closed' });
            
            redisUIHandler.dialogManager.showServerDeleteConfirmDialog.mockResolvedValue(false);
            await handler.executeMenuFunction('remove');
            expect(redisUIHandler.connectionManager.removeServer).not.toHaveBeenCalled();
        });

        it('should not remove server when it is still connected', async () => {
            // 設置連線狀態為已連線
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'ready' });
            
            await handler.executeMenuFunction('remove');
            expect(redisUIHandler.connectionManager.removeServer).not.toHaveBeenCalled();
            // 應該顯示警告訊息
            expect(warnSpy).toHaveBeenCalledWith(
                'ServerContextMenuHandler: Cannot remove connected server. Please disconnect first.'
            );
        });

        it('should handle unknown action', async () => {
            await handler.executeMenuFunction('unknown');
            
            expect(warnSpy).toHaveBeenCalledWith(
                'ServerContextMenuHandler: Unknown menu action:',
                'unknown'
            );
        });

        it('should execute refresh action successfully', async () => {
            // 設置當前連線 ID
            handler.currentConnectionId = 'test-connection';
            redisOperations.connections.set('test-connection', { status: 'ready' });
            
            // 監聽 refreshKeys 方法
            const refreshKeysSpy = jest.spyOn(redisUIHandler, 'refreshKeys');
            
            await handler.executeMenuFunction('refresh');
            
            // 驗證 refreshKeys 被調用
            expect(refreshKeysSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('destroy', () => {
        beforeEach(() => {
            handler.initialize();
        });

        it('should clean up event listeners', () => {
            const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
            
            handler.show(100, 100);
            handler.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler._handleGlobalClickBound);
            // contextmenu 事件不應該被移除，因為它從未被添加
            expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
        });

        it('should handle being called multiple times', () => {
            expect(() => {
                handler.destroy();
                handler.destroy();
            }).not.toThrow();
        });

        it('should clean up menu items', () => {
            const menuItem = handler.menuItems.addKey;
            const parent = menuItem.parentNode;
            const replaceChildSpy = jest.spyOn(parent, 'replaceChild');

            handler.destroy();

            expect(replaceChildSpy).toHaveBeenCalled();
        });
    });
});
