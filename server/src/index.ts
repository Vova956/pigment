import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config';

const wss = new WebSocketServer({ port: config.port, host: config.host });

const connectedClients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  connectedClients.add(ws);

  ws.on('message', (message: Buffer) => {
    console.log('Received:', message.toString());

    // Broadcast to all connected clients
    connectedClients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server running on ws://${config.host}:${config.port}`);
