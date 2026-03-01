# WMPFDebugger-auto

## 📖 项目简介
本项目是基于 [gugugudo/WMPFDebugger](https://github.com/gugugudo/WMPFDebugger) 的二次修改版本，而后者又源自 [evi0s/WMPFDebugger](https://github.com/evi0s/WMPFDebugger)。此版本专门针对**QQ农场游戏Code抓取**需求进行了深度定制，通过内置断点调试功能，简化了抓取流程。你只需要在调试时输入一行特定代码即可启用完整的调试支持。

## ✨ 主要特性
- **一键调试支持**：内置断点，输入 `t.isPlatfromSupport = function(){return true}` 即可启用
- **QQ农场专版**：针对QQ农场游戏优化，快速抓取游戏Code
- **美化UI界面**：重新设计的桌面版界面，操作更直观
- **简化流程**：无需复杂配置，开箱即用
- **兼容性强**：支持微信版本4.x及以上
Releases：[最早版下载](https://github.com/SuperNaiBA/WMPFDebugger-auto/releases/tag/%3Cversion%3E%60v1.0.0)


## 🚀 快速开始

### 环境要求
- Windows 操作系统
- 微信PC版（推荐使用包含 **4.1.1.19**WMPF：18787** 版本的微信安装包：[下载链接](https://dldir1v6.qq.com/weixin/Universal/Windows/WeChatWin.exe)）
- Node.js 环境

你可以在 `src/index.ts` 中修改 `CDP_PORT`（默认为62000）来更换端口。

5. **开始调试**：现在你可以使用完整的Chrome开发者工具功能来分析和抓取QQ农场的游戏Code。

## 🎥 视频教程
详细的电脑微信抓CODE操作流程，请参考B站教程视频：[电脑微信抓CODE教程](https://www.bilibili.com/video/BV1g1f4BCE8e/)

## 🔧 高级配置与适配

### 版本检查与升级
- **检查已安装的WMPF版本**：在任务管理器中找到 `WeChatAppEx` 进程 -> 右键 -> 打开文件位置 -> 查看 `RadiumWMPF` 和 `extracted` 之间的数字。
− 支持的 WMPF 版本：

* 18891 (最新, credit @1357310795)
* 18787
* 18151 (credit @1437649480, @zxjBigPower)
* 18055 (credit @Howard20181)
* 17127 (credit @Howard20181)
* 17071 (credit @hyzaw)
- **适配其他版本**：请参考项目内的 `ADAPTATION.md` 文件说明。你也可以提交新版本适配的Issue（通常只考虑较新版本的适配请求）。

### 微信版本与WMPF升级
- **微信版本 > 4.x**：从 [pc.weixin.qq.com](https://pc.weixin.qq.com) 下载最新的微信安装程序，最新的WMPF捆绑包已包含在安装程序中。
- **微信版本 < 4.x**：在微信搜索框中输入 `showcmdwnd`（不要按回车），命令窗口弹出后输入 `/plugin set_grayvalue=202&check_update_force` 并按回车。如果有可用更新，最新的WMPF插件将被下载。重启微信以应用插件升级。

## ⚠️ 重要注意事项
1. **操作顺序至关重要**：务必遵循“启动服务器 → 打开小程序 → 输入调试代码”的顺序，否则可能导致连接失败。
2. **免责声明**：本程序按“原样”提供，不附带任何明示或暗示的担保。使用本软件所产生的所有风险由您自行承担。在适用法律允许的最大范围内，版权持有人或其他方均不对因使用或无法使用本程序导致的任何损失或损害承担责任。
3. **版权说明**：`src/third-party` 目录中的代码提取自 `wechatdevtools`，版权归腾讯控股有限公司所有。
4. **学习交流用途**：本工具旨在用于技术学习与交流，请遵守相关法律法规和平台使用规范。

## 📄 许可证
本项目基于原WMPFDebugger项目修改，遵循原项目的许可证条款。

## 🙏 致谢
- 原始项目：[evi0s/WMPFDebugger](https://github.com/evi0s/WMPFDebugger)
- 二次修改基础：[gugugudo/WMPFDebugger](https://github.com/gugugudo/WMPFDebugger)
- 所有为本项目提供反馈与贡献的开发者

---

**Happy Debugging! 祝您顺利抓取到所需的Code！**
界面如下：
<img width="786" height="593" alt="image" src="https://github.com/user-attachments/assets/02ade94d-4efd-45cf-ae7e-f57a69227f1a" />

<img width="786" height="593" alt="image" src="https://github.com/user-attachments/assets/be1ad89d-fbf3-4eae-9152-124d3aa6ec31" />
