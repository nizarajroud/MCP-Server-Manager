#!/bin/bash
set -e

echo "=== Setting up MCP Server Manager local dev ==="

# Frontend
echo "→ Installing frontend dependencies..."
cd frontend
npm install --no-bin-links
cd ..

# Backend
echo "→ Installing backend dependencies..."
cd backend
npm install --no-bin-links
cd ..

echo "=== Setup complete ==="
echo "Run 'make dev' or './start-app.sh' to start the application."
