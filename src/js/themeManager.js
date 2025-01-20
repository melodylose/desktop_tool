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
        // 設定 Bootstrap 5 主題
        document.body.setAttribute('data-bs-theme', theme);
        // 設定自定義主題
        document.documentElement.setAttribute('data-bs-theme', theme);
        
        // 更新特定元素的主題相關類別
        const isDark = theme === 'dark';
        
        // 更新表格樣式
        document.querySelectorAll('.table').forEach(table => {
            table.classList.toggle('table-dark', isDark);
        });

        // 更新卡片樣式
        document.querySelectorAll('.card').forEach(card => {
            if (isDark) {
                card.classList.add('border-secondary');
            } else {
                card.classList.remove('border-secondary');
            }
        });

        // 更新導航標籤
        document.querySelectorAll('.nav-tabs .nav-link').forEach(tab => {
            if (isDark) {
                tab.classList.add('text-light');
            } else {
                tab.classList.remove('text-light');
            }
        });

        // 更新按鈕樣式
        document.querySelectorAll('.btn-light').forEach(btn => {
            if (isDark) {
                btn.classList.add('btn-dark');
                btn.classList.remove('btn-light');
            } else {
                btn.classList.add('btn-light');
                btn.classList.remove('btn-dark');
            }
        });

        // 觸發自定義事件，通知其他組件主題已更改
        const event = new CustomEvent('themeChanged', { detail: { theme } });
        document.dispatchEvent(event);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// 創建單例實例
const themeManager = new ThemeManager();

module.exports = themeManager;
