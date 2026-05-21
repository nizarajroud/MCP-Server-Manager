#!/bin/bash

# Déterminer les ports (dev par défaut, prod si --prod)
if [ "$1" = "--prod" ]; then
  BACKEND_PORT=${PORT:-4001}
  FRONTEND_PORT=${VITE_PORT:-4000}
  MODE="prod"
else
  BACKEND_PORT=3001
  FRONTEND_PORT=3000
  MODE="dev"
fi

# Arrêter uniquement les processus sur ces ports
lsof -ti:$BACKEND_PORT | xargs kill 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill 2>/dev/null || true
sleep 1

# Installer les dépendances
echo "[$MODE] Vérification des dépendances..."
cd frontend && npm install --no-bin-links 2>&1 | tail -3 && cd ..
cd backend && npm install --no-bin-links 2>&1 | tail -3 && cd ..

# Charger .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Override ports
export PORT=$BACKEND_PORT

# Lancer le backend
echo "[$MODE] Démarrage du backend (port $BACKEND_PORT)..."
nohup node backend/server.js > backend-${MODE}.log 2>&1 &

sleep 2

# Lancer le frontend
echo "[$MODE] Démarrage du frontend (port $FRONTEND_PORT)..."
cd frontend && nohup node node_modules/vite/bin/vite.js --port $FRONTEND_PORT > ../vite-${MODE}.log 2>&1 &
cd ..

echo "[$MODE] Application démarrée !"
echo "Frontend: http://localhost:${FRONTEND_PORT}"
echo "Backend: http://localhost:${BACKEND_PORT}"
