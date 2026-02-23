#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MODE=""
PROFILE_DIR="${CRUCIBLE_PROFILE_DIR:-$HOME/.crucible-opencode}"
TAVILY_KEY=""
SUPERMEMORY_KEY=""
NON_INTERACTIVE=0

while [[ $# -gt 0 ]]; do
	case "$1" in
	--mode)
		MODE="$2"
		shift 2
		;;
	--profile-dir)
		PROFILE_DIR="$2"
		shift 2
		;;
	--tavily-key)
		TAVILY_KEY="$2"
		shift 2
		;;
	--supermemory-key)
		SUPERMEMORY_KEY="$2"
		shift 2
		;;
	--non-interactive)
		NON_INTERACTIVE=1
		shift
		;;
	*)
		echo "Unknown arg: $1"
		echo "Usage: $0 --mode <isolated|userwide> [--profile-dir <path>] [--tavily-key <key>] [--supermemory-key <key>] [--non-interactive]"
		exit 1
		;;
	esac
done

if [[ "$MODE" != "isolated" && "$MODE" != "userwide" ]]; then
	echo "--mode must be one of: isolated, userwide"
	exit 1
fi

if [[ "$MODE" == "isolated" ]]; then
	OPENCODE_CONFIG_DIR="$PROFILE_DIR/xdg-config/opencode"
else
	OPENCODE_CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
fi

mkdir -p "$OPENCODE_CONFIG_DIR"

if [[ $NON_INTERACTIVE -eq 0 ]]; then
	if [[ -z "$TAVILY_KEY" ]]; then
		read -r -s -p "Tavily API key (leave blank to keep current): " TAVILY_KEY
		echo
	fi
	if [[ -z "$SUPERMEMORY_KEY" ]]; then
		read -r -s -p "Supermemory API key (leave blank to keep current): " SUPERMEMORY_KEY
		echo
	fi
fi

CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc"
if [[ ! -f "$CONFIG_FILE" && -f "$OPENCODE_CONFIG_DIR/opencode.json" ]]; then
	CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.json"
fi

(
	cd "$ROOT_DIR"
	bun - "$CONFIG_FILE" "$TAVILY_KEY" <<'BUN'
import fs from "node:fs"
import { parse, modify, applyEdits } from "jsonc-parser"

const file = process.argv[2]
const tavily = process.argv[3] ?? ""
if (!file) throw new Error("missing config file path")

let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}"
const parseErrors = []
const parsed = parse(text, parseErrors, { allowTrailingComma: true, disallowComments: false })
const config: Record<string, any> = parseErrors.length > 0 || !parsed || typeof parsed !== "object" ? {} : parsed

const fmt = { insertSpaces: true, tabSize: 2, eol: "\n" }
const set = (path: (string | number)[], value: unknown) => {
  text = applyEdits(text, modify(text, path, value, { formattingOptions: fmt }))
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
if (!mcp.grep_app) {
  mcp.grep_app = {
    type: "remote",
    url: "https://mcp.grep.app",
    enabled: true,
    oauth: false,
  }
}
if (!mcp.tavily) {
  mcp.tavily = {
    type: "local",
    command: ["npx", "-y", "tavily-mcp"],
    environment: {},
    enabled: true,
  }
}

const tavilyEnv = mcp.tavily.environment && typeof mcp.tavily.environment === "object" ? { ...mcp.tavily.environment } : {}
if (tavily) tavilyEnv.TAVILY_API_KEY = tavily
if (!tavilyEnv.TAVILY_API_KEY) tavilyEnv.TAVILY_API_KEY = "{env:TAVILY_API_KEY}"
mcp.tavily.environment = tavilyEnv
mcp.tavily.enabled = true

set(["mcp"], mcp)

if (!text.endsWith("\n")) text += "\n"
fs.writeFileSync(file, text)
BUN
)

if [[ -n "$SUPERMEMORY_KEY" ]]; then
	SUPERMEM_FILE="$OPENCODE_CONFIG_DIR/supermemory.jsonc"
	cat >"$SUPERMEM_FILE" <<EOF
{
  "apiKey": "$SUPERMEMORY_KEY"
}
EOF
	chmod 600 "$SUPERMEM_FILE"
fi

if [[ "$MODE" == "isolated" ]]; then
	CREDS_FILE="$PROFILE_DIR/credentials.env"
	{
		if [[ -n "$TAVILY_KEY" ]]; then
			printf 'TAVILY_API_KEY=%q\n' "$TAVILY_KEY"
		fi
		if [[ -n "$SUPERMEMORY_KEY" ]]; then
			printf 'SUPERMEMORY_API_KEY=%q\n' "$SUPERMEMORY_KEY"
		fi
	} >"$CREDS_FILE"
	chmod 600 "$CREDS_FILE"
fi

echo "Credentials configured for mode: $MODE"
echo "OpenCode config: $CONFIG_FILE"
if [[ -n "$SUPERMEMORY_KEY" ]]; then
	echo "Supermemory config: $OPENCODE_CONFIG_DIR/supermemory.jsonc"
fi
