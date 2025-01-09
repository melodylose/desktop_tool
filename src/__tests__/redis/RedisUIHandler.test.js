const RedisUIHandler = require('../../redis/RedisUIHandler');

describe('RedisUIHandler', () => {
  let redisUIHandler;
  let mockRedisOperations;

  beforeEach(() => {
    // Mock redisOperations
    mockRedisOperations = {
      on: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      getKeys: jest.fn(),
      getValue: jest.fn()
    };

    redisUIHandler = new RedisUIHandler(mockRedisOperations);
  });

  test('should handle UI updates', () => {
    expect(mockRedisOperations.on).toHaveBeenCalledWith('connection-status', expect.any(Function));
  });

  test('should process connection status updates', () => {
    const mockCallback = mockRedisOperations.on.mock.calls[0][1];
    const mockStatus = {
      connectionId: '1',
      status: 'connected',
      error: null,
      delay: 0
    };
    
    // Mock handleConnectionStatus method
    redisUIHandler.handleConnectionStatus = jest.fn();
    
    // Simulate connection status event
    mockCallback(mockStatus);
    
    expect(redisUIHandler.handleConnectionStatus).toHaveBeenCalledWith(
      mockStatus.connectionId,
      mockStatus.status,
      mockStatus.error,
      mockStatus.delay
    );
  });

  test('should initialize with required dependencies', () => {
    expect(redisUIHandler.redisOperations).toBe(mockRedisOperations);
    expect(redisUIHandler.connectionManager).toBeDefined();
  });
});
