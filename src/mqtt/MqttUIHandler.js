class MqttUIHandler {
    constructor(mqttClient) {
        this.mqttClient = mqttClient;
        this.elements = {};
    }

    initialize() {
        try {
            // 獲取所有需要的 DOM 元素
            this.elements = {
                ipInput: document.getElementById('mqtt-broker'),
                portInput: document.getElementById('mqtt-port'),
                connectBtn: document.getElementById('mqtt-connect'),
                topic: document.getElementById('mqtt-topic'),
                message: document.getElementById('mqtt-message'),
                publishBtn: document.getElementById('mqtt-publish'),
                subscribeBtn: document.getElementById('mqtt-subscribe'),
                messages: document.getElementById('mqtt-messages')
            };

            // 檢查所有必要的元素是否存在
            for (const [key, element] of Object.entries(this.elements)) {
                if (!element) {
                    throw new Error(`Required element not found: ${key}`);
                }
            }

            this.setupEventListeners();
            this.setupCallbacks();
        } catch (error) {
            console.error('Error initializing MQTT UI handler:', error);
            throw error;
        }
    }

    setupEventListeners() {
        this.elements.connectBtn.addEventListener('click', () => {
            if (this.elements.connectBtn.innerText === '連線') {
                const ip = this.elements.ipInput.value;
                const port = this.elements.portInput.value || 1883;
                this.mqttClient.connect(ip, port);
            } else {
                this.mqttClient.disconnect();
            }
        });

        this.elements.publishBtn.addEventListener('click', () => {
            const topic = this.elements.topic.value;
            const message = this.elements.message.value;
            if (topic && message) {
                this.mqttClient.publish(topic, message);
            }
        });

        this.elements.subscribeBtn.addEventListener('click', () => {
            const topic = this.elements.topic.value;
            if (topic) {
                this.mqttClient.subscribe(topic);
            }
        });
    }

    setupCallbacks() {
        this.mqttClient.setOnConnectCallback(() => {
            this.elements.connectBtn.innerText = '斷開';
            this.elements.connectBtn.classList.remove('btn-primary');
            this.elements.connectBtn.classList.add('btn-danger');
            this.elements.ipInput.disabled = true;
            this.elements.portInput.disabled = true;

            // 如果連接埠是空的，設置為預設值 1883
            if (!this.elements.portInput.value) {
                this.elements.portInput.value = '1883';
            }
        });

        this.mqttClient.setOnDisconnectCallback(() => {
            this.elements.connectBtn.innerText = '連線';
            this.elements.connectBtn.classList.remove('btn-danger');
            this.elements.connectBtn.classList.add('btn-primary');
            this.elements.ipInput.disabled = false;
            this.elements.portInput.disabled = false;
            this.elements.topic.disabled = false;  // 斷開連線時解除訂閱輸入框的禁用狀態
        });

        this.mqttClient.setOnMessageCallback((topic, message) => {
            const messageElement = document.createElement('p');
            messageElement.textContent = `Topic: ${topic}, Message: ${message}`;
            this.elements.messages.appendChild(messageElement);
        });

        this.mqttClient.setOnSubscribeCallback((topic) => {
            this.elements.topic.disabled = true;  // 訂閱成功後禁用輸入框
        });
    }
}

module.exports = MqttUIHandler;
