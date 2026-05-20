#!/bin/bash

# Arrêter les serveurs s'ils sont déjà lancés
pkill -f "node.*vite.js" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
sleep 1

# Installer les dépendances
echo "Vérification des dépendances..."
cd frontend && npm install --no-bin-links 2>&1 | tail -3 && cd ..
cd backend && npm install --no-bin-links 2>&1 | tail -3 && cd ..

# Lancer le backend en background
echo "Démarrage du backend..."
nohup node backend/server.js > backend.log 2>&1 &

# Attendre que le backend démarre
sleep 2

# Lancer le frontend en background (contournement WSL)
echo "Démarrage du frontend..."
cd frontend && nohup node node_modules/vite/bin/vite.js > ../vite.log 2>&1 &
cd ..

echo "Application démarrée !"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo "Logs: vite.log et backend.log"
