const { ipcRenderer } = require('electron');
const FtpClient = require('../../ftp/FtpClient');

// Mock basic-ftp
jest.mock('basic-ftp', () => ({
    Client: jest.fn().mockImplementation(() => ({
        access: jest.fn(),
        downloadTo: jest.fn(),
        uploadFrom: jest.fn(),
        list: jest.fn(),
        cd: jest.fn(),
        close: jest.fn()
    }))
}));

describe('FtpClient', () => {
    let ftpClient;
    let mockClient;

    beforeEach(() => {
        ftpClient = new FtpClient();
        mockClient = ftpClient.client;
    });

    describe('validateFtpUrl', () => {
        it('should validate correct FTP URLs', () => {
            expect(ftpClient.validateFtpUrl('test.com')).toEqual({ isValid: true, message: '' });
            expect(ftpClient.validateFtpUrl('test.com:21')).toEqual({ isValid: true, message: '' });
        });

        it('should reject invalid FTP URLs', () => {
            expect(ftpClient.validateFtpUrl('')).toEqual({ 
                isValid: false, 
                message: 'FTP 伺服器地址不能為空' 
            });
            expect(ftpClient.validateFtpUrl('test.com:70000')).toEqual({ 
                isValid: false, 
                message: 'FTP 端口必須在 1-65535 範圍內' 
            });
        });
    });

    describe('connectToFTP', () => {
        const credentials = {
            host: 'test.com',
            user: 'user',
            password: 'pass'
        };

        it('should connect to FTP server with correct credentials', async () => {
            mockClient.access.mockResolvedValueOnce();
            mockClient.list.mockResolvedValueOnce([]);

            await ftpClient.connectToFTP(credentials.host, credentials.user, credentials.password);

            expect(mockClient.access).toHaveBeenCalledWith({
                host: credentials.host,
                user: credentials.user,
                password: credentials.password,
                secure: false
            });
            expect(ftpClient.isConnectedToServer()).toBe(true);
        });

        it('should handle connection failure', async () => {
            const error = new Error('Connection failed');
            mockClient.access.mockRejectedValueOnce(error);

            await expect(ftpClient.connectToFTP(
                credentials.host, 
                credentials.user, 
                credentials.password
            )).rejects.toThrow('Connection failed');

            expect(ftpClient.isConnectedToServer()).toBe(false);
        });
    });

    describe('listDirectory', () => {
        it('should list directory contents', async () => {
            const mockFiles = [
                { name: 'file1.txt', isDirectory: false },
                { name: 'dir1', isDirectory: true }
            ];
            mockClient.list.mockResolvedValueOnce(mockFiles);
            ftpClient.isConnected = true;

            const files = await ftpClient.listDirectory('/test');

            expect(mockClient.cd).toHaveBeenCalledWith('/');
            expect(mockClient.cd).toHaveBeenCalledWith('/test');
            expect(files).toEqual(mockFiles);
            expect(ftpClient.getCurrentPath()).toBe('/test');
        });

        it('should handle listing failure', async () => {
            const error = new Error('Listing failed');
            mockClient.list.mockRejectedValueOnce(error);
            ftpClient.isConnected = true;

            await expect(ftpClient.listDirectory('/test')).rejects.toThrow('Listing failed');
        });
    });

    describe('disconnectFromFTP', () => {
        it('should disconnect from FTP server', async () => {
            ftpClient.isConnected = true;
            mockClient.close.mockResolvedValueOnce();

            await ftpClient.disconnectFromFTP();

            expect(mockClient.close).toHaveBeenCalled();
            expect(ftpClient.isConnectedToServer()).toBe(false);
            expect(ftpClient.getCurrentFiles()).toEqual([]);
            expect(ftpClient.getCurrentPath()).toBe('/');
        });

        it('should handle disconnection failure', async () => {
            const error = new Error('Disconnection failed');
            mockClient.close.mockRejectedValueOnce(error);

            await expect(ftpClient.disconnectFromFTP()).rejects.toThrow('Disconnection failed');
        });
    });

    describe('cleanup', () => {
        it('should close the client connection', () => {
            ftpClient.cleanup();
            expect(mockClient.close).toHaveBeenCalled();
        });
    });
});
