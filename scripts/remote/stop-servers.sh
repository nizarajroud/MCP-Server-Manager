#!/usr/bin/env bash
# MCP Remote Deployment — Stop all supergateway instances
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/machine.env"

echo "🛑 Stopping all MCP servers on ${MACHINE_NAME}..."
pkill -f supergateway 2>/dev/null && echo "✅ All supergateway processes killed." || echo "ℹ️  No supergateway processes running."
