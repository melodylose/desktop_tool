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
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hidden',
    frame: false
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  const dbPath = path.resolve(app.getAppPath(), '../data/db.sqlite')
  log.info(path.dirname(dbPath))
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath))
  }

  db = knex({
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: dbPath
    }
  })

  // create images table
  db.schema.hasTable('images').then((exist) => {
    if (exist) {
      return;
    }

    return db.schema.createTable('images', (table) => {
      table.bigIncrements('id', { primaryKey: true });
      table.string('name');
      table.binary('file_content');
    })
  })

  db.schema.hasTable('modbus_log').then((exist) => {
    if (exist) {
      return;
    }

    return db.schema.createTable('modbus_log', (table) => {
      table.bigIncrements('id', { primaryKey: true })
      table.string('function')
      table.string('send_time')
      table.string('recv_time')
      table.string('desc')
    })
  })

  //initial socket
  socket = new net.Socket()
  client = new modbus.client.TCP(socket)

  socket.on('connect', function () {
    log.debug(`curState = ${curState} => readyState = ${socket.readyState}`)
    if (curState !== socket.readyState && socket.readyState === 'open') {
      curState = socket.readyState
      mainWindow.webContents.send('app:modbus-connected')
      toast.success('modbus', 'connected')
    }
  })

  socket.on('error', console.error)

  socket.on('close', function () {
    log.debug(`curState = ${curState} => readyState = ${socket.readyState}`)
    if (!connectOpen) {
      curState = socket.readyState
      mainWindow.webContents.send('app:modbus-disconnected')
      toast.warning('modbus', 'disconnected')
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

ipcMain.on('app:insert-image-file', (event, filepath) => {
  if (filepath === undefined || filepath === '') {
    event.sender.send('app:insert-image-file-reply', false)
    return;
  }

  const buffer = fs.readFileSync(filepath)
  var filename = path.basename(filepath)
  db.table('images').insert({ name: filename, file_content: buffer }).then((result) => {
    log.debug(`images table insert result:${result}`)
  })
})

ipcMain.handle('app:show-image-query-id', (event, id) => {
  return db.table('images').where({ id: id }).first();
})

ipcMain.on('app:toast-success-message', (event, args) => {
  toast.success(args.title, args.message, 3000);
})

ipcMain.on('app:toast-error-message', (event, args) => {
  toast.error(args.title, args.message, 3000);
})

ipcMain.on('app:scan-folder-file', (event, folderpath) => {
  if (folderpath === undefined || folderpath === '') {
    event.sender.send('app:scan-folder-file-reply', true)
    return 0;
  }

  if (fs.existsSync(folderpath) === false) {
    event.sender.send('app:scan-folder-file-reply', true)
    return 0;
  }

  let win = BrowserWindow.getFocusedWindow();
  fs.readdir(folderpath, {
    recursive: true
  }, (err, files) => {
    if (err) {
      log.error(err)
    } else {
      let c = 0
      const INCREMENT = 1 / files.length
      let list = [];
      files.forEach(async (file) => {
        // console.log(`file: ${file}`)
        try {
          var filepath = path.resolve(folderpath, file);
          var fileext = path.extname(filepath)
          if (fileext === '.png') {
            var filename = path.basename(filepath)
            const buffer = fs.readFileSync(filepath)
            var work = db.table('images').insert({ name: filename, file_content: buffer }).then((result) => {
              win.setProgressBar(0.5, { mode: 'indeterminate' })
            })
            list.push(work)
          }

          // backup file
          // var newpath = path.resolve(__dirname, './data/' + file)
          // var dirpath = path.dirname(newpath)
          // if (fs.existsSync(dirpath) === false) {
          //   fs.mkdirSync(dirpath, { recursive: true })
          // }

          // fs.copyFileSync(filepath, newpath)
        } catch (error) {
          // console.log(error)
          log.error(error)
        }

        win.setProgressBar(c)
        if (c < 2) {
          c += INCREMENT
        }
      })
      // console.log(`current count = ${c}`)
      // console.log(files.length)
      win.setProgressBar(0)
      if (list.length <= 0) {
        toast.success('Batch', 'no item insert')
        event.sender.send('app:scan-folder-file-reply', true)
        return;
      }

      // check all insert completed then kill folder reset progress bar count
      Promise.all(list).finally(async () => {
        win.setProgressBar(0)
        await shell.trashItem(folderpath)
        toast.success('Batch', 'import folder all image finished.')
        event.sender.send('app:scan-folder-file-reply', true)
      })
    }
  })
})

ipcMain.on('app:open-dir', (event, args) => {
  // console.log('receive dialog')
  log.info('receive open directory click')
  dialog.showOpenDialog({ properties: ['openDirectory'] }).then(result => {
    log.debug(`user select folder path: ${result}`)
    event.sender.send('app:open-dir-reply', result)
  })
})

ipcMain.handle('app:scan-folder-with-glob', (event, folderPath) => {
  log.debug(`scan folder path = ${folderPath}\\**`)
  var pattern = fg.win32.convertPathToPattern(`${folderPath}\\**\\*.*`)
  log.debug(`search pattern = ${pattern}`)
  return fg.globSync(pattern, { onlyFiles: false, globstar: true })
})

ipcMain.on('app:close-window', (event, args) => {
  mainWindow.close()
})

// query db
ipcMain.handle('app:query-modbus-log', (event, args) => {
  return db.table('modbus_log').select('*')
    .offset(args.pagesize * args.page)
    .limit(args.pagesize)
    .orderBy('send_time', 'desc')
})

// execute connect with modbus
ipcMain.on('app:connect-modbus', (event, ip, port) => {
  curState = 'init'
  connectOpen = true;
  hostIp = ip
  hostPort = port

  refreshSocketConnectId = setInterval(() => {
    // console.log(`connectOpen = ${connectOpen}, socket.connecting = ${socket.readyState}`)
    if (connectOpen && socket.readyState === 'closed' || curState === 'init') {
      socket.connect({
        host: hostIp,
        port: hostPort
      })
    }
  }, 1000);
})

// execute disconnect modbus
ipcMain.on('app:disconnect-modbus', (event, args) => {
  // stop reopen socket
  clearInterval(refreshSocketConnectId)
  // stop continuous
  clearInterval(refreshModbusId)
  connectOpen = false;
  socket.resetAndDestroy()
})

// execute read modbus function
ipcMain.on('app:exec-read-modbus', function (event, args) {
  log.verbose('read single step')
  ReadModbus(args)
})

ipcMain.on('app:exec-read-modbus-continuous', function (event, args) {
  refreshModbusId = setInterval(() => {
    ReadModbus(args)
  }, args.interval * 1000);
})

ipcMain.on('app:exec-write-modbus', function (event, args) {
  log.verbose('write single step')
  WriteModbus(args)
})

ipcMain.on('app:exec-write-modbus-continuous', function (event, args) {
  refreshModbusId = setInterval(() => {
    WriteModbus(args)
  }, args.interval * 1000);
})

ipcMain.on('app:exec-modbus-continuous-stop', function (event, args) {
  clearInterval(refreshModbusId)
})

ipcMain.handle('app:get-images', function (event, args) {
  log.debug(`get images argument:${JSON.stringify(args)}`)
  var page = 0
  var size = 8
  if (args !== undefined) {
    page = args.page
    size = args.size
  }
  return db.table('images').offset(page * size).limit(size)
})

ipcMain.handle('app:get-image-count', function (event, args) {
  return db.table('images').count({ count: '*' })
})

function ReadModbus(args) {
  if (args.func === '1') {
    client.readCoils(args.addr, args.size).then(function (resp) {
      // console.log(resp)
      mainWindow.webContents.send('app:exec-read-modbus-reply', resp)
    }).catch(function () {
      log.error(arguments)
    })
  } else if (args.func === '2') {
    client.readInputRegisters(args.addr, args.size).then(function (resp) {
      // console.log(resp)
      mainWindow.webContents.send('app:exec-read-modbus-reply', resp)
    }).catch(function () {
      log.error(arguments)
    })
  } else if (args.func === '3') {
    client.readHoldingRegisters(args.addr, args.size).then(function (resp) {
      // console.log(resp.response._body.valuesAsArray)
      mainWindow.webContents.send('app:exec-read-modbus-reply', resp)
    }).catch(function () {
      log.error(require('util').inspect(arguments, {
        depth: null
      }))
    })
  }
}

function WriteModbus(args) {
  log.debug(`trace input parameters = ${args}`)
  if (args.func === '1') {
    const st = new Date()
    client.writeSingleCoil(args.addr, args.val)
      .then(async function (resp) {
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteSingleCoil',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send success, data:${JSON.stringify(args)}`
        })
      }).catch(async function () {
        log.error(arguments)
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteSingleCoil',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send fail, data:${JSON.stringify(arguments)}`
        })
      }).finally(async function () {
        await mainWindow.webContents.send('app:exec-write-modbus-reply')
      })
  } else if (args.func === '2') {
    const st = new Date()
    client.writeSingleRegister(args.addr, args.val)
      .then(async function (resp) {
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteSingleRegister',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send success, data:${JSON.stringify(args)}`
        })
      })
      .catch(async function () {
        console.error(arguments)
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteSingleRegister',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send fail, data:${JSON.stringify(arguments)}`
        })
      }).finally(async function () {
        await mainWindow.webContents.send('app:exec-write-modbus-reply')
      })
  } else if (args.func === '3') {
    const st = new Date()
    const values = Buffer.from(args.val)
    client.writeMultipleCoils(args.addr, values, args.size)
      .then(async function (resp) {
        // console.log(resp)
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteMultipleCoils',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send success, data:${JSON.stringify(args)}`
        })
      })
      .catch(async function () {
        console.log(arguments)
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteMultipleCoils',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send fail, data:${JSON.stringify(arguments)}`
        })
      }).finally(async function () {
        await mainWindow.webContents.send('app:exec-write-modbus-reply')
      })
  } else if (args.func === '4') {
    const st = new Date()
    const values = Buffer.from(args.val)
    client.writeMultipleRegisters(args.addr, values)
      .then(async function (resp) {
        // console.log(resp)
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteMultipleRegisters',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send success, data:${JSON.stringify(args)}`
        })
      })
      .catch(async function () {
        console.error(arguments)
        // record db
        await db.table('modbus_log').insert({
          function: 'WriteMultipleRegisters',
          send_time: st.toLocaleString('sv'),
          recv_time: (new Date()).toLocaleString('sv'),
          desc: `send fail, data:${JSON.stringify(arguments)}`
        })
      }).finally(async function () {
        await mainWindow.webContents.send('app:exec-write-modbus-reply')
      })
  }
}