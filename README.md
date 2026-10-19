# Claudestyle-for-DeepSeekHarness

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）桌面版改成 Claude 桌面版风格的一组插件。全部通过 DSH 公开的插件机制（Cordis 插件 + 客户端 slot）实现，**不修改 DSH 安装目录里的任何文件**，卸载即恢复原样。

在 DSH `0.2.1-rc.2`（Windows 桌面版）上开发和验证。

| 插件 | 作用 | 依赖 |
|---|---|---|
| [`dsh-claude-theme`](plugins/dsh-claude-theme) | 配色、字体、正文排版（标题 / 段距 / 表格 / 行内代码） | 无 |
| [`dsh-claude-ui`](plugins/dsh-claude-ui) | 界面结构与交互：侧栏、顶栏、输入框、模型切换器、额度圆圈、右侧概览栏、运行状态行、步骤折叠、设置窗口、动画 | 建议与 `dsh-claude-theme` 一起装 |
| [`dsh-byok-dashboard`](plugins/dsh-byok-dashboard) | 读取本机 IDE BYOK 的账号池额度，供额度圆圈显示 | 需要本机运行 IDE BYOK；不用 IDE BYOK 可以不装 |

## 安装

1. 克隆仓库（路径随意，下面以 `D:\Claudestyle` 为例）：

   ```bash
   git clone https://github.com/BanCN-Re/Claudestyle-for-DeepSeekHarness.git D:/Claudestyle
   ```

2. 用 DSH 自带的命令行把插件链接进桌面版配置（`desktop` 是桌面版默认的 profile 名）。`dsh.cmd` 在 DSH 安装目录的 `resources\runtime\cli\bin\` 下：

   ```bash
   "<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add "link:D:/Claudestyle/plugins/dsh-claude-theme"
   "<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add "link:D:/Claudestyle/plugins/dsh-claude-ui"
   # 可选：用 IDE BYOK 的才需要
   "<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add "link:D:/Claudestyle/plugins/dsh-byok-dashboard"
   ```

   每个包都带 `dsh.bundle.patch`，`add` 时会自动加进 profile 的 bundles，不用手改配置。

3. 字体（可选但推荐）：见 [`plugins/dsh-claude-theme/fonts/README.md`](plugins/dsh-claude-theme/fonts/README.md)。字体文件**不随仓库分发**。

4. 完全退出并重启 DSH。

5. 建议在 DSH「设置 → 通用设置 → 工作步骤展示」选「标准」，步骤折叠的样式就是按这个模式做的。

`link:` 安装的好处是：`git pull` 更新后重启 DSH 就生效，不用重新 add。

## 卸载

```bash
"<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop remove dsh-claude-ui
"<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop remove dsh-claude-theme
"<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop remove dsh-byok-dashboard
```

重启 DSH 即恢复原生界面。

## 关于 DSH 升级

DSH 的界面用的是带哈希前缀的 CSS 模块类名（如 `BynINW_centerCol`），**每次升级都可能变**。这里的样式尽量按 slot 名（`[data-slot=…]`）、`role`、类名后缀（`[class*="_navList"]`）定位来减少影响，但个别地方仍然绑定了具体类名。升级后哪里样式掉了，按新版本的类名更新对应选择器即可。

## 许可

MIT。`dsh-byok-dashboard` 由 ZCode 的 byok-dashboard 插件迁移而来，保留其原 LICENSE。
