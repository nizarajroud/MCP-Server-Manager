#!/bin/bash
set -e

APP_DIR="/mnt/d/PERSONAL/SKILLS/Technical/workspace/Trainings/MCP-Server-Manager"
SERVICE_NAME="mcp-server-manager"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

cd "$APP_DIR"

# === Menu ===
CHOICE=$(echo -e "Créer un tag\nDéployer une version" | fzf --prompt="Delivery > " --height=5 --reverse)

case "$CHOICE" in

# ============================================================
# OPTION 1: Créer un tag
# ============================================================
"Créer un tag")
  git checkout main --quiet
  git pull --rebase origin main --quiet

  # Lire version actuelle et incrémenter
  CURRENT=$(cat VERSION | tr -d '[:space:]')
  MAJOR=$(echo "$CURRENT" | sed 's/v\([0-9]*\).*/\1/')
  NEW_MAJOR=$((MAJOR + 1))
  NEW_VERSION="v${NEW_MAJOR}.0.0"

  # Écrire nouvelle version
  echo "$NEW_VERSION" > VERSION

  # Commit + push + tag
  git add VERSION
  git commit -m "release: ${NEW_VERSION}"
  git tag "$NEW_VERSION"
  git push origin main --quiet
  git push origin "$NEW_VERSION" --quiet

  echo ""
  echo "✅ Tag créé: $NEW_VERSION"
  ;;

# ============================================================
# OPTION 2: Déployer une version
# ============================================================
"Déployer une version")
  # Fetch tags et checkout le dernier
  echo "Récupération des tags..."
  git fetch --tags --quiet
  LATEST_TAG=$(git tag -l --sort=-v:refname | head -1)

  if [ -z "$LATEST_TAG" ]; then
    echo "❌ Aucun tag trouvé. Créez d'abord un tag (option 1)."
    exit 1
  fi

  echo "Déploiement de: $LATEST_TAG"
  git checkout "$LATEST_TAG" --quiet

  # Écrire la version déployée
  echo "$LATEST_TAG" > .deployed-version

  # Installer les dépendances
  echo "Installation des dépendances..."
  cd frontend && npm install --no-bin-links --silent 2>/dev/null && cd ..
  cd backend && npm install --no-bin-links --silent 2>/dev/null && cd ..

  # Lire le port
  PORT=4001
  FRONTEND_PORT=4000

  # Arrêter uniquement les processus prod
  echo "Arrêt des processus prod..."
  pkill -f "node.*server.js.*--port.*4001" 2>/dev/null || true
  pkill -f "node.*vite.js.*--port.*4000" 2>/dev/null || true
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  sleep 1

  # Créer/écraser le service systemd
  echo "Configuration du service systemd..."
  sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=MCP Server Manager (prod)
After=network.target

[Service]
Type=forking
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/restart-app.sh --prod
ExecStop=/usr/bin/pkill -f "node.*(vite|server).js.*--port.*(4000|4001)"
Restart=on-failure
User=$(whoami)
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PORT=4001
Environment=VITE_PORT=4000

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME" --quiet
  sudo systemctl start "$SERVICE_NAME"

  sleep 3

  # Vérifier
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo ""
    echo "✅ Déploiement réussi"
    echo "   Version: $LATEST_TAG"
    echo "   Frontend: http://localhost:${FRONTEND_PORT}"
    echo "   Backend: http://localhost:${PORT}"
    echo "   Auto-start: activé"
  else
    echo "❌ Erreur — vérifiez: journalctl -u $SERVICE_NAME"
    exit 1
  fi
  ;;

*)
  echo "Annulé."
  exit 0
  ;;
esac
