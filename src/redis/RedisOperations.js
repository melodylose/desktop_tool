const Redis = require('ioredis');
const EventEmitter = require('events');

class RedisOperations extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.currentConnectionId = null;
        this.connectionConfigs = new Map();
        
        // 從 localStorage 恢復連線配置
        this._restoreConnections();
    }

    _restoreConnections() {
        try {
            const savedConfigs = localStorage.getItem('redisConnections');
            if (savedConfigs) {
                const configs = JSON.parse(savedConfigs);
                configs.forEach(config => {
                    this.connectionConfigs.set(this._generateConnectionId(config.host, config.port, config.db), config);
                });
                
                // 自動重新連線
                this._reconnectAll();
            }
        } catch (error) {
            console.error('Error restoring connections:', error);
        }
    }

    async _reconnectAll() {
        for (const [connectionId, config] of this.connectionConfigs) {
            try {
                await this.connect(config);
            } catch (error) {
                console.error('Error reconnecting to:', connectionId, error);
            }
        }
    }

    _saveConnections() {
        try {
            const configs = Array.from(this.connectionConfigs.values());
            localStorage.setItem('redisConnections', JSON.stringify(configs));
        } catch (error) {
            console.error('Error saving connections:', error);
        }
    }

    _generateConnectionId(host, port, db) {
        // 使用一致的格式: host@port/db
        const normalizedHost = host || 'localhost';
        const normalizedPort = port || 6379;
        const normalizedDb = db || 0;
        const connectionId = `${normalizedHost}@${normalizedPort}/${normalizedDb}`;
        console.log('RedisOperations generating connection ID:', { host, port, db }, '=>', connectionId);
        return connectionId;
    }

    getCurrentConnection() {
        return this.currentConnectionId ? this.connections.get(this.currentConnectionId) : null;
    }

    getCurrentConnectionId() {
        return this.currentConnectionId;
    }

    getCurrentConnectionId() {
        return this.currentConnectionId;
    }

    _updateConnectionStatus(connectionId, status, error = null) {
        console.log('Updating connection status:', connectionId, status, error);
        const connection = this.connections.get(connectionId);
        if (connection) {
            // 如果狀態沒有變化，不觸發事件
            if (connection.status === status && connection.error === error) {
                return;
            }
            
            connection.status = status;
            if (error) {
                connection.error = error;
            } else {
                delete connection.error;
            }
            this.connections.set(connectionId, connection);
            
            // 發送狀態更新事件
            this.emit('connection-status', {
                connectionId,
                status,
                error
            });
        }
    }

    async connect(config) {
        const normalizedConfig = {
            host: config.host || 'localhost',
            port: parseInt(config.port || 6379),
            db: parseInt(config.db || 0),
            name: config.name,
            password: config.password
        };
        
        console.log('Creating new Redis connection:', normalizedConfig);
        
        const connectionId = this._generateConnectionId(
            normalizedConfig.host,
            normalizedConfig.port,
            normalizedConfig.db
        );
        
        // 保存連線配置
        this.connectionConfigs.set(connectionId, { ...normalizedConfig });
        this._saveConnections();
        
        // 如果已經存在連線，先斷開
        if (this.connections.has(connectionId)) {
            await this.disconnectFromServer(connectionId);
        }

        try {
            const client = new Redis({
                host: normalizedConfig.host,
                port: normalizedConfig.port,
                password: normalizedConfig.password,
                db: normalizedConfig.db,
                retryStrategy: this.retryStrategy.bind(this),
                maxRetriesPerRequest: null
            });

            // 設置連線事件處理器
            this.successHandler = this.successHandler.bind(this);
            this.errorHandler = this.errorHandler.bind(this);
            
            client.on('connect', () => this.successHandler(connectionId));
            client.on('error', (error) => {
                this.errorHandler(connectionId, error);
            });
            client.on('end', () => this._updateConnectionStatus(connectionId, 'end'));
            client.on('close', () => this._updateConnectionStatus(connectionId, 'close'));

            const displayName = normalizedConfig.name || 
                `Redis@${normalizedConfig.host}:${normalizedConfig.port}/db${normalizedConfig.db}`;

            // 保存連線
            this.connections.set(connectionId, {
                client,
                status: 'connecting',
                name: displayName,
                config: normalizedConfig
            });

            this.currentConnectionId = connectionId;
            this._updateConnectionStatus(connectionId, 'connecting');

            return client;
        } catch (error) {
            console.error('Error creating Redis connection:', error);
            this._updateConnectionStatus(connectionId, 'error', error);
            throw error;
        }
    }

    async disconnect(client) {
        try {
            console.log('Disconnecting Redis client');
            try {
                await client.quit();
            } catch (error) {
                console.log('Graceful disconnect failed, forcing disconnect:', error);
                client.disconnect(true);
            }
            
            for (const [connectionId, redis] of this.connections.entries()) {
                if (redis.client === client) {
                    this.connections.delete(connectionId);
                    break;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error disconnecting Redis client:', error);
            throw error;
        }
    }

    async disconnectFromServer(connectionId) {
        try {
            console.log('Disconnecting from Redis server:', connectionId);
            const connection = this.connections.get(connectionId);
            
            if (connection && connection.client) {
                await connection.client.disconnect();
                connection.status = 'disconnected';
                connection.client = null;
                
                // 保留連線配置，但更新狀態
                this._updateConnectionStatus(connectionId, 'disconnected');
                
                // 如果是當前連線，清除當前連線 ID
                if (this.currentConnectionId === connectionId) {
                    this.currentConnectionId = null;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error disconnecting from Redis server:', error);
            throw error;
        }
    }

    async getKeys(client) {
        try {
            const keys = await client.keys('*');
            const keyInfos = await Promise.all(keys.map(async (key) => {
                const type = await client.type(key);
                return { key, type };
            }));
            return keyInfos;
        } catch (error) {
            console.error('Error getting keys:', error);
            throw error;
        }
    }

    async getKeyInfo(client, key) {
        try {
            console.log('Getting info for key:', key);
            const type = await client.type(key);
            const ttl = await client.ttl(key);
            let value;

            switch (type.toLowerCase()) {
                case 'string':
                    value = await client.get(key);
                    break;
                case 'list':
                    value = await client.lrange(key, 0, -1);
                    break;
                case 'hash':
                    value = await client.hgetall(key);
                    break;
                case 'set':
                    value = await client.smembers(key);
                    break;
                case 'zset':
                    value = await client.zrange(key, 0, -1, 'WITHSCORES');
                    break;
                case 'stream':
                    try {
                        // 讀取stream的所有條目，從最舊的開始，限制100條
                        const result = await client.xrange(key, '-', '+', 'COUNT', 100);
                        value = result.map(entry => ({
                            id: entry[0],
                            fields: entry[1]
                        }));
                    } catch (streamError) {
                        console.error('Error getting stream value:', streamError);
                        value = [];
                    }
                    break;
                case 'rejson-rl':
                    try {
                        const jsonStr = await client.call('JSON.GET', key, '$');
                        value = jsonStr ? JSON.parse(jsonStr) : null;
                    } catch (jsonError) {
                        console.error('Error getting JSON value:', jsonError);
                        value = null;
                    }
                    break;
                default:
                    value = null;
            }

            console.log('Key info:', { type, ttl, value });
            return {
                success: true,
                info: {
                    key,
                    type: type.toLowerCase(),
                    ttl,
                    value
                }
            };
        } catch (error) {
            console.error('Error getting key info:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async setKey(client, key, type, value) {
        try {
            console.log('Setting key:', { key, type, value });
            switch (type.toLowerCase()) {
                case 'string':
                    await client.set(key, value);
                    break;
                case 'list':
                    await client.del(key);
                    if (value.length > 0) {
                        await client.rpush(key, value);
                    }
                    break;
                case 'set':
                    await client.del(key);
                    if (value.length > 0) {
                        await client.sadd(key, value);
                    }
                    break;
                case 'hash':
                    await client.del(key);
                    for (const [field, val] of Object.entries(value)) {
                        await client.hset(key, field, val);
                    }
                    break;
                case 'zset':
                    await client.del(key);
                    for (const [member, score] of Object.entries(value)) {
                        await client.zadd(key, score, member);
                    }
                    break;
                case 'json':
                case 'rejson-rl':
                    try {
                        // Parse the value if it's a string
                        const jsonValue = typeof value === 'string' ? JSON.parse(value) : value;
                        await client.call('JSON.SET', key, '$', JSON.stringify(jsonValue));
                    } catch (jsonError) {
                        console.error('Error setting JSON value:', jsonError);
                        throw new Error('Invalid JSON format');
                    }
                    break;
                default:
                    throw new Error('Unsupported key type');
            }
            console.log('Key set successfully');
            return { success: true };
        } catch (error) {
            console.error('Error setting key:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteKey(client, key) {
        try {
            console.log('Deleting key:', key);
            await client.del(key);
            console.log('Key deleted successfully');
            return { success: true };
        } catch (error) {
            console.error('Error deleting key:', error);
            return { success: false, error: error.message };
        }
    }

    async reconnectToServer(connectionId) {
        try {
            const connection = this.connections.get(connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }

            // 更新狀態為正在重新連線
            this._updateConnectionStatus(connectionId, 'reconnecting');

            // 如果有舊的連線，先確保它被關閉
            if (connection.client) {
                try {
                    await connection.client.disconnect();
                } catch (error) {
                    console.warn('Error disconnecting old client:', error);
                }
            }

            console.log('Attempting to reconnect to Redis server:', connectionId);
            
            const config = {
                host: connection.config.host,
                port: connection.config.port,
                password: connection.config.password,
                db: connection.config.db,
                name: connection.config.name,
                retryStrategy: () => false,
                // 增加連線超時設定
                connectTimeout: 5000,
                // 確保連線準備就緒
                enableReadyCheck: true
            };
            
            const newClient = new Redis(config);
            
            // 等待連線就緒
            await new Promise((resolve, reject) => {
                newClient.once('ready', () => {
                    console.log('New client ready');
                    resolve();
                });
                
                newClient.once('error', (error) => {
                    console.error('New client error:', error);
                    reject(error);
                });
                
                // 設定連線超時
                setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, config.connectTimeout);
            });

            // 連線成功，更新客戶端和狀態
            connection.client = newClient;
            connection.status = 'ready';
            this.connections.set(connectionId, connection);
            this._updateConnectionStatus(connectionId, 'ready');
            
            return true;
        } catch (error) {
            console.error('Error reconnecting to Redis server:', error);
            this._updateConnectionStatus(connectionId, 'error', error.message);
            throw error;
        }
    }

    async removeServer(connectionId) {
        console.log('RedisOperations: Removing server:', connectionId);
        
        try {
            // 先斷開連線
            const connection = this.connections.get(connectionId);
            if (connection && connection.client) {
                await connection.client.disconnect();
            }

            // 從 Map 中移除連線
            this.connections.delete(connectionId);
            this.connectionConfigs.delete(connectionId);

            // 如果是當前連線，清除當前連線 ID
            if (this.currentConnectionId === connectionId) {
                this.currentConnectionId = null;
            }

            // 儲存更新後的連線配置
            this._saveConnections();

            // 發送連線狀態更新事件
            this.emit('connection-status', {
                connectionId,
                status: 'removed'
            });

            console.log('RedisOperations: Server removed successfully:', connectionId);
        } catch (error) {
            console.error('RedisOperations: Error removing server:', error);
            throw error;
        }
    }

    retryStrategy(times) {
        const maxRetries = 3;
        const maxDelay = 5000;
        
        if (times >= maxRetries) {
            console.log('Max retries reached, stopping retry');
            return false;
        }

        const delay = Math.min(times * 1000, maxDelay);
        console.log(`Retry attempt ${times}, delay: ${delay}ms`);
        return delay;
    }

    successHandler(connectionId) {
        this._updateConnectionStatus(connectionId, 'ready');
    }

    errorHandler(connectionId, error) {
        this._updateConnectionStatus(connectionId, 'error', error.message);
    }

    setCurrentConnection(connectionId) {
        if (this.connections.has(connectionId)) {
            this.currentConnectionId = connectionId;
            return true;
        }
        return false;
    }

    async getKeyType(key) {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            // First try to check if it's a JSON type using JSON.TYPE command
            try {
                const jsonType = await this.currentConnection.client.call('JSON.TYPE', key);
                if (jsonType) {
                    return 'json';  // Normalize ReJSON-RL type to 'json'
                }
            } catch (error) {
                // If JSON.TYPE fails, continue with regular type check
            }

            // Fall back to regular type check
            const type = await this.currentConnection.client.type(key);
            // Normalize ReJSON-RL type if detected through regular type check
            return type.toLowerCase() === 'rejson-rl' ? 'json' : type;
        } catch (error) {
            console.error('Error getting key type:', error);
            throw error;
        }
    }

    async getAllKeys() {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }

        try {
            const keys = await this.currentConnection.client.keys('*');
            const keyInfos = await Promise.all(
                keys.map(async (key) => {
                    const type = await this.getKeyType(key);
                    return { key, type: type.toUpperCase() };
                })
            );
            return keyInfos;
        } catch (error) {
            console.error('Error getting all keys:', error);
            throw error;
        }
    }

    // ReJSON-RL Operations
    async setJson(key, path, value) {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            const result = await this.currentConnection.client.call('JSON.SET', key, path, JSON.stringify(value));
            this.emit('operationComplete', { operation: 'setJson', status: 'success', key, path });
            return result;
        } catch (error) {
            this.emit('error', { operation: 'setJson', error: error.message });
            throw error;
        }
    }

    async getJson(key, path = '$') {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            const result = await this.currentConnection.client.call('JSON.GET', key, path);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            this.emit('error', { operation: 'getJson', error: error.message });
            throw error;
        }
    }

    async arrAppend(key, path, ...values) {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            const jsonValues = values.map(v => JSON.stringify(v));
            const result = await this.currentConnection.client.call('JSON.ARRAPPEND', key, path, ...jsonValues);
            this.emit('operationComplete', { operation: 'arrAppend', status: 'success', key, path });
            return result;
        } catch (error) {
            this.emit('error', { operation: 'arrAppend', error: error.message });
            throw error;
        }
    }

    async arrPop(key, path, index = -1) {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            const result = await this.currentConnection.client.call('JSON.ARRPOP', key, path, index);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            this.emit('error', { operation: 'arrPop', error: error.message });
            throw error;
        }
    }

    async objKeys(key, path = '$') {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            return await this.currentConnection.client.call('JSON.OBJKEYS', key, path);
        } catch (error) {
            this.emit('error', { operation: 'objKeys', error: error.message });
            throw error;
        }
    }

    async objLen(key, path = '$') {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            return await this.currentConnection.client.call('JSON.OBJLEN', key, path);
        } catch (error) {
            this.emit('error', { operation: 'objLen', error: error.message });
            throw error;
        }
    }

    async type(key, path = '$') {
        if (!this.currentConnection) {
            throw new Error('No active Redis connection');
        }
        try {
            return await this.currentConnection.client.call('JSON.TYPE', key, path);
        } catch (error) {
            this.emit('error', { operation: 'type', error: error.message });
            throw error;
        }
    }

    /**
     * 設定鍵值的過期時間
     * @param {string} key - 鍵值名稱
     * @param {number} seconds - 過期時間（秒）
     * @param {string} [connectionId] - Redis 連線 ID，如果未指定則使用當前連線
     * @returns {Promise<boolean>} - 設定是否成功
     * @throws {Error} - 如果連線不存在或操作失敗
     */
    async setExpire(key, seconds, connectionId) {
        const client = this._getClient(connectionId);
        if (!client) {
            throw new Error('Redis connection not found');
        }

        try {
            const result = await client.expire(key, seconds);
            return result === 1;
        } catch (error) {
            console.error('Error setting expire:', error);
            throw error;
        }
    }

    _getClient(connectionId) {
        if (connectionId) {
            return this.connections.get(connectionId)?.client;
        }
        return this.currentConnection?.client;
    }
}

module.exports = RedisOperations;
