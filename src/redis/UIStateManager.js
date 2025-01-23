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
        const titles = {
            success: '成功',
            error: '錯誤',
            warning: '警告',
            info: '提示'
        };

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">${titles[type] || titles.info}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(container);
        }

        document.getElementById('toastContainer').appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
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
