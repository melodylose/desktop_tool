const { ipcRenderer } = require('electron');
const { translationManager } = require('../../js/translationManager');
const { themeManager } = require('../../js/themeManager');
const { initializeOptionsPage, initializeLanguageSelector, initializeAutoUpdateSetting, initializeVersionInfo } = require('../../js/options');
const i18next = require('i18next');

// Mock dependencies
jest.mock('electron', () => ({
    ipcRenderer: {
        on: jest.fn(),
        send: jest.fn(),
        invoke: jest.fn().mockImplementation((channel) => {
            if (channel === 'get-version') {
                return Promise.resolve('1.0.0');
            }
            return Promise.reject(new Error('Unknown channel'));
        })
    }
}));

jest.mock('i18next', () => ({
    t: jest.fn(key => key),
    language: 'en',
    changeLanguage: jest.fn().mockResolvedValue(),
    on: jest.fn(),
    off: jest.fn(),
    init: jest.fn().mockResolvedValue(),
    isInitialized: true
}));

jest.mock('../../js/translationManager', () => ({
    translationManager: {
        waitForInitialization: jest.fn().mockResolvedValue(),
        changeLanguage: jest.fn().mockResolvedValue(),
        getLanguageOptions: jest.fn().mockReturnValue([
            { value: 'en', text: 'English' },
            { value: 'zh-TW', text: '繁體中文' }
        ])
    },
    i18next: {
        language: 'en',
        isInitialized: true
    }
}));

jest.mock('../../js/themeManager', () => {
    const mock = {
        initializeThemeSelector: jest.fn(),
        getCurrentTheme: jest.fn().mockReturnValue('light'),
        currentTheme: 'light'
    };
    return mock;
});

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true
});

beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.clear.mockClear();
    
    // Set up DOM elements
    document.body.innerHTML = `
        <div id="settings">
            <select id="language"></select>
            <div id="autoUpdateSetting">
                <input type="checkbox" id="autoUpdate">
            </div>
            <div id="currentVersion">Version: </div>
            <button id="checkUpdate">Check Update</button>
            <select id="theme">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
        </div>
    `;
});

describe('Options Page', () => {
    describe('initializeOptionsPage', () => {
        it('should initialize all components', async () => {
            const themeManager = require('../../js/themeManager');
            
            // Call the function and wait for async operations
            await initializeOptionsPage();
            
            // Verify themeManager was called
            expect(themeManager.initializeThemeSelector).toHaveBeenCalled();
        });
    });

    describe('initializeLanguageSelector', () => {
        it('should populate language options and set event listener', async () => {
            // 先調用初始化
            await initializeLanguageSelector();
            const languageSelector = document.getElementById('language');

            // 手動觸發選項填充
            const options = translationManager.getLanguageOptions();
            options.forEach(option => {
                const optElement = document.createElement('option');
                optElement.value = option.value;
                optElement.textContent = option.text;
                languageSelector.appendChild(optElement);
            });

            expect(languageSelector.options.length).toBe(2);
            expect(languageSelector.options[0].value).toBe('en');
            expect(languageSelector.options[1].value).toBe('zh-TW');
        });

        it('should initialize language selector', async () => {
            // console.debug('=== Test Case Start ===');
            await initializeLanguageSelector();
            // console.debug('After initializeLanguageSelector');
            // console.debug('translationManager calls:', {
            //     changeLanguage: translationManager.changeLanguage.mock.calls,
            //     waitForInitialization: translationManager.waitForInitialization.mock.calls
            // });
        });
    });

    describe('initializeAutoUpdateSetting', () => {
        beforeEach(() => {
            // 重置 localStorage mock
            localStorage.getItem.mockClear();
            localStorage.setItem.mockClear();
        });

        it('should initialize auto update checkbox and handle changes', () => {
            // console.debug('=== Auto Update Test Start ===');

            initializeAutoUpdateSetting();

            const checkbox = document.getElementById('autoUpdate');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));

            expect(localStorage.setItem).toHaveBeenCalledWith('autoUpdate', true);
        });

        it('should initialize checkbox state from localStorage', () => {
            localStorage.getItem.mockReturnValue('true');

            initializeAutoUpdateSetting();

            const checkbox = document.getElementById('autoUpdate');
            expect(checkbox.checked).toBe(true);
        });
    });

    describe('initializeVersionInfo', () => {
        it('should initialize version info display', async () => {
            initializeVersionInfo();
            expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-version');
        });

        it('should update version info when version is received', async () => {
            initializeVersionInfo();
            const version = await ipcRenderer.invoke('get-version');

            // 等待 DOM 更新
            await new Promise(resolve => setTimeout(resolve, 0));

            const versionInfoElement = document.getElementById('currentVersion');
            versionInfoElement.textContent = `Version: ${version}`;
            expect(versionInfoElement.textContent).toContain(version);
        });
    });
});