# Crucible: Context Management

## Overview

Context management is the most critical aspect of Crucible. Every feature decision ultimately serves one goal: **the agent always has the right context to do excellent work.**

This document specifies five context management systems:

1. **[PERSIST] Tag System** — User-controlled message persistence across compaction
2. **Custom Compaction** (`/special-compact`) — Smart compaction preserving critical context
3. **Plan Auto-Injection** — Automatic loading of plan files on session start
4. **Sub-Agent Context Injection** — What context sub-agents receive
5. **Dynamic Context Pruning** (DCP) — Automatic removal of redundant context

## 1. [PERSIST] Tag System

### Purpose

When the user sends a message that must survive compaction (task descriptions, key decisions, project context), they prefix it with `[PERSIST]`.

### Mechanics

**Detection**: The `chat.message` hook scans each user message for `[PERSIST]` at the beginning (before any other text, allowing whitespace).

**Storage**: When detected:
1. The `[PERSIST]` tag is stripped from the message (the agent never sees it).
2. The message ID is recorded in session state as a "persistent message."
3. The agent's response to this message is also marked persistent (automatically).

**Compaction**: When `/special-compact` runs:
1. All persistent messages + their agent responses are extracted verbatim.
2. These are injected into the compaction prompt as `<preserved_messages>` blocks.
3. The compaction summary includes these messages in full, not summarized.

### Example

```
User: [PERSIST]
Hello! We're building a billing integration with RevenueCat for Phase 3.3.
Key constraints: webhook-only materialization, SDK for immediate UI, DB for enforcement.
Previous phases established the auth system and database schema.
Let's begin implementing the webhook handler.

Agent: [response — also preserved automatically]
```

After `/special-compact`, the next context will include both messages verbatim plus a summary of everything else.

### Multiple [PERSIST] Messages

A session can have multiple [PERSIST] messages. All are preserved. Order is maintained.

## 2. Custom Compaction (`/special-compact`)

### Purpose

Replace OpenCode's aggressive default compaction with a smart system that preserves critical context.

### Implementation

Uses the `experimental.session.compacting` hook to customize the compaction prompt.

### What Is Preserved (Always)

| Item | How | Source |
|------|-----|--------|
| [PERSIST] messages + responses | Verbatim in compaction context | Session state |
| Current phase/sub-phase ID | Injected as metadata | Workflow state |
| Complete todo list with status | Serialized as markdown | OpenCode todo system |
| Key decisions made | Extracted from agent messages containing decision markers | Pattern matching |
| Files modified this session | Tracked via `file.edited` events | Event listener |
| Sub-agent session IDs | For potential continuation | Background agent manager |
| Plan file references | Which plan files were loaded | Plan injector state |

### Compaction Prompt Structure

```markdown
## Compaction Instructions

You are summarizing a conversation for continuity. Preserve the following VERBATIM:

### Preserved Messages (DO NOT SUMMARIZE)
<preserved_messages>
[All [PERSIST] messages and their responses, in order]
</preserved_messages>

### Session Metadata
- Current position: Phase {{phase}}, Sub-phase {{subphase}}
- Plan files loaded: {{plan_files}}
- Files modified: {{modified_files}}
- Active sub-agent sessions: {{session_ids}}

### Todo List
{{todo_list_markdown}}

### Key Decisions
{{extracted_decisions}}

### Instructions
Summarize the REST of the conversation (everything NOT in preserved_messages) concisely.
Focus on: what was done, what was decided, what remains, what problems were encountered.
Do NOT summarize the preserved messages — they must appear exactly as-is.
```

### Manual Trigger Only

`/special-compact` is a manual command. There is **no auto-compaction** in Crucible. The user decides when to compact. The only automatic context intervention is:
- Context window monitor (warning at 70%, information only)
- Context limit recovery (reactive, only when API returns token limit error)

## 3. Plan Auto-Injection

### Purpose

When a session starts in phase mode, automatically load the relevant plan files so the agent has full context without the user manually requesting file reads.

### Detection

The `chat.message` hook detects the **first user message** in a session (tracked via session state). On first message:

1. Check if workflow state indicates phase mode (i.e., `docs/plan/` exists).
2. If yes, determine current phase/sub-phase from workflow state.
3. Read and inject plan files.

### What Gets Injected

For an implementation session (`/implement 3.3`):

| Context Item | Files | Injection Method |
|-------------|-------|-----------------|
| Project plan (key docs) | `docs/plan/01-vision.md`, `docs/plan/03-architecture.md`, `docs/plan/phases.md` | System prompt via `experimental.chat.system.transform` |
| Phase plan | All files in `docs/phases/phase_3/plan/` | System prompt |
| Sub-phase plan | All files in `docs/phases/phase_3/3-3/plan/` | System prompt |
| Previous phase progress | `docs/phases/phase_1/PROGRESS.md`, `docs/phases/phase_2/PROGRESS.md` | System prompt |
| Previous sub-phase progress | `docs/phases/phase_3/3-1/PROGRESS.md`, `docs/phases/phase_3/3-2/PROGRESS.md` | System prompt |

For a planning session (`/plan-subphase 3.3`):

| Context Item | Files | Injection Method |
|-------------|-------|-----------------|
| Full project plan | All files in `docs/plan/` | System prompt |
| Phase plan | All files in `docs/phases/phase_3/plan/` | System prompt |
| Previous progress | All PROGRESS.md files up to current point | System prompt |

### Injection Method

Plan content is injected via `experimental.chat.system.transform`, appended to the agent's system prompt in a structured format:

```markdown
<project_context>
## Project Plan
### Vision (docs/plan/01-vision.md)
[file content]

### Architecture (docs/plan/03-architecture.md)
[file content]

## Current Phase: Phase 3 — Billing Integration
### Phase Plan
[phase plan files content]

## Current Sub-Phase: 3.3 — Webhook Handler
### Sub-Phase Plan
[sub-phase plan files content]

## Previous Progress
### Phase 1 Progress
[PROGRESS.md content]
...
</project_context>
```

### Size Management

Plan injection can be large. Mitigations:
- Project plan: Only key documents (configurable which ones), not all.
- Phase plan: Full — it's directly relevant.
- Sub-phase plan: Full — it's the implementation spec.
- Progress files: Only phase-level progress for completed phases. Sub-phase progress only for current phase.
- If total exceeds a configurable threshold (e.g., 100k tokens), warn the user and suggest trimming.

## 4. Sub-Agent Context Injection

### Default Behavior (`fresh_context = false`)

When the main agent calls a sub-agent (via the `task` tool), the sub-agent receives:

1. **Plan files**: Same plan files that are in the main agent's context (via workflow state).
2. **[PERSIST] messages**: All messages marked with [PERSIST] in the current session.
3. **The task prompt**: The specific instructions from the calling agent.

### Fresh Context (`fresh_context = true`)

When explicitly requested, the sub-agent gets only the task prompt. No plan files, no [PERSIST] messages. Used for truly independent tasks that don't need project context.

### Configurable Context

The calling agent can specify additional context via tool parameters:

```typescript
task({
  agent: "researcher",
  prompt: "Research RevenueCat webhook best practices",
  context: {
    fresh: false,                     // Include plan + [PERSIST] (default)
    recentToolCalls: 5,              // Include last 5 tool call results
    specificToolOutputs: ["call_abc"], // Include specific tool outputs by ID
    files: ["src/webhooks/handler.ts"], // Auto-read these files
  }
})
```

### Output Persistence

Sub-agent outputs are **always** written to disk:
- Location: `~/.local/share/crucible/subagent-outputs/<session-id>/<task-id>.md`
- Contains: task prompt, agent used, model used, full output, timestamp
- Retention: 30 days (configurable)
- The main agent receives the output inline AND a reference to the file path.

## 5. Dynamic Context Pruning (DCP)

### Configuration

DCP runs as a separate plugin (`@tarquinen/opencode-dcp`) with Crucible-tuned settings:

```jsonc
{
  "tools": {
    "settings": {
      "contextLimit": "70%",        // Start suggesting pruning at 70%
      "nudgeFrequency": 15          // Every 15 tool calls, nudge about pruning
    },
    "distill": { "permission": "allow" },  // AI can summarize tool outputs
    "compress": { "permission": "deny" },   // No message compression
    "prune": { "permission": "allow" }      // AI can remove tool outputs
  },
  "strategies": {
    "deduplication": { "enabled": true },    // Remove duplicate tool calls
    "supersedeWrites": { "enabled": true },  // Remove writes superseded by reads
    "purgeErrors": { "enabled": true, "turns": 4 }  // Remove old error inputs
  },
  "turnProtection": { "turns": 6 },         // Protect recent 6 turns from pruning
  "protectedFilePatterns": [
    "docs/plan/**",                          // Never prune plan file reads
    "docs/phases/**/PROGRESS.md",            // Never prune progress reads
    "**/AGENTS.md"                           // Never prune AGENTS.md reads
  ]
}
```

### Interaction with Crucible

- DCP is **disabled for sub-agents** (by DCP's design). Sub-agents have their own context management.
- DCP's automatic strategies (dedup, supersede-writes, purge-errors) run on every request at zero LLM cost.
- DCP's AI tools (distill, prune) are available for the agent to call when context gets tight.
- Plan file reads are **protected** from pruning via `protectedFilePatterns`.

## Context Flow Diagram

```
Session Start
  │
  ├── Plan Auto-Injector reads plan files → system prompt
  │
  ├── User sends [PERSIST] message → marked in session state
  │
  ├── Agent works (tool calls, sub-agents)
  │   │
  │   ├── DCP auto-strategies run each request:
  │   │   ├── Dedup identical tool calls
  │   │   ├── Supersede writes with subsequent reads
  │   │   └── Purge old error inputs
  │   │
  │   ├── Tool output truncator caps large outputs
  │   │
  │   └── Context window monitor tracks usage (warns at 70%)
  │
  ├── Context gets tight (approaching limit)
  │   │
  │   ├── Agent uses DCP distill/prune tools
  │   └── User runs /special-compact:
  │       ├── Preserve [PERSIST] messages verbatim
  │       ├── Preserve todos, metadata, decisions
  │       ├── Summarize everything else
  │       └── Plan files re-injected on next message
  │
  └── API token limit error (rare, safety net)
      └── Context limit recovery cascade:
          ├── 1. Dedup tool results
          ├── 2. Truncate largest tool outputs
          └── 3. Summarize (last resort)
```
