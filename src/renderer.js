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

        // 添加頁籤事件監聽
        document.querySelectorAll('[data-bs-toggle="pill"]').forEach(link => {
            link.addEventListener('click', async () => {
                try {
                    // 取得目標頁面名稱
                    let pageName;
                    if (link.id) {
                        pageName = link.getAttribute('data-page');
                    } else if (link.getAttribute('data-bs-target')) {
                        pageName = link.getAttribute('data-bs-target').replace('#', '').replace('-tab', '');
                    } else {
                        const target = link.closest('[data-bs-target]');
                        if (target) {
                            pageName = target.getAttribute('data-bs-target').replace('#', '').replace('-tab', '');
                        }
                    }

                    if (pageName) {
                        console.log(`Tab switched to: ${pageName}`);
                        await loadPage(pageName);
                    } else {
                        console.warn('Could not determine page name from tab click');
                        // 可以考慮添加使用者提示
                        document.getElementById('sidebar-nav-content').innerHTML = `
                            <div class="alert alert-warning">
                                無法確定目標頁面
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error('Error handling tab click:', error);
                    // 可以考慮添加使用者提示
                    document.getElementById('sidebar-nav-content').innerHTML = `
                        <div class="alert alert-danger">
                            頁面載入失敗: ${error.message}
                        </div>
                    `;
                }
            });
        });

        // 載入首頁
        await loadPage('home');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

async function loadPage(page) {
    try {
        const response = await fetch(`pages/${page}.html`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();

        // 等待 DOM 更新完成
        await new Promise((resolve, reject) => {
            const contentDiv = document.getElementById('sidebar-nav-content');
            if (!contentDiv) {
                reject(new Error('Content container not found'));
                return;
            }

            // 設置 MutationObserver
            const observer = new MutationObserver((mutations, obs) => {
                obs.disconnect();  // 停止觀察
                resolve();  // DOM 更新完成
            });

            // 開始觀察
            observer.observe(contentDiv, {
                childList: true,  // 觀察子節點變化
                subtree: true     // 觀察所有後代節點
            });

            // 更新 DOM
            contentDiv.innerHTML = html;

            // 確保新內容可見
            const newContent = contentDiv.querySelector('.tab-pane');
            if (newContent) {
                newContent.classList.add('active', 'show');
            }
        });

        // DOM 已經更新完成，可以安全地初始化頁面
        await initializePage(page);

    } catch (error) {
        console.error(`Error loading page ${page}:`, error);
        if (document.getElementById('sidebar-nav-content')) {
            document.getElementById('sidebar-nav-content').innerHTML = `
                <div class="alert alert-danger">
                    Error loading page: ${error.message}
                </div>
            `;
        }
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
    translationManager.showLoading();

    try {
        console.log(`Initializing ${pageName} page...`);
        switch (pageName) {
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
                ftpHandler.initialize();
                break;
            case 'redis':
                // Redis頁面初始化
                redisHandler.initialize();
                break;
            case 'settings':
                // 設定頁面初始化
                optionsPage.initializeOptionsPage();
                break;
            case 'options':  // 為了向後兼容
                // 設定頁面初始化
                optionsPage.initializeOptionsPage();
                break;
            default:
                console.warn(`Unknown page: ${pageName}`);
        }

        await translationManager.updateAllTranslations();
        await translationManager.waitForDomReady();

    } catch (error) {
        console.error(`Error initializing ${pageName} page:`, error);
        throw error;
    } finally {
        translationManager.hideLoading();
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