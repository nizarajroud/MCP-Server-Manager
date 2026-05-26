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

# Read agent config to get the actual command for each server
# Use the default agent (exp2) as source of truth
KIRO_CONFIGS="${REMOTE_KIRO_CONFIGS:-${HOME}/HomeWspce/kiro-configs}"
DEFAULT_AGENT="${DEFAULT_AGENT:-exp2}"
AGENT_FILE="${KIRO_CONFIGS}/agents/${DEFAULT_AGENT}.json"

if [ ! -f "$AGENT_FILE" ]; then
    echo "❌ Agent file not found: $AGENT_FILE"
    exit 1
fi

# Load environment variables (API keys, tokens)
KIRO_ENV="${KIRO_CONFIGS}/.env"
if [ -f "$KIRO_ENV" ]; then
    set -a
    source "$KIRO_ENV"
    set +a
    echo "  ✓ Loaded env from ${KIRO_ENV}"
fi

for SERVER in $SERVERS; do
    PORT_OFFSET=$(yq -r ".servers.\"${SERVER}\".port_offset" "$SERVERS_YAML")
    PORT=$((BASE_PORT + PORT_OFFSET))

    CMD=$(jq -r ".mcpServers.\"${SERVER}\"._original.command // .mcpServers.\"${SERVER}\".command // empty" "$AGENT_FILE" 2>/dev/null)
    ARGS=$(jq -r ".mcpServers.\"${SERVER}\"._original.args // .mcpServers.\"${SERVER}\".args // [] | join(\" \")" "$AGENT_FILE" 2>/dev/null)

    if [ -z "$CMD" ]; then
        echo "  ⚠️  ${SERVER}: not found in ${DEFAULT_AGENT}.json, skipping"
        continue
    fi

    STDIO_CMD="${CMD} ${ARGS}"
    LOG_FILE="${LOG_DIR}/mcp-${SERVER}.log"

    echo "  → ${SERVER} on :${PORT} (${STDIO_CMD})"
    nohup ${SUPERGATEWAY_CMD} --stdio "${STDIO_CMD}" --port ${PORT} > "${LOG_FILE}" 2>&1 &
    sleep 1
done

echo ""
echo "✅ Done. Check status with: ss -tlnp | grep -E '320[0-9]'"
