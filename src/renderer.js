// 載入模組
const { ipcRenderer } = require('electron');
const ModbusHandler = require('./modbusOperations');
const MqttHandler = require('./mqttOperations');
const FtpHandler = require('./ftp/index');
const RedisHandler = require('./redis/index');
const { translationManager } = require('./js/translationManager');
const themeManager = require('./js/themeManager');

// 主程式邏輯
const modbusHandler = new ModbusHandler();
const mqttHandler = new MqttHandler();
const ftpHandler = new FtpHandler();
const redisHandler = new RedisHandler();

// 引入設定頁面模組
const optionsPage = require('./js/options');

// 初始化應用程式
async function initializeApp() {
    try {
        // 等待翻譯管理器初始化完成
        await translationManager.waitForInitialization();
        await translationManager.waitForDomReady();
        console.log('Translation manager and DOM are ready, initializing home page...');
        
        // 初始化首頁
        await initializePage('home');
        
        // 監聽頁籤切換事件
        const tabLinks = document.querySelectorAll('.nav-link, .nav-item button');
        tabLinks.forEach(link => {
            link.addEventListener('click', async () => {
                try {
                    // 取得目標頁面名稱
                    let pageName;
                    if (link.id) {
                        // 如果有 ID，從 ID 中獲取頁面名稱
                        pageName = link.id.replace('-tab-btn', '').replace('-btn', '');
                    } else if (link.getAttribute('data-bs-target')) {
                        // 如果有 data-bs-target 屬性，從中獲取頁面名稱
                        pageName = link.getAttribute('data-bs-target').replace('#', '').replace('-tab', '');
                    } else {
                        // 如果都沒有，從父元素或其他屬性中尋找
                        const target = link.closest('[data-bs-target]');
                        if (target) {
                            pageName = target.getAttribute('data-bs-target').replace('#', '').replace('-tab', '');
                        }
                    }

                    if (pageName) {
                        console.log(`Tab switched to: ${pageName}`);
                        await translationManager.updateAllTranslations();
                    } else {
                        console.warn('Could not determine page name from tab click');
                    }
                } catch (error) {
                    console.error('Error handling tab click:', error);
                }
            });
        });
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

// 等待 DOM 完全載入後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM Content Loaded, starting app initialization...');
        initializeApp();
    });
} else {
    console.log('DOM already loaded, starting app initialization...');
    initializeApp();
}

// 初始化頁面
async function initializePage(pageName) {
    console.log(`Preparing to initialize ${pageName} page`);

    // 直接初始化對應的頁面
    try {
        console.log(`Initializing ${pageName} page...`);
        switch (pageName) {
            case 'home':
                // 首頁初始化
                await translationManager.updateAllTranslations();
                break;
            case 'modbus':
                // Modbus頁面初始化
                modbusHandler.initialize();
                await translationManager.updateAllTranslations();
                break;
            case 'mqtt':
                // MQTT頁面初始化
                mqttHandler.initialize();
                await translationManager.updateAllTranslations();
                break;
            case 'ftp':
                // FTP頁面初始化
                ftpHandler.initialize();
                await translationManager.updateAllTranslations();
                break;
            case 'redis':
                // Redis頁面初始化
                redisHandler.initialize();
                await translationManager.updateAllTranslations();
                break;
            case 'settings':
                // 設定頁面初始化
                optionsPage.initializeOptionsPage();
                await translationManager.updateAllTranslations();
                break;
            case 'options':  // 為了向後兼容
                // 設定頁面初始化
                optionsPage.initializeOptionsPage();
                await translationManager.updateAllTranslations();
                break;
            default:
                console.warn(`Unknown page: ${pageName}`);
        }
    } catch (error) {
        console.error(`Error initializing ${pageName} page:`, error);
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