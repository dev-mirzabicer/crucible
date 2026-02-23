# Crucible

God-mode OpenCode setup for production-grade engineering.

Planning docs: `docs/plan/`

## What Crucible Includes

- 7 specialized agents (`Builder`, `Architect`, `Reviewer`, `Researcher`, `Scout`, `Librarian`, `Oracle`)
- 28 hooks and 18+ tools (LSP, AST-Grep, search, session management, background agents)
- Template-driven prompt system (`src/templates/*.md`)
- Workflow state + plan/progress context injection
- DCP integration (`@tarquinen/opencode-dcp`)
- Supermemory integration as a plugin (`opencode-supermemory`)

## Prerequisites

- Bun (latest)
- OpenCode installed and available on PATH (`opencode` command)
- Provider access configured in OpenCode:
  - OpenAI (`gpt-5.3-codex`)
  - Anthropic (`claude-opus-4.6`, `claude-sonnet-4.6`)

## Setup (Local Dev Mode)

1. Install dependencies:

```bash
bun install
```

2. Build Crucible:

```bash
bun run build
```

This compiles `dist/index.js` and copies prompt templates to `dist/templates/`.

3. Configure API credentials (no shell export required):

```bash
bash scripts/configure-credentials.sh --mode userwide
```

For isolated profiles, use:

```bash
bash scripts/configure-credentials.sh --mode isolated
```

Also ensure OpenCode provider auth is set up (OpenAI + Anthropic).

4. Start OpenCode from the Crucible directory:

```bash
opencode
```

## How Crucible Loads

- OpenCode auto-discovers plugins in `.opencode/plugins/`
- Crucible plugin entry: `.opencode/plugins/crucible.ts`
- That file loads the built plugin bundle: `dist/index.js`
- Agents auto-load from `.opencode/agents/*.md`
- Commands auto-load from `.opencode/command/*.md`

## Config Notes

- `opencode.json` enables:
  - `@tarquinen/opencode-dcp@latest` (plugin)
  - `opencode-supermemory@latest` (plugin)
- Supermemory is a **plugin**, not an MCP server.
- MCP servers configured: Context7, Auggie, Tavily, Grep.app.
- Auto-compaction is disabled (`"compaction": { "auto": false }`).

## Verify It Is Working

Inside OpenCode, run:

- `/plan-project` or `/implement` (commands should resolve)
- `task(...)` tool (background agent orchestration should work)
- `supermemory` tool (plugin-backed memory should respond)
- `context7_*` tools (MCP docs tooling should respond)

If commands or agents do not appear, ensure you launched OpenCode from this repository root.

## Installation Modes

You have two robust ways to use Crucible beyond local dev mode.

### 1) User-Wide (single OpenCode installation, available from any project)

This installs Crucible into your global OpenCode config at `~/.config/opencode`.

```bash
bash scripts/install-userwide-crucible.sh
```

What it does:
- Builds Crucible
- Registers Crucible plugin shim in `~/.config/opencode/plugins/crucible.js`
- Links agents/commands/skills from this repo into global config
- Merges global `opencode.json{,c}` to ensure:
  - Plugins: `@tarquinen/opencode-dcp@latest`, `opencode-supermemory@latest`
  - MCPs: Context7, Auggie, Tavily, Grep.app
  - `compaction.auto = false`

After this, running `opencode` from any project uses Crucible globally.

Then configure keys once:

```bash
bash scripts/configure-credentials.sh --mode userwide
```

### 2) Isolated Profile (recommended for your current testing)

This creates a fully isolated OpenCode runtime and launcher under `~/.crucible-opencode`.

```bash
bash scripts/setup-isolated-crucible.sh
```

For true binary isolation using your own OpenCode build/fork:

```bash
CRUCIBLE_OPENCODE_BIN="/absolute/path/to/custom/opencode" bash scripts/setup-isolated-crucible.sh
```

What it does:
- Builds Crucible
- Installs a separate OpenCode binary to `~/.crucible-opencode/bin/opencode`
- Creates isolated XDG directories (`config/data/state/cache`)
- Wires Crucible plugin + agents/commands/skills into isolated config
- Writes launcher wrappers:
  - `~/.crucible-opencode/bin/opencode-crucible`
  - `~/.crucible-opencode/bin/opencode-crucible-strict`

Use:

```bash
~/.crucible-opencode/bin/opencode-crucible
```

Configure keys once for the isolated profile:

```bash
bash scripts/configure-credentials.sh --mode isolated
```

Strict mode disables project config discovery:

```bash
~/.crucible-opencode/bin/opencode-crucible-strict
```

This keeps your default OpenCode + oh-my-opencode setup untouched.
