const { ipcRenderer } = require('electron');
const fs = require('fs');

class FtpFileOperations {
    constructor(ftpClient, uiHandler) {
        this.client = ftpClient;
        this.uiHandler = uiHandler;
        this.totalProgress = 0;
    }

    async initiateUpload() {
        console.log('Initiating upload process');
        if (!this.client.isConnectedToServer()) {
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
                    await this.client.getClient().uploadFrom(filePath, fileName);
                    console.log('File uploaded successfully:', fileName);
                    ipcRenderer.send('show-notification', {
                        title: 'Upload Success',
                        body: 'File uploaded successfully: ' + fileName
                    });
                }
                // 刷新檔案列表
                await this.client.listDirectory();
                const fileListHandler = this.uiHandler.getFileListHandler();
                if (fileListHandler) {
                    fileListHandler.displayFileList(this.client.getCurrentFiles());
                }
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

    getDownloadableFiles(selectedFiles) {
        return Array.from(selectedFiles).filter(filename => {
            const fileInfo = this.client.getCurrentFiles().find(f => f.name === filename);
            return fileInfo && !fileInfo.isDirectory;
        });
    }

    async initiateDownload(selectedFiles) {
        try {
            const downloadPath = await this.getDownloadDirectory();
            if (!downloadPath) return;

            const downloadableFiles = this.getDownloadableFiles(selectedFiles);
            const weightPerFile = 100 / downloadableFiles.length;

            const elements = this.uiHandler.getElements();
            elements.downloadProgress.classList.remove('d-none');
            this.totalProgress = 0;
            this.uiHandler.updateProgressBar(0);
            this.uiHandler.setDownloadButtonState(true);

            const downloadResults = [];
            const failedDownloads = [];

            // First attempt for all files
            for (const filename of downloadableFiles) {
                const result = await this.downloadSingleFile(filename, downloadPath, weightPerFile);
                if (!result.success) {
                    failedDownloads.push({
                        filename,
                        attempts: 1
                    });
                }
                downloadResults.push(result);
            }

            // Retry failed downloads up to 3 times
            if (failedDownloads.length > 0) {
                console.log(`Retrying ${failedDownloads.length} failed downloads...`);
                for (let retry = 2; retry <= 3; retry++) {
                    if (failedDownloads.length === 0) break;
                    
                    const retryFiles = [...failedDownloads];
                    failedDownloads.length = 0;

                    for (const failedFile of retryFiles) {
                        console.log(`Retry attempt ${retry} for ${failedFile.filename}`);
                        const retryWeight = weightPerFile / (4 - retry); 
                        const result = await this.downloadSingleFile(failedFile.filename, downloadPath, retryWeight);
                        
                        if (!result.success && retry < 3) {
                            failedDownloads.push({
                                filename: failedFile.filename,
                                attempts: retry
                            });
                        }
                        
                        const index = downloadResults.findIndex(r => r.originalFilename === failedFile.filename);
                        if (index !== -1) {
                            downloadResults[index] = {
                                ...result,
                                originalFilename: failedFile.filename,
                                attempts: retry
                            };
                        }
                    }
                }
            }

            this.totalProgress = 100;
            this.uiHandler.updateProgressBar(100);
            await new Promise(resolve => setTimeout(resolve, 500));

            this.showDownloadResult(downloadResults);
            elements.downloadProgress.classList.add('d-none');
            this.uiHandler.updateProgressBar(0);
            this.uiHandler.updateDownloadButton(selectedFiles.size > 0);

        } catch (err) {
            console.error('Download failed:', err);
            const elements = this.uiHandler.getElements();
            elements.downloadProgress.classList.add('d-none');
            this.uiHandler.updateProgressBar(0);
            this.uiHandler.updateDownloadButton(selectedFiles.size > 0);
            
            ipcRenderer.send('show-notification', {
                title: 'Download Error',
                body: 'Download failed: ' + err.message
            });
        }
    }

    async downloadSingleFile(filename, downloadPath, weightPerFile) {
        const uniqueName = this.generateUniqueFileName(downloadPath, filename);
        const localPath = `${downloadPath}\\${uniqueName}`;
        const fileInfo = this.client.getCurrentFiles().find(f => f.name === filename);
        let lastProgress = 0;
        
        try {
            this.client.getClient().trackProgress(info => {
                if (fileInfo.size > 0) {
                    const currentFileProgress = Math.min((info.bytes / fileInfo.size) * 100, 100);
                    const progressIncrement = currentFileProgress - lastProgress;
                    
                    if (progressIncrement > 0) {
                        const totalProgressIncrement = (progressIncrement * weightPerFile) / 100;
                        this.totalProgress = Math.min(this.totalProgress + totalProgressIncrement, 100);
                        this.uiHandler.updateProgressBar(Math.round(this.totalProgress));
                        lastProgress = currentFileProgress;
                    }
                }
            });

            await this.client.getClient().downloadTo(localPath, filename);
            
            return {
                success: true,
                originalFilename: filename,
                renamed: uniqueName !== filename ? { original: filename, renamed: uniqueName } : null
            };
        } catch (err) {
            console.error(`Failed to download ${filename}:`, err);
            return { 
                success: false,
                originalFilename: filename,
                error: err.message
            };
        } finally {
            this.client.getClient().trackProgress();
        }
    }

    showDownloadResult(results) {
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        const renamedFiles = results
            .filter(r => r.renamed)
            .map(r => r.renamed);
        const failedFiles = results
            .filter(r => !r.success)
            .map(r => r.originalFilename);

        let message;
        let title;

        if (successCount === 0 && failCount > 0) {
            title = 'Download Error';
            message = `Failed to download ${failCount} files after 3 attempts:`;
            failedFiles.forEach(filename => {
                message += `\n- ${filename}`;
            });
        } else {
            title = 'Download Complete';
            message = `Successfully downloaded ${successCount} files`;
            if (failCount > 0) {
                message += `\n${failCount} files failed after 3 attempts:`;
                failedFiles.forEach(filename => {
                    message += `\n- ${filename}`;
                });
            }
            if (renamedFiles.length > 0) {
                message += '\nRenamed files:';
                renamedFiles.forEach(file => {
                    message += `\n${file.original} → ${file.renamed}`;
                });
            }
        }

        ipcRenderer.send('show-notification', {
            title: title,
            body: message
        });
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
        
        while (fs.existsSync(`${basePath}\\${newName}`)) {
            newName = `${nameWithoutExt} (${counter})${ext}`;
            counter++;
        }
        
        return newName;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = FtpFileOperations;
