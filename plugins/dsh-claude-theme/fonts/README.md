# 字体放这里

本插件期望这个目录里有下面三个文件（文件名必须一致）：

| 文件名 | 用途 |
|---|---|
| `AnthropicSansWebText.ttf` | 界面与正文 |
| `AnthropicSerifWebText.ttf` | 衬线（`--cui-font-serif`） |
| `AnthropicMonoVariable.ttf` | 代码 |

这些字体版权归 Anthropic，仓库**不提供**，请自行取得有合法授权的副本放进来，然后重启 DSH。

缺哪个文件，对应的字体就回退到系统字体（`Segoe UI` / `Microsoft YaHei` / `Consolas` 等），其余样式不受影响。

`.gitignore` 已忽略本目录下的字体文件，放进来也不会被误提交。
