class TreeViewBuilder {
    constructor(treeContainer) {
        this.treeContainer = treeContainer;
        this.treeData = new Map();
    }

    buildServerNode(connection, connectionId, isCurrentConnection, keyInfos = null) {
        const serverNode = document.createElement('div');
        serverNode.className = 'server-node';
        serverNode.setAttribute('data-connection-id', connectionId);

        const serverHeader = this._createServerHeader(connection);
        const keysContainer = this._createKeysContainer(connectionId, isCurrentConnection, keyInfos);

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
        serverName.textContent = connection.name;
        serverName.title = connection.name;
        leftContainer.appendChild(serverName);

        return leftContainer;
    }

    _createRightContainer(connection) {
        const rightContainer = document.createElement('div');
        rightContainer.className = 'server-header-right';

        const serverInfo = document.createElement('span');
        serverInfo.className = 'server-info';
        const serverUrl = `${connection.host}:${connection.port}/db${connection.db}`;
        serverInfo.textContent = serverUrl;
        serverInfo.title = serverUrl;
        rightContainer.appendChild(serverInfo);

        return rightContainer;
    }

    _createStatusIndicator(connection) {
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'connection-status';
        
        if (connection.client) {
            try {
                const status = connection.client.status;
                this._updateStatusIndicator(statusIndicator, status);
            } catch (error) {
                console.error('Error checking Redis client status:', error);
                statusIndicator.classList.add('error');
                statusIndicator.title = '連線狀態檢查失敗';
            }
        } else {
            statusIndicator.classList.add('disconnected');
            statusIndicator.title = '未連線';
        }

        return statusIndicator;
    }

    _updateStatusIndicator(indicator, status) {
        switch(status) {
            case 'ready':
                indicator.classList.add('connected');
                indicator.title = '已連線';
                break;
            case 'connecting':
                indicator.classList.add('connecting');
                indicator.title = '正在連線...';
                break;
            case 'close':
            case 'end':
                indicator.classList.add('disconnected');
                indicator.title = '已斷開連線';
                break;
            default:
                indicator.title = '檢查連線狀態...';
        }
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
        
        const typeLabel = document.createElement('span');
        typeLabel.className = `type-label type-${type.toLowerCase()}`;
        typeLabel.textContent = type;
        keyNode.appendChild(typeLabel);

        const keyName = document.createElement('span');
        keyName.className = 'key-name';
        keyName.textContent = key;
        keyNode.appendChild(keyName);

        this.treeData.set(key, {
            element: keyNode,
            connectionId: connectionId,
            type: type,
            key: key
        });

        return keyNode;
    }

    getTreeData() {
        return this.treeData;
    }
}

module.exports = TreeViewBuilder;
