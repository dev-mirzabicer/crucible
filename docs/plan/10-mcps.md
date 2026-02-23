# Crucible: External Integrations (MCP + Plugins)

## Overview

Crucible uses:

- **4 MCP servers**: Context7, Auggie, Tavily, Grep.app
- **2 plugins**: DCP, Supermemory

Important: **Supermemory is a plugin, not an MCP server.**

## MCP Servers

Configured in `opencode.json` under `mcp`.

### Context7 — Library Documentation

| Property | Value |
|----------|-------|
| Transport | Remote |
| URL | `https://mcp.context7.com/mcp` |
| Auth | None (`oauth: false`) |
| Primary Users | Builder, Architect, Researcher, Librarian, Reviewer, Oracle |

### Auggie — Semantic Codebase Search

| Property | Value |
|----------|-------|
| Transport | Remote |
| URL | `https://api.augmentcode.com/mcp` |
| Auth | OAuth (default flow) |
| Primary Users | Builder, Architect, Researcher |

### Tavily — Web Search

| Property | Value |
|----------|-------|
| Transport | Local |
| Command | `npx -y tavily-mcp` |
| Env | `TAVILY_API_KEY` (required) |
| Primary Users | Researcher, Librarian |

### Grep.app — GitHub Code Search

| Property | Value |
|----------|-------|
| Transport | Remote |
| URL | `https://mcp.grep.app` |
| Auth | None (`oauth: false`) |
| Primary Users | Researcher, Librarian |

## Plugins

Configured in `opencode.json` under `plugin`.

### DCP — Dynamic Context Pruning

| Property | Value |
|----------|-------|
| Package | `@tarquinen/opencode-dcp@latest` |
| Config | `.opencode/dcp.jsonc` |
| Purpose | Automatic dedup/supersede/purge + `distill` / `prune` tools |

### Supermemory — Persistent Memory

| Property | Value |
|----------|-------|
| Package | `opencode-supermemory@latest` |
| Auth | `SUPERMEMORY_API_KEY` |
| Purpose | Cross-session memory for decisions, preferences, learned patterns |

Supermemory provides the `supermemory` tool and memory injection behavior via plugin hooks.

## Current `opencode.json` Shape

```jsonc
{
  "plugin": [
    "@tarquinen/opencode-dcp@latest",
    "opencode-supermemory@latest"
  ],
  "mcp": {
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "enabled": true,
      "oauth": false
    },
    "auggie": {
      "type": "remote",
      "url": "https://api.augmentcode.com/mcp",
      "enabled": true
    },
    "tavily": {
      "type": "local",
      "command": ["npx", "-y", "tavily-mcp"],
      "environment": {
        "TAVILY_API_KEY": "{env:TAVILY_API_KEY}"
      },
      "enabled": true
    },
    "grep_app": {
      "type": "remote",
      "url": "https://mcp.grep.app",
      "enabled": true,
      "oauth": false
    }
  }
}
```
