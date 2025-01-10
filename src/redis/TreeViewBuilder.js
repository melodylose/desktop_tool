class TreeViewBuilder {
    constructor(treeContainer) {
        this.treeContainer = treeContainer;
        this.treeData = new Map();
    }

    buildServerNode(connection, connectionId, isCurrentConnection, keyInfos = null) {
        console.log('Building server node:', connectionId, connection);
        
        const serverNode = document.createElement('div');
        serverNode.className = 'server-node';
        serverNode.setAttribute('data-connection-id', connectionId);

        const serverHeader = this._createServerHeader(connection);
        const keysContainer = this._createKeysContainer(connectionId, isCurrentConnection, keyInfos);

        // 如果已經存在相同的節點，先移除它
        const existingNode = this.treeContainer.querySelector(`.server-node[data-connection-id="${connectionId}"]`);
        if (existingNode) {
            console.log('Removing existing node:', connectionId);
            existingNode.remove();
        }

        serverNode.appendChild(serverHeader);
        serverNode.appendChild(keysContainer);

        return { serverNode, expandIcon: serverHeader.querySelector('.expand-icon') };
    }

    _createServerHeader(connection) {
        const serverHeader = document.createElement('div');
        serverHeader.className = 'server-header';

        const leftContainer = this._createLeftContainer(connection);
        const rightContainer = this._createRightContainer(connection);

        serverHeader.appendChild(leftContainer);
        serverHeader.appendChild(rightContainer);

        return serverHeader;
    }

    _createLeftContainer(connection) {
        const leftContainer = document.createElement('div');
        leftContainer.className = 'server-header-left';

        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.innerHTML = '▶';
        leftContainer.appendChild(expandIcon);

        const statusIndicator = this._createStatusIndicator(connection);
        leftContainer.appendChild(statusIndicator);

        const serverName = document.createElement('span');
        serverName.className = 'server-name';
        serverName.textContent = connection.name || connection.config.name;
        serverName.title = connection.name || connection.config.name;
        leftContainer.appendChild(serverName);

        return leftContainer;
    }

    _createRightContainer(connection) {
        const rightContainer = document.createElement('div');
        rightContainer.className = 'server-header-right';

        const serverInfo = document.createElement('span');
        serverInfo.className = 'server-info';
        const host = connection.config.host || 'localhost';
        const port = connection.config.port || 6379;
        const db = connection.config.db || 0;
        const serverUrl = `${host}:${port}/db${db}`;
        serverInfo.textContent = serverUrl;
        serverInfo.title = serverUrl;
        rightContainer.appendChild(serverInfo);

        return rightContainer;
    }

    _createStatusIndicator(connection) {
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'connection-status';
        
        // 使用連線對象的狀態屬性
        const status = connection.status || 'disconnected';
        let title = '未連線';

        // 移除所有可能的狀態類別
        statusIndicator.classList.remove('connected', 'connecting', 'disconnected', 'error');

        switch(status) {
            case 'ready':
                title = '已連線';
                statusIndicator.classList.add('connected');
                break;
            case 'connecting':
            case 'reconnecting':
                title = '正在連線...';
                statusIndicator.classList.add('connecting');
                break;
            case 'error':
                title = connection.error || '連線錯誤';
                statusIndicator.classList.add('error');
                break;
            case 'end':
            case 'close':
            case 'disconnected':
                title = '已斷開連線';
                statusIndicator.classList.add('disconnected');
                break;
            default:
                title = '狀態未知';
                statusIndicator.classList.add('error');
        }

        console.log('Status indicator created:', {
            status,
            title,
            className: statusIndicator.className
        });

        statusIndicator.title = title;
        return statusIndicator;
    }

    _createKeysContainer(connectionId, isCurrentConnection, keyInfos) {
        const keysContainer = document.createElement('div');
        keysContainer.className = 'keys-container';
        keysContainer.style.display = 'none';

        if (isCurrentConnection && Array.isArray(keyInfos)) {
            this._populateKeysContainer(keysContainer, keyInfos, connectionId);
        }

        return keysContainer;
    }

    _populateKeysContainer(container, keyInfos, connectionId) {
        container.style.display = 'block';

        for (const { key, type } of keyInfos) {
            const keyNode = this._createKeyNode(key, type, connectionId);
            container.appendChild(keyNode);
        }
    }

    _createKeyNode(key, type, connectionId) {
        const keyNode = document.createElement('div');
        keyNode.className = 'key-node';
        
        // Normalize type for JSON
        const normalizedType = type.toLowerCase() === 'rejson-rl' ? 'json' : type;
        
        // Add key type icon
        const keyIcon = document.createElement('span');
        keyIcon.className = `key-icon key-icon-${normalizedType.toLowerCase()}`;
        keyNode.appendChild(keyIcon);
        
        const typeLabel = document.createElement('span');
        typeLabel.className = `type-label type-${normalizedType.toLowerCase()}`;
        typeLabel.textContent = type;
        keyNode.appendChild(typeLabel);

        const keyName = document.createElement('span');
        keyName.className = 'key-name';
        keyName.textContent = key;
        keyNode.appendChild(keyName);

        // 儲存節點資訊
        keyNode.dataset.key = key;
        keyNode.dataset.type = type;
        keyNode.dataset.connectionId = connectionId;

        this.treeData.set(key, {
            element: keyNode,
            connectionId: connectionId,
            type: type,
            key: key
        });

        return keyNode;
    }

    bindKeyNodeEvents(onKeySelect, container = null) {
        console.log('Binding key node events...');
        const targetContainer = container || this.treeContainer;
        const keyNodes = targetContainer.querySelectorAll('.key-node');
        console.log('Found key nodes:', keyNodes.length);
        
        keyNodes.forEach(keyNode => {
            keyNode.addEventListener('click', () => {
                console.log('Key node clicked');
                // 移除其他節點的選中狀態
                this.treeContainer.querySelectorAll('.key-node.selected').forEach(node => {
                    if (node !== keyNode) {
                        node.classList.remove('selected');
                    }
                });
                
                // 添加選中狀態
                keyNode.classList.add('selected');
                
                // 呼叫選擇處理函數
                const key = keyNode.dataset.key;
                const connectionId = keyNode.dataset.connectionId;
                console.log('Key node data:', { key, connectionId });
                
                if (key && connectionId && onKeySelect) {
                    console.log('Calling onKeySelect handler');
                    onKeySelect(key, connectionId);
                } else {
                    console.warn('Missing key data or handler:', { 
                        hasKey: !!key, 
                        hasConnectionId: !!connectionId, 
                        hasHandler: !!onKeySelect 
                    });
                }
            });
        });
    }

    getTreeData() {
        return this.treeData;
    }
}

module.exports = TreeViewBuilder;
