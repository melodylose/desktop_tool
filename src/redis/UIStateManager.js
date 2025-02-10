const NotificationManager = require('../js/NotificationManager.js');

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
        NotificationManager.show(message, type);
    }

    /**
     * 設置確認按鈕事件
     */
    handleConfirm() {
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
                if (modal) {
                    modal.hide();
                }
            });
        }
    }
}

module.exports = UIStateManager;
