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

function createWindow () {
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

  // 檢查更新
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result && result.updateInfo.version !== app.getVersion()) {
        updateAvailable = true;
        return {
          updateAvailable: true,
          version: result.updateInfo.version
        };
      }
      updateAvailable = false;
      return { updateAvailable: false };
    } catch (error) {
      console.error('檢查更新失敗:', error);
      throw error;
    }
  });

  // 開始下載更新
  ipcMain.on('start-update', async () => {
    try {
      if (!updateAvailable) {
        throw new Error('No update available');
      }
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('下載更新失敗:', error);
      // 通知渲染進程下載失敗
      win.webContents.send('update-error', error.message);
    }
  });

  // 更新事件處理
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '發現更新',
      message: '有新版本可用，是否要下載？',
      buttons: ['是', '否']
    }).then((buttonIndex) => {
      if (buttonIndex.response === 0) {
        ipcMain.emit('start-update');
      }
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '更新已準備就緒',
      message: '更新已下載完成，重新啟動應用程序以安裝更新。',
      buttons: ['現在重啟', '稍後重啟']
    }).then((buttonIndex) => {
      if (buttonIndex.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
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

  // 自動更新事件處理
  autoUpdater.on('download-progress', (progressObj) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send('update-progress', progressObj.percent);
    }
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