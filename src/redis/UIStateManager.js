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
        this.elements.addKeyBtn.disabled = !isConnected;
        this.elements.deleteKeyBtn.disabled = !isConnected;
    }

    showNotification(message, type = 'error') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('show-notification', {
            title: type === 'error' ? '錯誤' : '提示',
            body: message
        });
    }
}

module.exports = UIStateManager;
