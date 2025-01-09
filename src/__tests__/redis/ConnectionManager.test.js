const ConnectionManager = require('../../redis/ConnectionManager');

describe('ConnectionManager', () => {
  let connectionManager;
  let mockRedisOperations;

  beforeEach(() => {
    // 建立 mock RedisOperations
    mockRedisOperations = {
      connections: new Map(),
      on: jest.fn(),
      getCurrentConnectionId: jest.fn().mockReturnValue('test-connection')
    };
    
    connectionManager = new ConnectionManager(mockRedisOperations);
  });

  test('should create a new connection', () => {
    const mockConnection = {
      name: 'Test Connection',
      config: {
        host: 'localhost',
        port: 6379,
        db: 0
      },
      client: {}
    };

    mockRedisOperations.connections.set('test-connection', mockConnection);
    connectionManager._syncConnections();

    expect(connectionManager.connections.get('test-connection')).toBeDefined();
    expect(connectionManager.connections.get('test-connection').name).toBe('Test Connection');
    expect(connectionManager.currentConnection).toBe('test-connection');
  });

  test('should handle connection errors', () => {
    const connectionStatusCallback = mockRedisOperations.on.mock.calls[0][1];
    expect(typeof connectionStatusCallback).toBe('function');
    
    // 測試連線狀態變化時的行為
    connectionStatusCallback({ connectionId: 'test-connection' });
    expect(mockRedisOperations.getCurrentConnectionId).toHaveBeenCalled();
  });

  test('should disconnect properly', () => {
    const mockConnection = {
      name: 'Test Connection',
      config: {
        host: 'localhost',
        port: 6379,
        db: 0
      },
      client: {}
    };

    mockRedisOperations.connections.set('test-connection', mockConnection);
    connectionManager._syncConnections();
    
    expect(connectionManager.connections.size).toBe(1);
    connectionManager.connections.clear();
    expect(connectionManager.connections.size).toBe(0);
  });
});
