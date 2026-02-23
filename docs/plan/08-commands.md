# Crucible: Command Specifications

## Overview

Crucible provides 11 custom commands implemented as OpenCode command templates (`.opencode/commands/*.md`). Commands can switch agents, inject methodology, and trigger workflows.

## Command 1: `/plan-project`

**Agent**: Architect
**Mode**: Conversation-starter
**Arguments**: Optional seed topic

```markdown
---
agent: architect
---
You are entering Tier 1 Project Planning mode.

$ARGUMENTS

## Your Task
Guide the user through comprehensive project planning. This is the highest-level planning tier — you are designing the entire project.

## Process
1. **Interview**: Ask the user what they want to build, why, for whom, and what constraints exist. Be thorough but not tedious — adapt to what they volunteer.
2. **Research**: Once you understand the project, dispatch 5-15 Researcher sub-agents in parallel to investigate key topics (technology choices, architecture patterns, market/competitor analysis, best practices, etc.).
3. **Synthesize**: Present findings, highlight key decisions, identify tradeoffs. Discuss with the user.
4. **Document**: Write plan documents to `docs/plan/` covering vision, requirements, architecture, data model, API design, and other project-specific concerns.
5. **Define Phases**: Create `docs/plan/phases.md` listing all implementation phases with one-sentence descriptions.

## Rules
- Create `docs/plan/` and `docs/research/` directories if they don't exist.
- Research documents go in `docs/research/` with numbered filenames.
- Plan documents go in `docs/plan/` with numbered filenames.
- Phases are listed with descriptions only — no implementation details.
- All decisions must be explicit and justified.
```

## Command 2: `/plan-phase`

**Agent**: Architect
**Arguments**: Phase number (required)

```markdown
---
agent: architect
---
You are entering Tier 2 Phase Planning mode for Phase $1.

## Context Loading
1. Read all files in `docs/plan/` (the project plan).
2. Read all PROGRESS.md files from previous phases (`docs/phases/phase_*/PROGRESS.md`).
3. Read the phase description from `docs/plan/phases.md`.

## Your Task
Plan Phase $1 in detail. You have the full project plan and know what previous phases accomplished.

## Process
1. Review the phase description and previous progress.
2. Ask clarifying questions about this specific phase.
3. Dispatch targeted Researcher sub-agents for phase-specific topics.
4. Write detailed plan documents to `docs/phases/phase_$1/plan/`.
5. Define sub-phases in `docs/phases/phase_$1/plan/subphases.md`.
6. Write a PRIMER.md with pre-phase context.

## Rules
- Create directories if they don't exist.
- Build upon the project plan — fill in blanks, don't contradict.
- If you discover the project plan needs modification, document it explicitly and ask the user.
- Sub-phases should be 3-10 per phase, each completable in 1-3 sessions.
```

## Command 3: `/plan-subphase`

**Agent**: Architect
**Arguments**: Sub-phase identifier (e.g., "3.3")

```markdown
---
agent: architect
---
You are entering Tier 3 Sub-Phase Planning mode for Sub-Phase $1.

## Context Loading
Parse "$1" as Phase.Subphase (e.g., "3.3" → Phase 3, Sub-phase 3).
1. Read key project plan docs from `docs/plan/` (~30-50%).
2. Read ALL files in `docs/phases/phase_<N>/plan/` (the phase plan).
3. Read all PROGRESS.md files from previous sub-phases in this phase.
4. Read previous phases' PROGRESS.md files.

## Your Task
Plan Sub-Phase $1 with full implementation detail. After this, the Builder should have zero ambiguity.

## Process
1. Review phase plan and previous sub-phase progress.
2. Conduct targeted research (specific APIs, integration patterns, library usage).
3. Make ALL decisions: architecture, implementation details, error handling, edge cases.
4. Write plan documents to the sub-phase directory.
5. Include a README.md as a quick reference for the Builder.

## Rules
- Create directories if they don't exist.
- Every decision must be made here — the Builder should not need to make architectural choices.
- Include error handling strategy, testing approach, and integration points.
- If external setup is needed (accounts, API keys, etc.), document what the user needs to do.
```

## Command 4: `/implement`

**Agent**: Builder
**Arguments**: Sub-phase identifier (e.g., "3.3")

```markdown
---
agent: builder
---
You are entering Implementation mode for Sub-Phase $1.

## Context Loading
Parse "$1" as Phase.Subphase.
1. Read ALL files in the sub-phase plan directory.
2. Read the phase plan (key documents).
3. Read previous sub-phase PROGRESS.md files in this phase.
4. Read key project plan documents.

## Your Task
Implement everything planned for Sub-Phase $1. Completely. Robustly. With no deferrals.

## Rules
- Everything in the plan must be implemented unless it explicitly says "deferred to Phase/Sub-Phase X".
- Run tests and LSP diagnostics after significant changes.
- Make atomic, coherent commits with descriptive messages.
- Open a PR when implementation is complete.
- If the plan is ambiguous on any point, ask the user rather than guessing.
```

## Command 5: `/progress`

**Agent**: Builder
**Arguments**: Sub-phase identifier (e.g., "3.3")

```markdown
---
agent: builder
---
Generate a comprehensive PROGRESS.md for Sub-Phase $1.

## What to Include
1. **Summary**: What was implemented (2-3 sentences).
2. **Completed Items**: Everything that was done, organized by category.
3. **Decisions Made**: Any decisions made during implementation that weren't in the plan.
4. **Deviations**: Any deviations from the plan and why.
5. **Files Modified**: List of files created/modified.
6. **Tests Added**: Tests written and what they cover.
7. **Known Issues**: Any issues discovered but not within scope to fix.
8. **Notes for Next Sub-Phase**: Context the next sub-phase implementer should know.

## Output
Write to `docs/phases/phase_<N>/<N-M>/PROGRESS.md`.
```

## Command 6: `/progress-phase`

**Agent**: Builder
**Arguments**: Phase number

```markdown
---
agent: builder
---
Generate a comprehensive phase-level PROGRESS.md for Phase $1.

## Process
1. Read ALL sub-phase PROGRESS.md files in `docs/phases/phase_$1/`.
2. Synthesize them into a single comprehensive phase progress report.

## What to Include
1. **Phase Summary**: What this phase accomplished overall.
2. **Sub-Phase Summaries**: Brief summary of each sub-phase.
3. **Key Decisions**: Important decisions made across all sub-phases.
4. **Architecture Changes**: Any architectural changes from the original plan.
5. **Current State**: What the codebase looks like after this phase.
6. **Notes for Next Phase**: Critical context for the next phase.

## Output
Write to `docs/phases/phase_$1/PROGRESS.md`.

## Purpose
This file replaces the need to read all individual sub-phase PROGRESS.md files. Future phases only need this file for context from this phase.
```

## Command 7: `/load-context`

**Agent**: Current (doesn't switch)
**Arguments**: Optional phase/sub-phase identifier

```markdown
Manually load plan and progress files into context.

If argument provided: load files for that specific phase/sub-phase.
If no argument: detect current phase from workflow state and load accordingly.

## What to Load
1. Key project plan documents from `docs/plan/`.
2. Current phase plan from `docs/phases/phase_<N>/plan/`.
3. Current sub-phase plan (if applicable).
4. All relevant PROGRESS.md files.

Read each file and confirm what was loaded.
```

## Command 8: `/special-compact`

**Agent**: Current (doesn't switch)

```markdown
Run Crucible's smart compaction. This preserves:
- All [PERSIST]-tagged messages and their agent responses (verbatim)
- Current phase/sub-phase position
- Complete todo list with status
- Key decisions made this session
- Files modified this session
- Active sub-agent session IDs
- Plan file references

Everything else is summarized concisely.

After compaction, plan files will be re-injected on your next message.
```

*Note: This command triggers the `experimental.session.compacting` hook with our custom compaction logic. The command template provides user-facing documentation; the actual logic is in the hook.*

## Command 9: `/review`

**Agent**: Reviewer
**Arguments**: PR number (required)

```markdown
---
agent: reviewer
---
Review PR #$1 against the implementation plan.

## Process
1. Get the PR diff: `gh pr diff $1`
2. Get PR info: `gh pr view $1`
3. Identify which phase/sub-phase this PR implements (from PR description or branch name).
4. Read the sub-phase plan documents.
5. Conduct a thorough, systematic review (see Reviewer agent methodology).
6. Write the review to the appropriate reviews/ directory.
7. Report the review file path so the user can share it with the Builder.

## Output Location
`docs/phases/phase_<N>/<N-M>/reviews/pr-$1-review-<sequence>.md`

Increment the sequence number if previous reviews for this PR exist.
```

## Command 10: `/handoff`

**Agent**: Current (doesn't switch)

```markdown
Create a detailed context summary for continuing work in a new session.

## What to Capture
1. What we were working on (phase, sub-phase, task).
2. What's been done in this session.
3. What remains to be done.
4. Any in-progress work (uncommitted changes, open sub-agents).
5. Key decisions made.
6. Current state of the codebase.
7. Any issues or blockers.

## Output
Write to `.crucible/handoff-<timestamp>.md` and display the path.

This file can be given to the agent in the new session as initial context.
```

## Command 11: `/refactor`

**Agent**: Builder
**Arguments**: Description of what to refactor

```markdown
---
agent: builder
---
Perform an intelligent refactoring: $ARGUMENTS

## Process
1. Analyze the target code with LSP, AST-grep, and direct reading.
2. Understand all usages and dependencies (find_references).
3. Plan the refactoring steps (identify what changes and what's affected).
4. Execute changes systematically.
5. Verify with LSP diagnostics on ALL affected files.
6. Run tests if they exist.

## Rules
- Use LSP rename for symbol renames (safe, workspace-wide).
- Use AST-grep for structural transformations.
- Never mix refactoring with feature changes or bug fixes.
- Verify every affected file after changes.
```
