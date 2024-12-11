const jsmodbus = require('jsmodbus');
const net = require('net');

class ModbusHandler {
    constructor(client) {
        this.client = client;
        this.socket = new net.Socket();
        this.client = new jsmodbus.client.TCP(this.socket);
        this.samplingInterval = null;
        this.elements = {};

        // 監聽連接事件
        this.socket.on('connect', () => {
            console.log('已連接到 Modbus 伺服器');
            this.updateUIOnConnect();
        });

        // 監聽斷開事件
        this.socket.on('close', () => {
            console.error('Modbus 斷開連接');
            this.updateUIOnDisconnect();
        });

        // 監聽錯誤事件
        this.socket.on('error', (err) => {
            console.error('Modbus 錯誤:', err);
        });
    }

    initialize() {
        try {
            // 獲取所有需要的 DOM 元素
            this.elements = {
                executeBtn: document.getElementById('execute-btn'),
                resultTable: document.getElementById('modbus-result-table'),
                connectBtn: document.getElementById('connect-btn'),
                modbusIp: document.getElementById('modbus-ip'),
                modbusPort: document.getElementById('modbus-port'),
                modbusMode: document.getElementById('modbus-mode'),
                modbusMethod: document.getElementById('modbus-method'),
                startAddress: document.getElementById('start-address'),
                dataLength: document.getElementById('data-length'),
                writeDataContainer: document.getElementById('write-data-container'),
                writeData: document.getElementById('write-data'),
                samplingRateContainer: document.getElementById('sampling-rate-container'),
                samplingRate: document.getElementById('sampling-rate')
            };

            // 檢查必要的元素是否存在
            const requiredElements = ['executeBtn', 'resultTable', 'connectBtn', 'modbusIp', 'modbusPort', 'modbusMode', 'modbusMethod', 'startAddress', 'dataLength'];
            for (const key of requiredElements) {
                if (!this.elements[key]) {
                    throw new Error(`Required element not found: ${key}`);
                }
            }

            // 綁定模式切換事件
            this.elements.modbusMode.addEventListener('change', (e) => {
                const mode = e.target.value;
                const writeDataContainer = document.getElementById('write-data-container');
                const samplingRateContainer = document.getElementById('sampling-rate-container');
                const methodSelect = document.getElementById('modbus-method');

                // 更新寫入數值和取樣頻率控制項的顯示狀態
                writeDataContainer.style.display = mode.includes('write') ? 'block' : 'none';
                samplingRateContainer.style.display = mode.includes('continuous') ? 'block' : 'none';

                // 清空並更新方法選項
                methodSelect.innerHTML = '<option selected>選擇使用方法</option>';
                
                if (mode.includes('write')) {
                    // 寫入模式只顯示 coil 和 holding register
                    methodSelect.innerHTML += `
                        <option value="coil">Coil (0x)</option>
                        <option value="holding">Holding Register (4x)</option>
                    `;
                } else {
                    // 讀取模式顯示所有選項
                    methodSelect.innerHTML += `
                        <option value="coil">Coil (0x)</option>
                        <option value="discrete">Discrete Input (1x)</option>
                        <option value="holding">Holding Register (4x)</option>
                        <option value="input">Input Register (3x)</option>
                    `;
                }
            });

            // 綁定連接按鈕事件
            this.elements.connectBtn.addEventListener('click', () => {
                const ip = this.elements.modbusIp.value;
                const port = this.elements.modbusPort.value || 502;
                if (this.elements.connectBtn.innerText === '連線') {
                    this.connect(ip, port);
                } else {
                    this.disconnect();
                }
            });

            // 綁定執行按鈕事件
            this.elements.executeBtn.addEventListener('click', () => {
                const mode = this.elements.modbusMode.value;
                const method = this.elements.modbusMethod.value;
                const startAddress = parseInt(this.elements.startAddress.value);
                const dataLength = parseInt(this.elements.dataLength.value);
                const samplingRate = this.elements.samplingRate ? parseInt(this.elements.samplingRate.value) : 1000;
                const writeData = this.elements.writeData ? this.elements.writeData.value : null;

                if (!this.validateInputs(mode, method, startAddress, dataLength)) {
                    return;
                }

                this.executeOperation(mode, {
                    method,
                    startAddress,
                    dataLength,
                    samplingRate,
                    writeData
                });
            });

            // 初始化控制項顯示狀態
            this.updateControlsVisibility();

        } catch (error) {
            console.error('Error initializing Modbus handler:', error);
            throw error;
        }
    }

    // 更新控制項的顯示狀態
    updateControlsVisibility() {
        const mode = this.elements.modbusMode.value;
        
        // 處理寫入數值控制項
        if (this.elements.writeDataContainer) {
            this.elements.writeDataContainer.style.display = 
                (mode === 'write-single' || mode === 'write-continuous') ? 'block' : 'none';
        }
        
        // 處理取樣頻率控制項
        if (this.elements.samplingRateContainer) {
            this.elements.samplingRateContainer.style.display = 
                (mode === 'read-continuous' || mode === 'write-continuous') ? 'block' : 'none';
        }
    }

    getReadFunction(method) {
        switch (method) {
            case 'coil':
                return this.client.readCoils;
            case 'discrete':
                return this.client.readDiscreteInputs;
            case 'holding':
                return this.client.readHoldingRegisters;
            case 'input':
                return this.client.readInputRegisters;
            default:
                return null;
        }
    }

    getWriteFunction(method) {
        switch (method) {
            case 'coil':
                return this.client.writeSingleCoil;
            case 'holding':
                return this.client.writeMultipleRegisters;
            default:
                return null;
        }
    }

    performRead(method, startAddress, dataLength) {
        console.log(`執行讀取操作: 方法=${method}, 起始地址=${startAddress}, 資料長度=${dataLength}`);
        const readFunction = this.getReadFunction(method);
        
        if (!readFunction) {
            console.error('無效的讀取方法:', method);
            return Promise.reject(new Error('無效的讀取方法'));
        }

        return readFunction.call(this.client, startAddress, dataLength)
            .then(data => {
                console.log('讀取成功:', data);
                this.logResult(startAddress, data.response, '成功', method);
                return data;
            })
            .catch(err => {
                console.error('Modbus 讀取錯誤:', err);
                this.logResult(startAddress, [], `錯誤: ${err.message}`, method);
                throw err;
            });
    }

    performWrite(method, startAddress, data) {
        console.log(`執行寫入操作: 方法=${method}, 起始地址=${startAddress}, 資料=${JSON.stringify(data)}`);
        const writeFunction = this.getWriteFunction(method);
        
        if (!writeFunction) {
            const error = new Error('無效的寫入方法');
            console.error(error);
            return Promise.reject(error);
        }

        return writeFunction.call(this.client, startAddress, data)
            .then((resp) => {
                this.logResult(startAddress, resp.request, '成功', method);
                return resp;
            })
            .catch(err => {
                this.logResult(startAddress, null, `錯誤: ${err.message}`, method);
                throw err;
            });
    }

    parseWriteData(method, dataStr) {
        if (!dataStr) return null;
        
        try {
            // 將輸入字符串分割成數組
            const values = dataStr.split(',').map(v => v.trim());
            
            switch (method) {
                case 'coil':
                    // 對於 coil，轉換為布林值數組
                    return values.map(v => v === '1' || v.toLowerCase() === 'true');
                
                case 'holding':
                    // 對於 holding register，轉換為 16 位整數數組
                    return values.map(v => {
                        const num = parseInt(v);
                        if (isNaN(num) || num < 0 || num > 65535) {
                            throw new Error(`值 ${v} 超出範圍 (0-65535)`);
                        }
                        return num;
                    });
                
                default:
                    throw new Error(`不支援的寫入方法: ${method}`);
            }
        } catch (error) {
            console.error('解析寫入數據錯誤:', error);
            throw error;
        }
    }

    executeOperation(mode, options) {
        const { method, startAddress, dataLength, samplingRate = 1000, writeData } = options;

        try {
            switch (mode) {
                case 'read-single':
                    return this.performRead(method, startAddress, dataLength);
                
                case 'read-continuous':
                    return this.startContinuousRead(method, startAddress, dataLength, samplingRate);
                
                case 'write-single':
                    const parsedData = this.parseWriteData(method, writeData);
                    if (!parsedData) {
                        throw new Error('未提供寫入數據');
                    }
                    return this.singleWrite(method, startAddress, parsedData);
                
                case 'write-continuous':
                    const parsedContinuousData = this.parseWriteData(method, writeData);
                    if (!parsedContinuousData) {
                        throw new Error('未提供寫入數據');
                    }
                    return this.startContinuousWrite(method, startAddress, parsedContinuousData, samplingRate);
                
                default:
                    throw new Error(`不支援的操作模式: ${mode}`);
            }
        } catch (error) {
            console.error(`執行操作錯誤: ${error.message}`);
            this.logResult(startAddress, null, `錯誤: ${error.message}`, method);
            throw error;
        }
    }

    startContinuousRead(method, startAddress, dataLength, samplingRate) {
        this.stopContinuous();
        this.samplingInterval = setInterval(() => {
            this.performRead(method, startAddress, dataLength)
                .then(data => {
                    console.log('連續讀取成功:', data);
                })
                .catch(err => {
                    console.error('連續讀取錯誤:', err);
                });
        }, samplingRate);
    }

    singleWrite(method, startAddress, data) {
        console.log(`單步寫入: 方法=${method}, 地址=${startAddress}, 數據=`, data);
        try {
            return this.performWrite(method, startAddress, data);
        } catch (error) {
            console.error('單步寫入錯誤:', error);
            throw error;
        }
    }

    startContinuousWrite(method, startAddress, data, samplingRate) {
        this.stopContinuous();
        this.samplingInterval = setInterval(() => {
            this.performWrite(method, startAddress, data)
                .then(() => {
                    console.log('連續寫入成功');
                })
                .catch(err => {
                    console.error('連續寫入錯誤:', err);
                });
        }, samplingRate);
    }

    stopContinuous() {
        if (this.samplingInterval !== null) {
            clearInterval(this.samplingInterval);
            this.samplingInterval = null;
        }
    }

    logResult(address, data, status = '成功', method) {
        const tbody = this.elements.resultTable.querySelector('tbody');
        const row = document.createElement('tr');
        const timestamp = new Date().toLocaleString();
        
        // 格式化數據顯示
        let displayData;
        if (Array.isArray(data)) {
            displayData = JSON.stringify(data);
        } else if (data && data._body && data._body._valuesAsArray) {
            displayData = JSON.stringify(data._body._valuesAsArray);
        } else {
            displayData = data ? JSON.stringify(data) : '無數據';
        }

        row.innerHTML = `
            <td>${address}</td>
            <td>${displayData}</td>
            <td>${timestamp}</td>
            <td>${status}</td>
            <td>${method}</td>
        `;
        
        // 根據狀態設置行的樣式
        if (status !== '成功') {
            row.classList.add('table-danger');
        }

        // 將新行插入到表格的最前面
        if (tbody.firstChild) {
            tbody.insertBefore(row, tbody.firstChild);
        } else {
            tbody.appendChild(row);
        }

        // 限制顯示的行數
        const maxRows = 100;
        while (tbody.children.length > maxRows) {
            tbody.removeChild(tbody.lastChild);
        }
    }

    connect(ip, port) {
        this.socket.connect(port, ip);
    }

    disconnect() {
        this.stopContinuous();
        this.socket.destroy();
    }

    updateUIOnConnect() {
        this.elements.connectBtn.innerText = '斷開連接';
        this.elements.modbusIp.disabled = true;
        this.elements.modbusPort.disabled = true;
    }

    updateUIOnDisconnect() {
        this.elements.connectBtn.innerText = '連線';
        this.elements.modbusIp.disabled = false;
        this.elements.modbusPort.disabled = false;
    }

    validateInputs(mode, method, startAddress, dataLength) {
        if (!method || method === '選擇使用方法') {
            console.error('請選擇使用方法');
            return false;
        }

        if (startAddress === undefined || startAddress === null || isNaN(startAddress)) {
            console.error('請輸入有效的起始地址');
            return false;
        }

        if (!dataLength || isNaN(dataLength) || dataLength <= 0) {
            console.error('請輸入有效的資料長度');
            return false;
        }

        // 檢查寫入模式的特殊要求
        if (mode === 'write-single' || mode === 'write-continuous') {
            const writeData = document.getElementById('write-data')?.value;
            if (!writeData || writeData.trim() === '') {
                console.error('請輸入寫入數值');
                return false;
            }
        }

        // 檢查連續模式的特殊要求
        if (mode === 'read-continuous' || mode === 'write-continuous') {
            const samplingRate = document.getElementById('sampling-rate')?.value;
            if (!samplingRate || isNaN(samplingRate) || samplingRate <= 0) {
                console.error('請輸入有效的取樣頻率');
                return false;
            }
        }

        return true;
    }
}

module.exports = ModbusHandler;
