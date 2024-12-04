async function handleRelativePathKeyDown(event) {
    if (event.key === 'Enter') {
        window.api.scan_folder();
    }
}

document.getElementById('relativePath').addEventListener('keydown', handleRelativePathKeyDown, true);

function handleImageIdKeyDown(event) {
    if (event.key == 'Enter') {
        window.api.show_image();
    }
}

document.getElementById('imageId').addEventListener('keydown', handleImageIdKeyDown, true);

let folderTimer = setInterval(() => {
    // window.api.scan_folder();
}, 1000);

function handleFolderPathKeyDown(event) {
    if (event.key === 'Enter') {
        window.api.scan_with_fast_glob()
    }
}

document.getElementById('folderPath').addEventListener('keydown', handleFolderPathKeyDown, true)

function handleImagePathTextChange(event) {
    document.getElementById('imgPath').classList.remove('is-invalid')
}

document.getElementById('imgPath').addEventListener('change', handleImagePathTextChange, true)

$('#connect').on('change', function () {
    window.api.connect_modbus()
})

// 資料範圍上下限驗證
// read coils 8 ~ 1024
// read input registers 1 ~ 120
// read holding registers 1 ~ 120
$('#size').on('change', function () {
    var val = $(this).val()
    if ($('#func').val() === '1') {
        if (val > 1024) {
            $(this).val(1024)
        } if (val < 8) {
            $(this).val(8)
        }
    } else if ($('#func').val() === '2' || $('#func').val() === '3') {
        if (val > 120) {
            $(this).val(120)
        } else if (val <= 0) {
            $(this).val(1)
        }
    }
})

function handleModeChange(event) {
    var val = parseInt($(this).val())
    console.log(val)
    if (val === 1 || val === 2) {
        document.getElementById('continuous').classList.remove('collapse')
        document.getElementById('write_content').classList.remove('collapse')

        document.getElementById('write_content').classList.add('collapse')
        if (val === 1) {
            document.getElementById('continuous').classList.add('collapse')
        }

        var select = document.getElementById('func')
        select.innerHTML = ''

        let arr = ['Read Coils', 'Read Input Registers', 'Read Holding Registers']
        for (let i = 0; i < arr.length; i++) {
            var option = document.createElement('option')
            option.value = i + 1
            option.innerText = arr[i]
            select.appendChild(option)
        }
    } else if (val === 3 || val === 4) {
        document.getElementById('continuous').classList.remove('collapse')
        document.getElementById('write_content').classList.remove('collapse')

        if (val === 3) {
            document.getElementById('continuous').classList.add('collapse')
        }

        var select = document.getElementById('func')
        select.innerHTML = ''

        let arr = ['Write Single Coils', 'Write Single Register', 'Write Multiple Coils', 'Write Multiple Register']
        for (let i = 0; i < arr.length; i++) {
            var option = document.createElement('option')
            option.value = i + 1
            option.innerText = arr[i]
            select.appendChild(option)
        }

        window.api.query_modbus_log()
    }
}

// change model
document.getElementById('mode').addEventListener('change', handleModeChange, true)
document.getElementById('mode').dispatchEvent(new Event('change'))

// mqtt connect handle
function handleMQTTConnection() {
    var carousel_inst = new bootstrap.Carousel(document.getElementById('slide'))
    console.log(carousel_inst)
    // slide to publish
    carousel_inst.to(1)
}

document.getElementById('mqtt-conn').addEventListener('click', handleMQTTConnection, true)

document.getElementById('slide').addEventListener('slide.bs.carousel', event => {
    console.log(event)
    var items = document.querySelectorAll('a[data-bs-target="#slide"]')
    items[event.from].classList.remove('border')
    items[event.from].classList.remove('border-primary')
    items[event.to].classList.add('border')
    items[event.to].classList.add('border-primary')
})