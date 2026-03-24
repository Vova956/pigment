# Pigment — Collaborative Canvas

Real-time collaborative drawing and whiteboard platform.

## Development

Install dependencies:

```bash
npm install
cd client && npm install
cd server && npm install
```

Run client and server locally:

```bash
# Terminal 1 — Astro dev server (port 3000)
npm run dev:client

# Terminal 2 — Express API + WebSocket server (ports 3001 / 8080)
npm run dev:server
```

## Production Deployment

### 1. Build

```bash
# Build the client with production URLs
PUBLIC_API_URL="" \
PUBLIC_WS_URL="ws://sdd3.cs.rpi.edu:3000/ws" \
npm run build:client

# Build the server
npm run build:server
```

### 2. Deploy static files

```bash
sudo mkdir -p /var/www/pigment
sudo cp -r client/dist/* /var/www/pigment/
```

### 3. Run the server

```bash
npm install -g pm2

pm2 start server/dist/index.js --name pigment-server
pm2 save
pm2 startup
```

### 4. nginx config

```nginx
server {
    listen 3000;
    server_name sdd3.cs.rpi.edu;
    root /var/www/pigment;
    index index.html;

    location /auth {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /sessions {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Reload nginx after updating the config:

```bash
sudo nginx -t && sudo nginx -s reload
```

### Useful commands

```bash
# View server logs
pm2 logs pigment-server

# Restart server
pm2 restart pigment-server

# Kill processes on a port (if port already in use)
fuser -k 8080/tcp
fuser -k 3001/tcp

# View nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
