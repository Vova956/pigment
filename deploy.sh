#!/bin/bash
set -e

echo "==> Building client..."
PUBLIC_API_URL="" \
PUBLIC_WS_URL="ws://sdd3.cs.rpi.edu:3000/ws" \
npm run build:client

echo "==> Deploying static files..."
sudo mkdir -p /var/www/pigment
sudo cp -r client/dist/* /var/www/pigment/

echo "==> Building server..."
npm run build:server

echo "==> Installing pm2..."
npm install -g pm2

echo "==> Starting server with pm2..."
pm2 stop pigment-server 2>/dev/null || true
pm2 delete pigment-server 2>/dev/null || true
pm2 start server/dist/index.js --name pigment-server

echo "==> Saving pm2 config..."
pm2 save
pm2 startup

echo "==> Done. Server is running."
pm2 status pigment-server
