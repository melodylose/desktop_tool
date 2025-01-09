const Redis = require('ioredis');
const RedisOperations = require('../../redis/RedisOperations');

// Mock ioredis
jest.mock('ioredis');

describe('RedisOperations', () => {
    let redisOperations;
    let mockRedisClient;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Create a new instance for each test
        redisOperations = new RedisOperations();
        
        // Setup mock Redis client
        mockRedisClient = {
            connect: jest.fn(),
            disconnect: jest.fn(),
            quit: jest.fn(),
            on: jest.fn(),
            once: jest.fn(),
            removeListener: jest.fn(),
            ping: jest.fn(),
            keys: jest.fn(),
            type: jest.fn(),
            ttl: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            rpush: jest.fn(),
            lrange: jest.fn(),
            hset: jest.fn(),
            hgetall: jest.fn(),
            sadd: jest.fn(),
            smembers: jest.fn(),
            zadd: jest.fn(),
            zrange: jest.fn()
        };

        // Mock Redis constructor
        Redis.mockImplementation(() => mockRedisClient);
    });

    describe('connect', () => {
        const mockConfig = {
            host: 'localhost',
            port: 6379,
            password: 'password',
            db: 0,
            name: 'test'
        };

        test('should successfully connect to Redis', async () => {
            // Setup mock behavior
            mockRedisClient.ping.mockResolvedValue('PONG');
            
            // Mock all event listeners
            const eventHandlers = {};
            mockRedisClient.on.mockImplementation((event, handler) => {
                eventHandlers[event] = handler;
            });
            mockRedisClient.once.mockImplementation((event, handler) => {
                eventHandlers[event] = handler;
                return mockRedisClient;
            });

            // Start the connection process
            const connectPromise = redisOperations.connect(mockConfig);

            // Immediately trigger connection events
            process.nextTick(() => {
                eventHandlers.connect?.();  // TCP connection established
                eventHandlers.ready?.();    // Authentication successful
            });

            const result = await connectPromise;
            
            expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
                host: mockConfig.host,
                port: mockConfig.port,
                password: mockConfig.password,
                db: mockConfig.db
            }));
            expect(result).toBe(mockRedisClient);
        }, 10000);

        test('should handle connection failure', async () => {
            const error = new Error('Connection failed');
            mockRedisClient.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(error), 0);
                }
            });

            const result = await redisOperations.connect(mockConfig);
            expect(result).toBe(mockRedisClient);
            expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
        });
    });

    describe('disconnect', () => {
        test('should disconnect successfully', async () => {
            mockRedisClient.quit.mockResolvedValue('OK');
            
            const result = await redisOperations.disconnect(mockRedisClient);
            
            expect(result).toBe(true);
            expect(mockRedisClient.quit).toHaveBeenCalled();
        });

        test('should force disconnect if quit fails', async () => {
            mockRedisClient.quit.mockRejectedValue(new Error('Quit failed'));
            
            const result = await redisOperations.disconnect(mockRedisClient);
            
            expect(result).toBe(true);
            expect(mockRedisClient.disconnect).toHaveBeenCalledWith(true);
        });
    });

    describe('getKeys', () => {
        test('should return list of keys with types', async () => {
            const mockKeys = ['key1', 'key2'];
            mockRedisClient.keys.mockResolvedValue(mockKeys);
            mockRedisClient.type.mockResolvedValue('string');

            const result = await redisOperations.getKeys(mockRedisClient);

            expect(result).toEqual([
                { key: 'key1', type: 'string' },
                { key: 'key2', type: 'string' }
            ]);
        });
    });

    describe('getKeyInfo', () => {
        test('should get string key info', async () => {
            mockRedisClient.type.mockResolvedValue('string');
            mockRedisClient.ttl.mockResolvedValue(3600);
            mockRedisClient.get.mockResolvedValue('value');

            const result = await redisOperations.getKeyInfo(mockRedisClient, 'key');

            expect(result).toEqual({
                success: true,
                info: {
                    key: 'key',
                    type: 'string',
                    ttl: 3600,
                    value: 'value'
                }
            });
        });

        test('should get hash key info', async () => {
            mockRedisClient.type.mockResolvedValue('hash');
            mockRedisClient.ttl.mockResolvedValue(3600);
            mockRedisClient.hgetall.mockResolvedValue({ field: 'value' });

            const result = await redisOperations.getKeyInfo(mockRedisClient, 'key');

            expect(result).toEqual({
                success: true,
                info: {
                    key: 'key',
                    type: 'hash',
                    ttl: 3600,
                    value: { field: 'value' }
                }
            });
        });
    });

    describe('setKey', () => {
        test('should set string key', async () => {
            const result = await redisOperations.setKey(
                mockRedisClient,
                'key',
                'string',
                'value'
            );

            expect(result).toEqual({ success: true });
            expect(mockRedisClient.set).toHaveBeenCalledWith('key', 'value');
        });

        test('should set hash key', async () => {
            const result = await redisOperations.setKey(
                mockRedisClient,
                'key',
                'hash',
                { field: 'value' }
            );

            expect(result).toEqual({ success: true });
            expect(mockRedisClient.hset).toHaveBeenCalledWith('key', 'field', 'value');
        });
    });

    describe('deleteKey', () => {
        test('should delete key successfully', async () => {
            mockRedisClient.del.mockResolvedValue(1);

            const result = await redisOperations.deleteKey(mockRedisClient, 'key');

            expect(result).toEqual({ success: true });
            expect(mockRedisClient.del).toHaveBeenCalledWith('key');
        });

        test('should handle delete error', async () => {
            const error = new Error('Delete failed');
            mockRedisClient.del.mockRejectedValue(error);

            const result = await redisOperations.deleteKey(mockRedisClient, 'key');

            expect(result).toEqual({ 
                success: false, 
                error: error.message 
            });
        });
    });
});
