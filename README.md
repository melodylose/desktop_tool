# 小工具

## 功能說明

這是一個基於 Electron 開發的桌面應用程式，具備以下功能：

- 支援 MQTT 通訊協議
- 整合 Modbus 通訊功能
- 使用 SQLite 資料庫進行本地資料儲存
- 系統通知功能
- 檔案系統操作功能

## 環境需求

### 必要條件
- Node.js v21.2.0
- npm (Node Package Manager)
- Windows/macOS/Linux 作業系統

### 相依套件
主要相依套件包含：
- Electron v27.1.0
- Bootstrap v5.3.3
- SQLite3
- MQTT Client
- Modbus Client
- 其他相依套件請參考 package.json

## 安裝與執行

1. 安裝相依套件：
```bash
npm install
```

2. 啟動應用程式：
```bash
npm run start
```

3. 打包應用程式：
```bash
npm run make
```

## 開發工具

- @electron-forge/cli - Electron 應用程式建置工具
- electron-log - 日誌記錄
- electron-simple-toast - 系統通知