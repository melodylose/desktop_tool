const RedisHandler = require('../../redis/index');
const RedisOperations = require('../../redis/RedisOperations');
const RedisUIHandler = require('../../redis/RedisUIHandler');

// Mock the dependencies
jest.mock('../../redis/RedisOperations');
jest.mock('../../redis/RedisUIHandler');

describe('RedisHandler', () => {
    beforeEach(() => {
        // Clear all instances and calls between tests
        jest.clearAllMocks();
        // Reset the singleton instance
        RedisHandler.instance = null;
    });

    test('should implement singleton pattern', () => {
        const instance1 = new RedisHandler();
        const instance2 = new RedisHandler();
        
        expect(instance1).toBe(instance2);
        expect(RedisHandler.instance).toBe(instance1);
    });

    test('should create instances of RedisOperations and RedisUIHandler on first instantiation', () => {
        const handler = new RedisHandler();
        
        expect(RedisOperations).toHaveBeenCalledTimes(1);
        expect(RedisUIHandler).toHaveBeenCalledTimes(1);
        expect(handler.redisOperations).toBeInstanceOf(RedisOperations);
        expect(handler.redisUIHandler).toBeInstanceOf(RedisUIHandler);
    });

    test('should initialize RedisUIHandler when initialize is called', () => {
        const handler = new RedisHandler();
        handler.initialize();
        
        expect(handler.redisUIHandler.initialize).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization errors gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error');
        const handler = new RedisHandler();
        
        // Mock initialization to throw an error
        handler.redisUIHandler.initialize.mockImplementation(() => {
            throw new Error('Test error');
        });
        
        handler.initialize();
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error initializing Redis handler:',
            expect.any(Error)
        );
    });

    test('should cleanup Redis connections', async () => {
        const handler = new RedisHandler();
        const mockClient = {
            disconnect: jest.fn()
        };
        
        // Mock connections Map
        handler.redisOperations.connections = new Map([
            ['connection1', mockClient],
            ['connection2', mockClient]
        ]);
        
        await handler.cleanup(true);
        
        // Should call disconnect for each connection
        expect(mockClient.disconnect).toHaveBeenCalledTimes(2);
    });
});
