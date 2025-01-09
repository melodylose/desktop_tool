class UIStateManager {
    constructor(elements) {
        this.elements = elements;
    }

    showConnectingState() {
        this.elements.connectBtnNormalState.style.display = 'none';
        this.elements.connectBtnConnectingState.style.display = 'inline-block';
        this.elements.connectBtnConnectedState.style.display = 'none';
        this.elements.connectBtn.disabled = true;
    }

    showConnectedState() {
        this.elements.connectBtnNormalState.style.display = 'none';
        this.elements.connectBtnConnectingState.style.display = 'none';
        this.elements.connectBtnConnectedState.style.display = 'inline-block';
        this.elements.connectBtn.disabled = false;
    }

    showNormalState() {
        this.elements.connectBtnNormalState.style.display = 'inline-block';
        this.elements.connectBtnConnectingState.style.display = 'none';
        this.elements.connectBtnConnectedState.style.display = 'none';
        this.elements.connectBtn.disabled = false;
    }

    updateButtonStates(isConnected) {
        console.log('Updating button states, isConnected:', isConnected);
        // 連線相關按鈕
        this.elements.addKeyBtn.disabled = !isConnected;
        this.elements.deleteKeyBtn.disabled = true; // 只有在選擇了鍵值時才啟用
        this.elements.saveExistingKeyBtn.disabled = true; // 只有在選擇了鍵值時才啟用
        this.elements.saveNewKeyBtn.disabled = !isConnected; // 只要有連線就可以新增鍵值
    }

    updateButtonStatesForConnection(connection) {
        console.log('Updating button states for connection:', connection);
        const isConnected = connection && connection.status === 'ready' && connection.client;
        this.updateButtonStates(isConnected);
    }

    showNotification(message, type = 'info') {
        const { ipcRenderer } = require('electron');
        const titles = {
            'error': '錯誤',
            'success': '成功',
            'info': '提示',
            'warning': '警告'
        };
        ipcRenderer.send('show-notification', {
            title: titles[type] || titles.info,
            body: message
        });
    }
}

module.exports = UIStateManager;
