<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://clawhub.ai/static/logos/clawhub-white.svg">
  <img alt="ClawHub" src="https://clawhub.ai/static/logos/clawhub-color.svg" width="40" height="40" align="left">
</picture>

# Prompt Logger

[![ClawHub](https://img.shields.io/badge/ClawHub-prompt--logger-blue)](https://clawhub.ai)

An OpenClaw plugin that records **every complete LLM request** (system prompt, conversation history, tool calls, responses, token usage) to disk as structured JSON files.

> Built for debugging — never wonder what OpenClaw actually sent to the model again.

---

## How it works

The plugin uses [Plugin Hooks](https://docs.openclaw.ai/plugins/hooks) (`model_call_started`, `llm_output`, `model_call_ended`, `agent_end`) to capture everything the Gateway sends to the LLM provider.

### Output structure

```
<workspace>/prompts/
├── 2026-05-09.jsonl          # Lightweight index (search with jq/grep)
├── 2026-05-10.jsonl
└── raw/
    ├── 2026-05-09-104212-prompt-a1b2c3d4.json   # Full request
    └── 2026-05-10-091500-prompt-e5f6g7h8.json
```

### JSONL index (quick search)

Each line contains key metadata:

```json
{
  "ts": "2026-05-09T02:42:12.608Z",
  "session": "agent:main:...",
  "model": "custom-provider/model-name",
  "inputTokens": 24072,
  "outputTokens": 70,
  "success": true,
  "rawFile": "raw/2026-05-09-104212-prompt-xxx.json"
}
```

### Raw files (full details)

Each raw file contains the complete agent messages array (system prompt, user messages, assistant replies, tool calls/results) plus LLM usage and timing info.

---

## Installation

```bash
openclaw plugin install prompt-logger
```

> Requires OpenClaw Gateway **v2026.5.0** or later.

## Configuration

Add to `openclaw.json`:

```json5
{
  "plugins": {
    "entries": {
      "prompt-logger": {
        "enabled": true,
        // Required: this plugin uses llm_output/agent_end hooks which
        // need explicit conversation access opt-in (security gate)
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "retentionDays": 30,   // Auto-delete raw files older than N days
          "logInput": true,       // Record full prompt messages
          "logOutput": true       // Record LLM responses
        }
      }
    }
  }
}
```

**⚠️ Important:** Without `hooks.allowConversationAccess: true`, the plugin will load but silently produce no output. This is a Gateway security measure — non-bundled code plugins that access raw conversation content must opt in explicitly.

## Query examples

```bash
# Find all failed requests today
jq 'select(.success == false)' prompts/2026-05-09.jsonl

# Find requests for a specific model
jq 'select(.model | test("deepseek"))' prompts/2026-05-09.jsonl

# Count total tokens used today
cat prompts/2026-05-09.jsonl | jq -s 'map(.inputTokens + .outputTokens) | add'

# View a specific full prompt
less prompts/raw/2026-05-09-104212-prompt-xxx.json
```

## Disk usage

Each raw file is **100-500 KB** depending on conversation length. The JSONL index is negligible (~200 bytes/entry). With `retentionDays: 30`, old files are cleaned automatically.

---

## Publishing

1. Create an account on [clawhub.ai](https://clawhub.ai)
2. Install the clawhub CLI: `npm i -g clawhub`
3. Run `clawhub login`
4. Publish:

```bash
clawhub package publish prompt-logger --dry-run
clawhub package publish prompt-logger
```

---

## License

MIT
