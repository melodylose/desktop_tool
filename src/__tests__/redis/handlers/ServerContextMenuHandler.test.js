'use strict';

const ServerContextMenuHandler = require('../../../redis/handlers/ServerContextMenuHandler');

describe('ServerContextMenuHandler', () => {
    let container;
    let uiStateManager;
    let redisOperations;
    let handler;

    beforeEach(() => {
        // 重置所有 mock
        jest.clearAllMocks();

        // 建立測試用的容器
        container = document.createElement('div');
        container.id = 'container';
        document.body.appendChild(container);

        // Mock UIStateManager
        uiStateManager = {
            showNotification: jest.fn(),
            showDialog: jest.fn(),
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

        // 初始化處理器
        handler = new ServerContextMenuHandler(container, uiStateManager, redisOperations);
    });

    afterEach(() => {
        if (handler) {
            handler.destroy();
        }
        if (container) {
            container.remove();
        }
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(handler.container).toBe(container);
            expect(handler.uiStateManager).toBe(uiStateManager);
            expect(handler.redisOperations).toBe(redisOperations);
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

        it('should handle context menu event on server node', () => {
            const serverNode = document.createElement('div');
            serverNode.className = 'server-node';
            serverNode.setAttribute('data-connection-id', 'test-connection');
            container.appendChild(serverNode);

            const showForConnectionSpy = jest.spyOn(handler, 'showForConnection');
            
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 100,
                clientY: 100
            });

            serverNode.dispatchEvent(event);
            expect(showForConnectionSpy).toHaveBeenCalledWith('test-connection', 100, 100);
        });

        it('should not handle context menu event on non-server node', () => {
            const nonServerNode = document.createElement('div');
            container.appendChild(nonServerNode);

            const showForConnectionSpy = jest.spyOn(handler, 'showForConnection');
            
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true
            });

            nonServerNode.dispatchEvent(event);
            expect(showForConnectionSpy).not.toHaveBeenCalled();
        });

        it('should prevent default and stop propagation', () => {
            const serverNode = document.createElement('div');
            serverNode.className = 'server-node';
            serverNode.setAttribute('data-connection-id', 'test-connection');
            container.appendChild(serverNode);

            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true
            });

            Object.defineProperties(event, {
                preventDefault: { value: jest.fn() },
                stopPropagation: { value: jest.fn() }
            });

            serverNode.dispatchEvent(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(event.stopPropagation).toHaveBeenCalled();
        });
    });

    describe('showForConnection', () => {
        beforeEach(() => {
            handler.initialize();
        });

        it('should show menu for connection and update items visibility', () => {
            const connectionId = 'test-connection';
            redisOperations.connections.set(connectionId, { status: 'ready' });

            const updateMenuItemsVisibilitySpy = jest.spyOn(handler, '_updateMenuItemsVisibility');
            const showSpy = jest.spyOn(handler, 'show');

            handler.showForConnection(connectionId, 100, 100);

            expect(handler.currentConnectionId).toBe(connectionId);
            expect(updateMenuItemsVisibilitySpy).toHaveBeenCalled();
            expect(showSpy).toHaveBeenCalledWith(100, 100);
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

            expect(handler.menuItems.addKey.style.display).toBe('block');
            expect(handler.menuItems.refresh.style.display).toBe('block');
            expect(handler.menuItems.reconnect.style.display).toBe('none');
            expect(handler.menuItems.disconnect.style.display).toBe('block');
            expect(handler.menuItems.remove.style.display).toBe('block');
        });

        it('should show correct items for disconnected server', () => {
            redisOperations.connections.set('test-connection', { status: 'error' });
            handler._updateMenuItemsVisibility();

            expect(handler.menuItems.addKey.style.display).toBe('none');
            expect(handler.menuItems.refresh.style.display).toBe('none');
            expect(handler.menuItems.reconnect.style.display).toBe('block');
            expect(handler.menuItems.disconnect.style.display).toBe('none');
            expect(handler.menuItems.remove.style.display).toBe('block');
        });
    });

    describe('executeMenuFunction', () => {
        beforeEach(() => {
            handler.initialize();
            handler.currentConnectionId = 'test-connection';
        });

        it('should handle addKey action', async () => {
            redisOperations.connections.set('test-connection', { status: 'ready' });
            await handler.executeMenuFunction('addKey');
            expect(uiStateManager.showAddKeyModal).toHaveBeenCalledWith('test-connection');
        });

        it('should handle refresh action', async () => {
            redisOperations.connections.set('test-connection', { status: 'ready' });
            await handler.executeMenuFunction('refresh');
            expect(redisOperations.refreshKeys).toHaveBeenCalledWith('test-connection');
        });

        it('should handle reconnect action', async () => {
            await handler.executeMenuFunction('reconnect');
            expect(redisOperations.reconnectToServer).toHaveBeenCalledWith('test-connection');
        });

        it('should handle disconnect action', async () => {
            await handler.executeMenuFunction('disconnect');
            expect(redisOperations.disconnectFromServer).toHaveBeenCalledWith('test-connection');
        });

        it('should handle remove action with confirmation', async () => {
            uiStateManager.showConfirmDialog.mockResolvedValue(true);
            await handler.executeMenuFunction('remove');
            expect(redisOperations.removeServer).toHaveBeenCalledWith('test-connection');
        });

        it('should not remove server when confirmation is cancelled', async () => {
            uiStateManager.showConfirmDialog.mockResolvedValue(false);
            await handler.executeMenuFunction('remove');
            expect(redisOperations.removeServer).not.toHaveBeenCalled();
        });

        it('should handle unknown action', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            await handler.executeMenuFunction('unknown');
            
            expect(consoleSpy).toHaveBeenCalled();
            expect(uiStateManager.showNotification).toHaveBeenCalledWith(
                expect.stringContaining('Unknown action'),
                'error'
            );
        });

        it('should hide menu after successful action', async () => {
            redisOperations.connections.set('test-connection', { status: 'ready' });
            const hideSpy = jest.spyOn(handler, 'hide');
            
            await handler.executeMenuFunction('refresh');
            
            expect(hideSpy).toHaveBeenCalled();
        });
    });

    describe('destroy', () => {
        beforeEach(() => {
            handler.initialize();
        });

        it('should clean up event listeners', () => {
            const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
            
            handler.show(100, 100);
            handler.destroy();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler._handleGlobalClickBound, true);
            expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', handler._handleGlobalClickBound, true);
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
