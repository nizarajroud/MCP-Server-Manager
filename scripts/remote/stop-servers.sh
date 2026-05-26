#!/usr/bin/env bash
# MCP Remote Deployment — Stop all supergateway instances
# Usage: ./stop-servers.sh <machine-name>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACHINE="${1:-}"

if [ -z "$MACHINE" ]; then
    echo "Usage: $0 <machine-name>"
    exit 1
fi

source "${SCRIPT_DIR}/machine-${MACHINE}.env"

echo "🛑 Stopping all MCP servers on ${MACHINE_NAME}..."
pkill -f supergateway 2>/dev/null && echo "✅ All supergateway processes killed." || echo "ℹ️  No supergateway processes running."
