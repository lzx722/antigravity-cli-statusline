# Antigravity CLI 狀態列設定技能

[![版本](https://img.shields.io/badge/版本-1.7.0-blue.svg)](skills/antigravity-cli-statusline/SKILL.md)
[![授權條款: MIT](https://img.shields.io/badge/授權條款-MIT-yellow.svg)](LICENSE)
[![平台](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

[简体中文](README.md) | **繁體中文** | [English](README.en.md)

一個多語系、跨平台的技能，用來客製化 Antigravity CLI 狀態列（Footer）——精準勾選想顯示的指標、自由排序、動態彩色進度條與 Emoji 圖示支援，並內建智慧型換行。

> **Fork 說明與改造特性**：
> 本專案為 [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline) 之體驗增強分支：
> 1. 🎨 **免裝字體的通用 Emoji 圖示**：各指標搭配直觀 Emoji（🤖、⚡、⏳、📚、🌿、📝、💻 等），無需安裝 Nerd Fonts，任何終端機皆不亂碼。
> 2. 📊 **動態彩色進度條**：為 5 小時額度、每週額度及脈絡（Context）用量加入視覺化進度條 `[█████░] 85%`，色彩即時聯動。
> 3. 🌐 **原生簡體中文（`zh-cn`）與繁體中文（`zh-tw`）雙支援**：完整覆蓋繁簡用語習慣。
> 4. 📐 **精準終端機寬度自適應折行**：針對 Unicode 寬字元與 Emoji 精確計算寬度，排版更美觀。

---

## 實際畫面

### Windows

| 繁體中文 (zh-tw) | English (us) | 日本語 (jp) |
| :---: | :---: | :---: |
| ![繁體中文](docs/images/agy-cli-statusline-windows-zhtw.png) | ![English](docs/images/agy-cli-statusline-windows-us.png) | ![日本語](docs/images/agy-cli-statusline-windows-jp.png) |

### macOS

| 繁體中文 (zh-tw) | English (us) | 日本語 (jp) |
| :---: | :---: | :---: |
| ![繁體中文](docs/images/agy-cli-statusline-macos-zhtw.png) | ![English](docs/images/agy-cli-statusline-macos-us.png) | ![日本語](docs/images/agy-cli-statusline-macos-jp.png) |

---

## 安裝

### 環境需求

- **Node.js**（必要）：渲染腳本以純 `.mjs` 撰寫；若缺失，狀態列會空白並被 `agy` 在反覆失敗後自動停用。技能會在寫入設定前先預檢。
- **Git**（選用）：用於顯示 `git-branch`、`vcs-dirty`、`vcs-type` 指標。

### 步驟 A：安裝外掛

```bash
agy plugin install https://github.com/lzx722/antigravity-cli-statusline
```

> CLI 會把 bundle stage 至 `~/.gemini/antigravity-cli/plugins/antigravity-cli-statusline/`。

### 步驟 B：觸發 Skill 完成設定

在 Antigravity CLI 提示字元輸入：

```text
/antigravity-cli-statusline
```

技能會引導你選擇語系（`zh-cn` / `zh-tw` / `us` / `jp`）、勾選指標、排序，並把渲染腳本部署到位、寫入三層 `settings.json`。狀態列**熱更新立即生效**，無需重啟 CLI。

---

## 指標、排序與換行

### 可顯示的指標

**AI 模型與代理**
- **目前使用的 AI 模型名稱（`model-name`）**：如 `🤖 Gemini 3.7 Flash (High)`
- **使用中代理（`agent-profile`）**：如 `🎭 預設角色`
- **代理當前狀態（`agent-state`）**：如 `⚙️ 閒置` / `⚙️ 思考中` / `⚙️ 工作中` / `⚙️ 工具呼叫中`
- **目前 CLI 運行模式（`mode`）**：如 `🎯 Default 模式`

**額度與 Token**
- **帳號 5 小時 API 可用額度與進度條（`quota`）**：如 `⚡ [████░░] 62%`
- **5 小時 API 額度與重置倒數合併（`quota-reset-countdown`）**：如 `⚡ [████░░] 62%（⏳1h 49m）`
- **帳號每週 API 可用額度與進度條（`quota-weekly`）**：如 `📅 [███░░░] 57%`
- **每週 API 額度與重置倒數合併（`quota-weekly-countdown`）**：如 `📅 [███░░░] 57%（⏳2d 19h）`
- **目前對話已消耗的脈絡比例與進度條（`context-used`）**：如 `📚 [░░░░░░] 0.0%`
- **目前 Session 消耗的精確 Token 數量（`token-count`）**：如 `🪙 0 / 1.0M`
- **本次對話 AI 累計產出的工件數（`artifacts`）**：如 `📦 0 工件數`
- **目前訂閱方案等級（`plan-tier`）**：如 `👑 Google AI Pro`

**互動狀態**
- **等你回應的工具確認對話方塊（Dialog Box）（`tool-confirmation`）**：如 `🔔 都好了` / `🔔 在等你`
- **佇列中待處理的使用者輸入數（`pending-input`）**：如 `📥 0 待處理輸入`
- **進行中的背景任務數（`background-tasks`）**：如 `🔄 0 背景任務`
- **活躍子代理數（`subagents`）**：如 `👥 0 子代理`

**專案與版控**
- **目前工作區專案短路徑（`project-path`）**：如 `📁 my-awesome-project`
- **目前工作區專案完整路徑（`project-full-path`）**：如 `📁 /path/to/my-awesome-project`
- **版本控制類型（`vcs-type`）**：如 `🗂️ git`
- **目前工作區的 Git 分支（`git-branch`）**：如 `🌿 main`
- **工作區是否有未提交變更（`vcs-dirty`）**：如 `📝 ✗ 工作區有變更` / `📝 ✓ 工作區乾淨`

**系統與帳號**
- **CLI 行程所消耗的 RAM 記憶體量（`memory-usage`）**：如 `💻 266MB`
- **Antigravity CLI 版本號（`cli-version`）**：如 `🏷️ v1.7.0`
- **目前對話 ID 前 8 碼（`conversation-id`）**：如 `💬 12e57f8e`
- **沙盒模式狀態（`sandbox-status`）**：如 `🛡️ 沙盒關閉` / `🛡️ 沙盒啟用 (聯網)`
- **帳號電子郵件（`account-email`）**：如 `👤 user@example.com`

---

### 排序

在技能流程第三階段（步驟 4），於 Write-in 輸入框填入以逗號分隔的序號即可自訂排序：

```text
2,5,1
```

- 數字 = 步驟 3 勾選清單中的序號（從 1 起算）
- 也可混用英文識別碼（如 `quota`、`model-name`），但用數字最直觀
- **未提及的指標會被剔除**——排序結果即為最終顯示集合
- 若留白或選擇 `(Recommended) 略過` 就會沿用勾選順序、顯示全部勾選的指標

### 換行

兩種機制並存：

1. **自動智慧折行**：渲染腳本會讀取終端機寬度，當下一個指標會超出時自動折到下一行，無需任何設定。
2. **強制換行**：在排序字串中插入 `n` token 即可在指定位置強制折行，可重複使用：

```text
1,2,n,3,4
```

（若步驟 3 勾選了 4 個指標，此例會把 1、2 顯示在第一行，並強制把 3、4 折到第二行。）

### 動態色彩

採用 24-bit truecolor 四階柔和配色（藍 → 綠 → 黃 → 粉紅），依 API 額度或 Context 消耗比例變色；不同 AI 模型家族也會套用專屬的品牌識別色。

---

## 卸載與重新安裝

若欲卸載或重新安裝本外掛，請於終端機執行：

```bash
# 1. 卸載舊版外掛
agy plugin uninstall antigravity-cli-statusline

# 2. 重新安裝本外掛
agy plugin install https://github.com/lzx722/antigravity-cli-statusline --force

# 3. 進入 agy CLI 重新設定
/antigravity-cli-statusline
```

---

## 鳴謝

- 特別感謝 [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline) 專案提供穩健的跨平台 Node.js 架構與多層設定檔管理機制。
- 特別感謝 [60ke/antigravity-statusline](https://github.com/60ke/antigravity-statusline) 專案為狀態列額度監控帶來的最初靈感。

---

## 授權條款

本專案採用 [MIT License](LICENSE) 授權。
