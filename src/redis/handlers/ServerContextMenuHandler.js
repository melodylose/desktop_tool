'use strict';

const BaseContextMenuHandler = require('./BaseContextMenuHandler');

/**
 * 伺服器上下文選單處理器
 * 處理 Redis 伺服器節點的上下文選單操作
 * @class ServerContextMenuHandler
 * @extends BaseContextMenuHandler
 */
class ServerContextMenuHandler extends BaseContextMenuHandler {
    /**
     * 建立伺服器上下文選單處理器
     * @param {HTMLElement} container - 選單容器元素
     * @param {UIStateManager} uiStateManager - UI 狀態管理器
     * @param {RedisOperations} redisOperations - Redis 操作管理器
     */
    constructor(container, uiStateManager, redisOperations) {
        super(container, uiStateManager);
        this.redisOperations = redisOperations;
        this.currentConnectionId = null;
        this.menuItems = {
            addKey: null,
            refresh: null,
            reconnect: null,
            disconnect: null,
            remove: null
        };
    }

    /**
     * 建立選單元素
     * @protected
     * @returns {HTMLElement} 選單元素
     */
    _createMenuElement() {
        const menu = document.createElement('div');
        menu.id = 'serverContextMenu';
        menu.className = 'context-menu';

        this.menuItems = {
            addKey: this._createMenuItem('addKeyMenuItem', 'plus', '新增鍵值', 'redis.keyManagement.add'),
            refresh: this._createMenuItem('refreshMenuItem', 'sync', '重新整理', 'redis.server.refresh'),
            reconnect: this._createMenuItem('reconnectMenuItem', 'plug', '重新連線', 'redis.server.reconnect'),
            disconnect: this._createMenuItem('disconnectMenuItem', 'power-off', '斷開連線', 'redis.server.disconnect'),
            remove: this._createMenuItem('removeServerMenuItem', 'trash', '移除伺服器', 'redis.server.remove')
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
        this.menuItems.addKey.addEventListener('click', () => this.executeMenuFunction('addKey'));
        this.menuItems.refresh.addEventListener('click', () => this.executeMenuFunction('refresh'));
        this.menuItems.reconnect.addEventListener('click', () => this.executeMenuFunction('reconnect'));
        this.menuItems.disconnect.addEventListener('click', () => this.executeMenuFunction('disconnect'));
        this.menuItems.remove.addEventListener('click', () => this.executeMenuFunction('remove'));

        // 點擊外部關閉選單
        document.addEventListener('click', this._handleClickOutsideBound);
    }

    /**
     * 顯示特定連線的上下文選單
     * @public
     * @param {string} connectionId - 連線 ID
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     */
    showForConnection(connectionId, x, y) {
        this.currentConnectionId = connectionId;
        this._updateMenuItemsVisibility();
        this.show(x, y);
    }

    /**
     * 執行選單功能
     * @public
     * @param {string} action - 動作名稱
     * @returns {Promise<void>}
     */
    async executeMenuFunction(action) {
        if (!this.currentConnectionId) return;

        try {
            switch (action) {
                case 'addKey':
                    await this._handleAddKey();
                    break;
                case 'refresh':
                    await this._handleRefresh();
                    break;
                case 'reconnect':
                    await this._handleReconnect();
                    break;
                case 'disconnect':
                    await this._handleDisconnect();
                    break;
                case 'remove':
                    await this._handleRemove();
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
     * 更新選單項目的可見性
     * @private
     */
    _updateMenuItemsVisibility() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection) return;

        const isConnected = connection.status === 'ready';
        this.menuItems.addKey.style.display = isConnected ? 'block' : 'none';
        this.menuItems.refresh.style.display = isConnected ? 'block' : 'none';
        this.menuItems.reconnect.style.display = !isConnected ? 'block' : 'none';
        this.menuItems.disconnect.style.display = isConnected ? 'block' : 'none';
    }

    /**
     * 處理新增鍵值
     * @private
     * @returns {Promise<void>}
     */
    async _handleAddKey() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection || connection.status !== 'ready') {
            throw new Error('伺服器未連線');
        }
        // 觸發新增鍵值對話框顯示
        this.uiStateManager.showAddKeyModal();
    }

    /**
     * 處理重新整理
     * @private
     * @returns {Promise<void>}
     */
    async _handleRefresh() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        if (!connection || connection.status !== 'ready') {
            throw new Error('伺服器未連線');
        }
        await this.redisOperations.refreshKeys(this.currentConnectionId);
    }

    /**
     * 處理重新連線
     * @private
     * @returns {Promise<void>}
     */
    async _handleReconnect() {
        await this.redisOperations.reconnectToServer(this.currentConnectionId);
    }

    /**
     * 處理斷開連線
     * @private
     * @returns {Promise<void>}
     */
    async _handleDisconnect() {
        await this.redisOperations.disconnectFromServer(this.currentConnectionId);
    }

    /**
     * 處理移除伺服器
     * @private
     * @returns {Promise<void>}
     */
    async _handleRemove() {
        const confirmed = await this.uiStateManager.showConfirmDialog(
            '確認移除伺服器',
            '是否確定要移除此伺服器？此操作無法復原。'
        );
        
        if (confirmed) {
            await this.redisOperations.removeServer(this.currentConnectionId);
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

module.exports = ServerContextMenuHandler;