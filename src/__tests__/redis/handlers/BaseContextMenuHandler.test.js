'use strict';

const BaseContextMenuHandler = require('../../../redis/handlers/BaseContextMenuHandler');

describe('BaseContextMenuHandler', () => {
    let handler;
    let container;
    let mockUIStateManager;

    beforeEach(() => {
        mockUIStateManager = {
            showNotification: jest.fn()
        };

        container = document.createElement('div');
        document.body.appendChild(container);

        handler = new BaseContextMenuHandler(container, mockUIStateManager);
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

    describe('abstract methods', () => {
        it('should throw error when _createMenuElement is not implemented', () => {
            expect(() => handler._createMenuElement()).toThrow('_createMenuElement must be implemented by subclass');
        });

        it('should throw error when _setupEventListeners is not implemented', () => {
            expect(() => handler._setupEventListeners()).toThrow('_setupEventListeners must be implemented by subclass');
        });
    });

    describe('menu position adjustment', () => {
        beforeEach(() => {
            // 模擬選單元素
            handler.menuElement = document.createElement('div');
            handler.menuElement.style.width = '200px';
            handler.menuElement.style.height = '300px';
            container.appendChild(handler.menuElement);
        });

        it('should return original coordinates when menu element is null', () => {
            handler.menuElement = null;
            const result = handler._adjustMenuPosition(100, 100);
            expect(result).toEqual({ x: 100, y: 100 });
        });

        it('should adjust position when menu would overflow right boundary', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
            const result = handler._adjustMenuPosition(900, 100);
            expect(result.x).toBe(800); // 1000 - 200 (menu width)
        });

        it('should adjust position when menu would overflow bottom boundary', () => {
            Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
            const result = handler._adjustMenuPosition(100, 600);
            expect(result.y).toBe(500); // 800 - 300 (menu height)
        });

        it('should adjust position when coordinates are negative', () => {
            const result = handler._adjustMenuPosition(-50, -50);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('should handle both horizontal and vertical overflow', () => {
            Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
            Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
            const result = handler._adjustMenuPosition(900, 600);
            expect(result.x).toBe(800);
            expect(result.y).toBe(500);
        });
    });

    describe('global click handling', () => {
        beforeEach(() => {
            handler.menuElement = document.createElement('div');
            container.appendChild(handler.menuElement);
            handler.menuElement.style.display = 'block';
        });

        it('should do nothing when menu element is null', () => {
            handler.menuElement = null;
            const event = new window.MouseEvent('click');
            handler._handleGlobalClick(event);
            // 如果沒有拋出錯誤就通過
        });

        it('should do nothing when menu is hidden', () => {
            handler.menuElement.style.display = 'none';
            const event = new window.MouseEvent('click');
            handler._handleGlobalClick(event);
            // 如果沒有拋出錯誤就通過
        });
    });

    describe('error handling', () => {
        it('should handle error with context', () => {
            const error = new Error('Test error');
            handler._handleError(error, 'test context');
            expect(mockUIStateManager.showNotification).toHaveBeenCalledWith('Test error', 'error');
        });

        it('should handle error when uiStateManager is null', () => {
            handler.uiStateManager = null;
            const error = new Error('Test error');
            handler._handleError(error, 'test context');
            // 如果沒有拋出錯誤就通過
        });

        it('should handle error when showNotification is not available', () => {
            handler.uiStateManager = {};
            const error = new Error('Test error');
            handler._handleError(error, 'test context');
            // 如果沒有拋出錯誤就通過
        });
    });
});
