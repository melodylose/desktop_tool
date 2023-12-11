// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
    initialize: async () => {

    },
    reveal_in_explorer: () => {
        const path = document.getElementById('relativePath').value;
        ipcRenderer.send('app:reveal-in-explorer', path);
        document.getElementById('pout').innerText += 'Out: selected path = ' + path + '\r\n';
    },
    store_image: async () => {
        try {
            const path = document.getElementById('imgPath').value
            ipcRenderer.once('app:insert-image-file-reply', (event, reply) => {
                if (!reply) {
                    document.getElementById('imgPath').classList.remove('is-invalid')
                    document.getElementById('imgPath').classList.add('is-invalid')
                }
            })
            ipcRenderer.send('app:insert-image-file', path)
        } catch (error) {
            new window.Notification('Insert', { body: 'save image fail' })
            document.getElementById('pout').innerText += 'Out: error = ' + error + '\r\n';
        }
    },
    show_image: async () => {
        try {
            const id = document.getElementById('imageId').value;
            var row = await ipcRenderer.invoke('app:show-image-query-id', id)
            // console.log(row)
            if (row) {
                var base64Image = Buffer.from(row.file_content, 'binary').toString('base64');
                document.getElementById('imgSource').src = `data:image/png;base64,${base64Image}`;
                ipcRenderer.send('app:toast-success-message', {
                    title: 'Show',
                    message: 'load image completed.'
                });
            } else {
                document.getElementById('imgSource').src = '';
                ipcRenderer.send('app:toast-error-message', {
                    title: 'Show',
                    message: 'load image fail.'
                });
            }
        } catch (error) {
            document.getElementById('pout').innerText += 'Out: error = ' + error + '\r\n';
        }
    },
    scan_folder: () => {
        try {
            const input = document.getElementById('relativePath')
            const path = input.value;
            input.disabled = true;
            ipcRenderer.once('app:scan-folder-file-reply', (event, response) => {
                input.disabled = false;
            })

            ipcRenderer.send('app:scan-folder-file', path)
        } catch (error) {
            console.log(error)
        }
    },
    open_dir: () => {
        try {
            ipcRenderer.once('app:open-dir-reply', (event, response) => {
                console.log(response)
                document.getElementById('relativePath').value = response.filePaths;
            })
            console.log('send api open dir')
            ipcRenderer.send('app:open-dir')
        } catch (error) {
            console.log(error)
        }
    },
    scan_with_fast_glob: async () => {
        try {
            const st = performance.now()
            const path = document.getElementById('folderPath').value
            var files = await ipcRenderer.invoke('app:scan-folder-with-glob', path)
            console.log(`total file count:${files.length}`)
            document.getElementById('fileContents').innerHTML = '';
            let ul = document.createElement('ul')
            ul.className = 'list-group list-container'
            files.forEach(filePath => {
                let li = document.createElement('li')
                li.className = 'list-group-item'
                li.innerText = filePath.replace(/\//g, '\\')
                ul.appendChild(li)
            });
            document.getElementById('fileContents').appendChild(ul)
            console.log(`elasped time:${Math.round((performance.now() - st) / 1000)}`)
        } catch (error) {
            console.log(error)
        }
    },
    connect_modbus: () => {
        try {
            const ip = document.getElementById('host').value
            const port = document.getElementById('port').value
            if (document.getElementById('connect').checked) {
                ipcRenderer.send('app:connect-modbus', ip, port)
            } else if (document.getElementById('connect').checked === false) {
                ipcRenderer.send('app:disconnect-modbus')
            }
        } catch (error) {
            console.log(error)
        }
    },
    close_window: () => {
        try {
            ipcRenderer.send('app:close-window')
        } catch (error) {
            console.log(error)
        }
    },
    exec_read_modbus: () => {
        try {
            // fetch
            document.getElementById('size').dispatchEvent(new Event('change'))

            const mode = parseInt(document.getElementById('mode').value)
            const addr = parseInt(document.getElementById('start_addr').value)
            const size = parseInt(document.getElementById('size').value)
            const interval = parseInt(document.getElementById('interval').value)
            const func = document.getElementById('func').value

            // check mode call api
            if (mode === 1) {
                ipcRenderer.send('app:exec-read-modbus', { addr, size, func })
            } else if (mode === 2) {
                const btn = document.getElementById('exec_read')
                if (btn.innerText === '執行') {
                    btn.innerText = '中斷'
                    document.getElementById('start_addr').disabled = true
                    document.getElementById('size').disabled = true
                    document.getElementById('func').disabled = true
                    document.getElementById('interval').disabled = true
                    document.getElementById('mode').disabled = true
                    // execute
                    ipcRenderer.send('app:exec-read-modbus-continuous', { addr, size, func, interval })
                    console.log('read modbus continuous start')
                } else {
                    btn.innerText = '執行'
                    document.getElementById('start_addr').disabled = false
                    document.getElementById('size').disabled = false
                    document.getElementById('func').disabled = false
                    document.getElementById('interval').disabled = false
                    document.getElementById('mode').disabled = false
                    // stop
                    ipcRenderer.send('app:exec-modbus-continuous-stop')
                    console.log('read modbus continuous stop')
                }
            } else if (mode === 3) {
                let val

                if (func === '1') {
                    val = document.getElementById('write_val').value === '1' ? true : false
                } else if (func === '2') {
                    val = parseInt(document.getElementById('write_val').value)
                } else {
                    val = document.getElementById('write_val').value.split(' ')
                }

                ipcRenderer.send('app:exec-write-modbus', { addr, size, func, val })
            } else if (mode === 4) {
                const btn = document.getElementById('exec_read')
                let val

                if (func === '1') {
                    val = document.getElementById('write_val').value === '1' ? true : false
                } else if (func === '2') {
                    val = parseInt(document.getElementById('write_val').value)
                } else {
                    val = document.getElementById('write_val').value.split(' ')
                }

                if (btn.innerText === '執行') {
                    btn.innerText = '中斷'
                    document.getElementById('start_addr').disabled = true
                    document.getElementById('size').disabled = true
                    document.getElementById('func').disabled = true
                    document.getElementById('interval').disabled = true
                    document.getElementById('mode').disabled = true
                    document.getElementById('write_val').disabled = true
                    // execute
                    ipcRenderer.send('app:exec-write-modbus-continuous', { addr, size, func, interval, val })
                    console.log('write modbus continuous start')
                } else {
                    btn.innerText = '執行'
                    document.getElementById('start_addr').disabled = false
                    document.getElementById('size').disabled = false
                    document.getElementById('func').disabled = false
                    document.getElementById('interval').disabled = false
                    document.getElementById('mode').disabled = false
                    document.getElementById('write_val').disabled = false
                    // stop
                    ipcRenderer.send('app:exec-modbus-continuous-stop')
                    console.log('write modbus continuous stop')
                }
            }
        } catch (error) {
            console.log(error)
        }
    },
    query_modbus_log: async () => {
        QueryModbusLog()
    },
    show_gallery: (i) => {
        ShowGallery(i)
    }
})

ipcRenderer.on('app:modbus-connected', (event, reply) => {
    console.log(document.getElementById('connect').checked)

    document.getElementById('connect_status').style = 'color:green'
    document.getElementById('host').disabled = true
    document.getElementById('port').disabled = true
    document.getElementById('start_addr').disabled = false
    document.getElementById('size').disabled = false
    document.getElementById('func').disabled = false
    document.getElementById('exec_read').disabled = false
    document.getElementById('interval').disabled = false
    document.getElementById('write_val').disabled = false

    if (document.getElementById('func').value === '1') {
        document.getElementById('size').value = 8
    }
})

ipcRenderer.on('app:modbus-disconnected', (event, reply) => {
    console.log(document.getElementById('connect').checked)
    document.getElementById('connect').checked = false
    document.getElementById('connect').dispatchEvent(new Event('change'))

    document.getElementById('connect_status').style = 'color:red'
    document.getElementById('host').disabled = false
    document.getElementById('port').disabled = false
    document.getElementById('start_addr').disabled = true
    document.getElementById('size').disabled = true
    document.getElementById('func').disabled = true
    document.getElementById('exec_read').disabled = true
    document.getElementById('interval').disabled = true
    document.getElementById('write_val').disabled = true
    document.getElementById('exec_read').innerText = '執行'
})

ipcRenderer.on('app:exec-read-modbus-reply', (event, reply) => {
    try {
        // console.log(reply)
        let ary = []
        if (Object.getPrototypeOf(reply) === Object.prototype) {
            ary = reply.response._body._valuesAsArray
        } else {
            ary = reply
        }

        // console.log(ary)

        var content = document.getElementById('data_content')
        content.innerHTML = ''
        content.classList.remove('p-3')
        content.classList.add('p-3')

        // translate 2d
        const table = []
        const len = ary.length / 8
        for (let i = 0; i < len; i++) {
            table[i] = []
            for (let j = 0; j < 8; j++) {
                var idx = i * 8 + j
                if (idx >= ary.length) {
                    table[i][j] = 0
                } else {
                    table[i][j] = ary[idx]
                }
            }
        }
        // console.log(table)

        for (let i = 0; i < table.length; i++) {
            const row = table[i];
            let row_div = document.createElement('div')
            row_div.className = 'row'
            for (let j = 0; j < row.length; j++) {
                let col_div = document.createElement('div')
                col_div.className = 'col border'
                let p = document.createElement('p')
                p.innerText = row[j]
                col_div.appendChild(p)
                row_div.appendChild(col_div)
            }
            content.appendChild(row_div)
        }
    } catch (error) {
        console.log(error)
    }
})

ipcRenderer.on('app:exec-write-modbus-reply', function (event, reply) {
    QueryModbusLog()
})

async function QueryModbusLog() {
    try {
        console.log('recevie query modbus log')
        const modbuslog = await ipcRenderer.invoke('app:query-modbus-log', {
            pagesize: 10,
            page: 0
        })

        // console.log(modbuslog)
        var content = document.getElementById('data_content')
        content.innerHTML = ''
        content.style = ''
        content.classList.remove('p-3')

        let table = document.createElement('table')
        table.className = 'table table-sm table-striped table-bordered'

        // create column header
        let head = document.createElement('thead')
        table.appendChild(head)

        let tr = document.createElement('tr')
        Object.getOwnPropertyNames(modbuslog[0]).forEach(colName => {
            let th = document.createElement('th')
            th.scope = 'col'
            th.innerText = colName
            tr.appendChild(th)
        });
        head.appendChild(tr)

        // create row body
        let body = document.createElement('tbody')
        for (let i = 0; i < modbuslog.length; i++) {
            tr = document.createElement('tr')
            const row = modbuslog[i];
            Object.getOwnPropertyNames(row).forEach(colName => {
                td = document.createElement('td')
                td.innerText = row[colName]
                tr.appendChild(td)
            });
            body.appendChild(tr)
        }
        table.appendChild(body)

        content.appendChild(table)
    } catch (error) {
        console.log(error)
    }
}

async function ShowGallery(index) {
    try {
        const pagesize = 8
        var temp = await ipcRenderer.invoke('app:get-image-count')
        const count = temp[0]['count']
        var total = count % pagesize === 0 ? count / pagesize - 1 : count / pagesize
        console.log(`total page count:${total}`)
        if (total === -1) {
            ipcRenderer.send('app:toast-error-message', {
                title:'gallery',
                message:'無圖片資料'
            })
            return
        }

        // page
        var rows = await ipcRenderer.invoke('app:get-images', { page: index, size: pagesize })
        // console.log(rows)
        var content = document.getElementById('gallery')
        content.innerHTML = ''

        var row = document.createElement('div')
        row.className = 'row d-flex flex-wrap'
        for (let i = 0; i < rows.length; i++) {
            var col = document.createElement('div')
            col.className = 'col-3'

            const data = rows[i];
            var img = document.createElement('img')
            img.className = 'img-thumbnail shadow-1-strong rounded mb-4 p-1'
            var base64Image = Buffer.from(data.file_content, 'binary').toString('base64')
            img.src = `data:image/png;base64,${base64Image}`;

            col.appendChild(img)
            row.appendChild(col)
        }

        content.appendChild(row)

        // setup pagination control
        let nav = document.getElementById('page')
        nav.innerHTML = ''
        let ul = document.createElement('ul')
        ul.className = 'pagination'

        let li = document.createElement('li')
        li.className = 'page-item'
        let a = document.createElement('a')
        a.className = 'page-link'
        a.innerText = '第一頁'
        a.addEventListener('click', () => { ShowGallery(0) })
        li.appendChild(a)
        ul.appendChild(li)

        let start = 0
        let end = 0

        if (index > 0) {
            start = index - 1
        }

        if (index + 1 >= total) {
            end = total
        } else {
            end = index + 1
        }

        li = document.createElement('li')
        if (index === 0) {
            li.className = 'page-item disabled'
        } else {
            li.className = 'page-item'
        }
        a = document.createElement('a')
        a.className = 'page-link'
        a.innerText = '前一頁'
        a.addEventListener('click', () => { ShowGallery(start) })
        li.appendChild(a)
        ul.appendChild(li)

        for (let i = start; i <= end; i++) {
            li = document.createElement('li')
            li.className = 'page-item'

            a = document.createElement('a')
            a.className = i === index ? 'page-link active' : 'page-link'
            a.innerText = i + 1
            a.addEventListener('click', () => { ShowGallery(i) })
            li.appendChild(a)

            ul.appendChild(li)
        }

        li = document.createElement('li')
        if (index === total) {
            li.className = 'page-item disabled'
        } else {
            li.className = 'page-item'
        }
        a = document.createElement('a')
        a.className = 'page-link'
        a.innerText = '後一頁'
        a.addEventListener('click', () => { ShowGallery(end) })
        li.appendChild(a)
        ul.appendChild(li)

        li = document.createElement('li')
        li.className = 'page-item'
        a = document.createElement('a')
        a.className = 'page-link'
        a.innerText = '最終頁'
        a.addEventListener('click', () => { ShowGallery(total) })
        li.appendChild(a)
        ul.appendChild(li)

        nav.appendChild(ul)
    } catch (error) {
        console.log(error)
    }
}