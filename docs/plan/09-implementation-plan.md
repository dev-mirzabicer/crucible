# Crucible: Implementation Plan

## Overview

Crucible is implemented in 6 phases, ordered by dependency and value. Each phase produces a functional increment — Crucible is usable after Phase 1 and gets progressively more powerful.

## Phase 1: Foundation (Bare Minimum Functional Setup)

**Goal**: A working Crucible plugin that can be installed in OpenCode with basic agent definitions, core tools, and essential hooks.

**Duration**: ~2-3 days

### Steps

1. **Initialize project**
   - Create `crucible/` repository with `package.json`, `tsconfig.json`
   - Add `@opencode-ai/plugin` as dependency
   - Set up basic build (Bun/TypeScript)

2. **Fork OpenCode**
   - Fork `anomalyco/opencode` to our GitHub
   - Set up upstream tracking for periodic rebases
   - No core changes initially — just establish the fork

3. **Plugin skeleton**
   - Create `src/index.ts` with the Plugin entry point
   - Return empty hooks (all systems off)
   - Verify plugin loads in OpenCode

4. **Copy shared utilities**
   - `system-directive.ts`, `logger.ts`, `data-path.ts`, `safe-create-hook.ts`
   - `frontmatter.ts`, `binary-downloader.ts`, `dynamic-truncator.ts`
   - Adapt imports and paths

5. **Agent definitions**
   - Create `.opencode/agents/builder.md` through `librarian.md`
   - Define system prompts with `{{template}}` placeholders (templates not yet expanded — raw text for now)
   - Configure models, permissions, modes

6. **Core search tools** (copy directly from oh-my-opencode)
   - `grep`, `glob`, `ast-grep` with binary management
   - Verify they work in OpenCode

7. **Core quality hooks** (copy directly)
   - `write-existing-file-guard`
   - `thinking-block-validator`
   - `empty-task-response-detector`
   - `edit-error-recovery`
   - `json-error-recovery`

8. **MCP configuration**
   - Configure all 5 MCPs in `opencode.json`
   - Verify each MCP connects and works

9. **Basic opencode.json**
   - Agent definitions
   - MCP configurations
   - Plugin reference
   - Formatter settings

### Deliverable
A working plugin with 7 agents, 3 search tools, 5 quality hooks, 5 MCPs. Basic but functional.

---

## Phase 2: Tools & Enhancement Hooks

**Goal**: Full tool suite and agent behavior enhancements.

**Duration**: ~2-3 days

### Steps

1. **LSP tools** (copy & adapt from oh-my-opencode)
   - All 6 LSP sub-tools: goto_definition, find_references, symbols, diagnostics, prepare_rename, rename
   - Remove markdown/text language servers (not useful)
   - Verify with TypeScript, Python, Rust projects

2. **Editing tools**
   - `hashline-edit` (copy directly)

3. **Media tools**
   - `look-at` (copy & adapt agent reference)

4. **Session tools**
   - `session-manager` (copy & adapt)

5. **Interactive tools**
   - `interactive-bash` (copy & adapt tmux integration)

6. **Skill tools**
   - `skill`, `skill-mcp`, `slashcommand` (copy & adapt)

7. **Built-in skills**
   - `git-master` SKILL.md (copy directly — 1111 LOC of git expertise)
   - `frontend-ui-ux` SKILL.md (copy directly — 79 LOC of design methodology)

8. **Enhancement hooks** (copy directly)
   - `hashline-read-enhancer`
   - `hashline-edit-diff-enhancer`
   - `question-label-truncator`
   - `anthropic-effort` (copy & modify: only adjust if not explicitly set)

9. **Context hooks** (copy directly/modify)
   - `tool-output-truncator` + `dynamic-truncator`
   - `context-window-monitor`
   - `directory-agents-injector`
   - `directory-readme-injector`
   - `rules-injector` (modify rule sources)

10. **Session hooks**
    - `session-notification` (copy & rebrand)
    - `interactive-bash-session` (copy & adapt)
    - `auto-slash-command` (copy & adapt)
    - `non-interactive-env` (copy & adapt)

### Deliverable
Full tool suite (18+ tools), 15+ enhancement/context hooks, 2 built-in skills. Crucible is now a powerful general-purpose coding environment.

---

## Phase 3: Template System & Standards

**Goal**: DRY prompt management with the template engine and shared standards.

**Duration**: ~1-2 days

### Steps

1. **Template engine**
   - Implement `{{template_name}}` expansion in `experimental.chat.system.transform`
   - Template discovery from `src/templates/` directory
   - Circular reference detection (max depth 3)
   - Template loading at plugin init

2. **Write template files**
   - `standards.md` — the complete quality/philosophy template
   - `tool-usage.md` — tool usage instructions
   - `delegation.md` — sub-agent delegation patterns
   - `mcp-usage.md` — MCP usage directives
   - `context-rules.md` — context management rules for agents

3. **Update agent prompts**
   - Replace raw text in agent `.md` files with `{{template}}` references
   - Verify all agents receive expanded prompts

4. **AGENTS.md injection**
   - Copy & adapt `context-injector` feature from oh-my-opencode
   - Ensure AGENTS.md files are injected per-directory

### Deliverable
All agent prompts use the template system. Standards are shared and DRY. Adding a new standard or updating tool instructions updates all agents simultaneously.

---

## Phase 4: Sub-Agent System

**Goal**: Full sub-agent orchestration with context injection, background execution, and output persistence.

**Duration**: ~3-4 days

### Steps

1. **Background agent manager** (rewrite from oh-my-opencode patterns)
   - Concurrency limits per model
   - Task lifecycle management (pending → running → completed/failed)
   - Polling for completion
   - Session creation with agent/model selection

2. **Delegation tool** (`task`) (rewrite)
   - Parameters: agent, prompt, fresh_context, context config, background mode
   - Context injection: plan files + [PERSIST] messages + configurable items
   - Blocking by default, background if explicitly requested
   - Returns full output inline + file path reference

3. **Direct agent invocation** (`agent-invoke`) (rewrite)
   - Invoke a specific agent by name without category abstraction

4. **Background tools** (rewrite)
   - `background-output`: Retrieve results from background sub-agents (with blocking option)
   - `background-cancel`: Cancel specific background tasks

5. **Output persistence**
   - Write all sub-agent outputs to `~/.local/share/crucible/subagent-outputs/`
   - Include metadata: task prompt, agent, model, timestamp
   - 30-day retention with cleanup

6. **Agent usage reminder** (rewrite)
   - Remind the calling agent about available sub-agents after N turns without delegation

7. **Delegate task retry** (copy & adapt)
   - Auto-retry failed delegations with error context

8. **Error recovery integration**
   - `session-recovery` (copy & adapt) — fix malformed messages
   - `context-limit-recovery` (rewrite with oh-my-opencode's strategy cascade)

### Deliverable
Complete sub-agent system. Builder can fire Researchers/Scouts/Librarians in parallel, consult Oracle, and all outputs are persisted.

---

## Phase 5: Workflow & Context Management

**Goal**: Three-tier planning workflow, [PERSIST] system, custom compaction, plan auto-injection.

**Duration**: ~3-4 days

### Steps

1. **Workflow state system**
   - Phase mode detection (check for `docs/plan/`)
   - Current phase/sub-phase tracking
   - State persistence across sessions

2. **Plan auto-injection**
   - First-message detection in `chat.message` hook
   - Read plan files based on current position
   - Inject into system prompt via `experimental.chat.system.transform`
   - Size management (configurable which project plan files to include)

3. **[PERSIST] tag system**
   - Detection in `chat.message` hook
   - Tag stripping (agent never sees `[PERSIST]`)
   - Session state tracking of persistent messages
   - Auto-mark agent responses to persistent messages

4. **Custom compaction** (`/special-compact`)
   - `experimental.session.compacting` hook
   - Preserve [PERSIST] messages verbatim
   - Preserve metadata (phase, todos, decisions, files modified, sub-agent sessions)
   - Custom compaction prompt template
   - Plan file re-injection after compaction

5. **Todo system integration**
   - `compaction-todo-preserver` (copy & adapt)
   - Ensure OpenCode's native todo system works with our compaction

6. **All workflow commands**
   - `/plan-project`, `/plan-phase`, `/plan-subphase`
   - `/implement`
   - `/progress`, `/progress-phase`
   - `/load-context`
   - `/special-compact`
   - `/review`
   - `/handoff`
   - `/refactor`
   - Auto-create directory structures

7. **Skill loader** (copy & adapt from oh-my-opencode)
   - Discover skills from project and global directories
   - YAML frontmatter parsing
   - On-demand loading via skill tool

8. **MCP loader** (copy & adapt)
   - `.mcp.json` loading with env variable expansion

### Deliverable
The complete three-tier workflow is functional. Context management works end-to-end. Commands guide the user through planning, implementation, and review.

---

## Phase 6: Polish & Hardening

**Goal**: Production-ready stability, comprehensive testing, documentation.

**Duration**: ~2-3 days

### Steps

1. **End-to-end testing**
   - Test the full workflow: plan → implement → progress → review
   - Test general mode (no plan directory)
   - Test compaction + re-injection cycle
   - Test sub-agent system under load (10+ parallel agents)
   - Test context limit recovery

2. **MCP OAuth** (copy & adapt if needed for remote MCPs)

3. **Configuration validation**
   - Zod schema for `.crucible.json`
   - Helpful error messages for misconfiguration
   - Defaults for everything (zero-config should work)

4. **Performance optimization**
   - Template caching
   - Lazy loading of non-critical hooks
   - Minimize plugin initialization time

5. **README and setup guide**
   - Installation instructions
   - Configuration reference
   - Quickstart guide
   - Troubleshooting

6. **Edge cases**
   - What happens when plan files don't exist?
   - What happens when a sub-agent fails?
   - What happens when compaction loses important context?
   - What happens when the user switches agents mid-task?
   - Recovery from every known failure mode

### Deliverable
Production-ready Crucible. Stable, tested, documented.

---

## Summary Timeline

| Phase | Duration | Cumulative | Key Deliverable |
|-------|----------|------------|-----------------|
| 1. Foundation | 2-3 days | 2-3 days | Working plugin with agents, tools, MCPs |
| 2. Tools & Hooks | 2-3 days | 4-6 days | Full tool suite, enhancement hooks, skills |
| 3. Templates | 1-2 days | 5-8 days | DRY prompt system, shared standards |
| 4. Sub-Agents | 3-4 days | 8-12 days | Full sub-agent orchestration |
| 5. Workflow | 3-4 days | 11-16 days | Three-tier workflow, context management |
| 6. Polish | 2-3 days | 13-19 days | Production-ready |

**Total estimated**: 13-19 days

## Dependencies

```
Phase 1 (Foundation)
  ├── Phase 2 (Tools & Hooks) — depends on Phase 1 infrastructure
  │   └── Phase 3 (Templates) — depends on Phase 2 agent prompts
  └── Phase 4 (Sub-Agents) — depends on Phase 1 plugin skeleton
      └── Phase 5 (Workflow) — depends on Phase 4 sub-agents + Phase 3 templates
          └── Phase 6 (Polish) — depends on everything
```
