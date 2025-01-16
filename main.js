const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

// 配置自動更新
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'debug';
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateCheckEnabled = true;
let updateAvailable = false;
let downloadingUpdate = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  })

  win.loadFile('src/index.html')
  // win.webContents.openDevTools() // 開啟開發者工具

  // 在應用程序準備好後配置自動更新
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'melodylose',
    repo: 'desktop_tool'
  });

  // 2. 檢查更新的處理程序
  ipcMain.handle('check-for-updates', async () => {
    try {
      downloadingUpdate = false;
      const result = await autoUpdater.checkForUpdates();
      const currentVersion = app.getVersion();
      const newVersion = result.updateInfo.version;

      console.log(`Current version: ${currentVersion}, New version: ${newVersion}`);

      if (result && newVersion !== currentVersion) {
        updateAvailable = true;
        return {
          updateAvailable: true,
          currentVersion,
          newVersion
        };
      }
      // 只有在沒有下載更新時才發送無更新訊息
      if (!downloadingUpdate) {
        updateAvailable = false;
        return { updateAvailable: false };
      }
    } catch (error) {
      console.error('檢查更新失敗:', error);
      throw error;
    }
  });

  // 移除或修改 update-not-available 事件處理
  autoUpdater.on('update-not-available', () => {
    // 只有在沒有下載更新時才發送訊息
    if (!downloadingUpdate) {
      win.webContents.send('update-not-available');
    }
  });

  // 3. 更新事件監聽器
  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('checking-for-update');
  });

  // 更新事件處理
  autoUpdater.on('update-available', () => {
    if (!downloadingUpdate) {
      dialog.showMessageBox({
        type: 'info',
        title: '發現更新',
        message: '有新版本可用，是否要下載？',
        buttons: ['是', '否']
      }).then((buttonIndex) => {
        if (buttonIndex.response === 0) {
          win.webContents.send('update-available', true);  // 通知渲染進程
        }
      });
    }
  });

  // 自動更新事件處理
  autoUpdater.on('download-progress', (progressObj) => {
    if (downloadingUpdate) {
      console.log('Download progress:', progressObj.percent); // 添加日誌
      win.webContents.send('download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    downloadingUpdate = false;
    win.webContents.send('update-downloaded'); // 添加這行
    dialog.showMessageBox({
        type: 'info',
        title: '更新已準備就緒',
        message: `版本 ${info.version} 已下載完成，重新啟動應用程序以安裝更新。`,
        buttons: ['現在重啟', '稍後重啟']
    }).then((buttonIndex) => {
        if (buttonIndex.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

  autoUpdater.on('error', (error) => {
    downloadingUpdate = false;
    console.error('更新錯誤:', error);
    win.webContents.send('update-error', {
      message: error.message,
      stack: error.stack
    });
  });

  // 保留這個 IPC 處理程序
  ipcMain.on('start-update', async () => {
    try {
      if (!updateAvailable || downloadingUpdate) {
        throw new Error('Update not available or already downloading');
      }
      downloadingUpdate = true;
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('下載更新失敗:', error);
      downloadingUpdate = false;
      win.webContents.send('update-error', error.message);
    }
  });

  // 添加檔案對話框處理
  ipcMain.handle('show-file-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { filePaths: [] };

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    return result;
  });

  // 添加目錄選擇對話框處理
  ipcMain.handle('show-directory-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { filePaths: [] };

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Download Location'
    });

    return result;
  });

  // Add notification handler
  ipcMain.on('show-notification', (event, notificationOptions) => {
    new Notification({
      title: notificationOptions.title,
      body: notificationOptions.body
    }).show();
  });

  // 自動更新相關 IPC 處理
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})