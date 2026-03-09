# tesserin-mcp

Standalone Node.js MCP server for [Tesserin](https://github.com/AnvinX1/Tesserin-pro).

**No Docker. No Python. No Electron build.** Just:

```bash
node tesserin-mcp/dist/index.js
```

## Tools (42 total)

| Category | Tools |
|---|---|
| Notes | `list_notes` `get_note` `get_note_by_title` `search_notes` `create_note` `update_note` `delete_note` `append_to_note` `pin_note` `archive_note` `get_recent_notes` `batch_create_notes` |
| Tags | `list_tags` `create_tag` `delete_tag` `add_tag_to_note` |
| Tasks | `list_tasks` `create_task` `update_task` `delete_task` |
| Folders | `list_folders` `create_folder` `delete_folder` |
| Graph / Vault | `get_knowledge_graph` `search_vault_context` `get_vault_context` `export_vault` `get_note_with_connections` `get_vault_summary` |
| Canvas | `create_diagram` `list_canvases` `get_canvas` `create_canvas` `update_canvas_name` `delete_canvas` `add_canvas_elements` |
| AI | `ai_chat` `ai_summarize` `ai_generate_tags` `ai_suggest_links` |
| Misc | `list_templates` `check_health` |

## Build

```bash
# From the repo root (requires Node.js ≥ 18):
pnpm mcp:build
# or directly:
cd tesserin-mcp && node --experimental-strip-types build.ts
```

Output: `tesserin-mcp/dist/index.js` — a single self-contained CJS bundle.

## Environment variables

| Variable | Default | Required |
|---|---|---|
| `TESSERIN_API_TOKEN` | — | ✅ Yes |
| `TESSERIN_API_URL` | `http://127.0.0.1:9960` | No |
| `TESSERIN_MCP_TRANSPORT` | `stdio` | No |
| `TESSERIN_MCP_PORT` | `3200` | No (HTTP mode only) |

Generate your token in **Tesserin → Settings → API → New API Key**.

---

## Client configuration snippets

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```jsonc
{
  "mcpServers": {
    "tesserin": {
      "command": "node",
      "args": ["/absolute/path/to/tesserin-mcp/dist/index.js"],
      "env": {
        "TESSERIN_API_TOKEN": "tsk_your_token_here",
        "TESSERIN_API_URL": "http://127.0.0.1:9960"
      }
    }
  }
}
```

> **Tip:** Replace `/absolute/path/to` with the full path to the repo, e.g. `/home/you/Tesserin-pro`.

---

### Cursor (`.cursor/mcp.json` in project root, or `~/.cursor/mcp.json` globally)

```jsonc
{
  "mcpServers": {
    "tesserin": {
      "command": "node",
      "args": ["/absolute/path/to/tesserin-mcp/dist/index.js"],
      "env": {
        "TESSERIN_API_TOKEN": "tsk_your_token_here",
        "TESSERIN_API_URL": "http://127.0.0.1:9960"
      }
    }
  }
}
```

---

### VS Code (`.vscode/settings.json` or user `settings.json`)

```jsonc
{
  "mcp": {
    "servers": {
      "tesserin": {
        "type": "stdio",
        "command": "node",
        "args": ["/absolute/path/to/tesserin-mcp/dist/index.js"],
        "env": {
          "TESSERIN_API_TOKEN": "tsk_your_token_here",
          "TESSERIN_API_URL": "http://127.0.0.1:9960"
        }
      }
    }
  }
}
```

---

### Gemini CLI (`~/.gemini/settings.json`)

```jsonc
{
  "mcpServers": {
    "tesserin": {
      "command": "node",
      "args": ["/absolute/path/to/tesserin-mcp/dist/index.js"],
      "env": {
        "TESSERIN_API_TOKEN": "tsk_your_token_here",
        "TESSERIN_API_URL": "http://127.0.0.1:9960"
      }
    }
  }
}
```

---

### HTTP/SSE transport (browser-based agents, OpenWebUI, cloud agents)

Start the server in HTTP mode:

```bash
TESSERIN_API_TOKEN=tsk_your_token_here \
  node tesserin-mcp/dist/index.js --http --port=3200
# or
pnpm mcp:start:http
```

Then configure your agent to connect to `http://localhost:3200`.

Health check: `curl http://localhost:3200/health`

---

## Transports

| Mode | How to start | When to use |
|---|---|---|
| **stdio** (default) | `node dist/index.js` | Claude Desktop, Cursor, VS Code, Gemini CLI — any tool that spawns a subprocess |
| **HTTP/SSE** | `node dist/index.js --http` | Browser-based agents, cloud tools (OpenWebUI, Zapier, etc.), multi-client setups |

---

## Distribution (future)

To publish as `npx tesserin-mcp`:

1. Update `tesserin-mcp/package.json` → set `"private": false`, bump version.
2. Run `pnpm mcp:build` to produce the self-contained `dist/index.js`.
3. `pnpm publish --filter tesserin-mcp`.

Users can then run:
```bash
TESSERIN_API_TOKEN=tsk_... npx tesserin-mcp
```
