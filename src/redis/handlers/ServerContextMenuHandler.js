'use strict';

const BaseContextMenuHandler = require('./BaseContextMenuHandler');

/**
 * 伺服器上下文選單處理器
 * 處理伺服器節點的上下文選單
 * @class ServerContextMenuHandler
 * @extends BaseContextMenuHandler
 */
class ServerContextMenuHandler extends BaseContextMenuHandler {
    /**
     * 建立伺服器上下文選單處理器
     * @param {HTMLElement} container - 選單容器元素
     * @param {UIStateManager} uiStateManager - UI 狀態管理器
     * @param {RedisOperations} redisOperations - Redis 操作對象
     */
    constructor(container, uiStateManager, redisOperations) {
        super(container, uiStateManager);
        this.redisOperations = redisOperations;
        this.currentConnectionId = null;
        this.menuItems = {};
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

        // 建立選單項目
        this.menuItems = {
            addKey: this._createMenuItem('plus', '新增鍵值', 'redis.keyManagement.add', 'addKey'),
            refresh: this._createMenuItem('sync', '重新整理', 'redis.server.refresh', 'refresh'),
            reconnect: this._createMenuItem('plug', '重新連線', 'redis.server.reconnect', 'reconnect'),
            disconnect: this._createMenuItem('power-off', '斷開連線', 'redis.server.disconnect', 'disconnect'),
            remove: this._createMenuItem('trash', '移除伺服器', 'redis.server.remove', 'removeServer')
        };

        // 將選單項目添加到選單中
        Object.values(this.menuItems).forEach(item => menu.appendChild(item));

        return menu;
    }

    /**
     * 建立選單項目
     * @private
     * @param {string} icon - Font Awesome 圖示名稱
     * @param {string} text - 選單項目文字
     * @param {string} i18nKey - 國際化鍵值
     * @param {string} id - 選單項目 ID 前綴
     * @returns {HTMLElement} 選單項目元素
     */
    _createMenuItem(icon, text, i18nKey, id) {
        const item = document.createElement('div');
        item.className = 'menu-item';
        item.id = `${id}MenuItem`;

        const iconElement = document.createElement('i');
        iconElement.className = `fas fa-${icon}`;
        item.appendChild(iconElement);

        const textElement = document.createElement('span');
        textElement.textContent = text;
        textElement.setAttribute('data-i18n', i18nKey);
        item.appendChild(textElement);

        return item;
    }

    /**
     * 設置事件監聽器
     * @protected
     */
    _setupEventListeners() {
        // 監聽伺服器節點的右鍵事件
        this.container.addEventListener('contextmenu', this._handleContextMenu.bind(this));

        // 設置選單項目的點擊事件
        Object.entries(this.menuItems).forEach(([action, item]) => {
            item.addEventListener('click', () => this.executeMenuFunction(action));
        });
    }

    /**
     * 處理上下文選單事件
     * @private
     * @param {MouseEvent} e - 事件對象
     */
    _handleContextMenu(e) {
        const serverNode = e.target.closest('.server-node');
        if (!serverNode) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const connectionId = serverNode.getAttribute('data-connection-id');
        if (connectionId) {
            this.showForConnection(connectionId, e.clientX, e.clientY);
        }
    }

    /**
     * 顯示指定連線的上下文選單
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
     * 更新選單項目的可見性
     * @private
     */
    _updateMenuItemsVisibility() {
        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        const isConnected = connection?.status === 'ready';

        this.menuItems.addKey.style.display = isConnected ? 'block' : 'none';
        this.menuItems.refresh.style.display = isConnected ? 'block' : 'none';
        this.menuItems.reconnect.style.display = !isConnected ? 'block' : 'none';
        this.menuItems.disconnect.style.display = isConnected ? 'block' : 'none';
        this.menuItems.remove.style.display = 'block';
    }

    /**
     * 執行選單功能
     * @public
     * @param {string} action - 動作名稱
     */
    async executeMenuFunction(action) {
        try {
            const connection = this.redisOperations.connections.get(this.currentConnectionId);
            const isConnected = connection?.status === 'ready';

            switch (action) {
                case 'addKey':
                    if (isConnected) {
                        this.uiStateManager.showAddKeyModal(this.currentConnectionId);
                    }
                    break;

                case 'refresh':
                    if (isConnected) {
                        await this.redisOperations.refreshKeys(this.currentConnectionId);
                    }
                    break;

                case 'reconnect':
                    await this.redisOperations.reconnectToServer(this.currentConnectionId);
                    break;

                case 'disconnect':
                    await this.redisOperations.disconnectFromServer(this.currentConnectionId);
                    break;

                case 'remove':
                    const confirmed = await this.uiStateManager.showConfirmDialog({
                        title: '移除伺服器',
                        message: '確定要移除此伺服器嗎？',
                        confirmText: '移除',
                        cancelText: '取消'
                    });

                    if (confirmed) {
                        await this.redisOperations.removeServer(this.currentConnectionId);
                    }
                    break;

                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            this.hide();
        } catch (error) {
            this._handleError(error, `executing menu function: ${action}`);
        }
    }

    /**
     * 清理資源
     * @public
     */
    destroy() {
        if (this.menuItems) {
            // 移除所有選單項目的事件監聽器
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

module.exports = ServerContextMenuHandler;