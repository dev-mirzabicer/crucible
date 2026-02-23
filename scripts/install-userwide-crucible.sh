#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_BASE="${XDG_CONFIG_HOME:-$HOME/.config}"
OPENCODE_CONFIG_DIR="$CONFIG_BASE/opencode"

mkdir -p "$OPENCODE_CONFIG_DIR/plugins"

echo "[1/5] Building Crucible..."
(cd "$ROOT_DIR" && bun run build)

echo "[2/5] Wiring Crucible plugin + resources into $OPENCODE_CONFIG_DIR ..."
PLUGIN_CRUCIBLE_DIR="$OPENCODE_CONFIG_DIR/plugins/crucible"
rm -rf "$PLUGIN_CRUCIBLE_DIR" "$OPENCODE_CONFIG_DIR/agents" "$OPENCODE_CONFIG_DIR/command" "$OPENCODE_CONFIG_DIR/skills"
mkdir -p "$PLUGIN_CRUCIBLE_DIR/templates"
cp "$ROOT_DIR/dist/index.js" "$PLUGIN_CRUCIBLE_DIR/index.js"
cp "$ROOT_DIR/dist/templates/"*.md "$PLUGIN_CRUCIBLE_DIR/templates/"
cat >"$OPENCODE_CONFIG_DIR/plugins/crucible.js" <<'EOF'
export { default } from "./crucible/index.js"
EOF

cp -R "$ROOT_DIR/.opencode/agents" "$OPENCODE_CONFIG_DIR/agents"
cp -R "$ROOT_DIR/.opencode/command" "$OPENCODE_CONFIG_DIR/command"
cp -R "$ROOT_DIR/.opencode/skills" "$OPENCODE_CONFIG_DIR/skills"
cp "$ROOT_DIR/.opencode/dcp.jsonc" "$OPENCODE_CONFIG_DIR/dcp.jsonc"

echo "[3/5] Merging OpenCode config..."
CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc"
if [ ! -f "$CONFIG_FILE" ] && [ -f "$OPENCODE_CONFIG_DIR/opencode.json" ]; then
	CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.json"
fi

(
	cd "$ROOT_DIR"
	bun - "$CONFIG_FILE" <<'BUN'
import fs from "node:fs"
import { parse, modify, applyEdits } from "jsonc-parser"

const file = process.argv[2]
if (!file) throw new Error("missing config file path")

let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}"
const parseErrors = []
let config = parse(text, parseErrors, { allowTrailingComma: true, disallowComments: false })
if (parseErrors.length > 0 || !config || typeof config !== "object") config = {}

const format = { insertSpaces: true, tabSize: 2, eol: "\n" }
const set = (path, value) => {
  const edits = modify(text, path, value, { formattingOptions: format })
  text = applyEdits(text, edits)
}

const plugins = Array.isArray(config.plugin) ? [...config.plugin] : []
for (const required of ["@tarquinen/opencode-dcp@latest", "opencode-supermemory@latest"]) {
  if (!plugins.includes(required)) plugins.push(required)
}
set(["plugin"], plugins)

const compaction = config.compaction && typeof config.compaction === "object" ? { ...config.compaction } : {}
compaction.auto = false
set(["compaction"], compaction)

const agent = config.agent && typeof config.agent === "object" ? { ...config.agent } : {}
agent.build = { ...(agent.build || {}), disable: true }
agent.plan = { ...(agent.plan || {}), disable: true }
set(["agent"], agent)

const formatter = config.formatter && typeof config.formatter === "object" ? config.formatter : {}
set(["formatter"], formatter)

const mcp = config.mcp && typeof config.mcp === "object" ? { ...config.mcp } : {}
if (!mcp.context7) {
  mcp.context7 = {
    type: "remote",
    url: "https://mcp.context7.com/mcp",
    enabled: true,
    oauth: false,
  }
}
if (!mcp.auggie) {
  mcp.auggie = {
    type: "remote",
    url: "https://api.augmentcode.com/mcp",
    enabled: true,
  }
}
if (!mcp.tavily) {
  mcp.tavily = {
    type: "local",
    command: ["npx", "-y", "tavily-mcp"],
    environment: { TAVILY_API_KEY: "{env:TAVILY_API_KEY}" },
    enabled: true,
  }
}
if (!mcp.grep_app) {
  mcp.grep_app = {
    type: "remote",
    url: "https://mcp.grep.app",
    enabled: true,
    oauth: false,
  }
}
set(["mcp"], mcp)

if (!text.endsWith("\n")) text += "\n"
fs.writeFileSync(file, text)
BUN
)

echo "[4/5] Writing credentials helper template (if missing)..."
if [ ! -f "$OPENCODE_CONFIG_DIR/.env.example" ]; then
	cat >"$OPENCODE_CONFIG_DIR/.env.example" <<'EOF'
TAVILY_API_KEY=
SUPERMEMORY_API_KEY=

# Provider auth is usually configured via `opencode auth`, but env vars can also be used:
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
EOF
fi

echo "[5/5] Done. Crucible is now user-wide via $OPENCODE_CONFIG_DIR"
echo
echo "Next steps:"
echo "  1) Configure keys in config files (no shell export needed):"
echo "       bash $ROOT_DIR/scripts/configure-credentials.sh --mode userwide"
echo "  2) Start OpenCode from any project directory:"
echo "       opencode"
echo
