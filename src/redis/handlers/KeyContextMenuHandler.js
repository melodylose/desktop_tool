'use strict';

const BaseContextMenuHandler = require('./BaseContextMenuHandler');
const bootstrap = require('bootstrap');
const { i18next } = require('../../js/translationManager');
const DialogManager = require('../dialogs/DialogManager');

/**
 * 鍵值上下文選單處理器
 * 處理 Redis 鍵值的上下文選單操作
 * @class KeyContextMenuHandler
 * @extends BaseContextMenuHandler
 */
class KeyContextMenuHandler extends BaseContextMenuHandler {
    /**
     * 建立鍵值上下文選單處理器
     * @param {RedisUIHandler} redisUIHandler - Redis UI 處理器
     * @param {RedisOperations} redisOperations - Redis 操作管理器
     */
    constructor(redisUIHandler, redisOperations) {
        super(redisUIHandler.elements.redisTree);  // Pass container element to parent class
        this.redisUIHandler = redisUIHandler;
        this.redisOperations = redisOperations;
        this.uiStateManager = redisUIHandler.uiStateManager;
        this.menuElement = null;
        this.currentKey = null;
        this.currentConnectionId = null;
        this._handleGlobalClickBound = this._handleGlobalClick.bind(this);
        this.dialogManager = new DialogManager(this.uiStateManager);
        this.menuItems = {};
    }

    /**
     * 處理上下文選單事件
     * @param {MouseEvent} event - 滑鼠事件
     * @param {HTMLElement} keyNode - 鍵值節點元素
     */
    handleContextMenuEvent(event, keyNode) {
        // 取得鍵值名稱和連線 ID
        const keyName = keyNode.querySelector('.key-name')?.textContent;
        const connectionId = keyNode.closest('.server-node')?.getAttribute('data-connection-id');
        
        console.log('KeyContextMenuHandler: Key node data', {
            key: keyName,
            connectionId,
            hasKey: !!keyName,
            hasConnectionId: !!connectionId
        });

        if (keyName && connectionId) {
            console.log('KeyContextMenuHandler: Showing context menu for key', keyName);
            this.currentKey = keyName;
            this.currentConnectionId = connectionId;
            this.showForKey(keyName, connectionId, event.clientX, event.clientY);
        }
    }

    /**
     * 初始化處理器
     */
    initialize() {
        console.log('KeyContextMenuHandler: Initializing...');
        const existingMenu = document.getElementById('keyContextMenu');
        if (existingMenu) {
            console.log('KeyContextMenuHandler: Menu element already exists, removing it');
            existingMenu.remove();
        }
        
        this.menuElement = this._createMenuElement();
        document.body.appendChild(this.menuElement);
        console.log('KeyContextMenuHandler: Menu element created and appended to body');

        // 設置選單項目的點擊事件
        if (this.menuItems) {
            Object.entries(this.menuItems).forEach(([action, item]) => {
                if (item) {
                    item.addEventListener('click', () => this.executeMenuFunction(action));
                }
            });
        }
    }

    /**
     * 建立選單元素
     * @protected
     * @returns {HTMLElement} 選單元素
     */
    _createMenuElement() {
        console.log('KeyContextMenuHandler: Creating menu element');
        const menu = document.createElement('div');
        menu.id = 'keyContextMenu';
        menu.className = 'context-menu';
        menu.setAttribute('role', 'menu');

        // 基本樣式
        Object.assign(menu.style, {
            position: 'fixed',
            zIndex: '10000',
            backgroundColor: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            padding: '5px 0',
            minWidth: '150px',
            display: 'none',
            visibility: 'hidden',
            userSelect: 'none',
            fontFamily: 'Arial, sans-serif'
        });

        // 建立選單項目
        const menuItems = {
            ttl: this._createMenuItem('clock', '設定過期時間', 'redis.keyManagement.ttl', 'ttlKey', () => {
                console.log('KeyContextMenuHandler: TTL clicked');
                if (this.currentKey && this.currentConnectionId) {
                    // TODO: 實作設定過期時間的功能
                    console.log('Setting TTL for key:', this.currentKey);
                }
            }),
            delete: this._createMenuItem('trash', '刪除', 'redis.keyManagement.delete', 'deleteKey', () => {
                console.log('KeyContextMenuHandler: Delete clicked');
                if (this.currentKey && this.currentConnectionId) {
                    this.redisUIHandler.deleteSelectedKey();
                }
            })
        };

        // 將選單項目加入選單
        Object.values(menuItems).forEach(item => menu.appendChild(item));
        this.menuItems = menuItems;

        return menu;
    }

    /**
     * 建立選單項目
     * @protected
     * @param {string} icon - Font Awesome 圖示名稱
     * @param {string} text - 項目文字
     * @param {string} i18nKey - 國際化鍵值
     * @param {string} id - 選單項目 ID
     * @param {Function} callback - 點擊事件回呼函數
     * @returns {HTMLElement} 選單項目元素
     */
    _createMenuItem(icon, text, i18nKey, id, callback) {
        const item = document.createElement('div');
        item.id = `${id}MenuItem`;
        item.className = 'menu-item';
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '0');
        
        // 創建圖示元素
        const iconElement = document.createElement('i');
        iconElement.className = `fas fa-${icon}`;
        iconElement.style.pointerEvents = 'none';  // 防止事件被圖示攔截
        item.appendChild(iconElement);

        // 創建文字元素
        const textElement = document.createElement('span');
        textElement.textContent = text;
        textElement.setAttribute('data-i18n', i18nKey);
        textElement.style.pointerEvents = 'none';  // 防止事件被文字攔截
        item.appendChild(textElement);

        // 設置樣式
        Object.assign(item.style, {
            padding: '8px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#333',
            transition: 'background-color 0.2s',
            WebkitUserSelect: 'none',
            userSelect: 'none'
        });

        // 設置圖示樣式
        Object.assign(iconElement.style, {
            width: '16px',
            textAlign: 'center',
            color: '#666'
        });

        // 添加懸停效果
        item.addEventListener('mouseover', () => {
            item.style.backgroundColor = '#f5f5f5';
        });

        item.addEventListener('mouseout', () => {
            item.style.backgroundColor = '';
        });

        // 添加點擊事件
        if (callback) {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
                callback();
            });

            // 添加鍵盤事件支援
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hide();
                    callback();
                }
            });
        }

        return item;
    }

    /**
     * 處理上下文選單事件
     * @param {MouseEvent} event - 滑鼠事件
     * @param {HTMLElement} keyNode - 鍵值節點元素
     */
    handleContextMenuEvent(event, keyNode) {
        // 取得鍵值名稱和連線 ID
        const keyName = keyNode.querySelector('.key-name')?.textContent;
        const connectionId = keyNode.closest('.server-node')?.getAttribute('data-connection-id');
        
        console.log('KeyContextMenuHandler: Key node data', {
            key: keyName,
            connectionId,
            hasKey: !!keyName,
            hasConnectionId: !!connectionId
        });

        if (keyName && connectionId) {
            console.log('KeyContextMenuHandler: Showing context menu for key', keyName);
            this.currentKey = keyName;
            this.currentConnectionId = connectionId;
            this.showForKey(keyName, connectionId, event.clientX, event.clientY);
        }
    }

    /**
     * 顯示特定鍵值的上下文選單
     * @public
     * @param {string} key - 鍵值名稱
     * @param {string} connectionId - 連線 ID
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     */
    showForKey(key, connectionId, x, y) {
        console.log('KeyContextMenuHandler: showForKey called', {
            key,
            connectionId,
            x,
            y,
            currentKey: this.currentKey,
            currentConnectionId: this.currentConnectionId
        });

        // 如果 key 或 connectionId 無效，則不更新當前值並返回
        if (!key || !connectionId) {
            console.log('Invalid key or connection, not showing menu');
            return;
        }

        // 更新當前值
        this.currentKey = key;
        this.currentConnectionId = connectionId;

        // 確保選單元素存在
        if (!this.menuElement) {
            console.warn('KeyContextMenuHandler: Menu element does not exist');
            this.menuElement = this._createMenuElement();
            console.log('KeyContextMenuHandler: Created new menu element');
        }

        // 顯示選單
        this.show(x, y);
        console.log('KeyContextMenuHandler: Menu should be visible now', {
            display: this.menuElement.style.display,
            visibility: this.menuElement.style.visibility,
            left: this.menuElement.style.left,
            top: this.menuElement.style.top
        });
    }

    /**
     * 執行選單功能
     * @public
     * @param {string} action - 動作名稱
     * @returns {Promise<void>}
     */
    async executeMenuFunction(action) {
        if (!this.currentKey || !this.currentConnectionId) return;

        try {
            switch (action) {
                case 'delete':
                    await this._handleDelete();
                    break;
                case 'ttl':
                    await this._handleTTL();
                    break;
                default:
                    this.uiStateManager?.showNotification('未知的動作', 'error');
            }
        } catch (error) {
            console.error(`Error executing menu function ${action}:`, error);
            this.uiStateManager?.showNotification(error.message, 'error');
        } finally {
            if (this.menuElement) {
                this.menuElement.style.display = 'none';
                document.removeEventListener('click', this._handleGlobalClickBound);
            }
        }
    }

    /**
     * 處理設定過期時間
     * @private
     * @returns {Promise<void>}
     */
    async _handleTTL() {
        const ttl = await this.dialogManager.showTTLDialog(this.currentKey);
        if (!ttl) return;

        try {
            const result = await this.redisOperations.setExpire(
                this.currentKey,
                parseInt(ttl),
                this.currentConnectionId
            );

            if (result) {
                this.uiStateManager?.showNotification(
                    `成功設定 ${this.currentKey} 的過期時間為 ${ttl} 秒`,
                    'success'
                );
            } else {
                this.uiStateManager?.showNotification('設定過期時間失敗', 'error');
            }
        } catch (error) {
            console.error('Error setting TTL:', error);
            this.uiStateManager?.showNotification(error.message, 'error');
        }
    }

    /**
     * 處理刪除鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleDelete() {
        const confirmed = await this.dialogManager.showDeleteConfirmDialog(this.currentKey);
        if (!confirmed) return;

        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection) {
            this.uiStateManager?.showNotification('伺服器未連線', 'error');
            return;
        }

        try {
            const result = await this.redisOperations.deleteKey(connection.client, this.currentKey);
            if (result.success) {
                this.uiStateManager?.showNotification(`成功刪除 ${this.currentKey}`, 'success');
            } else {
                this.uiStateManager?.showNotification('刪除失敗', 'error');
            }
        } catch (error) {
            console.error('Error deleting key:', error);
            this.uiStateManager?.showNotification(error.message, 'error');
        }
    }

    /**
     * 清理資源
     * @public
     */
    destroy() {
        if (this.menuItems) {
            Object.entries(this.menuItems).forEach(([action, item]) => {
                const newItem = item.cloneNode(true);
                if (item.parentNode) {
                    item.parentNode.replaceChild(newItem, item);
                }
                this.menuItems[action] = newItem;
            });
        }
        super.destroy();
    }
}

module.exports = KeyContextMenuHandler;