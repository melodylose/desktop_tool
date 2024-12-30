# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-12-30

### Added
- FTP 歷史記錄功能
  - 新增最近連接的 FTP 伺服器記錄
  - 支援最多保存 10 筆歷史記錄
  - 提供快速連接歷史記錄功能

### Changed
- 改進 FTP 連接介面
  - 優化連接按鈕狀態顯示
  - 新增連接中狀態指示
  - 改進錯誤處理機制

### Fixed
- 修復 FTP 連接相關問題
  - 改進連接狀態管理
  - 優化錯誤提示訊息
  - 修復 DOM 元素初始化檢查

## [1.1.0] - 2024-12-26

### Added
- FTP 檔案傳輸功能
  - 支援檔案下載功能
    - 可選擇多個檔案同時下載
    - 顯示下載進度條
    - 自動處理重複檔名
  - 支援目錄導航功能
    - 可點擊目錄進入子目錄
    - 提供返回上層目錄選項
  - 檔案選擇功能
    - 支援檔案多選
    - 提供全選/取消全選功能
    - 自動禁用目錄選擇

### Changed
- 改進檔案列表顯示
  - 顯示檔案大小和修改時間
  - 區分檔案和目錄圖示
  - 優化目錄導航體驗
- 改進下載功能
  - 序列化檔案下載，避免並發錯誤
  - 精確的下載進度顯示
  - 清晰的下載結果通知
- 代碼重構
  - 模組化檔案列表顯示邏輯
  - 優化下載進度追蹤機制
  - 提升代碼可維護性

### Fixed
- 修復多檔案下載時的並發問題
- 修復進度條顯示超過 100% 的問題
- 修復目錄選擇和全選功能的衝突

## [1.0.0] - 2024-12-25

### Added
- Modbus TCP 協議支援
- MQTT 協議支援
- 基本 FTP 連接功能