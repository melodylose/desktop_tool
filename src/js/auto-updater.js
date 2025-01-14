const { ipcRenderer } = require('electron');

// 當頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    const currentVersionElem = document.getElementById('currentVersion');
    const checkUpdateBtn = document.getElementById('checkUpdate');
    const autoUpdateCheckbox = document.getElementById('autoUpdate');
    const updateStatusElem = document.getElementById('updateStatus');

    // 從主進程獲取當前版本
    ipcRenderer.invoke('get-version').then(version => {
        currentVersionElem.textContent = version;
    });

    // 載入自動更新設定
    const autoUpdateEnabled = localStorage.getItem('autoUpdateEnabled') !== 'false';
    autoUpdateCheckbox.checked = autoUpdateEnabled;

    // 保存自動更新設定
    autoUpdateCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('autoUpdateEnabled', e.target.checked);
    });

    // 檢查更新按鈕事件
    checkUpdateBtn.addEventListener('click', async () => {
        checkUpdateBtn.disabled = true;
        updateStatusElem.textContent = '正在檢查更新...';
        
        try {
            const result = await ipcRenderer.invoke('check-for-updates');
            if (result.updateAvailable) {
                updateStatusElem.innerHTML = `
                    發現新版本 ${result.version}！
                    <a href="#" class="text-primary" id="startUpdate">點擊此處開始更新</a>
                `;
                document.getElementById('startUpdate').addEventListener('click', () => {
                    ipcRenderer.send('start-update');
                });
            } else {
                updateStatusElem.textContent = '目前已是最新版本';
            }
        } catch (error) {
            updateStatusElem.textContent = '檢查更新失敗：' + error.message;
        } finally {
            checkUpdateBtn.disabled = false;
        }
    });

    // 監聽更新進度
    ipcRenderer.on('update-progress', (event, progress) => {
        updateStatusElem.textContent = `下載更新中... ${progress}%`;
    });

    // 監聽更新完成
    ipcRenderer.on('update-downloaded', () => {
        updateStatusElem.innerHTML = '更新已下載完成，<a href="#" class="text-primary" id="restartApp">點擊重新啟動</a>';
        document.getElementById('restartApp').addEventListener('click', () => {
            ipcRenderer.send('restart-app');
        });
    });

    // 如果啟用了自動更新，在頁面載入時檢查
    if (autoUpdateEnabled) {
        checkUpdateBtn.click();
    }
});
