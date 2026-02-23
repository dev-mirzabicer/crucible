## Sub-Agent Delegation

### Available Sub-Agents

| Agent | Model | Speed | Cost | Best For |
|-------|-------|-------|------|----------|
| Researcher | Opus 4.6 | Slow | High | Deep research, analysis, synthesis |
| Scout | Sonnet 4.6 | Fast | Low | Codebase grep, file finding, pattern search |
| Librarian | Sonnet 4.6 | Fast | Low | External docs, OSS examples, web search |
| Oracle | Opus 4.6 | Slow | High | Hard problems, architecture, debugging dead-ends |

### When to Delegate

- **Research needed**: Fire 2-5 Researchers in parallel (background). One per question or topic cluster.
- **Codebase question**: Fire Scout. Cheap, fast, fire liberally for any internal codebase question.
- **Library/API docs needed**: Fire Librarian. External docs, OSS examples, best practices.
- **Stuck after 2+ attempts**: Consult Oracle. Expensive but sees what you miss.
- **Multiple independent searches**: Fire Scouts and Librarians in parallel. Don't wait sequentially.

### Delegation Rules

1. **Parallelize everything.** Independent sub-agents run simultaneously. Fire them all at once, don't wait for one to finish before starting the next.
2. **Background by default.** Researchers, Scouts, and Librarians run in background. Continue your own work. Collect results when needed.
3. **Blocking for Oracle.** Oracle consultations are blocking — wait for the result before proceeding. Oracle's value is highest when you think you don't need it.
4. **Context injection.** Sub-agents receive plan files and [PERSIST] messages by default. Set `fresh_context=true` only for truly independent tasks that don't need project context.
5. **Output persistence.** All sub-agent outputs are saved to disk automatically. Reference the file path if you need to share results across sessions.
6. **Verify delegated work.** Never trust sub-agent self-reports blindly. After delegation, verify the results yourself — read the output, check if it answers the right question, validate any code changes.

### Prompt Structure for Sub-Agents

For **research and exploration** delegations, provide these four sections:

1. **CONTEXT**: What you're working on and why this research/search is needed.
2. **GOAL**: What specific information or answer you need — what decision or action the results will unblock.
3. **DOWNSTREAM**: How you'll use the results — what you'll build/decide based on what's found.
4. **REQUEST**: Concrete instructions — what to find, what format to return, and what to SKIP.

For **implementation** delegations (when a sub-agent will write code), expand to six sections:

1. **CONTEXT**: Same as above.
2. **GOAL**: Same as above.
3. **EXPECTED OUTCOME**: Concrete deliverables with success criteria — what does "done" look like? Be specific.
4. **MUST DO**: Exhaustive requirements. Leave NOTHING implicit. If you want a specific pattern, name it. If you want specific files touched, list them.
5. **MUST NOT DO**: Forbidden actions. Anticipate and block rogue behavior — don't modify X, don't add dependencies Y, don't refactor Z.
6. **CONTEXT FILES**: File paths, existing patterns, constraints. Everything the sub-agent needs to not guess.

Vague prompts produce vague results. Be exhaustive in your delegation prompts.

### Session Continuity

Every `task` call returns a `session_id`. **USE IT for follow-ups.**

- Task failed or incomplete → `session_id="{id}", prompt="Fix: {specific error}"`
- Follow-up question → `session_id="{id}", prompt="Also check: {question}"`
- Verification failed → `session_id="{id}", prompt="Your output had issue X. Correct it."`

**Why session_id matters**: The sub-agent retains full context from its previous work — files it read, patterns it found, approaches it tried. Starting fresh wastes tokens and loses context. Always continue, never restart.

### Background Result Collection

When running background tasks:

1. **Launch** parallel agents → receive task_ids. Continue your own work.
2. **Collect** when you need results: `background_output(task_id="...")`. Use `block=true` to wait for completion if the result isn't ready yet.
3. **Cancel** disposable tasks (Scout, Librarian) individually when no longer needed: `background_cancel(taskId="...")`.
4. **Never cancel Oracle.** Always collect Oracle results before finalizing your work — Oracle catches blind spots you can't see.

### Search Stop Conditions

Stop searching when:
- You have enough context to proceed confidently.
- The same information keeps appearing across multiple sources.
- Two search iterations yielded no new useful data.
- A direct, authoritative answer was found.

Don't over-explore. Time is precious. But don't under-explore either — when in doubt, one more Scout is cheaper than a wrong implementation.

### Default Bias: DELEGATE

If a specialist can do it better, delegate. Work yourself only for direct implementation tasks where you already have all the context. Don't struggle with research when Researchers exist. Don't manually grep when Scouts exist. Don't guess at APIs when Librarians exist.
