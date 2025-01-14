// 引入所需的模組
const { ipcRenderer } = require('electron');
const { translationManager, i18next } = require('./translationManager');
const themeManager = require('./themeManager');

// 設定頁面初始化
function initializeOptionsPage() {
    // 獲取設定頁面的元素
    const settingsContainer = document.getElementById('settings');
    if (!settingsContainer) return;

    // 初始化語言選擇器
    initializeLanguageSelector();
    
    // 初始化主題選擇器
    themeManager.initializeThemeSelector();
    
    // 初始化自動更新設定
    initializeAutoUpdateSetting();
    
    // 初始化版本資訊
    initializeVersionInfo();
}

// 初始化語言選擇器
async function initializeLanguageSelector() {
    const languageSelect = document.getElementById('language');
    if (!languageSelect) {
        console.warn('Language selector not found');
        return;
    }

    try {
        // 等待翻譯管理器初始化完成
        await translationManager.waitForInitialization();

        // 設定當前語言
        const currentLanguage = i18next.language || 'zh-TW';
        console.log('Current language:', currentLanguage);
        languageSelect.value = currentLanguage;

        // 監聽語言變更事件
        languageSelect.addEventListener('change', async (event) => {
            try {
                const newLanguage = event.target.value;
                console.log('Language change requested:', newLanguage);
                
                // 禁用選擇器，避免重複切換
                languageSelect.disabled = true;
                
                // 切換語言
                await translationManager.changeLanguage(newLanguage);
                
                // 啟用選擇器
                languageSelect.disabled = false;
                
                console.log('Language change completed');
            } catch (error) {
                console.error('Error changing language:', error);
                // 發生錯誤時恢復選擇器
                languageSelect.disabled = false;
                languageSelect.value = currentLanguage;
            }
        });

        console.log('Language selector initialized successfully');
    } catch (error) {
        console.error('Error initializing language selector:', error);
    }
}

// 初始化自動更新設定
function initializeAutoUpdateSetting() {
    const autoUpdateCheckbox = document.getElementById('autoUpdate');
    if (!autoUpdateCheckbox) return;

    // 設定當前自動更新狀態
    const autoUpdate = localStorage.getItem('autoUpdate') !== 'false';
    autoUpdateCheckbox.checked = autoUpdate;

    // 監聽自動更新設定變更事件
    autoUpdateCheckbox.addEventListener('change', (event) => {
        localStorage.setItem('autoUpdate', event.target.checked);
    });
}

// 初始化版本資訊
async function initializeVersionInfo() {
    try {
        // 獲取當前版本
        const currentVersion = await ipcRenderer.invoke('get-version');
        
        // 更新版本顯示
        const versionElement = document.getElementById('currentVersion');
        if (versionElement) {
            versionElement.textContent = currentVersion;
        }

        // 檢查更新按鈕事件
        const checkUpdateBtn = document.getElementById('checkUpdate');
        if (checkUpdateBtn) {
            checkUpdateBtn.addEventListener('click', async () => {
                try {
                    // 禁用按鈕，避免重複點擊
                    checkUpdateBtn.disabled = true;
                    checkUpdateBtn.textContent = i18next.t('settings.checking');

                    // 檢查更新
                    const updateResult = await ipcRenderer.invoke('check-update');
                    
                    // 根據結果更新UI
                    if (updateResult.hasUpdate) {
                        alert(i18next.t('settings.updateAvailable', { version: updateResult.version }));
                    } else {
                        alert(i18next.t('settings.noUpdate'));
                    }
                } catch (error) {
                    console.error('Error checking for updates:', error);
                    alert(i18next.t('settings.updateError'));
                } finally {
                    // 恢復按鈕狀態
                    checkUpdateBtn.disabled = false;
                    checkUpdateBtn.textContent = i18next.t('settings.checkUpdate');
                }
            });
        }
    } catch (error) {
        console.error('Error initializing version info:', error);
    }
}

// 導出函數
module.exports = {
    initializeOptionsPage,
    initializeLanguageSelector,
    initializeAutoUpdateSetting,
    initializeVersionInfo
};
