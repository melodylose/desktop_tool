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
     * @param {RedisUIHandler} redisUIHandler - Redis UI 處理器
     * @param {RedisOperations} redisOperations - Redis 操作對象
     */
    constructor(redisUIHandler, redisOperations) {
        super(redisUIHandler.elements.redisTree);
        this.redisUIHandler = redisUIHandler;
        this.redisOperations = redisOperations;
        this.uiStateManager = redisUIHandler.uiStateManager;
        this.currentConnectionId = null;
        this.menuItems = {};
        this.menuElement = null;
    }

    /**
     * 建立選單元素
     * @protected
     * @returns {HTMLElement} 選單元素
     */
    _createMenuElement() {
        console.log('ServerContextMenuHandler: Creating menu element');
        const menu = document.createElement('div');
        menu.id = 'serverContextMenu';
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
            addKey: { icon: 'plus', text: '新增鍵值', i18nKey: 'redis.keyManagement.add', id: 'addKey' },
            refresh: { icon: 'sync', text: '重新整理', i18nKey: 'redis.server.refresh', id: 'refresh' },
            reconnect: { icon: 'plug', text: '重新連線', i18nKey: 'redis.server.reconnect', id: 'reconnect' },
            disconnect: { icon: 'power-off', text: '斷開連線', i18nKey: 'redis.server.disconnect', id: 'disconnect' },
            remove: { icon: 'trash', text: '移除伺服器', i18nKey: 'redis.server.remove', id: 'removeServer' }
        };

        // 創建並添加選單項目
        this.menuItems = {};
        Object.entries(menuItems).forEach(([action, config]) => {
            const item = this._createMenuItem(config.icon, config.text, config.i18nKey, config.id);
            
            // 綁定點擊事件
            const clickHandler = async (e) => {
                console.log('ServerContextMenuHandler: Menu item clicked', {
                    action,
                    target: e.target,
                    currentTarget: e.currentTarget,
                    type: e.type
                });

                // 阻止事件冒泡和預設行為
                e.preventDefault();
                e.stopPropagation();

                // 先隱藏選單，避免事件衝突
                this.hide();

                try {
                    console.log(`ServerContextMenuHandler: Executing menu function: ${action}`);
                    await this.executeMenuFunction(action);
                    console.log(`ServerContextMenuHandler: Menu function executed: ${action}`);
                } catch (error) {
                    console.error(`ServerContextMenuHandler: Error executing menu function: ${action}`, error);
                }
            };

            // 同時綁定點擊和鍵盤事件
            item.addEventListener('click', clickHandler);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    clickHandler(e);
                }
            });

            // 添加到選單和快取
            this.menuItems[action] = item;
            menu.appendChild(item);
        });

        console.log('ServerContextMenuHandler: Menu element created', menu);
        return menu;
    }

    _createMenuItem(icon, text, i18nKey, id) {
        console.log('ServerContextMenuHandler: Creating menu item', { icon, text, i18nKey, id });
        const item = document.createElement('div');
        item.id = `${id}MenuItem`;
        item.className = 'menu-item';
        item.setAttribute('data-action', id);
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '0');

        // 設置圖示
        const iconElement = document.createElement('i');
        iconElement.className = `fas fa-${icon}`;
        iconElement.style.pointerEvents = 'none';  // 防止事件被圖示攔截
        item.appendChild(iconElement);

        // 設置文字
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

        console.log('ServerContextMenuHandler: Menu item created', item);
        return item;
    }

    /**
     * 處理上下文選單事件
     * @param {MouseEvent} event - 滑鼠事件
     * @param {HTMLElement} serverNode - 伺服器節點元素
     */
    handleContextMenuEvent(event, serverNode) {
        // 取得連線 ID
        const connectionId = serverNode.getAttribute('data-connection-id');
        if (connectionId) {
            console.log('ServerContextMenuHandler: Showing menu for server', connectionId);
            this.currentConnectionId = connectionId;
            this.showForServer(connectionId, event.clientX, event.clientY);
        }
    }

    /**
     * 初始化處理器
     */
    initialize() {
        console.log('ServerContextMenuHandler: Initializing...');
        const existingMenu = document.getElementById('serverContextMenu');
        if (existingMenu) {
            console.log('ServerContextMenuHandler: Menu element already exists, removing it');
            existingMenu.remove();
        }
        
        this.menuElement = this._createMenuElement();
        document.body.appendChild(this.menuElement);
        console.log('ServerContextMenuHandler: Menu element created and appended to body');
    }

    /**
     * 顯示指定伺服器的上下文選單
     * @public
     * @param {string} connectionId - 連線 ID
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     */
    showForServer(connectionId, x, y) {
        console.log('ServerContextMenuHandler: showForServer called', {
            connectionId,
            x,
            y,
            hasMenuElement: !!this.menuElement
        });

        this.currentConnectionId = connectionId;

        // 確保選單元素存在
        if (!this.menuElement) {
            console.warn('ServerContextMenuHandler: Menu element does not exist');
            this.menuElement = this._createMenuElement();
            document.body.appendChild(this.menuElement);
            console.log('ServerContextMenuHandler: Created new menu element');
        }

        // 更新選單項目的可見性
        this._updateMenuItemsVisibility();

        // 顯示選單
        super.show(x, y);
        console.log('ServerContextMenuHandler: Menu should be visible now', {
            display: this.menuElement.style.display,
            visibility: this.menuElement.style.visibility,
            left: this.menuElement.style.left,
            top: this.menuElement.style.top
        });
    }

    /**
     * 執行選單功能
     * @param {string} action - 選單動作
     */
    async executeMenuFunction(action) {
        console.log('ServerContextMenuHandler: Executing menu function:', action);
        try {
            const connection = this.redisOperations.connections.get(this.currentConnectionId);
            const isConnected = connection?.status === 'ready';

            switch (action) {
                case 'addKey':
                    if (isConnected) {
                        this.redisUIHandler.showAddKeyModal();
                    }
                    break;
                case 'refresh':
                    if (isConnected) {
                        this.redisUIHandler.refreshKeys();
                    }
                    break;
                case 'reconnect':
                    if (!isConnected) {
                        this.redisUIHandler.handleReconnect(this.currentConnectionId);
                    }
                    break;
                case 'disconnect':
                    if (isConnected) {
                        this.redisUIHandler.disconnect(this.currentConnectionId);
                    }
                    break;
                case 'remove':
                    // 只有在斷開連線的狀態下才能移除伺服器
                    if (!isConnected) {
                        const confirmed = await this.redisUIHandler.dialogManager.showServerDeleteConfirmDialog();
                        if (confirmed) {
                            this.redisUIHandler.connectionManager.removeServer(this.currentConnectionId);
                        }
                    } else {
                        console.warn('ServerContextMenuHandler: Cannot remove connected server. Please disconnect first.');
                    }
                    break;
                default:
                    console.warn('ServerContextMenuHandler: Unknown menu action:', action);
            }
            console.log('ServerContextMenuHandler: Menu function executed:', action);
        } catch (error) {
            console.error('ServerContextMenuHandler: Error in executing menu function:', action, error);
        }
    }

    /**
     * 更新選單項目的可見性
     * @protected
     */
    _updateMenuItemsVisibility() {
        if (!this.currentConnectionId || !this.menuItems) return;

        const connection = this.redisOperations.connections.get(this.currentConnectionId);
        const isConnected = connection?.status === 'ready';

        // 根據連線狀態更新選單項目的可見性
        if (this.menuItems.addKey) {
            this.menuItems.addKey.style.display = isConnected ? 'flex' : 'none';
        }
        if (this.menuItems.refresh) {
            this.menuItems.refresh.style.display = isConnected ? 'flex' : 'none';
        }
        if (this.menuItems.reconnect) {
            this.menuItems.reconnect.style.display = !isConnected ? 'flex' : 'none';
        }
        if (this.menuItems.disconnect) {
            this.menuItems.disconnect.style.display = isConnected ? 'flex' : 'none';
        }
        if (this.menuItems.remove) {
            // 只有在斷開連線時才顯示移除選項
            this.menuItems.remove.style.display = !isConnected ? 'flex' : 'none';
        }
    }

    /**
     * 顯示選單
     * @param {number} x - X 座標
     * @param {number} y - Y 座標
     */
    show(x, y) {
        if (!this.menuElement) {
            console.error('ServerContextMenuHandler: Menu element does not exist');
            return;
        }
        super.show(x, y);
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