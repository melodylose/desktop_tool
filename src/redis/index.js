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

    async cleanup() {
        console.log('Cleaning up Redis connections...');
        // 不要在這裡清除實例，只清理不需要的資源
        if (this.redisOperations) {
            // 清理連線等資源，但保持實例
            for (const [_, client] of this.redisOperations.connections) {
                client.disconnect();
            }
        }
    }
}

// Add styles for Redis tree
const style = document.createElement('style');
style.textContent = `
    #redisTree li {
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
    }

    #redisTree li:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }

    #redisTree li.selected {
        background-color: #007bff;
        color: white;
    }

    .context-menu {
        position: fixed;
        z-index: 1000;
    }
`;

// 只在頁面載入時添加樣式，而不初始化Redis
document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(style);
});

module.exports = RedisHandler;
