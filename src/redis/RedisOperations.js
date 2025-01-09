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
            client.on('error', (error) => this.errorHandler(connectionId, error));
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
            const connection = this.connections.get(connectionId);
            if (!connection) {
                throw new Error('Connection not found');
            }

            if (connection.client) {
                console.log('Disconnecting from Redis server:', connectionId);
                await connection.client.disconnect();
                connection.client.status = 'end';
                this._updateConnectionStatus(connectionId, 'disconnected');
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
                default:
                    value = null;
            }

            console.log('Key info:', { type, ttl, value });
            return {
                key,
                type: type.toLowerCase(),
                ttl,
                value
            };
        } catch (error) {
            console.error('Error getting key info:', error);
            throw error;
        }
    }

    async setKey(client, key, type, value) {
        try {
            console.log('Setting key:', { key, type, value });
            switch (type) {
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
        try {
            console.log('Removing server:', connectionId);
            
            // 先斷開連線
            await this.disconnectFromServer(connectionId);
            
            // 從連線列表中移除
            this.connections.delete(connectionId);
            
            // 從配置中移除
            this.connectionConfigs.delete(connectionId);
            this._saveConnections();
            
            // 如果是當前連線，清除當前連線 ID
            if (this.currentConnectionId === connectionId) {
                this.currentConnectionId = null;
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error removing server:', error);
            return { success: false, error: error.message };
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
}

module.exports = RedisOperations;
