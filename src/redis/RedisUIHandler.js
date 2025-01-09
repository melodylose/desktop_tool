const { ipcRenderer } = require('electron');
const UIStateManager = require('./UIStateManager');
const TreeViewBuilder = require('./TreeViewBuilder');
const ConnectionManager = require('./ConnectionManager');

class RedisUIHandler {
    constructor(redisOperations) {
        this.redisOperations = redisOperations;
        this.elements = {};
        this.modal = null;
        this.addKeyModal = null;
        this.ipcRenderer = window.require('electron').ipcRenderer;
        this.initialized = false;

        this.connectionManager = new ConnectionManager(redisOperations);
        
        // 監聽連線狀態變化
        this.redisOperations.on('connection-status', ({ connectionId, status, error, delay }) => {
            // 確保 DOM 已經準備好才處理狀態更新
            if (this.initialized) {
                this.handleConnectionStatus(connectionId, { status, error, delay });
            } else {
                console.log('Skipping connection status update, UI not initialized yet');
            }
        });
    }

    initialize() {
        console.log('Redis UI Handler initializing...');
        try {
            this._initializeElements();
            this.uiStateManager = new UIStateManager(this.elements);
            this.treeViewBuilder = new TreeViewBuilder(this.elements.redisTree);
            this._initializeEventListeners();
            this._setupContextMenu();

            // 監聽頁面可見性變化
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    console.log('Page became visible, updating tree...');
                    this.updateTree();
                }
            });

            // 重新構建現有連線的樹狀視圖
            console.log('Updating initial tree view...');
            this.updateTree();

            // 標記初始化完成
            this.initialized = true;

            console.log('Redis UI Handler initialized successfully');
        } catch (error) {
            console.error('Error initializing Redis UI handler:', error);
            this.uiStateManager.showNotification('初始化失敗: ' + error.message, 'error');
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
            saveExistingKeyBtn: document.getElementById('saveExistingKeyBtn'),
            saveNewKeyBtn: document.getElementById('saveNewKeyBtn'),
            redisTree: document.getElementById('redisTree'),
            keyContent: document.getElementById('keyContent'),
            // 現有鍵值的表單元素
            keyName: document.getElementById('keyName'),
            keyType: document.getElementById('keyType'),
            keyValue: document.getElementById('keyValue'),
            // 新增鍵值的表單元素
            newKeyName: document.getElementById('newKeyName'),
            newKeyType: document.getElementById('newKeyType'),
            newKeyValue: document.getElementById('newKeyValue'),
            // 其他元素
            serverContextMenu: document.getElementById('serverContextMenu'),
            addKeyMenuItem: document.getElementById('addKeyMenuItem'),
            refreshMenuItem: document.getElementById('refreshMenuItem'),
            disconnectMenuItem: document.getElementById('disconnectMenuItem'),
            removeServerMenuItem: document.getElementById('removeServerMenuItem'),
            // modal 元素
            addKeyModal: document.getElementById('addKeyModal'),
            addServerModal: document.getElementById('addServerModal')
        };

        // 檢查必要的元素是否存在
        const requiredElements = [
            'addServerBtn', 'connectBtn', 'serverName', 'redisServer', 'redisPort',
            'redisDb', 'addKeyBtn', 'deleteKeyBtn', 'saveExistingKeyBtn', 'saveNewKeyBtn',
            'redisTree', 'keyContent', 'serverContextMenu', 'keyName', 'keyType', 'keyValue',
            'newKeyName', 'newKeyType', 'newKeyValue', 'addKeyModal'
        ];

        for (const key of requiredElements) {
            if (!this.elements[key]) {
                throw new Error(`Required element ${key} not found`);
            }
        }

        // 初始化 modals
        this.modal = new bootstrap.Modal(this.elements.addServerModal);
        this.addKeyModal = new bootstrap.Modal(this.elements.addKeyModal);
    }

    _initializeEventListeners() {
        console.log('Initializing event listeners...');
        
        this.elements.addServerBtn.addEventListener('click', () => {
            this.resetConnectionForm();
            this.modal.show();
        });

        this.elements.connectBtn.addEventListener('click', () => this.handleConnection());
        this.elements.addKeyBtn.addEventListener('click', () => this.showAddKeyModal());
        this.elements.deleteKeyBtn.addEventListener('click', () => this.deleteSelectedKey());
        
        // 為儲存按鈕添加事件監聽器
        console.log('Setting up save buttons listeners');
        
        // 新增鍵值的儲存按鈕
        this.elements.saveNewKeyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Save new key button clicked');
            await this.saveNewKey();
        });

        // 現有鍵值的儲存按鈕
        this.elements.saveExistingKeyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Save existing key button clicked');
            await this.saveExistingKey();
        });

        this.elements.addKeyMenuItem.addEventListener('click', () => this.showAddKeyModal());
        this.elements.refreshMenuItem.addEventListener('click', () => this.refreshKeys());
        this.elements.disconnectMenuItem.addEventListener('click', () => this.disconnect());
        this.elements.removeServerMenuItem.addEventListener('click', () => this.removeServer());

        document.addEventListener('click', () => this.hideContextMenu());
        this.elements.redisTree.addEventListener('contextmenu', (e) => this.showContextMenu(e));
    }

    async handleConnectionStatus(connectionId, { status, error, delay }) {
        console.log('Handling connection status for', connectionId + ':', { status, error, delay });
        
        // 獲取現有節點
        const serverNode = document.querySelector(`.server-node[data-connection-id="${connectionId}"]`);
        const statusIndicator = serverNode ? serverNode.querySelector('.connection-status') : null;

        // 如果節點不存在，觸發樹狀圖更新
        if (!serverNode || !statusIndicator) {
            console.log('Node not found, updating tree...');
            this.updateTree().catch(err => {
                console.error('Error updating tree:', err);
            });
            return;
        }

        // 更新狀態指示器
        statusIndicator.classList.remove('connected', 'connecting', 'disconnected', 'error');

        switch (status) {
            case 'ready':
                statusIndicator.classList.add('connected');
                statusIndicator.title = '已連線';
                // 連線成功時更新樹狀圖以顯示鍵值
                this.updateTree().catch(err => {
                    console.error('Error updating tree after connection:', err);
                });
                break;
            case 'connecting':
            case 'reconnecting':
                statusIndicator.classList.add('connecting');
                statusIndicator.title = delay ? `正在重新連線 (${delay}ms 後)` : '正在連線...';
                break;
            case 'error':
                statusIndicator.classList.add('error');
                statusIndicator.title = `錯誤: ${error || '未知錯誤'}`;
                break;
            case 'end':
            case 'close':
            case 'disconnected':
                statusIndicator.classList.add('disconnected');
                statusIndicator.title = '已斷開連線';
                break;
            default:
                statusIndicator.classList.add('error');
                statusIndicator.title = '狀態未知';
                break;
        }

        // 更新按鈕狀態
        if (connectionId === this.redisOperations.getCurrentConnectionId()) {
            const connection = this.redisOperations.connections.get(connectionId);
            this.uiStateManager.updateButtonStatesForConnection(connection);
        }
    }

    async updateTree() {
        // 確保 DOM 元素存在
        if (!this.elements.redisTree) {
            console.warn('Tree element not found, skipping update');
            return;
        }

        const treeBuilder = new TreeViewBuilder(this.elements.redisTree);
        const currentConnection = this.redisOperations.getCurrentConnection();
        
        try {
            // 清空現有內容
            this.elements.redisTree.innerHTML = '';
            
            // 遍歷所有連線並建立節點
            for (const [connectionId, connection] of this.redisOperations.connections) {
                console.log('Building server node:', connectionId, connection);
                
                // 只有在連線狀態為 ready 或是 end/close/error 時才建立節點
                // 避免在 connecting/reconnecting 狀態時建立重複節點
                if (!['ready', 'end', 'close', 'error'].includes(connection.status)) {
                    console.log('Skipping node creation for status:', connection.status);
                    continue;
                }
                
                let keyInfos = null;
                if (connection.status === 'ready' && connection.client) {
                    try {
                        keyInfos = await this.redisOperations.getKeys(connection.client);
                    } catch (error) {
                        console.error('Error getting keys:', error);
                        // 如果獲取 keys 失敗，跳過此節點的建立
                        continue;
                    }
                }
                
                const { serverNode, expandIcon } = treeBuilder.buildServerNode(
                    connection,
                    connectionId,
                    currentConnection && currentConnection.client === connection.client,
                    keyInfos
                );
                
                // 確保節點被添加到樹狀圖中
                if (serverNode) {
                    this.elements.redisTree.appendChild(serverNode);
                    // 設置節點展開/收合事件
                    this._setupTreeNodeEvents(serverNode, expandIcon);
                    
                    // 如果是當前連線，更新按鈕狀態
                    if (currentConnection && currentConnection.client === connection.client) {
                        this.uiStateManager.updateButtonStatesForConnection(connection);
                    }
                } else {
                    console.error('Failed to create server node for:', connectionId);
                }
            }
            
            // 綁定事件處理器
            treeBuilder.bindKeyNodeEvents((key, connectionId) => {
                this.handleKeySelect(key, connectionId);
            });
        } catch (error) {
            console.error('Error updating tree:', error);
            throw error;
        }
    }

    async handleConnection() {
        const connectionInfo = {
            name: this.elements.serverName.value,
            host: this.elements.redisServer.value,
            port: parseInt(this.elements.redisPort.value, 10),
            password: this.elements.redisPassword.value,
            db: parseInt(this.elements.redisDb.value, 10)
        };

        this.uiStateManager.showConnectingState();
        console.log('Attempting to connect to Redis server:', connectionInfo);

        try {
            const client = await this.redisOperations.connect(connectionInfo);
            if (client) {
                this.modal.hide();
                this.uiStateManager.updateButtonStates(true);
                this.uiStateManager.showConnectedState();
                this.uiStateManager.showNotification('連線成功', 'success');
            }
        } catch (error) {
            console.error('Connection failed:', error);
            this.uiStateManager.showNormalState();
            this.uiStateManager.showNotification('連線失敗: ' + error.message, 'error');
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

    async handleReconnect(connectionId) {
        try {
            const serverNode = document.querySelector(`.server-node[data-connection-id="${connectionId}"]`);
            if (!serverNode) {
                console.error('Server node not found:', connectionId);
                return;
            }

            // 更新UI狀態為正在連線中
            const statusIndicator = serverNode.querySelector('.connection-status');
            if (statusIndicator) {
                statusIndicator.className = 'connection-status connecting';
                statusIndicator.title = '正在重新連線...';
            }

            // 嘗試重新連線
            await this.redisOperations.reconnectToServer(connectionId);
            
            // 連線成功
            this.uiStateManager.showNotification('success', '重新連線成功！');
            
            // 更新狀態指示器
            if (statusIndicator) {
                statusIndicator.className = 'connection-status connected';
                statusIndicator.title = '已連線';
            }
            
            // 只在連線成功時更新樹狀圖
            const connection = this.redisOperations.connections.get(connectionId);
            if (connection && connection.status === 'ready') {
                await this.updateTree();
            }
            
        } catch (error) {
            console.error('Error reconnecting to server:', error);
            // 顯示錯誤訊息
            this.uiStateManager.showNotification('error', `重新連線失敗: ${error.message}`);
            
            // 更新UI狀態為錯誤
            const statusIndicator = serverNode.querySelector('.connection-status');
            if (statusIndicator) {
                statusIndicator.className = 'connection-status error';
                statusIndicator.title = `重新連線失敗: ${error.message}`;
            }
        }
    }

    async handleDisconnect(connectionId) {
        try {
            const serverNode = document.querySelector(`.server-node[data-connection-id="${connectionId}"]`);
            if (!serverNode) {
                console.error('Server node not found:', connectionId);
                return;
            }

            // 更新UI狀態為正在斷開連線
            const statusIndicator = serverNode.querySelector('.connection-status');
            if (statusIndicator) {
                statusIndicator.className = 'connection-status';
                statusIndicator.title = '正在斷開連線...';
            }

            // 斷開連線
            await this.redisOperations.disconnectFromServer(connectionId);
            
            // 更新UI
            this.updateTree();
            
        } catch (error) {
            console.error('Error disconnecting from server:', error);
            this.showNotification('error', `斷開連線失敗: ${error.message}`);
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
        console.log('Refreshing keys...');
        console.log('ConnectionManager current connection:', this.connectionManager.getCurrentConnectionId());
        console.log('RedisOperations current connection:', this.redisOperations.getCurrentConnectionId());
        
        const currentConnection = this.connectionManager.getCurrentConnection();
        console.log('Current connection:', currentConnection);
        
        if (!currentConnection || !currentConnection.client) {
            console.warn('No current connection to refresh keys');
            return;
        }

        try {
            const keyInfos = await this.redisOperations.getKeys(currentConnection.client);
            const connectionId = this.connectionManager.getCurrentConnectionId();
            const serverNode = document.querySelector(`.server-node[data-connection-id="${connectionId}"]`);
            if (serverNode) {
                const keysContainer = serverNode.querySelector('.keys-container');
                if (keysContainer) {
                    // 清空現有的鍵值
                    keysContainer.innerHTML = '';
                    // 使用 TreeViewBuilder 重新填充鍵值
                    const treeBuilder = new TreeViewBuilder(this.elements.redisTree);
                    treeBuilder._populateKeysContainer(keysContainer, keyInfos, connectionId);
                    
                    // 重新綁定鍵值節點事件，只綁定當前的 keysContainer
                    treeBuilder.bindKeyNodeEvents((key, connId) => {
                        console.log('Key node clicked:', key, 'connection:', connId);
                        this.handleKeySelect(key, connId);
                    }, keysContainer);
                }
            }
        } catch (error) {
            console.error('Error refreshing keys:', error);
            this.uiStateManager.showNotification(`無法獲取鍵值列表: ${error.message}`);
            throw error;
        }
    }

    async handleKeySelect(key, connectionId) {
        console.log('Handling key select:', key, 'for connection:', connectionId);
        
        try {
            const connection = this.redisOperations.connections.get(connectionId);
            if (!connection || !connection.client) {
                throw new Error('連線不存在或已斷開');
            }

            // 取得鍵值內容
            const info = await this.redisOperations.getKeyInfo(connection.client, key);
            if (info) {
                this.displayKeyContent(info);
            } else {
                throw new Error('無法取得鍵值內容');
            }
        } catch (error) {
            console.error('Error handling key select:', error);
            this.uiStateManager.showNotification('取得鍵值內容失敗: ' + error.message, 'error');
        }
    }

    displayKeyContent(info) {
        const { key, type, value } = info;
        console.log('Displaying key content:', info);
        
        try {
            // 隱藏提示訊息
            const placeholder = document.getElementById('keyContentPlaceholder');
            const form = document.getElementById('keyContentForm');
            if (placeholder && form) {
                placeholder.style.display = 'none';
                form.style.display = 'block';
            }

            // 更新類型選擇器
            this.elements.keyType.value = type;
            
            // 更新鍵值名稱
            this.elements.keyName.value = key;
            
            // 更新值內容
            this.elements.keyValue.value = this._formatValue(type, value);
            
            // 更新按鈕狀態
            this.elements.deleteKeyBtn.disabled = false;
            this.elements.saveExistingKeyBtn.disabled = false;
            
            console.log('Key content displayed successfully');
        } catch (error) {
            console.error('Error displaying key content:', error);
            this.uiStateManager.showNotification('顯示鍵值內容時發生錯誤', 'error');
        }
    }

    _formatValue(type, value) {
        if (!value) return '';
        
        try {
            switch (type) {
                case 'string':
                    try {
                        // 嘗試解析為 JSON
                        const parsed = JSON.parse(value);
                        return JSON.stringify(parsed, null, 2);
                    } catch {
                        // 如果不是 JSON，直接返回原值
                        return value;
                    }
                case 'list':
                case 'set':
                    if (Array.isArray(value)) {
                        try {
                            // 嘗試解析每個元素為 JSON
                            const parsedArray = value.map(item => {
                                try {
                                    return JSON.parse(item);
                                } catch {
                                    return item;
                                }
                            });
                            return JSON.stringify(parsedArray, null, 2);
                        } catch {
                            return JSON.stringify(value, null, 2);
                        }
                    }
                    return String(value);
                case 'hash':
                    try {
                        // 將 hash 轉換為格式化的 JSON
                        const formattedHash = {};
                        for (const [k, v] of Object.entries(value)) {
                            try {
                                formattedHash[k] = JSON.parse(v);
                            } catch {
                                formattedHash[k] = v;
                            }
                        }
                        return JSON.stringify(formattedHash, null, 2);
                    } catch {
                        return JSON.stringify(value, null, 2);
                    }
                case 'zset':
                    if (Array.isArray(value)) {
                        try {
                            // 將 zset 轉換為格式化的物件
                            const formattedZSet = {};
                            for (let i = 0; i < value.length; i += 2) {
                                const member = value[i];
                                const score = value[i + 1];
                                try {
                                    formattedZSet[member] = parseFloat(score);
                                } catch {
                                    formattedZSet[member] = score;
                                }
                            }
                            return JSON.stringify(formattedZSet, null, 2);
                        } catch {
                            return JSON.stringify(value, null, 2);
                        }
                    }
                    return String(value);
                default:
                    return JSON.stringify(value, null, 2);
            }
        } catch (error) {
            console.error('Error formatting value:', error);
            return String(value);
        }
    }

    _setupTreeNodeEvents(serverNode, expandIcon) {
        const keysContainer = serverNode.querySelector('.keys-container');
        const connectionId = serverNode.getAttribute('data-connection-id');

        expandIcon.addEventListener('click', async (event) => {
            event.stopPropagation(); // 防止事件冒泡到 server-header
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
        console.log('Expanding node for connection:', connectionId);
        serverNode.classList.add('expanded');
        expandIcon.innerHTML = '▼';
        keysContainer.style.display = 'block';

        if (this.connectionManager.getCurrentConnectionId() !== connectionId) {
            console.log('Switching current connection from', this.connectionManager.getCurrentConnectionId(), 'to', connectionId);
            try {
                const success = this.connectionManager.setCurrentConnection(connectionId);
                console.log('Set current connection result:', success);
                if (!success) {
                    throw new Error('Failed to set current connection');
                }
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

    showAddKeyModal() {
        console.log('Showing add key modal');
        // 重置表單
        this.elements.newKeyName.value = '';
        this.elements.newKeyType.value = 'string';
        this.elements.newKeyValue.value = '';
        
        // 啟用新增鍵值的儲存按鈕
        this.elements.saveNewKeyBtn.disabled = false;
        
        // 顯示 modal
        this.addKeyModal.show();
    }

    async saveNewKey() {
        console.log('Saving new key...');
        const keyName = this.elements.newKeyName.value.trim();
        const keyType = this.elements.newKeyType.value;
        const keyValue = this.elements.newKeyValue.value.trim();

        console.log('Key data:', { keyName, keyType, keyValue });

        if (!keyName || !keyValue) {
            console.warn('Missing key name or value');
            this.uiStateManager.showNotification(!keyName ? '請輸入鍵名' : '請輸入值');
            return;
        }

        try {
            console.log('Parsing key value...');
            let value = this._parseKeyValue(keyType, keyValue);
            console.log('Parsed value:', value);

            const currentConnection = this.connectionManager.getCurrentConnection();
            console.log('Current connection:', currentConnection);

            if (!currentConnection || !currentConnection.client) {
                console.error('No current connection available');
                this.uiStateManager.showNotification('沒有可用的連線');
                return;
            }

            console.log('Setting key in Redis...');
            const result = await this.redisOperations.setKey(currentConnection.client, keyName, keyType, value);
            console.log('Set key result:', result);
            
            if (result.success) {
                console.log('Key saved successfully, hiding modal...');
                const modal = bootstrap.Modal.getInstance(document.getElementById('addKeyModal'));
                if (modal) {
                    modal.hide();
                } else {
                    console.error('Modal instance not found');
                }
                
                console.log('Refreshing keys...');
                await this.refreshKeys();
                this.uiStateManager.showNotification('鍵值已儲存', 'success');
            } else {
                console.error('Failed to save key:', result.error);
                this.uiStateManager.showNotification('儲存失敗: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving key:', error);
            this.uiStateManager.showNotification('無效的值格式: ' + error.message);
        }
    }

    async saveExistingKey() {
        console.log('Saving existing key...');
        const keyName = this.elements.keyName.value.trim();
        const keyType = this.elements.keyType.value;
        const keyValue = this.elements.keyValue.value.trim();

        console.log('Key data:', { keyName, keyType, keyValue });

        if (!keyName || !keyValue) {
            console.warn('Missing key name or value');
            this.uiStateManager.showNotification(!keyName ? '請輸入鍵名' : '請輸入值');
            return;
        }

        try {
            console.log('Parsing key value...');
            let value = this._parseKeyValue(keyType, keyValue);
            console.log('Parsed value:', value);

            const currentConnection = this.connectionManager.getCurrentConnection();
            console.log('Current connection:', currentConnection);

            if (!currentConnection || !currentConnection.client) {
                console.error('No current connection available');
                this.uiStateManager.showNotification('沒有可用的連線');
                return;
            }

            console.log('Setting key in Redis...');
            const result = await this.redisOperations.setKey(currentConnection.client, keyName, keyType, value);
            console.log('Set key result:', result);
            
            if (result.success) {
                console.log('Key saved successfully...');
                this.uiStateManager.showNotification('鍵值已儲存', 'success');
            } else {
                console.error('Failed to save key:', result.error);
                this.uiStateManager.showNotification('儲存失敗: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving key:', error);
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
        console.log('Deleting selected key...');
        const selectedNode = document.querySelector('.key-node.selected');
        if (!selectedNode) {
            console.warn('No key selected');
            return;
        }

        const keyName = selectedNode.querySelector('.key-name').textContent;
        console.log('Selected key:', keyName);
        
        // 顯示刪除確認對話框
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        const deleteKeyNameElement = document.getElementById('deleteKeyName');
        
        if (!deleteKeyNameElement) {
            console.error('Delete key name element not found');
            this.uiStateManager.showNotification('無法顯示刪除確認對話框');
            return;
        }

        // 設置要刪除的鍵名
        deleteKeyNameElement.textContent = keyName;
        
        // 移除舊的事件監聽器（如果存在）
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const oldHandleDelete = confirmBtn.handleDelete;
        if (oldHandleDelete) {
            confirmBtn.removeEventListener('click', oldHandleDelete);
        }
        
        // 處理刪除確認
        const handleDelete = async () => {
            console.log('Confirming delete for key:', keyName);
            try {
                const currentConnection = this.connectionManager.getCurrentConnection();
                if (!currentConnection || !currentConnection.client) {
                    throw new Error('沒有可用的連線');
                }

                const result = await this.redisOperations.deleteKey(currentConnection.client, keyName);
                console.log('Delete result:', result);
                
                if (result.success) {
                    await this.refreshKeys();
                    this.resetKeyContent();
                    this.uiStateManager.showNotification('鍵值已刪除', 'success');
                } else {
                    throw new Error(result.error || '刪除失敗');
                }
            } catch (error) {
                console.error('Error deleting key:', error);
                this.uiStateManager.showNotification('刪除失敗: ' + error.message);
            } finally {
                deleteModal.hide();
                // 移除事件監聽器
                confirmBtn.removeEventListener('click', handleDelete);
                delete confirmBtn.handleDelete;
            }
        };

        // 儲存事件處理函數的引用以便之後移除
        confirmBtn.handleDelete = handleDelete;
        confirmBtn.addEventListener('click', handleDelete);
        
        // 顯示確認對話框
        deleteModal.show();
    }

    async showContextMenu(event) {
        event.preventDefault();
        
        // 找到最近的伺服器節點
        const serverNode = event.target.closest('.server-node');
        if (!serverNode) return;
        
        // 保存選中的連線 ID
        this.selectedConnectionId = serverNode.getAttribute('data-connection-id');
        
        // 設置選單位置
        const menu = this.elements.serverContextMenu;
        menu.style.display = 'block';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        
        // 防止選單超出視窗
        const menuRect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (menuRect.right > windowWidth) {
            menu.style.left = `${windowWidth - menuRect.width}px`;
        }
        if (menuRect.bottom > windowHeight) {
            menu.style.top = `${windowHeight - menuRect.height}px`;
        }
    }

    hideContextMenu() {
        if (this.elements.serverContextMenu) {
            this.elements.serverContextMenu.style.display = 'none';
        }
    }

    async removeServer() {
        const connectionId = this.selectedConnectionId;
        if (!connectionId) {
            console.error('No server selected');
            return;
        }

        // 顯示確認對話框
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        // 設置確認按鈕的點擊事件
        const handleConfirm = async () => {
            try {
                deleteModal.hide();
                confirmDeleteBtn.removeEventListener('click', handleConfirm);

                const result = await this.redisOperations.removeServer(connectionId);
                if (result.success) {
                    // 更新樹狀圖
                    this.updateTree();
                    this.uiStateManager.showNotification('伺服器已移除', 'success');
                    
                    // 重置 UI 狀態
                    this.uiStateManager.showNormalState();
                    this.selectedConnectionId = null;
                    
                    // 清空鍵值內容區域
                    const placeholder = document.getElementById('keyContentPlaceholder');
                    const form = document.getElementById('keyContentForm');
                    if (placeholder && form) {
                        placeholder.style.display = 'block';
                        form.style.display = 'none';
                    }
                } else {
                    this.uiStateManager.showNotification('移除伺服器失敗: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error removing server:', error);
                this.uiStateManager.showNotification('移除伺服器時發生錯誤: ' + error.message, 'error');
            }
        };

        confirmDeleteBtn.addEventListener('click', handleConfirm);
        deleteModal.show();
    }

    _setupContextMenu() {
        // 新增重新連線選單項目
        const reconnectMenuItem = document.createElement('a');
        reconnectMenuItem.className = 'dropdown-item';
        reconnectMenuItem.href = '#';
        reconnectMenuItem.innerHTML = '<i class="fas fa-plug-circle-check me-2"></i>重新連線';
        reconnectMenuItem.style.display = 'none';
        
        // 將重新連線選單項加入到中斷連線選單項之前
        this.elements.disconnectMenuItem.parentNode.insertBefore(reconnectMenuItem, this.elements.disconnectMenuItem);
        
        // 獲取分隔線元素
        const divider = document.querySelector('#serverContextMenu .dropdown-divider');
        
        document.addEventListener('contextmenu', (e) => {
            // 找到最近的伺服器節點
            const serverNode = e.target.closest('.server-node');
            if (!serverNode) return;
            
            e.preventDefault();
            
            const connectionId = serverNode.getAttribute('data-connection-id');
            const connection = this.redisOperations.connections.get(connectionId);
            
            if (connection) {
                // 獲取狀態指示器的當前狀態
                const statusIndicator = serverNode.querySelector('.connection-status');
                const hasDisconnectedClass = statusIndicator && 
                    (statusIndicator.classList.contains('disconnected') || 
                     statusIndicator.classList.contains('error'));
                const hasConnectedClass = statusIndicator && 
                    statusIndicator.classList.contains('connected');

                console.log('Status indicator classes:', statusIndicator ? statusIndicator.className : 'not found');
                
                // 根據連線狀態顯示/隱藏選單項目
                if (hasDisconnectedClass) {
                    // 斷開狀態：只顯示重新連線選項
                    reconnectMenuItem.style.display = 'block';
                    reconnectMenuItem.onclick = () => this.handleReconnect(connectionId);
                    
                    this.elements.addKeyMenuItem.style.display = 'none';
                    this.elements.refreshMenuItem.style.display = 'none';
                    this.elements.disconnectMenuItem.style.display = 'none';
                    divider.style.display = 'none';  // 隱藏分隔線
                } else if (hasConnectedClass) {
                    // 連線狀態：顯示一般操作選項，隱藏重新連線
                    reconnectMenuItem.style.display = 'none';
                    
                    this.elements.addKeyMenuItem.style.display = 'block';
                    this.elements.refreshMenuItem.style.display = 'block';
                    this.elements.disconnectMenuItem.style.display = 'block';
                    divider.style.display = 'block';  // 顯示分隔線
                    
                    // 設定一般操作選項的事件處理
                    this.elements.disconnectMenuItem.onclick = () => this.handleDisconnect(connectionId);
                    this.elements.refreshMenuItem.onclick = () => this.updateTree();
                    // TODO: 實作新增鍵值的功能
                    this.elements.addKeyMenuItem.onclick = () => console.log('Add key clicked');
                }
            }

            // 顯示選單
            this.elements.serverContextMenu.style.display = 'block';
            this.elements.serverContextMenu.style.left = e.pageX + 'px';
            this.elements.serverContextMenu.style.top = e.pageY + 'px';
        });

        // 點擊其他地方時隱藏選單
        document.addEventListener('click', () => {
            this.elements.serverContextMenu.style.display = 'none';
        });
    }

    resetKeyContent() {
        console.log('Resetting key content');
        // 顯示提示訊息
        const placeholder = document.getElementById('keyContentPlaceholder');
        const form = document.getElementById('keyContentForm');
        if (placeholder && form) {
            placeholder.style.display = 'block';
            form.style.display = 'none';
        }

        // 重置表單
        this.elements.keyName.value = '';
        this.elements.keyType.value = 'string';
        this.elements.keyValue.value = '';

        // 禁用按鈕
        this.elements.deleteKeyBtn.disabled = true;
        this.elements.saveExistingKeyBtn.disabled = true;
    }
}

module.exports = RedisUIHandler;
