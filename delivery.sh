#!/bin/bash
set -e

# === Configuration ===
APP_DIR="/mnt/d/PERSONAL/SKILLS/Technical/workspace/Trainings/MCP-Server-Manager"
SERVICE_NAME="mcp-server-manager"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

cd "$APP_DIR"

# === 1. Fetch tags and checkout latest ===
echo "Récupération des tags..."
git fetch --tags --quiet
LATEST_TAG=$(git tag -l --sort=-v:refname | head -1)

if [ -z "$LATEST_TAG" ]; then
  echo "Aucun tag trouvé. Utilisation de la branche main."
  git checkout main --quiet
  LATEST_TAG="main"
else
  echo "Tag: $LATEST_TAG"
  git checkout "$LATEST_TAG" --quiet
fi

# === 2. Load port from .env ===
PORT=$(grep -E "^PORT=" .env 2>/dev/null | cut -d= -f2 || echo "3001")
FRONTEND_PORT=$(grep -E "^VITE_PORT=" .env 2>/dev/null | cut -d= -f2 || echo "3000")

# === 3. Install dependencies ===
echo "Installation des dépendances..."
cd frontend && npm install --no-bin-links --silent 2>/dev/null && cd ..
cd backend && npm install --no-bin-links --silent 2>/dev/null && cd ..

# === 4. Stop existing processes ===
echo "Arrêt des processus existants..."
pkill -f "node.*vite.js.*${APP_DIR}" 2>/dev/null || true
pkill -f "node.*server.js.*${APP_DIR}" 2>/dev/null || true
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
sleep 1

# === 5. Create/overwrite systemd service ===
echo "Configuration du service systemd..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=MCP Server Manager
After=network.target

[Service]
Type=forking
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/restart-app.sh
ExecStop=/usr/bin/pkill -f "node.*(vite|server).js"
Restart=on-failure
User=$(whoami)
Environment=PATH=/usr/bin:/usr/local/bin
EnvironmentFile=${APP_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

# === 6. Enable and start service ===
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME" --quiet
sudo systemctl start "$SERVICE_NAME"

sleep 3

# === 7. Verify ===
if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo ""
  echo "✅ Déploiement réussi"
  echo "   Tag: $LATEST_TAG"
  echo "   Frontend: http://localhost:${FRONTEND_PORT}"
  echo "   Backend: http://localhost:${PORT}"
  echo "   Service: systemctl status $SERVICE_NAME"
  echo "   Auto-start: activé au démarrage WSL"
else
  echo "❌ Erreur — vérifiez: journalctl -u $SERVICE_NAME"
  exit 1
fi
