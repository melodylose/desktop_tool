class FtpUIHandler {
    constructor() {
        this.elements = {};
        this.isConnected = false;
    }

    initialize() {
        console.log('FTP UI Handler initializing...');
        try {
            // 獲取所有需要的 DOM 元素
            this.elements = {
                connectBtn: document.getElementById('connectBtn'),
                connectBtnNormalState: document.querySelector('#connectBtn .normal-state'),
                connectBtnConnectingState: document.querySelector('#connectBtn .connecting-state'),
                uploadBtn: document.getElementById('uploadBtn'),
                downloadBtn: document.getElementById('downloadBtn'),
                downloadProgress: document.getElementById('downloadProgress'),
                sortableHeader: document.querySelector('.sortable'),
                ftpServer: document.getElementById('ftpServer'),
                ftpHistory: document.getElementById('ftpHistory'),
                username: document.getElementById('username'),
                password: document.getElementById('password'),
                fileList: document.getElementById('fileList'),
                selectAll: document.getElementById('selectAll'),
                anonymousLogin: document.getElementById('anonymousLogin')
            };

            // 檢查必要的元素是否存在
            const requiredElements = ['connectBtn', 'uploadBtn', 'downloadBtn', 'downloadProgress', 
                'ftpServer', 'ftpHistory', 'username', 'password', 'fileList', 'selectAll', 'anonymousLogin'];
            for (const key of requiredElements) {
                if (!this.elements[key]) {
                    throw new Error(`Required element ${key} not found`);
                }
            }
        } catch (error) {
            console.error('Error initializing FTP UI handler:', error);
            throw error;
        }
    }

    setConnectingState(isConnecting) {
        if (!this.elements.connectBtn) return;

        const normalState = this.elements.connectBtn.querySelector('.normal-state');
        const connectingState = this.elements.connectBtn.querySelector('.connecting-state');
        const connectedState = this.elements.connectBtn.querySelector('.connected-state');

        if (!normalState || !connectingState || !connectedState) {
            console.error('Button states not found');
            return;
        }

        this.elements.connectBtn.disabled = isConnecting;
        
        // 隱藏所有狀態
        normalState.style.display = 'none';
        connectingState.style.display = 'none';
        connectedState.style.display = 'none';

        // 顯示對應狀態
        if (isConnecting) {
            connectingState.style.display = 'inline-block';
        } else if (this.isConnected) {
            connectedState.style.display = 'inline-block';
            this.elements.connectBtn.classList.remove('btn-primary');
            this.elements.connectBtn.classList.add('btn-success');
        } else {
            normalState.style.display = 'inline-block';
            this.elements.connectBtn.classList.remove('btn-success');
            this.elements.connectBtn.classList.add('btn-primary');
        }
    }

    updateConnectionStatus(connected, errorMessage = '') {
        if (connected) {
            this.isConnected = true;
            this.elements.connectBtn.disabled = false;
            this.setConnectingState(false);  // 這會顯示已連線狀態
        } else {
            this.isConnected = false;
            this.elements.connectBtn.disabled = false;
            this.setConnectingState(false);  // 這會顯示未連線狀態
            if (errorMessage) {
                console.error(errorMessage);
            }
        }
    }

    setInputFieldsState(disabled) {
        if (!this.elements.ftpServer || !this.elements.username || !this.elements.password) {
            return;
        }

        this.elements.ftpServer.disabled = disabled;
        this.elements.username.disabled = disabled;
        this.elements.password.disabled = disabled;
    }

    updateProgressBar(percentage) {
        const progressBar = this.elements.downloadProgress.querySelector('.progress-bar');
        if (progressBar) {
            const validPercentage = Math.max(0, Math.min(Math.round(percentage), 100));
            progressBar.style.width = `${validPercentage}%`;
            progressBar.textContent = `${validPercentage}%`;
            
            // 只在元素支援 setAttribute 時使用
            if (typeof progressBar.setAttribute === 'function') {
                progressBar.setAttribute('aria-valuenow', validPercentage);
            }
        }
    }

    setDownloadButtonState(disabled) {
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.disabled = disabled;
        }
    }

    updateDownloadButton(hasSelection) {
        if (this.elements.downloadBtn) {
            this.elements.downloadBtn.disabled = !hasSelection || !this.isConnected;
        }
    }

    getElements() {
        return this.elements;
    }
}

module.exports = FtpUIHandler;
