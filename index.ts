import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { mkdir, writeFile, appendFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as crypto from "node:crypto";

// ── Helpers ──
function hash(s: string): string {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 8);
}

function localDateStr(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localTimestamp(now: Date): string {
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}${min}${s}`;
}

// ── Plugin ──
export default definePluginEntry({
  id: "prompt-logger",
  name: "Prompt Logger",
  register(api) {
    const log = api.logger ?? console;

    // Read plugin config from openclaw.json
    const pluginCfg = (api.config as Record<string, unknown>) ?? {};
    const retentionDays = (pluginCfg.retentionDays as number) ?? 30;
    const logInput = pluginCfg.logInput !== false;
    const logOutput = pluginCfg.logOutput !== false;

    function getOutputDir(ctx: { workspaceDir?: string }): string {
      return join(ctx.workspaceDir ?? process.cwd(), "prompts");
    }

    async function ensureDir(dir: string) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    /** Clean up raw files older than retentionDays */
    async function cleanOldFiles(rawDir: string) {
      try {
        const cutoff = Date.now() - retentionDays * 86_400_000;
        const files = await readdir(rawDir);
        for (const f of files) {
          if (!f.endsWith(".json")) continue;
          const datePart = f.slice(0, 10);
          const ts = new Date(datePart + "T00:00:00+08:00").getTime();
          if (!isNaN(ts) && ts < cutoff) {
            await unlink(join(rawDir, f)).catch(() => {});
          }
        }
      } catch {
        // best-effort
      }
    }

    async function writeRecord(
      runId: string,
      data: { meta: Record<string, unknown>; output: Record<string, unknown> | null },
      ctx: { workspaceDir?: string },
    ) {
      const outputDir = getOutputDir(ctx);
      const rawDir = join(outputDir, "raw");
      await ensureDir(rawDir);

      const now = new Date();
      const dateStr = localDateStr(now);
      const tsStr = localTimestamp(now);

      const record: Record<string, unknown> = {
        ts: now.toISOString(),
        meta: data.meta,
        output: data.output,
      };

      const rawContent = JSON.stringify(record);
      const inputHash = hash(rawContent.slice(0, 500));
      const rawFilename = `${dateStr}-${tsStr}-prompt-${inputHash}.json`;
      const rawPath = join(rawDir, rawFilename);

      // Write full prompt JSON
      await writeFile(rawPath, JSON.stringify(record, null, 2), "utf-8");

      // JSONL index (stripped metadata)
      const m = data.meta;
      const out = data.output ?? {};
      const usage = (out.usage ?? {}) as Record<string, unknown>;
      const stripped: Record<string, unknown> = {
        ts: now.toISOString(),
        runId,
        session: m.sessionKey ?? m.sessionId,
        model: m.model ? `${m.provider}/${m.model}` : (m.model as string),
        provider: m.provider,
        agentId: m.agentId,
        channel: m.channel,
        agentDurationMs: m.durationMs,
        success: m.success,
        error: m.error,
        inputTokens: usage.input,
        outputTokens: usage.output,
        rawFile: `raw/${rawFilename}`,
      };
      const indexPath = join(outputDir, `${dateStr}.jsonl`);
      await appendFile(indexPath, JSON.stringify(stripped) + "\n", "utf-8");

      // Periodic cleanup (once per write, lightweight)
      cleanOldFiles(rawDir).catch(() => {});

      log.info?.("prompt-logger: wrote %s", rawFilename);
    }

    const runs = new Map<
      string,
      { meta: Record<string, unknown>; output: Record<string, unknown> | null }
    >();
    const callToRun = new Map<string, string>();

    // ── model_call_started: capture provider/model/trace ──
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
              api: (event as Record<string, unknown>).api,
              channel: ctx.messageProvider,
              channelId: ctx.channelId,
              trigger: ctx.trigger,
              traceId: ctx.trace?.traceId,
              callId: event.callId,
            },
            output: null,
          });
        }
      },
      { priority: 100 },
    );

    // ── llm_output: capture response text + usage ──
    api.on(
      "llm_output",
      (event, _ctx) => {
        if (!event.runId || !runs.has(event.runId)) return;
        const data = runs.get(event.runId)!;
        if (logOutput) {
          data.output = {
            assistantTexts: event.assistantTexts,
            resolvedRef: event.resolvedRef,
            harnessId: event.harnessId,
            usage: event.usage ?? {},
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
      { priority: 100 },
    );

    // ── model_call_ended: duration, outcome, bytes ──
    api.on(
      "model_call_ended",
      (event, _ctx) => {
        const runId = callToRun.get(event.callId);
        callToRun.delete(event.callId);
        if (!runId || !runs.has(runId)) return;
        const data = runs.get(runId)!;
        data.meta.durationMs = event.durationMs;
        data.meta.outcome = event.outcome;
        data.meta.errorCategory = event.errorCategory;
        data.meta.requestPayloadBytes = event.requestPayloadBytes;
        data.meta.responseStreamBytes = event.responseStreamBytes;
      },
      { priority: 100 },
    );

    // ── agent_end: final messages + write ──
    api.on(
      "agent_end",
      async (event, ctx) => {
        const runId = event.runId ?? crypto.randomUUID();
        const msgs = event.messages as Array<Record<string, unknown>> | undefined;

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
              messageCount: msgs?.length ?? 0,
            },
            output: null,
          });
        }

        const data = runs.get(runId)!;
        data.meta.success = event.success;
        data.meta.error = event.error;
        if (event.durationMs) data.meta.durationMs = event.durationMs;
        data.meta.messageCount = msgs?.length ?? 0;

        if (logInput) {
          data.meta.messages = msgs ?? [];
        }

        await writeRecord(runId, data, ctx);
      },
      { priority: 100 },
    );
  },
});
