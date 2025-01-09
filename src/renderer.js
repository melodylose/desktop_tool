// 載入模組
const ModbusHandler = require('./modbusOperations');
const MqttHandler = require('./mqttOperations');
const FtpHandler = require('./ftp/index');
const RedisHandler = require('./redis/index');

// 主程式邏輯
const modbusHandler = new ModbusHandler();
const mqttHandler = new MqttHandler();
const ftpHandler = new FtpHandler();
const redisHandler = new RedisHandler();

// 初始化各頁面的功能
function initializePage(pageName) {
    console.log(`Preparing to initialize ${pageName} page`);
    
    // 直接初始化對應的頁面
    try {
        console.log(`Initializing ${pageName} page...`);
        switch(pageName) {
            case 'home':
                // 首頁初始化
                break;
            case 'modbus':
                // Modbus頁面初始化
                modbusHandler.initialize();
                break;
            case 'mqtt':
                // MQTT頁面初始化
                mqttHandler.initialize();
                break;
            case 'ftp':
                // FTP頁面初始化
                console.log('Initializing FTP page...');
                ftpHandler.initialize();
                break;
            case 'redis':
                // Redis頁面初始化
                console.log('Initializing Redis page...');
                redisHandler.initialize();
                break;
            case 'options':
                // 設置頁面初始化
                initializeOptionsPage();
                break;
        }
    } catch (error) {
        console.error(`Error initializing ${pageName} page:`, error);
    }
}

// 設置頁面初始化
function initializeOptionsPage() {
    try {
        // 綁定主題切換事件
        const themeSelect = document.getElementById('theme');
        if (themeSelect) {
            themeSelect.addEventListener('change', (event) => {
                const theme = event.target.value;
                handleThemeChange(theme);
            });
        }

        // 綁定語言切換事件
        const languageSelect = document.getElementById('language');
        if (languageSelect) {
            languageSelect.addEventListener('change', (event) => {
                const language = event.target.value;
                // 處理語言切換邏輯
                console.log('Language changed to:', language);
            });
        }
    } catch (error) {
        console.error('Error initializing options page:', error);
    }
}

// 主題切換處理
function handleThemeChange(theme) {
    const body = document.body;
    if (theme === 'dark') {
        body.classList.add('bg-dark', 'text-light');
        document.querySelectorAll('.card').forEach(card => {
            card.classList.add('bg-secondary', 'text-white');
        });
    } else {
        body.classList.remove('bg-dark', 'text-light');
        document.querySelectorAll('.card').forEach(card => {
            card.classList.remove('bg-secondary', 'text-white');
        });
    }
}

// 斷開連線
window.addEventListener('beforeunload', () => {
    // 清理資源，傳入 true 表示應用程式正在關閉
    modbusHandler.cleanup && modbusHandler.cleanup(true);
    mqttHandler.cleanup && mqttHandler.cleanup(true);
    ftpHandler.cleanup && ftpHandler.cleanup(true);
    redisHandler.cleanup && redisHandler.cleanup(true);
});

// 導出初始化函數供index.html使用
window.initializePage = initializePage;