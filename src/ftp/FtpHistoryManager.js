class FtpHistoryManager {
    constructor(uiHandler) {
        this.uiHandler = uiHandler;
        this.ftpHistory = [];
        this.maxHistoryItems = 10;
    }

    loadFtpHistory() {
        try {
            const history = localStorage.getItem('ftpServerHistory');
            if (history) {
                this.ftpHistory = JSON.parse(history);
                this.updateFtpHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading FTP history:', error);
            this.ftpHistory = [];
        }
    }

    saveFtpHistory() {
        try {
            localStorage.setItem('ftpServerHistory', JSON.stringify(this.ftpHistory));
        } catch (error) {
            console.error('Error saving FTP history:', error);
        }
    }

    updateFtpHistoryDisplay() {
        const elements = this.uiHandler.getElements();
        if (!elements.ftpHistory) return;
        
        // 清空現有選項
        elements.ftpHistory.innerHTML = '';
        
        // 添加歷史記錄
        this.ftpHistory.forEach(url => {
            const option = document.createElement('option');
            option.value = url;
            elements.ftpHistory.appendChild(option);
        });
    }

    addToFtpHistory(url) {
        if (!url) return;
        
        // 移除重複項
        this.ftpHistory = this.ftpHistory.filter(item => item !== url);
        
        // 添加到開頭
        this.ftpHistory.unshift(url);
        
        // 保持最大數量限制
        if (this.ftpHistory.length > this.maxHistoryItems) {
            this.ftpHistory = this.ftpHistory.slice(0, this.maxHistoryItems);
        }
        
        this.saveFtpHistory();
        this.updateFtpHistoryDisplay();
    }
}

module.exports = FtpHistoryManager;
