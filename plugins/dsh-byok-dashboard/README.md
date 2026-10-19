# dsh-byok-dashboard

把本机 **IDE BYOK** 的账号池额度接进 DSH。由 ZCode 的 `byok-dashboard` 插件迁移而来。

> IDE BYOK 是作者自用的本地工具，**未开源**。不使用 IDE BYOK 的话，这个插件装了也没有作用，可以不装。

## 它做什么

- 宿主半边（`index.js`）注册一个 DSH 接口 `/api/byok-dashboard`（RPC 方法 `quota`），浏览器端传入当前模型，它去本机 IDE BYOK 查询该模型所属渠道的账号池额度，整理后返回。
- 浏览器端（`client.js`）自带一个输入框下方的额度胶囊；**装了 [`dsh-claude-ui`](../dsh-claude-ui) 后胶囊会被隐藏**，同样的数据改由模型名右侧的额度小圆圈显示（点开看积分合计和各账号明细）。
- **只读**：不签到、不换号、不改任何设置。唯一的写操作是「刷新」时调用 IDE BYOK 已有的额度刷新接口。

## 工作原理

### 1. 找到 IDE BYOK

IDE BYOK 运行时会在它的安装目录写一个地址文件：

```
<IDE BYOK 目录>/data/desktop-address.json
```

```json
{ "address": "127.0.0.1:<端口>", "pid": 12345 }
```

插件每次查询时读这个文件拿端口。出于安全考虑，**只接受 `127.0.0.1` 回环地址**，地址里带用户名、密码或路径都会被拒绝。

IDE BYOK 目录按以下顺序确定：

1. profile 配置里给插件的 `byokHome`（见下方「配置」）；
2. 环境变量 `IDE_BYOK_HOME`；
3. 默认 `D:/Work/IDE BYOK`。

### 2. 判断当前模型属于哪个渠道（`lib/routing.mjs`）

按 DSH 当前选中模型的 **模型 id** 识别：

| 模型 id 形式 | 识别为 | 例子 |
|---|---|---|
| `jethub/<渠道>/<模型>`（不区分大小写） | IDE BYOK 的 JetHub 账号池 | `JetHub/trae/aquila`、`jethub/codebuddy/default-model` |
| `plugin:<插件id>:<渠道>/<模型>`，渠道是 `codex` / `antigravity` / `grok` / `doubao` | IDE BYOK 接入的订阅账号 | `plugin:xxx:codex/gpt-6` |
| `plugin:<含 jethub 的插件id>:<渠道>/<模型>` | JetHub 账号池 | |
| 其他 | 不支持，不显示 | |

`codebuddy` 渠道在 IDE BYOK 里叫 `buddy`，会自动换名。

IDE BYOK 会把自己的模型以一个 OpenAI 兼容 provider（DSH 里显示为「IDE BYOK」，id 一般是 `zcode-byok`）同步进 DSH，模型 id 就是上面这种 `JetHub/<渠道>/<模型>` 形式，所以在 DSH 里选中这些模型时插件就能识别。

### 3. 查询的 IDE BYOK 接口（`lib/byok.mjs`）

全部是 `http://127.0.0.1:<端口>/__byok-api__/api/` 下的本机接口，25 秒超时：

| 渠道类型 | 调用 | 用途 |
|---|---|---|
| JetHub | `POST jethub/api/jet-hub`，body：`{type:'client-request', method:'jet-hub', payload:{method:'usage.badge', payload:{provider, force}}}` | 各账号余额（积分 / Token） |
| JetHub | `GET jethub/providers` | 渠道显示名 |
| 订阅账号 | `GET plugins` | 各接入插件的账号与额度指标（百分比窗口等） |
| 订阅账号（刷新时） | `POST plugins/<插件id>/resources/<类型>/<账号id>/refresh` | 让 IDE BYOK 重新拉取额度 |

### 4. 缓存与容错

- 同一渠道 60 秒内重复查询直接用缓存；并发查询会合并成一次。
- 查询失败时如果有上一次成功的结果，返回它并标记为「过期」，不会把数字清空。
- Antigravity 渠道会按当前模型是 Gemini 还是 Claude 只显示对应的额度指标。

## 返回的数据

`quota` 方法返回 `{ supplier, quota }`，其中 `quota`：

```js
{
  status: 'ready' | 'stale' | 'error' | 'unsupported',
  provider: '渠道显示名',
  total: 39998.8,          // 账号池合计（只在单位一致时给出）
  unitLabel: '积分',        // 或 'Token' / '额度'
  partial: false,          // 有账号读不到时为 true
  disabledCount: 0,        // 停用账号数（不计入合计）
  accounts: [
    { id, name, state: 'ready' | 'error' | ..., error,
      metrics: [{ id, label, unit: 'count' | 'percent', value, resetAtMs }] }
  ],
  source: 'IDE BYOK · JetHub 账号池',
  updatedAt, cached
}
```

## 安装

```bash
"<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add "link:<仓库目录>/plugins/dsh-byok-dashboard"
```

然后完全退出并重启 DSH。使用前确保 IDE BYOK 正在运行（否则地址文件不存在或端口不通，圆圈里会显示「额度读取失败」）。

## 配置

IDE BYOK 不在默认目录时，二选一：

- 设置环境变量（需要在启动 DSH 的环境里生效）：

  ```bash
  setx IDE_BYOK_HOME "E:/Tools/IDE BYOK"
  ```

- 或者在 `~/.dsh/profiles/desktop/cordis.patch.yml` 里给插件加配置：

  ```yaml
  - id: byok-dashboard
    name: dsh-byok-dashboard
    config:
      byokHome: E:/Tools/IDE BYOK
  ```

## 图片输入

DSH 判断模型能不能发图片，看的是 provider 配置里每个模型的 `input` 字段（`[text, image]` 或 `[text]`）。IDE BYOK 同步模型到 DSH 时需要带上这个字段，否则视觉模型会提示「当前模型不支持图片」。这一点由 IDE BYOK 侧负责，本插件不涉及。

## 卸载

```bash
"<DSH 安装目录>/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop remove dsh-byok-dashboard
```
