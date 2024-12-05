const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Knex, knex } = require('knex');
const toast = require('electron-simple-toast')
const fg = require('fast-glob')
const modbus = require('jsmodbus')
const net = require('net')
const log = require('electron-log')
const logPath = path.join(app.getAppPath(), '../logs/main.log')
const mqtt = require('mqtt')

log.initialize({ preload: true })
log.transports.file.resolvePathFn = () => logPath
let socket
let client
let db
let mainWindow = {}
let connectOpen = false
let curState
let hostIp, hostPort
let refreshSocketConnectId
let refreshModbusId
let mqttClient
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = async () => {
  // Create the browser window with 16:9 aspect ratio
  const width = 1280; // 基礎寬度
  const height = Math.round(width * (9/16)); // 計算16:9的高度

  // 創建主窗口並配置基本屬性
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    minWidth: 960, // 最小寬度
    minHeight: Math.round(960 * (9/16)), // 最小高度也保持16:9
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // 加載預處理腳本
    },
    titleBarStyle: 'hidden', // 隱藏默認標題欄
    frame: false // 無邊框模式
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // 設置SQLite數據庫路徑並確保目錄存在
  const dbPath = path.resolve(app.getAppPath(), '../data/db.sqlite')
  log.info(path.dirname(dbPath))
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath))
  }

  // 初始化SQLite數據庫連接
  db = knex({
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: dbPath
    }
  })

  // create images table - 創建圖片存儲表
  db.schema.hasTable('images').then((exist) => {
    if (exist) {
      return;
    }

    // 定義圖片表結構：ID、名稱、圖片內容
    return db.schema.createTable('images', (table) => {
      table.bigIncrements('id', { primaryKey: true }); // 自增主鍵
      table.string('name'); // 圖片名稱
      table.binary('file_content'); // 圖片二進制數據
    })
  })

  // 創建Modbus操作日誌表
  db.schema.hasTable('modbus_log').then((exist) => {
    if (exist) {
      return;
    }

    // 定義Modbus日誌表結構
    return db.schema.createTable('modbus_log', (table) => {
      table.bigIncrements('id', { primaryKey: true }) // 自增主鍵
      table.string('function') // Modbus功能碼
      table.string('send_time') // 發送時間
      table.string('recv_time') // 接收時間
      table.string('desc') // 操作描述
    })
  })

  //initial socket - 初始化Modbus TCP連接
  socket = new net.Socket()
  client = new modbus.client.TCP(socket)

  // 處理Modbus連接成功事件
  socket.on('connect', function () {
    log.debug(`curState = ${curState} => readyState = ${socket.readyState}`)
    if (curState !== socket.readyState && socket.readyState === 'open') {
      curState = socket.readyState
      mainWindow.webContents.send('app:modbus-connected') // 通知前端連接成功
      toast.success('modbus', 'connected') // 顯示成功提示
    }
  })

  // 處理Modbus連接錯誤
  socket.on('error', console.error)

  // 處理Modbus連接斷開事件
  socket.on('close', function () {
    log.debug(`curState = ${curState} => readyState = ${socket.readyState}`)
    if (!connectOpen) {
      curState = socket.readyState
      mainWindow.webContents.send('app:modbus-disconnected') // 通知前端連接斷開
      toast.warning('modbus', 'disconnected') // 顯示警告提示
    }
  })
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.on('app:reveal-in-explorer', (event, args) => {
  shell.showItemInFolder(args);
})

// 處理insert image file
ipcMain.on('app:insert-image-file', (event, filepath) => {
  if (filepath === undefined || filepath === '') {
    event.sender.send('app:insert-image-file-reply', false)
    return;
  }

  // 讀取檔案內容
  const buffer = fs.readFileSync(filepath)
  // 取得檔案名稱
  var filename = path.basename(filepath)

  // 將檔案內容與名稱存入 images 資料表
  db.table('images').insert({ name: filename, file_content: buffer }).then((result) => {
    log.debug(`images table insert result:${result}`)
  })
})

// 處理show image by id
ipcMain.handle('app:show-image-query-id', (event, id) => {
  // 依據 id 查詢 images 資料表
  return db.table('images').where({ id: id }).first();
})

// 顯示成功訊息
ipcMain.on('app:toast-success-message', (event, args) => {
  toast.success(args.title, args.message, 3000);
})

// 顯示錯誤訊息
ipcMain.on('app:toast-error-message', (event, args) => {
  toast.error(args.title, args.message, 3000);
})

// 處理scan folder files
ipcMain.on('app:scan-folder-file', (event, folderpath) => {
  log.info(`receive scan folder path: ${folderpath}`)
  // 如果folderpath為空或undefined就回傳true
  if (folderpath === undefined || folderpath === '') {
    log.debug('folderpath is empty')
    event.sender.send('app:scan-folder-file-reply', true)
    return 0;
  }

  // 如果folderpath不存在就回傳true
  if (fs.existsSync(folderpath) === false) {
    log.debug('folderpath does not exist')
    event.sender.send('app:scan-folder-file-reply', true)
    return 0;
  }

  let win = BrowserWindow.getFocusedWindow();
  // 讀取folderpath所有檔案
  fs.readdir(folderpath, {
    recursive: true
  }, (err, files) => {
    if (err) {
      log.error(err)
    } else {
      log.debug(`find ${files.length} files in folder path: ${folderpath}`)
      // 計算進度條的進度
      let c = 0
      const INCREMENT = 1 / files.length
      // 將所有檔案處理
      files.forEach(async (file) => {
        try {
          // 取得檔案路徑與副檔名
          var filepath = path.resolve(folderpath, file);
          var fileext = path.extname(filepath)
          // 如果是png副檔名就將它insert到images資料表
          if (fileext === '.png') {
            var filename = path.basename(filepath)
            const buffer = fs.readFileSync(filepath)
            var work = db.table('images').insert({ name: filename, file_content: buffer }).then((result) => {
              //  update progress bar
              win.setProgressBar(0.5, { mode: 'indeterminate' })
            })
            list.push(work)
          }
        } catch (error) {
          log.error(error)
        }

        // update progress bar
        win.setProgressBar(c)
        if (c < 2) {
          c += INCREMENT
        }
      })
      
      // reset progress bar count
      win.setProgressBar(0)
      // check all insert completed then kill folder reset progress bar count
      Promise.all(list).finally(async () => {
        win.setProgressBar(0)
        // 刪除folder
        await shell.trashItem(folderpath)
        // 顯示訊息
        toast.success('Batch', 'import folder all image finished.')
        // 回傳true
        event.sender.send('app:scan-folder-file-reply', true)
      })
    }
  })
})

// 開啟資料夾
ipcMain.on('app:open-dir', (event, args) => {
  log.info('receive open directory click')
  dialog.showOpenDialog({ properties: ['openDirectory'] }).then(result => {
    log.debug(`user select folder path: ${result}`)
    event.sender.send('app:open-dir-reply', result)
  })
})

// 使用glob去掃描資料夾
ipcMain.handle('app:scan-folder-with-glob', (event, folderPath) => {
  log.debug(`scan folder path = ${folderPath}\\**`)
  var pattern = fg.win32.convertPathToPattern(`${folderPath}\\**\\*.*`)
  log.debug(`search pattern = ${pattern}`)
  return fg.globSync(pattern, { onlyFiles: false, globstar: true })
})

// 關閉視窗
ipcMain.on('app:close-window', (event, args) => {
  mainWindow.close()
})

// 查詢modbus log
ipcMain.handle('app:query-modbus-log', (event, args) => {
  return db.table('modbus_log').select('*')
    .offset(args.pagesize * args.page)
    .limit(args.pagesize)
    .orderBy('send_time', 'desc')
})

// 執行與 Modbus 的連接
ipcMain.on('app:connect-modbus', (event, ip, port) => {
  log.info(`正在嘗試連接 Modbus，IP: ${ip}, 端口: ${port}`);
  curState = 'init'
  connectOpen = true;
  hostIp = ip
  hostPort = port

  refreshSocketConnectId = setInterval(() => {
    if (connectOpen && socket.readyState === 'closed' || curState === 'init') {
      log.debug('嘗試重新連接 Modbus');
      socket.connect({
        host: hostIp,
        port: hostPort
      })
    }
  }, 1000);
})

// 執行與 Modbus 的斷開連接
ipcMain.on('app:disconnect-modbus', (event, args) => {
  log.info('正在斷開 Modbus 連接');
  // 停止重新打開 socket
  clearInterval(refreshSocketConnectId)
  // 停止連續操作
  clearInterval(refreshModbusId)
  connectOpen = false;
  socket.resetAndDestroy()
  log.debug('Modbus 連接已斷開');
})

// 執行讀取 Modbus 功能
ipcMain.on('app:exec-read-modbus', function (event, args) {
  log.verbose('執行單步讀取');
  ReadModbus(args)
})

// 執行連續讀取 Modbus 功能
ipcMain.on('app:exec-read-modbus-continuous', function (event, args) {
  log.info(`開始連續讀取 Modbus，間隔: ${args.interval} 秒`);
  refreshModbusId = setInterval(() => {
    ReadModbus(args)
  }, args.interval * 1000);
})

// 執行寫入 Modbus 功能
ipcMain.on('app:exec-write-modbus', function (event, args) {
  log.verbose('執行單步寫入');
  WriteModbus(args)
})

// 連續執行寫入 Modbus 功能
ipcMain.on('app:exec-write-modbus-continuous', function (event, args) {
  log.info(`開始連續寫入 Modbus，間隔: ${args.interval} 秒`);
  refreshModbusId = setInterval(() => {
    WriteModbus(args)
  }, args.interval * 1000);
})

// 停止連續執行 Modbus 操作
ipcMain.on('app:exec-modbus-continuous-stop', function (event, args) {
  log.info('停止連續執行 Modbus 操作');
  clearInterval(refreshModbusId)
})

// 獲取圖片列表
ipcMain.handle('app:get-images', function (event, args) {
  log.debug(`獲取圖片列表，參數: ${JSON.stringify(args)}`);
  var page = 0
  var size = 8
  if (args !== undefined) {
    page = args.page
    size = args.size
  }
  log.verbose(`查詢圖片，頁碼: ${page}，每頁數量: ${size}`);
  return db.table('images').offset(page * size).limit(size)
})

// 獲取圖片總數
ipcMain.handle('app:get-image-count', function (event, args) {
  log.debug('獲取圖片總數');
  return db.table('images').count({ count: '*' })
})

function ReadModbus(args) {
  log.debug(`ReadModbus called with args: ${JSON.stringify(args)}`);

  // 根據功能代碼選擇適當的讀取方法
  if (args.func === '1') {
    // 讀取線圈
    log.info(`Reading ${args.size} coils from address ${args.addr}`);
    client.readCoils(args.addr, args.size)
      .then(function (resp) {
        log.verbose('Coils read successfully');
        mainWindow.webContents.send('app:exec-read-modbus-reply', resp);
      })
      .catch(function (error) {
        log.error('Error reading coils:', error);
      });
  } else if (args.func === '2') {
    // 讀取輸入寄存器
    log.info(`Reading ${args.size} input registers from address ${args.addr}`);
    client.readInputRegisters(args.addr, args.size)
      .then(function (resp) {
        log.verbose('Input registers read successfully');
        mainWindow.webContents.send('app:exec-read-modbus-reply', resp);
      })
      .catch(function (error) {
        log.error('Error reading input registers:', error);
      });
  } else if (args.func === '3') {
    // 讀取保持寄存器
    log.info(`Reading ${args.size} holding registers from address ${args.addr}`);
    client.readHoldingRegisters(args.addr, args.size)
      .then(function (resp) {
        log.verbose('Holding registers read successfully');
        mainWindow.webContents.send('app:exec-read-modbus-reply', resp);
      })
      .catch(function (error) {
        log.error('Error reading holding registers:', require('util').inspect(error, { depth: null }));
      });
  } else {
    log.warn(`Unsupported function code: ${args.func}`);
  }
}

/**
 * 執行 Modbus 寫入操作
 * @param {Object} args - 寫入操作的參數
 * @param {string} args.func - Modbus 功能碼
 * @param {number} args.addr - 起始地址
 * @param {*} args.val - 要寫入的值
 * @param {number} [args.size] - 寫入的數量（僅用於多個線圈/寄存器）
 */
function WriteModbus(args) {
  log.debug(`WriteModbus input parameters: ${JSON.stringify(args)}`);

  // 根據不同的功能碼執行相應的寫入操作
  switch (args.func) {
    case '1':
      // 寫入單個線圈
      writeModbusOperation('WriteSingleCoil', () => client.writeSingleCoil(args.addr, args.val), args);
      break;
    case '2':
      // 寫入單個寄存器
      writeModbusOperation('WriteSingleRegister', () => client.writeSingleRegister(args.addr, args.val), args);
      break;
    case '3':
      // 寫入多個線圈
      writeModbusOperation('WriteMultipleCoils', () => {
        const values = Buffer.from(args.val);
        return client.writeMultipleCoils(args.addr, values, args.size);
      }, args);
      break;
    case '4':
      // 寫入多個寄存器
      writeModbusOperation('WriteMultipleRegisters', () => {
        const values = Buffer.from(args.val);
        return client.writeMultipleRegisters(args.addr, values);
      }, args);
      break;
    default:
      log.error(`Unsupported Modbus function code: ${args.func}`);
  }
}

/**
 * 執行 Modbus 寫入操作並記錄結果
 * @param {string} functionName - Modbus 功能名稱
 * @param {Function} operation - 要執行的 Modbus 操作
 * @param {Object} args - 操作參數
 */
async function writeModbusOperation(functionName, operation, args) {
  const startTime = new Date();
  log.info(`Starting ${functionName} operation`);

  try {
    const response = await operation();
    log.debug(`${functionName} operation successful`);
    await logModbusOperation(functionName, startTime, args, 'success');
  } catch (error) {
    log.error(`${functionName} operation failed: ${error}`);
    await logModbusOperation(functionName, startTime, args, 'fail', error);
  } finally {
    log.debug(`${functionName} operation completed`);
    await mainWindow.webContents.send('app:exec-write-modbus-reply');
  }
}

/**
 * 將 Modbus 操作記錄到數據庫
 * @param {string} functionName - Modbus 功能名稱
 * @param {Date} startTime - 操作開始時間
 * @param {Object} args - 操作參數
 * @param {string} status - 操作狀態 ('success' 或 'fail')
 * @param {Error} [error=null] - 如果操作失敗，則為錯誤對象
 */
async function logModbusOperation(functionName, startTime, args, status, error = null) {
  const endTime = new Date();
  const logEntry = {
    function: functionName,
    send_time: startTime.toLocaleString('sv'),
    recv_time: endTime.toLocaleString('sv'),
    desc: `send ${status}, data:${JSON.stringify(status === 'success' ? args : error)}`
  };

  try {
    await db.table('modbus_log').insert(logEntry);
    log.debug(`Modbus operation logged: ${JSON.stringify(logEntry)}`);
  } catch (dbError) {
    log.error(`Failed to log Modbus operation: ${dbError}`);
  }
}