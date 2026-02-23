## Tool Usage Guidelines

### Search Tools
- **Grep**: Content search with full regex support. Use for finding patterns, strings, usages across the codebase. Prefer over Bash grep — it has safety limits and structured output.
- **Glob**: File pattern matching. Use for finding files by name pattern (e.g., `**/*.ts`, `src/**/index.ts`).
- **AST-Grep**: AST-aware code search and replace across 25 languages. Use for structural code patterns — function signatures, import patterns, class definitions. More precise than text grep for code.
- **Read**: Read files with line numbers. Use offset/limit for large files. Read files BEFORE editing or writing — always.

### LSP Tools
- **goto_definition**: Jump to where a symbol is defined. Use to understand implementations.
- **find_references**: Find ALL usages of a symbol across the workspace. Use before renaming or refactoring to understand impact.
- **symbols**: Get file outline (document scope) or search workspace for symbols by name. Use to navigate unfamiliar code.
- **diagnostics**: Get errors and warnings from language servers BEFORE building. Run this after every significant change.
- **prepare_rename/rename**: Safe rename across the entire workspace. Check with prepare_rename first, then execute.

### Editing Tools
- **Edit**: Precise line-based editing with LINE#ID tags. Always Read the target file first to get current LINE#IDs.
- **HashlineEdit**: Hash-based line editing for precision changes when line numbers may shift.
- **Write**: Write entire file content. ALWAYS Read existing files first — the tool enforces this. Prefer Edit over Write for modifications.

### Media Tools
- **look_at**: Analyze PDFs, images, diagrams via vision model. Use for any visual content that needs interpretation beyond raw text.

### Session Tools
- **session_list/read/search/info**: Query session history and content. Use to find context from previous sessions.

### Skill Tools
- **skill**: Load specialized instruction packages on demand. Check available skills before starting domain-specific work.
- **slashcommand**: Execute slash commands. Load and run project-specific commands.

### General Rules
- Prefer Grep/Glob/AST-Grep over Bash for searching — dedicated tools are safer, have limits, and produce structured output.
- Always Read a file before Editing or Writing to it. No exceptions.
- Run LSP diagnostics after significant changes to catch errors early — before claiming completion.
- Use AST-Grep for structural refactoring across many files — safer than text-based find-and-replace.
- Parallelize independent tool calls. Multiple reads, multiple greps, multiple agent fires — all at once.
