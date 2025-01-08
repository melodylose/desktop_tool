const Redis = require('ioredis');
const EventEmitter = require('events');

class RedisOperations extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
    }

    async connect(config) {
        const { host, port, password, db, name } = config;
        const connectionId = `${name}@${host}:${port}/${db}`;
        let redis = null;

        try {
            console.log('Creating new Redis connection:', config);
            redis = new Redis({
                host,
                port,
                password: password || undefined,
                db: parseInt(db) || 0,
                connectTimeout: 5000, // 5秒連線超時
                retryStrategy: (times) => {
                    // 第一次連線失敗時不重試
                    if (times === 1) {
                        return false;
                    }
                    // 已建立連線後的重試邏輯
                    const delay = Math.min(times * 50, 2000);
                    console.log(`Attempting to reconnect... (attempt ${times})`);
                    this.emit('connection-status', { 
                        connectionId, 
                        status: 'reconnecting',
                        delay 
                    });
                    return delay;
                },
                maxRetriesPerRequest: 3
            });

            let isAuthenticated = false;

            // 監聽連線狀態
            redis.on('connect', () => {
                console.log('TCP connection established, waiting for authentication...');
                redis.status = 'connecting';
                this.emit('connection-status', { 
                    connectionId, 
                    status: 'connecting'
                });
            });

            redis.on('ready', () => {
                console.log('Redis connection established and authenticated');
                isAuthenticated = true;
                redis.status = 'ready';
                this.emit('connection-status', { 
                    connectionId, 
                    status: 'connected'
                });
            });

            redis.on('error', (error) => {
                console.error('Redis connection error:', error);
                redis.status = 'error';
                this.emit('connection-status', { 
                    connectionId, 
                    status: 'error',
                    error: error.message 
                });
            });

            redis.on('end', () => {
                console.log('Redis connection ended');
                redis.status = 'end';
                this.emit('connection-status', { 
                    connectionId, 
                    status: 'disconnected'
                });
                // 強制關閉連線並清理資源
                if (redis) {
                    redis.disconnect(true);
                }
                // 從連線列表中移除
                this.connections.delete(connectionId);
            });

            // 等待連線和認證完成
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    if (redis) {
                        redis.disconnect();
                    }
                    reject(new Error('連線超時'));
                }, 5000);

                // 成功處理器
                const successHandler = () => {
                    if (isAuthenticated) {
                        clearTimeout(timeoutId);
                        redis.removeListener('error', errorHandler);
                        resolve();
                    }
                };

                // 錯誤處理器
                const errorHandler = (error) => {
                    clearTimeout(timeoutId);
                    if (redis) {
                        redis.disconnect();
                    }
                    redis.removeListener('ready', successHandler);
                    if (error.message.includes('NOAUTH')) {
                        reject(new Error('Redis認證失敗：請檢查密碼是否正確'));
                    } else {
                        reject(error);
                    }
                };

                redis.once('ready', successHandler);
                redis.once('error', errorHandler);
            });

            // 驗證連線是否真的成功
            try {
                await redis.ping();
                // 連線成功，儲存到連線列表
                this.connections.set(connectionId, redis);
                return redis;
            } catch (error) {
                if (redis) {
                    redis.disconnect();
                }
                throw new Error('連線測試失敗：' + error.message);
            }
        } catch (error) {
            console.error('Failed to create Redis connection:', error);
            if (redis) {
                redis.disconnect();
            }
            throw error;
        }
    }

    async disconnect(client) {
        try {
            console.log('Disconnecting Redis client');
            // 先嘗試優雅關閉
            try {
                await client.quit();
            } catch (error) {
                console.log('Graceful disconnect failed, forcing disconnect:', error);
                client.disconnect(true);
            }
            
            // 找到並移除對應的連線
            for (const [connectionId, redis] of this.connections.entries()) {
                if (redis === client) {
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

    async getKeys(client) {
        try {
            const keys = await client.keys('*');
            // 獲取每個 key 的類型
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

            switch (type) {
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

            console.log('Key info:', { type, ttl, valueType: typeof value });
            return {
                success: true,
                info: {
                    key,
                    type,
                    ttl,
                    value
                }
            };
        } catch (error) {
            console.error('Error getting key info:', error);
            return { success: false, error: error.message };
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
}

module.exports = RedisOperations;
