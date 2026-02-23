# Crucible: Workflow System

## Overview

Crucible supports two primary workflow modes, automatically detected based on project structure:

1. **Phase Mode**: Activated when `docs/plan/` exists. Provides the full three-tier planning workflow.
2. **General Mode**: Default when no plan directory exists. Full tool access, quality standards, no planning scaffolding.

Both modes share the same agents, tools, quality standards, and context management. The difference is whether planning commands and plan auto-injection are active.

## Phase Mode: Three-Tier Planning

### Tier 1: Project Planning

**Trigger**: `/plan-project` command, switches to Architect agent.

**Purpose**: Design the entire project at a high level. This is the equivalent of months of professional project planning, compressed into days of intensive AI-assisted research, brainstorming, and decision-making.

**Process**:
1. User runs `/plan-project` (optionally with a seed topic).
2. Architect agent activates with Tier 1 planning methodology injected.
3. Architect interviews the user: what are we building, why, for whom, constraints, goals.
4. Architect dispatches 10+ Researcher sub-agents in parallel for deep research:
   - Market analysis, competitor review
   - Technology evaluation, library comparison
   - Architecture patterns, best practices
   - Compliance, security, performance requirements
5. Research outputs are persisted to `docs/research/` as numbered markdown files.
6. Architect and user iterate on findings, make decisions, resolve ambiguities.
7. Plan documents are written to `docs/plan/`:
   - `01-vision.md` — What and why
   - `02-requirements.md` — Functional and non-functional requirements
   - `03-architecture.md` — System architecture, tech stack, integrations
   - `04-data-model.md` — Database schema, data flow
   - `05-api-design.md` — API contracts, authentication
   - (more as needed, project-specific)
   - `phases.md` — Phase list with one-sentence descriptions + key bullet points
8. Implementation is divided into 5–50 Phases depending on complexity.

**Output**:
```
docs/
├── plan/
│   ├── 01-vision.md
│   ├── 02-requirements.md
│   ├── 03-architecture.md
│   ├── ...
│   └── phases.md
├── research/
│   ├── 01-market-analysis.md
│   ├── 02-tech-evaluation.md
│   └── ...
└── PROGRESS.md            # (created later, after first phase completes)
```

**Key Principles**:
- Plan documents are NOT implementation-specific. They describe *what* to build, not *how* to code it.
- Research documents are preserved permanently for future reference.
- Phases are listed with one-sentence descriptions only — details come in Tier 2.

### Tier 2: Phase Planning

**Trigger**: `/plan-phase <N>` command, switches to Architect agent.

**Purpose**: Zoom into a specific Phase and plan it in detail. The Architect has full context of the Tier 1 plan and all previous phases' PROGRESS.md files.

**Process**:
1. User runs `/plan-phase 3`.
2. Architect activates with:
   - Full Tier 1 plan loaded (all `docs/plan/*.md`)
   - Previous phases' PROGRESS.md files loaded (`docs/phases/phase_1/PROGRESS.md`, etc.)
   - Tier 2 planning methodology injected
3. Architect reviews the phase description from `phases.md` and asks clarifying questions.
4. Targeted research via Researcher sub-agents (phase-specific topics).
5. Research persisted to `docs/phases/phase_N/research/`.
6. Detailed plan documents written to `docs/phases/phase_N/plan/`.
7. Sub-phases defined (usually 3–10 per phase).

**Output**:
```
docs/phases/phase_3/
├── plan/
│   ├── 01-overview.md
│   ├── 02-architecture-decisions.md
│   ├── ...
│   └── subphases.md
├── research/
│   ├── 01-specific-research.md
│   └── ...
└── PRIMER.md              # Pre-phase context written right after planning
```

**Key Principles**:
- Builds upon Tier 1, filling in blanks and making decisions more specific.
- May RARELY suggest modifications to the original plan (documented explicitly).
- Sub-phases listed with descriptions, planned in Tier 3.

### Tier 3: Sub-Phase Planning

**Trigger**: `/plan-subphase <N.M>` command, switches to Architect agent.

**Purpose**: Plan a specific Sub-Phase with full implementation detail. After this, everything should be crystal clear for the Builder.

**Process**:
1. User runs `/plan-subphase 3.3`.
2. Architect activates with:
   - ~30-50% of Tier 1 plan (key documents)
   - ~80-100% of Phase 3 plan
   - Previous sub-phases' PROGRESS.md files (3.1, 3.2)
   - Tier 3 planning methodology injected
3. Targeted research (very specific — API docs, library usage, integration patterns).
4. All decisions finalized: architecture, implementation details, edge cases, error handling.
5. Plan documents written to `docs/phases/phase_3/3-3/plan/`.

**Output**:
```
docs/phases/phase_3/3-3/
├── plan/
│   ├── 01-overview.md
│   ├── 02-implementation-spec.md
│   ├── ...
│   └── README.md           # Quick reference for the Builder
├── research/
│   ├── 01-api-integration.md
│   └── ...
└── PROGRESS.md             # (created after implementation)
```

### Implementation

**Trigger**: `/implement <N.M>` command, uses Builder agent.

**Process**:
1. User runs `/implement 3.3`.
2. Builder activates with:
   - Sub-phase plan auto-loaded (100% of `docs/phases/phase_3/3-3/plan/`)
   - Phase plan loaded (~80-100%)
   - Project plan summary (~30-50%)
   - Previous progress files
3. Builder implements everything planned for this sub-phase.
4. Nothing is deferred, stubbed, or skipped unless explicitly noted in the plan as belonging to a later phase.
5. Builder runs tests, linting (native OpenCode), and verifies the implementation.
6. Builder opens a PR with atomic, high-quality commits.

### Progress Tracking

**After Sub-Phase Implementation**: `/progress 3.3`
- Generates `docs/phases/phase_3/3-3/PROGRESS.md`
- Documents: what was done, decisions made during implementation, deviations from plan, files modified, tests added.
- This file is the primary context source for the next sub-phase.

**After All Sub-Phases of a Phase**: `/progress-phase 3`
- Generates `docs/phases/phase_3/PROGRESS.md`
- Comprehensively summarizes all sub-phase PROGRESS.md files.
- This is the only file the next phase needs from this phase (no need to load all sub-phase progress files).

### PR Review Cycle

After implementation, the PR goes through iterative review:

1. **Agent opens PR**: Atomic commits, descriptive PR title and body.
2. **Automated reviewers**: GitHub-based auto-review tools add comments.
3. **Crucible review**: User runs `/review <pr-no>` in a **separate session**.
   - Reviewer agent analyzes the full diff against the plan.
   - Review output written to `docs/phases/phase_3/3-3/reviews/pr-42-review-01.md`.
   - User tells Builder: "Review done! Check `docs/phases/phase_3/3-3/reviews/pr-42-review-01.md`"
4. **Builder fixes**: Addresses review feedback, pushes changes.
5. **Repeat**: Steps 2-4 until the PR converges to high quality.
6. **Merge**: PR is merged.
7. **Update progress**: If review led to significant changes, update PROGRESS.md.

### Context Budget Per Tier

| Context Item | Tier 1 (Project) | Tier 2 (Phase) | Tier 3 (Sub-phase) | Implementation |
|-------------|-------------------|-----------------|---------------------|----------------|
| Project plan | N/A (creating it) | 100% | 30-50% (key docs) | 30-50% |
| Phase plan | N/A | N/A (creating it) | 80-100% | 80-100% |
| Sub-phase plan | N/A | N/A | N/A (creating it) | 100% |
| Previous phase PROGRESS | N/A | All previous | All previous | All previous |
| Previous sub-phase PROGRESS | N/A | N/A | All previous (this phase) | All previous (this phase) |

## Simplified Mode (Two-Tier)

For projects that can be completed in days to a couple weeks:

- Skip Tier 2 entirely.
- Tier 1 plans the project + defines "phases" (which are effectively sub-phases).
- Each "phase" goes through: `/plan-subphase <N>` → `/implement <N>` → `/progress <N>`.
- No nested sub-phases. Simpler, faster, same quality.

## General Mode (Non-Phase Work)

When no `docs/plan/` directory exists:

- All agents and tools are available.
- Quality standards are still enforced (via hardcoded system prompts).
- No planning commands are injected (but they're still accessible).
- Context management ([PERSIST], custom compaction) still works.
- Suitable for: maintenance, bug fixes, feature additions, refactoring, ad-hoc tasks, building tools, non-project work.

## Workflow Flexibility

The three-tier workflow is the **default structure**, not a rigid constraint:

- User can revamp remaining phases mid-project (e.g., after Phase 5 of 12, restructure Phases 6-12).
- User can skip tiers for familiar work.
- User can run planning commands at any time, not just at phase boundaries.
- User can switch between agents freely (Tab key).
- User can work on multiple sub-phases in parallel (separate sessions).
- User controls when to compact, when to persist, when to review.

## Directory Structure Auto-Creation

Commands auto-create directories when they don't exist:

| Command | Creates |
|---------|---------|
| `/plan-project` | `docs/plan/`, `docs/research/` |
| `/plan-phase 3` | `docs/phases/phase_3/plan/`, `docs/phases/phase_3/research/` |
| `/plan-subphase 3.3` | `docs/phases/phase_3/3-3/plan/`, `docs/phases/phase_3/3-3/research/` |
| `/progress 3.3` | `docs/phases/phase_3/3-3/PROGRESS.md` |
| `/review 42` | `docs/phases/phase_3/3-3/reviews/` (path inferred from current context) |
