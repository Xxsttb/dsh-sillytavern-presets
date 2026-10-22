import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { apply } from "./lib/index.js";

const temp = await mkdtemp(path.join(os.tmpdir(), "dsh-stp-test-"));
process.env.DSH_SILLYTAVERN_PRESETS_DIR = temp;

const routes = [];
const sections = [];
const waterfalls = [];
const disposers = [];
const ctx = {
  effect(fn) {
    const value = fn();
    if (typeof value === "function") disposers.push(value);
    return value;
  },
  systemPrompt: {
    section(definition) {
      sections.push(definition);
      return () => {};
    },
  },
  on(event, handler) {
    waterfalls.push({ event, handler });
    return () => {};
  },
  webServer: {
    register(definition) {
      routes.push(definition);
      return () => {};
    },
  },
  logger: {
    warn(error) {
      process.stderr.write(`warn: ${error?.message ?? error}\n`);
    },
  },
  emit() {},
};

apply(ctx);
if (routes.length !== 1) throw new Error(`expected one route, got ${routes.length}`);
if (sections.length !== 1) throw new Error(`expected one section, got ${sections.length}`);
if (!waterfalls.some((item) => item.event === "agent/request")) {
  throw new Error("agent/request waterfall missing");
}

const server = http.createServer((request, response) => routes[0].handler(request, response));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/plugins/sillytavern-presets`;

async function request(pathname, init = {}) {
  const response = await fetch(base + pathname, init);
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

const preset = {
  temperature: 0.7,
  openai_max_tokens: 512,
  top_p: 0.9,
  prompts: [
    {
      identifier: "main",
      name: "Main",
      role: "system",
      content: "You are a concise assistant.",
      system_prompt: true,
      marker: false,
      enabled: true,
    },
    {
      identifier: "style",
      name: "Style",
      role: "system",
      content: "Use short paragraphs.",
      enabled: true,
    },
    {
      identifier: "chatHistory",
      name: "Chat History",
      role: "system",
      content: "",
      marker: true,
      enabled: true,
    },
    {
      identifier: "off",
      name: "Disabled",
      role: "system",
      content: "SHOULD NOT APPEAR",
      enabled: false,
    },
  ],
  prompt_order: [
    {
      character_id: 100000,
      order: [
        { identifier: "main", enabled: true },
        { identifier: "style", enabled: true },
        { identifier: "chatHistory", enabled: true },
        { identifier: "off", enabled: false },
      ],
    },
  ],
};

let result = await request("/state");
if (result.status !== 200 || result.data.presets.length !== 0) throw new Error("initial state failed");

result = await request("/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ json: preset, fileName: "Benign test.json" }),
});
if (result.status !== 200) throw new Error(`import failed: ${JSON.stringify(result)}`);
const id = result.data.preset.id;
if (result.data.preset.name !== "Benign test") throw new Error("import name");
if (result.data.preset.temperature !== undefined) throw new Error("detail must not expose state summary fields");

result = await request(`/presets/${id}`);
if (result.status !== 200 || result.data.preset.prompts.length !== 4) throw new Error("detail failed");
if ("raw" in result.data.preset) throw new Error("raw leaked to client");

result = await request(`/presets/${id}/select`, { method: "POST", body: "{}" });
if (result.status !== 200 || result.data.activeId !== id) throw new Error("select failed");

const text = sections[0].text();
if (!text.includes("You are a concise assistant.")) throw new Error("main prompt missing");
if (!text.includes("Use short paragraphs.")) throw new Error("style prompt missing");
if (text.includes("SHOULD NOT APPEAR")) throw new Error("disabled prompt leaked");

const waterfall = waterfalls.find((item) => item.event === "agent/request").handler;
const config = await waterfall({}, async () => ({ provider: "p", model: "m", temperature: 1.5, maxTokens: 1000 }));
if (config.temperature !== 0.7 || config.maxTokens !== 512) throw new Error(`sampling not applied: ${JSON.stringify(config)}`);

const detail = await request(`/presets/${id}`);
result = await request(`/presets/${id}/preview`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ preset: detail.data.preset }),
});
if (result.status !== 200) throw new Error(`preview failed: ${JSON.stringify(result)}`);

const edited = detail.data.preset;
edited.name = "Benign edited";
edited.prompts[0].content = "You answer in one paragraph.";
edited.params.temperature = 0.3;
result = await request(`/presets/${id}/save`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ preset: edited }),
});
if (result.status !== 200 || result.data.preset.name !== "Benign edited") {
  throw new Error(`save failed: ${JSON.stringify(result)}`);
}
if (result.data.state.activeId !== id) throw new Error("save changed active preset");
if (!sections[0].text().includes("You answer in one paragraph.")) throw new Error("edited prompt not applied");

result = await request(`/presets/${id}/export`);
if (result.status !== 200) throw new Error("export failed");
const exported = JSON.parse(result.data.json);
if (exported.openai_max_tokens !== 512) throw new Error("exported max tokens");
if (exported.temperature !== 0.3) throw new Error("exported temperature");
if (!exported.prompts.some((item) => item.content === "You answer in one paragraph.")) {
  throw new Error("exported edited prompt");
}

result = await request(`/presets/${id}/archive`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ archived: true }),
});
if (result.status !== 200 || result.data.state.activeId !== null) throw new Error("archive failed");
result = await request(`/presets/${id}/select`, { method: "POST", body: "{}" });
if (result.status !== 409) throw new Error(`archived select should fail: ${result.status}`);
if (sections[0].text() !== "") throw new Error("archived preset still injected");

result = await request(`/presets/${id}/archive`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ archived: false }),
});
if (result.status !== 200) throw new Error("restore failed");
result = await request(`/presets/${id}/select`, { method: "POST", body: "{}" });
if (result.status !== 200) throw new Error("reselect failed");

result = await request("/enabled", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ enabled: false }),
});
if (result.status !== 200 || sections[0].text() !== "") throw new Error("disable failed");
const unchanged = await waterfall({}, async () => ({ provider: "p", model: "m", temperature: 1.5, maxTokens: 1000 }));
if (unchanged.temperature !== 1.5 || unchanged.maxTokens !== 1000) throw new Error("disabled sampling still applied");

result = await request("/enabled", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ enabled: true }),
});
if (result.status !== 200) throw new Error("re-enable failed");

result = await request(`/presets/${id}/duplicate`, { method: "POST", body: "{}" });
if (result.status !== 200) throw new Error("duplicate for delete failed");
const copyId = result.data.preset.id;
result = await request(`/presets/${copyId}/select`, { method: "POST", body: "{}" });
if (result.status !== 200 || result.data.activeId !== copyId) throw new Error("select copy failed");

result = await request(`/presets/${copyId}`, { method: "DELETE" });
if (result.status !== 200 || result.data.deleted.id !== copyId) {
  throw new Error(`delete failed: ${JSON.stringify(result)}`);
}
if (result.data.state.activeId !== null) throw new Error("deleting active preset did not clear activeId");
if (result.data.state.presets.length !== 1) throw new Error("delete left extra presets");
if (sections[0].text() !== "") throw new Error("deleted active preset still injected");
result = await request(`/presets/${copyId}`);
if (result.status !== 404) throw new Error(`deleted preset still readable: ${result.status}`);

const stored = JSON.parse(await readFile(path.join(temp, "presets.json"), "utf8"));
if (stored.presets.length !== 1 || stored.presets[0].id !== id) throw new Error("persistence failed");

server.close();
for (const dispose of disposers) dispose();
await rm(temp, { recursive: true, force: true });
console.log("host integration test passed");
