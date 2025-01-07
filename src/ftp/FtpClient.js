const BasicFtp = require('basic-ftp');
const { ipcRenderer } = require('electron');

class FtpClient {
    constructor() {
        this.client = new BasicFtp.Client();
        this.isConnected = false;
        this.currentPath = '/';
        this.currentFiles = [];
    }

    validateFtpUrl(url) {
        if (!url || typeof url !== 'string') {
            return { isValid: false, message: 'FTP 伺服器地址不能為空' };
        }

        // 移除前綴 "ftp://" 如果存在
        url = url.replace(/^ftp:\/\//i, '');

        // 基本格式驗證
        const urlPattern = /^[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](:[0-9]{1,5})?$/;
        if (!urlPattern.test(url)) {
            return { isValid: false, message: 'FTP 伺服器地址格式無效' };
        }

        // 檢查端口範圍（如果有指定）
        const portMatch = url.match(/:(\d+)$/);
        if (portMatch) {
            const port = parseInt(portMatch[1]);
            if (port < 1 || port > 65535) {
                return { isValid: false, message: 'FTP 端口必須在 1-65535 範圍內' };
            }
        }

        return { isValid: true, message: '' };
    }

    async connectToFTP(host, username, password) {
        try {
            const validation = this.validateFtpUrl(host);
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            await this.client.access({
                host,
                user: username,
                password,
                secure: false
            });

            this.isConnected = true;
            await this.listDirectory();
            return true;
        } catch (err) {
            console.error('Connection failed:', err);
            this.isConnected = false;
            throw err;
        }
    }

    async disconnectFromFTP() {
        try {
            await this.client.close();
            this.isConnected = false;
            this.currentFiles = [];
            this.currentPath = '/';
            return true;
        } catch (err) {
            console.error('Disconnection failed:', err);
            throw err;
        }
    }

    async listDirectory(path = this.currentPath) {
        if (!this.isConnected) return [];

        try {
            // 先回到根目錄
            await this.client.cd('/');
            
            // 如果不是根目錄，再進入指定目錄
            if (path !== '/') {
                await this.client.cd(path);
            }
            
            const list = await this.client.list();
            this.currentFiles = list;
            this.currentPath = path;
            return list;
        } catch (err) {
            console.error('Failed to list directory:', err);
            throw err;
        }
    }

    cleanup() {
        if (this.client) {
            this.client.close();
        }
    }

    // Getter methods
    getCurrentPath() {
        return this.currentPath;
    }

    getCurrentFiles() {
        return this.currentFiles;
    }

    isConnectedToServer() {
        return this.isConnected;
    }

    getClient() {
        return this.client;
    }
}

module.exports = FtpClient;
