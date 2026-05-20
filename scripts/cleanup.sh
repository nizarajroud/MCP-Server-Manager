#!/bin/bash
echo "=== Stopping MCP Server Manager ==="
pkill -f "node.*vite" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
echo "=== Stopped ==="
