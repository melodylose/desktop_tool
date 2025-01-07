const FtpClient = require('./FtpClient');
const FtpUIHandler = require('./FtpUIHandler');
const FtpFileOperations = require('./FtpFileOperations');
const FtpHistoryManager = require('./FtpHistoryManager');
const FtpFileListHandler = require('./FtpFileListHandler');

class FtpHandler {
    constructor() {
        this.ftpClient = new FtpClient();
        this.uiHandler = new FtpUIHandler();
        this.fileOperations = new FtpFileOperations(this.ftpClient, this.uiHandler);
        this.historyManager = new FtpHistoryManager(this.uiHandler);
        this.fileListHandler = new FtpFileListHandler(this.ftpClient, this.uiHandler, this.fileOperations);
        this.uiHandler.setFileListHandler(this.fileListHandler);
    }

    initialize() {
        // 初始化 UI
        this.uiHandler.initialize();
        
        // 載入歷史記錄
        this.historyManager.loadFtpHistory();
        
        // 綁定事件
        this.bindEvents();
    }

    bindEvents() {
        const elements = this.uiHandler.getElements();

        // 連接按鈕事件
        elements.connectBtn.addEventListener('click', async () => {
            if (this.ftpClient.isConnectedToServer()) {
                await this.disconnectFromFTP();
            } else {
                await this.connectToFTP();
            }
        });

        // 上傳按鈕事件
        elements.uploadBtn.addEventListener('click', (e) => {
            console.log('Upload button clicked');
            e.preventDefault();
            this.fileOperations.initiateUpload();
        });

        // 下載按鈕事件
        elements.downloadBtn.addEventListener('click', (e) => {
            console.log('Download button clicked');
            e.preventDefault();
            this.fileOperations.initiateDownload(this.fileListHandler.getSelectedFiles());
        });

        // 刷新按鈕事件
        elements.refreshBtn.addEventListener('click', async (e) => {
            console.log('Refresh button clicked');
            e.preventDefault();
            try {
                await this.ftpClient.listDirectory();
                this.fileListHandler.displayFileList(this.ftpClient.getCurrentFiles());
            } catch (err) {
                console.error('Failed to refresh file list:', err);
            }
        });

        // 排序功能事件
        if (elements.sortableHeader) {
            elements.sortableHeader.addEventListener('click', (event) => this.fileListHandler.sortFileList(event));
        }

        // 全選checkbox事件
        elements.selectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            this.fileListHandler.toggleSelectAll(isChecked);
        });

        // 匿名登入checkbox事件
        elements.anonymousLogin.addEventListener('change', (e) => {
            const isAnonymous = e.target.checked;
            elements.username.disabled = isAnonymous;
            elements.password.disabled = isAnonymous;
            if (isAnonymous) {
                elements.username.value = 'anonymous';
                elements.password.value = 'anonymous@example.com';
            } else {
                elements.username.value = '';
                elements.password.value = '';
            }
        });
    }

    async connectToFTP() {
        const elements = this.uiHandler.getElements();
        this.uiHandler.setConnectingState(true);
        this.uiHandler.setInputFieldsState(true);

        try {
            await this.ftpClient.connectToFTP(
                elements.ftpServer.value.trim(),
                elements.username.value,
                elements.password.value
            );

            this.uiHandler.updateConnectionStatus(true);
            this.historyManager.addToFtpHistory(elements.ftpServer.value.trim());
            this.fileListHandler.displayFileList(this.ftpClient.getCurrentFiles());

        } catch (err) {
            this.uiHandler.updateConnectionStatus(false, err.message);
            this.uiHandler.setInputFieldsState(false);
        } finally {
            this.uiHandler.setConnectingState(false);
        }
    }

    async disconnectFromFTP() {
        this.uiHandler.setConnectingState(true);

        try {
            await this.ftpClient.disconnectFromFTP();
            this.uiHandler.updateConnectionStatus(false);
            this.fileListHandler.displayFileList([]);
            this.uiHandler.setInputFieldsState(false);
        } catch (err) {
            console.error('Disconnection failed:', err);
        } finally {
            this.uiHandler.setConnectingState(false);
        }
    }

    cleanup() {
        this.ftpClient.cleanup();
    }
}

module.exports = FtpHandler;
