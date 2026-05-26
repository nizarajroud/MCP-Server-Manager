#!/usr/bin/env bash
# MCP Remote Deployment — Start all supergateway instances
# Run this ON the remote WSL machine (or via SSH from deploy.sh).
# Usage: ./start-servers.sh <machine-name>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACHINE="${1:-}"

if [ -z "$MACHINE" ]; then
    echo "Usage: $0 <machine-name>"
    exit 1
fi

ENV_FILE="${SCRIPT_DIR}/machine-${MACHINE}.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Config not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

SERVERS_YAML="${REMOTE_KIRO_CONFIGS:-${HOME}/HomeWspce/kiro-configs}/settings/servers.yaml"

if [ ! -f "$SERVERS_YAML" ]; then
    echo "❌ servers.yaml not found at $SERVERS_YAML"
    exit 1
fi

if ! command -v yq &>/dev/null; then
    echo "❌ yq required. Install: sudo snap install yq"
    exit 1
fi

echo "🚀 Starting MCP servers on ${MACHINE_NAME} (base port: ${BASE_PORT})"
echo "================================================================"

# Get servers targeting this machine
SERVERS=$(yq -r ".servers | to_entries[] | select(.value.target == \"${MACHINE_NAME}\") | .key" "$SERVERS_YAML")

if [ -z "$SERVERS" ]; then
    echo "⚠️  No servers targeting ${MACHINE_NAME} in servers.yaml"
    exit 0
fi

# Kill existing supergateway processes
pkill -f supergateway 2>/dev/null || true
sleep 1

# Read agent configs to get the actual command for each server
KIRO_CONFIGS="${REMOTE_KIRO_CONFIGS:-${HOME}/HomeWspce/kiro-configs}"
AGENT_FILES=$(find "${KIRO_CONFIGS}/agents" -name "*.json" 2>/dev/null)
MCP_JSON="${KIRO_CONFIGS}/settings/mcp.json"

# Lookup command+args across all agent files + mcp.json
find_server_cmd() {
    local server="$1"
    for f in "$MCP_JSON" $AGENT_FILES; do
        local cmd=$(jq -r ".mcpServers.\"${server}\".command // empty" "$f" 2>/dev/null)
        if [ -n "$cmd" ]; then
            local args=$(jq -r ".mcpServers.\"${server}\".args // [] | join(\" \")" "$f" 2>/dev/null)
            echo "${cmd} ${args}"
            return
        fi
    done
}

for SERVER in $SERVERS; do
    PORT_OFFSET=$(yq -r ".servers.\"${SERVER}\".port_offset" "$SERVERS_YAML")
    PORT=$((BASE_PORT + PORT_OFFSET))

    STDIO_CMD=$(find_server_cmd "$SERVER")

    if [ -z "$STDIO_CMD" ]; then
        echo "  ⚠️  ${SERVER}: not found in any agent config, skipping"
        continue
    fi
    LOG_FILE="${LOG_DIR}/mcp-${SERVER}.log"

    echo "  → ${SERVER} on :${PORT} (${STDIO_CMD})"
    nohup ${SUPERGATEWAY_CMD} --stdio "${STDIO_CMD}" --port ${PORT} > "${LOG_FILE}" 2>&1 &
    sleep 1
done

echo ""
echo "✅ Done. Check status with: ss -tlnp | grep -E '320[0-9]'"
