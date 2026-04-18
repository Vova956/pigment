import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

import { config } from "./config";
import authRoutes from "./routes/auth.routes";
import sessionRoutes from "./routes/session.routes";
import { initDB } from "./db/database";
import { createTables } from "./db/schema";
import { applyMessage, loadSnapshot, flushAll } from "./db/session-state";

// sessionId → set of clients in that room
const sessionRooms = new Map<string, Set<WebSocket>>();
// client → sessionId
const clientSessions = new Map<WebSocket, string>();
// client → user info (so we can broadcast user_left on disconnect)
const clientUsers = new Map<WebSocket, { id: string; name: string }>();

const wss = new WebSocketServer({ port: config.wsPort, host: config.host });

function broadcastToSession(sender: WebSocket | null, sessionId: string, data: object) {
  const msg = JSON.stringify(data);
  const room = sessionRooms.get(sessionId);
  if (!room) return;
  room.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function setupWebSocketServer() {
  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected");

    ws.on("message", async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "join_session") {
          const sessionId: string = String(data.sessionId || "default").toUpperCase();
          const user = data.user as { id: string; name: string };

          // Leave previous session if reconnecting
          const prev = clientSessions.get(ws);
          if (prev) {
            sessionRooms.get(prev)?.delete(ws);
          }

          if (!sessionRooms.has(sessionId)) {
            sessionRooms.set(sessionId, new Set());
          }
          sessionRooms.get(sessionId)!.add(ws);
          clientSessions.set(ws, sessionId);
          clientUsers.set(ws, user);

          // Replay persisted canvas state so the joiner sees prior work,
          // even if they're the first one back after everyone left.
          const snapshot = await loadSnapshot(sessionId);
          ws.send(JSON.stringify({ type: "session_snapshot", snapshot }));

          // Send the new user the list of everyone already in the session
          const existingUsers: { id: string; name: string }[] = [];
          sessionRooms.get(sessionId)!.forEach((client) => {
            if (client !== ws) {
              const u = clientUsers.get(client);
              if (u) existingUsers.push(u);
            }
          });
          if (existingUsers.length > 0) {
            ws.send(JSON.stringify({ type: "session_users", users: existingUsers }));
          }

          // Tell everyone else in the session that this user joined
          broadcastToSession(ws, sessionId, { type: "user_joined", user });
        } else {
          // Route all other messages (stroke, cursor_update, clear_canvas, chat…)
          // only to clients in the same session
          const sessionId = clientSessions.get(ws);
          if (sessionId) {
            // Persist mutating messages before fan-out so late joiners get
            // the same canvas as current collaborators.
            await applyMessage(sessionId, data);
            broadcastToSession(ws, sessionId, data);
          }
        }
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      const sessionId = clientSessions.get(ws);
      const user = clientUsers.get(ws);

      if (sessionId && user) {
        // Tell remaining session members this user left
        broadcastToSession(ws, sessionId, { type: "user_left", userId: user.id });

        sessionRooms.get(sessionId)?.delete(ws);
        if (sessionRooms.get(sessionId)?.size === 0) {
          sessionRooms.delete(sessionId);
        }
      }

      clientSessions.delete(ws);
      clientUsers.delete(ws);
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
    console.log(`API server running on http://${config.host}:${config.apiPort}`);
  });
}

async function start() {
  try {
    await initDB();
    await createTables();
    setupWebSocketServer();
    setupApiServer();
    console.log(`WebSocket server running on ws://${config.host}:${config.wsPort}`);

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, flushing session state…`);
      await flushAll();
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();
