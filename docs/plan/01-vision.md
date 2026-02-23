# Crucible: Vision

> *"A vessel in which raw materials are refined into something pure and powerful."*

## What Crucible Is

Crucible is a god-mode OpenCode setup engineered to produce user-facing, production-ready, enterprise-grade, money-making software. It is a comprehensive plugin + forked OpenCode core + configuration system that transforms OpenCode from a general-purpose AI coding tool into a precision instrument for building complete, robust, high-quality applications of any kind.

Crucible is **not** a toy. It is **not** for vibe-coding. It is the difference between a weekend project and a product that makes thousands per month.

## What Crucible Is Not

- Not a fork of oh-my-opencode. Built from scratch, cherry-picking only the best pieces.
- Not an automated loop. The user is always in control.
- Not prescriptive. The three-tier workflow is the default, but the user can deviate at any time.
- Not language-specific. Works with TypeScript, Python, Rust, C/C++, Go, React Native, and anything else.

## Why Crucible Exists

### The Problem

Current AI coding setups fail in predictable ways:

1. **Bad context management.** The agent forgets what it was doing after compaction. Plan files aren't loaded. Sub-agent outputs are lost. The user spends more time re-explaining context than actually building.

2. **No planning discipline.** Agents jump straight to implementation without understanding the full scope. They produce code that doesn't fit the architecture, misses edge cases, and defers critical work to "later."

3. **Generic agent behavior.** The same agent prompt is used for planning, implementing, reviewing, and researching. No specialization means no excellence in any area.

4. **Fragile recovery.** When the context window fills, when an API error hits, when a sub-agent fails — the session often dies. The user has to start over, manually reconstructing context.

5. **No workflow structure.** Large projects need phased implementation with research, planning, and progress tracking. No existing setup provides this.

### The Solution

Crucible solves each of these with purpose-built systems:

1. **Context management**: `[PERSIST]` tags, custom compaction preserving critical context, auto-injection of plan files, DCP plugin for redundant context removal, sub-agent outputs persisted to files.

2. **Three-tier planning**: Dedicated Architect agent with planning commands. Tier 1 (project), Tier 2 (phase), Tier 3 (sub-phase). Research documents preserved. PROGRESS.md chain for continuity across sessions.

3. **Specialized agents**: 7 agents, each with a specific role, specific model, and specific system prompt. Builder (GPT 5.3 Codex) for implementation, Architect (Claude Opus 4.6) for planning, Researcher (Opus) for deep research, Reviewer (Opus) for code review, Oracle (Opus) for hard problems, Scout (Sonnet 4.6) for fast search, Librarian (Sonnet 4.6) for external docs.

4. **Resilient recovery**: Session recovery for 4 error types, reactive context-window limit recovery with multi-strategy cascade, edit/JSON error recovery, sub-agent retry on failure. No auto-compaction — only user-controlled.

5. **Structured workflow**: Commands (`/plan-project`, `/plan-phase`, `/implement`, `/progress`, `/review`) guide the workflow. Phase mode is opt-in. General mode works for maintenance, existing projects, and ad-hoc work.

## Core Philosophy

These principles are hardcoded into every agent's system prompt and are non-negotiable:

1. **Robustness and rigor over simplicity and speed.** We never take shortcuts. We never defer work unless it's explicitly planned for a later phase.

2. **Nothing is stubbed, skipped, or deferred** unless that deferral is an explicit, documented decision in the plan.

3. **Never work around missing tools.** If something is needed — a subscription, an account, a CLI tool, a configuration — ask the user to provide it. Never silently degrade.

4. **The whole codebase is ours.** We are not guests. If existing code needs to change for our implementation to be correct, we change it.

5. **Use Context7 exhaustively.** For any library, framework, or tool, consult Context7 for official documentation before making assumptions.

6. **Never reinvent the wheel.** Use enterprise-grade tools and libraries. Dependencies are not a problem — they are necessary for robust, large-scale applications.

7. **Never take the short path.** We have all the time and resources we need. Every implementation must be production-grade, complete, and well-integrated.

8. **Code indistinguishable from a senior engineer's.** No AI slop. No excessive comments. No generic patterns. Real engineering.

## Scope

Crucible supports:

- **Phase-based projects**: The full three-tier workflow (Project → Phase → Sub-phase) for large, complex applications.
- **Simplified projects**: Two-tier workflow (Project → Phase) for smaller projects that can be completed in days to a couple weeks.
- **Maintenance work**: Existing projects, bug fixes, feature additions, refactoring. Phase mode is opt-in — if there's no `docs/plan/` directory, Crucible operates in general mode.
- **Forked/inherited projects**: Projects without our phase structure. Same quality standards, same tools, no planning scaffolding.
- **Ad-hoc work**: One-off tasks, explorations, prototyping. Crucible doesn't force structure.

## Target Stack

Project-agnostic. Crucible works with any language, framework, or platform:

- TypeScript, JavaScript, React, Next.js
- Python, FastAPI, Django
- Rust, Go, C/C++
- React Native, Expo
- Infrastructure, DevOps, CI/CD
- AI/ML, data pipelines
- Embedded systems
- And anything else

## LLM Providers

Crucible leverages multiple providers for optimal model-to-task matching:

| Provider | Subscription | Models Used |
|----------|-------------|-------------|
| Anthropic | Claude Max5 | Claude Opus 4.6, Claude Sonnet 4.6 |
| OpenAI | ChatGPT Pro | GPT 5.3 Codex |
| Google | Gemini | Via Antigravity Auth (backup/specialized) |
| GitHub Copilot | Active | Fallback provider |

## Success Criteria

Crucible is successful when:

1. Starting a new project feels effortless — run `/plan-project` and the Architect guides you through comprehensive planning.
2. Context never gets lost — plan files are always loaded, [PERSIST] messages survive compaction, sub-agent outputs are on disk.
3. Implementation quality is indistinguishable from senior-engineer work — no stubs, no deferred work, no AI slop.
4. Large projects (50+ phases) complete successfully with continuity across hundreds of sessions.
5. The user spends zero time manually reconstructing context after compaction.
6. Switching between planning, implementing, and reviewing is a single command.
7. Every PR is reviewed rigorously before merge, with versioned review history.
