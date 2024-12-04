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
    },
    connect_mqtt: () => {
        const btn = document.getElementById('mqtt-conn')
        if (btn.innerText === '連線') {
            
        } else {
            
        }
        ipcRenderer.send('app:connect-mqtt')
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
        content.className = 'p-3'

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
        content.className = 'table-responsive'

        let table = document.createElement('table')
        table.className = 'table table-striped table-bordered'

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
            tr.scope = 'row'
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

// 添加視窗大小改變的防抖函數
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const gallery = document.getElementById('gallery');
        if (gallery && gallery.style.display !== 'none') {
            ShowGallery(0); // 重新載入第一頁
        }
    }, 200); // 200ms 的延遲，避免頻繁觸發
}

// 在 DOMContentLoaded 時添加視窗大小改變的監聽器
document.addEventListener('DOMContentLoaded', function() {
    window.addEventListener('resize', handleResize);
});

async function ShowGallery(index = 0) {
    try {
        // 確保 gallery 容器存在
        const gallery = document.getElementById('gallery');
        if (!gallery) {
            console.error('Gallery container not found');
            return;
        }

        // 計算每頁顯示的圖片數量
        const imagesPerPage = calculateImagesPerPage();
        console.log('Images per page:', imagesPerPage);
        
        // 獲取圖片總數
        const countResult = await ipcRenderer.invoke('app:get-image-count');
        const count = countResult[0]['count'];
        
        if (count === 0) {
            // Show error message if no images are available
            ipcRenderer.send('app:toast-error-message', {
                title: 'gallery',
                message: '無圖片資料'
            });
            return;
        }
        
        // 計算總頁數
        const total = Math.ceil(count / imagesPerPage) - 1;
        
        // 確保索引在有效範圍內
        index = Math.max(0, Math.min(index, total));
        
        // 獲取當前頁的圖片
        const rows = await ipcRenderer.invoke('app:get-images', { 
            page: index, 
            size: imagesPerPage 
        });
        
        // 清空現有內容
        gallery.innerHTML = '';
        
        // 創建新的 row
        let row = document.createElement('div');
        row.className = 'row g-3';
        gallery.appendChild(row);
        
        // 添加圖片
        for (let i = 0; i < rows.length; i++) {
            const data = rows[i];
            var img = document.createElement('img');
            img.src = `data:image/jpeg;base64,${Buffer.from(data.file_content, 'binary').toString('base64')}`;
            img.className = 'img-thumbnail gallery-img';
            img.alt = '圖片';
            
            // Add click event for preview
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                showPreviewModal(this);
            });
            
            row.appendChild(img);
        }
        
        // Setup pagination control
        let nav = document.getElementById('page');
        nav.innerHTML = '';
        
        // Create container for pagination
        let container = document.createElement('div');
        container.className = 'd-flex flex-column align-items-center gap-2';
        
        // Create pagination buttons
        let ul = document.createElement('ul');
        ul.className = 'pagination mb-0';

        // First page link
        let li = document.createElement('li');
        li.className = 'page-item';
        let a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-bar-left"></i>';
        a.addEventListener('click', () => { ShowGallery(0); });
        li.appendChild(a);
        ul.appendChild(li);

        start = index > 0 ? index - 1 : 0;
        end = index + 2 >= total ? total : index + 2;

        // Previous page link
        li = document.createElement('li');
        li.className = index === 0 ? 'page-item disabled' : 'page-item';
        a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-left"></i>';
        a.addEventListener('click', () => { ShowGallery(start); });
        li.appendChild(a);
        ul.appendChild(li);

        // Page numbers
        for (let i = start; i <= end; i++) {
            li = document.createElement('li');
            li.className = 'page-item';
            a = document.createElement('a');
            a.className = i === index ? 'page-link active' : 'page-link';
            a.innerText = i + 1;
            a.addEventListener('click', () => { ShowGallery(i); });
            li.appendChild(a);
            ul.appendChild(li);
        }

        // Next page link
        li = document.createElement('li');
        li.className = index === total ? 'page-item disabled' : 'page-item';
        a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-right"></i>';
        a.addEventListener('click', () => { ShowGallery(end); });
        li.appendChild(a);
        ul.appendChild(li);

        // Last page link
        li = document.createElement('li');
        li.className = 'page-item';
        a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-bar-right"></i>';
        a.addEventListener('click', () => { ShowGallery(total); });
        li.appendChild(a);
        ul.appendChild(li);

        container.appendChild(ul);

        // Add page number input in new row
        let inputGroup = document.createElement('div');
        inputGroup.className = 'input-group justify-content-center';
        inputGroup.style.maxWidth = '150px';

        let input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control page-input text-center';
        input.min = 1;
        input.max = total + 1;
        input.value = index + 1;
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const pageNum = parseInt(event.target.value);
                if (pageNum && pageNum >= 1 && pageNum <= total + 1) {
                    ShowGallery(pageNum - 1);
                }
            }
        });
        input.addEventListener('change', (event) => {
            const pageNum = parseInt(event.target.value);
            if (pageNum && pageNum >= 1 && pageNum <= total + 1) {
                ShowGallery(pageNum - 1);
            } else {
                event.target.value = index + 1;
            }
        });

        let inputGroupText = document.createElement('span');
        inputGroupText.className = 'input-group-text';
        inputGroupText.innerText = `/ ${total + 1}`;

        inputGroup.appendChild(input);
        inputGroup.appendChild(inputGroupText);
        container.appendChild(inputGroup);

        nav.appendChild(container);
    } catch (error) {
        console.error('Error in ShowGallery:', error);
    }
}

function calculateImagesPerPage() {
    try {
        // 獲取圖片容器的寬度
        const container = document.querySelector('#gallery');
        if (!container) {
            console.warn('Gallery container not found, using default values');
            return 8; // 返回預設值
        }
        
        const containerWidth = container.clientWidth || window.innerWidth - 40; // 使用視窗寬度作為後備
        
        // 獲取視窗高度
        const windowHeight = window.innerHeight;
        
        // 設定圖片和間距的尺寸（與 CSS 保持一致）
        const imageWidth = 200; // 圖片寬度（包含邊距）
        const imageHeight = 200; // 圖片高度（包含邊距）
        const gridGap = 16; // 網格間距
        
        // 計算每行可容納的圖片數
        const imagesPerRow = Math.max(1, Math.floor((containerWidth + gridGap) / (imageWidth + gridGap)));
        
        // 計算可容納的行數（減去分頁控制的空間）
        const availableHeight = windowHeight - 150; // 150px 為分頁控制的預留空間
        const rows = Math.max(1, Math.floor((availableHeight + gridGap) / (imageHeight + gridGap)));
        
        // 計算總共可顯示的圖片數量
        return Math.max(imagesPerRow * rows, 4); // 至少顯示4張圖片
    } catch (error) {
        console.error('Error calculating images per page:', error);
        return 8; // 發生錯誤時返回預設值
    }
}

async function ShowGallery(index = 0) {
    try {
        // 確保 gallery 容器存在
        const gallery = document.getElementById('gallery');
        if (!gallery) {
            console.error('Gallery container not found');
            return;
        }

        // 計算每頁顯示的圖片數量
        const imagesPerPage = calculateImagesPerPage();
        console.log('Images per page:', imagesPerPage);
        
        // 獲取圖片總數
        const countResult = await ipcRenderer.invoke('app:get-image-count');
        const count = countResult[0]['count'];
        
        if (count === 0) {
            // Show error message if no images are available
            ipcRenderer.send('app:toast-error-message', {
                title: 'gallery',
                message: '無圖片資料'
            });
            return;
        }
        
        // 計算總頁數
        const total = Math.ceil(count / imagesPerPage) - 1;
        
        // 確保索引在有效範圍內
        index = Math.max(0, Math.min(index, total));
        
        // 獲取當前頁的圖片
        const rows = await ipcRenderer.invoke('app:get-images', { 
            page: index, 
            size: imagesPerPage 
        });
        
        // 清空現有內容
        gallery.innerHTML = '';
        
        // 創建新的 row
        let row = document.createElement('div');
        row.className = 'row g-3';
        gallery.appendChild(row);
        
        // 添加圖片
        for (let i = 0; i < rows.length; i++) {
            const data = rows[i];
            var img = document.createElement('img');
            img.src = `data:image/jpeg;base64,${Buffer.from(data.file_content, 'binary').toString('base64')}`;
            img.className = 'img-thumbnail gallery-img';
            img.alt = '圖片';
            
            // Add click event for preview
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                showPreviewModal(this);
            });
            
            row.appendChild(img);
        }
        
        // Setup pagination control
        let nav = document.getElementById('page');
        nav.innerHTML = '';
        
        // Create container for pagination
        let container = document.createElement('div');
        container.className = 'd-flex flex-column align-items-center gap-2';
        
        // Create pagination buttons
        let ul = document.createElement('ul');
        ul.className = 'pagination mb-0';

        // First page link
        let li = document.createElement('li');
        li.className = 'page-item';
        let a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-bar-left"></i>';
        a.addEventListener('click', () => { ShowGallery(0); });
        li.appendChild(a);
        ul.appendChild(li);

        start = index > 0 ? index - 1 : 0;
        end = index + 2 >= total ? total : index + 2;

        // Previous page link
        li = document.createElement('li');
        li.className = index === 0 ? 'page-item disabled' : 'page-item';
        a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-left"></i>';
        a.addEventListener('click', () => { ShowGallery(start); });
        li.appendChild(a);
        ul.appendChild(li);

        // Page numbers
        for (let i = start; i <= end; i++) {
            li = document.createElement('li');
            li.className = 'page-item';
            a = document.createElement('a');
            a.className = i === index ? 'page-link active' : 'page-link';
            a.innerText = i + 1;
            a.addEventListener('click', () => { ShowGallery(i); });
            li.appendChild(a);
            ul.appendChild(li);
        }

        // Next page link
        li = document.createElement('li');
        li.className = index === total ? 'page-item disabled' : 'page-item';
        a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-right"></i>';
        a.addEventListener('click', () => { ShowGallery(end); });
        li.appendChild(a);
        ul.appendChild(li);

        // Last page link
        li = document.createElement('li');
        li.className = 'page-item';
        a = document.createElement('a');
        a.className = 'page-link';
        a.innerHTML = '<i class="bi bi-chevron-bar-right"></i>';
        a.addEventListener('click', () => { ShowGallery(total); });
        li.appendChild(a);
        ul.appendChild(li);

        container.appendChild(ul);

        // Add page number input in new row
        let inputGroup = document.createElement('div');
        inputGroup.className = 'input-group justify-content-center';
        inputGroup.style.maxWidth = '150px';

        let input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control page-input text-center';
        input.min = 1;
        input.max = total + 1;
        input.value = index + 1;
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const pageNum = parseInt(event.target.value);
                if (pageNum && pageNum >= 1 && pageNum <= total + 1) {
                    ShowGallery(pageNum - 1);
                }
            }
        });
        input.addEventListener('change', (event) => {
            const pageNum = parseInt(event.target.value);
            if (pageNum && pageNum >= 1 && pageNum <= total + 1) {
                ShowGallery(pageNum - 1);
            } else {
                event.target.value = index + 1;
            }
        });

        let inputGroupText = document.createElement('span');
        inputGroupText.className = 'input-group-text';
        inputGroupText.innerText = `/ ${total + 1}`;

        inputGroup.appendChild(input);
        inputGroup.appendChild(inputGroupText);
        container.appendChild(inputGroup);

        nav.appendChild(container);
    } catch (error) {
        console.error('Error in ShowGallery:', error);
    }
}

function showPreviewModal(imgElement) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const prevButton = modal.querySelector('.preview-prev');
    const nextButton = modal.querySelector('.preview-next');
    
    // Set current image
    previewImage.src = imgElement.src;
    
    // Get all gallery images and convert to array
    const imageArray = Array.from(document.querySelectorAll('.gallery-img'));
    let currentIndex = imageArray.indexOf(imgElement);
    
    console.log('Current image index:', currentIndex); // 添加日誌
    console.log('Total images:', imageArray.length); // 添加日誌
    
    // Update navigation buttons
    function updateNavButtons() {
        prevButton.style.display = currentIndex > 0 ? 'flex' : 'none';
        nextButton.style.display = currentIndex < imageArray.length - 1 ? 'flex' : 'none';
    }
    
    // Navigation handlers
    prevButton.onclick = () => {
        if (currentIndex > 0) {
            currentIndex--;
            previewImage.src = imageArray[currentIndex].src;
            updateNavButtons();
        }
    };
    
    nextButton.onclick = () => {
        if (currentIndex < imageArray.length - 1) {
            currentIndex++;
            previewImage.src = imageArray[currentIndex].src;
            updateNavButtons();
        }
    };
    
    // Initial button state
    updateNavButtons();
    
    // Show modal
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    
    // Close modal handler
    const closeButton = modal.querySelector('.btn-close');
    const closeModal = () => {
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
    };
    
    closeButton.onclick = closeModal;
    modal.querySelector('.modal-backdrop').onclick = closeModal;
}