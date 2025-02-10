const i18next = require('i18next');
const { translationManager } = require('./translationManager');

class NotificationManager {
    static async getTitle(type) {
        // 確保 i18next 已初始化
        if (!(await translationManager.initPromise)) {
            throw new Error('translationManager has not been initialized');
        }
        return i18next.t(`common.${type}`);
    }

    static colors = {
        success: '#198754',  // 綠色
        error: '#dc3545',    // 紅色
        warning: '#ffc107',  // 黃色
        info: '#0dcaf0'      // 藍色
    };

    static async show(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');

        // 根據類型設置邊框和背景顏色
        const color = this.colors[type] || this.colors.info;
        toast.style.borderLeft = `4px solid ${color}`;
        
        const title = await this.getTitle(type);
        toast.innerHTML = `
            <div class="toast-header" style="background-color: ${color}20;">
                <strong class="me-auto" style="color: ${color};">${title}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

        const toastContainer = this.getOrCreateContainer();
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();

        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    static getOrCreateContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(container);
        }
        return container;
    }
}

// 導出 NotificationManager
module.exports = NotificationManager;
