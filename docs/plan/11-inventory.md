# Crucible: Feature Inventory & Source Map

## Overview

This document maps every Crucible feature to its source: copied directly from oh-my-opencode, copied with modifications, rewritten from scratch, or built new.

## Hooks (28 total)

### Copy Directly (13 hooks)

| Hook | Source | LOC | oh-my-opencode Path |
|------|--------|-----|-------------------|
| write-existing-file-guard | oh-my-opencode | 51 | `src/hooks/write-existing-file-guard/` |
| thinking-block-validator | oh-my-opencode | 169 | `src/hooks/thinking-block-validator/` |
| empty-task-response-detector | oh-my-opencode | 27 | `src/hooks/empty-task-response-detector/` |
| context-window-monitor | oh-my-opencode | 116 | `src/hooks/context-window-monitor.ts` |
| tool-output-truncator | oh-my-opencode | 63+217 | `src/hooks/tool-output-truncator.ts` + `src/shared/dynamic-truncator.ts` |
| compaction-todo-preserver | oh-my-opencode | 129 | `src/hooks/compaction-todo-preserver/` |
| edit-error-recovery | oh-my-opencode | 63 | `src/hooks/edit-error-recovery/` |
| json-error-recovery | oh-my-opencode | 64 | `src/hooks/json-error-recovery/` |
| hashline-read-enhancer | oh-my-opencode | 85 | `src/hooks/hashline-read-enhancer/` |
| hashline-edit-diff-enhancer | oh-my-opencode | 110 | `src/hooks/hashline-edit-diff-enhancer/` |
| question-label-truncator | oh-my-opencode | 63 | `src/hooks/question-label-truncator/` |
| directory-agents-injector | oh-my-opencode | 200 | `src/hooks/directory-agents-injector/` |
| directory-readme-injector | oh-my-opencode | 195 | `src/hooks/directory-readme-injector/` |

### Copy & Modify (8 hooks)

| Hook | Source | Modification | oh-my-opencode Path |
|------|--------|-------------|-------------------|
| session-recovery | oh-my-opencode | Strip oh-my-opencode-specific error types, keep recovery strategies | `src/hooks/session-recovery/` (1678 LOC) |
| delegate-task-retry | oh-my-opencode | Adapt error patterns for our sub-agent system | `src/hooks/delegate-task-retry/` |
| rules-injector | oh-my-opencode | Replace rule sources with our template system | `src/hooks/rules-injector/` |
| anthropic-effort | oh-my-opencode | Only adjust if not explicitly set by config | `src/hooks/anthropic-effort/` |
| session-notification | oh-my-opencode | Replace branding | `src/hooks/session-notification/` |
| interactive-bash-session | oh-my-opencode | Adapt tmux paths | `src/hooks/interactive-bash-session/` |
| auto-slash-command | oh-my-opencode | Adapt command discovery for our commands | `src/hooks/auto-slash-command/` |
| non-interactive-env | oh-my-opencode | Adapt for our CLI modes | `src/hooks/non-interactive-env/` |

### Rewrite from Scratch (4 hooks, inspired by oh-my-opencode)

| Hook | Inspiration | What We Build |
|------|------------|---------------|
| context-limit-recovery | oh-my-opencode's anthropic-context-window-limit-recovery (2277 LOC) | Multi-strategy cascade: dedup → truncate largest → summarize. Simpler, cleaner. |
| agent-usage-reminder | oh-my-opencode's agent-usage-reminder | Remind about our 4 sub-agents (Researcher, Scout, Librarian, Oracle) |
| persist-compaction | oh-my-opencode's compaction-context-injector (concept) | [PERSIST] tag system + metadata preservation |
| plan-auto-injector | New (no oh-my-opencode equivalent) | Auto-read plan files on session start |

### New (3 hooks)

| Hook | Purpose |
|------|---------|
| standards-injector | Expand `{{templates}}` in system prompts |
| sub-agent-output-persister | Write sub-agent outputs to disk on completion |
| workflow-state-detector | Detect phase mode from `docs/plan/` presence |

## Tools (18 total)

### Copy Directly (9 tools)

| Tool | Source | LOC | oh-my-opencode Path |
|------|--------|-----|-------------------|
| grep | oh-my-opencode | 622 | `src/tools/grep/` |
| glob | oh-my-opencode | 299 | `src/tools/glob/` |
| ast-grep | oh-my-opencode | 981 | `src/tools/ast-grep/` |
| hashline-edit | oh-my-opencode | 559 | `src/tools/hashline-edit/` |
| skill | oh-my-opencode | 355 | `src/tools/skill/` |
| skill-mcp | oh-my-opencode | 196 | `src/tools/skill-mcp/` |
| slashcommand | oh-my-opencode | 485 | `src/tools/slashcommand/` |
| look-at | oh-my-opencode | 437 | `src/tools/look-at/` |
| interactive-bash | oh-my-opencode | 228 | `src/tools/interactive-bash/` |

### Copy & Modify (3 tools)

| Tool | Modification | oh-my-opencode Path |
|------|-------------|-------------------|
| lsp (6 sub-tools) | Remove markdown/text servers, ensure all code languages | `src/tools/lsp/` (2227 LOC) |
| session-manager | Adapt client API usage | `src/tools/session-manager/` |
| interactive-bash | Adapt tmux integration | `src/tools/interactive-bash/` |

### Rewrite (4 tools)

| Tool | What We Build |
|------|---------------|
| task (delegation) | Main sub-agent delegation: agent, prompt, fresh_context, context config, background mode |
| agent-invoke | Direct agent invocation by name |
| background-output | Retrieve background sub-agent results (with blocking option) |
| background-cancel | Cancel specific background tasks |

## Features (10 total)

### Copy Directly (3 features)

| Feature | LOC | oh-my-opencode Path |
|---------|-----|-------------------|
| tool-metadata-store | 91 | `src/features/tool-metadata-store/` |
| context-injector | 357 | `src/features/context-injector/` |
| hook-message-injector | 436 | `src/features/hook-message-injector/` |

### Copy & Modify (4 features)

| Feature | Modification | oh-my-opencode Path |
|---------|-------------|-------------------|
| skill-loader | Adapt to our skill format/paths | `src/features/opencode-skill-loader/` (1426 LOC) |
| skill-mcp-manager | Adapt lifecycle management | `src/features/skill-mcp-manager/` |
| builtin-commands | Cherry-pick useful ones, replace rest with ours | `src/features/builtin-commands/` |
| mcp-loader | Adapt paths, env expansion | `src/features/claude-code-mcp-loader/` |

### Rewrite (2 features)

| Feature | Inspiration |
|---------|------------|
| background-agent | oh-my-opencode patterns (3492 LOC): concurrency, polling, lifecycle |
| workflow-state | New: phase detection, current position tracking, state persistence |

### New (1 feature)

| Feature | Purpose |
|---------|---------|
| template-engine | `{{template}}` expansion, directory scanning, circular ref detection |

## Skills (2 total)

| Skill | Source | LOC |
|-------|--------|-----|
| git-master | oh-my-opencode (copy directly) | 1111 |
| frontend-ui-ux | oh-my-opencode (copy directly) | 79 |

## MCPs (5 total)

| MCP | Source | Config LOC |
|-----|--------|-----------|
| Context7 | oh-my-opencode (copy directly) | ~33 |
| Grep.app | oh-my-opencode (copy directly) | ~33 |
| Tavily | New (replaces Exa/websearch) | ~35 |
| Supermemory | New | ~20 |
| Auggie | New | ~20 |

## Commands (11 total)

All commands are **new** (written from scratch), though `/refactor` and `/handoff` are inspired by oh-my-opencode's equivalents.

## Shared Utilities (7 total, all copied directly)

| Utility | LOC | oh-my-opencode Path |
|---------|-----|-------------------|
| system-directive.ts | 60 | `src/shared/system-directive.ts` |
| dynamic-truncator.ts | 217 | `src/shared/dynamic-truncator.ts` |
| logger.ts | ~50 | `src/shared/logger.ts` |
| data-path.ts | ~50 | `src/shared/data-path.ts` |
| safe-create-hook.ts | ~50 | `src/shared/safe-create-hook.ts` |
| frontmatter.ts | ~100 | `src/shared/frontmatter.ts` |
| binary-downloader.ts | ~200 | `src/shared/binary-downloader.ts` |

## Third-Party Plugins (3 total)

| Plugin | Package | Source |
|--------|---------|--------|
| DCP | @tarquinen/opencode-dcp | npm (as-is) |
| Notify | opencode-notify | npm (as-is) |
| Antigravity Auth | opencode-antigravity-auth | npm (as-is) |

## Summary

| Category | Copy | Modify | Rewrite | New | Total |
|----------|------|--------|---------|-----|-------|
| Hooks | 13 | 8 | 4 | 3 | 28 |
| Tools | 9 | 3 | 4 | 0 | 16 |
| Features | 3 | 4 | 2 | 1 | 10 |
| Skills | 2 | 0 | 0 | 0 | 2 |
| MCPs | 2 | 0 | 0 | 3 | 5 |
| Commands | 0 | 0 | 0 | 11 | 11 |
| Shared | 7 | 0 | 0 | 0 | 7 |
| **Total** | **36** | **15** | **10** | **18** | **79** |

Approximately **36 components** can be copied directly, **15** need modification, **10** are rewrites from oh-my-opencode patterns, and **18** are built new. Total estimated LOC for Crucible: ~15,000-20,000.
