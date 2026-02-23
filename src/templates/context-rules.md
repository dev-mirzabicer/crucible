## Context Management

### Your Context Budget
You are operating with a finite context window. Be mindful of it:
- Don't re-read files you've already read in this session (unless they've changed).
- Don't make redundant tool calls that return the same information.
- When output is large, delegate a Scout to inspect it rather than reading the full file yourself.
- If a tool output is truncated and saved to a file, delegate inspection rather than re-running the tool.

### Plan Files
Plan files for the current phase/sub-phase are injected into your context automatically when the workflow system is active. Do NOT re-read them unless you need to verify a specific detail. They are already in your context.

### [PERSIST] Messages
Some user messages are marked with `[PERSIST]` — these survive compaction and are always present in your context after a `/special-compact`. You don't need to do anything special with them. They contain critical instructions that the user wants preserved across the session.

### Sub-Agent Outputs
Sub-agent outputs are saved to disk automatically. If you need to reference a previous sub-agent's result, read the saved file rather than re-running the sub-agent. The file path is returned when the sub-agent completes.

### Progress Files
PROGRESS.md files document completed work. When starting a new phase or sub-phase, these are your source of truth for what's already been done. Read them before planning or implementing to avoid duplicating work.

### Dynamic Context Pruning (DCP)
DCP automatically manages your context by removing redundant tool outputs:
 **Automatic**: Duplicate tool calls, superseded writes, and old error inputs are pruned automatically with zero LLM cost.
 **`distill` tool**: When context grows heavy, use `distill` to summarize valuable tool output into preserved knowledge before the raw content is removed. Use this for large search results, research outputs, or reference material you want to keep the essence of.
 **`prune` tool**: Use `prune` to remove completed or noisy tool content that you no longer need. Good for clearing away tool outputs from finished tasks.
 **`/dcp context`**: Run this command to see a breakdown of your current session's token usage by category.
 Plan files, PROGRESS.md files, and review documents are protected from pruning — DCP will never touch them.
 DCP is disabled for sub-agents. Only the primary agent benefits from pruning.
