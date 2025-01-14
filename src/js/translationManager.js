const i18next = require('i18next');
const path = require('path');

class TranslationManager {
    constructor() {
        this.defaultLanguage = 'zh-TW';
        this.savedLanguage = localStorage.getItem('appLanguage') || this.defaultLanguage;
        this.initialized = false;
        this.domReady = false;
        this.initPromise = null;

        // 預先載入翻譯資源
        try {
            this.translations = {
                en: {
                    translation: require('../locales/en/translation.json')
                },
                'zh-TW': {
                    translation: require('../locales/zh-TW/translation.json')
                }
            };
            console.log('TranslationManager: Translations loaded:', Object.keys(this.translations));
            console.log('TranslationManager: Translation structure:', JSON.stringify(this.translations, null, 2));
        } catch (error) {
            console.error('TranslationManager: Error loading translations:', error);
            // 確保至少有預設語言的翻譯
            this.translations = {
                'zh-TW': {
                    translation: require('../locales/zh-TW/translation.json')
                }
            };
        }

        // 等待 DOM 載入完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.domReady = true;
                console.log('TranslationManager: DOM is now ready');
            });
        } else {
            this.domReady = true;
            console.log('TranslationManager: DOM was already ready');
        }

        // 開始初始化
        this.initPromise = this.initialize();
    }

    async waitForDomReady() {
        if (this.domReady) {
            console.log('TranslationManager: DOM is already ready');
            return;
        }

        return new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', () => {
                this.domReady = true;
                console.log('TranslationManager: DOM is now ready');
                resolve();
            });
        });
    }

    async initialize() {
        try {
            console.log('TranslationManager: Starting initialization...');
            console.log('TranslationManager: Default language:', this.defaultLanguage);
            console.log('TranslationManager: Saved language:', this.savedLanguage);

            // 確保使用支援的語言
            if (!this.translations[this.savedLanguage]) {
                console.log(`TranslationManager: Saved language ${this.savedLanguage} not supported, using default language ${this.defaultLanguage}`);
                this.savedLanguage = this.defaultLanguage;
                localStorage.setItem('appLanguage', this.defaultLanguage);
            }

            // Initialize i18next
            await i18next.init({
                fallbackLng: this.defaultLanguage,
                lng: this.savedLanguage,
                resources: this.translations,
                interpolation: {
                    escapeValue: false
                },
                debug: true
            });
            
            // 驗證初始化結果
            const currentLng = i18next.language;
            console.log('TranslationManager: Current i18next language:', currentLng);
            
            // 確保資源已載入
            const testKey = 'home.welcome';
            const testTranslation = i18next.t(testKey);
            console.log(`TranslationManager: Test translation for '${testKey}':`, testTranslation);

            if (!testTranslation || testTranslation === testKey) {
                console.error(`TranslationManager: Translation test failed for ${currentLng}, trying to reload...`);
                // 重新載入資源
                i18next.addResourceBundle(currentLng, 'translation', this.translations[currentLng].translation, true, true);
                
                // 再次測試
                const retryTranslation = i18next.t(testKey);
                if (!retryTranslation || retryTranslation === testKey) {
                    throw new Error(`Translation test failed for key: ${testKey}`);
                }
            }

            this.initialized = true;
            console.log('TranslationManager: Initialized successfully');
            return true;
        } catch (error) {
            console.error('TranslationManager: Error during initialization:', error);
            this.initialized = false;
            throw error;
        }
    }

    async waitForInitialization() {
        try {
            await this.initPromise;
            if (!this.initialized) {
                throw new Error('TranslationManager initialization failed');
            }
            return true;
        } catch (error) {
            console.error('TranslationManager: Error waiting for initialization:', error);
            throw error;
        }
    }

    async updateAllTranslations() {
        try {
            console.log('TranslationManager: Starting to update all translations...');
            await this.waitForInitialization();
            await this.waitForDomReady();

            // 等待一小段時間確保 DOM 完全載入
            await new Promise(resolve => setTimeout(resolve, 100));

            // 更新所有帶有 data-i18n 屬性的元素
            const elements = document.querySelectorAll('[data-i18n], [data-i18n-placeholder]');
            console.log(`TranslationManager: Found ${elements.length} elements to update`);

            elements.forEach(element => {
                // 處理一般文字內容
                const contentKey = element.getAttribute('data-i18n');
                if (contentKey) {
                    const translation = i18next.t(contentKey);
                    console.log(`TranslationManager: Updating element content with key '${contentKey}' to '${translation}'`);
                    
                    if (element.tagName.toLowerCase() === 'option') {
                        element.text = translation;
                    } else {
                        element.textContent = translation;
                    }
                }

                // 處理 placeholder
                const placeholderKey = element.getAttribute('data-i18n-placeholder');
                if (placeholderKey) {
                    const placeholderTranslation = i18next.t(placeholderKey);
                    console.log(`TranslationManager: Updating element placeholder with key '${placeholderKey}' to '${placeholderTranslation}'`);
                    element.placeholder = placeholderTranslation;
                }
            });

            // 特別處理動態載入的頁面
            const dynamicTabs = ['modbus-tab', 'mqtt-tab', 'ftp-tab', 'redis-tab', 'settings'];
            dynamicTabs.forEach(tabId => {
                const tab = document.getElementById(tabId);
                if (tab) {
                    console.log(`TranslationManager: Found ${tabId}, updating translations...`);
                    // 更新所有帶有 data-i18n 屬性的元素
                    const tabElements = tab.querySelectorAll('[data-i18n], [data-i18n-placeholder]');
                    console.log(`TranslationManager: Found ${tabElements.length} elements in ${tabId}`);
                    
                    tabElements.forEach(element => {
                        // 處理一般文字內容
                        const contentKey = element.getAttribute('data-i18n');
                        if (contentKey) {
                            const translation = i18next.t(contentKey);
                            console.log(`TranslationManager: Updating ${tabId} element with key '${contentKey}' to '${translation}'`);
                            
                            if (element.tagName.toLowerCase() === 'option') {
                                element.text = translation;
                            } else {
                                element.textContent = translation;
                            }
                        }

                        // 處理 placeholder
                        const placeholderKey = element.getAttribute('data-i18n-placeholder');
                        if (placeholderKey) {
                            const placeholderTranslation = i18next.t(placeholderKey);
                            console.log(`TranslationManager: Updating ${tabId} element placeholder with key '${placeholderKey}' to '${placeholderTranslation}'`);
                            element.placeholder = placeholderTranslation;
                        }
                    });
                }
            });

            // 觸發自定義事件通知語言變更
            const event = new CustomEvent('languageChanged', {
                detail: { language: i18next.language }
            });
            document.dispatchEvent(event);
            console.log('TranslationManager: Dispatched languageChanged event');

        } catch (error) {
            console.error('TranslationManager: Error updating translations:', error);
            throw error;
        }
    }

    async changeLanguage(newLanguage) {
        try {
            await this.waitForInitialization();
            await this.waitForDomReady();
            console.log(`TranslationManager: Changing language to: ${newLanguage}`);
            console.log('TranslationManager: Current translations:', JSON.stringify(this.translations[newLanguage], null, 2));
            
            // 檢查語言是否支援
            if (!this.translations[newLanguage]) {
                throw new Error(`Language ${newLanguage} is not supported`);
            }
            
            // 確保資源已載入
            console.log(`TranslationManager: Loading resources for ${newLanguage}`);
            i18next.addResourceBundle(newLanguage, 'translation', this.translations[newLanguage].translation, true, true);
            
            // 更新 i18next 語言
            console.log('TranslationManager: Calling changeLanguage...');
            await i18next.changeLanguage(newLanguage);
            
            // 驗證語言是否正確切換
            const currentLng = i18next.language;
            console.log('TranslationManager: Current i18next language after change:', currentLng);
            
            // 測試翻譯
            const testKey = 'home.welcome';
            const testTranslation = i18next.t(testKey);
            console.log(`TranslationManager: Test translation after change for '${testKey}':`, testTranslation);
            
            if (currentLng !== newLanguage) {
                throw new Error(`Language change failed. Expected: ${newLanguage}, got: ${currentLng}`);
            }
            
            // 更新儲存的語言設定
            this.savedLanguage = newLanguage;
            localStorage.setItem('appLanguage', newLanguage);
            
            // 更新所有翻譯
            console.log('TranslationManager: Updating all translations...');
            await this.updateAllTranslations();
            
            console.log('TranslationManager: Language changed successfully');
        } catch (error) {
            console.error('TranslationManager: Error changing language:', error);
            throw error;
        }
    }
}

// 創建單例實例
const translationManager = new TranslationManager();

// 導出 translationManager 和 i18next
module.exports = {
    translationManager: translationManager,
    i18next: i18next
};
