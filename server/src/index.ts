// src/index.ts
import { WebSocketServer, WebSocket } from "ws";
import { initDB } from "./db/database";
import { createTables } from "./db/schema";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.routes";


const PORT = 8080;
const API_PORT = 3000;

const wss = new WebSocketServer({ port: PORT });
const connectedClients = new Set<WebSocket>();

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

// ---------- Express API ----------
function setupApiServer() {
  const app = express();
  app.use(cors({ origin: "http://localhost:5173" })); // adjust if needed
  app.use(express.json());

  app.use("/auth", authRoutes);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.listen(API_PORT, () => {
    console.log(`API server running on http://localhost:${API_PORT}`);
  });
}


async function start() {
  try {
    // Initialize DB + ensure tables exist
    await initDB();
    await createTables();

    // Start WS server handlers
    setupWebSocketServer();
    setupApiServer();
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

void start();