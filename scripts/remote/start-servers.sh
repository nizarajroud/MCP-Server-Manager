#!/usr/bin/env bash
# MCP Remote Deployment — Start all supergateway instances
# Run this ON the remote WSL machine (or via SSH from deploy.sh).
# Reads servers.yaml from kiro-configs to know which servers to launch.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/machine.env"

SERVERS_YAML="${HOME}/HomeWspce/kiro-configs/settings/servers.yaml"

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

# Read agent JSON to get the actual command for each server
AGENT_MCP="${HOME}/HomeWspce/kiro-configs/settings/mcp.json"

for SERVER in $SERVERS; do
    PORT_OFFSET=$(yq -r ".servers.\"${SERVER}\".port_offset" "$SERVERS_YAML")
    PORT=$((BASE_PORT + PORT_OFFSET))

    # Get command + args from agent config
    CMD=$(jq -r ".mcpServers.\"${SERVER}\".command // empty" "$AGENT_MCP" 2>/dev/null)
    ARGS=$(jq -r ".mcpServers.\"${SERVER}\".args // [] | join(\" \")" "$AGENT_MCP" 2>/dev/null)

    if [ -z "$CMD" ]; then
        echo "  ⚠️  ${SERVER}: not found in mcp.json, skipping"
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
