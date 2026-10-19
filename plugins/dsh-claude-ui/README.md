# dsh-claude-ui

把 DSH 的界面结构和交互改成 Claude 桌面版的样子。配色和字体在 [`dsh-claude-theme`](../dsh-claude-theme)，两个一起装效果最好。

纯浏览器端插件（宿主半边 `index.js` 为空）。组件通过 DSH 公开的 slot 注册，用更低的 `priority` 遮蔽原生条目；少数不是 slot 的地方（运行状态行、设置窗口）在 DOM 出现时就地增强。

## 功能与用法

### 侧栏
- 去掉左上角 deepseek HARNESS 大 Logo，换成搜索框（点击即打开 DSH 自带的会话搜索）。
- 行高 28px，「新会话」前加圆形「+」，隐藏空的「工作区」标签。

### 会话顶栏
- 高度 44px，右侧工具按钮：**概览**（开关右侧概览栏）、**轨迹**、**终端**、**浏览器**、**文件**。

### 输入框
- 单行紧凑布局；附件（图片）单独占一行，图片多时不会把文字挤掉。
- 底栏左右两组用 CSS anchor positioning 对齐，不再互相重叠。
- 原生的缓存命中 / 用量药丸移到右侧概览栏。

### 模型切换器（替换原生 `conversation.input.model`）
- 点开：顶部**搜索框**，下面是**服务商列表**（显示模型数量，当前模型所在服务商有橙色小点），底部固定**推理强度**。
- 鼠标移到服务商：旁边展开该服务商的模型，点击即切换；右侧放不下时向左展开。
- 搜索框输入文字：直接按服务商分组列出所有匹配的模型。
- 斜着划向子菜单时有 140ms 防误切延迟。

### 额度小圆圈（模型名右侧）
选中下面这些模型时出现，其他模型不显示：

| 当前模型 | 圆圈 | 点开后 | 数据来源（需安装对应插件） |
|---|---|---|---|
| Codex（provider `codex`） | 已用比例进度环，70% 变黄、90% 变红 | 5 小时 / 每周限额进度条和重置时间 | `dsh-llm-codex` 的 `codex-subscription` 接口 |
| OpenCode Go（provider `opencode-go`） | 同上 | 5 小时滚动 / 本周 / 本月进度条 | `dsh-llm-opencode` 的 `opencode-go-usage` 接口 |
| Jet Hub 渠道（CodeBuddy、Qoder、TRAE、jet-hub-auto、聚合等） | 黄色圈（不画进度） | 可用积分合计、套餐剩余、各账号积分、临期积分 | `dsh-providers-hub` 的 `usage.badge` 接口 |
| IDE BYOK 里的 `JetHub/*` 模型 | 黄色圈 | 积分合计与各账号 | [`dsh-byok-dashboard`](../dsh-byok-dashboard) |

- 右上角刷新按钮会强制重新拉取；平时每 60 秒在页面可见时自动刷新。
- 圆圈和模型菜单互斥：打开一个会自动关掉另一个。
- 装了本插件后，Jet Hub 和 byok-dashboard 原来的积分胶囊会被隐藏（数据合并进圆圈）。

### 右侧概览栏
- 右栏标签「概览」，卡片：**环境**（本机 / 工作区 / 当前模型）、**Token 用量**（缓存命中率、未缓存输入 / 缓存读取 / 输出）、**上下文**（占用比例与分项）、**会话统计**（轮次 / 步数、模型用时、工具用时、首 token、输出速度）、**产出**（本会话改动过的文件）。
- 每张卡片可以**拖动标题**单独排序，点标题**折叠**；顺序和折叠状态存在浏览器 localStorage。
- 右栏宽度会收窄到 300px。

### 运行状态行
- 把原生的「深度求索中，用时 …」换成 Claude 式的 `••• 1m 7s · 442 tokens · 正在分析请求`：用时、本轮输出 token、当前步骤名称（最多 16 字，单行省略）。

### 思考与步骤折叠
- 配合 DSH「设置 → 工作步骤展示 → 标准」：步骤组标题加运行中的跳动圆点、尾部折叠箭头、展开内容带边框，工具调用次数显示为「· N 次工具调用」。

### 设置窗口
- 放大成接近整窗的面板（最大 1600px 宽），左栏 264px，顶部有「**搜索设置**」框，按名称筛选左侧项目，回车打开第一个匹配项。
- 「账号与余额」页：在余额卡片下面**直接嵌入开放平台的用量页**（桌面版专有，走 DSH 自己的 `window.dshPlatform` 原生子视图）。切到其他设置项或关闭设置窗口时自动关闭。注意原生子视图总在最上层，弹到这块区域上的菜单会被挡住。

### 动画
- 菜单、弹窗、按钮、卡片等出现和交互都有过渡动画。

## 使用的 slot

`conversation.input.model`、`conversation.composer.dock`、`conversation.session.header.utilities`、`conversation.chat.turnTail`、`sidebar.brand.mark`、`sidebar.brand.name`、`sidebar.right.pane.tab`、`sidebar.right.pane.tab.title`。

## 已知限制

- 部分样式绑定了 DSH 当前版本的 CSS 模块类名（如 `RlGAzG_`、`WW4l1q_`、`Dc7zOa_`），DSH 升级后可能需要更新选择器。
- 运行状态行、设置窗口、用量嵌入不是 slot，靠 DOM 观察实现。
