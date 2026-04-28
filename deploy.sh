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

echo "==> Stopping any existing server on port 8080..."
PID=$(lsof -ti :8080 || true)
if [ -n "$PID" ]; then
  kill "$PID"
  # give the shutdown handler a moment to flush session state
  sleep 2
  # force-kill if still alive
  kill -9 "$PID" 2>/dev/null || true
fi

echo "==> Starting server with nohup..."
cd server
nohup node dist/index.js > ~/pigment-server.log 2>&1 &
disown
cd ..

echo "==> Done. Server is running. Logs: ~/pigment-server.log"
sleep 1
lsof -i :8080 || echo "WARNING: server not listening on 8080"
