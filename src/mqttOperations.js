const mqtt = require('mqtt');

class MqttHandler {
    constructor() {
        this.brokerUrl = null;
        this.client = null;
        this.elements = {};
    }

    connect(ip, port) {
        this.brokerUrl = `mqtt://${ip}:${port}`;
        this.client = mqtt.connect(this.brokerUrl);

        this.client.on('connect', () => {
            console.log('Connected to MQTT broker');
            this.elements.connectBtn.innerText = '斷開';
            this.elements.connectBtn.classList.remove('btn-primary');
            this.elements.connectBtn.classList.add('btn-danger');
            this.elements.ipInput.disabled = true;
            this.elements.portInput.disabled = true;
        });

        this.client.on('error', (err) => {
            console.error('Connection error:', err);
        });

        this.client.on('message', (topic, message) => {
            console.log(`Received message on ${topic}: ${message.toString()}`);
            const messageElement = document.createElement('p');
            messageElement.textContent = `Topic: ${topic}, Message: ${message.toString()}`;
            this.elements.messages.appendChild(messageElement);
        });
    }

    disconnect() {
        if (this.client) {
            this.client.end(() => {
                console.log('Disconnected from MQTT broker');
                this.elements.connectBtn.innerText = '連線';
                this.elements.connectBtn.classList.remove('btn-danger');
                this.elements.connectBtn.classList.add('btn-primary');
                this.elements.ipInput.disabled = false;
                this.elements.portInput.disabled = false;
            });
        }
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

            // 綁定事件
            this.elements.connectBtn.addEventListener('click', () => {
                if (this.elements.connectBtn.innerText === '連線') {
                    const ip = this.elements.ipInput.value;
                    const port = this.elements.portInput.value || 1883;
                    this.connect(ip, port);
                } else {
                    this.disconnect();
                }
            });

            this.elements.publishBtn.addEventListener('click', () => {
                const topic = this.elements.topic.value;
                const message = this.elements.message.value;
                if (topic && message) {
                    this.publish(topic, message);
                }
            });

            this.elements.subscribeBtn.addEventListener('click', () => {
                const topic = this.elements.topic.value;
                if (topic) {
                    this.subscribe(topic);
                }
            });

        } catch (error) {
            console.error('Error initializing MQTT handler:', error);
            throw error;
        }
    }

    publish(topic, message) {
        if (this.client) {
            this.client.publish(topic, message);
        }
    }

    subscribe(topic) {
        if (this.client) {
            this.client.subscribe(topic);
        }
    }

    cleanup() {
        this.disconnect();
    }
}

module.exports = MqttHandler;
