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
        this._handleClickOutsideBound = this._handleClickOutside.bind(this);
    }

    /**
     * 初始化上下文選單
     * @public
     */
    initialize() {
        this.menuElement = this._createMenuElement();
        this.container.appendChild(this.menuElement);
        this._setupEventListeners();
    }

    /**
     * 顯示選單在指定位置
     * @public
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     */
    show(x, y) {
        // 確保選單不會超出視窗範圍
        const menuRect = this.menuElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // 調整 X 座標
        if (x + menuRect.width > windowWidth) {
            x = windowWidth - menuRect.width;
        }

        // 調整 Y 座標
        if (y + menuRect.height > windowHeight) {
            y = windowHeight - menuRect.height;
        }

        this.menuElement.style.display = 'block';
        this.menuElement.style.left = `${Math.max(0, x)}px`;
        this.menuElement.style.top = `${Math.max(0, y)}px`;
    }

    /**
     * 隱藏選單
     * @public
     */
    hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
        }
    }

    /**
     * 清理資源
     * @public
     */
    destroy() {
        document.removeEventListener('click', this._handleClickOutsideBound);
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
     * 處理點擊選單外部的事件
     * @protected
     * @param {MouseEvent} event - 滑鼠事件
     */
    _handleClickOutside(event) {
        if (this.menuElement && !this.menuElement.contains(event.target)) {
            this.hide();
        }
    }

    /**
     * 處理錯誤並顯示通知
     * @protected
     * @param {Error} error - 錯誤對象
     * @param {string} action - 執行的動作名稱
     */
    _handleError(error, action) {
        console.error(`Error in ${this.constructor.name} executing ${action}:`, error);
        this.uiStateManager.showNotification(error.message, 'error');
    }

    /**
     * 建立選單項目
     * @protected
     * @param {string} id - 項目ID
     * @param {string} icon - Font Awesome 圖示名稱
     * @param {string} text - 項目文字
     * @param {string} [i18nKey] - 國際化鍵值
     * @returns {HTMLElement} 選單項目元素
     */
    _createMenuItem(id, icon, text, i18nKey) {
        const item = document.createElement('div');
        item.id = id;
        item.className = 'context-menu-item';
        
        const iconElement = document.createElement('i');
        iconElement.className = `fas fa-${icon} me-2`;
        item.appendChild(iconElement);

        const textElement = document.createElement('span');
        if (i18nKey) {
            textElement.setAttribute('data-i18n', i18nKey);
        }
        textElement.textContent = text;
        item.appendChild(textElement);

        return item;
    }
}

module.exports = BaseContextMenuHandler;