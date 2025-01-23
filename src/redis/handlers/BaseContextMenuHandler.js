/**
 * 基礎上下文選單處理器
 */
class BaseContextMenuHandler {
    /**
     * 建立基礎上下文選單處理器
     * @param {HTMLElement} container - 選單容器元素
     * @param {UIStateManager} uiStateManager - UI 狀態管理器
     */
    constructor(container, uiStateManager) {
        if (!container) {
            console.warn('BaseContextMenuHandler: Container element not provided');
        }
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
     * 建立選單項目
     * @param {string} icon - 圖示名稱
     * @param {string} text - 顯示文字
     * @param {string} i18nKey - 國際化鍵值
     * @param {string} dataAction - 動作標識
     * @returns {HTMLElement} 選單項目元素
     */
    _createMenuItem(icon, text, i18nKey, dataAction) {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.setAttribute('data-i18n', i18nKey);
        item.setAttribute('data-action', dataAction);

        const iconElement = document.createElement('i');
        iconElement.className = `fas fa-${icon} me-2`;
        item.appendChild(iconElement);

        const textNode = document.createTextNode(text);
        item.appendChild(textNode);

        return item;
    }

    /**
     * 隱藏所有上下文選單
     * @static
     */
    static hideAllContextMenus() {
        const allMenus = document.querySelectorAll('.context-menu');
        allMenus.forEach(menu => {
            menu.style.display = 'none';
            menu.style.visibility = 'hidden';
        });
    }

    /**
     * 顯示上下文選單
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     * @public
     */
    show(x, y) {
        if (!this.menuElement) {
            console.warn('BaseContextMenuHandler: Menu element does not exist');
            return;
        }

        // 先隱藏所有選單
        BaseContextMenuHandler.hideAllContextMenus();

        console.log('BaseContextMenuHandler: Showing menu', {
            originalX: x,
            originalY: y,
            menuElement: this.menuElement
        });

        // 確保選單元素在 DOM 中
        if (!this.menuElement.parentElement) {
            document.body.appendChild(this.menuElement);
            console.log('BaseContextMenuHandler: Menu element appended to body');
        }

        // 先顯示選單但設為不可見，以獲取正確的尺寸
        this.menuElement.style.visibility = 'hidden';
        this.menuElement.style.display = 'block';

        // 獲取選單尺寸
        const rect = this.menuElement.getBoundingClientRect();
        console.log('BaseContextMenuHandler: Menu dimensions', {
            width: rect.width,
            height: rect.height
        });

        const { x: adjustedX, y: adjustedY } = this._adjustMenuPosition(x, y);
        console.log('BaseContextMenuHandler: Adjusted position', {
            adjustedX,
            adjustedY
        });

        // 設置最終位置並顯示選單
        this.menuElement.style.left = `${adjustedX}px`;
        this.menuElement.style.top = `${adjustedY}px`;
        this.menuElement.style.visibility = 'visible';
        console.log('BaseContextMenuHandler: Menu styles set', {
            left: this.menuElement.style.left,
            top: this.menuElement.style.top,
            display: this.menuElement.style.display,
            visibility: this.menuElement.style.visibility
        });

        // 只添加點擊事件監聽器，contextmenu 事件由子類處理
        document.addEventListener('click', this._handleGlobalClickBound);
        console.log('BaseContextMenuHandler: Global click listener added');
    }

    /**
     * 隱藏選單
     * @public
     */
    hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
            document.removeEventListener('click', this._handleGlobalClickBound);
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
        // 如果選單元素不存在，直接返回原始座標
        if (!this.menuElement) {
            return { x, y };
        }

        console.log('BaseContextMenuHandler: Adjusting menu position', {
            x,
            y,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            menuWidth: this.menuElement.offsetWidth,
            menuHeight: this.menuElement.offsetHeight
        });

        const rect = this.menuElement.getBoundingClientRect();
        const menuWidth = rect.width || this.menuElement.offsetWidth;
        const menuHeight = rect.height || this.menuElement.offsetHeight;

        // 確保選單不會超出視窗右側
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth;
        }

        // 確保選單不會超出視窗底部
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight;
        }

        // 確保選單不會超出視窗左側
        x = Math.max(0, x);

        // 確保選單不會超出視窗頂部
        y = Math.max(0, y);

        console.log('BaseContextMenuHandler: Final position', { x, y });
        return { x, y };
    }

    /**
     * 處理全局點擊事件
     * @protected
     * @param {Event} e - 事件對象
     */
    _handleGlobalClick(e) {
        // 如果選單元素不存在或已隱藏，直接返回
        if (!this.menuElement || this.menuElement.style.display === 'none') {
            return;
        }

        // 檢查是否點擊了選單項目（包括其子元素）
        const menuItem = e.target.closest('.menu-item');

        console.log('BaseContextMenuHandler: Global click event', {
            eventType: e.type,
            target: e.target,
            menuElement: this.menuElement,
            menuDisplay: this.menuElement.style.display,
            isTargetInsideMenu: this.menuElement.contains(e.target),
            menuItemClicked: menuItem
        });

        if (menuItem && this.menuElement.contains(menuItem)) {
            console.log('BaseContextMenuHandler: Click on menu item', {
                menuItem,
                menuItemId: menuItem.id,
                menuItemAction: menuItem.getAttribute('data-action')
            });
            // 不隱藏選單，讓事件繼續傳播
            return;
        }

        // 如果點擊的是選單內部但不是選單項目，阻止事件冒泡
        if (this.menuElement.contains(e.target)) {
            console.log('BaseContextMenuHandler: Click inside menu but not on menu item, stopping propagation');
            e.stopPropagation();
            return;
        }

        console.log('BaseContextMenuHandler: Click outside menu, hiding menu');
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

    /**
     * 執行選單功能
     * @param {string} action - 動作名稱
     */
    async executeMenuFunction(action) {
        console.log(`BaseContextMenuHandler: Executing menu function: ${action}`);
        const handler = this[`_handle${action.charAt(0).toUpperCase() + action.slice(1)}`];

        if (typeof handler === 'function') {
            try {
                await handler.call(this);
            } catch (error) {
                console.error(`Error executing menu function ${action}:`, error);
            }
        } else {
            console.warn(`No handler found for action: ${action}`);
        }

        this.hide();
    }
}

module.exports = BaseContextMenuHandler;