const mqtt = require('mqtt');
const NotificationManager = require('../js/NotificationManager');
const i18next = require('i18next');

class MqttClient {
    constructor() {
        this.brokerUrl = null;
        this.client = null;
        this.onMessageCallback = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
        this.onErrorCallback = null;
        this.onSubscribeCallback = null;
        this.isConnecting = false;
        this.hasConnectionError = false;
    }

    connect(ip, port) {
        if (this.isConnecting) {
            return;
        }

        this.isConnecting = true;
        this.hasConnectionError = false;
        this.brokerUrl = `mqtt://${ip}:${port}`;
        
        try {
            this.client = mqtt.connect(this.brokerUrl);

            this.client.on('connect', () => {
                console.log('Connected to MQTT broker');
                this.isConnecting = false;
                this.hasConnectionError = false;
                NotificationManager.show(
                    i18next.t('mqtt.success.connected'),
                    'success'
                );
                if (this.onConnectCallback) {
                    this.onConnectCallback();
                }
            });

            this.client.on('error', (err) => {
                console.error('Connection error:', err);
                
                // 只在第一次錯誤時顯示通知
                if (!this.hasConnectionError) {
                    this.hasConnectionError = true;
                    NotificationManager.show(
                        i18next.t('mqtt.error.connection_failed', { message: err.message }),
                        'error'
                    );
                    this.isConnecting = false;
                    
                    if (this.onErrorCallback) {
                        this.onErrorCallback(err);
                    }
                    
                    // 連線失敗時自動斷開
                    this.disconnect();
                }
            });

            this.client.on('message', (topic, message) => {
                console.log(`Received message on ${topic}: ${message.toString()}`);
                if (this.onMessageCallback) {
                    this.onMessageCallback(topic, message.toString());
                }
            });

        } catch (error) {
            console.error('Failed to create MQTT client:', error);
            NotificationManager.show(
                i18next.t('mqtt.error.client_creation_failed', { message: error.message }),
                'error'
            );
            this.isConnecting = false;
            this.hasConnectionError = true;
        }
    }

    disconnect() {
        if (this.client) {
            this.client.end(() => {
                console.log('Disconnected from MQTT broker');
                this.isConnecting = false;
                this.hasConnectionError = false;
                if (this.onDisconnectCallback) {
                    this.onDisconnectCallback();
                }
            });
        }
    }

    publish(topic, message) {
        if (this.client && !this.hasConnectionError) {
            this.client.publish(topic, message, (err) => {
                if (!err) {
                    NotificationManager.show(
                        i18next.t('mqtt.success.published', { topic }),
                        'success'
                    );
                }
            });
        }
    }

    subscribe(topic) {
        if (this.client && !this.hasConnectionError) {
            this.client.subscribe(topic, (err) => {
                if (!err) {
                    NotificationManager.show(
                        i18next.t('mqtt.success.subscribed', { topic }),
                        'success'
                    );
                    if (this.onSubscribeCallback) {
                        this.onSubscribeCallback(topic);
                    }
                }
            });
        }
    }

    setOnMessageCallback(callback) {
        this.onMessageCallback = callback;
    }

    setOnConnectCallback(callback) {
        this.onConnectCallback = callback;
    }

    setOnDisconnectCallback(callback) {
        this.onDisconnectCallback = callback;
    }

    setOnErrorCallback(callback) {
        this.onErrorCallback = callback;
    }

    setOnSubscribeCallback(callback) {
        this.onSubscribeCallback = callback;
    }
}

module.exports = MqttClient;
