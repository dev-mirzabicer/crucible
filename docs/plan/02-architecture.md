# Crucible: Technical Architecture

## System Overview

Crucible consists of four components:

```
┌─────────────────────────────────────────────────────┐
│                    User's Terminal                    │
│                       (tmux)                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            OpenCode (Forked Core)             │   │
│  │  - Cherry-picked fixes from upstream PRs      │   │
│  │  - Stock OpenCode + native features           │   │
│  │    (formatters, LSP, tool truncation→file)    │   │
│  ├──────────────────────────────────────────────┤   │
│  │          Crucible Plugin (TypeScript)          │   │
│  │  - 7 Agents (Builder, Architect, Reviewer,    │   │
│  │    Oracle, Researcher, Scout, Librarian)       │   │
│  │  - 28+ Hooks (quality, recovery, context)     │   │
│  │  - 18+ Tools (search, LSP, delegation, etc.)  │   │
│  │  - 10 Commands (/plan-*, /implement, etc.)    │   │
│  │  - 2 Skills (git-master, frontend-ui-ux)      │   │
│  │  - Template System ({{standards}}, etc.)       │   │
│  │  - Context Management (PERSIST, compaction)    │   │
│  │  - Workflow State (phase tracking)             │   │
│  ├──────────────────────────────────────────────┤   │
│  │             Third-Party Plugins                │   │
│  │  - @tarquinen/opencode-dcp (context pruning)  │   │
│  │  - opencode-notify (OS notifications)         │   │
│  │  - opencode-antigravity-auth (Gemini auth)    │   │
│  ├──────────────────────────────────────────────┤   │
│  │               5 MCP Servers                    │   │
│  │  - Supermemory  (persistent memory)           │   │
│  │  - Context7     (library docs)                │   │
│  │  - Auggie       (codebase vector search)      │   │
│  │  - Tavily       (web search)                  │   │
│  │  - Grep.app     (GitHub code search)          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Component 1: OpenCode Fork

### What We Fork

We maintain a lightweight fork of `anomalyco/opencode` with minimal divergence from upstream:

- **Cherry-picked PRs**: As needed (currently none required since pocket-universe is deferred).
- **No core modifications initially**: All Crucible functionality lives in the plugin. The fork exists as an escape hatch for future needs (custom TUI, new hooks, streaming interception).
- **Upstream sync**: Regularly rebase our fork onto upstream `dev` to pick up improvements.

### Why Fork at All

Even though we don't need core changes today, forking gives us:
1. **Freedom**: If we ever need a hook that doesn't exist, we add it.
2. **Stability**: We control our update cycle. No surprise breaking changes.
3. **Future-proofing**: If pocket-universe's PRs (#9272, #7725) are needed later, we cherry-pick them.

### Fork Maintenance Strategy

```
upstream/dev ──────────────────────────────► (anomalyco/opencode)
     │
     ├── rebase periodically
     │
crucible/dev ──────────────────────────────► (our fork)
     │
     └── our changes (if any) on top
```

## Component 2: Crucible Plugin

### Plugin Structure

```
crucible/
├── src/
│   ├── index.ts                    # Plugin entry point (exports Hooks)
│   ├── agents/                     # 7 agent definitions
│   │   ├── builder.md              # Builder system prompt
│   │   ├── architect.md            # Architect system prompt
│   │   ├── researcher.md           # Researcher system prompt
│   │   ├── reviewer.md             # Reviewer system prompt
│   │   ├── oracle.md               # Oracle system prompt
│   │   ├── scout.md                # Scout system prompt
│   │   └── librarian.md            # Librarian system prompt
│   ├── templates/                  # Template system
│   │   ├── engine.ts               # {{template}} expansion engine
│   │   ├── standards.md            # Shared quality standards
│   │   ├── tool-usage.md           # Shared tool usage instructions
│   │   ├── delegation.md           # Shared delegation patterns
│   │   ├── mcp-usage.md            # MCP usage directives
│   │   └── context-rules.md        # Context management rules
│   ├── hooks/                      # All hooks
│   │   ├── quality/                # Quality guards
│   │   │   ├── write-existing-file-guard.ts
│   │   │   ├── thinking-block-validator.ts
│   │   │   └── empty-task-response-detector.ts
│   │   ├── recovery/               # Error recovery
│   │   │   ├── session-recovery.ts
│   │   │   ├── context-limit-recovery.ts
│   │   │   ├── edit-error-recovery.ts
│   │   │   ├── json-error-recovery.ts
│   │   │   └── delegate-task-retry.ts
│   │   ├── context/                # Context management
│   │   │   ├── context-window-monitor.ts
│   │   │   ├── tool-output-truncator.ts
│   │   │   ├── persist-compaction.ts      # [PERSIST] + /special-compact
│   │   │   ├── compaction-todo-preserver.ts
│   │   │   ├── plan-auto-injector.ts      # Auto-read plan files
│   │   │   ├── standards-injector.ts      # Inject {{standards}} into prompts
│   │   │   ├── rules-injector.ts
│   │   │   ├── directory-agents-injector.ts
│   │   │   └── directory-readme-injector.ts
│   │   ├── enhancement/            # Agent behavior enhancement
│   │   │   ├── anthropic-effort.ts
│   │   │   ├── hashline-read-enhancer.ts
│   │   │   ├── hashline-edit-diff-enhancer.ts
│   │   │   ├── question-label-truncator.ts
│   │   │   ├── agent-usage-reminder.ts
│   │   │   ├── auto-slash-command.ts
│   │   │   └── non-interactive-env.ts
│   │   └── session/                # Session management
│   │       ├── session-notification.ts
│   │       └── interactive-bash-session.ts
│   ├── tools/                      # Custom tools
│   │   ├── search/                 # Search tools
│   │   │   ├── grep.ts
│   │   │   ├── glob.ts
│   │   │   └── ast-grep.ts
│   │   ├── lsp/                    # LSP tools
│   │   │   ├── goto-definition.ts
│   │   │   ├── find-references.ts
│   │   │   ├── symbols.ts
│   │   │   ├── diagnostics.ts
│   │   │   ├── prepare-rename.ts
│   │   │   └── rename.ts
│   │   ├── delegation/             # Sub-agent tools
│   │   │   ├── task.ts             # Main delegation tool
│   │   │   ├── agent-invoke.ts     # Direct agent invocation
│   │   │   ├── background-output.ts
│   │   │   └── background-cancel.ts
│   │   ├── editing/
│   │   │   └── hashline-edit.ts
│   │   ├── media/
│   │   │   └── look-at.ts
│   │   ├── session/
│   │   │   └── session-manager.ts
│   │   ├── interactive/
│   │   │   └── interactive-bash.ts
│   │   └── skills/
│   │       ├── skill.ts
│   │       ├── skill-mcp.ts
│   │       └── slashcommand.ts
│   ├── features/                   # Feature modules
│   │   ├── background-agent/       # Sub-agent orchestration
│   │   │   ├── manager.ts          # Concurrency, lifecycle, polling
│   │   │   ├── spawner.ts          # Session creation, context injection
│   │   │   ├── output-persister.ts # Write outputs to files
│   │   │   └── types.ts
│   │   ├── workflow-state/         # Phase/subphase tracking
│   │   │   ├── state.ts            # Current phase, progress
│   │   │   ├── detector.ts         # Detect phase mode from docs/plan/
│   │   │   └── types.ts
│   │   ├── skill-loader/           # Skill discovery + loading
│   │   ├── skill-mcp-manager/      # MCP client lifecycle
│   │   ├── context-injector/       # AGENTS.md injection
│   │   ├── hook-message-injector/  # System message framework
│   │   ├── mcp-loader/             # .mcp.json loading
│   │   └── mcp-oauth/              # OAuth for remote MCPs
│   ├── commands/                   # Slash commands (MD templates)
│   │   ├── plan-project.md
│   │   ├── plan-phase.md
│   │   ├── plan-subphase.md
│   │   ├── implement.md
│   │   ├── progress.md
│   │   ├── progress-phase.md
│   │   ├── load-context.md
│   │   ├── special-compact.md
│   │   ├── review.md
│   │   └── handoff.md
│   ├── skills/                     # Built-in skills
│   │   ├── git-master/
│   │   │   └── SKILL.md
│   │   └── frontend-ui-ux/
│   │       └── SKILL.md
│   ├── mcp/                        # MCP configurations
│   │   ├── context7.ts
│   │   ├── grep-app.ts
│   │   ├── tavily.ts
│   │   ├── supermemory.ts
│   │   └── auggie.ts
│   ├── shared/                     # Shared utilities
│   │   ├── system-directive.ts
│   │   ├── dynamic-truncator.ts
│   │   ├── logger.ts
│   │   ├── data-path.ts
│   │   ├── safe-create-hook.ts
│   │   ├── frontmatter.ts
│   │   └── binary-downloader.ts
│   └── config/                     # Configuration schema
│       ├── schema.ts               # Zod schema for crucible config
│       └── defaults.ts             # Default configuration values
├── opencode.json                   # OpenCode configuration
├── package.json
├── tsconfig.json
└── README.md
```

### Plugin Entry Point

The plugin exports a single async function conforming to OpenCode's `Plugin` type:

```typescript
// src/index.ts
import type { Plugin } from "@opencode-ai/plugin"

const crucible: Plugin = async (ctx) => {
  // 1. Initialize shared state
  const state = await initializeState(ctx)
  
  // 2. Load config
  const config = await loadConfig(ctx)
  
  // 3. Initialize features
  await initializeBackgroundAgentManager(ctx, state)
  await initializeWorkflowState(ctx, state)
  await initializeSkillLoader(ctx, config)
  await initializeMCPs(ctx, config)
  
  // 4. Return hooks + tools
  return {
    // Event listeners
    event: createEventHandler(ctx, state),
    
    // Tool registration
    tool: {
      ...createSearchTools(ctx),      // grep, glob, ast-grep
      ...createLSPTools(ctx),         // 6 LSP tools
      ...createDelegationTools(ctx),  // task, agent-invoke, bg-output, bg-cancel
      ...createEditingTools(ctx),     // hashline-edit
      ...createMediaTools(ctx),       // look-at
      ...createSessionTools(ctx),     // session-manager
      ...createInteractiveTools(ctx), // interactive-bash
      ...createSkillTools(ctx),       // skill, skill-mcp, slashcommand
    },
    
    // Mutable hooks
    "chat.message": createChatMessageHandler(ctx, state),
    "chat.params": createChatParamsHandler(ctx, config),
    "permission.ask": createPermissionHandler(ctx, config),
    "command.execute.before": createCommandHandler(ctx, state),
    "tool.execute.before": createToolBeforeHandler(ctx, state),
    "tool.execute.after": createToolAfterHandler(ctx, state),
    "tool.definition": createToolDefinitionHandler(ctx, config),
    "shell.env": createShellEnvHandler(ctx, config),
    
    // Experimental hooks
    "experimental.chat.system.transform": createSystemTransformHandler(ctx, state, config),
    "experimental.chat.messages.transform": createMessageTransformHandler(ctx, state),
    "experimental.session.compacting": createCompactionHandler(ctx, state),
  }
}

export default crucible
```

### Hook Execution Pipeline

Hooks execute sequentially. Our hooks are composed in a specific order within each hook type:

**`tool.execute.after` pipeline:**
1. tool-output-truncator (may truncate large outputs)
2. context-window-monitor (may inject usage warning)
3. edit-error-recovery (may inject correction hint)
4. json-error-recovery (may inject correction hint)
5. hashline-read-enhancer (enhances Read output)
6. hashline-edit-diff-enhancer (enhances Edit output)
7. directory-agents-injector (may inject AGENTS.md)
8. directory-readme-injector (may inject README.md)
9. agent-usage-reminder (may remind about delegation)

**`experimental.chat.system.transform` pipeline:**
1. standards-injector (inject {{standards}} template)
2. plan-auto-injector (inject plan files on first message)
3. rules-injector (inject conditional rules)

**`experimental.session.compacting` pipeline:**
1. persist-compaction (preserve [PERSIST] messages + metadata)
2. compaction-todo-preserver (preserve todo list)

**`event` handler:**
1. session-recovery (detect and fix API errors)
2. context-limit-recovery (multi-strategy token limit recovery)
3. session-notification (OS notification on completion)
4. sub-agent output persister (write outputs to files on session.idle)

## Component 3: Third-Party Plugins

### DCP (Dynamic Context Pruning)

- **Package**: `@tarquinen/opencode-dcp`
- **What it does**: Automatic deduplication of tool calls, superseding writes with subsequent reads, purging old error inputs. Plus AI-driven distill/prune tools.
- **Configuration**: We'll set conservative defaults — high `contextLimit`, low `nudgeFrequency`, `compress` disabled.
- **Note**: DCP is disabled for sub-agents by design, which is correct for our use case.

### OpenCode Notify

- **Package**: `opencode-notify` (or port session-notification hook)
- **What it does**: OS-level notification when long tasks complete.

### Antigravity Auth

- **Package**: `opencode-antigravity-auth`
- **What it does**: Gemini authentication via Google accounts.

## Component 4: MCP Servers

Five MCP servers provide external capabilities:

| MCP | Transport | API Key Env Var | Purpose |
|-----|-----------|----------------|---------|
| Context7 | remote | (none) | Library documentation lookup |
| Auggie | remote | OAuth | Codebase vector search + indexing |
| Tavily | local (stdio) | `TAVILY_API_KEY` | Web search |
| Grep.app | remote | (none) | GitHub code search |

MCP servers are registered in `opencode.json`. Supermemory is integrated as a plugin (`opencode-supermemory`), not an MCP.

## Configuration Architecture

### Config File (`opencode.json`)

```jsonc
{
  // Agents (defined via .opencode/agents/*.md — see agents.md doc)

  // Third-party plugins
  // Crucible itself is auto-discovered via .opencode/plugins/crucible.ts
  "plugin": [
    "@tarquinen/opencode-dcp@latest",
    "opencode-supermemory@latest"
  ],

  // MCP servers
  "mcp": {
    "context7": { "type": "remote", "url": "https://mcp.context7.com/mcp", "enabled": true, "oauth": false },
    "auggie": { "type": "remote", "url": "https://api.augmentcode.com/mcp", "enabled": true },
    "tavily": {
      "type": "local",
      "command": ["npx", "-y", "tavily-mcp"],
      "environment": { "TAVILY_API_KEY": "{env:TAVILY_API_KEY}" },
      "enabled": true
    },
    "grep_app": { "type": "remote", "url": "https://mcp.grep.app", "enabled": true, "oauth": false }
  },
  
  // Commands (defined via .opencode/commands/*.md)
  
  // Formatter overrides (if any)
  "formatter": {},
  
  // DCP config lives in .opencode/dcp.jsonc
}
```

### Crucible-Specific Config

Crucible's own configuration lives in `.crucible.json` (or a section within `opencode.json`):

```jsonc
{
  "templates": {
    "dir": "src/templates"   // Template directory
  },
  "workflow": {
    "planDir": "docs/plan",          // Project plan directory
    "phasesDir": "docs/phases",      // Phases directory
    "researchDir": "docs/research",  // Research directory
    "progressFile": "PROGRESS.md"    // Progress filename
  },
  "agents": {
    "builder": { "model": "openai/gpt-5.3-codex" },
    "architect": { "model": "anthropic/claude-opus-4-6" },
    "researcher": { "model": "anthropic/claude-opus-4-6" },
    "reviewer": { "model": "anthropic/claude-opus-4-6" },
    "oracle": { "model": "anthropic/claude-opus-4-6" },
    "scout": { "model": "anthropic/claude-sonnet-4-6" },
    "librarian": { "model": "anthropic/claude-sonnet-4-6" }
  },
  "context": {
    "monitorThreshold": 0.70,        // Context window warning at 70%
    "truncation": {
      "defaultMaxTokens": 50000,
      "webfetchMaxTokens": 10000
    }
  },
  "review": {
    "outputDir": "reviews"           // Relative to phase/subphase dir
  }
}
```

## Data Flow

### Session Lifecycle

```
User opens OpenCode
  │
  ├── Plugin initializes
  │   ├── Load config
  │   ├── Initialize background-agent manager
  │   ├── Detect workflow mode (phase vs general)
  │   └── Start MCP servers
  │
  ├── User starts new session (or resumes)
  │   │
  │   ├── chat.message hook: detect first message
  │   │   └── If first message → plan-auto-injector reads plan files
  │   │
  │   ├── experimental.chat.system.transform:
  │   │   ├── Expand {{templates}} in agent system prompt
  │   │   ├── Inject plan context (if phase mode)
  │   │   └── Inject conditional rules
  │   │
  │   ├── User sends message → LLM processes → tool calls
  │   │   │
  │   │   ├── tool.execute.before: sanitize args
  │   │   ├── [tool executes]
  │   │   └── tool.execute.after: truncation, recovery, enhancement
  │   │
  │   ├── Sub-agent delegation (if agent calls task tool):
  │   │   ├── Create new session with selected agent/model
  │   │   ├── Inject context (plan files + [PERSIST] messages + configured items)
  │   │   ├── Execute (blocking by default, or background)
  │   │   ├── Persist output to file
  │   │   └── Return result to caller
  │   │
  │   ├── User runs /special-compact:
  │   │   ├── experimental.session.compacting hook
  │   │   ├── Preserve [PERSIST] messages + agent responses
  │   │   ├── Preserve metadata (phase, todos, decisions, files)
  │   │   └── Compact remaining context
  │   │
  │   └── Session ends (idle)
  │       ├── Persist any pending sub-agent outputs
  │       └── OS notification (if long-running)
  │
  └── Error occurs
      ├── session.error event → session-recovery
      ├── Token limit error → context-limit-recovery cascade
      └── Tool error → edit/json/delegate-task retry
```

## Security Considerations

- **API keys**: Never committed. Stored in environment variables or `.env` files (git-ignored).
- **MCP OAuth**: For remote MCPs (Supermemory), OAuth 2.0 + PKCE is used.
- **Permission system**: OpenCode's native permission system is preserved. Crucible's `permission.ask` hook only auto-approves safe operations.
- **Sub-agent sandboxing**: Read-only agents (Scout, Librarian, Oracle) have write/bash permissions denied.
