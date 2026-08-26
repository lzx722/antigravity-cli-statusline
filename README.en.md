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
- **Current AI model name (`model-name`)**: e.g. `🤖 Gemini 3.7 Flash (High)`
- **Active agent profile (`agent-profile`)**: e.g. `🎭 Default`
- **Agent state (`agent-state`)**: e.g. `⚙️ idle` / `⚙️ thinking` / `⚙️ working` / `⚙️ tool use`
- **Current CLI run mode (`mode`)**: e.g. `🎯 Default Mode`

**Quota & Tokens**
- **Account API available quota with progress bar (`quota`)**: e.g. `⚡ [████░░] 62%`
- **API quota & reset countdown (combined) (`quota-reset-countdown`)**: e.g. `⚡ [████░░] 62% (⏳1h 49m)`
- **Weekly API quota with progress bar (`quota-weekly`)**: e.g. `📅 [███░░░] 57%`
- **Weekly API quota & reset countdown (combined) (`quota-weekly-countdown`)**: e.g. `📅 [███░░░] 57% (⏳2d 19h)`
- **Context window usage with progress bar (`context-used`)**: e.g. `📚 [░░░░░░] 0.0%`
- **Session token count (`token-count`)**: e.g. `🪙 0 / 1.0M`
- **Cumulative AI artifacts (`artifacts`)**: e.g. `📦 0 artifacts`
- **Account plan tier (`plan-tier`)**: e.g. `👑 Google AI Pro`

**Interactive State**
- **Pending tool confirmation (`tool-confirmation`)**: e.g. `🔔 ready` / `🔔 waiting`
- **Pending user input queue (`pending-input`)**: e.g. `📥 0 queued`
- **Running background tasks (`background-tasks`)**: e.g. `🔄 0 bg tasks`
- **Active subagents (`subagents`)**: e.g. `👥 0 subagents`

**Project & VCS**
- **Project short path (`project-path`)**: e.g. `📁 my-awesome-project`
- **Project full path (`project-full-path`)**: e.g. `📁 /path/to/my-awesome-project`
- **VCS type (`vcs-type`)**: e.g. `🗂️ git`
- **Current Git branch (`git-branch`)**: e.g. `🌿 main`
- **Working tree status (`vcs-dirty`)**: e.g. `📝 ✗ dirty` / `📝 ✓ clean`

**System & Account**
- **CLI RAM usage (`memory-usage`)**: e.g. `💻 266MB`
- **Antigravity CLI version (`cli-version`)**: e.g. `🏷️ v1.7.0`
- **Conversation ID (`conversation-id`)**: e.g. `💬 12e57f8e`
- **Sandbox mode (`sandbox-status`)**: e.g. `🛡️ sandbox off` / `🛡️ sandbox on (net)`
- **Account email (`account-email`)**: e.g. `👤 user@example.com`

---

## Acknowledgements

- Special thanks to [AndyAWD/antigravity-cli-statusline](https://github.com/AndyAWD/antigravity-cli-statusline) for the robust cross-platform Node.js implementation and multi-layer configuration architecture.
- Special thanks to [60ke/antigravity-statusline](https://github.com/60ke/antigravity-statusline) for the original quota monitoring inspiration.

---

## License

This project is licensed under the [MIT License](LICENSE).
