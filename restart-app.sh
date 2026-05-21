#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Charger .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^$' | xargs)
fi

# Déterminer les ports (dev par défaut, prod si --prod)
if [ "$1" = "--prod" ]; then
  BACKEND_PORT=${PORT:-${PROD_BACKEND_PORT:-4001}}
  FRONTEND_PORT=${VITE_PORT:-${PROD_FRONTEND_PORT:-4000}}
  MODE="prod"
else
  BACKEND_PORT=${DEV_BACKEND_PORT:-3001}
  FRONTEND_PORT=${DEV_FRONTEND_PORT:-3000}
  MODE="dev"
fi

# Arrêter uniquement les processus sur ces ports
lsof -ti:$BACKEND_PORT | xargs kill 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill 2>/dev/null || true
sleep 1

# Installer les dépendances
echo "[$MODE] Vérification des dépendances..."
cd "$SCRIPT_DIR/frontend" && npm install --no-bin-links 2>&1 | tail -3 && cd "$SCRIPT_DIR"
cd "$SCRIPT_DIR/backend" && npm install --no-bin-links 2>&1 | tail -3 && cd "$SCRIPT_DIR"

# Override port pour le backend
export PORT=$BACKEND_PORT

# Lancer le backend
echo "[$MODE] Démarrage du backend (port $BACKEND_PORT)..."
nohup node "$SCRIPT_DIR/backend/server.js" > "$SCRIPT_DIR/backend-${MODE}.log" 2>&1 &

sleep 2

# Lancer le frontend
echo "[$MODE] Démarrage du frontend (port $FRONTEND_PORT)..."
cd "$SCRIPT_DIR/frontend" && nohup node node_modules/vite/bin/vite.js --port $FRONTEND_PORT > "$SCRIPT_DIR/vite-${MODE}.log" 2>&1 &
cd "$SCRIPT_DIR"

echo "[$MODE] Application démarrée !"
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo "Backend: http://localhost:${BACKEND_PORT}"
