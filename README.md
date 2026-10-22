# SillyTavern Presets for DeepSeek Harness

> 🤖 **AI 制作声明**：本插件的代码、中文文案与界面设计由 AI 编码助手（DeepSeek Harness Agent）生成，并由项目维护者完成测试、审核与发布。使用前请阅读 [限制与注意](#限制与注意)，并自行检查导入的预设内容。

把 SillyTavern 的 AI 预设（AI Response Configuration / Preset JSON）导入 DeepSeek Harness，作为可编辑、可切换、可持久保存的提示词层使用。每次导入都会保留，直到你在管理页主动删除。

## 功能

- 从 SillyTavern 预设 JSON 导入：自动读取 `prompts`、`prompt_order`、采样参数和宏变量。
- 多套预设共存：随时切换当前生效的预设，导入新预设不会覆盖旧预设。
- 完整编辑：名称、提示词内容、角色、启用状态、排序、prompt order 分组、`temperature`、`maxTokens`、`{{user}}` / `{{char}}` 宏。
- 保存 / 另存：编辑后保存到本地插件数据文件，或复制成新预设。
- 导出 / 再导入：导出为 SillyTavern 兼容的 JSON；可重新导入，形成可迁移的备份。
- 归档 / 恢复：归档后不再注入，但保留在磁盘上，可随时恢复。
- 删除：在编辑页点击 **删除预设**，二次确认后永久移除该预设；删除当前预设会立即停止注入。删除不可撤销。
- 预览：不调用模型，直接查看最终会注入 System Prompt 的文本和有效提示词数量。
- 全局开关：一键暂停该插件的提示词注入与采样参数覆盖。

## 安装

需要 DeepSeek Harness `>= 0.2.0-rc.2`。

### 从本地目录安装

在 DSH 的插件管理中安装本目录（包含 `cordis.patch.yml` 与 `dsh.bundle.patch` 的 bundle）：

```text
D:\AIUP\dsh-sillytavern-presets
```

或先打包再安装：

```powershell
node C:\Users\20224\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs pack --pack-destination D:\AIUP\dist
```

然后在 DSH 的 **设置 → 插件** 中安装生成的 `dsh-sillytavern-presets-*.tgz`。

### 开发检查

```powershell
node --check lib\index.js
node --check lib\client.js
node test-host.mjs
```

`test-host.mjs` 使用临时目录和一份无害的合成预设，验证导入、切换、编辑、预览、导出、归档、恢复、删除与采样参数覆盖。

## 使用

1. 打开 **设置 → SillyTavern 预设**。
2. 点击 **导入预设**，选择 SillyTavern 的预设 JSON。
3. 在左侧选择预设，点击 **使用此预设**。
4. 需要调整时，修改提示词或参数，点击 **保存**；也可以 **预览** 最终注入内容。
5. 通过 **导出** 备份，用 **归档** 收起不再使用的预设；确定不再需要时，可点击 **删除预设** 永久移除。

导入后，选中的预设会作为一个独立的 System Prompt 段落注入当前对话；`temperature` 和输出 token 上限会在模型请求时覆盖 Harness 的对应值（可在编辑页分别关闭）。

## 数据位置

默认保存到：

```text
%DSH_HOME%\plugin-data\dsh-sillytavern-presets\presets.json
```

如果未设置 `DSH_HOME`，回退到 `%USERPROFILE%\.dsh\plugin-data\dsh-sillytavern-presets\presets.json`。

可以用环境变量 `DSH_SILLYTAVERN_PRESETS_DIR` 指定其他目录。写入采用临时文件 + `.bak` 备份，避免半写入损坏。

## 导入规则

- 优先使用预设中的 `prompt_order`。如果存在多个分组，可在编辑页选择要使用的分组。
- 没有 `prompt_order` 时，按 `prompts` 原顺序生成一个分组。
- `marker: true` 的占位提示词（如 `worldInfoBefore`、`chatHistory`）不会注入文本；它们由 Harness 自己的提示词和对话组装负责。
- `enabled: false` 的提示词不会注入。
- 支持部分常见宏：`{{trim}}`、`{{//注释}}`、`{{setvar::key::value}}`、`{{getvar::key}}`、`{{addvar::key::value}}`、`{{incvar::key}}`，以及配置后的 `{{user}}` / `{{char}}`。未知宏会原样保留。
- 原始 JSON 会被保留；导出时会合并编辑后的提示词、重新生成 `prompt_order` 和采样参数，未识别的字段保持不变。

## 可应用与仅展示的参数

**会应用：**

- `temperature`
- `openai_max_tokens` / `maxTokens`

**会保留并编辑、但当前 Harness 请求接口不直接应用：**

- `top_p`、`top_k`、`top_a`、`min_p`
- `frequency_penalty`、`presence_penalty`、`repetition_penalty`
- `openai_max_context`
- `seed`

这些字段仍会出现在编辑页和导出 JSON 中，便于迁移回 SillyTavern；它们不会悄悄改写 Harness 的模型请求。

## 限制与注意

- 不导入角色卡、世界书、聊天记录、正则脚本、TavernHelper 脚本或 SillyTavern 扩展；本插件只处理 AI 预设本身。
- SillyTavern 的 user / assistant 提示词也会作为 System Prompt 中的说明块注入，而不是生成多条对话消息。
- 导入的提示词会成为系统指令。请只启用你信任的预设；预设中可能包含越狱、角色扮演规则或与当前任务冲突的指令。启用前可用 **预览** 检查注入内容。
- **删除预设** 是永久操作，会同时清除该预设保存的原始 JSON，无法从插件内恢复；需要保留时请先 **导出** 或改用 **归档**。删除前会显示确认对话框，不会静默执行。

## 许可

MIT，见 [LICENSE](LICENSE)。
