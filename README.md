# Pigment — Collaborative Canvas

Real-time collaborative drawing and whiteboard platform. Open a session, share the link, and draw together live in your browser.

---

## For Users — Get Started in 60 Seconds

Pigment is a **web app** — there is nothing to download or install. It runs in any modern web browser (Chrome, Firefox, Edge, Safari) on Windows, macOS, Linux, ChromeOS, iOS, or Android.

### 1. Open the app

Go to **<http://sdd3.cs.rpi.edu:3000>** in your web browser.

### 2. Create an account

1. Click **Sign Up** on the home page.
2. Enter a **username**, your **email address**, and a **password**.
3. Click **Create Account**. You are signed in automatically.

> Already have an account? Click **Log In** instead and enter your email and password.

### 3. Start or join a drawing session

- **To start a new session:** click **New Session** on the home page. You will be taken to a fresh canvas with a unique session link in your browser's address bar.
- **To invite collaborators:** copy the URL from your browser's address bar and send it to anyone you want to draw with. They will need to sign in (or sign up) to join.
- **To join a session someone shared with you:** paste the link they sent you into your browser, sign in, and you will land directly on their canvas.

### 4. Draw

Use the toolbar at the top of the canvas:

| Tool | Shortcut | What it does |
| --- | --- | --- |
| Pen | `P` | Freehand strokes in the selected color and width. |
| Highlighter | `H` | Semi-transparent strokes for highlighting. |
| Eraser | `E` | Erases existing strokes. |
| Lasso | `L` | Select a region (drag a loop around it). |
| Text | `T` | Click on the canvas to type a text label. |
| Pan | `V` | Drag to move the canvas (also: hold `Space`, or middle-mouse drag). |

Plus: pick from the **color palette** or use the **custom color picker** (recently used colors are saved automatically), set **brush / font size** with the slider, **upload an image** to drop onto the canvas, **undo** your last action, **clear** the whole canvas (visible to everyone), and **export** the canvas as a PNG.

The side panel gives you **layers** (organize work in separate layers and switch which one is active), an **activity feed** (see what other collaborators are doing in real time), and a **chat** panel for talking with everyone in the session.

Every stroke appears in real time on every collaborator's screen. Your work is saved automatically — close the tab and come back anytime; your sessions stay in your account.

### System requirements

- A modern browser released in the last 2 years.
- An internet connection (the app uses WebSockets for live updates).
- A pointing device — mouse, trackpad, stylus, or touchscreen all work.

### Troubleshooting

| Problem | Try |
| --- | --- |
| Page does not load | Confirm the URL is correct and that you are on a network that can reach `sdd3.cs.rpi.edu`. |
| "Invalid credentials" on log in | Double-check your email; passwords are case-sensitive. Sign up if you have not yet. |
| Strokes not appearing for other users | Refresh the page. If the issue persists, check your network connection. |
| Canvas feels slow | Close other tabs; very large sessions with many strokes can use significant memory. |

---

## For Developers

### Local development

Install dependencies (run once):

```bash
npm install
cd client && npm install
cd ../server && npm install
```

Run the client and server in two terminals:

```bash
# Terminal 1 — Astro dev server (http://localhost:4321)
npm run dev:client

# Terminal 2 — Express API + WebSocket server (ports 3001 / 8080)
npm run dev:server
```

### Tests and lint

```bash
npm test            # run client + server unit tests
npm run lint        # eslint across both packages
npm run format      # prettier write
```

### Project layout

```
client/   Astro + React frontend (canvas, auth UI, session list)
server/   Express REST API + WebSocket server + SQLite persistence
deploy.sh One-shot build + deploy script for the production host
```

---

## Production Deployment

The deployment target is `sdd3.cs.rpi.edu`. The `deploy.sh` script at the repo root performs the full build and restart in one command:

```bash
./deploy.sh
```

It builds the client with the production WebSocket URL, copies the static bundle into `/var/www/pigment`, builds the server, stops any running server on port 8080, and starts the new server with `nohup`. Logs are written to `~/pigment-server.log`.

### Manual steps (if not using deploy.sh)

```bash
# 1. Build the client with production URLs
PUBLIC_API_URL="" \
PUBLIC_WS_URL="ws://sdd3.cs.rpi.edu:3000/ws" \
npm run build:client

# 2. Deploy static files
sudo mkdir -p /var/www/pigment
sudo cp -r client/dist/* /var/www/pigment/

# 3. Build and run the server
npm run build:server
pm2 start server/dist/index.js --name pigment-server
pm2 save
pm2 startup
```

### nginx config

```nginx
server {
    listen 3000;
    server_name sdd3.cs.rpi.edu;
    root /var/www/pigment;
    index index.html;

    location /auth     { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
    location /sessions { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
    location /health   { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / { try_files $uri $uri/ /index.html; }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Reload after editing:

```bash
sudo nginx -t && sudo nginx -s reload
```

### Operational commands

```bash
pm2 logs pigment-server      # tail server logs (if running under pm2)
pm2 restart pigment-server   # restart server
tail -f ~/pigment-server.log # tail nohup-launched server logs
fuser -k 8080/tcp            # free the WebSocket port
fuser -k 3001/tcp            # free the API port
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for known limitations of the current release.
