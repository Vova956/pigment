import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

import { config } from "./config";
import authRoutes from "./routes/auth.routes";
import sessionRoutes from "./routes/session.routes";
import { initDB } from "./db/database";
import { createTables } from "./db/schema";

// session id → set of clients in that session
const sessionRooms = new Map<string, Set<WebSocket>>();
// client → session id
const clientSessions = new Map<WebSocket, string>();

const wss = new WebSocketServer({
  port: config.wsPort,
  host: config.host,
});

function broadcastToSession(sender: WebSocket, sessionId: string, message: Buffer) {
  const room = sessionRooms.get(sessionId);
  if (!room) return;
  room.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function setupWebSocketServer() {
  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected");

    ws.on("message", (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "join_session") {
          const sessionId: string = String(data.sessionId || "default").toUpperCase();

          // Leave any previous session
          const prev = clientSessions.get(ws);
          if (prev) {
            sessionRooms.get(prev)?.delete(ws);
          }

          if (!sessionRooms.has(sessionId)) {
            sessionRooms.set(sessionId, new Set());
          }
          sessionRooms.get(sessionId)!.add(ws);
          clientSessions.set(ws, sessionId);

          // Notify others in the session that this user joined
          broadcastToSession(ws, sessionId, message);
        } else {
          const sessionId = clientSessions.get(ws);
          if (sessionId) {
            broadcastToSession(ws, sessionId, message);
          }
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      const sessionId = clientSessions.get(ws);
      if (sessionId) {
        sessionRooms.get(sessionId)?.delete(ws);
        if (sessionRooms.get(sessionId)?.size === 0) {
          sessionRooms.delete(sessionId);
        }
        clientSessions.delete(ws);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });
}

function setupApiServer() {
  const app = express();

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  app.use("/auth", authRoutes);
  app.use("/sessions", sessionRoutes);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(config.apiPort, config.host, () => {
    console.log(
      `API server running on http://${config.host}:${config.apiPort}`
    );
  });
}

async function start() {
  try {
    await initDB();
    await createTables();

    setupWebSocketServer();
    setupApiServer();

    console.log(
      `WebSocket server running on ws://${config.host}:${config.wsPort}`
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();
