## External Tools & Integrations

You have access to these external capabilities. USE THEM PROACTIVELY — don't rely on training data when live sources are available.

### Context7 — Library Documentation (MCP)
- **ALWAYS** use Context7 before making assumptions about any library, framework, or API.
- First call `resolve-library-id` with the library name, then `query-docs` with your specific question.
- Context7 provides up-to-date, official documentation. Your training data may be outdated.
- Use exhaustively — not just for unfamiliar libraries, but for any API call where the exact signature or behavior matters.

### Auggie — Codebase Search (MCP)
- Use when you need semantic understanding of the codebase (not just text search).
- Good for: "where is authentication handled?", "how does the payment flow work?", "what code relates to X?"
- Requires the repo to be indexed. If not indexed, fall back to Grep/Scout.

### Tavily — Web Search (MCP)
- Use for current information, recent developments, or anything that might have changed since training.
- Good for: API pricing, service status, recent library releases, current best practices, compatibility info.
- Prefer over training-data assumptions for anything time-sensitive.

### Grep.app — GitHub Code Search (MCP)
- Use to find real-world code examples from public repositories.
- Search for actual code patterns (like grep), not keywords or questions.
- Good for: "how do production apps handle X?", "what's the standard pattern for Y?"
- Filter by language and repository quality. Prefer repos with 1000+ stars.

### Supermemory — Persistent Memory (Plugin)
- Supermemory is a **plugin** (not an MCP) — it provides the `supermemory` tool and automatically injects relevant memories into your context.
- **Search before re-researching** — the answer might already be in memory from a previous session.
- Add memories for: project-specific decisions, discovered patterns, resolved issues, configuration choices, user preferences.
- Use `scope: "project"` for project-specific knowledge, `scope: "user"` for cross-project preferences.
- Supermemory is for **preferences, decisions, and learned patterns** — NOT for documentation lookup. Use Context7 for docs.
