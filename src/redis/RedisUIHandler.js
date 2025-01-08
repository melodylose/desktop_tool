const { ipcRenderer } = require('electron');
const UIStateManager = require('./UIStateManager');
const TreeViewBuilder = require('./TreeViewBuilder');
const ConnectionManager = require('./ConnectionManager');

class RedisUIHandler {
    constructor(redisOperations) {
        this.redisOperations = redisOperations;
        this.elements = {};
        this.modal = null;

        this.connectionManager = new ConnectionManager(redisOperations);
        
        // 監聽連線狀態變化
        this.redisOperations.on('connection-status', ({ connectionId, status, error, delay }) => {
            this.handleConnectionStatus(connectionId, status, error, delay);
        });
    }

    initialize() {
        console.log('Redis UI Handler initializing...');
        try {
            this._initializeElements();
            this.uiStateManager = new UIStateManager(this.elements);
            this.treeViewBuilder = new TreeViewBuilder(this.elements.redisTree);
            this._initializeEventListeners();
            console.log('Redis UI Handler initialized successfully');
        } catch (error) {
            console.error('Error initializing Redis UI handler:', error);
            this.uiStateManager.showNotification('Error initializing Redis UI handler: ' + error.message);
            throw error;
        }
    }

    _initializeElements() {
        this.elements = {
            addServerBtn: document.getElementById('addServerBtn'),
            connectBtn: document.getElementById('connectBtn'),
            connectBtnNormalState: document.querySelector('#connectBtn .normal-state'),
            connectBtnConnectingState: document.querySelector('#connectBtn .connecting-state'),
            connectBtnConnectedState: document.querySelector('#connectBtn .connected-state'),
            serverName: document.getElementById('serverName'),
            redisServer: document.getElementById('redisServer'),
            redisPort: document.getElementById('redisPort'),
            redisPassword: document.getElementById('redisPassword'),
            redisDb: document.getElementById('redisDb'),
            addKeyBtn: document.getElementById('addKeyBtn'),
            deleteKeyBtn: document.getElementById('deleteKeyBtn'),
            saveKeyBtn: document.getElementById('saveKeyBtn'),
            redisTree: document.getElementById('redisTree'),
            keyContent: document.getElementById('keyContent'),
            keyName: document.getElementById('keyName'),
            keyType: document.getElementById('keyType'),
            keyValue: document.getElementById('keyValue'),
            serverContextMenu: document.getElementById('serverContextMenu'),
            addKeyMenuItem: document.getElementById('addKeyMenuItem'),
            refreshMenuItem: document.getElementById('refreshMenuItem'),
            disconnectMenuItem: document.getElementById('disconnectMenuItem')
        };

        // 檢查必要的元素是否存在
        const requiredElements = [
            'addServerBtn', 'connectBtn', 'serverName', 'redisServer', 'redisPort',
            'redisDb', 'addKeyBtn', 'deleteKeyBtn', 'saveKeyBtn',
            'redisTree', 'keyContent', 'serverContextMenu'
        ];

        for (const key of requiredElements) {
            if (!this.elements[key]) {
                throw new Error(`Required element ${key} not found`);
            }
        }

        this.modal = new bootstrap.Modal(document.getElementById('addServerModal'));
    }

    _initializeEventListeners() {
        this.elements.addServerBtn.addEventListener('click', () => {
            this.resetConnectionForm();
            this.modal.show();
        });

        this.elements.connectBtn.addEventListener('click', () => this.handleConnection());
        this.elements.addKeyBtn.addEventListener('click', () => this.showAddKeyModal());
        this.elements.deleteKeyBtn.addEventListener('click', () => this.deleteSelectedKey());
        this.elements.saveKeyBtn.addEventListener('click', () => this.saveNewKey());
        this.elements.addKeyMenuItem.addEventListener('click', () => this.showAddKeyModal());
        this.elements.refreshMenuItem.addEventListener('click', () => this.refreshKeys());
        this.elements.disconnectMenuItem.addEventListener('click', () => this.disconnect());

        document.addEventListener('click', () => this.hideContextMenu());
        this.elements.redisTree.addEventListener('contextmenu', (e) => this.showContextMenu(e));
    }

    handleConnectionStatus(connectionId, status, error, delay) {
        console.log(`Handling connection status for ${connectionId}:`, { status, error, delay });
        
        const serverNode = document.querySelector(`[data-connection-id="${connectionId}"]`);
        if (!serverNode) {
            console.warn(`No server node found for connection ${connectionId}`);
            return;
        }

        const statusIndicator = serverNode.querySelector('.connection-status');
        if (statusIndicator) {
            console.log(`Updating status indicator for ${connectionId} to ${status}`);
            statusIndicator.className = `connection-status ${status}`;
            statusIndicator.title = this._getStatusMessage(status, error, delay);
        }

        switch (status) {
            case 'connected':
                if (connectionId === this.connectionManager.getCurrentConnectionId()) {
                    this.uiStateManager.showConnectedState();
                }
                break;

            case 'disconnected':
                if (connectionId === this.connectionManager.getCurrentConnectionId()) {
                    this.uiStateManager.showNormalState();
                    this.uiStateManager.updateButtonStates(false);
                    this.updateTree([]);
                }
                break;

            case 'error':
                this.uiStateManager.showNotification(`連線錯誤: ${error}`, 'error');
                break;

            case 'reconnecting':
                if (connectionId === this.connectionManager.getCurrentConnectionId()) {
                    this.uiStateManager.showConnectingState();
                }
                this.uiStateManager.showNotification(`正在重新連線... ${delay}ms 後重試`, 'info');
                break;
        }
    }

    _getStatusMessage(status, error, delay) {
        switch (status) {
            case 'connected': return '已連線';
            case 'disconnected': return '已斷開連線';
            case 'error': return `錯誤: ${error}`;
            case 'reconnecting': return `正在重新連線 (${delay}ms 後重試)`;
            default: return '未知狀態';
        }
    }

    async handleConnection() {
        const connectionInfo = {
            name: this.elements.serverName.value,
            host: this.elements.redisServer.value,
            port: this.elements.redisPort.value,
            password: this.elements.redisPassword.value,
            db: this.elements.redisDb.value
        };

        this.uiStateManager.showConnectingState();
        console.log('Attempting to connect to Redis server:', connectionInfo);

        const result = await this.connectionManager.connect(connectionInfo);
        if (result.success) {
            try {
                await this.refreshKeys();
                this.modal.hide();
                this.uiStateManager.updateButtonStates(true);
            } catch (error) {
                throw new Error(`連線成功但無法讀取資料: ${error.message}`);
            }
        } else {
            this.uiStateManager.showNormalState();
            this.uiStateManager.showNotification('連線失敗: ' + result.error);
            this.updateTree();
        }
    }

    async disconnect(connectionId = this.connectionManager.getCurrentConnectionId()) {
        const result = await this.connectionManager.disconnect(connectionId);
        if (result.success) {
            this.uiStateManager.updateButtonStates(false);
            this.updateTree([]);
            this.uiStateManager.showNormalState();
            this.uiStateManager.showNotification('已斷開連線', 'success');
        } else {
            this.uiStateManager.showNotification('斷開連線失敗: ' + result.error);
        }
    }

    resetConnectionForm() {
        this.elements.serverName.value = '';
        this.elements.redisServer.value = '';
        this.elements.redisPort.value = '6379';
        this.elements.redisPassword.value = '';
        this.elements.redisDb.value = '0';
        this.uiStateManager.showNormalState();
    }

    async refreshKeys() {
        const currentConnection = this.connectionManager.getCurrentConnection();
        if (!currentConnection || !currentConnection.client) {
            console.warn('No current connection to refresh keys');
            return;
        }

        try {
            const keyInfos = await this.redisOperations.getKeys(currentConnection.client);
            this.updateTree(keyInfos);
        } catch (error) {
            console.error('Error refreshing keys:', error);
            this.uiStateManager.showNotification(`無法獲取鍵值列表: ${error.message}`);
            throw error;
        }
    }

    updateTree(keyInfos = null) {
        const treeContainer = this.elements.redisTree;
        treeContainer.innerHTML = '';

        for (const [connectionId, connection] of this.connectionManager.getAllConnections()) {
            const isCurrentConnection = connectionId === this.connectionManager.getCurrentConnectionId();
            const { serverNode, expandIcon } = this.treeViewBuilder.buildServerNode(
                connection,
                connectionId,
                isCurrentConnection,
                keyInfos
            );

            this._setupTreeNodeEvents(serverNode, expandIcon);
            treeContainer.appendChild(serverNode);
        }
    }

    _setupTreeNodeEvents(serverNode, expandIcon) {
        const keysContainer = serverNode.querySelector('.keys-container');
        const connectionId = serverNode.getAttribute('data-connection-id');

        serverNode.querySelector('.server-header').addEventListener('click', async () => {
            const isExpanded = serverNode.classList.contains('expanded');
            this._collapseAllNodes(serverNode);

            if (!isExpanded) {
                await this._expandNode(serverNode, expandIcon, keysContainer, connectionId);
            }
        });

        const keyNodes = keysContainer.querySelectorAll('.key-node');
        keyNodes.forEach(keyNode => {
            keyNode.addEventListener('click', () => {
                const keyName = keyNode.querySelector('.key-name').textContent;
                this.selectKey(keyName);
            });
        });
    }

    _collapseAllNodes(exceptNode) {
        const allNodes = this.elements.redisTree.querySelectorAll('.server-node');
        allNodes.forEach(node => {
            if (node !== exceptNode) {
                node.classList.remove('expanded');
                node.querySelector('.expand-icon').innerHTML = '▶';
                node.querySelector('.keys-container').style.display = 'none';
            }
        });
    }

    async _expandNode(serverNode, expandIcon, keysContainer, connectionId) {
        serverNode.classList.add('expanded');
        expandIcon.innerHTML = '▼';
        keysContainer.style.display = 'block';

        if (this.connectionManager.getCurrentConnectionId() !== connectionId) {
            try {
                this.connectionManager.setCurrentConnection(connectionId);
                await this.refreshKeys();
            } catch (error) {
                console.error('Error switching connection:', error);
                this.uiStateManager.showNotification(`切換伺服器失敗: ${error.message}`);
                serverNode.classList.remove('expanded');
                expandIcon.innerHTML = '▶';
                keysContainer.style.display = 'none';
            }
        }
    }

    async selectKey(key) {
        const treeData = this.treeViewBuilder.getTreeData();
        const selectedKey = treeData.get(key);
        if (!selectedKey) return;

        const previousSelected = document.querySelector('.key-node.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        selectedKey.element.classList.add('selected');
        this.elements.deleteKeyBtn.disabled = false;

        const currentConnection = this.connectionManager.getCurrentConnection();
        const result = await this.redisOperations.getKeyInfo(currentConnection.client, key);
        if (result.success) {
            this.displayKeyContent(result.info);
        } else {
            this.uiStateManager.showNotification('無法取得鍵值資訊: ' + result.error);
        }
    }

    displayKeyContent(info) {
        const contentElement = this.elements.keyContent;
        let content = `
            <div class="mb-3">
                <strong>Key:</strong> ${info.key}<br>
                <strong>Type:</strong> ${info.type}<br>
                <strong>TTL:</strong> ${info.ttl === -1 ? 'No expiration' : info.ttl}
            </div>
            <div class="mb-3">
                <strong>Value:</strong><br>
                <pre class="bg-light p-3 rounded">${this._formatValue(info.type, info.value)}</pre>
            </div>
        `;
        contentElement.innerHTML = content;
    }

    _formatValue(type, value) {
        switch (type) {
            case 'string': return value;
            case 'list':
            case 'set': return JSON.stringify(value, null, 2);
            case 'hash': return JSON.stringify(value, null, 2);
            case 'zset':
                const formatted = {};
                for (let i = 0; i < value.length; i += 2) {
                    formatted[value[i]] = value[i + 1];
                }
                return JSON.stringify(formatted, null, 2);
            default: return 'Unsupported type';
        }
    }

    showAddKeyModal() {
        const modal = new bootstrap.Modal(document.getElementById('addKeyModal'));
        modal.show();
    }

    async saveNewKey() {
        const keyName = this.elements.keyName.value.trim();
        const keyType = this.elements.keyType.value;
        const keyValue = this.elements.keyValue.value.trim();

        if (!keyName || !keyValue) {
            this.uiStateManager.showNotification(!keyName ? '請輸入鍵名' : '請輸入值');
            return;
        }

        try {
            let value = this._parseKeyValue(keyType, keyValue);
            const currentConnection = this.connectionManager.getCurrentConnection();
            const result = await this.redisOperations.setKey(currentConnection.client, keyName, keyType, value);
            
            if (result.success) {
                bootstrap.Modal.getInstance(document.getElementById('addKeyModal')).hide();
                await this.refreshKeys();
                this.uiStateManager.showNotification('鍵值已儲存', 'success');
            } else {
                this.uiStateManager.showNotification('儲存失敗: ' + result.error);
            }
        } catch (error) {
            this.uiStateManager.showNotification('無效的值格式: ' + error.message);
        }
    }

    _parseKeyValue(keyType, keyValue) {
        let value = keyValue;
        switch (keyType) {
            case 'list':
            case 'set':
                value = JSON.parse(keyValue);
                if (!Array.isArray(value)) {
                    throw new Error('必須是JSON陣列格式');
                }
                break;
            case 'hash':
            case 'zset':
                value = JSON.parse(keyValue);
                if (typeof value !== 'object' || Array.isArray(value)) {
                    throw new Error('必須是JSON物件格式');
                }
                break;
        }
        return value;
    }

    async deleteSelectedKey() {
        const selectedNode = document.querySelector('.key-node.selected');
        if (!selectedNode) return;

        const keyName = selectedNode.querySelector('.key-name').textContent;
        
        // 顯示刪除確認對話框
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        document.getElementById('deleteKeyName').innerText = keyName;
        
        // 處理刪除確認
        const handleDelete = async () => {
            const currentConnection = this.connectionManager.getCurrentConnection();
            const result = await this.redisOperations.deleteKey(currentConnection.client, keyName);
            
            if (result.success) {
                await this.refreshKeys();
                this.elements.keyContent.innerHTML = '';
                this.elements.deleteKeyBtn.disabled = true;
                this.uiStateManager.showNotification('鍵值已刪除', 'success');
            } else {
                this.uiStateManager.showNotification('刪除失敗: ' + result.error);
            }

            deleteModal.hide();
            // 移除事件監聽器
            document.getElementById('confirmDeleteBtn').removeEventListener('click', handleDelete);
        };

        document.getElementById('confirmDeleteBtn').addEventListener('click', handleDelete);
        deleteModal.show();
    }

    showContextMenu(event) {
        event.preventDefault();
        const contextMenu = this.elements.serverContextMenu;
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
    }

    hideContextMenu() {
        this.elements.serverContextMenu.style.display = 'none';
    }
}

module.exports = RedisUIHandler;
