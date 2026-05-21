#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Charger .env
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | grep -v '^$' | xargs)
fi

DEV_DIR="$SCRIPT_DIR"
PROD_DIR="${PROD_DIR:-/home/nizar/.mcp-server-manager-prod}"
REPO_URL="${APP_REPO_URL:-https://github.com/nizarajroud/MCP-Server-Manager.git}"
SERVICE_NAME="${SERVICE_NAME:-mcp-server-manager}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
PROD_BACKEND_PORT="${PROD_BACKEND_PORT:-4001}"
PROD_FRONTEND_PORT="${PROD_FRONTEND_PORT:-4000}"

# === Menu ===
CHOICE=$(echo -e "Créer un tag\nDéployer une version" | fzf --prompt="Delivery > " --height=5 --reverse)

case "$CHOICE" in

# ============================================================
# OPTION 1: Créer un tag (depuis le dossier dev, sur main)
# ============================================================
"Créer un tag")
  cd "$DEV_DIR"
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
# OPTION 2: Déployer une version (dans le dossier prod isolé)
# ============================================================
"Déployer une version")
  # Cloner ou mettre à jour le dossier prod
  if [ ! -d "$PROD_DIR" ]; then
    echo "Clonage du repo dans $PROD_DIR..."
    git clone "$REPO_URL" "$PROD_DIR" --quiet
  fi

  cd "$PROD_DIR"
  git fetch --tags --quiet

  LATEST_TAG=$(git tag -l --sort=-v:refname | head -1)

  if [ -z "$LATEST_TAG" ]; then
    echo "❌ Aucun tag trouvé. Créez d'abord un tag (option 1)."
    exit 1
  fi

  echo "Déploiement de: $LATEST_TAG"
  git reset --hard HEAD --quiet
  git checkout "$LATEST_TAG" --quiet

  # Écrire la version déployée
  echo "$LATEST_TAG" > .deployed-version

  # Installer les dépendances
  echo "Installation des dépendances..."
  cd frontend && npm install --no-bin-links --silent 2>/dev/null && cd ..
  cd backend && npm install --no-bin-links --silent 2>/dev/null && cd ..

  # Copier .env depuis le dev et ajuster pour la prod
  cp "$DEV_DIR/.env" .env
  sed -i "s|^VITE_BACKEND_URL=.*|VITE_BACKEND_URL=http://localhost:${PROD_BACKEND_PORT}|" .env
  # Ajouter si absent
  grep -q "^VITE_BACKEND_URL" .env || echo "VITE_BACKEND_URL=http://localhost:${PROD_BACKEND_PORT}" >> .env

  # Ports prod
  PORT=$PROD_BACKEND_PORT
  FRONTEND_PORT=$PROD_FRONTEND_PORT

  # Arrêter uniquement les processus prod
  echo "Arrêt des processus prod..."
  lsof -ti:$PORT | xargs kill 2>/dev/null || true
  lsof -ti:$FRONTEND_PORT | xargs kill 2>/dev/null || true
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
WorkingDirectory=${PROD_DIR}
ExecStart=${PROD_DIR}/restart-app.sh --prod
ExecStop=/usr/bin/kill \$(lsof -ti:${PROD_FRONTEND_PORT}) \$(lsof -ti:${PROD_BACKEND_PORT}) 2>/dev/null || true
Restart=on-failure
User=$(whoami)
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PORT=${PROD_BACKEND_PORT}
Environment=VITE_PORT=${PROD_FRONTEND_PORT}

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
    echo "   Dossier: $PROD_DIR"
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
