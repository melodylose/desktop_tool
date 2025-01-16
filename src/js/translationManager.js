const i18next = require('i18next');
const path = require('path');

class TranslationManager {
    constructor() {
        this.defaultLanguage = 'zh-TW';
        this.savedLanguage = localStorage.getItem('appLanguage') || this.defaultLanguage;
        this.initialized = false;
        this.domReady = false;
        this.initPromise = null;
        this.loadingCount = 0; // 添加計數器來追蹤載入狀態

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

    // 顯示載入動畫
    showLoading() {
        this.loadingCount++;
        console.log('TranslationManager: Show loading, count:', this.loadingCount);

        if (this.loadingCount === 1) {
            const showLoadingInDocument = (doc) => {
                const loadingOverlay = doc.getElementById('loading-overlay');
                if (loadingOverlay) {
                    // 重置所有樣式
                    loadingOverlay.removeAttribute('style');
                    loadingOverlay.className = 'loading-overlay';

                    // 設置基本樣式
                    loadingOverlay.style.cssText = `
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                        opacity: 1 !important;
                        visibility: visible !important;
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        transform: none !important;
                        width: 100% !important;
                        height: 100% !important;
                        z-index: 9999 !important;
                        background-color: rgba(255, 255, 255, 1) !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    `;

                    // 設置 spinner 樣式
                    const spinner = loadingOverlay.querySelector('.spinner-border');
                    if (spinner) {
                        spinner.style.cssText = `
                            display: block !important;
                            width: 3rem !important;
                            height: 3rem !important;
                            border-width: 0.25em !important;
                            margin: auto !important;
                        `;
                    }

                    // 確保父元素不會影響定位
                    doc.body.style.overflow = 'hidden';
                }
            };

            // 處理主文檔
            showLoadingInDocument(document);

            // 處理所有 iframe 中的文檔
            const iframes = document.getElementsByTagName('iframe');
            Array.from(iframes).forEach(iframe => {
                try {
                    if (iframe.contentDocument) {
                        showLoadingInDocument(iframe.contentDocument);
                    }
                } catch (e) {
                    console.warn('TranslationManager: Cannot access iframe content:', e);
                }
            });
        }
    }

    // 隱藏載入動畫
    hideLoading() {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
        console.log('TranslationManager: Hide loading, count:', this.loadingCount);

        const hideLoadingInDocument = (doc) => {
            console.log('TranslationManager: Checking document:', doc.location.href);
            const loadingOverlay = doc.getElementById('loading-overlay');
            console.log('TranslationManager: Found loading overlay:', loadingOverlay);

            if (loadingOverlay && this.loadingCount === 0) {
                // 先移除所有樣式和類
                loadingOverlay.removeAttribute('style');
                loadingOverlay.className = '';

                // 設置新的樣式
                loadingOverlay.style.cssText = `
                    display: none !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    z-index: -1 !important;
                `;

                // 處理 spinner
                const spinner = loadingOverlay.querySelector('.spinner-border');
                if (spinner) {
                    spinner.style.cssText = 'display: none !important;';
                }

                console.log('TranslationManager: Styles after hiding:', {
                    display: window.getComputedStyle(loadingOverlay).display,
                    opacity: window.getComputedStyle(loadingOverlay).opacity,
                    visibility: window.getComputedStyle(loadingOverlay).visibility,
                    zIndex: window.getComputedStyle(loadingOverlay).zIndex
                });

                // 同時顯示主內容
                const mainContent = doc.getElementById('main-content');
                if (mainContent) {
                    mainContent.style.display = 'block';
                    console.log('TranslationManager: Main content displayed');
                }
            }
        };

        // 處理主文檔
        hideLoadingInDocument(document);

        // 處理所有 iframe 中的文檔
        const iframes = document.getElementsByTagName('iframe');
        console.log('TranslationManager: Found iframes:', iframes.length);

        Array.from(iframes).forEach((iframe, index) => {
            try {
                console.log(`TranslationManager: Processing iframe ${index}`);
                if (iframe.contentDocument) {
                    hideLoadingInDocument(iframe.contentDocument);
                }
            } catch (e) {
                console.warn('TranslationManager: Cannot access iframe content:', e);
            }
        });
    }

    async initialize() {
        try {
            this.showLoading();
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
        } finally {
            this.hideLoading();
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

            // 增加等待時間，確保 DOM 完全載入
            await new Promise(resolve => setTimeout(resolve, 300));

            // 更新所有帶有 data-i18n 屬性的元素
            const elements = document.querySelectorAll('[data-i18n], [data-i18n-placeholder]');
            console.log(`TranslationManager: Found ${elements.length} elements to update`);

            // 使用 Promise.all 來等待所有翻譯完成
            const updatePromises = Array.from(elements).map(async element => {
                // 處理一般文字內容
                const contentKey = element.getAttribute('data-i18n');
                if (contentKey) {
                    const translation = await i18next.t(contentKey);
                    console.log(`Translating ${contentKey} to: ${translation}`);
                    if (element.tagName.toLowerCase() === 'option') {
                        element.text = translation;
                    } else if (element.tagName.toLowerCase() === 'span') {
                        element.textContent = translation;
                    } else {
                        // 對於其他元素，保留其內部結構
                        const spanElement = element.querySelector('span[data-i18n]');
                        if (spanElement) {
                            spanElement.textContent = translation;
                        } else {
                            element.textContent = translation;
                        }
                    }
                }

                // 處理 placeholder
                const placeholderKey = element.getAttribute('data-i18n-placeholder');
                if (placeholderKey) {
                    const translation = await i18next.t(placeholderKey);
                    element.placeholder = translation;
                }
            });

            // 等待所有翻譯完成
            await Promise.all(updatePromises);
            console.log('TranslationManager: All translations updated successfully');

            // 再等待一小段時間確保 DOM 渲染完成
            await new Promise(resolve => setTimeout(resolve, 100));

            return true;
        } catch (error) {
            console.error('TranslationManager: Error updating translations:', error);
            return false;
        }
    }

    async changeLanguage(newLanguage) {
        try {
            this.showLoading();
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
        } finally {
            this.hideLoading();
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
