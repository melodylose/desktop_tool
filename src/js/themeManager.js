class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('appTheme') || 'light';
        this.initialize();
    }

    initialize() {
        // 設定初始主題
        this.applyTheme(this.currentTheme);
        this.initializeThemeSelector();
    }

    initializeThemeSelector() {
        const themeSelect = document.getElementById('theme');
        if (!themeSelect) return;

        // 設定當前主題
        themeSelect.value = this.currentTheme;

        // 監聽主題變更事件
        themeSelect.addEventListener('change', (event) => {
            const newTheme = event.target.value;
            this.changeTheme(newTheme);
        });
    }

    changeTheme(newTheme) {
        this.currentTheme = newTheme;
        localStorage.setItem('appTheme', newTheme);
        this.applyTheme(newTheme);
    }

    applyTheme(theme) {
        document.body.setAttribute('data-bs-theme', theme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// 創建單例實例
const themeManager = new ThemeManager();

module.exports = themeManager;
