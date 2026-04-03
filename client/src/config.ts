export const config = {
  websocketUrl: import.meta.env.PUBLIC_WS_URL || 'ws://localhost:8080',
  apiUrl: import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001',
};
