const RedisOperations = require('./RedisOperations');
const RedisUIHandler = require('./RedisUIHandler');

class RedisHandler {
    static instance = null;

    constructor() {
        if (RedisHandler.instance) {
            return RedisHandler.instance;
        }
        
        console.log('Creating new RedisHandler instance');
        this.redisOperations = new RedisOperations();
        this.redisUIHandler = new RedisUIHandler(this.redisOperations);
        RedisHandler.instance = this;
    }

    initialize() {
        console.log('Initializing Redis handler...');
        try {
            this.redisUIHandler.initialize();
        } catch (error) {
            console.error('Error initializing Redis handler:', error);
        }
    }

    async cleanup(isApplicationClosing = false) {
        console.log('Cleaning up Redis connections...');
        // 只在應用程式關閉時斷開連線
        if (isApplicationClosing && this.redisOperations) {
            console.log('Application is closing, disconnecting all Redis connections...');
            for (const [_, client] of this.redisOperations.connections) {
                client.disconnect();
            }
        }
    }
}

module.exports = RedisHandler;
