const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')

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
}

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