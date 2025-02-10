const MqttClient = require('./MqttClient');
const MqttUIHandler = require('./MqttUIHandler');

class MqttHandler {
    constructor() {
        this.client = null;
        this.uiHandler = null;
    }

    initialize() {
        this.client = new MqttClient();
        this.uiHandler = new MqttUIHandler(this.client);
        this.uiHandler.initialize();
    }

    cleanup(isClosing) {
        if (this.client) {
            this.client.disconnect();
        }
    }
}

module.exports = MqttHandler;
