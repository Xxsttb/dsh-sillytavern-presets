/**
 * dsh-sillytavern-presets — Client half.
 *
 * Adds one Settings section that manages the presets. The Host owns all state;
 * this file only renders, edits a local draft and talks to the plugin's HTTP
 * routes. No Harness Client package is imported: `react` is the only module.
 */

window.__ModuleLoader__.load({
  id: "dsh-sillytavern-presets",
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useRef, useMemo, useCallback } = React;

    const LOCALE_NS = "dsh-sillytavern-presets";
    const ROUTE_PREFIX = "/plugins/sillytavern-presets";
    const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
    const BUILTIN_GROUP_IDS = new Set([100000]);

    /* ---------------------------------------------------------------- i18n */

    const en = {
      nav: "SillyTavern presets",
      title: "SillyTavern presets",
      heroKicker: "AI preset library",
      presetsTitle: "Presets",
      intro:
        "Import SillyTavern AI preset JSON files, edit their prompt order and sampling values, then switch the whole preset with one click. Every import stays on disk until you explicitly delete it.",
      enable: "Apply the active preset",
      enabledHint:
        "When enabled, the active preset is appended to the System Prompt and its temperature / output-token limit are applied to agent requests.",
      globalOff: "The preset layer is off. This conversation currently uses only the normal Harness prompt.",
      loading: "Loading presets…",
      loadFailed: "Could not load the preset store.",
      retry: "Retry",
      empty: "No presets yet",
      emptyHint:
        "Import a SillyTavern preset JSON file, or create a blank preset and add prompts yourself.",
      import: "Import JSON",
      newPreset: "New preset",
      newPresetName: "New SillyTavern preset",
      created: "Blank preset created.",
      imported: "Imported “{name}”.",
      badJson: "That file is not valid JSON.",
      fileTooLarge: "That file is too large (limit 16 MB).",
      save: "Save",
      saving: "Saving…",
      saved: "Preset saved.",
      discard: "Discard changes",
      discardConfirm: "Discard the unsaved changes to this preset?",
      use: "Use this preset",
      inUse: "In use",
      useDone: "“{name}” is now the active preset.",
      preview: "Preview prompt",
      previewTitle: "Injected System Prompt",
      previewEmpty:
        "No prompt text is generated: every entry in this order group is disabled, empty, or a marker.",
      previewStats: "{chars} characters · {count} active prompt(s)",
      close: "Close",
      cancel: "Cancel",
      deleteConfirmAction: "Delete permanently",
      duplicate: "Duplicate",
      duplicated: "Preset duplicated as “{name}”.",
      saveBeforeDuplicate: "Save or discard your changes before duplicating.",
      archive: "Archive",
      restore: "Restore",
      archiveConfirm:
        "Archive this preset? It stays on disk and can be restored at any time.",
      delete: "Delete",
      deletePreset: "Delete preset",
      deleting: "Deleting…",
      deleteConfirm:
        "Permanently delete “{name}”? It will be removed from disk and cannot be undone.",
      deleteActiveConfirm:
        "Permanently delete the active preset “{name}”? Prompt injection stops immediately, and this cannot be undone.",
      deletedNotice: "Preset “{name}” deleted.",
      archivedNotice: "Preset archived.",
      archivedBanner:
        "This preset is archived and is not injected. Restore it before using it again.",
      restoredNotice: "Preset restored.",
      export: "Export JSON",
      exported: "Exported {name}.",
      noSelection: "Select a preset on the left to edit it.",
      noSelectionHint: "Imported presets stay available until you explicitly delete them.",
      promptsTitle: "Prompts",
      promptSummary: "{enabled} of {total} entries active",
      addPrompt: "Add prompt",
      newPromptName: "Custom prompt",
      promptName: "Prompt name",
      promptContent: "Prompt content",
      role: "Role",
      roleSystem: "system",
      roleUser: "user",
      roleAssistant: "assistant",
      marker: "marker",
      removePrompt: "Remove",
      removePromptConfirm: "Remove this custom prompt from the preset?",
      moveUp: "Move up",
      moveDown: "Move down",
      charCount: "{count} characters",
      emptyPrompts: "This order group has no entries. Add a prompt to start.",
      missingPrompt: "Missing source prompt (it will be skipped).",
      orderTitle: "Prompt order",
      orderGroup: "Order group",
      defaultGroup: "Default group",
      groupLabel: "Group {index} · character {char} · {count} entries",
      groupLabelDefault: "Group {index} · default order · {count} entries",
      orderHint:
        "Only prompts in the selected group are applied. Markers are skipped because DeepSeek Harness supplies conversation history itself.",
      parameters: "Sampling parameters",
      parametersHint:
        "DeepSeek Harness currently applies temperature and the maximum output tokens. The remaining values are preserved for export.",
      temperature: "Temperature",
      maxTokens: "Max output tokens",
      topP: "Top P",
      topK: "Top K",
      topA: "Top A",
      minP: "Min P",
      frequencyPenalty: "Frequency penalty",
      presencePenalty: "Presence penalty",
      repetitionPenalty: "Repetition penalty",
      seed: "Seed",
      context: "Context window",
      applyTemperature: "Apply temperature",
      applyMaxTokens: "Apply max output tokens",
      moreParameters: "More sampling values (saved and exported, not applied)",
      unsupportedHint:
        "DeepSeek Harness does not expose top-p, top-k, min-p, top-a, penalties or seed per request, so these are informational here.",
      macrosTitle: "Macro names",
      macroUser: "Value for {{user}}",
      macroChar: "Value for {{char}}",
      macroHint:
        "Leave blank to keep the macros unchanged. The importer also expands common SillyTavern setvar/getvar/trim/comment macros when building the prompt.",
      source: "Source",
      sourceFile: "File",
      manualPreset: "Created in this plugin",
      importedAt: "Imported",
      updatedAt: "Updated",
      dirty: "Unsaved changes",
      active: "Active",
      archived: "Archived",
      promptCount: "{count} prompts",
      groupCount: "{count} groups",
      dataPath: "Data file",
      character: "character {id}",
      requestFailed: "The request failed.",
      networkError: "Could not reach the preset manager.",
      serverWarn:
        "The preset manager is running in a read-only or error state. Check the DSH log for details.",
      blankGroupName: "Order group",
    };

    const zh = {
      nav: "SillyTavern 预设",
      title: "SillyTavern 预设",
      heroKicker: "AI 预设库",
      presetsTitle: "预设",
      intro:
        "导入 SillyTavern 的 AI 预设 JSON，编辑提示词顺序与采样参数，并一键切换整套预设。每次导入都会保存在磁盘上，只有你主动删除时才会移除。",
      enable: "启用当前预设",
      enabledHint:
        "启用后，当前预设会追加到 System Prompt，并把温度与最大输出 token 应用到 Agent 请求。",
      globalOff: "预设层已关闭，当前会话只使用 Harness 自带的提示词。",
      loading: "正在加载预设…",
      loadFailed: "无法加载预设存储。",
      retry: "重试",
      empty: "还没有预设",
      emptyHint: "导入一个 SillyTavern 预设 JSON，或者新建空白预设并自行添加提示词。",
      import: "导入 JSON",
      newPreset: "新建预设",
      newPresetName: "新的 SillyTavern 预设",
      created: "已创建空白预设。",
      imported: "已导入「{name}」。",
      badJson: "这个文件不是有效的 JSON。",
      fileTooLarge: "文件太大（上限 16 MB）。",
      save: "保存",
      saving: "正在保存…",
      saved: "预设已保存。",
      discard: "放弃修改",
      discardConfirm: "放弃这个预设尚未保存的修改？",
      use: "使用此预设",
      inUse: "使用中",
      useDone: "「{name}」已成为当前预设。",
      preview: "预览提示词",
      previewTitle: "注入的 System Prompt",
      previewEmpty: "当前顺序组没有生成任何文本：所有条目都被禁用、为空或只是标记。",
      previewStats: "{chars} 个字符 · {count} 条生效提示词",
      close: "关闭",
      cancel: "取消",
      deleteConfirmAction: "永久删除",
      duplicate: "复制预设",
      duplicated: "已复制为「{name}」。",
      saveBeforeDuplicate: "请先保存或放弃修改，再复制预设。",
      archive: "归档",
      restore: "恢复",
      archiveConfirm: "归档这个预设？它会保留在磁盘上，随时可以恢复。",
      delete: "删除",
      deletePreset: "删除预设",
      deleting: "正在删除…",
      deleteConfirm: "永久删除「{name}」？它会从磁盘移除，且无法撤销。",
      deleteActiveConfirm: "永久删除当前预设「{name}」？提示词注入会立即停止，且无法撤销。",
      deletedNotice: "预设「{name}」已删除。",
      archivedNotice: "预设已归档。",
      archivedBanner: "此预设已归档，不会注入。需要使用时请先恢复。",
      restoredNotice: "预设已恢复。",
      export: "导出 JSON",
      exported: "已导出 {name}。",
      noSelection: "从左侧选择一个预设进行编辑。",
      noSelectionHint: "已导入的预设会一直保留，直到你主动删除。",
      promptsTitle: "提示词",
      promptSummary: "{total} 个条目中有 {enabled} 个生效",
      addPrompt: "添加提示词",
      newPromptName: "自定义提示词",
      promptName: "提示词名称",
      promptContent: "提示词内容",
      role: "角色",
      roleSystem: "system",
      roleUser: "user",
      roleAssistant: "assistant",
      marker: "标记",
      removePrompt: "移除",
      removePromptConfirm: "从预设中移除此自定义提示词？",
      moveUp: "上移",
      moveDown: "下移",
      charCount: "{count} 个字符",
      emptyPrompts: "这个顺序组还没有条目。添加一条提示词开始编辑。",
      missingPrompt: "源提示词缺失（会被跳过）。",
      orderTitle: "提示词顺序",
      orderGroup: "顺序组",
      defaultGroup: "默认组",
      groupLabel: "第 {index} 组 · 角色 {char} · {count} 个条目",
      groupLabelDefault: "第 {index} 组 · 默认顺序 · {count} 个条目",
      orderHint:
        "只应用所选顺序组中的提示词。标记会被跳过，因为 DeepSeek Harness 自己提供对话历史。",
      parameters: "采样参数",
      parametersHint:
        "DeepSeek Harness 目前会应用温度与最大输出 token；其余参数仅保存并随导出保留。",
      temperature: "温度",
      maxTokens: "最大输出 token",
      topP: "Top P",
      topK: "Top K",
      topA: "Top A",
      minP: "Min P",
      frequencyPenalty: "频率惩罚",
      presencePenalty: "存在惩罚",
      repetitionPenalty: "重复惩罚",
      seed: "随机种子",
      context: "上下文窗口",
      applyTemperature: "应用温度",
      applyMaxTokens: "应用最大输出 token",
      moreParameters: "更多采样参数（仅保存与导出，不应用）",
      unsupportedHint:
        "DeepSeek Harness 的请求接口不暴露 top-p、top-k、min-p、top-a、惩罚项或随机种子，因此这些值在这里只作展示与保留。",
      macrosTitle: "宏名称",
      macroUser: "{{user}} 的替换值",
      macroChar: "{{char}} 的替换值",
      macroHint:
        "留空则保留宏原样。导入与生成提示词时，会展开常见的 SillyTavern setvar/getvar/trim/注释宏。",
      source: "来源",
      sourceFile: "文件",
      manualPreset: "在本插件中创建",
      importedAt: "导入时间",
      updatedAt: "更新时间",
      dirty: "有未保存修改",
      active: "当前",
      archived: "已归档",
      promptCount: "{count} 条提示词",
      groupCount: "{count} 个顺序组",
      dataPath: "数据文件",
      character: "角色 {id}",
      requestFailed: "请求失败。",
      networkError: "无法连接预设管理器。",
      serverWarn: "预设管理器处于只读或错误状态，请查看 DSH 日志。",
      blankGroupName: "顺序组",
    };

    /* ----------------------------------------------------------------- css */

    const css = `
.dsh-stp-page{display:flex;flex-direction:column;gap:16px;padding:2px 6px 36px 0;max-width:960px;max-height:calc(100vh - 190px);overflow-y:auto;overscroll-behavior:contain;color:var(--dsw-alias-label-primary);scrollbar-gutter:stable;container-type:inline-size}
.dsh-stp-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:16px 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.dsh-stp-hero-main{display:flex;align-items:flex-start;gap:12px;min-width:0;flex:1 1 420px}
.dsh-stp-hero-mark{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;flex:0 0 38px;border-radius:10px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-brand-primary);opacity:1}
.dsh-stp-hero-mark svg{width:21px;height:21px;display:block}
.dsh-stp-hero-copy{min-width:0}
.dsh-stp-kicker{display:block;margin-bottom:2px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:15px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.dsh-stp-hero h2{color:var(--dsw-alias-label-primary);font-size:17px;font-weight:600;line-height:25px;margin:0}
.dsh-stp-intro{color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:19px;margin:4px 0 0;max-width:620px}
.dsh-stp-enable{display:flex;align-items:flex-start;gap:10px;padding:9px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);max-width:320px;cursor:pointer;transition:border-color .12s ease,background-color .12s ease}
.dsh-stp-enable:hover{border-color:var(--dsw-alias-border-l2)}
.dsh-stp-enable input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.dsh-stp-switch{position:relative;display:inline-block;width:32px;height:18px;flex:0 0 32px;margin-top:1px;border-radius:999px;background:var(--dsw-alias-border-l2);transition:background-color .14s ease}
.dsh-stp-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-base);box-shadow:0 1px 2px rgba(0,0,0,.18);transition:transform .14s ease}
.dsh-stp-enable input:checked + .dsh-stp-switch{background:var(--dsw-alias-brand-primary)}
.dsh-stp-enable input:checked + .dsh-stp-switch::after{transform:translateX(14px)}
.dsh-stp-enable input:focus-visible + .dsh-stp-switch{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary))}
.dsh-stp-enable input:disabled + .dsh-stp-switch{opacity:.45}
.dsh-stp-enable-copy{display:block;min-width:0}
.dsh-stp-enable-copy b{display:block;color:var(--dsw-alias-label-primary);font-weight:600;font-size:12.5px;line-height:18px}
.dsh-stp-enable-copy small{display:block;margin-top:1px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}
.dsh-stp-alert{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:9px 11px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.dsh-stp-alert[data-tone="error"]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.dsh-stp-alert[data-tone="warn"]{border-color:var(--dsw-alias-state-warn-primary)}
.dsh-stp-alert[data-tone="success"]{border-color:var(--dsw-alias-state-success-primary)}
.dsh-stp-layout{display:grid;grid-template-columns:236px minmax(0,1fr);align-items:start;gap:14px}
.dsh-stp-side{display:flex;flex-direction:column;gap:9px;min-width:0}
.dsh-stp-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:16px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.dsh-stp-count{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:18px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:10px;font-weight:600;letter-spacing:0}
.dsh-stp-side-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.dsh-stp-side-actions .dsh-stp-btn{width:100%}
.dsh-stp-list{display:flex;flex-direction:column;gap:6px}
.dsh-stp-card{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:9px 10px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:border-color .12s ease,background-color .12s ease,box-shadow .12s ease;min-width:0}
.dsh-stp-card:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.dsh-stp-card:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.dsh-stp-card[data-selected="true"]{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.dsh-stp-card[data-active="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-layer-1));box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.dsh-stp-card-title{display:flex;align-items:center;gap:6px;justify-content:space-between}
.dsh-stp-card-name{font-size:12.5px;line-height:19px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsh-stp-card-meta{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-stp-badges{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.dsh-stp-badge{font-size:9.5px;line-height:15px;padding:0 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.dsh-stp-badge[data-tone="active"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dsh-stp-badge[data-tone="archived"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.dsh-stp-badge[data-tone="marker"]{color:var(--dsw-alias-label-secondary);border-style:dashed}
.dsh-stp-editor{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:16px}
.dsh-stp-editor-empty{display:flex;flex-direction:column;gap:5px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;min-height:150px;justify-content:center;align-items:center;text-align:center;padding:24px}
.dsh-stp-editor-empty b{color:var(--dsw-alias-label-primary);font-weight:500}
.dsh-stp-editor-head{display:flex;flex-direction:column;gap:9px}
.dsh-stp-name{box-sizing:border-box;width:100%;font-size:18px;font-weight:600;line-height:26px;color:var(--dsw-alias-label-primary);background:transparent;border:none;border-bottom:1px solid transparent;border-radius:0;padding:2px 0;outline:none;transition:border-color .12s ease}
.dsh-stp-name:hover{border-bottom-color:var(--dsw-alias-border-l1)}
.dsh-stp-name:focus{border-bottom-color:var(--dsw-alias-brand-primary)}
.dsh-stp-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:6px 10px;padding:1px 0}
.dsh-stp-action-group{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsh-stp-toolbar>.dsh-stp-action-group:nth-child(1){grid-column:1;grid-row:1}
.dsh-stp-toolbar>.dsh-stp-action-group:nth-child(2){grid-column:1 / -1;grid-row:2}
.dsh-stp-toolbar>.dsh-stp-action-group--end{grid-column:2;grid-row:1;justify-self:end;margin-left:0}
.dsh-stp-action-group + .dsh-stp-action-group{padding-left:0;border-left:0}
.dsh-stp-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:30px;padding:0 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;font-weight:500;line-height:18px;cursor:pointer;transition:background-color .12s ease,border-color .12s ease,color .12s ease,opacity .12s ease;white-space:nowrap}
.dsh-stp-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.dsh-stp-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.dsh-stp-btn:disabled{opacity:.42;cursor:default}
.dsh-stp-btn[data-variant="primary"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base);font-weight:600}
.dsh-stp-btn[data-variant="primary"]:hover:not(:disabled){background:var(--dsw-alias-brand-primary);border-color:transparent;opacity:.88}
.dsh-stp-btn[data-variant="ghost"]{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.dsh-stp-btn[data-variant="ghost"]:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:transparent}
.dsh-stp-btn[data-variant="warn"]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 38%,var(--dsw-alias-border-l1));background:transparent}
.dsh-stp-btn[data-variant="warn"]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 9%,transparent);border-color:var(--dsw-alias-state-warn-primary)}
.dsh-stp-btn[data-variant="danger"]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,var(--dsw-alias-border-l1));background:transparent;font-weight:600}
.dsh-stp-btn[data-variant="danger"]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);border-color:var(--dsw-alias-state-error-primary)}
.dsh-stp-btn[data-size="mini"]{height:26px;padding:0 9px;font-size:11px;font-weight:500}
.dsh-stp-meta{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:10.5px;line-height:17px;color:var(--dsw-alias-label-secondary);margin:10px 0 0;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-stp-meta>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-stp-meta code{font-family:inherit;color:var(--dsw-alias-label-secondary)}
.dsh-stp-section{border-top:1px solid var(--dsw-alias-border-l1);margin-top:15px;padding-top:14px;display:flex;flex-direction:column;gap:10px}
.dsh-stp-section-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsh-stp-section-head h3{font-size:12.5px;line-height:20px;font-weight:600;color:var(--dsw-alias-label-primary);margin:0}
.dsh-stp-section-head .dsh-stp-hint{margin-left:auto;text-align:right;max-width:72%}
.dsh-stp-section-head.dsh-stp-params-head{align-items:flex-start}
.dsh-stp-section-head.dsh-stp-params-head .dsh-stp-hint{flex:1 1 100%;margin-left:0;text-align:left;max-width:none}
.dsh-stp-hint{font-size:10.5px;line-height:17px;color:var(--dsw-alias-label-secondary);margin:0}
.dsh-stp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dsh-stp-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-stp-field>span{font-size:11px;line-height:16px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.dsh-stp-field>small{font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary);opacity:.8}
.dsh-stp-field input[type="text"],.dsh-stp-field input[type="number"],.dsh-stp-field select,.dsh-stp-field textarea{box-sizing:border-box;width:100%;height:32px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;padding:6px 9px;outline:none;transition:border-color .12s ease,box-shadow .12s ease}
.dsh-stp-field textarea{height:auto;min-height:100px;resize:vertical;line-height:19px;padding:8px 9px}
.dsh-stp-field input:hover,.dsh-stp-field select:hover,.dsh-stp-field textarea:hover{border-color:var(--dsw-alias-border-l2)}
.dsh-stp-field input:focus,.dsh-stp-field select:focus,.dsh-stp-field textarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary))}
.dsh-stp-field input:disabled,.dsh-stp-field select:disabled,.dsh-stp-field textarea:disabled{opacity:.55}
.dsh-stp-checks{display:flex;gap:14px;flex-wrap:wrap}
.dsh-stp-check{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);cursor:pointer}
.dsh-stp-check input{accent-color:var(--dsw-alias-brand-primary);margin:0}
.dsh-stp-details{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px 11px;background:var(--dsw-alias-bg-layer-2)}
.dsh-stp-details>summary{cursor:pointer;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);list-style-position:inside}
.dsh-stp-details[open]>summary{margin-bottom:10px;color:var(--dsw-alias-label-primary)}
.dsh-stp-order{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
.dsh-stp-order .dsh-stp-field{flex:1 1 240px}
.dsh-stp-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);overflow:hidden;transition:border-color .12s ease}
.dsh-stp-prompt:hover{border-color:var(--dsw-alias-border-l2)}
.dsh-stp-prompt + .dsh-stp-prompt{margin-top:0}
.dsh-stp-prompt[open]{border-color:var(--dsw-alias-border-l2)}
.dsh-stp-prompt-head{display:flex;align-items:center;gap:7px;padding:8px 10px;cursor:pointer;list-style:none;min-height:24px}
.dsh-stp-prompt-head::-webkit-details-marker{display:none}
.dsh-stp-prompt-head::before{content:"›";display:inline-block;width:9px;color:var(--dsw-alias-label-secondary);flex:0 0 9px;transition:transform .12s ease}
.dsh-stp-prompt[open]>.dsh-stp-prompt-head::before{transform:rotate(90deg)}
.dsh-stp-prompt-head:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-stp-prompt-head input[type="checkbox"]{accent-color:var(--dsw-alias-brand-primary);margin:0;flex:0 0 auto}
.dsh-stp-prompt-name{font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto}
.dsh-stp-role{font-size:9.5px;line-height:15px;padding:0 5px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);flex:0 0 auto}
.dsh-stp-spacer{flex:0 0 2px}
.dsh-stp-iconbtn{width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;flex:0 0 auto;padding:0}
.dsh-stp-iconbtn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dsh-stp-iconbtn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.dsh-stp-iconbtn:disabled{opacity:.3;cursor:default}
.dsh-stp-prompt-body{display:flex;flex-direction:column;gap:10px;padding:10px;border-top:1px solid var(--dsw-alias-border-l1)}
.dsh-stp-prompt-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.dsh-stp-prompt-foot span{font-size:10px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.dsh-stp-prompt-marker{display:flex;align-items:center;gap:7px;padding:8px 10px;background:transparent;border-style:dashed;cursor:default}
.dsh-stp-prompt-marker .dsh-stp-prompt-name{color:var(--dsw-alias-label-secondary)}
.dsh-stp-empty{font-size:11.5px;line-height:18px;color:var(--dsw-alias-label-secondary);padding:16px 12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:9px;text-align:center;background:var(--dsw-alias-bg-base)}
.dsh-stp-modal{position:fixed;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000}
.dsh-stp-dialog{width:min(820px,100%);max-height:86vh;display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 20px 56px rgba(0,0,0,.34);padding:16px}
.dsh-stp-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dsh-stp-dialog-head h3{font-size:14px;line-height:21px;font-weight:600;margin:0;color:var(--dsw-alias-label-primary)}
.dsh-stp-dialog p{font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);margin:0}
.dsh-stp-dialog.dsh-stp-confirm{width:min(430px,100%);max-height:none;gap:8px}
.dsh-stp-dialog .dsh-stp-confirm-text{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);margin:3px 0 5px}
.dsh-stp-confirm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:5px}
.dsh-stp-preview{flex:1 1 auto;min-height:120px;max-height:58vh;overflow:auto;margin:0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:17px;white-space:pre-wrap;word-break:break-word}
.dsh-stp-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:10px;line-height:16px;color:var(--dsw-alias-label-secondary)}
.dsh-stp-file{display:none}
@media (max-width:820px){.dsh-stp-layout{grid-template-columns:1fr}.dsh-stp-side{width:100%}.dsh-stp-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}.dsh-stp-enable{max-width:none;width:100%}.dsh-stp-action-group--end{margin-left:0}}
@media (max-width:620px){.dsh-stp-grid{grid-template-columns:1fr}.dsh-stp-section-head .dsh-stp-hint{margin-left:0;text-align:left;max-width:none}.dsh-stp-hero{padding:14px}.dsh-stp-editor{padding:13px}}
@container (max-width:720px){.dsh-stp-layout{grid-template-columns:minmax(0,1fr)}.dsh-stp-side{width:100%}.dsh-stp-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}.dsh-stp-enable{max-width:none;width:100%}.dsh-stp-action-group--end{margin-left:0}}
`;

    const cssTagId = "dsh-sillytavern-presets/manager.module.css";
    if (
      typeof document !== "undefined"
      && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null
    ) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-sillytavern-presets";
      tag.dataset.pluginCss = cssTagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    /* -------------------------------------------------------------- helpers */

    function apiUrl(pathname) {
      try {
        return new URL(ROUTE_PREFIX + pathname, document.baseURI).pathname;
      } catch {
        return ROUTE_PREFIX + pathname;
      }
    }

    class ApiError extends Error {
      constructor(message, code) {
        super(message);
        this.name = "ApiError";
        this.code = code;
      }
    }

    async function requestJson(pathname, options = {}) {
      const init = { cache: "no-store", ...options };
      if (init.body !== undefined) {
        init.headers = { "content-type": "application/json", ...(init.headers ?? {}) };
      }
      let response;
      try {
        response = await fetch(apiUrl(pathname), init);
      } catch {
        throw new ApiError("network");
      }
      let data = null;
      try {
        const text = await response.text();
        data = text === "" ? null : JSON.parse(text);
      } catch {
        data = null;
      }
      if (!response.ok || (data !== null && data.ok === false)) {
        const message = data && data.error && typeof data.error.message === "string"
          ? data.error.message
          : response.statusText || "HTTP " + response.status;
        throw new ApiError(message, data && data.error ? data.error.code : undefined);
      }
      return data ?? {};
    }

    function tf(t, key, values = {}) {
      const template = t(key);
      if (typeof template !== "string") return key;
      return template.replace(/\{(\w+)\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole,
      );
    }

    function formatDate(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return "";
      return date.toLocaleString();
    }

    function effectiveCount(preset, group) {
      if (!group) return 0;
      const byIdentifier = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
      return group.entries.filter((entry) => {
        if (entry.enabled === false) return false;
        const prompt = byIdentifier.get(entry.identifier);
        return prompt !== undefined && !prompt.marker && prompt.content.trim() !== "";
      }).length;
    }

    function downloadText(fileName, text) {
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function errorMessage(error, t) {
      if (!(error instanceof Error) || error.message === "network") return t("networkError");
      return error.message || t("requestFailed");
    }

    /* ----------------------------------------------------------- small views */

    function TextField({ label, value, onChange, placeholder, hint, disabled }) {
      return h(
        "label",
        { className: "dsh-stp-field" },
        h("span", null, label),
        h("input", {
          type: "text",
          value: value ?? "",
          placeholder,
          disabled,
          onChange: (event) => onChange(event.target.value),
        }),
        hint === undefined ? null : h("small", null, hint),
      );
    }

    function NumberField({ label, value, onChange, step, min, max, hint }) {
      return h(
        "label",
        { className: "dsh-stp-field" },
        h("span", null, label),
        h("input", {
          type: "number",
          value: value ?? "",
          step: step ?? "any",
          min,
          max,
          onChange: (event) => {
            if (event.target.value === "") {
              onChange(null);
              return;
            }
            const parsed = Number(event.target.value);
            onChange(Number.isFinite(parsed) ? parsed : null);
          },
        }),
        hint === undefined ? null : h("small", null, hint),
      );
    }

    function Checkbox({ label, checked, onChange }) {
      return h(
        "label",
        { className: "dsh-stp-check" },
        h("input", {
          type: "checkbox",
          checked: checked === true,
          onChange: (event) => onChange(event.target.checked),
        }),
        label,
      );
    }

    function Badge({ children, tone }) {
      return h("span", { className: "dsh-stp-badge", "data-tone": tone }, children);
    }

    function Alert({ tone, children }) {
      return h("div", { className: "dsh-stp-alert", "data-tone": tone }, children);
    }

    /* --------------------------------------------------------------- manager */

    function PresetManager({ t }) {
      const tr = typeof t === "function" ? t : (key) => key;
      const trRef = useRef(tr);
      trRef.current = tr;
      const [store, setStore] = useState({
        status: "loading",
        enabled: true,
        activeId: null,
        presets: [],
        dataFile: "",
      });
      const [selectedId, setSelectedId] = useState(null);
      const [draft, setDraft] = useState(null);
      const [draftStatus, setDraftStatus] = useState("idle");
      const [dirty, setDirty] = useState(false);
      const [busy, setBusy] = useState("");
      const [error, setError] = useState("");
      const [notice, setNotice] = useState("");
      const [preview, setPreview] = useState(null);
      const [pendingDelete, setPendingDelete] = useState(null);
      const fileRef = useRef(null);

      const loadStore = useCallback(async (preferredId) => {
        const data = await requestJson("/state");
        setStore({
          status: "ready",
          enabled: data.enabled !== false,
          activeId: data.activeId ?? null,
          presets: Array.isArray(data.presets) ? data.presets : [],
          dataFile: data.dataFile ?? "",
        });
        setSelectedId((current) => {
          const list = Array.isArray(data.presets) ? data.presets : [];
          if (preferredId && list.some((preset) => preset.id === preferredId)) return preferredId;
          if (current && list.some((preset) => preset.id === current)) return current;
          if (data.activeId && list.some((preset) => preset.id === data.activeId)) return data.activeId;
          const first = list.find((preset) => !preset.archived) ?? list[0];
          return first ? first.id : null;
        });
        return data;
      }, []);

      useEffect(() => {
        let cancelled = false;
        loadStore().catch((cause) => {
          if (!cancelled) {
            setStore((current) => ({ ...current, status: "error" }));
            setError(errorMessage(cause, trRef.current));
          }
        });
        return () => {
          cancelled = true;
        };
      }, [loadStore]);

      useEffect(() => {
        if (selectedId === null) {
          setDraft(null);
          setDraftStatus("idle");
          setDirty(false);
          return undefined;
        }
        let cancelled = false;
        setPendingDelete(null);
        setDraft(null);
        setDraftStatus("loading");
        setDirty(false);
        requestJson(`/presets/${encodeURIComponent(selectedId)}`)
          .then((data) => {
            if (cancelled) return;
            setDraft(data.preset);
            setDraftStatus("ready");
          })
          .catch((cause) => {
            if (cancelled) return;
            setDraftStatus("error");
            setError(errorMessage(cause, trRef.current));
          });
        return () => {
          cancelled = true;
        };
      }, [selectedId]);

      useEffect(() => {
        if (notice === "") return undefined;
        const timer = window.setTimeout(() => setNotice(""), 5000);
        return () => window.clearTimeout(timer);
      }, [notice]);

      useEffect(() => {
        if (preview === null) return undefined;
        const onKey = (event) => {
          if (event.key === "Escape") setPreview(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [preview]);

      const byIdentifier = useMemo(
        () => new Map((draft?.prompts ?? []).map((prompt) => [prompt.identifier, prompt])),
        [draft],
      );

      const run = useCallback(
        async (key, task) => {
          setBusy(key);
          setError("");
          setNotice("");
          try {
            await task();
          } catch (cause) {
            setError(errorMessage(cause, tr));
          } finally {
            setBusy("");
          }
        },
        [tr],
      );

      const editDraft = useCallback((updater) => {
        setDraft((current) => {
          if (current === null) return current;
          return typeof updater === "function" ? updater(current) : { ...current, ...updater };
        });
        setDirty(true);
      }, []);

      const choosePreset = useCallback(
        (id) => {
          if (id === selectedId) return;
          if (dirty && !window.confirm(tr("discardConfirm"))) return;
          setSelectedId(id);
        },
        [dirty, selectedId, tr],
      );

      const saveDraft = useCallback(async () => {
        if (draft === null) return null;
        const data = await requestJson(`/presets/${encodeURIComponent(draft.id)}/save`, {
          method: "POST",
          body: JSON.stringify(draft),
        });
        setDraft(data.preset);
        setDirty(false);
        setNotice(tr("saved"));
        await loadStore(draft.id);
        return data;
      }, [draft, loadStore, tr]);

      const handleToggleEnabled = useCallback(() => {
        void run("toggle", async () => {
          await requestJson("/enabled", {
            method: "POST",
            body: JSON.stringify({ enabled: !store.enabled }),
          });
          await loadStore(selectedId);
        });
      }, [loadStore, run, selectedId, store.enabled]);

      const handleSave = useCallback(() => {
        void run("save", saveDraft);
      }, [run, saveDraft]);

      const handleDiscard = useCallback(() => {
        if (draft === null || !dirty) return;
        if (!window.confirm(tr("discardConfirm"))) return;
        void run("discard", async () => {
          const data = await requestJson(`/presets/${encodeURIComponent(draft.id)}`);
          setDraft(data.preset);
          setDirty(false);
        });
      }, [dirty, draft, run, tr]);

      const handleUse = useCallback(() => {
        if (draft === null || draft.archived) return;
        void run("use", async () => {
          if (dirty) await saveDraft();
          await requestJson(`/presets/${encodeURIComponent(draft.id)}/select`, {
            method: "POST",
            body: "{}",
          });
          await loadStore(draft.id);
          setNotice(tf(tr, "useDone", { name: draft.name }));
        });
      }, [dirty, draft, loadStore, run, saveDraft, tr]);

      const handleImportFile = useCallback(
        (event) => {
          const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
          event.target.value = "";
          if (file === null) return;
          void run("import", async () => {
            if (file.size > MAX_IMPORT_BYTES) throw new Error(tr("fileTooLarge"));
            let document;
            try {
              document = JSON.parse(await file.text());
            } catch {
              throw new Error(tr("badJson"));
            }
            const data = await requestJson("/import", {
              method: "POST",
              body: JSON.stringify({ json: document, fileName: file.name }),
            });
            setNotice(tf(tr, "imported", { name: data.preset.name }));
            await loadStore(data.preset.id);
          });
        },
        [loadStore, run, tr],
      );

      const handleNew = useCallback(() => {
        void run("new", async () => {
          const data = await requestJson("/new", {
            method: "POST",
            body: JSON.stringify({ name: tr("newPresetName") }),
          });
          setNotice(tr("created"));
          await loadStore(data.preset.id);
        });
      }, [loadStore, run, tr]);

      const handleDuplicate = useCallback(() => {
        if (draft === null) return;
        if (dirty) {
          setError(tr("saveBeforeDuplicate"));
          return;
        }
        void run("duplicate", async () => {
          const data = await requestJson(`/presets/${encodeURIComponent(draft.id)}/duplicate`, {
            method: "POST",
            body: "{}",
          });
          setNotice(tf(tr, "duplicated", { name: data.preset.name }));
          await loadStore(data.preset.id);
        });
      }, [dirty, draft, loadStore, run, tr]);

      const handleArchive = useCallback(() => {
        if (draft === null) return;
        if (!draft.archived && !window.confirm(tr("archiveConfirm"))) return;
        void run("archive", async () => {
          if (dirty) await saveDraft();
          const data = await requestJson(`/presets/${encodeURIComponent(draft.id)}/archive`, {
            method: "POST",
            body: JSON.stringify({ archived: !draft.archived }),
          });
          setDraft(data.preset);
          setDirty(false);
          setNotice(draft.archived ? tr("restoredNotice") : tr("archivedNotice"));
          await loadStore(draft.id);
        });
      }, [dirty, draft, loadStore, run, saveDraft, tr]);

      const handleDelete = useCallback(() => {
        if (draft === null) return;
        setPendingDelete(draft);
      }, [draft]);

      const confirmDelete = useCallback(() => {
        if (pendingDelete === null) return;
        const target = pendingDelete;
        const name = target.name;
        setPendingDelete(null);
        void run("delete", async () => {
          await requestJson(`/presets/${encodeURIComponent(target.id)}`, { method: "DELETE" });
          setSelectedId(null);
          setPreview(null);
          await loadStore();
          setNotice(tf(tr, "deletedNotice", { name }));
        });
      }, [pendingDelete, loadStore, run, tr]);

      const handleExport = useCallback(() => {
        if (draft === null) return;
        void run("export", async () => {
          if (dirty) await saveDraft();
          const data = await requestJson(`/presets/${encodeURIComponent(draft.id)}/export`);
          downloadText(data.fileName, data.json);
          setNotice(tf(tr, "exported", { name: data.fileName }));
        });
      }, [dirty, draft, run, saveDraft, tr]);

      const handlePreview = useCallback(() => {
        if (draft === null) return;
        void run("preview", async () => {
          const data = await requestJson(`/presets/${encodeURIComponent(draft.id)}/preview`, {
            method: "POST",
            body: JSON.stringify({ preset: draft }),
          });
          setPreview({
            text: data.text ?? "",
            chars: data.chars ?? 0,
            enabledPrompts: data.enabledPrompts ?? 0,
            name: draft.name,
          });
        });
      }, [draft, run]);

      const updateParam = useCallback(
        (key, value) => {
          editDraft((current) => ({
            ...current,
            params: { ...current.params, [key]: value },
          }));
        },
        [editDraft],
      );

      const updateApply = useCallback(
        (key, value) => {
          editDraft((current) => ({
            ...current,
            apply: { ...current.apply, [key]: value },
          }));
        },
        [editDraft],
      );

      const updateMacro = useCallback(
        (key, value) => {
          editDraft((current) => ({
            ...current,
            macros: { ...current.macros, [key]: value },
          }));
        },
        [editDraft],
      );

      const updateGroupEntry = useCallback(
        (index, patch) => {
          editDraft((current) => ({
            ...current,
            orderGroups: current.orderGroups.map((group, groupIndex) =>
              groupIndex === current.selectedOrderIndex
                ? {
                    ...group,
                    entries: group.entries.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, ...patch } : entry,
                    ),
                  }
                : group,
            ),
          }));
        },
        [editDraft],
      );

      const moveEntry = useCallback(
        (index, delta) => {
          editDraft((current) => {
            const target = index + delta;
            const group = current.orderGroups[current.selectedOrderIndex];
            if (!group || target < 0 || target >= group.entries.length) return current;
            const entries = [...group.entries];
            const moved = entries[index];
            entries[index] = entries[target];
            entries[target] = moved;
            return {
              ...current,
              orderGroups: current.orderGroups.map((item, groupIndex) =>
                groupIndex === current.selectedOrderIndex ? { ...group, entries } : item,
              ),
            };
          });
        },
        [editDraft],
      );

      const updatePrompt = useCallback(
        (identifier, patch) => {
          editDraft((current) => ({
            ...current,
            prompts: current.prompts.map((prompt) =>
              prompt.identifier === identifier ? { ...prompt, ...patch } : prompt,
            ),
          }));
        },
        [editDraft],
      );

      const addPrompt = useCallback(() => {
        const identifier =
          "custom-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        const prompt = {
          identifier,
          name: tr("newPromptName"),
          role: "system",
          content: "",
          marker: false,
          systemPrompt: true,
          injectionPosition: 0,
          injectionDepth: 4,
          injectionOrder: 100,
          enabled: true,
        };
        editDraft((current) => {
          const groups = current.orderGroups.length === 0
            ? [{ characterId: null, entries: [{ identifier, enabled: true }] }]
            : current.orderGroups.map((group, index) =>
                index === current.selectedOrderIndex
                  ? { ...group, entries: [...group.entries, { identifier, enabled: true }] }
                  : group,
              );
          return {
            ...current,
            prompts: [...current.prompts, prompt],
            orderGroups: groups,
            selectedOrderIndex: current.orderGroups.length === 0 ? 0 : current.selectedOrderIndex,
          };
        });
      }, [editDraft, tr]);

      const removePrompt = useCallback(
        (identifier) => {
          if (!identifier.startsWith("custom-")) return;
          if (!window.confirm(tr("removePromptConfirm"))) return;
          editDraft((current) => ({
            ...current,
            prompts: current.prompts.filter((prompt) => prompt.identifier !== identifier),
            orderGroups: current.orderGroups.map((group) => ({
              ...group,
              entries: group.entries.filter((entry) => entry.identifier !== identifier),
            })),
          }));
        },
        [editDraft, tr],
      );

      /* ------------------------------------------------------------- render */

      const presets = useMemo(() => {
        return [...store.presets].sort((left, right) => {
          if (left.active !== right.active) return left.active ? -1 : 1;
          if (left.archived !== right.archived) return left.archived ? 1 : -1;
          return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
        });
      }, [store.presets]);

      const selected = draft !== null && draft.id === selectedId ? draft : null;
      const groupIndex = selected !== null && selected.orderGroups.length > 0
        ? Math.min(selected.orderGroups.length - 1, Math.max(0, selected.selectedOrderIndex))
        : -1;
      const group = groupIndex >= 0 ? selected.orderGroups[groupIndex] : null;
      const active = selected !== null && store.activeId === selected.id && !selected.archived;
      const disabled = busy !== "";

      const renderSidebar = () => {
        if (store.status === "loading") {
          return h("p", { className: "dsh-stp-hint" }, tr("loading"));
        }
        if (store.status !== "ready") {
          return h(
            "div",
            { className: "dsh-stp-side" },
            h(Alert, { tone: "error" }, tr("loadFailed")),
            h(
              "button",
              {
                className: "dsh-stp-btn",
                type: "button",
                onClick: () => {
                  setStore((current) => ({ ...current, status: "loading" }));
                  setError("");
                  void loadStore(selectedId).catch((cause) => {
                    setStore((current) => ({ ...current, status: "error" }));
                    setError(errorMessage(cause, tr));
                  });
                },
              },
              tr("retry"),
            ),
          );
        }
        return h(
          "aside",
          { className: "dsh-stp-side" },
          h(
            "div",
            { className: "dsh-stp-side-head" },
            h("span", null, tr("presetsTitle")),
            h("span", { className: "dsh-stp-count" }, String(store.presets.length)),
          ),
          h(
            "div",
            { className: "dsh-stp-side-actions" },
            h(
              "button",
              {
                className: "dsh-stp-btn",
                type: "button",
                "data-variant": "primary",
                disabled,
                onClick: () => fileRef.current?.click(),
              },
              tr("import"),
            ),
            h(
              "button",
              { className: "dsh-stp-btn", type: "button", disabled, onClick: handleNew },
              tr("newPreset"),
            ),
          ),
          store.presets.length === 0
            ? h(
                "div",
                { className: "dsh-stp-empty" },
                h("b", null, tr("empty")),
                h("br"),
                tr("emptyHint"),
              )
            : h(
                "div",
                { className: "dsh-stp-list" },
                presets.map((preset) =>
                  h(
                    "div",
                    {
                      key: preset.id,
                      className: "dsh-stp-card",
                      role: "button",
                      tabIndex: 0,
                      "data-active": preset.active ? "true" : "false",
                      "data-selected": preset.id === selectedId ? "true" : "false",
                      onClick: () => choosePreset(preset.id),
                      onKeyDown: (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          choosePreset(preset.id);
                        }
                      },
                    },
                    h(
                      "div",
                      { className: "dsh-stp-card-title" },
                      h("span", { className: "dsh-stp-card-name", title: preset.name }, preset.name),
                      h(
                        "span",
                        { className: "dsh-stp-badges" },
                        preset.active ? h(Badge, { tone: "active" }, tr("active")) : null,
                        preset.archived ? h(Badge, { tone: "archived" }, tr("archived")) : null,
                      ),
                    ),
                    h(
                      "div",
                      { className: "dsh-stp-card-meta" },
                      `${preset.effectivePromptCount}/${preset.promptCount} · ${tf(tr, "groupCount", { count: preset.orderGroupCount })}`,
                    ),
                  ),
                ),
              ),
        );
      };

      const renderPromptRow = (entry, index) => {
        const prompt = byIdentifier.get(entry.identifier);
        if (prompt === undefined) {
          return h(
            "div",
            { className: "dsh-stp-prompt dsh-stp-prompt-marker", key: `${entry.identifier}-missing-${index}` },
            h("span", { className: "dsh-stp-prompt-name" }, entry.identifier),
            h("span", { className: "dsh-stp-role" }, tr("missingPrompt")),
          );
        }
        if (prompt.marker) {
          return h(
            "div",
            { className: "dsh-stp-prompt dsh-stp-prompt-marker", key: `${entry.identifier}-marker-${index}` },
            h("input", { type: "checkbox", checked: entry.enabled !== false, disabled: true, readOnly: true }),
            h("span", { className: "dsh-stp-prompt-name" }, prompt.name),
            h(Badge, { tone: "marker" }, tr("marker")),
          );
        }
        return h(
          "details",
          { className: "dsh-stp-prompt", key: `${entry.identifier}-${index}` },
          h(
            "summary",
            { className: "dsh-stp-prompt-head" },
            h("input", {
              type: "checkbox",
              checked: entry.enabled !== false,
              "aria-label": prompt.name,
              onClick: (event) => event.stopPropagation(),
              onChange: (event) => updateGroupEntry(index, { enabled: event.target.checked }),
            }),
            h("span", { className: "dsh-stp-prompt-name", title: prompt.name }, prompt.name),
            h("span", { className: "dsh-stp-role" }, prompt.role),
            h("span", { className: "dsh-stp-spacer" }),
            h(
              "button",
              {
                className: "dsh-stp-iconbtn",
                type: "button",
                title: tr("moveUp"),
                "aria-label": tr("moveUp"),
                disabled: index === 0,
                onClick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  moveEntry(index, -1);
                },
              },
              "↑",
            ),
            h(
              "button",
              {
                className: "dsh-stp-iconbtn",
                type: "button",
                title: tr("moveDown"),
                "aria-label": tr("moveDown"),
                disabled: index === group.entries.length - 1,
                onClick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  moveEntry(index, 1);
                },
              },
              "↓",
            ),
          ),
          h(
            "div",
            { className: "dsh-stp-prompt-body" },
            h(
              "div",
              { className: "dsh-stp-grid" },
              h(TextField, {
                label: tr("promptName"),
                value: prompt.name,
                onChange: (value) => updatePrompt(prompt.identifier, { name: value }),
              }),
              h(
                "label",
                { className: "dsh-stp-field" },
                h("span", null, tr("role")),
                h(
                  "select",
                  {
                    value: prompt.role,
                    onChange: (event) =>
                      updatePrompt(prompt.identifier, { role: event.target.value }),
                  },
                  h("option", { value: "system" }, tr("roleSystem")),
                  h("option", { value: "user" }, tr("roleUser")),
                  h("option", { value: "assistant" }, tr("roleAssistant")),
                ),
              ),
            ),
            h(
              "label",
              { className: "dsh-stp-field" },
              h("span", null, tr("promptContent")),
              h("textarea", {
                rows: 8,
                value: prompt.content,
                onChange: (event) =>
                  updatePrompt(prompt.identifier, { content: event.target.value }),
                spellCheck: false,
              }),
            ),
            h(
              "div",
              { className: "dsh-stp-prompt-foot" },
              h("span", null, tf(tr, "charCount", { count: prompt.content.length })),
              prompt.identifier.startsWith("custom-")
                ? h(
                    "button",
                    {
                      className: "dsh-stp-btn",
                      type: "button",
                      "data-variant": "danger",
                      "data-size": "mini",
                      onClick: () => removePrompt(prompt.identifier),
                    },
                    tr("removePrompt"),
                  )
                : null,
            ),
          ),
        );
      };

      const renderEditor = () => {
        if (store.status === "loading") {
          return h("section", { className: "dsh-stp-editor" }, h("p", { className: "dsh-stp-hint" }, tr("loading")));
        }
        if (store.status !== "ready") {
          return h(
            "section",
            { className: "dsh-stp-editor dsh-stp-editor-empty" },
            h("b", null, tr("loadFailed")),
            h("span", null, tr("serverWarn")),
          );
        }
        if (selectedId === null) {
          return h(
            "section",
            { className: "dsh-stp-editor dsh-stp-editor-empty" },
            h("b", null, tr("noSelection")),
            h("span", null, tr("noSelectionHint")),
          );
        }
        if (draftStatus === "loading" || selected === null) {
          return h("section", { className: "dsh-stp-editor" }, h("p", { className: "dsh-stp-hint" }, tr("loading")));
        }
        if (draftStatus === "error") {
          return h(
            "section",
            { className: "dsh-stp-editor dsh-stp-editor-empty" },
            h("b", null, tr("loadFailed")),
            h("span", null, tr("noSelectionHint")),
          );
        }

        const groupOptions = selected.orderGroups.map((item, index) => {
          const isDefault = item.characterId === null || BUILTIN_GROUP_IDS.has(item.characterId);
          const label = isDefault
            ? tf(tr, "groupLabelDefault", { index: index + 1, count: item.entries.length })
            : tf(tr, "groupLabel", {
                index: index + 1,
                char: item.characterId,
                count: item.entries.length,
              });
          return h("option", { value: String(index), key: String(index) }, label);
        });

        return h(
          "section",
          { className: "dsh-stp-editor" },
          h(
            "div",
            { className: "dsh-stp-editor-head" },
            h("input", {
              className: "dsh-stp-name",
              value: selected.name,
              "aria-label": tr("title"),
              onChange: (event) => editDraft({ name: event.target.value }),
            }),
            h(
              "div",
              { className: "dsh-stp-badges" },
              active ? h(Badge, { tone: "active" }, tr("inUse")) : null,
              selected.archived ? h(Badge, { tone: "archived" }, tr("archived")) : null,
              dirty ? h(Badge, { tone: "active" }, tr("dirty")) : null,
            ),
            h(
              "div",
              { className: "dsh-stp-toolbar" },
              h(
                "div",
                { className: "dsh-stp-action-group" },
                h(
                  "button",
                  {
                    className: "dsh-stp-btn",
                    type: "button",
                    "data-variant": dirty ? "primary" : undefined,
                    disabled: disabled || !dirty,
                    onClick: handleSave,
                  },
                  busy === "save" ? tr("saving") : tr("save"),
                ),
                h(
                  "button",
                  {
                    className: "dsh-stp-btn",
                    type: "button",
                    "data-variant": "ghost",
                    disabled: disabled || !dirty,
                    onClick: handleDiscard,
                  },
                  tr("discard"),
                ),
                selected.archived
                  ? h(
                      "button",
                      {
                        className: "dsh-stp-btn",
                        type: "button",
                        "data-variant": dirty ? undefined : "primary",
                        disabled,
                        onClick: handleArchive,
                      },
                      tr("restore"),
                    )
                  : h(
                      "button",
                      {
                        className: "dsh-stp-btn",
                        type: "button",
                        "data-variant": active ? "ghost" : dirty ? undefined : "primary",
                        disabled: disabled || active,
                        onClick: handleUse,
                      },
                      active ? tr("inUse") : tr("use"),
                    ),
              ),
              h(
                "div",
                { className: "dsh-stp-action-group" },
                h(
                  "button",
                  { className: "dsh-stp-btn", type: "button", disabled, onClick: handlePreview },
                  tr("preview"),
                ),
                h(
                  "button",
                  { className: "dsh-stp-btn", type: "button", disabled, onClick: handleDuplicate },
                  tr("duplicate"),
                ),
                h(
                  "button",
                  { className: "dsh-stp-btn", type: "button", disabled, onClick: handleExport },
                  tr("export"),
                ),
              ),
              h(
                "div",
                { className: "dsh-stp-action-group dsh-stp-action-group--end" },
                selected.archived
                  ? null
                  : h(
                      "button",
                      {
                        className: "dsh-stp-btn",
                        type: "button",
                        "data-variant": "warn",
                        disabled,
                        onClick: handleArchive,
                      },
                      tr("archive"),
                    ),
                h(
                  "button",
                  {
                    className: "dsh-stp-btn",
                    type: "button",
                    "data-variant": "danger",
                    title: tf(tr, "deleteConfirm", { name: selected.name }),
                    disabled,
                    onClick: handleDelete,
                  },
                  busy === "delete" ? tr("deleting") : tr("deletePreset"),
                ),
              ),
            ),
            h(
              "p",
              { className: "dsh-stp-meta" },
              h("span", null, `${tr("source")}: ${selected.sourceFileName || tr("manualPreset")}`),
              h("span", null, `${tr("importedAt")}: ${formatDate(selected.importedAt)}`),
              h("span", null, `${tr("updatedAt")}: ${formatDate(selected.updatedAt)}`),
            ),
          ),
          !store.enabled
            ? h(Alert, { tone: "warn" }, tr("globalOff"))
            : null,
          selected.archived
            ? h(Alert, { tone: "warn" }, tr("archivedBanner"))
            : null,
          h(
            "div",
            { className: "dsh-stp-section" },
            h(
              "div",
              { className: "dsh-stp-section-head dsh-stp-params-head" },
              h("h3", null, tr("parameters")),
              h("span", { className: "dsh-stp-hint" }, tr("parametersHint")),
            ),
            h(
              "div",
              { className: "dsh-stp-grid" },
              h(NumberField, {
                label: tr("temperature"),
                value: selected.params.temperature,
                step: "0.05",
                min: 0,
                max: 2,
                onChange: (value) => updateParam("temperature", value),
              }),
              h(NumberField, {
                label: tr("maxTokens"),
                value: selected.params.maxTokens,
                step: "1",
                min: 1,
                onChange: (value) => updateParam("maxTokens", value),
              }),
            ),
            h(
              "div",
              { className: "dsh-stp-checks" },
              h(Checkbox, {
                label: tr("applyTemperature"),
                checked: selected.apply.temperature,
                onChange: (value) => updateApply("temperature", value),
              }),
              h(Checkbox, {
                label: tr("applyMaxTokens"),
                checked: selected.apply.maxTokens,
                onChange: (value) => updateApply("maxTokens", value),
              }),
            ),
            h(
              "details",
              { className: "dsh-stp-details" },
              h("summary", null, tr("moreParameters")),
              h(
                "div",
                { className: "dsh-stp-grid" },
                h(NumberField, {
                  label: tr("topP"),
                  value: selected.params.topP,
                  step: "0.01",
                  min: 0,
                  max: 1,
                  onChange: (value) => updateParam("topP", value),
                }),
                h(NumberField, {
                  label: tr("topK"),
                  value: selected.params.topK,
                  step: "1",
                  min: 0,
                  onChange: (value) => updateParam("topK", value),
                }),
                h(NumberField, {
                  label: tr("topA"),
                  value: selected.params.topA,
                  step: "0.01",
                  min: 0,
                  max: 1,
                  onChange: (value) => updateParam("topA", value),
                }),
                h(NumberField, {
                  label: tr("minP"),
                  value: selected.params.minP,
                  step: "0.01",
                  min: 0,
                  max: 1,
                  onChange: (value) => updateParam("minP", value),
                }),
                h(NumberField, {
                  label: tr("frequencyPenalty"),
                  value: selected.params.frequencyPenalty,
                  step: "0.1",
                  min: -2,
                  max: 2,
                  onChange: (value) => updateParam("frequencyPenalty", value),
                }),
                h(NumberField, {
                  label: tr("presencePenalty"),
                  value: selected.params.presencePenalty,
                  step: "0.1",
                  min: -2,
                  max: 2,
                  onChange: (value) => updateParam("presencePenalty", value),
                }),
                h(NumberField, {
                  label: tr("repetitionPenalty"),
                  value: selected.params.repetitionPenalty,
                  step: "0.05",
                  min: 0,
                  onChange: (value) => updateParam("repetitionPenalty", value),
                }),
                h(NumberField, {
                  label: tr("seed"),
                  value: selected.params.seed,
                  step: "1",
                  min: 0,
                  onChange: (value) => updateParam("seed", value),
                }),
                h(NumberField, {
                  label: tr("context"),
                  value: selected.params.openaiMaxContext,
                  step: "1",
                  min: 1,
                  onChange: (value) => updateParam("openaiMaxContext", value),
                }),
              ),
              h("p", { className: "dsh-stp-hint" }, tr("unsupportedHint")),
            ),
            h(
              "div",
              { className: "dsh-stp-grid" },
              h(TextField, {
                label: tr("macroUser"),
                value: selected.macros.user,
                onChange: (value) => updateMacro("user", value),
              }),
              h(TextField, {
                label: tr("macroChar"),
                value: selected.macros.char,
                onChange: (value) => updateMacro("char", value),
              }),
            ),
            h("p", { className: "dsh-stp-hint" }, tr("macroHint")),
          ),
          h(
            "div",
            { className: "dsh-stp-section" },
            h(
              "div",
              { className: "dsh-stp-section-head" },
              h("h3", null, tr("promptsTitle")),
              h(
                "span",
                { className: "dsh-stp-hint" },
                tf(tr, "promptSummary", {
                  enabled: effectiveCount(selected, group),
                  total: group ? group.entries.length : 0,
                }),
              ),
              h(
                "button",
                { className: "dsh-stp-btn", type: "button", "data-size": "mini", onClick: addPrompt },
                tr("addPrompt"),
              ),
            ),
            h(
              "div",
              { className: "dsh-stp-order" },
              h(
                "label",
                { className: "dsh-stp-field" },
                h("span", null, tr("orderGroup")),
                h(
                  "select",
                  {
                    value: String(groupIndex),
                    disabled: selected.orderGroups.length === 0,
                    onChange: (event) =>
                      editDraft({ selectedOrderIndex: Number(event.target.value) }),
                  },
                  selected.orderGroups.length === 0
                    ? h("option", { value: "-1" }, tr("blankGroupName"))
                    : groupOptions,
                ),
              ),
            ),
            h("p", { className: "dsh-stp-hint" }, tr("orderHint")),
            group === null || group.entries.length === 0
              ? h("div", { className: "dsh-stp-empty" }, tr("emptyPrompts"))
              : group.entries.map((entry, index) => renderPromptRow(entry, index)),
          ),
        );
      };

      return h(
        "div",
        { className: "dsh-stp-page" },
        h(
          "header",
          { className: "dsh-stp-hero" },
          h(
            "div",
            { className: "dsh-stp-hero-main" },
            h(
              "span",
              { className: "dsh-stp-hero-mark", "aria-hidden": "true" },
              h(
                "svg",
                {
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.7,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                },
                h("path", { d: "M7 3.5h7l4 4V20.5H7z" }),
                h("path", { d: "M14 3.5v4h4" }),
                h("path", { d: "M9.5 12h5M9.5 15.5h5" }),
              ),
            ),
            h(
              "div",
              { className: "dsh-stp-hero-copy" },
              h("span", { className: "dsh-stp-kicker" }, tr("heroKicker")),
              h("h2", null, tr("title")),
              h("p", { className: "dsh-stp-intro" }, tr("intro")),
            ),
          ),
          h(
            "label",
            { className: "dsh-stp-enable" },
            h("input", {
              type: "checkbox",
              checked: store.enabled,
              disabled: disabled || store.status !== "ready",
              onChange: handleToggleEnabled,
            }),
            h("span", { className: "dsh-stp-switch", "aria-hidden": "true" }),
            h(
              "span",
              { className: "dsh-stp-enable-copy" },
              h("b", null, tr("enable")),
              h("small", null, tr("enabledHint")),
            ),
          ),
        ),
        error !== ""
          ? h(Alert, { tone: "error" }, error)
          : null,
        notice !== ""
          ? h(Alert, { tone: "success" }, notice)
          : null,
        h("div", { className: "dsh-stp-layout" }, renderSidebar(), renderEditor()),
        store.dataFile !== ""
          ? h(
              "footer",
              { className: "dsh-stp-footer" },
              h("span", null, tr("dataPath")),
              h("code", { title: store.dataFile }, store.dataFile),
            )
          : null,
        h("input", {
          ref: fileRef,
          className: "dsh-stp-file",
          type: "file",
          accept: ".json,application/json",
          onChange: handleImportFile,
        }),
        preview === null
          ? null
          : h(
              "div",
              {
                className: "dsh-stp-modal",
                role: "presentation",
                onClick: () => setPreview(null),
              },
              h(
                "div",
                {
                  className: "dsh-stp-dialog",
                  role: "dialog",
                  "aria-modal": "true",
                  "aria-label": tr("previewTitle"),
                  onClick: (event) => event.stopPropagation(),
                },
                h(
                  "div",
                  { className: "dsh-stp-dialog-head" },
                  h("h3", null, tr("previewTitle")),
                  h(
                    "button",
                    {
                      className: "dsh-stp-btn",
                      type: "button",
                      onClick: () => setPreview(null),
                    },
                    tr("close"),
                  ),
                ),
                h("p", null, preview.name),
                h(
                  "p",
                  null,
                  tf(tr, "previewStats", {
                    chars: preview.chars,
                    count: preview.enabledPrompts,
                  }),
                ),
                h(
                  "pre",
                  { className: "dsh-stp-preview" },
                  preview.text === "" ? tr("previewEmpty") : preview.text,
                ),
              ),
            ),
        pendingDelete === null
          ? null
          : h(
              "div",
              {
                className: "dsh-stp-modal",
                role: "presentation",
                onClick: () => setPendingDelete(null),
              },
              h(
                "div",
                {
                  className: "dsh-stp-dialog dsh-stp-confirm",
                  role: "alertdialog",
                  "aria-modal": "true",
                  "aria-label": tr("deletePreset"),
                  onClick: (event) => event.stopPropagation(),
                },
                h(
                  "div",
                  { className: "dsh-stp-dialog-head" },
                  h("h3", null, tr("deletePreset")),
                  h(
                    "button",
                    {
                      className: "dsh-stp-btn",
                      type: "button",
                      onClick: () => setPendingDelete(null),
                    },
                    tr("close"),
                  ),
                ),
                h(
                  "p",
                  { className: "dsh-stp-confirm-text" },
                  tf(
                    tr,
                    pendingDelete.id === store.activeId ? "deleteActiveConfirm" : "deleteConfirm",
                    { name: pendingDelete.name },
                  ),
                ),
                h(
                  "div",
                  { className: "dsh-stp-confirm-actions" },
                  h(
                    "button",
                    {
                      className: "dsh-stp-btn",
                      type: "button",
                      onClick: () => setPendingDelete(null),
                    },
                    tr("cancel"),
                  ),
                  h(
                    "button",
                    {
                      className: "dsh-stp-btn",
                      type: "button",
                      "data-variant": "danger",
                      disabled: busy === "delete",
                      onClick: confirmDelete,
                    },
                    busy === "delete" ? tr("deleting") : tr("deleteConfirmAction"),
                  ),
                ),
              ),
            ),
      );
    }

    /* ------------------------------------------------------------------ plugin */

    const inject = ["slots", "locale"];

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(LOCALE_NS, { en, zh }),
        "dsh-sillytavern-presets: locale",
      );
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "sillytavern-presets",
            order: 64,
            label: () => ctx.locale.bind(LOCALE_NS)("nav"),
            locale: LOCALE_NS,
          },
          PresetManager,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
