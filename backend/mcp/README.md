# MCP Server Configuration

This folder manages external MCP (Model Context Protocol) servers available to agent sessions.

> Full documentation: [docs/MCP.md](../docs/MCP.md) | [docs/MCP_KO.md](../docs/MCP_KO.md)

## Directory Structure

```
mcp/
├── built_in/          ← Always included (bypass preset filtering)
│   └── github.json    ← GitHub API — auto-configured from Settings
├── custom/            ← User-added servers (subject to preset filtering)
│   └── (your JSON files here)
├── *.json.template    ← Example templates (not loaded)
└── README.md
```

| Folder | Preset Filtering | Env Var Skip | Use Case |
|--------|-----------------|-------------|----------|
| `built_in/` | **No** — always included | Yes (skipped if unresolved) | System-level servers (GitHub, etc.) |
| `custom/` | **Yes** — filtered by Tool Sets | Yes (skipped if unresolved) | User-added servers |

## JSON Schema

```json
{
  "type": "stdio | http | sse",
  "command": "command (stdio only)",
  "args": ["arg1", "arg2"],
  "env": {"KEY": "value or ${ENV_VAR}"},
  "url": "server URL (http/sse only)",
  "headers": {"Header": "value"},
  "description": "Shown in Tool Sets & Session Tools UI"
}
```

## Quick Examples

```json
// custom/notion.json
{ "type": "http", "url": "https://mcp.notion.com/mcp", "description": "Notion integration" }

// custom/filesystem.json
{ "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"], "description": "Filesystem access" }
```

## Environment Variables

Use `${VAR}` or `${VAR:-fallback}` syntax. Variables are expanded from `os.environ` at load time.

## Popular MCP Servers

| Server | Type | URL / Command |
|--------|------|---------------|
| GitHub | stdio | `npx @modelcontextprotocol/server-github` |
| Notion | http | `https://mcp.notion.com/mcp` |
| Sentry | http | `https://mcp.sentry.dev/mcp` |
| Slack | http | `https://mcp.slack.com/mcp` |
| Linear | http | `https://mcp.linear.app/mcp` |
| Filesystem | stdio | `npx @modelcontextprotocol/server-filesystem` |
| PostgreSQL | stdio | `npx @bytebase/dbhub --dsn ${DATABASE_URL}` |

More: https://github.com/modelcontextprotocol/servers
