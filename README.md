# Electron Toolkit Application

## 功能說明
這是一個基於 Electron 的通信客戶端工具，提供了豐富的工業通信功能：

### 通訊協議支援
- Modbus TCP 協議
  - 資料存取功能
    - 讀取/寫入 Holding Registers (4x)
    - 讀取/寫入 Coils (0x)
    - 讀取 Input Registers (3x)
    - 讀取 Discrete Inputs (1x)
  - 操作模式
    - 單點讀寫
    - 連續讀寫
    - 批量操作
  - 進階功能
    - 自動重連機制
    - 資料格式轉換
    - 錯誤處理機制

- MQTT 協議
  - 基本功能
    - 支援 MQTT 3.1.1 和 5.0 版本
    - 支援 QoS 0, 1, 2
    - 主題訂閱和發布
  - 進階功能
    - 保留訊息設定
    - 支援 SSL/TLS 加密連接
    - Last Will and Testament (LWT) 設定
    - 自動重連機制

- FTP 檔案傳輸
  - 基本功能
    - 支援 FTP 和 FTPS (FTP over SSL)
    - 檔案上傳功能
    - 目錄內容瀏覽
  - 進階功能
    - 支援斷點續傳
    - 檔案傳輸進度顯示
    - 連線狀態監控

### 系統功能
- 監控與管理
  - 連線狀態監控
  - 通訊日誌記錄
  - 錯誤事件管理
  - 系統資源監控
- 資料處理
  - 即時數據顯示
  - 資料格式轉換
  - 資料暫存管理

### 使用者介面
- 操作介面
  - 直覺的操作面板
  - 即時狀態顯示
  - 錯誤提示功能
- 視覺化功能
  - 數據即時展示
  - 系統狀態指示
  - 操作回饋提示

## 環境需求
- Node.js: v21.2.0 或以上
- 系統支援: Windows 10/11
- 主要依賴套件:
  - Electron: ^28.0.0
  - jsmodbus: ^4.0.0
  - mqtt: ^5.3.0
  - basic-ftp: ^5.0.3
  - net: 內建模組

## 安裝步驟
1. 克隆專案：
   ```bash
   git clone <repository-url>
   ```
2. 進入專案目錄：
   ```bash
   cd desktop_tool
   ```
3. 安裝相依套件：
   ```bash
   npm install
   ```

## 使用說明
1. 啟動應用程式：
   ```bash
   npm start
   ```

2. Modbus TCP 連線設定：
   - 輸入 Modbus TCP 伺服器 IP 位址
   - 設定連接埠（預設: 502）
   - 點擊「連線」按鈕建立連線

3. MQTT 連線設定：
   - 輸入 MQTT Broker 位址
   - 設定連接埠（預設: 1883，SSL/TLS: 8883）
   - 設定客戶端 ID、使用者名稱和密碼（如需要）
   - 配置 SSL/TLS 設定（如需要）
   - 設定 LWT 訊息（可選）

4. FTP 連線設定：
   - 輸入 FTP 伺服器位址
   - 設定連接埠（預設: 21，FTPS: 990）
   - 輸入使用者名稱和密碼
   - 選擇是否使用 FTPS

5. 操作功能：
   - Modbus 操作：
     - 選擇要讀取/寫入的暫存器類型
     - 輸入起始位址和數量
     - 執行讀取或寫入操作
   - MQTT 操作：
     - 訂閱/取消訂閱主題
     - 發布訊息到指定主題
     - 設定 QoS 等級和保留訊息
   - FTP 操作：
     - 瀏覽遠端目錄結構
     - 上傳檔案
     - 觀察回應數據和狀態

## 故障排除
- 確認各項服務的連線設定是否正確
  - Modbus TCP: IP 位址和連接埠
  - MQTT: Broker 位址、連接埠、認證資訊
  - FTP: 伺服器位址、認證資訊、傳輸模式
- 檢查網路連線狀態
- 確認防火牆設定
- 查看應用程式日誌以獲取詳細錯誤信息

## 開發說明
- 建議使用 Visual Studio Code 進行開發
- 支援熱重載開發模式：`npm run dev`
- 打包發布：`npm run build`

## 授權說明
本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 文件