class FtpFileListHandler {
    constructor(ftpClient, uiHandler, fileOperations) {
        this.client = ftpClient;
        this.uiHandler = uiHandler;
        this.fileOperations = fileOperations;
        this.selectedFiles = new Set();
    }

    displayFileList(files) {
        const elements = this.uiHandler.getElements();
        if (!elements.fileList) return;

        this.resetFileListState();

        if (this.client.getCurrentPath() !== '/') {
            elements.fileList.appendChild(this.createBackRow());
        }

        files.forEach(file => {
            const row = this.createFileRow(file);
            elements.fileList.appendChild(row);
        });
    }

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
            <td>${this.fileOperations.formatFileSize(file.size)}</td>
            <td>${new Date(file.modifiedAt).toLocaleString()}</td>
        `;
    }

    setupDirectoryRowEvents(row, dirName) {
        const dirCell = row.querySelector('.directory-link');
        dirCell.style.cursor = 'pointer';
        dirCell.addEventListener('click', () => this.navigateToDirectory(dirName));
    }

    setupFileRowEvents(row, fileName) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            this.handleRowSelection(e.target, fileName);
        });
    }

    resetFileListState() {
        const elements = this.uiHandler.getElements();
        elements.fileList.innerHTML = '';
        this.selectedFiles.clear();
        elements.selectAll.checked = false;
        elements.selectAll.indeterminate = false;
        this.uiHandler.updateDownloadButton(false);
    }

    async navigateToDirectory(dirName) {
        const newPath = this.client.getCurrentPath() === '/' 
            ? `/${dirName}`
            : `${this.client.getCurrentPath()}/${dirName}`;
        await this.client.listDirectory(newPath);
        this.displayFileList(this.client.getCurrentFiles());
    }

    async navigateToParent() {
        console.log('Navigating to parent directory');
        if (this.client.getCurrentPath() === '/') {
            console.log('Already at root directory, cannot navigate up');
            return;
        }
        
        const parentPath = this.client.getCurrentPath().split('/').slice(0, -1).join('/') || '/';
        console.log(`Parent path: ${parentPath}`);
        await this.client.listDirectory(parentPath);
        this.displayFileList(this.client.getCurrentFiles());
        console.log('Navigation to parent directory complete');
    }

    sortFileList(event) {
        const sortDirection = event.target.classList.contains('sort-asc') ? 'desc' : 'asc';
        event.target.classList.toggle('sort-asc');
        event.target.classList.toggle('sort-desc');

        const files = this.client.getCurrentFiles();
        files.sort((a, b) => {
            const timeA = new Date(a.modifiedAt).getTime();
            const timeB = new Date(b.modifiedAt).getTime();
            return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });

        this.displayFileList(files);
    }

    handleRowSelection(checkbox, filename) {
        const fileInfo = this.client.getCurrentFiles().find(f => f.name === filename);
        if (!fileInfo || fileInfo.isDirectory) {
            return;
        }

        if (checkbox.checked) {
            this.selectedFiles.add(filename);
        } else {
            this.selectedFiles.delete(filename);
        }
        
        const elements = this.uiHandler.getElements();
        const allCheckboxes = Array.from(elements.fileList.querySelectorAll('input[type="checkbox"]:not([disabled])'));
        const checkedCount = allCheckboxes.filter(cb => cb.checked).length;
        
        if (allCheckboxes.length > 0) {
            if (checkedCount === 0) {
                elements.selectAll.checked = false;
                elements.selectAll.indeterminate = false;
            } else if (checkedCount === allCheckboxes.length) {
                elements.selectAll.checked = true;
                elements.selectAll.indeterminate = false;
            } else {
                elements.selectAll.checked = false;
                elements.selectAll.indeterminate = true;
            }
        }
        
        this.uiHandler.updateDownloadButton(this.selectedFiles.size > 0);
    }

    toggleSelectAll(checked) {
        const elements = this.uiHandler.getElements();
        const checkboxes = elements.fileList.querySelectorAll('input[type="checkbox"]:not([disabled])');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            const filename = checkbox.dataset?.filename || checkbox.getAttribute('data-filename');
            if (filename) {
                if (checked) {
                    this.selectedFiles.add(filename);
                } else {
                    this.selectedFiles.delete(filename);
                }
            }
        });
        
        this.uiHandler.updateDownloadButton(this.selectedFiles.size > 0);
    }

    getSelectedFiles() {
        return this.selectedFiles;
    }
}

module.exports = FtpFileListHandler;
