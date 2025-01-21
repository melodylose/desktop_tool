'use strict';

const BaseContextMenuHandler = require('../../../redis/handlers/BaseContextMenuHandler');

// 建立一個具體的 TestContextMenuHandler 類別
class TestContextMenuHandler extends BaseContextMenuHandler {
    _createMenuElement() {
        const menu = document.createElement('div');
        menu.id = 'testContextMenu';
        menu.className = 'context-menu';
        return menu;
    }

    _setupEventListeners() {
        // 測試用的空實現
    }
}

describe('BaseContextMenuHandler', () => {
    let container;
    let uiStateManager;
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
            showNotification: jest.fn()
        };

        // Mock window dimensions
        Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });

        // 建立測試用的處理器
        handler = new (class extends BaseContextMenuHandler {
            _createMenuElement() {
                const menu = document.createElement('div');
                menu.id = 'testMenu';
                menu.style.width = '200px';
                menu.style.height = '300px';
                return menu;
            }
            _setupEventListeners() {}
        })(container, uiStateManager);
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
            expect(handler.menuElement).toBeNull();
            expect(handler._handleGlobalClickBound).toBeDefined();
        });
    });

    describe('initialize', () => {
        it('should create menu element and append to container', () => {
            handler.initialize();
            expect(handler.menuElement).toBeDefined();
            expect(handler.menuElement.id).toBe('testMenu');
            expect(container.contains(handler.menuElement)).toBe(true);
        });

        it('should not create menu element if already initialized', () => {
            handler.initialize();
            const menuElement = handler.menuElement;
            handler.initialize();
            expect(handler.menuElement).toBe(menuElement);
        });
    });

    describe('show', () => {
        it('should not show menu if not initialized', () => {
            const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
            handler.show(100, 100);
            expect(addEventListenerSpy).not.toHaveBeenCalled();
        });

        it('should show menu at specified position', () => {
            handler.initialize();
            handler.show(100, 100);
            expect(handler.menuElement.style.display).toBe('block');
            expect(handler.menuElement.style.left).toBe('100px');
            expect(handler.menuElement.style.top).toBe('100px');
        });

        it('should add global event listeners', () => {
            handler.initialize();
            const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
            
            handler.show(100, 100);

            expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler._handleGlobalClickBound, true);
            expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', handler._handleGlobalClickBound, true);
        });
    });

    describe('hide', () => {
        it('should not throw if not initialized', () => {
            expect(() => handler.hide()).not.toThrow();
        });

        it('should hide menu and remove event listeners', () => {
            handler.initialize();
            const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
            
            handler.show(100, 100);
            handler.hide();

            expect(handler.menuElement.style.display).toBe('none');
            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler._handleGlobalClickBound, true);
            expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', handler._handleGlobalClickBound, true);
        });
    });

    describe('_adjustMenuPosition', () => {
        it('should return original coordinates if not initialized', () => {
            const { x, y } = handler._adjustMenuPosition(100, 100);
            expect(x).toBe(100);
            expect(y).toBe(100);
        });

        it('should adjust x coordinate when menu would overflow right', () => {
            handler.initialize();
            const { x, y } = handler._adjustMenuPosition(900, 100);
            expect(x).toBe(824); // 1024 - 200
            expect(y).toBe(100);
        });

        it('should adjust y coordinate when menu would overflow bottom', () => {
            handler.initialize();
            const { x, y } = handler._adjustMenuPosition(100, 500);
            expect(x).toBe(100);
            expect(y).toBe(468); // 768 - 300
        });

        it('should prevent negative coordinates', () => {
            handler.initialize();
            const { x, y } = handler._adjustMenuPosition(-50, -50);
            expect(x).toBe(0);
            expect(y).toBe(0);
        });

        it('should handle both x and y overflow', () => {
            handler.initialize();
            const { x, y } = handler._adjustMenuPosition(900, 500);
            expect(x).toBe(824); // 1024 - 200
            expect(y).toBe(468); // 768 - 300
        });
    });

    describe('_handleGlobalClick', () => {
        it('should not throw if not initialized', () => {
            const event = new MouseEvent('click');
            expect(() => handler._handleGlobalClick(event)).not.toThrow();
        });

        it('should not hide menu if already hidden', () => {
            handler.initialize();
            handler.menuElement.style.display = 'none';
            const event = new MouseEvent('click');
            handler._handleGlobalClick(event);
            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should hide menu when clicking outside', () => {
            handler.initialize();
            handler.show(100, 100);

            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true
            });

            document.body.dispatchEvent(event);
            expect(handler.menuElement.style.display).toBe('none');
        });

        it('should not hide menu when clicking inside', () => {
            handler.initialize();
            handler.show(100, 100);

            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true
            });

            handler.menuElement.dispatchEvent(event);
            expect(handler.menuElement.style.display).toBe('block');
        });

        it('should stop event propagation when clicking outside', () => {
            handler.initialize();
            handler.show(100, 100);

            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true
            });
            const stopPropagationSpy = jest.spyOn(event, 'stopPropagation');

            document.body.dispatchEvent(event);
            expect(stopPropagationSpy).toHaveBeenCalled();
        });
    });

    describe('_handleError', () => {
        it('should log error and show notification', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const error = new Error('Test error');
            
            handler._handleError(error, 'test context');
            
            expect(consoleSpy).toHaveBeenCalledWith('Error in test context:', error);
            expect(uiStateManager.showNotification).toHaveBeenCalledWith(error.message, 'error');
        });

        it('should handle missing uiStateManager gracefully', () => {
            handler.uiStateManager = null;
            const error = new Error('Test error');
            expect(() => handler._handleError(error, 'test')).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should clean up resources', () => {
            handler.initialize();
            handler.show(100, 100);

            const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
            handler.destroy();

            expect(handler.menuElement).toBeNull();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler._handleGlobalClickBound, true);
            expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', handler._handleGlobalClickBound, true);
            expect(container.contains(handler.menuElement)).toBe(false);
        });

        it('should handle being called multiple times', () => {
            handler.initialize();
            handler.destroy();
            expect(() => handler.destroy()).not.toThrow();
        });
    });
});
