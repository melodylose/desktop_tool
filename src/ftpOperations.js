const { ipcRenderer } = require('electron');
const BasicFtp = require('basic-ftp');

class FtpHandler {
    constructor() {
        this.client = new BasicFtp.Client();
        this.isConnected = false;
        this.currentFiles = [];
        this.elements = {};
        this.selectedFiles = new Set();
        this.currentPath = '/';
        this.totalBytes = 0;
        this.downloadedBytes = 0;
        this.ftpHistory = [];
        this.maxHistoryItems = 10;
    }

    initialize() {
        console.log('FTP Handler initializing...');
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

        // 下載按鈕事件
        this.elements.downloadBtn.addEventListener('click', (e) => {
            console.log('Download button clicked');
            e.preventDefault();
            this.initiateDownload();
        });

        // 排序功能事件
        if (this.elements.sortableHeader) {
            this.elements.sortableHeader.addEventListener('click', (event) => this.sortFileList(event));
        }

        // 全選checkbox事件
        this.elements.selectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            this.toggleSelectAll(isChecked);
        });

        // 匿名登入checkbox事件
        this.elements.anonymousLogin.addEventListener('change', (e) => {
            const isAnonymous = e.target.checked;
            this.elements.username.disabled = isAnonymous;
            this.elements.password.disabled = isAnonymous;
            if (isAnonymous) {
                this.elements.username.value = 'anonymous';
                this.elements.password.value = 'anonymous@example.com';
            } else {
                this.elements.username.value = '';
                this.elements.password.value = '';
            }
        });

        // 初始化時載入歷史記錄
        this.loadFtpHistory();
    }

    loadFtpHistory() {
        try {
            const history = localStorage.getItem('ftpServerHistory');
            if (history) {
                this.ftpHistory = JSON.parse(history);
                this.updateFtpHistoryDisplay();
            }
        } catch (error) {
            console.error('Error loading FTP history:', error);
            this.ftpHistory = [];
        }
    }

    saveFtpHistory() {
        try {
            localStorage.setItem('ftpServerHistory', JSON.stringify(this.ftpHistory));
        } catch (error) {
            console.error('Error saving FTP history:', error);
        }
    }

    updateFtpHistoryDisplay() {
        if (!this.elements.ftpHistory) return;
        
        // 清空現有選項
        this.elements.ftpHistory.innerHTML = '';
        
        // 添加歷史記錄
        this.ftpHistory.forEach(url => {
            const option = document.createElement('option');
            option.value = url;
            this.elements.ftpHistory.appendChild(option);
        });
    }

    addToFtpHistory(url) {
        if (!url) return;
        
        // 移除重複項
        this.ftpHistory = this.ftpHistory.filter(item => item !== url);
        
        // 添加到開頭
        this.ftpHistory.unshift(url);
        
        // 保持最大數量限制
        if (this.ftpHistory.length > this.maxHistoryItems) {
            this.ftpHistory = this.ftpHistory.slice(0, this.maxHistoryItems);
        }
        
        this.saveFtpHistory();
        this.updateFtpHistoryDisplay();
    }

    toggleSelectAll(checked) {
        const checkboxes = this.elements.fileList.querySelectorAll('input[type="checkbox"]:not([disabled])');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            if (checkbox.dataset.filename) {
                this.handleRowSelection(checkbox, checkbox.dataset.filename);
            }
        });
        this.updateDownloadButton();
    }

    handleRowSelection(checkbox, filename) {
        const fileInfo = this.currentFiles.find(f => f.name === filename);
        if (!fileInfo || fileInfo.isDirectory) {
            return;
        }

        if (checkbox.checked) {
            this.selectedFiles.add(filename);
        } else {
            this.selectedFiles.delete(filename);
        }
        
        // 更新全選checkbox的狀態
        const allCheckboxes = Array.from(this.elements.fileList.querySelectorAll('input[type="checkbox"]:not([disabled])'));
        const checkedCount = allCheckboxes.filter(cb => cb.checked).length;
        
        if (allCheckboxes.length > 0) {
            if (checkedCount === 0) {
                this.elements.selectAll.checked = false;
                this.elements.selectAll.indeterminate = false;
            } else if (checkedCount === allCheckboxes.length) {
                this.elements.selectAll.checked = true;
                this.elements.selectAll.indeterminate = false;
            } else {
                this.elements.selectAll.checked = false;
                this.elements.selectAll.indeterminate = true;
            }
        }

        this.updateDownloadButton();
    }

    updateDownloadButton() {
        const hasFileSelected = Array.from(this.selectedFiles).some(filename => {
            const fileInfo = this.currentFiles.find(f => f.name === filename);
            return fileInfo && !fileInfo.isDirectory;
        });
        
        this.elements.downloadBtn.disabled = !hasFileSelected;
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
            this.elements.connectBtn.disabled = false;
            this.setConnectingState(false);  // 這會顯示已連線狀態
        } else {
            this.elements.connectBtn.disabled = false;
            this.setConnectingState(false);  // 這會顯示未連線狀態
            if (errorMessage) {
                // 顯示錯誤訊息
                console.error(errorMessage);
            }
        }
    }

    async connectToFTP() {
        if (!this.elements.ftpServer || !this.elements.username || !this.elements.password) {
            console.error('Required input elements not found');
            return;
        }

        // 如果已經連線，則執行斷開連線
        if (this.isConnected) {
            await this.disconnectFromFTP();
            return;
        }

        // 設置連線中狀態
        this.setConnectingState(true);

        try {
            const serverUrl = this.elements.ftpServer.value.trim();
            const validation = this.validateFtpUrl(serverUrl);
            
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            await this.client.access({
                host: serverUrl,
                user: this.elements.username.value,
                password: this.elements.password.value,
                secure: false
            });

            console.log('Connected to FTP server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            await this.listDirectory();
            
            // 成功連接後添加到歷史記錄
            this.addToFtpHistory(serverUrl);

        } catch (err) {
            console.error('Connection failed:', err);
            this.updateConnectionStatus(false, err.message);
            this.isConnected = false;
        } finally {
            // 恢復按鈕狀態
            this.setConnectingState(false);
        }
    }

    async disconnectFromFTP() {
        try {
            // 設置連線中狀態
            this.setConnectingState(true);

            await this.client.close();
            console.log('Disconnected from FTP server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.currentFiles = [];
            // 清空檔案列表
            this.displayFileList([]);
            
        } catch (err) {
            console.error('Disconnection failed:', err);
        } finally {
            // 恢復按鈕狀態
            this.setConnectingState(false);
        }
    }

    async listDirectory(path = this.currentPath) {
        if (!this.isConnected || !this.elements.fileList) return;

        try {
            console.log(`Listing directory: ${path}`);
            // 先回到根目錄
            await this.client.cd('/');
            
            // 如果不是根目錄，再進入指定目錄
            if (path !== '/') {
                await this.client.cd(path);
            }
            
            const list = await this.client.list();
            this.currentFiles = list;
            this.currentPath = path;
            console.log(`Current path set to: ${this.currentPath}`);
            this.displayFileList(list);
        } catch (err) {
            console.error('Failed to list directory:', err);
            ipcRenderer.send('show-notification', {
                title: 'Directory Error',
                body: `Failed to access directory: ${err.message}`
            });
        }
    }

    /**
     * 創建返回上層目錄的行
     * @returns {HTMLElement} 返回上層目錄的表格行元素
     */
    createBackRow() {
        const backRow = document.createElement('tr');
        backRow.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input" disabled>
            </td>
            <td class="directory-link">
                <i class="fas fa-level-up-alt me-2"></i>..
            </td>
            <td>Directory</td>
            <td>-</td>
            <td>-</td>
        `;
        const dirCell = backRow.querySelector('.directory-link');
        dirCell.style.cursor = 'pointer';
        dirCell.addEventListener('click', () => this.navigateToParent());
        return backRow;
    }

    /**
     * 創建檔案或目錄的行
     * @param {Object} file - 檔案或目錄的資訊
     * @returns {HTMLElement} 檔案或目錄的表格行元素
     */
    createFileRow(file) {
        const row = document.createElement('tr');
        const isDirectory = file.isDirectory;
        
        row.innerHTML = this.getFileRowHTML(file);

        if (isDirectory) {
            this.setupDirectoryRowEvents(row, file.name);
        } else {
            this.setupFileRowEvents(row, file.name);
        }

        return row;
    }

    /**
     * 生成檔案行的 HTML
     * @param {Object} file - 檔案或目錄的資訊
     * @returns {string} HTML 字符串
     */
    getFileRowHTML(file) {
        const isDirectory = file.isDirectory;
        return `
            <td>
                <input type="checkbox" class="form-check-input" data-filename="${file.name}"
                       ${isDirectory ? 'disabled' : ''}>
            </td>
            <td class="${isDirectory ? 'directory-link' : ''}">
                <i class="fas ${isDirectory ? 'fa-folder' : 'fa-file'} me-2"></i>${file.name}
            </td>
            <td>${isDirectory ? 'Directory' : 'File'}</td>
            <td>${this.formatFileSize(file.size)}</td>
            <td>${new Date(file.modifiedAt).toLocaleString()}</td>
        `;
    }

    /**
     * 設置目錄行的事件處理
     * @param {HTMLElement} row - 表格行元素
     * @param {string} dirName - 目錄名稱
     */
    setupDirectoryRowEvents(row, dirName) {
        const dirCell = row.querySelector('.directory-link');
        dirCell.style.cursor = 'pointer';
        dirCell.addEventListener('click', () => this.navigateToDirectory(dirName));
    }

    /**
     * 設置檔案行的事件處理
     * @param {HTMLElement} row - 表格行元素
     * @param {string} fileName - 檔案名稱
     */
    setupFileRowEvents(row, fileName) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            this.handleRowSelection(e.target, fileName);
        });
    }

    /**
     * 重置檔案列表的狀態
     */
    resetFileListState() {
        this.elements.fileList.innerHTML = '';
        this.selectedFiles.clear();
        this.elements.selectAll.checked = false;
        this.elements.selectAll.indeterminate = false;
        this.updateDownloadButton();
    }

    /**
     * 顯示檔案列表
     * @param {Array} files - 檔案和目錄的列表
     */
    displayFileList(files) {
        // 檢查 fileList 元素是否存在
        if (!this.elements.fileList) return;

        // 重置檔案列表狀態
        this.resetFileListState();

        // 如果不在根目錄，添加返回上層的選項
        if (this.currentPath !== '/') {
            this.elements.fileList.appendChild(this.createBackRow());
        }

        // 遍歷並顯示檔案列表
        files.forEach(file => {
            const row = this.createFileRow(file);
            this.elements.fileList.appendChild(row);
        });
    }

    async navigateToDirectory(dirName) {
        const newPath = this.currentPath === '/' 
            ? `/${dirName}`
            : `${this.currentPath}/${dirName}`;
        await this.listDirectory(newPath);
    }

    async navigateToParent() {
        console.log('Navigating to parent directory');
        if (this.currentPath === '/') {
            console.log('Already at root directory, cannot navigate up');
            return;
        }
        
        const parentPath = this.currentPath.split('/').slice(0, -1).join('/') || '/';
        console.log(`Parent path: ${parentPath}`);
        await this.listDirectory(parentPath);
        console.log('Navigation to parent directory complete');
    }

    async initiateUpload() {
        console.log('Initiating upload process');
        if (!this.isConnected) {
            ipcRenderer.send('show-notification', {
                title: 'Connection Required',
                body: 'Please connect to FTP server first'
            });
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
            ipcRenderer.send('show-notification', {
                title: 'Upload Error',
                body: 'Upload failed: ' + err.message
            });
        }
    }

    async getDownloadDirectory() {
        const result = await ipcRenderer.invoke('show-directory-dialog');
        if (!result.filePaths || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    }

    getDownloadableFiles() {
        return Array.from(this.selectedFiles).filter(filename => {
            const fileInfo = this.currentFiles.find(f => f.name === filename);
            return fileInfo && !fileInfo.isDirectory;
        });
    }

    async initiateDownload() {
        if (!this.isConnected || this.selectedFiles.size === 0) {
            return;
        }

        try {
            // 獲取下載目錄
            const downloadPath = await this.getDownloadDirectory();
            if (!downloadPath) return;

            // 獲取可下載的檔案列表
            const downloadableFiles = this.getDownloadableFiles();
            const weightPerFile = 100 / downloadableFiles.length;

            // 顯示進度條
            this.elements.downloadProgress.classList.remove('d-none');
            this.updateProgressBar(0);

            // 序列下載所有檔案
            const downloadResults = [];
            for (const filename of downloadableFiles) {
                const result = await this.downloadSingleFile(filename, downloadPath, weightPerFile);
                downloadResults.push(result);
            }

            // 確保顯示100%完成
            this.updateProgressBar(100);
            await new Promise(resolve => setTimeout(resolve, 500));

            // 顯示結果並清理
            this.showDownloadResult(downloadResults);
            this.elements.downloadProgress.classList.add('d-none');
            this.updateProgressBar(0);

        } catch (err) {
            console.error('Download failed:', err);
            this.elements.downloadProgress.classList.add('d-none');
            this.updateProgressBar(0);
            
            ipcRenderer.send('show-notification', {
                title: 'Download Error',
                body: 'Failed to download files: ' + err.message
            });
        }
    }

    async downloadSingleFile(filename, downloadPath, weightPerFile) {
        const uniqueName = this.generateUniqueFileName(downloadPath, filename);
        const localPath = `${downloadPath}\\${uniqueName}`;
        const fileInfo = this.currentFiles.find(f => f.name === filename);
        let lastProgress = 0;
        
        try {
            // 設置下載進度回調
            this.client.trackProgress(info => {
                if (fileInfo.size > 0) {
                    const currentFileProgress = Math.min((info.bytes / fileInfo.size) * 100, 100);
                    const progressIncrement = currentFileProgress - lastProgress;
                    
                    if (progressIncrement > 0) {
                        const totalProgressIncrement = (progressIncrement * weightPerFile) / 100;
                        const currentTotalProgress = parseFloat(this.elements.downloadProgress.querySelector('.progress-bar').style.width) || 0;
                        const newTotalProgress = Math.min(currentTotalProgress + totalProgressIncrement, 100);
                        this.updateProgressBar(newTotalProgress);
                        lastProgress = currentFileProgress;
                    }
                }
            });

            await this.client.downloadTo(localPath, filename);
            
            return {
                success: true,
                renamed: uniqueName !== filename ? { original: filename, renamed: uniqueName } : null
            };
        } catch (err) {
            console.error(`Failed to download ${filename}:`, err);
            return { success: false };
        } finally {
            // 關閉此檔案的進度追蹤
            this.client.trackProgress();
        }
    }

    showDownloadResult(results) {
        // 計算成功和失敗的下載數量
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        // 收集重命名的檔案資訊
        const renamedFiles = results
            .filter(r => r.renamed)
            .map(r => r.renamed);

        // 構建通知訊息
        let message = `Successfully downloaded ${successCount} files`;
        if (failCount > 0) {
            message += `, ${failCount} files failed`;
        }
        if (renamedFiles.length > 0) {
            message += '\nRenamed files:';
            renamedFiles.forEach(file => {
                message += `\n${file.original} → ${file.renamed}`;
            });
        }

        // 發送通知
        ipcRenderer.send('show-notification', {
            title: 'Download Complete',
            body: message
        });
    }

    updateProgressBar(percentage) {
        const progressBar = this.elements.downloadProgress.querySelector('.progress-bar');
        const roundedPercentage = Math.min(Math.round(percentage * 10) / 10, 100);
        progressBar.style.width = `${roundedPercentage}%`;
        progressBar.textContent = `${roundedPercentage}%`;
    }

    generateUniqueFileName(basePath, originalName) {
        const ext = originalName.includes('.') 
            ? '.' + originalName.split('.').pop() 
            : '';
        const nameWithoutExt = originalName.includes('.')
            ? originalName.substring(0, originalName.lastIndexOf('.'))
            : originalName;
        
        let counter = 1;
        let newName = originalName;
        
        while (require('fs').existsSync(`${basePath}\\${newName}`)) {
            newName = `${nameWithoutExt} (${counter})${ext}`;
            counter++;
        }
        
        return newName;
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

    updateConnectionStatus(connected, errorMessage = '') {
        if (connected) {
            this.elements.connectBtn.disabled = false;
            this.setConnectingState(false);  // 這會顯示已連線狀態
        } else {
            this.elements.connectBtn.disabled = false;
            this.setConnectingState(false);  // 這會顯示未連線狀態
            if (errorMessage) {
                // 顯示錯誤訊息
                console.error(errorMessage);
            }
        }
    }

    async connectToFTP() {
        if (!this.elements.ftpServer || !this.elements.username || !this.elements.password) {
            console.error('Required input elements not found');
            return;
        }

        // 如果已經連線，則執行斷開連線
        if (this.isConnected) {
            await this.disconnectFromFTP();
            return;
        }

        // 設置連線中狀態
        this.setConnectingState(true);
        // 停用輸入欄位
        this.setInputFieldsState(true);

        try {
            const serverUrl = this.elements.ftpServer.value.trim();
            const validation = this.validateFtpUrl(serverUrl);
            
            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            await this.client.access({
                host: serverUrl,
                user: this.elements.username.value,
                password: this.elements.password.value,
                secure: false
            });

            console.log('Connected to FTP server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
            await this.listDirectory();
            
            // 成功連接後添加到歷史記錄
            this.addToFtpHistory(serverUrl);

        } catch (err) {
            console.error('Connection failed:', err);
            this.updateConnectionStatus(false, err.message);
            this.isConnected = false;
            // 連線失敗時啟用輸入欄位
            this.setInputFieldsState(false);

            ipcRenderer.send('show-notification', {
                title: 'Connection Error',
                body: 'Failed to connect to FTP server: ' + err.message
            });
        } finally {
            // 恢復按鈕狀態
            this.setConnectingState(false);
        }
    }

    async disconnectFromFTP() {
        try {
            // 設置連線中狀態
            this.setConnectingState(true);

            await this.client.close();
            console.log('Disconnected from FTP server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            this.currentFiles = [];
            // 清空檔案列表
            this.displayFileList([]);
            
            // 斷開連線後啟用輸入欄位
            this.setInputFieldsState(false);
        } catch (err) {
            console.error('Disconnection failed:', err);
        } finally {
            // 恢復按鈕狀態
            this.setConnectingState(false);
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
