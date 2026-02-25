#!/bin/bash

# Arrêter les serveurs s'ils sont déjà lancés
pkill -f "node.*vite" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null

# Installer les dépendances
echo "Vérification des dépendances..."
npm install --no-bin-links

# Lancer le backend en background
echo "Démarrage du backend..."
nohup node server.js > backend.log 2>&1 &

# Attendre que le backend démarre
sleep 2

# Lancer le frontend en background
echo "Démarrage du frontend..."
nohup node node_modules/vite/bin/vite.js > vite.log 2>&1 &

echo "Application démarrée !"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Logs: vite.log et backend.log"
