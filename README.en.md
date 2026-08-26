# Antigravity CLI Statusline Skill

[![Version](https://img.shields.io/badge/version-1.7.0-blue.svg)](skills/antigravity-cli-statusline/SKILL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | English

A multilingual, cross-platform skill that customizes the Antigravity CLI statusline (footer) with Emoji icons, visual progress bars, Simplified Chinese support, and smart line wrapping.

> **Fork Note**: This repository is a customized fork of [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline). It introduces universal Emoji icons (no special font required), dynamic colored progress bars for quota & context, and native Simplified Chinese (`zh-cn`) localization.

---

## Key Features & Custom Enhancements

- 🎨 **Universal Emoji Icons**: Out-of-the-box clean icons (🤖, ⚡, ⏳, 📚, 🌿, 📝, 💻, etc.) without requiring Nerd Fonts.
- 📊 **Visual Progress Bars**: Dynamic colored progress bars (`[█████░] 85%`) for hourly quota, weekly quota, and context usage.
- 🌐 **Native Simplified Chinese (`zh-cn`)**: Full mainland Chinese terminology support alongside Traditional Chinese (`zh-tw`), English (`us`), and Japanese (`jp`).
- 🔄 **Smart Line Wrapping**: Automatic terminal width detection with emoji/wide character compensation.

---

## Installation

### Prerequisites

- **Node.js** (required) — The renderer scripts are pure `.mjs`. The skill pre-checks this for you.
- **Git** (optional) — Needed for `git-branch`, `vcs-dirty`, and `vcs-type` indicators.

### Step A — Install the plugin

```bash
agy plugin install https://github.com/lzx722/antigravity-cli-statusline
```

### Step B — Trigger the skill to finish setup

In the Antigravity CLI prompt, type:

```text
/antigravity-cli-statusline
```

The skill walks you through language selection (`zh-cn` / `zh-tw` / `us` / `jp`), indicator picking, and sorting, then deploys the renderer scripts and writes the three-layer `settings.json`. The statusline updates **live without a CLI restart**.

---

## Available Indicators

**AI Model & Agent**
- **Current AI model name (`model-name`)**
- **Active agent profile (`agent-profile`)**
- **Agent state (`agent-state`)**
- **Current CLI run mode (`mode`)**

**Quota & Tokens**
- **Account API available quota with progress bar (`quota`)**
- **API reset countdown (`quota-reset-countdown`)**
- **Weekly API quota with progress bar (`quota-weekly`)**
- **Weekly API reset countdown (`quota-weekly-countdown`)**
- **Context window usage with progress bar (`context-used`)**
- **Session token count (`token-count`)**
- **Cumulative AI artifacts (`artifacts`)**
- **Account plan tier (`plan-tier`)**

**Interactive State**
- **Pending tool confirmation (`tool-confirmation`)**
- **Pending user input queue (`pending-input`)**
- **Running background tasks (`background-tasks`)**
- **Active subagents (`subagents`)**

**Project & VCS**
- **Project short path (`project-path`)**
- **Project full path (`project-full-path`)**
- **VCS type (`vcs-type`)**
- **Current Git branch (`git-branch`)**
- **Working tree status (`vcs-dirty`)**

**System & Account**
- **CLI RAM usage (`memory-usage`)**
- **Antigravity CLI version (`cli-version`)**
- **Conversation ID (`conversation-id`)**
- **Sandbox mode (`sandbox-status`)**
- **Account email (`account-email`)**

---

## Acknowledgements

- Special thanks to [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline) for the robust cross-platform Node.js implementation and multi-layer configuration architecture.
- Special thanks to [60ke/antigravity-statusline](https://github.com/60ke/antigravity-statusline) for the original quota monitoring inspiration.

---

## License

This project is licensed under the [MIT License](LICENSE).
