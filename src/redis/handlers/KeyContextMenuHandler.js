'use strict';

const BaseContextMenuHandler = require('./BaseContextMenuHandler');

/**
 * 鍵值上下文選單處理器
 * 處理 Redis 鍵值的上下文選單操作
 * @class KeyContextMenuHandler
 * @extends BaseContextMenuHandler
 */
class KeyContextMenuHandler extends BaseContextMenuHandler {
    /**
     * 建立鍵值上下文選單處理器
     * @param {HTMLElement} container - 選單容器元素
     * @param {UIStateManager} uiStateManager - UI 狀態管理器
     * @param {RedisOperations} redisOperations - Redis 操作管理器
     */
    constructor(container, uiStateManager, redisOperations) {
        super(container, uiStateManager);
        this.redisOperations = redisOperations;
        this.currentKey = null;
        this.currentConnectionId = null;
        this.menuItems = {
            edit: null,
            delete: null,
            copy: null,
            rename: null,
            ttl: null
        };
    }

    /**
     * 建立選單元素
     * @protected
     * @returns {HTMLElement} 選單元素
     */
    _createMenuElement() {
        const menu = document.createElement('div');
        menu.id = 'keyContextMenu';
        menu.className = 'context-menu';

        this.menuItems = {
            edit: this._createMenuItem('editKeyMenuItem', 'edit', '編輯', 'redis.keyManagement.edit'),
            delete: this._createMenuItem('deleteKeyMenuItem', 'trash', '刪除', 'redis.keyManagement.delete'),
            copy: this._createMenuItem('copyKeyMenuItem', 'copy', '複製', 'redis.keyManagement.copy'),
            rename: this._createMenuItem('renameKeyMenuItem', 'font', '重新命名', 'redis.keyManagement.rename'),
            ttl: this._createMenuItem('ttlKeyMenuItem', 'clock', '設定過期時間', 'redis.keyManagement.ttl')
        };

        Object.values(this.menuItems).forEach(item => menu.appendChild(item));
        return menu;
    }

    /**
     * 設置事件監聽器
     * @protected
     */
    _setupEventListeners() {
        // 設置選單項目的事件處理
        this.menuItems.edit.addEventListener('click', () => this.executeMenuFunction('edit'));
        this.menuItems.delete.addEventListener('click', () => this.executeMenuFunction('delete'));
        this.menuItems.copy.addEventListener('click', () => this.executeMenuFunction('copy'));
        this.menuItems.rename.addEventListener('click', () => this.executeMenuFunction('rename'));
        this.menuItems.ttl.addEventListener('click', () => this.executeMenuFunction('ttl'));

        // 點擊外部關閉選單
        document.addEventListener('click', this._handleClickOutsideBound);
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
        this.currentKey = key;
        this.currentConnectionId = connectionId;
        this.show(x, y);
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
                case 'edit':
                    await this._handleEdit();
                    break;
                case 'delete':
                    await this._handleDelete();
                    break;
                case 'copy':
                    await this._handleCopy();
                    break;
                case 'rename':
                    await this._handleRename();
                    break;
                case 'ttl':
                    await this._handleTTL();
                    break;
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
        } catch (error) {
            this._handleError(error, action);
        } finally {
            this.hide();
        }
    }

    /**
     * 處理編輯鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleEdit() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection || connection.status !== 'ready') {
            throw new Error('伺服器未連線');
        }

        const keyInfo = await this.redisOperations.getKeyInfo(connection.client, this.currentKey);
        if (!keyInfo.success) {
            throw new Error(keyInfo.error || '無法取得鍵值資訊');
        }

        this.uiStateManager.showEditKeyModal(keyInfo.info);
    }

    /**
     * 處理刪除鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleDelete() {
        await this.redisOperations.deleteKey(this.currentKey, this.currentConnectionId);
    }

    /**
     * 處理複製鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleCopy() {
        await this.redisOperations.copyKey(this.currentKey, this.currentConnectionId);
    }

    /**
     * 處理重新命名鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleRename() {
        const newKey = await this.uiStateManager.showDialog('重新命名', '請輸入新的鍵值名稱');
        if (newKey) {
            await this.redisOperations.renameKey(this.currentKey, newKey, this.currentConnectionId);
        }
    }

    /**
     * 處理設定過期時間
     * @private
     * @returns {Promise<void>}
     */
    async _handleTTL() {
        const ttl = await this.uiStateManager.showDialog('設定過期時間', '請輸入過期時間（秒）');
        if (ttl) {
            await this.redisOperations.setExpire(this.currentKey, parseInt(ttl), this.currentConnectionId);
        }
    }

    /**
     * 清理資源
     * @public
     */
    destroy() {
        // 移除所有選單項目的事件監聽器
        if (this.menuItems) {
            Object.values(this.menuItems).forEach(item => {
                if (item && item.parentNode) {
                    const clone = item.cloneNode(true);
                    item.parentNode.replaceChild(clone, item);
                }
            });
            this.menuItems = {};
        }
        super.destroy();
    }
}

module.exports = KeyContextMenuHandler;