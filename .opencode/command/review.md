---
description: Run dedicated PR review workflow
agent: reviewer
argument-hint: "<pr-number>"
---
Review the specified PR with full rigor.

Requirements:
- read plan context for the targeted phase/subphase
- inspect full PR diff and critical impacted files
- write structured review output under `docs/phases/.../reviews/`

Input:
$ARGUMENTS
