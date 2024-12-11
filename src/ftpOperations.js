const { ipcRenderer } = require('electron');
const BasicFtp = require('basic-ftp');

class FtpHandler {
    constructor() {
        this.client = new BasicFtp.Client();
        this.isConnected = false;
        this.currentFiles = [];
        this.elements = {};
    }

    initialize() {
        console.log('FTP Handler initializing...');
        try {
            // 獲取所有需要的 DOM 元素
            this.elements = {
                connectBtn: document.getElementById('connectBtn'),
                uploadBtn: document.getElementById('uploadBtn'),
                sortableHeader: document.querySelector('.sortable'),
                ftpServer: document.getElementById('ftpServer'),
                username: document.getElementById('username'),
                password: document.getElementById('password'),
                fileList: document.getElementById('fileList')
            };

            // 檢查必要的元素是否存在
            const requiredElements = ['connectBtn', 'uploadBtn', 'ftpServer', 'username', 'password', 'fileList'];
            for (const key of requiredElements) {
                if (!this.elements[key]) {
                    throw new Error(`Required element ${key} not found`);
                }
            }

            // 綁定事件
            this.bindEvents();

        } catch (error) {
            console.error('Error initializing FTP handler:', error);
        }
    }

    bindEvents() {
        // 連接按鈕事件
        this.elements.connectBtn.addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnectFromFTP();
            } else {
                this.connectToFTP();
            }
        });

        // 上傳按鈕事件
        this.elements.uploadBtn.addEventListener('click', (e) => {
            console.log('Upload button clicked');
            e.preventDefault();
            this.initiateUpload();
        });

        // 排序功能事件
        if (this.elements.sortableHeader) {
            this.elements.sortableHeader.addEventListener('click', (event) => this.sortFileList(event));
        }
    }

    async connectToFTP() {
        if (!this.elements.ftpServer || !this.elements.username || !this.elements.password) {
            console.error('Required input elements not found');
            return;
        }

        try {
            await this.client.access({
                host: this.elements.ftpServer.value,
                user: this.elements.username.value,
                password: this.elements.password.value,
                secure: false
            });

            this.isConnected = true;
            this.updateConnectionStatus(true);
            await this.listDirectory();
        } catch (err) {
            console.error('Connection failed:', err);
            this.updateConnectionStatus(false, err.message);
        }
    }

    async disconnectFromFTP() {
        try {
            await this.client.close();
            this.isConnected = false;
            this.currentFiles = [];
            this.updateConnectionStatus(false);
            
            // 清空檔案列表
            if (this.elements.fileList) {
                this.elements.fileList.innerHTML = '';
            }
            
            console.log('Disconnected from FTP server');
        } catch (err) {
            console.error('Error disconnecting:', err);
        }
    }

    async listDirectory() {
        if (!this.isConnected || !this.elements.fileList) return;

        try {
            const list = await this.client.list();
            this.currentFiles = list;
            this.displayFileList(list);
        } catch (err) {
            console.error('Failed to list directory:', err);
        }
    }

    displayFileList(files) {
        if (!this.elements.fileList) return;

        this.elements.fileList.innerHTML = '';

        files.forEach(file => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${file.name}</td>
                <td>${file.isDirectory ? 'Directory' : 'File'}</td>
                <td>${this.formatFileSize(file.size)}</td>
                <td>${new Date(file.modifiedAt).toLocaleString()}</td>
            `;
            this.elements.fileList.appendChild(row);
        });
    }

    sortFileList(event) {
        const sortDirection = event.target.classList.contains('sort-asc') ? 'desc' : 'asc';
        event.target.classList.toggle('sort-asc');
        event.target.classList.toggle('sort-desc');

        this.currentFiles.sort((a, b) => {
            const timeA = new Date(a.modifiedAt).getTime();
            const timeB = new Date(b.modifiedAt).getTime();
            return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });

        this.displayFileList(this.currentFiles);
    }

    updateConnectionStatus(success, message = '') {
        if (!this.elements.connectBtn) return;

        if (success) {
            this.elements.connectBtn.classList.remove('btn-primary');
            this.elements.connectBtn.classList.add('btn-success');
            this.elements.connectBtn.innerHTML = '<i class="fas fa-check me-2"></i>Disconnect';
            
            // 禁用輸入欄位
            this.elements.ftpServer.disabled = true;
            this.elements.username.disabled = true;
            this.elements.password.disabled = true;
        } else {
            this.elements.connectBtn.classList.remove('btn-success');
            this.elements.connectBtn.classList.add('btn-primary');
            this.elements.connectBtn.innerHTML = '<i class="fas fa-plug me-2"></i>Connect';
            
            // 啟用輸入欄位
            this.elements.ftpServer.disabled = false;
            this.elements.username.disabled = false;
            this.elements.password.disabled = false;

            if (message) {
                alert(`Connection failed: ${message}`);
            }
        }
    }

    async initiateUpload() {
        console.log('Initiating upload process');
        if (!this.isConnected) {
            alert('Please connect to FTP server first');
            return;
        }

        try {
            console.log('Opening file dialog');
            const result = await ipcRenderer.invoke('show-file-dialog');
            console.log('File dialog result:', result);

            if (result.filePaths && result.filePaths.length > 0) {
                for (const filePath of result.filePaths) {
                    console.log('Uploading file:', filePath);
                    const fileName = filePath.split('\\').pop();
                    await this.client.uploadFrom(filePath, fileName);
                    console.log('File uploaded successfully:', fileName);
                }
                await this.listDirectory(); // Refresh the file list
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Upload failed: ' + err.message);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    cleanup() {
        if (this.client) {
            this.client.close();
        }
    }
}

module.exports = FtpHandler;
