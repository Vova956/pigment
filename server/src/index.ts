import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

import { config } from "./config";
import authRoutes from "./routes/auth.routes";
import { initDB } from "./db/database";
import { createTables } from "./db/schema";

const connectedClients = new Set<WebSocket>();

const wss = new WebSocketServer({
  port: config.wsPort,
  host: config.host,
});

function broadcast(sender: WebSocket, message: Buffer) {
  connectedClients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function setupWebSocketServer() {
  wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected");
    connectedClients.add(ws);

    ws.on("message", (message: Buffer) => {
      console.log("Received:", message.toString());
      broadcast(ws, message);
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      connectedClients.delete(ws);
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