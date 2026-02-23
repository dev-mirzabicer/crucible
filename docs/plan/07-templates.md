# Crucible: Template System

## Overview

The template system provides DRY prompt management across all agents. Shared content (standards, tool usage instructions, delegation patterns, MCP directives) is written once in template files and expanded into agent system prompts via `{{template_name}}` syntax.

## Mechanics

### Template Files

Templates are markdown files in `src/templates/`:

```
src/templates/
├── standards.md         # Quality/philosophy standards (see 05-standards.md)
├── tool-usage.md        # Tool usage instructions shared across agents
├── delegation.md        # Sub-agent delegation patterns and rules
├── mcp-usage.md         # MCP usage directives
└── context-rules.md     # Context management rules for agents
```

### Expansion Syntax

Agent system prompts (`.opencode/agents/*.md` or inline) use `{{template_name}}` to reference templates:

```markdown
{{standards}}

# Builder Agent
You are the Builder...

{{tool-usage}}
{{delegation}}
{{mcp-usage}}
```

At prompt assembly time, `{{standards}}` is replaced with the full content of `src/templates/standards.md`.

### Implementation

The `experimental.chat.system.transform` hook handles expansion:

```typescript
// In standards-injector hook (part of the system transform pipeline)
function expandTemplates(systemPrompt: string[], templates: Map<string, string>): string[] {
  return systemPrompt.map(section => {
    let expanded = section
    for (const [name, content] of templates) {
      expanded = expanded.replaceAll(`{{${name}}}`, content)
    }
    return expanded
  })
}
```

### Template Loading

Templates are loaded once at plugin initialization from the configured template directory. They are static — changes require plugin restart (or hot-reload if implemented).

### Nesting

Templates can reference other templates: `{{standards}}` inside `tool-usage.md` will be expanded. Circular references are detected and rejected at load time (max depth: 3).

## Template Definitions

### `{{standards}}` — Quality Standards

See `05-standards.md`. This is the largest and most important template. Injected into ALL agents.

### `{{tool-usage}}` — Tool Usage Instructions

```markdown
## Tool Usage Guidelines

### Search Tools
- **Grep**: Content search with regex support. Use for finding patterns, strings, usages.
- **Glob**: File pattern matching. Use for finding files by name pattern.
- **AST-Grep**: AST-aware code search and replace. Use for structural code patterns across 25 languages.
- **Read**: Read files with line numbers. Use offset/limit for large files.

### LSP Tools
- **goto_definition**: Jump to where a symbol is defined.
- **find_references**: Find ALL usages of a symbol across the workspace.
- **symbols**: Get file outline or search workspace symbols.
- **diagnostics**: Get errors/warnings from language servers BEFORE building.
- **prepare_rename/rename**: Safe rename across entire workspace.

### Editing Tools
- **Edit**: Exact string replacement in files. Always Read first.
- **HashlineEdit**: Hash-based line editing for precision changes.
- **Write**: Write entire file content. Always Read existing files first.

### Media Tools
- **look_at**: Analyze PDFs, images, diagrams. Use for visual content that needs interpretation.

### Session Tools
- **session_list/read/search/info**: Query session history and content.

### Skill Tools
- **skill**: Load specialized instruction packages on demand.
- **slashcommand**: Execute slash commands.

### General Rules
- Prefer Grep/Glob over Bash for searching (dedicated tools are safer and more efficient).
- Always Read a file before Editing or Writing to it.
- Use LSP diagnostics after significant changes to catch errors early.
- Use AST-Grep for structural refactoring across many files.
```

### `{{delegation}}` — Sub-Agent Delegation Patterns

```markdown
## Sub-Agent Delegation

### Available Sub-Agents
| Agent | Model | Speed | Cost | Best For |
|-------|-------|-------|------|----------|
| Researcher | Opus 4.6 | Slow | High | Deep research, analysis, synthesis |
| Scout | Sonnet 4.6 | Fast | Low | Codebase grep, file finding, pattern search |
| Librarian | Sonnet 4.6 | Fast | Low | External docs, OSS examples, web search |
| Oracle | Opus 4.6 | Slow | High | Hard problems, architecture, debugging dead-ends |

### When to Delegate
- **Research needed**: Fire 2-5 Researchers in parallel (background).
- **Codebase question**: Fire Scout. Cheap, fast, fire liberally.
- **Library/API docs needed**: Fire Librarian. Check Context7 first.
- **Stuck after 2+ attempts**: Consult Oracle.
- **Multiple independent searches**: Fire Scouts/Librarians in parallel.

### Delegation Rules
1. **Parallelize**: Independent sub-agents run simultaneously. Fire them all at once.
2. **Background by default**: Researchers, Scouts, Librarians run in background. Collect results when needed.
3. **Blocking for Oracle**: Oracle consultations are blocking — wait for the result before proceeding.
4. **Context injection**: Sub-agents receive plan files and [PERSIST] messages by default. Set fresh_context=true only for truly independent tasks.
5. **Output persistence**: All sub-agent outputs are saved to disk. Reference the file path if you need to share results.

### Prompt Structure for Sub-Agents
When delegating, provide:
1. **CONTEXT**: What you're working on and why this research/search is needed.
2. **GOAL**: What specific information or answer you need.
3. **DOWNSTREAM**: How you'll use the results.
4. **REQUEST**: Concrete instructions — what to find, what format to return, what to skip.
```

### `{{mcp-usage}}` — MCP Usage Directives

```markdown
## MCP Tools

You have access to these external capabilities. USE THEM PROACTIVELY.

### Context7 — Library Documentation
- **ALWAYS** use Context7 before making assumptions about any library, framework, or API.
- First call `resolve-library-id` with the library name, then `query-docs` with your specific question.
- Context7 provides up-to-date, official documentation. Your training data may be outdated.

### Auggie — Codebase Search
- Use when you need semantic understanding of the codebase (not just text search).
- Good for: "where is authentication handled?", "how does the payment flow work?"
- Requires the repo to be indexed. If not indexed, fall back to Grep/Scout.

### Tavily — Web Search
- Use for current information, recent developments, or anything that might have changed.
- Good for: API pricing, service status, recent library releases, current best practices.

### Grep.app — GitHub Code Search
- Use to find real-world code examples from public repositories.
- Search for actual code patterns (like grep), not keywords.
- Good for: "how do production apps handle X?", "what's the standard pattern for Y?"
- Filter by language and repository quality.

### Supermemory — Persistent Memory
- Use to save important findings, decisions, and patterns across sessions.
- Search before re-researching — the answer might already be in memory.
- Add memories for: project-specific decisions, discovered patterns, resolved issues.
```

### `{{context-rules}}` — Context Management Rules

```markdown
## Context Management

### Your Context Budget
You are operating with a finite context window. Be mindful of it:
- Don't re-read files you've already read (unless they've changed).
- Don't make redundant tool calls.
- When output is large, use the DCP distill tool to summarize and preserve key information.
- If truncated output is saved to a file, delegate a Scout to inspect it rather than reading the full file yourself.

### Plan Files
Plan files for the current phase/sub-phase are injected into your context automatically. Do NOT re-read them unless you need to verify a specific detail.

### [PERSIST] Messages
Some user messages are marked [PERSIST] — these survive compaction. You don't need to do anything special with them. They'll always be in your context.

### Sub-Agent Outputs
Sub-agent outputs are saved to disk automatically. If you need to reference a previous sub-agent's output, read the file rather than re-running the sub-agent.
```

## Adding New Templates

To add a new shared template:
1. Create `src/templates/new-template.md` with the content.
2. Reference it in any agent prompt as `{{new-template}}`.
3. The template engine will auto-discover and expand it.

No code changes needed — the engine scans the template directory at startup.
