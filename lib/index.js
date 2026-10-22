/**
 * dsh-sillytavern-presets — Host half.
 *
 * SillyTavern keeps its AI presets as regular JSON files. This plugin imports
 * those files verbatim, keeps the original document for round-trip export, and
 * derives a small editable model (prompts, prompt order, sampling values) from
 * it. The active preset is injected as one global System Prompt section and its
 * temperature / output-token settings are applied at the agent request
 * waterfall. Imported presets are persisted on disk and are archived unless the
 * user explicitly deletes one from the manager.
 */

import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ROUTE_PREFIX = "/plugins/sillytavern-presets";
const SECTION_NAME = "sillytavern-preset";
const STORE_VERSION = 1;
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const MAX_CONTENT_CHARS = 2_000_000;
const MAX_PROMPTS = 2000;
const MAX_GROUPS = 32;
const MAX_ENTRIES = 2000;

/* ------------------------------------------------------------------ errors */

class HttpFailure extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpFailure";
    this.status = status;
    this.code = code;
  }
}

/* ----------------------------------------------------------------- helpers */

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toText(value, limit = 20_000) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return text.length > limit ? text.slice(0, limit) : text;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toInteger(value) {
  const number = toNumber(value);
  return number === null ? null : Math.trunc(number);
}

function clampInteger(value, min, max) {
  const number = toInteger(value);
  if (number === null) return null;
  return Math.min(max, Math.max(min, number));
}

function clampNumber(value, min, max) {
  const number = toNumber(value);
  if (number === null) return null;
  return Math.min(max, Math.max(min, number));
}

function cleanIdentifier(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 240);
}

function cleanName(value, fallback = "") {
  const text = toText(value, 240).trim();
  return text === "" ? fallback : text;
}

function fileStem(fileName) {
  const base = path.basename(toText(fileName, 400));
  return base.replace(/\.json$/i, "").trim();
}

function safeFileName(value) {
  const base = cleanName(value, "sillytavern-preset")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.+$/g, "")
    .trim();
  return (base === "" ? "sillytavern-preset" : base).slice(0, 120);
}

function dataFile() {
  const explicit = process.env.DSH_SILLYTAVERN_PRESETS_DIR;
  if (explicit && explicit.trim() !== "") {
    return path.join(explicit, "presets.json");
  }
  const home = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ""
    ? process.env.DSH_HOME
    : path.join(os.homedir(), ".dsh");
  return path.join(home, "plugin-data", "dsh-sillytavern-presets", "presets.json");
}

/* ------------------------------------------------------------- persistence */

function emptyState() {
  return { version: STORE_VERSION, enabled: true, activeId: null, presets: [] };
}

let state = emptyState();
let loadPromise = null;
let writeQueue = Promise.resolve();

function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = loadState()
      .then((loaded) => {
        state = loaded;
        return loaded;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

async function loadState() {
  const file = dataFile();
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return emptyState();
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      await rename(file, `${file}.broken-${Date.now()}`);
    } catch {
      /* keep the broken file in place when it cannot be moved */
    }
    return emptyState();
  }
  return normalizeState(parsed);
}

async function persist(nextState) {
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(nextState, null, 2);
  const temp = `${file}.tmp`;
  await writeFile(temp, payload, "utf8");
  try {
    await copyFile(file, `${file}.bak`);
  } catch {
    /* a missing or unreadable previous file must not block the save */
  }
  try {
    await rename(temp, file);
  } catch {
    await copyFile(temp, file);
    await rm(temp, { force: true });
  }
}

/**
 * Serialize every mutation. The in-memory state is only replaced after the
 * file write succeeds, so a failed disk write cannot silently alter the running
 * configuration.
 */
function mutate(buildNext) {
  const run = writeQueue.then(async () => {
    await ensureLoaded();
    const next = await buildNext(state);
    await persist(next);
    state = next;
    return next;
  });
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* --------------------------------------------------------------- normalize */

function normalizePrompts(value) {
  const source = Array.isArray(value) ? value : [];
  const prompts = [];
  const used = new Set();
  for (let index = 0; index < source.length && prompts.length < MAX_PROMPTS; index += 1) {
    const item = isPlainObject(source[index]) ? source[index] : {};
    const base = cleanIdentifier(item.identifier) || cleanIdentifier(item.name) || `prompt-${index + 1}`;
    let identifier = base;
    let suffix = 2;
    while (used.has(identifier)) {
      identifier = `${base}#${suffix}`;
      suffix += 1;
      if (suffix > 1000) break;
    }
    if (used.has(identifier)) continue;
    used.add(identifier);
    const role = item.role === "user" || item.role === "assistant" || item.role === "system"
      ? item.role
      : "system";
    prompts.push({
      identifier,
      name: cleanName(item.name, identifier),
      role,
      content: toText(item.content, MAX_CONTENT_CHARS),
      marker: item.marker === true,
      systemPrompt: item.systemPrompt === true || item.system_prompt === true,
      injectionPosition: clampInteger(item.injectionPosition ?? item.injection_position, -1000, 1000) ?? 0,
      injectionDepth: clampInteger(item.injectionDepth ?? item.injection_depth, 0, 10_000) ?? 4,
      injectionOrder: clampInteger(item.injectionOrder ?? item.injection_order, 0, 1_000_000) ?? 100,
      enabled: item.enabled !== false,
    });
  }
  return prompts;
}

function normalizeOrderGroups(value, prompts) {
  const known = new Set(prompts.map((prompt) => prompt.identifier));
  const groups = [];
  const source = Array.isArray(value) ? value : [];
  for (const item of source.slice(0, MAX_GROUPS)) {
    if (!isPlainObject(item)) continue;
    const rawEntries = Array.isArray(item.entries)
      ? item.entries
      : Array.isArray(item.order)
        ? item.order
        : [];
    const entries = [];
    const seen = new Set();
    for (const entry of rawEntries.slice(0, MAX_ENTRIES)) {
      const identifier = typeof entry === "string"
        ? cleanIdentifier(entry)
        : cleanIdentifier(isPlainObject(entry) ? entry.identifier : "");
      if (identifier === "" || !known.has(identifier) || seen.has(identifier)) continue;
      seen.add(identifier);
      entries.push({
        identifier,
        enabled: typeof entry === "string" ? true : entry.enabled !== false,
      });
    }
    groups.push({
      characterId: clampInteger(item.characterId ?? item.character_id, -1, 2_147_483_647),
      entries,
    });
  }
  if (groups.length === 0 && prompts.length > 0) {
    groups.push({
      characterId: null,
      entries: prompts.map((prompt) => ({
        identifier: prompt.identifier,
        enabled: prompt.enabled !== false,
      })),
    });
  }
  return groups;
}

function normalizeParams(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    temperature: clampNumber(source.temperature, 0, 2),
    maxTokens: clampInteger(source.maxTokens ?? source.openai_max_tokens, 1, 2_000_000),
    openaiMaxContext: clampInteger(source.openaiMaxContext ?? source.openai_max_context, 1, 100_000_000),
    topP: clampNumber(source.topP ?? source.top_p, 0, 1),
    topK: clampInteger(source.topK ?? source.top_k, 0, 1_000_000),
    topA: clampNumber(source.topA ?? source.top_a, 0, 1),
    minP: clampNumber(source.minP ?? source.min_p, 0, 1),
    frequencyPenalty: clampNumber(source.frequencyPenalty ?? source.frequency_penalty, -2, 2),
    presencePenalty: clampNumber(source.presencePenalty ?? source.presence_penalty, -2, 2),
    repetitionPenalty: clampNumber(source.repetitionPenalty ?? source.repetition_penalty, 0, 10),
    seed: clampInteger(source.seed, 0, 2_147_483_647),
  };
}

function normalizeApply(value, params) {
  const source = isPlainObject(value) ? value : {};
  return {
    temperature: source.temperature === true
      || (source.temperature === undefined && params.temperature !== null),
    maxTokens: source.maxTokens === true
      || (source.maxTokens === undefined && params.maxTokens !== null),
  };
}

function normalizeMacros(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    user: toText(source.user, 100).trim(),
    char: toText(source.char, 100).trim(),
  };
}

function normalizeStoredPreset(input, index = 0) {
  if (!isPlainObject(input)) return null;
  const prompts = normalizePrompts(input.prompts);
  const orderGroups = normalizeOrderGroups(input.orderGroups ?? input.prompt_order, prompts);
  const params = normalizeParams(input.params ?? input);
  const selectedOrderIndex = orderGroups.length === 0
    ? 0
    : Math.min(
        orderGroups.length - 1,
        Math.max(0, toInteger(input.selectedOrderIndex ?? 0) ?? 0),
      );
  const id = cleanIdentifier(input.id) || randomUUID();
  const importedAt = toInteger(input.importedAt) ?? Date.now();
  const updatedAt = toInteger(input.updatedAt) ?? importedAt;
  return {
    id,
    name: cleanName(input.name, `Preset ${index + 1}`),
    sourceFileName: toText(input.sourceFileName, 400),
    importedAt,
    updatedAt,
    selectedOrderIndex,
    params,
    apply: normalizeApply(input.apply, params),
    macros: normalizeMacros(input.macros),
    prompts,
    orderGroups,
    archived: input.archived === true,
    raw: isPlainObject(input.raw) ? input.raw : {},
  };
}

function normalizeState(parsed) {
  if (!isPlainObject(parsed)) return emptyState();
  const presets = [];
  const used = new Set();
  const source = Array.isArray(parsed.presets) ? parsed.presets : [];
  for (const item of source) {
    const preset = normalizeStoredPreset(item, presets.length);
    if (preset === null || used.has(preset.id)) continue;
    used.add(preset.id);
    presets.push(preset);
  }
  let activeId = typeof parsed.activeId === "string" ? parsed.activeId : null;
  if (!presets.some((preset) => preset.id === activeId && !preset.archived)) activeId = null;
  return {
    version: STORE_VERSION,
    enabled: parsed.enabled !== false,
    activeId,
    presets,
  };
}

function uniqueName(desired, presets, ignoredId = null) {
  const base = cleanName(desired, "Imported preset");
  const taken = new Set(
    presets.filter((preset) => preset.id !== ignoredId).map((preset) => preset.name),
  );
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base} (${counter})`)) counter += 1;
  return `${base} (${counter})`;
}

function normalizeImported(raw, fileName) {
  const prompts = normalizePrompts(raw.prompts);
  const orderGroups = normalizeOrderGroups(raw.prompt_order, prompts);
  const params = normalizeParams(raw);
  const name = cleanName(raw.preset_name ?? raw.name, fileStem(fileName) || "Imported preset");
  return {
    id: randomUUID(),
    name,
    sourceFileName: path.basename(toText(fileName, 400)),
    importedAt: Date.now(),
    updatedAt: Date.now(),
    selectedOrderIndex: 0,
    params,
    apply: normalizeApply(undefined, params),
    macros: { user: "", char: "" },
    prompts,
    orderGroups,
    archived: false,
    raw: structuredClone(raw),
  };
}

/* --------------------------------------------------------------- macros */

/**
 * Expand the subset of SillyTavern macros that matter for a preset prompt:
 * variables, comments, trim markers and the user / character names. Unknown
 * macros are deliberately left untouched so a preset can still be recognised
 * by the model instead of being silently mangled.
 */
function expandMacros(input, variables, macros, depth = 0) {
  if (depth > 4) return input;
  let text = String(input ?? "");
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    const next = text.replace(/\{\{([\s\S]*?)\}\}/g, (whole, body) => {
      const inner = String(body).trim();
      if (inner === "") return whole;
      if (inner.startsWith("//")) {
        changed = true;
        return "";
      }
      const parts = inner.split("::");
      const command = parts[0].trim().toLowerCase();
      if (command === "trim") {
        changed = true;
        return "";
      }
      if (command === "setvar" && parts.length >= 3) {
        changed = true;
        variables.set(parts[1].trim(), parts.slice(2).join("::"));
        return "";
      }
      if (command === "getvar" && parts.length >= 2) {
        changed = true;
        return expandMacros(variables.get(parts[1].trim()) ?? "", variables, macros, depth + 1);
      }
      if (command === "addvar" && parts.length >= 3) {
        changed = true;
        const key = parts[1].trim();
        variables.set(key, (variables.get(key) ?? "") + parts.slice(2).join("::"));
        return "";
      }
      if (command === "incvar" && parts.length >= 2) {
        changed = true;
        const key = parts[1].trim();
        const current = Number(variables.get(key) ?? 0);
        variables.set(key, String(Number.isFinite(current) ? current + 1 : 1));
        return "";
      }
      if (command === "user" && macros.user !== "") {
        changed = true;
        return macros.user;
      }
      if (command === "char" && macros.char !== "") {
        changed = true;
        return macros.char;
      }
      return whole;
    });
    if (!changed || next === text) return next;
    text = next;
  }
  return text;
}

function selectedGroup(preset) {
  if (preset.orderGroups.length === 0) return null;
  const index = Math.min(preset.orderGroups.length - 1, Math.max(0, preset.selectedOrderIndex));
  return preset.orderGroups[index];
}

function buildPromptText(preset) {
  const group = selectedGroup(preset);
  if (group === null) return "";
  const byIdentifier = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
  const variables = new Map();
  const blocks = [];
  const seen = new Set();
  for (const entry of group.entries) {
    if (entry.enabled === false || seen.has(entry.identifier)) continue;
    seen.add(entry.identifier);
    const prompt = byIdentifier.get(entry.identifier);
    if (prompt === undefined || prompt.marker) continue;
    if (prompt.content.trim() === "") continue;
    const content = expandMacros(prompt.content, variables, preset.macros).trim();
    if (content === "") continue;
    blocks.push(`## ${prompt.name || prompt.identifier}\n\n${content}`);
  }
  if (blocks.length === 0) return "";
  return [
    `# SillyTavern AI preset: ${preset.name}`,
    "The following is user-authored guidance imported from a SillyTavern AI preset. Apply it consistently to this conversation.",
    ...blocks,
  ].join("\n\n");
}

function countEffectivePrompts(preset) {
  const group = selectedGroup(preset);
  if (group === null) return 0;
  const byIdentifier = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
  return group.entries.filter((entry) => {
    if (entry.enabled === false) return false;
    const prompt = byIdentifier.get(entry.identifier);
    return prompt !== undefined && !prompt.marker && prompt.content.trim() !== "";
  }).length;
}

/* ---------------------------------------------------------------- export */

function exportPreset(preset) {
  const raw = isPlainObject(preset.raw) ? structuredClone(preset.raw) : {};
  const originals = new Map();
  if (Array.isArray(raw.prompts)) {
    for (const item of raw.prompts) {
      if (!isPlainObject(item)) continue;
      const identifier = cleanIdentifier(item.identifier);
      if (identifier !== "" && !originals.has(identifier)) originals.set(identifier, item);
    }
  }
  raw.prompts = preset.prompts.map((prompt) => {
    const original = originals.get(prompt.identifier);
    return {
      ...(isPlainObject(original) ? original : {}),
      identifier: prompt.identifier,
      name: prompt.name,
      role: prompt.role,
      content: prompt.content,
      marker: prompt.marker,
      system_prompt: prompt.systemPrompt,
      injection_position: prompt.injectionPosition,
      injection_depth: prompt.injectionDepth,
      injection_order: prompt.injectionOrder,
    };
  });
  if (preset.orderGroups.length > 0) {
    raw.prompt_order = preset.orderGroups.map((group, index) => ({
      character_id: Number.isInteger(group.characterId) ? group.characterId : 100_000 + index,
      order: group.entries.map((entry) => ({
        identifier: entry.identifier,
        enabled: entry.enabled !== false,
      })),
    }));
  }
  const parameterKeys = {
    temperature: "temperature",
    maxTokens: "openai_max_tokens",
    openaiMaxContext: "openai_max_context",
    topP: "top_p",
    topK: "top_k",
    topA: "top_a",
    minP: "min_p",
    frequencyPenalty: "frequency_penalty",
    presencePenalty: "presence_penalty",
    repetitionPenalty: "repetition_penalty",
    seed: "seed",
  };
  for (const [sourceKey, targetKey] of Object.entries(parameterKeys)) {
    const value = preset.params[sourceKey];
    if (value === null || value === undefined) {
      delete raw[targetKey];
    } else {
      raw[targetKey] = value;
    }
  }
  return raw;
}

/* ----------------------------------------------------------------- state */

function findPreset(id) {
  return state.presets.find((preset) => preset.id === id) ?? null;
}

function activePreset() {
  if (!state.enabled || state.activeId === null) return null;
  const preset = findPreset(state.activeId);
  if (preset === null || preset.archived) return null;
  return preset;
}

function getPresetOrThrow(id) {
  const preset = findPreset(id);
  if (preset === null) {
    throw new HttpFailure(404, "PRESET_NOT_FOUND", "That preset no longer exists.");
  }
  return preset;
}

function summary(preset) {
  return {
    id: preset.id,
    name: preset.name,
    sourceFileName: preset.sourceFileName,
    importedAt: preset.importedAt,
    updatedAt: preset.updatedAt,
    archived: preset.archived,
    active: state.activeId === preset.id,
    promptCount: preset.prompts.length,
    effectivePromptCount: countEffectivePrompts(preset),
    orderGroupCount: preset.orderGroups.length,
    selectedOrderIndex: preset.selectedOrderIndex,
    temperature: preset.params.temperature,
    maxTokens: preset.params.maxTokens,
  };
}

function publicState() {
  return {
    ok: true,
    enabled: state.enabled,
    activeId: state.activeId,
    presets: state.presets.map(summary),
    dataFile: dataFile(),
  };
}

function publicPreset(preset) {
  const { raw, ...rest } = preset;
  return { ok: true, preset: rest };
}

function notifyPromptChanged(ctx) {
  try {
    ctx.emit("system-prompt/change");
  } catch {
    /* the next assembly picks up the state anyway */
  }
}

/* -------------------------------------------------------------- validation */

function draftFromBody(body, existing) {
  const input = isPlainObject(body.preset) ? body.preset : body;
  if (!isPlainObject(input)) {
    throw new HttpFailure(400, "INVALID_PRESET", "The preset payload must be an object.");
  }
  const prompts = normalizePrompts(input.prompts);
  const orderGroups = normalizeOrderGroups(input.orderGroups, prompts);
  const params = normalizeParams(input.params);
  const selectedOrderIndex = orderGroups.length === 0
    ? 0
    : Math.min(
        orderGroups.length - 1,
        Math.max(0, toInteger(input.selectedOrderIndex) ?? 0),
      );
  return {
    ...existing,
    name: uniqueName(cleanName(input.name, existing.name), state.presets, existing.id),
    sourceFileName: existing.sourceFileName,
    importedAt: existing.importedAt,
    updatedAt: Date.now(),
    selectedOrderIndex,
    params,
    apply: normalizeApply(input.apply, params),
    macros: normalizeMacros(input.macros),
    prompts,
    orderGroups,
    archived: input.archived === true,
  };
}

/* ------------------------------------------------------------------ http */

function sendJson(response, status, payload) {
  if (response.writableEnded) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin !== "string" || origin === "") return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      throw new HttpFailure(413, "PAYLOAD_TOO_LARGE", "The uploaded preset is too large.");
    }
    chunks.push(buffer);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpFailure(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}

function parsePresetDocument(body) {
  let document = body.json;
  if (typeof document === "string") {
    try {
      document = JSON.parse(document);
    } catch {
      throw new HttpFailure(400, "INVALID_PRESET_JSON", "The selected file is not valid JSON.");
    }
  }
  if (!isPlainObject(document)) {
    throw new HttpFailure(400, "INVALID_PRESET", "The selected file is not a SillyTavern preset object.");
  }
  const hasPrompts = Array.isArray(document.prompts);
  const hasOrder = Array.isArray(document.prompt_order);
  if (!hasPrompts && !hasOrder) {
    throw new HttpFailure(
      400,
      "NOT_A_SILLYTAVERN_PRESET",
      "The JSON has no prompts or prompt_order field, so it does not look like a SillyTavern preset.",
    );
  }
  if ((!hasPrompts || document.prompts.length === 0) && (!hasOrder || document.prompt_order.length === 0)) {
    throw new HttpFailure(400, "EMPTY_PRESET", "The preset contains no prompts.");
  }
  return document;
}

async function handle(ctx, request, response) {
  let url;
  try {
    url = new URL(request.url ?? "/", "http://dsh.local");
  } catch {
    throw new HttpFailure(400, "BAD_URL", "The request URL is invalid.");
  }
  if (!url.pathname.startsWith(ROUTE_PREFIX)) {
    throw new HttpFailure(404, "NOT_FOUND", "Unknown route.");
  }
  const segments = url.pathname
    .slice(ROUTE_PREFIX.length)
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  const method = request.method ?? "GET";

  if (method === "GET" && segments.length === 1 && segments[0] === "state") {
    await ensureLoaded();
    return sendJson(response, 200, publicState());
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "enabled") {
    if (!sameOrigin(request)) {
      throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
    }
    const body = await readJsonBody(request);
    const enabled = body.enabled === true;
    await mutate((current) => ({ ...current, enabled }));
    notifyPromptChanged(ctx);
    return sendJson(response, 200, publicState());
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "import") {
    if (!sameOrigin(request)) {
      throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
    }
    const body = await readJsonBody(request);
    const document = parsePresetDocument(body);
    const fileName = toText(body.fileName, 400);
    const imported = normalizeImported(document, fileName);
    let created = null;
    await mutate((current) => {
      const preset = { ...imported, name: uniqueName(imported.name, current.presets) };
      created = preset;
      return { ...current, presets: [...current.presets, preset] };
    });
    return sendJson(response, 200, { ...publicPreset(created), state: publicState() });
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "new") {
    if (!sameOrigin(request)) {
      throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
    }
    const body = await readJsonBody(request);
    let created = null;
    await mutate((current) => {
      const preset = {
        id: randomUUID(),
        name: uniqueName(cleanName(body.name, "New preset"), current.presets),
        sourceFileName: "",
        importedAt: Date.now(),
        updatedAt: Date.now(),
        selectedOrderIndex: 0,
        params: normalizeParams({}),
        apply: { temperature: false, maxTokens: false },
        macros: { user: "", char: "" },
        prompts: [],
        orderGroups: [{ characterId: null, entries: [] }],
        archived: false,
        raw: {},
      };
      created = preset;
      return { ...current, presets: [...current.presets, preset] };
    });
    return sendJson(response, 200, { ...publicPreset(created), state: publicState() });
  }

  if (segments[0] === "presets" && segments.length >= 2) {
    const id = segments[1];
    const action = segments[2] ?? "detail";

    if (method === "GET" && action === "detail") {
      await ensureLoaded();
      return sendJson(response, 200, publicPreset(getPresetOrThrow(id)));
    }

    if (method === "GET" && action === "export") {
      await ensureLoaded();
      const preset = getPresetOrThrow(id);
      const json = JSON.stringify(exportPreset(preset), null, 2);
      return sendJson(response, 200, {
        ok: true,
        fileName: `${safeFileName(preset.name)}.json`,
        json,
      });
    }

    if (method === "POST" && action === "select") {
      if (!sameOrigin(request)) {
        throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
      }
      await ensureLoaded();
      getPresetOrThrow(id);
      await mutate((current) => {
        const preset = current.presets.find((item) => item.id === id);
        if (preset === undefined) {
          throw new HttpFailure(404, "PRESET_NOT_FOUND", "That preset no longer exists.");
        }
        if (preset.archived) {
          throw new HttpFailure(409, "PRESET_ARCHIVED", "Restore this preset before using it.");
        }
        return { ...current, enabled: true, activeId: id };
      });
      notifyPromptChanged(ctx);
      return sendJson(response, 200, publicState());
    }

    if (method === "POST" && action === "save") {
      if (!sameOrigin(request)) {
        throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
      }
      const body = await readJsonBody(request);
      let saved = null;
      await mutate((current) => {
        const preset = current.presets.find((item) => item.id === id);
        if (preset === undefined) {
          throw new HttpFailure(404, "PRESET_NOT_FOUND", "That preset no longer exists.");
        }
        const next = draftFromBody(body, preset);
        saved = next;
        const presets = current.presets.map((item) => (item.id === id ? next : item));
        const activeId = next.archived && current.activeId === id ? null : current.activeId;
        return { ...current, activeId, presets };
      });
      notifyPromptChanged(ctx);
      return sendJson(response, 200, { ...publicPreset(saved), state: publicState() });
    }

    if (method === "DELETE" && action === "detail") {
      if (!sameOrigin(request)) {
        throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
      }
      let deleted = null;
      await mutate((current) => {
        const preset = current.presets.find((item) => item.id === id);
        if (preset === undefined) {
          throw new HttpFailure(404, "PRESET_NOT_FOUND", "That preset no longer exists.");
        }
        deleted = { id: preset.id, name: preset.name };
        return {
          ...current,
          activeId: current.activeId === id ? null : current.activeId,
          presets: current.presets.filter((item) => item.id !== id),
        };
      });
      notifyPromptChanged(ctx);
      return sendJson(response, 200, { ok: true, deleted, state: publicState() });
    }

    if (method === "POST" && action === "archive") {
      if (!sameOrigin(request)) {
        throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
      }
      const body = await readJsonBody(request);
      const archived = body.archived !== false;
      let updated = null;
      await mutate((current) => {
        const preset = current.presets.find((item) => item.id === id);
        if (preset === undefined) {
          throw new HttpFailure(404, "PRESET_NOT_FOUND", "That preset no longer exists.");
        }
        updated = { ...preset, archived, updatedAt: Date.now() };
        const activeId = archived && current.activeId === id ? null : current.activeId;
        return {
          ...current,
          activeId,
          presets: current.presets.map((item) => (item.id === id ? updated : item)),
        };
      });
      notifyPromptChanged(ctx);
      return sendJson(response, 200, { ...publicPreset(updated), state: publicState() });
    }

    if (method === "POST" && action === "duplicate") {
      if (!sameOrigin(request)) {
        throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
      }
      let copy = null;
      await mutate((current) => {
        const preset = current.presets.find((item) => item.id === id);
        if (preset === undefined) {
          throw new HttpFailure(404, "PRESET_NOT_FOUND", "That preset no longer exists.");
        }
        copy = {
          ...structuredClone(preset),
          id: randomUUID(),
          name: uniqueName(`${preset.name} (copy)`, current.presets),
          importedAt: Date.now(),
          updatedAt: Date.now(),
          archived: false,
        };
        return { ...current, presets: [...current.presets, copy] };
      });
      return sendJson(response, 200, { ...publicPreset(copy), state: publicState() });
    }

    if (method === "POST" && action === "preview") {
      if (!sameOrigin(request)) {
        throw new HttpFailure(403, "CROSS_ORIGIN", "Cross-origin writes are not allowed.");
      }
      const body = await readJsonBody(request);
      await ensureLoaded();
      const existing = getPresetOrThrow(id);
      const draft = draftFromBody(body, existing);
      const text = buildPromptText(draft);
      return sendJson(response, 200, {
        ok: true,
        text,
        chars: text.length,
        enabledPrompts: countEffectivePrompts(draft),
      });
    }
  }

  throw new HttpFailure(404, "NOT_FOUND", "Unknown route.");
}

/* ------------------------------------------------------------------ plugin */

export const inject = ["webServer", "systemPrompt"];

export function apply(ctx) {
  void ensureLoaded().catch((error) => {
    ctx.logger?.warn?.(
      new Error(`dsh-sillytavern-presets: cannot read the preset store — ${error instanceof Error ? error.message : String(error)}`),
    );
  });

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: 500,
        interpolate: false,
        text: () => {
          const preset = activePreset();
          return preset === null ? "" : buildPromptText(preset);
        },
      }),
    "dsh-sillytavern-presets: system prompt",
  );

  ctx.effect(
    () =>
      ctx.on("agent/request", async (_payload, next) => {
        const config = await next();
        const preset = activePreset();
        if (preset === null) return config;
        let changed = false;
        const nextConfig = { ...config };
        if (preset.apply.temperature && preset.params.temperature !== null) {
          nextConfig.temperature = preset.params.temperature;
          changed = true;
        }
        if (preset.apply.maxTokens && preset.params.maxTokens !== null) {
          nextConfig.maxTokens = preset.params.maxTokens;
          changed = true;
        }
        return changed ? nextConfig : config;
      }),
    "dsh-sillytavern-presets: sampling parameters",
  );

  ctx.effect(
    () => {
      const dispose = ctx.webServer.register({
        kind: "prefix",
        path: ROUTE_PREFIX,
        handler: async (request, response) => {
          try {
            await handle(ctx, request, response);
          } catch (error) {
            if (response.writableEnded) return;
            if (error instanceof HttpFailure) {
              sendJson(response, error.status, {
                ok: false,
                error: { code: error.code, message: error.message },
              });
              return;
            }
            ctx.logger?.warn?.(
              new Error(`dsh-sillytavern-presets: request failed — ${error instanceof Error ? error.stack ?? error.message : String(error)}`),
            );
            sendJson(response, 500, {
              ok: false,
              error: { code: "INTERNAL", message: "The preset manager hit an internal error." },
            });
          }
        },
      });
      return () => dispose();
    },
    "dsh-sillytavern-presets: http routes",
  );
}
