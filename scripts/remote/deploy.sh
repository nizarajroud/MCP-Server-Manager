#!/usr/bin/env bash
# MCP Remote Deployment — Deploy and start servers on a remote machine via SSH
# Run this from ENVY (the agent client machine).
# Usage: ./deploy.sh [start|stop|status]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/machine.env"

ACTION="${1:-start}"
SSH_CMD="ssh -p ${SSH_PORT} -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${MACHINE_HOST}"
REMOTE_SCRIPTS_DIR="/home/${SSH_USER}/HomeWspce/MCP-Server-Manager/scripts/remote"

case "$ACTION" in
    start)
        echo "🚀 Deploying MCP servers to ${MACHINE_NAME} (${MACHINE_HOST})..."
        ${SSH_CMD} "cd ${REMOTE_SCRIPTS_DIR} && bash start-servers.sh"
        ;;
    stop)
        echo "🛑 Stopping MCP servers on ${MACHINE_NAME}..."
        ${SSH_CMD} "cd ${REMOTE_SCRIPTS_DIR} && bash stop-servers.sh"
        ;;
    status)
        echo "📊 Status of ${MACHINE_NAME} (${MACHINE_HOST})..."
        for port in $(seq ${BASE_PORT} $((BASE_PORT + PORT_COUNT - 1))); do
            nc -z -w1 ${MACHINE_HOST} ${port} 2>/dev/null && \
                echo "  ✅ :${port} UP" || echo "  ❌ :${port} DOWN"
        done
        ;;
    *)
        echo "Usage: $0 [start|stop|status]"
        exit 1
        ;;
esac
