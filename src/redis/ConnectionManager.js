class ConnectionManager {
    constructor(redisOperations) {
        this.redisOperations = redisOperations;
        this.connections = new Map();
        
        // 從 RedisOperations 同步現有的連線
        this._syncConnections();
        
        // 監聽 RedisOperations 的連線狀態變化
        this.redisOperations.on('connection-status', ({ connectionId }) => {
            this._syncConnections();
        });
    }

    _syncConnections() {
        // 清空現有連線
        this.connections.clear();
        
        // 從 RedisOperations 同步所有連線
        for (const [connectionId, connection] of this.redisOperations.connections) {
            console.log('Syncing connection:', connectionId);
            this.connections.set(connectionId, {
                name: connection.name,
                host: connection.config.host,
                port: connection.config.port,
                db: connection.config.db,
                client: connection.client
            });
        }
        
        // 同步當前連線
        this.currentConnection = this.redisOperations.getCurrentConnectionId();
    }

    async connect(connectionInfo) {
        const { name, host, port, password, db } = connectionInfo;
        // 使用 RedisOperations 的連線 ID 生成方式
        const connectionId = this.redisOperations._generateConnectionId(host, port, db);

        try {
            const client = await this.redisOperations.connect({
                name,
                host,
                port: parseInt(port),
                password: password || undefined,
                db: parseInt(db)
            });

            // 連線成功後同步連線狀態
            this._syncConnections();
            return { success: true, connectionId };
        } catch (error) {
            console.error('Connection error:', error);
            return { success: false, error: error.message };
        }
    }

    async disconnect(connectionId = this.currentConnection) {
        if (this.connections.has(connectionId)) {
            const connection = this.connections.get(connectionId);
            try {
                await this.redisOperations.disconnectFromServer(connectionId);
                // 不要移除連線，只是更新狀態
                if (connectionId === this.currentConnection) {
                    this.currentConnection = null;
                }
                return { success: true };
            } catch (error) {
                console.error('Disconnect error:', error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: 'Connection not found' };
    }

    removeConnection(connectionId) {
        if (this.connections.has(connectionId)) {
            // 只在移除時才真正刪除連線
            this.connections.delete(connectionId);
            if (connectionId === this.currentConnection) {
                this.currentConnection = null;
            }
            return true;
        }
        return false;
    }

    getCurrentConnection() {
        if (!this.currentConnection) return null;
        return this.connections.get(this.currentConnection);
    }

    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }

    getAllConnections() {
        return this.connections;
    }

    getCurrentConnectionId() {
        return this.currentConnection;
    }

    setCurrentConnection(connectionId) {
        console.log('ConnectionManager.setCurrentConnection called with:', connectionId);
        // 先同步連線狀態
        this._syncConnections();
        console.log('Available connections after sync:', Array.from(this.connections.keys()));
        
        if (this.connections.has(connectionId)) {
            console.log('Connection found, setting current connection');
            this.currentConnection = connectionId;
            // 同步 RedisOperations 的當前連線
            this.redisOperations.setCurrentConnection(connectionId);
            return true;
        }
        console.log('Connection not found in ConnectionManager');
        return false;
    }

    /**
     * 移除伺服器連線
     * @param {string} connectionId - 連線 ID
     * @returns {Promise<{success: boolean, error?: string}>} - 操作結果
     */
    async removeServer(connectionId) {
        try {
            // 先斷開連線
            const disconnectResult = await this.disconnect(connectionId);
            if (!disconnectResult.success) {
                return disconnectResult;
            }

            // 從 RedisOperations 中移除連線
            await this.redisOperations.removeServer(connectionId);
            
            // 同步連線狀態
            this._syncConnections();
            
            return { success: true };
        } catch (error) {
            console.error('Remove server error:', error);
            return { success: false, error: error.message };
        }
    }

    getCurrentConnection() {
        if (!this.currentConnection) return null;
        return this.connections.get(this.currentConnection);
    }
}

module.exports = ConnectionManager;
