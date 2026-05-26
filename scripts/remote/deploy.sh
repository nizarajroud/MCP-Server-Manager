#!/usr/bin/env bash
# MCP Remote Deployment — Deploy and start servers on a remote machine via SSH
# Run this from ENVY (the agent client machine).
# Usage: ./deploy.sh <start|stop|status> --machine <name>
# Example: ./deploy.sh start --machine pcalt
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="${1:-start}"
MACHINE=""

# Parse args
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --machine|-m) MACHINE="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

if [ -z "$MACHINE" ]; then
    echo "Usage: $0 <start|stop|status> --machine <name>"
    echo "Available machines:"
    ls "${SCRIPT_DIR}"/machine-*.env 2>/dev/null | sed 's/.*machine-//;s/\.env//'
    exit 1
fi

ENV_FILE="${SCRIPT_DIR}/machine-${MACHINE}.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Config not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

SSH_CMD="ssh -p ${SSH_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${MACHINE_HOST}"
REMOTE_SCRIPTS_DIR="${REMOTE_PROJECT_DIR}/scripts/remote"

case "$ACTION" in
    start)
        echo "🚀 Deploying MCP servers to ${MACHINE_NAME} (${MACHINE_HOST})..."
        ${SSH_CMD} "cd ${REMOTE_SCRIPTS_DIR} && bash start-servers.sh ${MACHINE}"
        ;;
    stop)
        echo "🛑 Stopping MCP servers on ${MACHINE_NAME}..."
        ${SSH_CMD} "cd ${REMOTE_SCRIPTS_DIR} && bash stop-servers.sh ${MACHINE}"
        ;;
    status)
        echo "📊 Status of ${MACHINE_NAME} (${MACHINE_HOST})..."
        for port in $(seq ${BASE_PORT} $((BASE_PORT + PORT_COUNT - 1))); do
            nc -z -w1 ${MACHINE_HOST} ${port} 2>/dev/null && \
                echo "  ✅ :${port} UP" || echo "  ❌ :${port} DOWN"
        done
        ;;
    *)
        echo "Usage: $0 <start|stop|status> --machine <name>"
        exit 1
        ;;
esac
