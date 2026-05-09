// ../../../../.nvm/versions/node/v22.18.0/lib/node_modules/openclaw/dist/plugin-cache-primitives-WfwcOrBF.js
var PluginLruCache = class {
  #defaultMaxEntries;
  #maxEntries;
  #entries = /* @__PURE__ */ new Map();
  constructor(defaultMaxEntries) {
    this.#defaultMaxEntries = normalizeMaxEntries(defaultMaxEntries, 1);
    this.#maxEntries = this.#defaultMaxEntries;
  }
  get maxEntries() {
    return this.#maxEntries;
  }
  get size() {
    return this.#entries.size;
  }
  setMaxEntriesForTest(value) {
    this.#maxEntries = typeof value === "number" ? normalizeMaxEntries(value, this.#defaultMaxEntries) : this.#defaultMaxEntries;
    this.#evictOldestEntries();
  }
  clear() {
    this.#entries.clear();
  }
  get(cacheKey) {
    const cached = this.getResult(cacheKey);
    return cached.hit ? cached.value : void 0;
  }
  getResult(cacheKey) {
    if (!this.#entries.has(cacheKey)) return { hit: false };
    const cached = this.#entries.get(cacheKey);
    this.#entries.delete(cacheKey);
    this.#entries.set(cacheKey, cached);
    return {
      hit: true,
      value: cached
    };
  }
  set(cacheKey, value) {
    if (this.#entries.has(cacheKey)) this.#entries.delete(cacheKey);
    this.#entries.set(cacheKey, value);
    this.#evictOldestEntries();
  }
  #evictOldestEntries() {
    while (this.#entries.size > this.#maxEntries) {
      const oldestEntry = this.#entries.keys().next();
      if (oldestEntry.done) break;
      this.#entries.delete(oldestEntry.value);
    }
  }
};
function normalizeMaxEntries(value, fallback) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.floor(value));
}

// ../../../../.nvm/versions/node/v22.18.0/lib/node_modules/openclaw/dist/ansi-Dqm1lzVL.js
var ANSI_CSI_PATTERN = "\\x1b\\[[\\x20-\\x3f]*[\\x40-\\x7e]";
var OSC8_PATTERN = "\\x1b\\]8;;.*?(?:\\x1b\\\\|\\x07)|\\x1b\\]8;;(?:\\x1b\\\\|\\x07)";
var ANSI_CSI_REGEX = new RegExp(ANSI_CSI_PATTERN, "g");
var OSC8_REGEX = new RegExp(OSC8_PATTERN, "g");
var graphemeSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;

// ../../../../.nvm/versions/node/v22.18.0/lib/node_modules/openclaw/dist/schema-validator-DSVrkbYC.js
import { createRequire } from "node:module";
var require2 = createRequire(import.meta.url);
var schemaCache = new PluginLruCache(512);

// ../../../../.nvm/versions/node/v22.18.0/lib/node_modules/openclaw/dist/config-schema-DDtADzVW.js
function error(message) {
  return {
    success: false,
    error: { issues: [{
      path: [],
      message
    }] }
  };
}
function emptyPluginConfigSchema() {
  return {
    safeParse(value) {
      if (value === void 0) return {
        success: true,
        data: void 0
      };
      if (!value || typeof value !== "object" || Array.isArray(value)) return error("expected config object");
      if (Object.keys(value).length > 0) return error("config must be empty");
      return {
        success: true,
        data: value
      };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  };
}

// ../../../../.nvm/versions/node/v22.18.0/lib/node_modules/openclaw/dist/plugin-entry-DUUsLt7Y.js
function createCachedLazyValueGetter(value, fallback) {
  let resolved = false;
  let cached;
  return () => {
    if (!resolved) {
      cached = (typeof value === "function" ? value() : value) ?? fallback;
      resolved = true;
    }
    return cached;
  };
}
function definePluginEntry({ id, name, description, kind, configSchema = emptyPluginConfigSchema, reload, nodeHostCommands, securityAuditCollectors, register }) {
  const getConfigSchema = createCachedLazyValueGetter(configSchema);
  return {
    id,
    name,
    description,
    ...kind ? { kind } : {},
    ...reload ? { reload } : {},
    ...nodeHostCommands ? { nodeHostCommands } : {},
    ...securityAuditCollectors ? { securityAuditCollectors } : {},
    get configSchema() {
      return getConfigSchema();
    },
    register
  };
}

// index.ts
import { mkdir, writeFile, appendFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as crypto from "node:crypto";
function hash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 8);
}
function localDateStr(now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function localTimestamp(now) {
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}${min}${s}`;
}
var index_default = definePluginEntry({
  id: "prompt-logger",
  name: "Prompt Logger",
  register(api) {
    const log = api.logger ?? console;
    const pluginCfg = api.config ?? {};
    const retentionDays = pluginCfg.retentionDays ?? 30;
    const logInput = pluginCfg.logInput !== false;
    const logOutput = pluginCfg.logOutput !== false;
    function getOutputDir(ctx) {
      return join(ctx.workspaceDir ?? process.cwd(), "prompts");
    }
    async function ensureDir(dir) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
    async function cleanOldFiles(rawDir) {
      try {
        const cutoff = Date.now() - retentionDays * 864e5;
        const files = await readdir(rawDir);
        for (const f of files) {
          if (!f.endsWith(".json")) continue;
          const datePart = f.slice(0, 10);
          const ts = (/* @__PURE__ */ new Date(datePart + "T00:00:00+08:00")).getTime();
          if (!isNaN(ts) && ts < cutoff) {
            await unlink(join(rawDir, f)).catch(() => {
            });
          }
        }
      } catch {
      }
    }
    async function writeRecord(runId, data, ctx) {
      const outputDir = getOutputDir(ctx);
      const rawDir = join(outputDir, "raw");
      await ensureDir(rawDir);
      const now = /* @__PURE__ */ new Date();
      const dateStr = localDateStr(now);
      const tsStr = localTimestamp(now);
      const record = {
        ts: now.toISOString(),
        meta: data.meta,
        output: data.output
      };
      const rawContent = JSON.stringify(record);
      const inputHash = hash(rawContent.slice(0, 500));
      const rawFilename = `${dateStr}-${tsStr}-prompt-${inputHash}.json`;
      const rawPath = join(rawDir, rawFilename);
      await writeFile(rawPath, JSON.stringify(record, null, 2), "utf-8");
      const m = data.meta;
      const out = data.output ?? {};
      const usage = out.usage ?? {};
      const stripped = {
        ts: now.toISOString(),
        runId,
        session: m.sessionKey ?? m.sessionId,
        model: m.model ? `${m.provider}/${m.model}` : m.model,
        provider: m.provider,
        agentId: m.agentId,
        channel: m.channel,
        agentDurationMs: m.durationMs,
        success: m.success,
        error: m.error,
        inputTokens: usage.input,
        outputTokens: usage.output,
        rawFile: `raw/${rawFilename}`
      };
      const indexPath = join(outputDir, `${dateStr}.jsonl`);
      await appendFile(indexPath, JSON.stringify(stripped) + "\n", "utf-8");
      cleanOldFiles(rawDir).catch(() => {
      });
      log.info?.("prompt-logger: wrote %s", rawFilename);
    }
    const runs = /* @__PURE__ */ new Map();
    const callToRun = /* @__PURE__ */ new Map();
    api.on(
      "model_call_started",
      (event, ctx) => {
        const runId = event.runId;
        if (!runId) return;
        callToRun.set(event.callId, runId);
        if (!runs.has(runId)) {
          runs.set(runId, {
            meta: {
              sessionKey: ctx.sessionKey,
              sessionId: event.sessionId,
              agentId: ctx.agentId,
              provider: event.provider,
              model: event.model,
              api: event.api,
              channel: ctx.messageProvider,
              channelId: ctx.channelId,
              trigger: ctx.trigger,
              traceId: ctx.trace?.traceId,
              callId: event.callId
            },
            output: null
          });
        }
      },
      { priority: 100 }
    );
    api.on(
      "llm_output",
      (event, _ctx) => {
        if (!event.runId || !runs.has(event.runId)) return;
        const data = runs.get(event.runId);
        if (logOutput) {
          data.output = {
            assistantTexts: event.assistantTexts,
            resolvedRef: event.resolvedRef,
            harnessId: event.harnessId,
            usage: event.usage ?? {}
          };
        }
        if (!data.meta.provider && event.resolvedRef) {
          const parts = event.resolvedRef.split("/");
          if (parts.length >= 2) {
            data.meta.provider = parts[0];
            data.meta.model = parts.slice(1).join("/");
          } else {
            data.meta.model = event.resolvedRef;
          }
        }
      },
      { priority: 100 }
    );
    api.on(
      "model_call_ended",
      (event, _ctx) => {
        const runId = callToRun.get(event.callId);
        callToRun.delete(event.callId);
        if (!runId || !runs.has(runId)) return;
        const data = runs.get(runId);
        data.meta.durationMs = event.durationMs;
        data.meta.outcome = event.outcome;
        data.meta.errorCategory = event.errorCategory;
        data.meta.requestPayloadBytes = event.requestPayloadBytes;
        data.meta.responseStreamBytes = event.responseStreamBytes;
      },
      { priority: 100 }
    );
    api.on(
      "agent_end",
      async (event, ctx) => {
        const runId = event.runId ?? crypto.randomUUID();
        const msgs = event.messages;
        if (!runs.has(runId)) {
          runs.set(runId, {
            meta: {
              sessionKey: ctx.sessionKey,
              sessionId: ctx.sessionKey,
              agentId: ctx.agentId,
              channel: ctx.messageProvider,
              channelId: ctx.channelId,
              trigger: ctx.trigger,
              traceId: ctx.trace?.traceId,
              success: event.success,
              durationMs: event.durationMs,
              error: event.error,
              messageCount: msgs?.length ?? 0
            },
            output: null
          });
        }
        const data = runs.get(runId);
        data.meta.success = event.success;
        data.meta.error = event.error;
        if (event.durationMs) data.meta.durationMs = event.durationMs;
        data.meta.messageCount = msgs?.length ?? 0;
        if (logInput) {
          data.meta.messages = msgs ?? [];
        }
        await writeRecord(runId, data, ctx);
      },
      { priority: 100 }
    );
  }
});
export {
  index_default as default
};
