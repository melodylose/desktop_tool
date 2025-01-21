'use strict';

/**
 * 基礎上下文選單處理器
 * 提供上下文選單的基本功能和介面
 * @class BaseContextMenuHandler
 */
class BaseContextMenuHandler {
    /**
     * 建立基礎上下文選單處理器
     * @param {HTMLElement} container - 選單容器元素
     * @param {UIStateManager} uiStateManager - UI 狀態管理器
     */
    constructor(container, uiStateManager) {
        this.container = container;
        this.uiStateManager = uiStateManager;
        this.menuElement = null;
        this._handleGlobalClickBound = this._handleGlobalClick.bind(this);
    }

    /**
     * 初始化上下文選單
     * @public
     */
    initialize() {
        if (!this.menuElement) {
            this.menuElement = this._createMenuElement();
            this.container.appendChild(this.menuElement);
            this._setupEventListeners();
        }
    }

    /**
     * 顯示選單在指定位置
     * @public
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     */
    show(x, y) {
        if (!this.menuElement) {
            return;
        }

        const { x: adjustedX, y: adjustedY } = this._adjustMenuPosition(x, y);
        this.menuElement.style.left = `${adjustedX}px`;
        this.menuElement.style.top = `${adjustedY}px`;
        this.menuElement.style.display = 'block';

        // 添加全局事件監聽器
        window.addEventListener('click', this._handleGlobalClickBound, true);
        window.addEventListener('contextmenu', this._handleGlobalClickBound, true);
    }

    /**
     * 隱藏選單
     * @public
     */
    hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
            window.removeEventListener('click', this._handleGlobalClickBound, true);
            window.removeEventListener('contextmenu', this._handleGlobalClickBound, true);
        }
    }

    /**
     * 清理資源
     * @public
     */
    destroy() {
        this.hide();
        if (this.menuElement && this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
        this.menuElement = null;
    }

    /**
     * 建立選單元素
     * @protected
     * @returns {HTMLElement} 選單元素
     * @abstract
     */
    _createMenuElement() {
        throw new Error('_createMenuElement must be implemented by subclass');
    }

    /**
     * 設置事件監聽器
     * @protected
     * @abstract
     */
    _setupEventListeners() {
        throw new Error('_setupEventListeners must be implemented by subclass');
    }

    /**
     * 調整選單位置以避免超出視窗
     * @protected
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     * @returns {{x: number, y: number}} 調整後的座標
     */
    _adjustMenuPosition(x, y) {
        if (!this.menuElement) {
            return { x, y };
        }

        const menuRect = this.menuElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 先確保座標不小於 0
        let adjustedX = Math.max(0, x);
        let adjustedY = Math.max(0, y);

        // 如果選單會超出右邊界，將其移動到左邊
        if (adjustedX + menuRect.width > windowWidth) {
            adjustedX = windowWidth - menuRect.width;
        }

        // 如果選單會超出下邊界，將其移動到上方
        if (adjustedY + menuRect.height > windowHeight) {
            adjustedY = windowHeight - menuRect.height;
        }

        // 再次確保調整後的座標不小於 0
        adjustedX = Math.max(0, adjustedX);
        adjustedY = Math.max(0, adjustedY);

        return { x: adjustedX, y: adjustedY };
    }

    /**
     * 處理全局點擊事件
     * @protected
     * @param {Event} e - 事件對象
     */
    _handleGlobalClick(e) {
        if (!this.menuElement || this.menuElement.style.display === 'none') {
            return;
        }

        // 如果點擊的是選單內部，不處理事件
        if (this.menuElement.contains(e.target)) {
            return;
        }

        // 阻止事件冒泡
        e.stopPropagation();

        // 隱藏選單
        this.hide();
    }

    /**
     * 處理錯誤
     * @protected
     * @param {Error} error - 錯誤對象
     * @param {string} context - 錯誤上下文
     */
    _handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        this.uiStateManager?.showNotification?.(error.message, 'error');
    }
}

module.exports = BaseContextMenuHandler;