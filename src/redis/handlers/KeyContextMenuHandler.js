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
        const confirmed = await this.uiStateManager.showConfirmDialog(
            '確認刪除',
            `是否確定要刪除鍵值 "${this.currentKey}"？此操作無法復原。`
        );

        if (confirmed) {
            const connection = this.redisOperations.connections.get(this.currentConnectionId);
            if (!connection || connection.status !== 'ready') {
                throw new Error('伺服器未連線');
            }

            await this.redisOperations.deleteKey(connection.client, this.currentKey);
            this.uiStateManager.showNotification(`已刪除鍵值 "${this.currentKey}"`, 'success');
            await this.redisOperations.refreshKeys(this.currentConnectionId);
        }
    }

    /**
     * 處理複製鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleCopy() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection || connection.status !== 'ready') {
            throw new Error('伺服器未連線');
        }

        const keyInfo = await this.redisOperations.getKeyInfo(connection.client, this.currentKey);
        if (!keyInfo.success) {
            throw new Error(keyInfo.error || '無法取得鍵值資訊');
        }

        // 複製到剪貼簿
        const copyText = JSON.stringify({
            key: this.currentKey,
            type: keyInfo.info.type,
            value: keyInfo.info.value
        }, null, 2);

        try {
            await navigator.clipboard.writeText(copyText);
            this.uiStateManager.showNotification('已複製到剪貼簿', 'success');
        } catch (error) {
            throw new Error('無法複製到剪貼簿: ' + error.message);
        }
    }

    /**
     * 處理重新命名鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleRename() {
        const newKey = await this.uiStateManager.showPromptDialog(
            '重新命名',
            '請輸入新的鍵值名稱',
            this.currentKey
        );

        if (newKey && newKey !== this.currentKey) {
            const connection = this.redisOperations.connections.get(this.currentConnectionId);
            if (!connection || connection.status !== 'ready') {
                throw new Error('伺服器未連線');
            }

            await this.redisOperations.renameKey(connection.client, this.currentKey, newKey);
            this.uiStateManager.showNotification(`已將 "${this.currentKey}" 重新命名為 "${newKey}"`, 'success');
            await this.redisOperations.refreshKeys(this.currentConnectionId);
        }
    }

    /**
     * 處理設定過期時間
     * @private
     * @returns {Promise<void>}
     */
    async _handleTTL() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection || connection.status !== 'ready') {
            throw new Error('伺服器未連線');
        }

        const ttl = await this.redisOperations.getTTL(connection.client, this.currentKey);
        const currentTTL = ttl === -1 ? '' : ttl.toString();

        const newTTL = await this.uiStateManager.showPromptDialog(
            '設定過期時間',
            '請輸入過期時間（秒），留空表示永不過期',
            currentTTL
        );

        if (newTTL !== null) {  // 使用者沒有取消
            if (newTTL === '') {
                // 移除過期時間
                await this.redisOperations.removeTTL(connection.client, this.currentKey);
                this.uiStateManager.showNotification(`已移除 "${this.currentKey}" 的過期時間`, 'success');
            } else {
                const ttlValue = parseInt(newTTL, 10);
                if (isNaN(ttlValue) || ttlValue < 0) {
                    throw new Error('過期時間必須是非負整數');
                }
                await this.redisOperations.setTTL(connection.client, this.currentKey, ttlValue);
                this.uiStateManager.showNotification(
                    `已設定 "${this.currentKey}" 的過期時間為 ${ttlValue} 秒`,
                    'success'
                );
            }
        }
    }

    /**
     * 清理資源
     * @public
     */
    destroy() {
        // 移除所有選單項目的事件監聽器
        Object.values(this.menuItems).forEach(item => {
            item.replaceWith(item.cloneNode(true));
        });
        super.destroy();
    }
}

module.exports = KeyContextMenuHandler;