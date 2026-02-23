---
description: Create continuation handoff for a fresh session
agent: builder
---
Produce a detailed handoff and write it to `.crucible/handoff-<timestamp>.md`.

Include:
1. Current workflow position (mode, phase, subphase)
2. Completed work in this session
3. Pending work and next concrete actions
4. Key decisions and rationale
5. Modified files and important diffs
6. Active/deferred sub-agent task IDs and output file paths
7. Exact files that must be re-read on resume

After writing, print the generated handoff path.
