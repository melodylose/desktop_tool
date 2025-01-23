const bootstrap = require('bootstrap');
const { i18next } = require('../../js/translationManager');

/**
 * 對話框管理器
 * 提供統一的對話框處理機制
 */
class DialogManager {
    /**
     * 建立對話框管理器
     * @param {UIStateManager} uiStateManager - UI 狀態管理器
     */
    constructor(uiStateManager) {
        this.uiStateManager = uiStateManager;
    }

    /**
     * 顯示刪除確認對話框
     * @param {string} keyName - 要刪除的鍵值名稱
     * @returns {Promise<boolean>} - 使用者確認刪除返回true，取消返回false
     */
    async showDeleteConfirmDialog(keyName) {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('deleteConfirmModal');
            if (!modalElement) {
                this.uiStateManager.showNotification('無法顯示刪除確認對話框', 'error');
                resolve(false);
                return;
            }

            const modal = new bootstrap.Modal(modalElement);
            const messageElement = modalElement.querySelector('[data-i18n="redis.keyManagement.confirmDeleteMessage"]');
            const confirmBtn = modalElement.querySelector('#confirmDeleteBtn');

            if (!messageElement || !confirmBtn) {
                this.uiStateManager.showNotification('無法顯示刪除確認對話框：找不到必要元素', 'error');
                resolve(false);
                return;
            }

            // 設置確認訊息
            messageElement.textContent = i18next.t('redis.keyManagement.confirmDeleteMessage', { keyName });

            // 移除舊的事件監聽器
            if (confirmBtn.handleConfirm) {
                confirmBtn.removeEventListener('click', confirmBtn.handleConfirm);
            }

            // 清理函數
            const cleanup = () => {
                if (confirmBtn.handleConfirm) {
                    confirmBtn.removeEventListener('click', confirmBtn.handleConfirm);
                    confirmBtn.handleConfirm = null;
                }
                modal.hide();
                // 等待 modal 隱藏動畫完成後再清理
                modalElement.addEventListener('hidden.bs.modal', () => {
                    modal.dispose();
                    // 移除 modal backdrop
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                    // 移除 modal-open class
                    document.body.classList.remove('modal-open');
                    // 移除 inline style
                    document.body.style.removeProperty('padding-right');
                    document.body.style.removeProperty('overflow');
                }, { once: true });
            };

            // 設置確認處理函數
            confirmBtn.handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            // 設置取消處理函數
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            // 添加事件監聽器
            confirmBtn.addEventListener('click', confirmBtn.handleConfirm);
            modalElement.addEventListener('hidden.bs.modal', handleCancel, { once: true });

            // 顯示對話框
            modal.show();
        });
    }

    /**
     * 顯示伺服器刪除確認對話框
     * @param {string} message - 確認訊息
     * @returns {Promise<boolean>} - 使用者確認返回true，取消返回false
     */
    async showServerDeleteConfirmDialog() {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('serverDeleteConfirmModal');
            if (!modalElement) {
                this.uiStateManager.showNotification('無法顯示刪除確認對話框', 'error');
                resolve(false);
                return;
            }

            const modal = new bootstrap.Modal(modalElement);
            const confirmBtn = modalElement.querySelector('#confirmServerDeleteBtn');
            const cancelBtn = modalElement.querySelector('#cancelServerDeleteBtn');

            if (!confirmBtn || !cancelBtn) {
                this.uiStateManager.showNotification('無法顯示刪除確認對話框：找不到必要元素', 'error');
                resolve(false);
                return;
            }

            // 移除舊的事件監聽器
            if (confirmBtn.handleConfirm) {
                confirmBtn.removeEventListener('click', confirmBtn.handleConfirm);
            }
            if (cancelBtn.handleCancel) {
                cancelBtn.removeEventListener('click', cancelBtn.handleCancel);
            }

            // 清理函數
            const cleanup = () => {
                if (confirmBtn.handleConfirm) {
                    confirmBtn.removeEventListener('click', confirmBtn.handleConfirm);
                }
                if (cancelBtn.handleCancel) {
                    cancelBtn.removeEventListener('click', cancelBtn.handleCancel);
                }
                modal.hide();
            };

            // 確認按鈕處理函數
            confirmBtn.handleConfirm = () => {
                cleanup();
                resolve(true);
            };

            // 取消按鈕處理函數
            cancelBtn.handleCancel = () => {
                cleanup();
                resolve(false);
            };

            // 綁定事件
            confirmBtn.addEventListener('click', confirmBtn.handleConfirm);
            cancelBtn.addEventListener('click', cancelBtn.handleCancel);

            // 當對話框隱藏時解析為false
            modalElement.addEventListener('hidden.bs.modal', () => {
                cleanup();
                resolve(false);
            }, { once: true });

            // 顯示對話框
            modal.show();
        });
    }

    /**
     * 顯示輸入對話框
     * @param {string} title - 對話框標題
     * @param {string} message - 對話框訊息
     * @returns {Promise<string|null>} - 使用者輸入的值，如果取消則返回null
     */
    async showInputDialog(title, message) {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('ttlInputModal');
            if (!modalElement) {
                this.uiStateManager.showNotification('無法顯示輸入對話框', 'error');
                resolve(null);
                return;
            }

            const modal = new bootstrap.Modal(modalElement);
            const input = document.getElementById('ttlInput');
            const confirmBtn = document.getElementById('confirmTtlBtn');
            
            if (!input || !confirmBtn) {
                this.uiStateManager.showNotification('無法顯示輸入對話框：找不到必要元素', 'error');
                resolve(null);
                return;
            }

            // 重置輸入值
            input.value = '';
            
            // 清理函數
            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                modal.hide();
                // 等待 modal 隱藏動畫完成後再清理
                modalElement.addEventListener('hidden.bs.modal', () => {
                    modal.dispose();
                    // 移除 modal backdrop
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                    // 移除 modal-open class
                    document.body.classList.remove('modal-open');
                    // 移除 inline style
                    document.body.style.removeProperty('padding-right');
                    document.body.style.removeProperty('overflow');
                }, { once: true });
            };
            
            // 設置確認按鈕事件
            const handleConfirm = () => {
                const value = input.value;
                cleanup();
                resolve(value || null);
            };
            
            // 設置取消處理函數
            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            // 添加事件監聽器
            confirmBtn.addEventListener('click', handleConfirm);
            modalElement.addEventListener('hidden.bs.modal', handleCancel, { once: true });
            
            // 顯示對話框
            modal.show();
        });
    }

    /**
     * 顯示設定過期時間對話框
     * @param {string} keyName - 要設定過期時間的鍵值名稱
     * @returns {Promise<string|null>} - 使用者輸入的過期時間（秒），取消返回null
     */
    async showTTLDialog(keyName) {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('ttlInputModal');
            if (!modalElement) {
                this.uiStateManager.showNotification('無法顯示過期時間設定對話框', 'error');
                resolve(null);
                return;
            }

            const modal = new bootstrap.Modal(modalElement);
            const input = document.getElementById('ttlInput');
            const confirmBtn = document.getElementById('confirmTtlBtn');

            if (!input || !confirmBtn) {
                this.uiStateManager.showNotification('無法顯示過期時間設定對話框：找不到必要元素', 'error');
                resolve(null);
                return;
            }

            // 重置輸入值
            input.value = '';

            // 移除舊的事件監聽器
            if (confirmBtn.handleConfirm) {
                confirmBtn.removeEventListener('click', confirmBtn.handleConfirm);
            }

            // 設置確認按鈕事件
            confirmBtn.handleConfirm = () => {
                const value = input.value.trim();
                modal.hide();
                resolve(value || null);
            };
            confirmBtn.addEventListener('click', confirmBtn.handleConfirm);

            // 設置取消按鈕事件
            const handleCancel = () => {
                confirmBtn.removeEventListener('click', confirmBtn.handleConfirm);
                resolve(null);
            };

            // 設置modal關閉事件
            modalElement.addEventListener('hidden.bs.modal', handleCancel, { once: true });

            // 顯示對話框
            modal.show();
        });
    }

    /**
     * 銷毀處理器
     */
    destroy() {
        // TODO: implement destroy method
    }
}

module.exports = DialogManager;
