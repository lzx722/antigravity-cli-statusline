# Antigravity CLI 状态栏定制技能 (Statusline Skill)

[![版本](https://img.shields.io/badge/版本-1.7.0-blue.svg)](skills/antigravity-cli-statusline/SKILL.md)
[![开源协议: MIT](https://img.shields.io/badge/协议-MIT-yellow.svg)](LICENSE)
[![支持平台](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

**简体中文** | [繁體中文](README.zh-TW.md) | [English](README.en.md)

一个专为 **Google Antigravity CLI (`agy`)** 打造的跨平台多语言底部状态栏（Footer）定制技能 —— 支持按需勾选指标、自由排序与多行排版、内置动态彩色进度条与 Emoji 图标。

> **Fork 说明与改造特性**：
> 本仓库基于上游项目 [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline) 进行深度体验升级，主要包含以下增强：
> 1. 🎨 **免装字体的通用 Emoji 图标**：每个指标搭配直观 Emoji（🤖、⚡、⏳、📚、🌿、📝、💻 等），无需配置 Nerd Fonts，任何终端均不乱码。
> 2. 📊 **动态彩色进度条**：为 5 小时配额、每周配额及上下文（Context）用量添加可视化进度条 `[█████░] 85%`，颜色随用量智能联动。
> 3. 🌐 **原生简体中文（`zh-cn`）支持**：全面适配大陆技术习惯用语（上下文、内存、Token、工件等），并在交互配置向导中首选推荐。
> 4. 📐 **精准终端宽度自适应折行**：优化 Unicode 宽字符与 Emoji 宽度计算，自动排版防溢出。

---

## 效果预览

```text
🤖 Gemini 3.7 Flash (High) │ ⚡ 5h配额: [█████░] 75% │ ⏳ 5h重置: 2h 44m │ 📚 上下文: [░░░░░░] 0.0% │ 🌿 Git: main
📝 工作区: ✗ 有变更 │ 💻 内存: 42MB
```

---

## 安装与使用

### 1. 前置环境要求

- **Node.js**（必需）：渲染脚本为纯 `.mjs`，依赖 Node.js 执行。技能在配置前会自动预检。
- **Git**（可选）：若需要显示 Git 分支名与工作区干净状态。

---

### 2. 安装步骤

#### 步骤 A：安装插件（Plugin）

在你的终端（Terminal / PowerShell）中运行：

```bash
agy plugin install https://github.com/lzx722/antigravity-cli-statusline
```

> CLI 会自动将插件下载部署至 `~/.gemini/antigravity-cli/plugins/antigravity-cli-statusline/`。

#### 步骤 B：在 CLI 中触发配置向导

启动 `agy` 进入交互会话后，在输入框中输入斜杠命令：

```text
/antigravity-cli-statusline
```

根据弹出的三步交互向导完成配置：
1. **选择语言**：选择 `简体中文 (zh-cn)`、`繁體中文 (zh-tw)`、`English (us)` 或 `日本語 (jp)`。
2. **勾选指标**：勾选你关心想展示的指标（如配额、模型、Git、上下文等）。
3. **排序与换行**：
   - 直接选择 `Skip` 保留所选顺序；
   - 或输入序号自定义排序与换行，例如 `1,2,n,3,4`（其中 `n` 表示换行）。

配置完成后**即时热更新生效**，无需重启 CLI。

---

## 支持展示的指标清单

**AI 模型与 Agent**
- **当前 AI 模型名称 (`model-name`)**
- **使用中的 Agent 角色 (`agent-profile`)**
- **Agent 当前运行状态 (`agent-state`)**：`idle / thinking / working / tool_use / initializing`
- **当前 CLI 运行模式 (`mode`)**：`default / code-only / plan / interactive / accept-edits`

**配额与 Token**
- **5 小时 API 可用配额百分比与进度条 (`quota`)**
- **5 小时配额重置时间倒计时 (`quota-reset-countdown`)**
- **每周 API 可用配额百分比与进度条 (`quota-weekly`)**
- **每周配额重置时间倒计时 (`quota-weekly-countdown`)**
- **会话上下文（Context）用量比例与进度条 (`context-used`)**
- **当前会话精确 Token 消耗 (`token-count`)**
- **本次会话 AI 累计产出的工件/文件数 (`artifacts`)**
- **账号订阅方案等级 (`plan-tier`)**

**交互与任务**
- **是否有等待确认的工具对话框 (`tool-confirmation`)**
- **队列中待处理的用户输入数 (`pending-input`)**
- **运行中的后台任务数 (`background-tasks`)**
- **活跃子代理数 (`subagents`)**

**项目与版本控制 (VCS)**
- **当前工作区项目短路径 (`project-path`)**
- **当前工作区项目完整绝对路径 (`project-full-path`)**
- **版本控制类型 (`vcs-type`)**：`git / jj / fig`
- **当前工作区的 Git 分支 (`git-branch`)**
- **工作区是否有未提交变更 (`vcs-dirty`)**：`dirty / clean`

**系统与账号**
- **CLI 进程消耗的内存用量 (`memory-usage`)**
- **Antigravity CLI 版本号 (`cli-version`)**
- **当前会话 ID (`conversation-id`)**：前 8 位短码
- **沙盒模式状态 (`sandbox-status`)**：`off / on (net) / on (no-net)`
- **账号邮箱 (`account-email`)**

---

## 卸载与重新安装

如需卸载或重新安装本插件，请在终端执行：

```bash
# 1. 卸载旧插件
agy plugin uninstall antigravity-cli-statusline

# 2. 重新安装本插件
agy plugin install https://github.com/lzx722/antigravity-cli-statusline --force

# 3. 进入 agy CLI 重新配置
/antigravity-cli-statusline
```

---

## 致谢 (Acknowledgements)

- 感谢 [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline) 提供的健壮跨平台 Node.js 架构与三层配置安全管理设计。
- 感谢 [60ke/antigravity-statusline](https://github.com/60ke/antigravity-statusline) 为状态栏配额监控带来的最初灵感。

---

## 开源协议 (License)

本项目采用 [MIT 许可证](LICENSE) 开源。
