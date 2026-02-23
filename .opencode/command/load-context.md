---
description: Manually reload plan and progress context
agent: builder
argument-hint: "[phase or phase.subphase]"
---
Reload planning/progress context for the current or specified scope.

Procedure:
1. Determine target scope from argument, else use current workflow state.
2. Ensure phase mode context is refreshed.
3. Read all required files from:
   - docs/plan/ (project plan subset)
   - docs/phases/phase_<N>/plan/
   - docs/phases/phase_<N>/<N-M>/plan/ (when subphase is known)
   - relevant PROGRESS.md files
4. Confirm loaded files explicitly before continuing.

Quality bar:
- Use deterministic ordering while reading files.
- Do not skip files in required coverage ranges.
- If expected files are missing, report exact paths.

Input:
$ARGUMENTS
