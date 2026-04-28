

## 💡 项目初衷 (Why build this?)

当开发者在使用 [Claude Code](https://github.com/anthropics/claude-code) 或 [OpenAI Codex CLI](https://github.com/openai/codex) 时，经常会遇到官方网络不稳定，或者需要使用第三方中转 API。

但对于不熟悉终端命令或不知道怎么修改 `.zshrc` 环境变量的用户来说，来回修改环境变量是极其痛苦的。

本项目就是为了解决这个痛点而生：**让任何人都能通过极客风的图形界面，一键保存多个 API 配置，随时一键热更新到终端！**


<div align="center">
  <img src="./screenshot1.png" alt="API 配置切换器 - Claude 模式" width="80%" />
  <img src="./screenshot2.png" alt="API 配置切换器 - Codex 模式" width="80%" />
  
  # API 配置切换器 (C-code-switch)

  **一款极客风、支持一键热更新的 Claude Code + OpenAI Codex 双平台代理节点切换客户端**

  <p>
    <a href="https://github.com/zxs-ai/C-code-switch/releases">
      <img src="https://img.shields.io/badge/Platform-Mac%20%7C%20Win-blue.svg?style=flat-square" alt="Platform" />
    </a>
    <a href="https://github.com/zxs-ai/C-code-switch/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License" />
    </a>
  </p>

</div>

---

## ✨ 核心特性

- 🎨 **极客暗黑风 UI**: 精心调配的赛博朋克深色模式，符合开发者的直觉。
- 🔀 **双平台支持**: 同一界面管理 Claude Code (靛蓝) 和 Codex CLI (翠绿) 配置，颜色一目了然。
- ⚡️ **一键无缝切换**: 预存多个中转配置，鼠标一键自动写入 `~/.zshrc`，两个平台环境变量互不干扰。
- 🔄 **终端一键热更新**: 独家支持 AppleScript 控制功能，点一下「立即生效」，自动帮你打开的系统终端执行 `source ~/.zshrc`，立刻生效。
- 💾 **无感备份导入**: 无论换电脑还是重装，JSON一键导入导出，且每次切换自动存有「本地快照」，防手残。

## 🚀 下载与安装 (客户端)

本项目支持通过 **Electron** 直接打包成 Mac 和 Windows 的独立应用客户端！

你可以直接前往 [Releases 页面](https://github.com/zxs-ai/C-code-switch/releases) 下载打包好的 `Claude Code Switcher.dmg` (Mac) 或 `Claude Code Switcher Setup.exe` (Windows)。

或者你也可以在本地环境运行。

### 本地开发者环境运行

要求：已经安装 [Node.js](https://nodejs.org/)

```bash
# 1. 克隆仓库
git clone https://github.com/zxs-ai/C-code-switch.git
cd C-code-switch

# 2. 方式一：运行轻量级 Web 版
双击运行目录下的 `启动.command` 文件即可。

# 3. 方式二：运行 Electron 桌面级客户端
npm install
npm start
```

## 🛠 自己打包成独立客户端 (Mac/Windows)

如果你想自己生成独立的 App/Exe 客户端文件：

```bash
npm install

# 🍎 打包 Mac dmg
npm run build:mac

# 🪟 打包 Windows exe (请在 Windows 环境下运行)
npm run build:win
```

打包完成后，安装文件会生成在 `dist` 目录中。

## 📝 常见问题与需求留言

**Q: 为什么我点了立即生效，但 Cursor/VS Code 内置终端没变？**  
**A:** “立即生效”功能使用的是 macOS 原生的 AppleScript，它会操控你系统的 `Terminal (终端)` App。对于第三方编辑器的内置终端，你只需手动在终端里按下 `Ctrl+C`退出当前 claude，然后输入 `source ~/.zshrc && claude` 即可。

**Q: 如果我有更多的需求怎么办？**  
**A:** 本项目完全开源！如果你有任何需求或者遇到 Bug，非常欢迎提交 [Issues](https://github.com/zxs-ai/C-code-switch/issues)，你可以直接在仓库留言。

---

> **Open Source Project | by zxs © 2026**  
> GitHub Repository: [https://github.com/zxs-ai/C-code-switch](https://github.com/zxs-ai/C-code-switch)
