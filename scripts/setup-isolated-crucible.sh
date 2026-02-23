#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_DIR="${CRUCIBLE_PROFILE_DIR:-$HOME/.crucible-opencode}"
CUSTOM_OPENCODE_BIN="${CRUCIBLE_OPENCODE_BIN:-}"

XDG_CONFIG_HOME_DIR="$PROFILE_DIR/xdg-config"
XDG_DATA_HOME_DIR="$PROFILE_DIR/xdg-data"
XDG_STATE_HOME_DIR="$PROFILE_DIR/xdg-state"
XDG_CACHE_HOME_DIR="$PROFILE_DIR/xdg-cache"
ISOLATED_HOME_DIR="$PROFILE_DIR/home"

OPENCODE_CONFIG_DIR="$XDG_CONFIG_HOME_DIR/opencode"
BIN_DIR="$PROFILE_DIR/bin"

mkdir -p "$BIN_DIR" "$OPENCODE_CONFIG_DIR/plugins" "$XDG_DATA_HOME_DIR" "$XDG_STATE_HOME_DIR" "$XDG_CACHE_HOME_DIR" "$ISOLATED_HOME_DIR"

echo "[1/6] Building Crucible..."
(cd "$ROOT_DIR" && bun run build)

if [ -n "$CUSTOM_OPENCODE_BIN" ]; then
	if [ ! -x "$CUSTOM_OPENCODE_BIN" ]; then
		echo "ERROR: CRUCIBLE_OPENCODE_BIN is not executable: $CUSTOM_OPENCODE_BIN"
		exit 1
	fi
	echo "[2/6] Using custom OpenCode binary from CRUCIBLE_OPENCODE_BIN: $CUSTOM_OPENCODE_BIN"
	ln -sf "$CUSTOM_OPENCODE_BIN" "$BIN_DIR/opencode"
elif [ ! -x "$BIN_DIR/opencode" ]; then
	echo "[2/6] Installing isolated OpenCode binary to $BIN_DIR ..."
	curl -fsSL https://opencode.ai/install | OPENCODE_INSTALL_DIR="$BIN_DIR" bash
else
	echo "[2/6] Isolated OpenCode binary already exists: $BIN_DIR/opencode"
fi

if [ ! -x "$BIN_DIR/opencode" ]; then
	SYSTEM_OPENCODE="$(command -v opencode || true)"
	if [ -n "$SYSTEM_OPENCODE" ] && [ -x "$SYSTEM_OPENCODE" ]; then
		echo "[2/6] Installer reported existing version. Reusing system OpenCode binary: $SYSTEM_OPENCODE"
		ln -sf "$SYSTEM_OPENCODE" "$BIN_DIR/opencode"
	fi
fi

if [ ! -x "$BIN_DIR/opencode" ]; then
	echo "ERROR: isolated OpenCode binary is still missing at $BIN_DIR/opencode"
	echo "Try one of these manually:"
	echo "  1) curl -fsSL https://opencode.ai/install | OPENCODE_INSTALL_DIR=\"$BIN_DIR\" bash"
	echo "  2) ln -sf \"$(command -v opencode 2>/dev/null || echo /path/to/opencode)\" \"$BIN_DIR/opencode\""
	exit 1
fi

echo "[3/6] Writing isolated OpenCode config..."
cat >"$OPENCODE_CONFIG_DIR/opencode.json" <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "build": { "disable": true },
    "plan": { "disable": true }
  },
  "plugin": [
    "@tarquinen/opencode-dcp@latest",
    "opencode-supermemory@latest"
  ],
  "compaction": {
    "auto": false
  },
  "formatter": {},
  "mcp": {
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "enabled": true,
      "oauth": false
    },
    "auggie": {
      "type": "remote",
      "url": "https://api.augmentcode.com/mcp",
      "enabled": true
    },
    "tavily": {
      "type": "local",
      "command": ["npx", "-y", "tavily-mcp"],
      "environment": {
        "TAVILY_API_KEY": "{env:TAVILY_API_KEY}"
      },
      "enabled": true
    },
    "grep_app": {
      "type": "remote",
      "url": "https://mcp.grep.app",
      "enabled": true,
      "oauth": false
    }
  }
}
JSON

echo "[4/6] Wiring Crucible plugin + resources into isolated config..."
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

echo "[5/6] Writing isolated launcher wrappers..."
cat >"$BIN_DIR/opencode-crucible" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ -f "$PROFILE_DIR/credentials.env" ]; then
  set -a
  source "$PROFILE_DIR/credentials.env"
  set +a
fi
export HOME="$ISOLATED_HOME_DIR"
export XDG_CONFIG_HOME="$XDG_CONFIG_HOME_DIR"
export XDG_DATA_HOME="$XDG_DATA_HOME_DIR"
export XDG_STATE_HOME="$XDG_STATE_HOME_DIR"
export XDG_CACHE_HOME="$XDG_CACHE_HOME_DIR"
exec "$BIN_DIR/opencode" "\$@"
EOF

cat >"$BIN_DIR/opencode-crucible-strict" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ -f "$PROFILE_DIR/credentials.env" ]; then
  set -a
  source "$PROFILE_DIR/credentials.env"
  set +a
fi
export HOME="$ISOLATED_HOME_DIR"
export XDG_CONFIG_HOME="$XDG_CONFIG_HOME_DIR"
export XDG_DATA_HOME="$XDG_DATA_HOME_DIR"
export XDG_STATE_HOME="$XDG_STATE_HOME_DIR"
export XDG_CACHE_HOME="$XDG_CACHE_HOME_DIR"
export OPENCODE_DISABLE_PROJECT_CONFIG=1
export OPENCODE_CONFIG_DIR="$OPENCODE_CONFIG_DIR"
exec "$BIN_DIR/opencode" "\$@"
EOF

chmod +x "$BIN_DIR/opencode-crucible" "$BIN_DIR/opencode-crucible-strict"

echo "[6/6] Writing isolated env template..."
cat >"$PROFILE_DIR/.env.example" <<'EOF'
TAVILY_API_KEY=
SUPERMEMORY_API_KEY=

# Provider auth is usually configured via `opencode auth`, but env vars can also be used:
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
EOF

echo
echo "Isolated Crucible profile ready: $PROFILE_DIR"
echo
echo "Next steps:"
echo "  1) Configure keys in profile config (no shell export needed):"
echo "       bash $ROOT_DIR/scripts/configure-credentials.sh --mode isolated"
echo "  2) Run isolated OpenCode with Crucible:"
echo "       $BIN_DIR/opencode-crucible"
echo "  3) (Optional) strict mode with no project .opencode loading:"
echo "       $BIN_DIR/opencode-crucible-strict"
echo
