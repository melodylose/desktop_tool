class ConnectionManager {
    constructor(redisOperations) {
        this.redisOperations = redisOperations;
        this.connections = new Map();
        this.currentConnection = null;
    }

    async connect(connectionInfo) {
        const { name, host, port, password, db } = connectionInfo;
        const connectionId = `${name}@${host}:${port}/${db}`;

        try {
            const client = await this.redisOperations.connect({
                name,
                host,
                port: parseInt(port),
                password: password || undefined,
                db: parseInt(db)
            });

            this.connections.set(connectionId, {
                name,
                host,
                port,
                db,
                client
            });

            this.currentConnection = connectionId;
            return { success: true, connectionId };
        } catch (error) {
            console.error('Connection error:', error);
            if (this.connections.has(connectionId)) {
                const connection = this.connections.get(connectionId);
                if (connection && connection.client) {
                    await this.redisOperations.disconnect(connection.client);
                }
                this.connections.delete(connectionId);
            }
            return { success: false, error: error.message };
        }
    }

    async disconnect(connectionId = this.currentConnection) {
        if (this.connections.has(connectionId)) {
            const connection = this.connections.get(connectionId);
            try {
                await this.redisOperations.disconnect(connection.client);
                this.connections.delete(connectionId);

                if (connectionId === this.currentConnection) {
                    this.currentConnection = null;
                }
                return { success: true };
            } catch (error) {
                console.error('Disconnect error:', error);
                return { success: false, error: error.message };
            }
        }
        return { success: false, error: 'Connection not found' };
    }

    getCurrentConnection() {
        if (!this.currentConnection) return null;
        return this.connections.get(this.currentConnection);
    }

    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }

    getAllConnections() {
        return this.connections;
    }

    getCurrentConnectionId() {
        return this.currentConnection;
    }

    setCurrentConnection(connectionId) {
        if (this.connections.has(connectionId)) {
            this.currentConnection = connectionId;
            return true;
        }
        return false;
    }
}

module.exports = ConnectionManager;
